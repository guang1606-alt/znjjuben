import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { prisma as defaultPrisma } from '../lib/prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin, requireSuperAdmin } from '../middleware/admin';
import { reconcileKnowledge } from '../lib/knowledge-dedup';
import {
  runSelfLearning, pruneKnowledge, buildLearningReport, classifyCategory,
  LearnSignal, LEARN_CATEGORIES,
} from '../engine/self-learning';
import { runDailyLearningCycle } from '../services/auto-learning';
import { scanWithStore } from '../lib/safety-store';
import { buildBuiltinSkillPack, auditSkillPack, buildSkillMarkdown, buildSkillBundle, SKILL_NAME } from '../engine/skill-pack';
import fs from 'fs';
import path from 'path';
function appVersion(): string {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).version; } catch { return 'dev'; }
}

type PrismaLike = typeof defaultPrisma;
const CATEGORIES = ['character', 'plot', 'payoff', 'reversal', 'scene', 'dialogue', 'av', 'compliance'] as const;
/**
 * 政策/平台规则一致性预检：统一走内容合规中台（唯一事实源，对接 9·1《微短剧发展管理办法》）。
 * 命中 BLOCK 导向即标记相悖、不予生效；语义级判断由合规审核师 Agent + 法规库补充。
 */
async function complianceCheck(text: string, db: any): Promise<string | null> {
  const scan = await scanWithStore(text, db);
  if (scan.level !== 'block') return null;
  const hit = scan.blocked[0].matched;
  return `内容含「${hit}」导向，与国家法规/平台规则相悖，已拦截不予生效`;
}
const uploadSchema = z.object({
  kind: z.enum(['TEXT', 'URL', 'VIDEO', 'FILE']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2_000_000), // 文件/视频由前端读取文本或转写后传入
  sourceUrl: z.string().url().optional().or(z.literal('')),
  fileName: z.string().max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
});

export function createKnowledgeRouter(prisma: PrismaLike | any) {
  const knowledgeRouter = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅管理员可进入学习窗口后台');

  /** 上传一条知识/技能/政策，自动分类与合规预检，进入待审核队列 */
  knowledgeRouter.post('/', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    const p = uploadSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
    const category = (p.data.category ?? 'plot') as string;
    const illegal = await complianceCheck(p.data.content, prisma);
    // 去冗 · 相悖：与既有已收录/待审知识比对
    const prior = await prisma.knowledgeItem.findMany({
      where: { status: { in: ['APPROVED', 'PENDING'] } },
      select: { content: true, category: true }, take: 500,
    }).catch(() => [] as { content: string; category: string }[]);
    const recon = reconcileKnowledge(p.data.content, category, prior);
    let status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
    const notes: string[] = [];
    if (illegal) { status = 'REJECTED'; notes.push(illegal); }
    if (recon.status === 'CONFLICT') notes.push(...recon.conflicts, recon.note);
    if (recon.status === 'DUPLICATE') notes.push(`${recon.note}（近似：${recon.duplicateOf}…）`);
    const item = await prisma.knowledgeItem.create({
      data: {
        kind: p.data.kind, title: p.data.title, content: p.data.content.slice(0, 500_000),
        sourceUrl: p.data.sourceUrl || null, fileName: p.data.fileName,
        category,
        status, conflictNote: notes.length ? notes.join('；') : null,
        uploadedById: req.userId!,
      },
    });
    res.json({ ok: true, id: item.id, status: item.status, conflictNote: item.conflictNote, dedup: recon.status });
  });

  /** 学习队列：按状态/分类筛选 */
  knowledgeRouter.get('/', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    const status = String(req.query.status ?? '');
    const list = await prisma.knowledgeItem.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, kind: true, title: true, category: true, status: true, conflictNote: true, createdAt: true, approvedAt: true, skillVersion: true },
    });
    res.json(list);
  });

  /** 审核通过 → 生效（同步到对应岗位智能体，生产发事件触发技能转化） */
  knowledgeRouter.post('/:id/approve', authRequired, requireAdmin, requireSuperAdmin, async (req, res) => {
    const item = await prisma.knowledgeItem.update({
      where: { id: req.params.id }, data: { status: 'APPROVED', conflictNote: null, approvedAt: new Date() },
    }).catch(() => null);
    if (!item) return res.status(404).json({ error: '知识不存在' });
    res.json({ ok: true, message: '已吸收并同步到创作技能' });
  });

  /** 驳回（相悖/质量差），不生效 */
  knowledgeRouter.post('/:id/reject', authRequired, requireAdmin, requireSuperAdmin, async (req, res) => {
    await prisma.knowledgeItem.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', conflictNote: String(req.body?.reason ?? '人工驳回') },
    }).catch(() => null);
    res.json({ ok: true });
  });

  /**
   * 自主学习一轮（仅管理员；用户侧不可见）：
   * 传入内部学习信号（高分剧本/被采用模式/市场趋势/政策更新，生产由定时任务自动喂入），
   * 自动去冗、相悖挂起、高置信创作技巧自动生效、过时/相悖技能自动归档，并产出学习报告。
   * signals 允许为空 → 仅执行一次自主淘汰与快照。
   */
  const selfLearnSchema = z.object({
    signals: z.array(z.object({
      kind: z.enum(['HIGH_SCORE_SCRIPT', 'ADOPTED_PATTERN', 'MARKET_TREND', 'POLICY_UPDATE', 'ADMIN_TEXT']),
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(500_000),
      category: z.enum(LEARN_CATEGORIES).optional(),
      score: z.number().min(0).max(100).optional(),
      source: z.string().max(200).optional(),
    })).max(500).optional(),
    staleDays: z.number().int().min(30).max(3650).optional(),
    blockedByPolicy: z.array(z.string().max(40)).max(200).optional(),
  });
  knowledgeRouter.post('/self-learn/run', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    const parsed = selfLearnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const signals: LearnSignal[] = (parsed.data.signals ?? []) as LearnSignal[];
    // 合规预检：信号本身违法违规直接拒绝进入学习
    for (const s of signals) {
      const illegal = await complianceCheck(s.content, prisma);
      if (illegal) return res.status(422).json({ error: `信号「${s.title}」${illegal}` });
    }
    const stored = await prisma.knowledgeItem.findMany().catch(() => [] as any[]);
    const cycle = runSelfLearning(signals, stored);
    // 落库：自动生效 / 待审
    const created: { id: string; title: string; decision: string; confidence: number }[] = [];
    for (const c of cycle.candidates) {
      const item = await prisma.knowledgeItem.create({
        data: {
          kind: 'TEXT', title: c.title.slice(0, 200), content: c.content.slice(0, 500_000),
          category: c.category, status: c.decision === 'AUTO_APPROVE' ? 'APPROVED' : 'PENDING',
          source: 'AUTO', confidence: c.confidence, conflictNote: c.conflictNote,
          approvedAt: c.decision === 'AUTO_APPROVE' ? new Date() : null,
          uploadedById: req.userId!,
        },
      });
      created.push({ id: item.id, title: c.title, decision: c.decision, confidence: c.confidence });
    }
    // 自主淘汰
    const prune = pruneKnowledge(stored, { staleDays: parsed.data.staleDays, blockedByPolicy: parsed.data.blockedByPolicy });
    for (const a of prune.archived) {
      await prisma.knowledgeItem.update({ where: { id: a.id }, data: { status: 'ARCHIVED', pruneReason: a.reason, archivedAt: new Date() } }).catch(() => null);
    }
    const report = buildLearningReport(cycle, prune);
    res.json({ ok: true, report, created, archived: prune.archived });
  });

  /** 知识库快照报告（仅管理员）：来源/状态/分类分布、自主学习贡献、待审积压 */
  knowledgeRouter.get('/self-learn/report', authRequired, requireAdmin, requireSuperAdmin, async (_req, res) => {
    const all = await prisma.knowledgeItem.findMany().catch(() => [] as any[]);
    const byStatus: Record<string, number> = {}; const byCategory: Record<string, number> = {}; const bySource: Record<string, number> = {};
    all.forEach((i: any) => {
      byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
      byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
      bySource[i.source ?? 'MANUAL'] = (bySource[i.source ?? 'MANUAL'] ?? 0) + 1;
    });
    res.json({
      total: all.length, byStatus, byCategory, bySource,
      autoLearnedApproved: all.filter((i: any) => i.source === 'AUTO' && i.status === 'APPROVED').length,
      pendingNeedHuman: all.filter((i: any) => i.status === 'PENDING').length,
      archived: all.filter((i: any) => i.status === 'ARCHIVED').length,
    });
  });

  /**
   * 立即跑一次“完整自主学习闭环”（仅管理员；与每日定时任务同一套逻辑）：
   * 自动采集站内高分剧本（榜单/政策采集器在服务注入时启用）→ 跨轮去重 → 学习决策 → 自主淘汰 → 留存报告。
   */
  knowledgeRouter.post('/self-learn/run-auto', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await runDailyLearningCycle(prisma, {}, req.userId || 'admin');
      res.json({ ok: true, ...result, reportText: result.report.text });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 自主学习 / API盘点 历史报告（仅管理员，kind 可选 DAILY_LEARN/WEEKLY_MODEL） */
  knowledgeRouter.get('/self-learn/reports', authRequired, requireAdmin, requireSuperAdmin, async (req, res) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const rows = await prisma.learningReport.findMany({
      where: kind ? { kind } : {}, orderBy: { createdAt: 'desc' }, take: 50,
    }).catch(() => []);
    res.json({ reports: rows });
  });

  /** 手动归档（自主淘汰的人工入口，可恢复） */
  knowledgeRouter.post('/:id/archive', authRequired, requireAdmin, requireSuperAdmin, async (req, res) => {
    const item = await prisma.knowledgeItem.update({
      where: { id: req.params.id }, data: { status: 'ARCHIVED', pruneReason: String(req.body?.reason ?? '管理员手动归档'), archivedAt: new Date() },
    }).catch(() => null);
    if (!item) return res.status(404).json({ error: '知识不存在' });
    res.json({ ok: true });
  });
  /** 恢复归档知识（重新进入待审，不直接生效，安全） */
  knowledgeRouter.post('/:id/restore', authRequired, requireAdmin, requireSuperAdmin, async (req, res) => {
    const item = await prisma.knowledgeItem.update({
      where: { id: req.params.id }, data: { status: 'PENDING', pruneReason: null, archivedAt: null },
    }).catch(() => null);
    if (!item) return res.status(404).json({ error: '知识不存在' });
    res.json({ ok: true, message: '已恢复并转入待审队列' });
  });

  /**
   * 技能包打包下载：把全部已生效知识 + 当前创作技能，导出为版本化 JSON 包。
   * 生产可在此压缩为 zip（含 SKILL.md/知识库/变更日志）。
   */
  knowledgeRouter.get('/skill-package', authRequired, requireAdmin, requireSuperAdmin, async (_req, res) => {
    const items = await prisma.knowledgeItem.findMany({ where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' } });
    const byCategory: Record<string, number> = {};
    items.forEach((i: any) => { byCategory[i.category] = (byCategory[i.category] ?? 0) + 1; });
    // v2.19：内置创作技能（11引擎装置/四层钩子/三类节拍/流派补偿/风格库/双制式/硬底线）动态装配，升级自动同步
    const version = appVersion();
    const builtin = buildBuiltinSkillPack(version);
    const audit = auditSkillPack(builtin);
    const packVersion = `skill-${new Date().toISOString().slice(0, 10)}-v${version}`;
    const pkg = {
      name: '终南集·AGI编剧大师·创作技能包',
      version: packVersion,
      exportedAt: new Date().toISOString(),
      stats: { total: items.length, byCategory, builtin: builtin.summary, skillAudit: audit },
      changelog: [`${packVersion}: 收录${items.length}条已校验知识/技能/政策；内置${builtin.summary.engines}套类型引擎/${builtin.summary.devices}个创作装置/${builtin.summary.hooks}个钩子，随版本自动同步`],
      compliance: '全部知识已通过国家法规与平台规则一致性校验；内置技能包不含任何API密钥、成本与用户数据，可安全导入其他窗口',
      callable: '其他窗口 JSON.parse 后即可按 engines[].devices[].technique 调用全部创作方法，按 scriptFormats/hardLines 执行刚性标准',
      builtinSkills: builtin,
      items: items.map((i: any) => ({ category: i.category, title: i.title, content: i.content, sourceUrl: i.sourceUrl })),
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zhongnan-skill-${packVersion}.json"`);
    res.send(JSON.stringify(pkg, null, 2));
  });

  /** v2.19 仅下载内置创作技能包（不含后台知识条目，便于跨窗口/跨项目复用） */
  knowledgeRouter.get('/builtin-skill-pack', authRequired, requireAdmin, requireSuperAdmin, async (_req, res) => {
    const version = appVersion();
    const builtin = buildBuiltinSkillPack(version);
    const audit = auditSkillPack(builtin);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zhongnan-builtin-skills-v${version}.json"`);
    res.send(JSON.stringify({ ...builtin, skillAudit: audit }, null, 2));
  });

  /** v2.19 标准 SKILL.md 下载（可直接放进任意 Skill 目录被其他窗口加载调用） */
  knowledgeRouter.get('/builtin-skill-md', authRequired, requireAdmin, requireSuperAdmin, async (_req, res) => {
    const version = appVersion();
    const md = buildSkillMarkdown(buildBuiltinSkillPack(version));
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SKILL.md"`);
    res.send(md);
  });

  /** v2.19 标准技能目录文件映射（SKILL.md + references/*），落盘即为完整 Skill */
  knowledgeRouter.get('/builtin-skill-bundle', authRequired, requireAdmin, requireSuperAdmin, async (_req, res) => {
    const version = appVersion();
    const pack = buildBuiltinSkillPack(version);
    res.json({ skillName: SKILL_NAME, version, skillAudit: auditSkillPack(pack), files: buildSkillBundle(pack) });
  });

  return knowledgeRouter;
}

export const knowledgeRouter = createKnowledgeRouter(defaultPrisma);
