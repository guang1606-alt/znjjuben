/**
 * 管理员后台：模型密钥配置
 * 仅超级管理员可读写；返回一律脱敏，明文 key 绝不下发；C端无此接口。
 * 工厂化：createAdminModelRouter(prisma) 便于注入内存桩做 HTTP 测试；默认导出接全局 prisma。
 */
import { asyncRouter } from '../lib/async-router';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin } from '../middleware/admin';
import { prisma } from '../lib/prisma';
import { maskedConfig, saveConfig, ModelConfigData, maskedProvidersConfig, saveProvider, deleteProvider, saveRouting, loadProviders, loadRouting } from '../lib/model-config';
import {
  ALL_ROLE_IDS, ROLE_LABEL_ZH, routingCoverage, routedCostFenPerEp, RoleId, ProviderEntry,
} from '../lib/model-config-policy';
import {
  TEXT_MODELS, IMAGE_MODELS, buildTiers, priceForTier, portfolioAdvice,
  findModel, ROLE_TOKENS_PER_EP, portfolioSelfCheck,
} from '../config/model-catalog';
import { API_DIRECTORY, directoryCoverage, apiByLayer } from '../config/api-directory';
import { renderApiDirectoryDocx } from '../lib/api-directory-docx';
import { orderedStages, validateOrder } from '../agents/pipeline-order';
import { MemberLevel } from '../config/pricing';
import { z } from 'zod';
import { runWeeklyModelAudit } from '../services/auto-learning';
import { AuditInput } from '../engine/model-audit';

export function createAdminModelRouter(prisma: any) {
  const adminModelRouter = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅超级管理员可配置模型密钥');

  // 读取（脱敏：只回 hasKey / keyMask，不回明文）
  adminModelRouter.get('/', authRequired, requireAdmin, async (_req, res) => {
    try {
      res.json(await maskedConfig(prisma));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // 保存（加密落库；空串或含 • 的脱敏值视为未修改，保留原 key）
  adminModelRouter.put('/', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const body = req.body as Partial<ModelConfigData>;
      if (!body || typeof body !== 'object') return res.status(400).json({ error: '参数缺失' });
      const clean = {
        text: {
          economy: pick(body.text?.economy), standard: pick(body.text?.standard), flagship: pick(body.text?.flagship),
          overseas: pick(body.text?.overseas),  // v2.54 海外档：预留，未在 EP_PRICE 列→自然拒售
        },
        image: { standard: pick(body.image?.standard), flagship: pick(body.image?.flagship) },
      };
      await saveConfig(clean as unknown as ModelConfigData, req.userId || 'admin', prisma);
      res.json({ ok: true, masked: await maskedConfig(prisma) });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // 每周 API 全面盘点（也可被定时任务调用）：体检/铁底/异构/代际/价格，留存报告
  adminModelRouter.post('/portfolio/audit', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const input = (req.body ?? {}) as AuditInput;
      const { report, reportId } = await runWeeklyModelAudit(prisma, input, req.userId || 'admin');
      res.json({ ok: true, reportId, report });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // 最近一次每周盘点报告
  adminModelRouter.get('/portfolio/audit-report', authRequired, requireAdmin, async (_req, res) => {
    const rows = await prisma.learningReport.findMany({
      where: { kind: 'WEEKLY_MODEL' }, orderBy: { createdAt: 'desc' }, take: 1,
    }).catch(() => []);
    res.json({ latest: rows[0] ?? null });
  });

  /* ---------- v2.41 多供应商池 + 九岗路由 + 组合全景 ---------- */
  const providerSchema = z.object({
    id: z.string().max(60).optional().or(z.literal('')),
    name: z.string().min(1, '供应商名称必填').max(60),
    modality: z.enum(['text', 'image', 'video']),
    baseUrl: z.string().max(300).default(''),
    apiKey: z.string().max(400).default(''),
    model: z.string().max(120).default(''),
    inYuanPerMTok: z.number().min(0).max(100000).default(0),
    outYuanPerMTok: z.number().min(0).max(100000).default(0),
    catalogId: z.string().max(60).optional().or(z.literal('')),
    enabled: z.boolean().default(true),
  });

  // 供应商池（脱敏）+ 当前路由
  adminModelRouter.get('/providers', authRequired, requireAdmin, async (_req, res) => {
    res.json(await maskedProvidersConfig(prisma));
  });

  // 新增/更新单个供应商；目录型号可免填 baseUrl（自动补 catalog 默认端点）
  adminModelRouter.put('/providers', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    const parsed = providerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'PROVIDER_INVALID ' + parsed.error.issues.map((i) => i.message).join('；') });
    const d = parsed.data;
    const catalog = d.catalogId ? findModel(d.catalogId) : undefined;
    if (d.catalogId && !catalog) return res.status(400).json({ error: '未知目录型号 catalogId' });
    const entry: ProviderEntry = {
      id: d.id || '', name: d.name.trim(), modality: d.modality,
      baseUrl: d.baseUrl.trim(), apiKey: d.apiKey.trim(), model: d.model.trim(),
      inYuanPerMTok: d.inYuanPerMTok, outYuanPerMTok: d.outYuanPerMTok,
      catalogId: d.catalogId || undefined, enabled: d.enabled,
    };
    try {
      await saveProvider(entry, catalog?.defaultBaseUrl, req.userId || 'admin', prisma);
      res.json({ ok: true, masked: await maskedProvidersConfig(prisma) });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  adminModelRouter.delete('/providers/:id', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    await deleteProvider(String(req.params.id), req.userId || 'admin', prisma);
    res.json({ ok: true, masked: await maskedProvidersConfig(prisma) });
  });

  // 九岗路由（悬空 id 服务端自动丢弃）
  adminModelRouter.put('/routing', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const routing: Partial<Record<RoleId, string>> = {};
    for (const role of ALL_ROLE_IDS) if (typeof body[role] === 'string') routing[role] = body[role] as string;
    await saveRouting(routing, req.userId || 'admin', prisma);
    res.json({ ok: true, masked: await maskedProvidersConfig(prisma) });
  });

  /**
   * 组合全景（只读）：岗位顺序自检、每岗首选/备选、三档成本与×2铁底、图片模型端口、当前自定义路由体检、口径FAQ
   * 这是“是不是全球最优组合/baseUrl是否必填/单价谁填/赚不赚钱”的唯一权威视图
   */
  adminModelRouter.get('/portfolio', authRequired, requireAdmin, async (_req, res) => {
    const tiers = buildTiers().map((t) => ({ id: t.id, name: t.name, costFen: t.costFen, desc: t.desc, picks: t.picks }));
    const levels = [MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO];
    const floorChecks = levels.flatMap((lv) => (['economy', 'standard', 'flagship'] as const)
      .map((tid) => ({ level: lv, ...priceForTier(lv, tid) })));
    const [providers, routing] = await Promise.all([loadProviders(prisma), loadRouting(prisma)]);
    const coverage = routingCoverage(providers, routing);
    const roleTokens: any = {};
    for (const [k, v] of Object.entries(ROLE_TOKENS_PER_EP)) roleTokens[k === 'market_pre' || k === 'market_post' ? 'market' : k] = v;
    const routed = routedCostFenPerEp(providers, routing, roleTokens);
    res.json({
      order: orderedStages(), orderErrors: validateOrder(),
      advice: portfolioAdvice(), backupSelfCheck: portfolioSelfCheck(),
      roleLabels: ROLE_LABEL_ZH,
      tiers, floorChecks,
      textCatalog: TEXT_MODELS.map((m) => ({ id: m.id, vendor: m.vendor, name: m.name, grade: m.grade, inYuanPerMTok: m.inYuanPerMTok, outYuanPerMTok: m.outYuanPerMTok, defaultBaseUrl: m.defaultBaseUrl, goodAt: m.goodAt, note: m.note })),
      imageCatalog: IMAGE_MODELS.map((m) => ({ id: m.id, vendor: m.vendor, name: m.name, grade: m.grade, defaultBaseUrl: m.defaultBaseUrl, note: m.note })),
      routingCoverage: coverage, routedCostFenPerEp: routed.costFen, routedCostByRole: routed.byRole,
      faq: [
        { q: 'BaseUrl 必填吗？', a: '选目录内型号时非必填，系统自动补该厂商 OpenAI 兼容默认端点；自建/中转/代理必填 http(s) 端点。' },
        { q: '输入/输出单价要我填吗？', a: '选目录型号会自动带出 2026-08 公开价保守参考量级（就高不就低）；自定义/中转必须按你真实账单填写，用于×2铁底核算。' },
        { q: '默认逻辑赚钱吗？', a: 'floorChecks 逐档逐等级给出实付/裸成本/毛利率，ok=true 即实付≥成本×2；任何一档击穿会在每周盘点 BLOCK，要求涨价而非降配。' },
        { q: '岗位顺序为什么市场先行？', a: '市场分析两次出现：market_pre 立项前置（题材/受众/爽点/平台尺度先定对不对路），market_post 成稿后置（六维评分/投稿匹配），orderErrors 为空即顺序合法。' },
        { q: '用户能看到这些模型吗？', a: '不能。C端全程黑盒，只感知经济/标准/旗舰三档；供应商名、型号、密钥、BaseUrl 仅超管后台可见，回显一律脱敏。' },
        { q: '替补为什么必须国产？', a: 'v2.51 铁规：每岗至少一个替补且替补必须是中国国内可直连 API（豆包/通义/DeepSeek/Kimi/MiniMax）。首选可用海外最强模型，但海外断供/网络波动时由国产替补无缝兜底；LOCAL 本地引擎不算替补API。backupSelfCheck 每周盘点自动校验，违规直接 BLOCK。' },
        { q: '替补凭什么算“最强”？（v2.52）', a: '每岗维护一张国产模型契合度策展排序 DOMESTIC_FIT_ORDER（架构/挑漏看DeepSeek-V4-Pro、中文成稿润色看豆包Seed2.0-Pro、人设看MiniMax、合规看通义、长上下文看Kimi），第一替补必须是排序首位；出现更优国产模型时改排序即可，validateStrongestBackup 与每周盘点会自动抓“替补不是最强”，故障兜底时宁可上调强度也不降配。' },
      ],
    });
  });


  // v2.53 全量 API 清单（功能→API→官方申请链接），仅超管可见
  adminModelRouter.get('/api-directory', authRequired, requireAdmin, async (_req, res) => {
    const catalog = [...TEXT_MODELS, ...IMAGE_MODELS].map((m) => ({ id: m.id, modality: m.modality }));
    const coverage = directoryCoverage(catalog);
    // 岗位→三档首选/替补，附厂商申请入口
    const linkOf = (modelId: string) => {
      const e = API_DIRECTORY.find((x) => x.catalogId === modelId || (x.catalogIds || []).includes(modelId));
      const m = findModel(modelId);
      return modelId === 'LOCAL' ? { modelId, vendor: 'LOCAL本地引擎', consoleUrl: '', region: 'local' }
        : { modelId, vendor: m ? `${m.vendor}·${m.name}` : modelId, consoleUrl: e?.consoleUrl || '', region: m?.region || '' };
    };
    const tiers = buildTiers().map((t) => ({
      id: t.id, name: t.name,
      roles: t.picks.map((p) => ({ role: p.role, primary: linkOf(p.modelId), backups: p.backupIds.map(linkOf) })),
    }));
    res.json({ text: apiByLayer('llm_text'), image: apiByLayer('llm_image'), infra: apiByLayer('infra'), tiers, coverage });
  });


  // v2.54 API 清单设计版 docx 下载（封面/预留填写位/签署位，仅超管）
  adminModelRouter.get('/api-directory/docx', authRequired, requireAdmin, async (_req, res) => {
    try {
      const buf = await renderApiDirectoryDocx(pkgVersion());
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''zhongnanji-api-directory.docx");
      res.end(buf);
    } catch (e: any) {
      res.status(500).json({ error: `清单生成失败：${String(e?.message ?? e)}` });
    }
  });

  return adminModelRouter;
}

export const adminModelRouter = createAdminModelRouter(prisma);

function pick(c: unknown): { baseUrl?: string; apiKey?: string; model?: string } {
  const o = (c || {}) as Record<string, unknown>;
  return {
    baseUrl: typeof o.baseUrl === 'string' ? o.baseUrl.trim() : undefined,
    apiKey: typeof o.apiKey === 'string' ? o.apiKey.trim() : undefined,
    model: typeof o.model === 'string' ? o.model.trim() : undefined,
  };
}

export function pkgVersion(): string { try { return require('../../package.json').version || '0.0.0'; } catch { return '0.0.0'; } }
