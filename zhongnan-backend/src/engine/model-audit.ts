/**
 * 每周 API 全面盘点与修正引擎（纯函数、可离线对拍）
 * ------------------------------------------------------------------
 * 满足“API 全面盘点每周一次并修正”：
 *  A. 内部体检（不依赖外部，每次必跑）——引用完整性、岗位覆盖、异构度、成本铁底、
 *     成本递增、高价模型不进每集、图片模型数量与 gpt_image、baseUrl 完备；
 *  B. 代际盘点（喂入最新情报 knownCurrent / 官方最新价 priceRefresh）——
 *     过时型号给升级建议；价格变动生成“价格刷新计划”，刷新后若击穿 ×2 铁底则该条被拦截、要求涨价而非降配。
 *  安全边界：换型号涉及 Key 可用性，只出【建议】由管理员一键应用；纯价格更新可自动应用但必须重过铁底。
 */
import {
  TEXT_MODELS, IMAGE_MODELS, buildTiers, ROLE_TOKENS_PER_EP, RolePick, ModelInfo, EngineCombo, TierId,
  priceForTier, canUseTier, LOCAL_ENGINE, strongestDomesticBackup,
} from '../config/model-catalog';
import { MemberLevel } from '../config/pricing';

export type IssueLevel = 'BLOCK' | 'WARN' | 'INFO';
export interface AuditIssue { level: IssueLevel; code: string; subject: string; message: string; suggestion?: string }
export interface UpgradeSuggestion {
  role: string; currentId: string; suggestId: string; reason: string;
  estCostDeltaFen: number; keepProfitFloor: boolean;
}
export interface PriceChange {
  id: string; from: { in: number; out: number }; to: { in: number; out: number };
  costFenBefore: number; costFenAfter: number; breaksFloor: boolean; floorNotes: string[];
}
export interface FloorCheck { level: MemberLevel; tier: TierId; chargedFen: number; costFen: number; ok: boolean }
export interface ModelAuditReport {
  generatedAt: string; healthy: boolean;
  issues: AuditIssue[]; upgrades: UpgradeSuggestion[]; priceRefreshPlan: PriceChange[];
  tierCosts: { tier: TierId; costFen: number }[]; floorChecks: FloorCheck[];
  summary: { block: number; warn: number; info: number; upgrade: number; priceChange: number };
  text: string;
}
/** 当代型号名册基线（截至 2026-08）；successorOf 用于未来代际升级对照，外部情报可增量覆盖 */
export interface KnownModel { id: string; family: string; status: 'current' | 'outdated' | 'deprecated'; successorId?: string; note?: string }
export const CURRENT_GENERATION: KnownModel[] = TEXT_MODELS.map((m) => ({ id: m.id, family: m.vendor, status: 'current' }));

export interface AuditInput {
  textModels?: ModelInfo[]; imageModels?: ModelInfo[]; tiers?: EngineCombo[];
  knownCurrent?: KnownModel[];
  priceRefresh?: Record<string, { inYuanPerMTok: number; outYuanPerMTok: number }>;
  levels?: MemberLevel[];
}
/** 用注入价格表重算单档每集裸成本（分），使价格刷新后能立即重算铁底 */
export function comboCostFen(picks: RolePick[], byId: Map<string, ModelInfo>): number {
  let cost = 0;
  for (const p of picks) {
    const m = byId.get(p.modelId); if (!m) continue;
    const tok = ROLE_TOKENS_PER_EP[p.role] || { in: 1000, out: 1000 };
    cost += (tok.in * m.inYuanPerMTok + tok.out * m.outYuanPerMTok) / 1_000_000 * 100; // 元→分
  }
  return Math.round(cost * 100) / 100;
}
const ROLES_EXPECTED = ['market_pre', 'architect', 'character', 'writer', 'audience', 'polish', 'consistency', 'deai', 'compliance', 'market_post'];
const CN_WRITER_HINT = /doubao|minimax|qwen|kimi|deepseek/i; // writer 中文成稿优先国产中文向模型

export function auditPortfolio(input: AuditInput = {}): ModelAuditReport {
  const textModels = input.textModels ?? TEXT_MODELS;
  const imageModels = input.imageModels ?? IMAGE_MODELS;
  const tiers = input.tiers ?? buildTiers();
  const known = input.knownCurrent ?? CURRENT_GENERATION;
  const priceRefresh = input.priceRefresh ?? {};
  const levels = input.levels ?? Object.values(MemberLevel);
  const byId = new Map(textModels.map((m) => [m.id, m]));
  const knownById = new Map(known.map((k) => [k.id, k]));
  const issues: AuditIssue[] = []; const upgrades: UpgradeSuggestion[] = [];

  // —— A1 引用完整性 + A2 岗位覆盖 + A3 异构/writer 取向 + A6 高价模型不进每集
  for (const t of tiers) {
    const roles = new Set(t.picks.map((p) => p.role));
    for (const role of ROLES_EXPECTED) {
      if (!roles.has(role) && !(role === 'consistency' || role === 'deai')) // 双校验门不单独计费模型
        issues.push({ level: 'WARN', code: 'ROLE_MISSING', subject: `${t.id}.${role}`, message: `档位 ${t.id} 缺岗位 ${role}` });
    }
    const vendors = new Set<string>();
    for (const p of t.picks) {
      // LOCAL 为本地规则引擎（零成本、合法，不在 TEXT_MODELS 内属设计）
      if (p.modelId === LOCAL_ENGINE) {
        if (p.backupIds.length === 0) issues.push({ level: 'BLOCK', code: 'NO_BACKUP', subject: `${t.id}.${p.role}`, message: `${p.role} 本地引擎没有国产API替补`, suggestion: '至少配一个国产同岗模型做替补' });
        for (const b of p.backupIds) {
          if (b === LOCAL_ENGINE) issues.push({ level: 'BLOCK', code: 'BACKUP_NOT_API', subject: `${t.id}.${p.role}`, message: `${p.role} 替补不能同为 LOCAL`, suggestion: '改为国产同岗模型' });
          else if (!byId.has(b)) issues.push({ level: 'BLOCK', code: 'DANGLING_BACKUP', subject: `${t.id}.${p.role}`, message: `备选型号 ${b} 不在目录中` });
          else if (byId.get(b)!.region !== 'domestic') issues.push({ level: 'BLOCK', code: 'BACKUP_OVERSEAS', subject: `${t.id}.${p.role}.${b}`, message: `${p.role} 替补必须国产`, suggestion: '换成国产同岗模型' });
        }
        continue;
      }
      const m = byId.get(p.modelId);
      if (!m) { issues.push({ level: 'BLOCK', code: 'DANGLING_REF', subject: `${t.id}.${p.role}`, message: `引用了目录中不存在的型号 ${p.modelId}`, suggestion: '在 TEXT_MODELS 补型号或改回有效型号' }); continue; }
      vendors.add(m.vendor);
      for (const b of p.backupIds) if (b !== LOCAL_ENGINE && !byId.has(b)) issues.push({ level: 'BLOCK', code: 'DANGLING_BACKUP', subject: `${t.id}.${p.role}`, message: `备选型号 ${b} 不在目录中` });
      // v2.51 国产替补铁规：每岗至少一个替补；替补必须真实存在且为中国国内 API
      if (p.backupIds.length === 0) issues.push({ level: 'BLOCK', code: 'NO_BACKUP', subject: `${t.id}.${p.role}`, message: `${p.role} 没有替补API，海外首选断供时无法兜底`, suggestion: '至少配一个国产同岗模型做替补' });
      for (const b of p.backupIds) {
        if (b === LOCAL_ENGINE) issues.push({ level: 'BLOCK', code: 'BACKUP_NOT_API', subject: `${t.id}.${p.role}`, message: `${p.role} 替补是 LOCAL 本地引擎，不是可调用的国产API`, suggestion: '改为国产同岗模型（豆包/通义/DeepSeek/Kimi/MiniMax）' });
        else { const bm = byId.get(b); if (bm && bm.region !== 'domestic') issues.push({ level: 'BLOCK', code: 'BACKUP_OVERSEAS', subject: `${t.id}.${p.role}.${b}`, message: `${p.role} 替补 ${bm.name} 是海外模型，违反“替补必须国产”铁规`, suggestion: '首选可用海外最强，替补必须换成国产同岗模型' }); }
      }
      // Opus 级（输出价≥150/百万）高价模型不得进每集主组合
      if (m.outYuanPerMTok >= 150) issues.push({ level: 'BLOCK', code: 'PRICY_IN_COMBO', subject: `${t.id}.${p.role}.${m.id}`, message: `${m.name} 单价过高，进每集组合会击穿毛利，只能用于按本精修增值` });
      if (p.role === 'writer' && !CN_WRITER_HINT.test(m.id) && t.id !== 'flagship')
        issues.push({ level: 'WARN', code: 'WRITER_FIT', subject: `${t.id}.writer`, message: `writer 主力 ${m.name} 非中文向首选，中文成稿“像人”程度可能弱于豆包/MiniMax`, suggestion: '中文成稿优先豆包Seed系列，海外模型用于润色/统筹' });
    }
    if (vendors.size < 2) issues.push({ level: 'WARN', code: 'LOW_DIVERSITY', subject: t.id, message: `档位 ${t.id} 主选仅单一厂商（${[...vendors].join(',')}），失去多模型异构互补意义`, suggestion: '至少引入两家异构模型，让最擅长的模型干对应环节' });
    // v2.52 第一替补必须是该岗国产最强（排除首选自身）
    for (const p of t.picks) {
      const best = strongestDomesticBackup(p.role, p.modelId);
      if (!best) issues.push({ level: 'WARN', code: 'NO_DOMESTIC_BACKUP', subject: `${t.id}.${p.role}`, message: `${p.role} 目录中没有任何国产替补候选`, suggestion: '登记国产同岗模型' });
      else if (!p.backupIds.includes(best.id)) issues.push({ level: 'WARN', code: 'BACKUP_NOT_STRONGEST', subject: `${t.id}.${p.role}`, message: `${p.role} 第一替补不是国产最强（应为 ${best.name}）`, suggestion: `把 ${best.id} 放到 backupIds 首位，故障时宁可上调强度不降配` });
    }
  }

  // —— A4 成本铁底（会员×可用档位，售价≥成本×2）
  const floorChecks: FloorCheck[] = [];
  for (const level of levels) for (const t of tiers) {
    if (!canUseTier(level, t.id)) continue;
    const p = priceForTier(level, t.id);
    const ok = p.chargedFen >= p.costFen * 2;
    floorChecks.push({ level, tier: t.id, chargedFen: p.chargedFen, costFen: p.costFen, ok });
    if (!ok) issues.push({ level: 'BLOCK', code: 'FLOOR_BREACH', subject: `${level}.${t.id}`, message: `售价${p.chargedFen}分 < 成本${p.costFen}分×2，违反不赔钱铁底`, suggestion: '上调该档售价/会员价，或换更省但同档强度的模型，绝不降配到更弱' });
  }
  // —— A5 成本严格递增
  const costMap = new Map(tiers.map((t) => [t.id, t.costFen]));
  if ((costMap.get('economy') ?? 0) >= (costMap.get('standard') ?? 0) || (costMap.get('standard') ?? 0) >= (costMap.get('flagship') ?? 0))
    issues.push({ level: 'WARN', code: 'COST_ORDER', subject: 'tiers', message: '三档裸成本未严格递增（经济<标准<旗舰），检查型号配置' });
  // —— A7 图片模型 ≥8 且含 gpt_image
  if (imageModels.length < 8) issues.push({ level: 'WARN', code: 'IMAGE_FEW', subject: 'image', message: `图片模型仅${imageModels.length}家，要求≥8家端口位` });
  if (!imageModels.some((m) => m.id === 'gpt_image')) issues.push({ level: 'BLOCK', code: 'NO_GPT_IMAGE', subject: 'image', message: '缺少必接的 ChatGPT gpt-image 位' });
  // —— A8 baseUrl 完备（MJ 代理允许空，其余文本模型必须有默认地址）
  for (const m of textModels) if (!/^https?:\/\//.test(m.defaultBaseUrl)) issues.push({ level: 'WARN', code: 'NO_BASEURL', subject: m.id, message: `${m.name} 缺默认 base URL` });

  // —— B1 代际盘点：目录型号在名册中的状态，过时/停产 → 升级建议
  for (const t of tiers) for (const p of t.picks) {
    const k = knownById.get(p.modelId);
    if (k && (k.status === 'outdated' || k.status === 'deprecated') && k.successorId && byId.has(k.successorId)) {
      const cur = byId.get(p.modelId)!; const suc = byId.get(k.successorId)!;
      const delta = Math.round(((perPickCost(suc) - perPickCost(cur)) * 100)) / 100;
      upgrades.push({ role: `${t.id}.${p.role}`, currentId: p.modelId, suggestId: k.successorId, reason: `${cur.name}已标记${k.status === 'deprecated' ? '停产' : '过时'}，建议升级到 ${suc.name}`, estCostDeltaFen: delta, keepProfitFloor: true });
    }
  }

  // —— B2 价格刷新计划：官方价变动 → 重算每档成本与铁底，击穿则拦截
  const priceRefreshPlan: PriceChange[] = [];
  const refreshedById = new Map(textModels.map((m) => [m.id, { ...m }]));
  for (const [id, np] of Object.entries(priceRefresh)) {
    const m = refreshedById.get(id); if (!m) { issues.push({ level: 'WARN', code: 'PRICE_UNKNOWN_MODEL', subject: id, message: '价格刷新目标型号不在目录' }); continue; }
    const before = { in: m.inYuanPerMTok, out: m.outYuanPerMTok };
    m.inYuanPerMTok = np.inYuanPerMTok; m.outYuanPerMTok = np.outYuanPerMTok;
    const floorNotes: string[] = [];
    for (const t of tiers) {
      if (!t.picks.some((p) => p.modelId === id || p.backupIds.includes(id))) continue;
      const cBefore = comboCostFen(t.picks, byId); const cAfter = comboCostFen(t.picks, refreshedById);
      for (const level of levels) {
        if (!canUseTier(level, t.id)) continue;
        const charged = priceForTier(level, t.id).chargedFen;
        if (charged < cAfter * 2) floorNotes.push(`${level}.${t.id} 刷新后成本${cAfter.toFixed(1)}分，售价${charged}分将击穿×2铁底，需涨价`);
      }
      priceRefreshPlan.push({ id, from: before, to: { in: np.inYuanPerMTok, out: np.outYuanPerMTok }, costFenBefore: cBefore, costFenAfter: comboCostFen(t.picks, refreshedById), breaksFloor: floorNotes.length > 0, floorNotes });
    }
  }

  const summary = {
    block: issues.filter((i) => i.level === 'BLOCK').length,
    warn: issues.filter((i) => i.level === 'WARN').length,
    info: issues.filter((i) => i.level === 'INFO').length,
    upgrade: upgrades.length, priceChange: priceRefreshPlan.length,
  };
  const tierCosts = tiers.map((t) => ({ tier: t.id, costFen: t.costFen }));
  const report: ModelAuditReport = {
    generatedAt: new Date().toISOString(), healthy: summary.block === 0,
    issues, upgrades, priceRefreshPlan, tierCosts, floorChecks, summary, text: '',
  };
  report.text = buildAuditText(report);
  return report;
}
function perPickCost(m: ModelInfo): number {
  const tok = { in: 1000, out: 1000 };
  return (tok.in * m.inYuanPerMTok + tok.out * m.outYuanPerMTok) / 1_000_000 * 100;
}

/** 应用价格刷新：只应用不击穿铁底的，击穿的拒绝；返回新目录与应用/拒绝清单（纯函数） */
export function applyPriceRefresh(textModels: ModelInfo[], plan: PriceChange[]): {
  models: ModelInfo[]; applied: string[]; rejected: { id: string; reason: string }[];
} {
  const reject = new Map(plan.filter((p) => p.breaksFloor).map((p) => [p.id, p.floorNotes.join('；')]));
  const nextPrice = new Map(plan.filter((p) => !p.breaksFloor).map((p) => [p.id, p.to]));
  const applied: string[] = [];
  const models = textModels.map((m) => {
    const np = nextPrice.get(m.id);
    if (np) { applied.push(m.id); return { ...m, inYuanPerMTok: np.in, outYuanPerMTok: np.out }; }
    return { ...m };
  });
  return { models, applied, rejected: [...reject.entries()].map(([id, reason]) => ({ id, reason })) };
}

export function buildAuditText(r: ModelAuditReport): string {
  const lines = [
    `【API 每周盘点报告 ${new Date().toLocaleString('zh-CN')}】`,
    `总体：${r.healthy ? '健康，无阻断项' : '存在阻断项，须先修复'} ｜ BLOCK ${r.summary.block} / WARN ${r.summary.warn} / 升级建议 ${r.summary.upgrade} / 价格变动 ${r.summary.priceChange}`,
    `三档裸成本(分/集)：${r.tierCosts.map((t) => `${t.tier}=${t.costFen}`).join('，')}`,
  ];
  r.issues.slice(0, 12).forEach((i) => lines.push(`· [${i.level}] ${i.subject}：${i.message}${i.suggestion ? `（建议：${i.suggestion}）` : ''}`));
  r.upgrades.forEach((u) => lines.push(`· 升级：${u.role} ${u.currentId}→${u.suggestId}（${u.reason}，成本变化约${u.estCostDeltaFen.toFixed(2)}分/集）`));
  r.priceRefreshPlan.forEach((p) => lines.push(`· 价格：${p.id} ${p.from.in}/${p.from.out}→${p.to.in}/${p.to.out}，${p.breaksFloor ? '击穿铁底已拦截：' + p.floorNotes.join('；') : '可安全刷新'}`));
  return lines.join('\n');
}
