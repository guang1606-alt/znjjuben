/**
 * teardown.ts —— 拆爆款工作台路由
 * 流程：粘贴文本/链接 → 拆解(为什么爆+技法+标签池) → 勾选标签+选方向 → 改编大纲 → 确认进入改编创作(建项目)
 * 计费：拆解、改编大纲均为 token 类增值，按会员等级差异化积分（vaPointsForLevel），服务失败自动退款，不赔钱。
 * 诚实降级：短剧/视频链接受平台反爬限制，后端无法保证直接读出正文；只给链接不给文本时明确要求粘贴，绝不臆造内容。
 */
import { asyncRouter } from '../lib/async-router';
import { createHash } from 'crypto';
import { isDeepStrictEqual } from 'util';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { prisma as defaultPrisma } from '../lib/prisma';
import { consumeFlexible, refundFlexible } from '../lib/billing';
import { staffOf, staffChargeTx, staffRefundTx } from '../lib/staff-billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import {
  VALUE_ADDED, vaPointsForLevel, MemberLevel, activeProjectLimit,
} from '../config/pricing';
import { EngineTier } from '../config/pricing';
import { teardown, buildAdaptOutline, adaptDirections, TeardownSource } from '../engine/hit-teardown';

type PrismaLike = typeof defaultPrisma;

export function createTeardownRouter(prisma: PrismaLike | any) {
  const router = asyncRouter();

  /** 等级/封禁一律以数据库为准（JWT 内 level 可能滞后于到期/降级/封禁）；banned 时直接拒绝 */
  async function levelOf(userId: string): Promise<MemberLevel> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { level: true, banned: true } });
    if (u?.banned) {
      const e = new Error('BANNED') as Error & { code: string };
      e.code = 'BANNED'; throw e;
    }
    return (u?.level as MemberLevel) ?? MemberLevel.FREE;
  }
  /**
   * 确定性幂等扣费（杜绝 Date.now() 当幂等键）：
   * refId = 业务动作 + 实体/参数哈希 + 5分钟时间窗。窗内重复提交抛 IDEMPOTENT_REPLAY（调用方返 409）；
   * 窗内上次扣费已退款（下游失败）时以 aN 递增尝试号放行；窗外重新计费。
   */
  const IDEM_WINDOW_MS = 5 * 60 * 1000;
  const idemWindow = () => `w${Math.floor(Date.now() / IDEM_WINDOW_MS)}`;
  const contentHash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 20);
  /** 客户端幂等令牌（Idempotency-Key 头或 body.clientToken）：同令牌重试不重复扣费，换新令牌允许再次拆解 */
  const nonceOf = (req: AuthRequest): string => {
    const h = (req.get?.('idempotency-key') as string | undefined) || (req.headers?.['idempotency-key'] as string | undefined);
    const b = (req.body as any)?.clientToken != null ? String((req.body as any).clientToken) : '';
    const v = (typeof h === 'string' ? h.trim() : '') || b.trim();
    return v ? `t${contentHash(v.slice(0, 200))}` : '';
  };
  type TeardownKey = 'TEARDOWN_ANALYZE' | 'TEARDOWN_OUTLINE';
  async function charge(userId: string, level: MemberLevel, key: TeardownKey, refId: string, staff: boolean): Promise<{ points: number; idem: string }> {
    return await withBillingTransaction(prisma, userId, async (tx) => {
      if (staff) {
        // 内部账户 0 元通道：不碰余额/毛利，只写 STAFF_FREE 审计流水；幂等撞车与付费路径同构抛 409
        const r = await staffChargeTx(tx, userId, refId, 'staff-td');
        if (!r.charged) {
          const e = new Error('IDEMPOTENT_REPLAY') as Error & { code: string };
          e.code = 'IDEMPOTENT_REPLAY'; throw e;
        }
        return { points: 0, idem: r.idem };
      }
      const points = vaPointsForLevel(key, level);
      const cost = VALUE_ADDED[key].costFen;
      const raw = tx.raw as any;
      const charges = await raw.ledgerEntry.findMany({ where: { userId, reason: key, refType: 'value_added', refId } });
      const refunds = await raw.ledgerEntry.findMany({ where: { userId, reason: `${key}:REFUND`, refType: 'value_added', refId } });
      if (charges.length > refunds.length) {
        const e = new Error('IDEMPOTENT_REPLAY') as Error & { code: string };
        e.code = 'IDEMPOTENT_REPLAY'; throw e;
      }
      const idem = `td:${refId}:a${charges.length + 1}`;
      await consumeFlexible(tx, userId, points, cost, key, refId, idem);
      return { points, idem };
    });
  }
  async function refund(userId: string, points: number, key: TeardownKey, refId: string, idem: string, staff: boolean) {
    if (staff) {
      // 0 元配对退款（amount=0 也要留痕，使同 refId 可再次提交），先于 `if (!points) return`
      await withBillingTransaction(prisma, userId, (tx) => staffRefundTx(tx, userId, refId, idem));
      return;
    }
    if (!points) return;
    // 传与 charge 相同的 refId/idem，refund: 前缀由 billing 内部统一管理（原扣款不存在则拒绝退款）
    await withBillingTransaction(prisma, userId, (tx) =>
      refundFlexible(tx, userId, points, key, refId, idem));
  }

  // 1) 拆解
  router.post('/analyze', authRequired, async (req: AuthRequest, res) => {
    const schema = z.object({
      text: z.string().max(200000).optional(),
      sourceType: z.enum(['text', 'drama_url', 'video_url']).default('text'),
      sourceUrl: z.string().max(500).optional(),
      title: z.string().max(120).optional(),
      lang: z.enum(['zh', 'en']).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '参数不合法' });
    const text = (p.data.text || '').trim();
    if (text.replace(/\s/g, '').length < 80) {
      // 链接无法直接读取正文时，明确引导用户粘贴，绝不编造
      return res.status(422).json({
        error: 'NEED_TEXT',
        message: p.data.sourceType !== 'text'
          ? '短剧/视频链接受平台保护，后端无法保证直接读出正文。请把剧本正文或视频字幕/口播文案粘贴进来再拆解（可先在原平台复制文案）。'
          : '请粘贴至少 80 字的剧本正文再拆解。',
      });
    }
    const userId = req.userId!;
    let level: MemberLevel;
    try { level = await levelOf(userId); } catch (e: any) { if (e?.code === 'BANNED') return res.status(403).json({ error: '账号已封禁' }); throw e; }
    const staff = await staffOf(prisma, userId);
    const refId = `analyze:${userId}:${idemWindow()}:${nonceOf(req) || contentHash(`${p.data.sourceType}|${p.data.sourceUrl ?? ''}|${text}`)}`;
    let idem = '';
    let charged = false; let points = 0;
    try {
      const r0 = await charge(userId, level, 'TEARDOWN_ANALYZE', refId, staff);
      idem = r0.idem; points = r0.points; charged = true;
      const report = teardown(text, { type: p.data.sourceType as TeardownSource, url: p.data.sourceUrl }, p.data.lang === 'en' ? 'en' : 'zh');
      const rec = await prisma.teardownRecord.create({
        data: {
          userId, sourceType: p.data.sourceType, sourceUrl: p.data.sourceUrl ?? null,
          title: p.data.title ?? null, wordCount: report.wordCount,
          report: report as object, pickedTags: [], state: 'ANALYZED', pointsCost: points,
        },
      });
      res.json({ recordId: rec.id, points, staff, report, directions: adaptDirections(report) });
    } catch (e: any) {
      if (e?.code === 'IDEMPOTENT_REPLAY') return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同内容刚已提交，请勿重复拆解' });
      if (charged) await refund(userId, points, 'TEARDOWN_ANALYZE', refId, idem, staff).catch(() => {});
      if (e?.code === 'INSUFFICIENT') return res.status(400).json({ error: '积分不足，请先充值' });
      throw e;
    }
  });

  // 2) 勾选标签 + 选方向 → 改编大纲
  router.post('/:id/outline', authRequired, async (req: AuthRequest, res) => {
    const schema = z.object({
      pickedTags: z.array(z.string().max(40)).max(24).default([]),
      direction: z.enum(['swap_persona', 'swap_world', 'flip_view']),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '请选择改编方向' });
    const userId = req.userId!;
    const rec = await prisma.teardownRecord.findUnique({ where: { id: req.params.id } });
    if (!rec) return res.status(404).json({ error: '拆解记录不存在' });
    if (rec.userId !== userId) return res.status(403).json({ error: '无权操作他人记录' });
    let level: MemberLevel;
    try { level = await levelOf(userId); } catch (e: any) { if (e?.code === 'BANNED') return res.status(403).json({ error: '账号已封禁' }); throw e; }
    const staff = await staffOf(prisma, userId);
    const refId = `outline:${rec.id}:${idemWindow()}:${nonceOf(req) || contentHash(`${p.data.direction}|${p.data.pickedTags.join(',')}`)}`;
    let idem = '';
    let charged = false; let points = 0;
    try {
      const r0 = await charge(userId, level, 'TEARDOWN_OUTLINE', refId, staff);
      idem = r0.idem; points = r0.points; charged = true;
      const outline = buildAdaptOutline(rec.report as any, p.data.pickedTags, p.data.direction, (rec.report as any).lang === 'en' ? 'en' : 'zh');
      await prisma.teardownRecord.update({
        where: { id: rec.id },
        data: { pickedTags: p.data.pickedTags, direction: p.data.direction, outline: outline as object, state: 'OUTLINED', pointsCost: { increment: points } },
      });
      res.json({ outline, points, staff });
    } catch (e: any) {
      if (e?.code === 'IDEMPOTENT_REPLAY') return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同选择刚已提交，请勿重复生成' });
      if (charged) await refund(userId, points, 'TEARDOWN_OUTLINE', refId, idem, staff).catch(() => {});
      if (e?.code === 'INSUFFICIENT') return res.status(400).json({ error: '积分不足，请先充值' });
      throw e;
    }
  });

  // 3) 确认改编大纲 → 直接创建改编项目（进入创作环节）
  router.post('/:id/to-project', authRequired, async (req: AuthRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(120).optional(), totalEps: z.number().int().min(1).max(500).default(20),
      engineTier: z.nativeEnum(EngineTier).default(EngineTier.STANDARD),
      format: z.enum(['LIVE_ACTION', 'AIGC']).default('LIVE_ACTION'),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '项目名不合法' });
    const userId = req.userId!;
    const rec = await prisma.teardownRecord.findUnique({ where: { id: req.params.id } });
    if (!rec) return res.status(404).json({ error: '拆解记录不存在' });
    if (rec.userId !== userId) return res.status(403).json({ error: '无权操作他人记录' });
    if (!rec.outline) return res.status(400).json({ error: '请先生成改编大纲' });
    let level: MemberLevel;
    try { level = await levelOf(userId); } catch (e: any) { if (e?.code === 'BANNED') return res.status(403).json({ error: '账号已封禁' }); throw e; }
    const title = p.data.title || `拆爆款改编·${(rec.title || '未命名').slice(0, 24)}`;
    const outline = rec.outline as any;
    const brief = [
      `改编梗概：${outline.logline || ''}`, `改编方向：${outline.direction || ''}`,
      `人物：\n${(outline.characters || []).map((c: any) => `${c.name}｜${c.role}｜目标：${c.want}｜秘密：${c.secret}`).join('\n')}`,
      `故事主线：${outline.mainline || ''}`,
      `分段大纲：\n${(outline.arc || []).map((a: any) => `${a.stage}：${a.goal}`).join('\n')}`,
      `开场钩子：${outline.openingHook || ''}`, `结局兑现：${outline.endingPayoff || ''}`,
      `原创要求：${outline.isolationNote || ''}`,
    ].join('\n\n').slice(0, 8000);
    const project = await withBillingTransaction(prisma, userId, async (tx) => {
      await tx.lockAccount(userId);
      const raw = tx.raw as any;
      const candidates = await raw.project.findMany({ where: { userId, bible: { path: ['adaptationDraft', 'recordId'], equals: rec.id } } });
      const related = candidates.filter((x: any) => x.bible?.adaptationDraft?.recordId === rec.id);
      // v2.296：已删=不存在——已删项目不构成「已承接」（否则 matching 命中已删项目直接返回，
      // 记录标 TO_PROJECT 指向已删项目、新项目不创建；排除后照常走原地更新/新建承接）
      const matching = related.find((x: any) => x.status !== 'deleted' && isDeepStrictEqual(x.bible.adaptationDraft.outline, rec.outline));
      if (matching) {
        await raw.teardownRecord.update({ where: { id: rec.id }, data: { state: 'TO_PROJECT' } });
        return matching;
      }
      // 改过大纲的未开写草稿可原地更新；已开写项目保留原稿，另建项目承接新大纲。
      for (const candidate of related) {
        if (candidate.status !== 'draft' || await raw.script.count({ where: { projectId: candidate.id } })) continue;
        const updated = await raw.project.update({ where: { id: candidate.id }, data: {
          title, totalEps: p.data.totalEps, engineTier: p.data.engineTier, format: p.data.format,
          tags: Array.from(new Set([...(rec.pickedTags || []), '拆爆款改编'])).slice(0, 30),
          bible: { ...candidate.bible, adaptationDraft: { recordId: rec.id, brief, outline: rec.outline } },
        } });
        await raw.teardownRecord.update({ where: { id: rec.id }, data: { state: 'TO_PROJECT' } });
        return updated;
      }
      const mine = await raw.project.findMany({ where: { userId }, select: { status: true } });
      const activeCount = mine.filter((x: any) => x.status !== 'archived').length;
      const limit = activeProjectLimit(level);
      if (activeCount >= limit) return { limited: true, activeCount, limit };
      const created = await raw.project.create({
        data: {
          userId, title, mode: 'adapt', totalEps: p.data.totalEps, engineTier: p.data.engineTier,
          tags: Array.from(new Set([...(rec.pickedTags || []), '拆爆款改编'])).slice(0, 30),
          format: p.data.format, status: 'draft',
          bible: { adaptationDraft: { recordId: rec.id, brief, outline: rec.outline } },
        },
      });
      await raw.teardownRecord.update({ where: { id: rec.id }, data: { state: 'TO_PROJECT' } });
      return created;
    });
    if (project.limited) return res.status(403).json({ error: 'REACH_PROJECT_LIMIT', activeCount: project.activeCount, limit: project.limit, message: `当前会员最多同时进行 ${project.limit} 个剧本项目，请先归档旧项目或升级会员` });
    res.json({ project, outline: rec.outline });
  });

  // 我的拆解记录（c195：列表只返摘要——report/outline 是大 Json，50 条全量回包可达 MB 级；
  // 完整产物走 GET /:id 详情。state 已表达大纲是否存在：ANALYZED=无大纲，OUTLINED/TO_PROJECT=有）
  router.get('/mine', authRequired, async (req: AuthRequest, res) => {
    const list = await prisma.teardownRecord.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, sourceType: true, sourceUrl: true, title: true, wordCount: true,
        pickedTags: true, direction: true, state: true, pointsCost: true, createdAt: true,
      },
    });
    res.json({ list });
  });

  // 拆解详情：恢复历史记录继续改编（owner 隔离；directions 与 /analyze 同源重算，保证新旧记录一致）
  router.get('/:id', authRequired, async (req: AuthRequest, res) => {
    const rec = await prisma.teardownRecord.findUnique({ where: { id: req.params.id } });
    if (!rec) return res.status(404).json({ error: '拆解记录不存在' });
    if (rec.userId !== req.userId!) return res.status(403).json({ error: '无权访问他人记录' });
    res.json({
      id: rec.id, sourceType: rec.sourceType, sourceUrl: rec.sourceUrl, title: rec.title,
      wordCount: rec.wordCount, report: rec.report, pickedTags: rec.pickedTags, direction: rec.direction,
      outline: rec.outline, state: rec.state, pointsCost: rec.pointsCost, createdAt: rec.createdAt,
      directions: rec.report ? adaptDirections(rec.report as any) : [],
    });
  });

  return router;
}

import { prisma as defaultPrismaInstance } from '../lib/prisma';
export const teardownRouter = createTeardownRouter(defaultPrismaInstance);
