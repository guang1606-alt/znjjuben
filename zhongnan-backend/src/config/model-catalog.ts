/**
 * 模型选型目录 + 三档创作引擎组合 + 裸 token 成本估算（纯函数可离线对拍）
 *
 * v1.32 对齐重构（消除双源/相悖）：
 *  · 引擎档位与 pricing.EngineTier 严格一致：经济 / 标准 / 旗舰（删除冗余的第四档“增强”，其强模型下沉到标准档）；
 *  · 【定价单一源】档位单价不再在本文件硬编码，一律查 pricing.EP_PRICE[会员][档]，本文件只负责“用哪些模型、裸成本多少”；
 *  · 档位能否用查 pricing.MEMBERSHIP[等级].engines，不再自造一套解锁表；
 *  · 最强组合 ≠ 每岗都堆最贵模型：2026-08 多源横评交叉结论——DeepSeek(V4)逻辑/因果闭环但文笔情绪偏干，
 *    豆包 Seed-2.0「写文章最像人、几乎无AI味」、MiniMax 角色对白强、Claude(Sonnet5)叙事去AI腔第一梯队、
 *    Gemini3/Kimi K3 超长上下文与多语。故：架构/挑漏用 DeepSeek，中文成稿(writer)/人设/润色以豆包为主、MiniMax/Claude 补强；
 *  · Claude Opus 5 极贵，不进“每集”组合（会击穿成本×2铁底），只用于“按本精修”增值服务(VALUE_ADDED.AI_POLISH)。
 *
 * 单价为 2026-08 公开价保守参考量级（元/百万 token，就高不就低），以后台真实账单校准；型号可在后台一键替换。
 * 合规/市场评分默认走本地引擎(LOCAL，零模型成本)，把钱花在架构/人设/撰写/润色上。
 */
import { MemberLevel, EngineTier, EP_PRICE, MEMBERSHIP, FEN_PER_POINT } from './pricing';

export type Modality = 'text' | 'image' | 'video';
export type TierId = 'economy' | 'standard' | 'flagship' | 'overseas';
export const LOCAL_ENGINE = 'LOCAL';
const TIER_TO_ENGINE: Record<TierId, EngineTier> = {
  economy: EngineTier.ECONOMY, standard: EngineTier.STANDARD,
  flagship: EngineTier.FLAGSHIP, overseas: EngineTier.OVERSEAS,
};

export interface ModelInfo {
  id: string; vendor: string; name: string; modality: Modality;
  goodAt: string[];
  inYuanPerMTok: number; outYuanPerMTok: number;
  contextK: number; region: 'domestic' | 'overseas';
  grade: 'eco' | 'std' | 'flag';
  defaultBaseUrl: string; note: string;
}

export const TEXT_MODELS: ModelInfo[] = [
  { id: 'deepseek_v4flash', vendor: 'DeepSeek', name: 'DeepSeek-V4-Flash', modality: 'text', goodAt: ['architect', 'audience', 'market_post'], inYuanPerMTok: 1, outYuanPerMTok: 2, contextK: 1024, region: 'domestic', grade: 'eco', defaultBaseUrl: 'https://api.deepseek.com/v1', note: '2026代单价地板，逻辑快，经济档架构/挑漏' },
  { id: 'deepseek_v4pro', vendor: 'DeepSeek', name: 'DeepSeek-V4-Pro', modality: 'text', goodAt: ['architect', 'audience', 'market_post'], inYuanPerMTok: 3, outYuanPerMTok: 6, contextK: 1024, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://api.deepseek.com/v1', note: '强推理、因果闭环；文笔情绪偏干，不做writer主力，专攻结构/挑逻辑漏洞' },
  { id: 'doubao_seedflash', vendor: '字节豆包', name: 'Doubao-Seed-2.0-Flash', modality: 'text', goodAt: ['writer', 'character', 'polish'], inYuanPerMTok: 0.8, outYuanPerMTok: 2, contextK: 256, region: 'domestic', grade: 'eco', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', note: '中文对白自然、去AI味、极便宜，经济档成稿主力' },
  { id: 'doubao_seed2pro', vendor: '字节豆包', name: 'Doubao-Seed-2.0-Pro', modality: 'text', goodAt: ['writer', 'character', 'polish'], inYuanPerMTok: 3.2, outYuanPerMTok: 16, contextK: 256, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', note: '2026多源横评“写文章最像人、几乎无AI味”，中文成稿/润色主力' },
  { id: 'qwen38max', vendor: '阿里通义', name: 'Qwen3.8-Max', modality: 'text', goodAt: ['architect', 'character', 'compliance', 'market_pre'], inYuanPerMTok: 6, outYuanPerMTok: 24, contextK: 256, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', note: '2026最均衡无短板，标准档人设/合规/兜底' },
  { id: 'kimi_k3', vendor: '月之暗面', name: 'Kimi-K3', modality: 'text', goodAt: ['polish', 'audience', 'market_pre', 'character', 'compliance'], inYuanPerMTok: 4, outYuanPerMTok: 12, contextK: 1024, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://api.moonshot.cn/v1', note: '超长上下文、高性价比（达顶级分输出价低约70%），资料消化/润色/合规替补' },
  { id: 'minimax_m25', vendor: 'MiniMax', name: 'MiniMax-M2.5', modality: 'text', goodAt: ['character', 'writer', 'polish'], inYuanPerMTok: 2.1, outYuanPerMTok: 8.4, contextK: 256, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://api.minimax.chat/v1', note: '创意写作/角色扮演强，人物对白与差异化声口' },
  { id: 'gpt_5flag', vendor: 'OpenAI', name: 'GPT-5.x 旗舰', modality: 'text', goodAt: ['architect', 'polish', 'character'], inYuanPerMTok: 25, outYuanPerMTok: 100, contextK: 256, region: 'overseas', grade: 'flag', defaultBaseUrl: 'https://api.openai.com/v1', note: '综合最强梯队，旗舰架构/复杂统筹' },
  { id: 'claude_sonnet5', vendor: 'Anthropic', name: 'Claude Sonnet 5', modality: 'text', goodAt: ['polish', 'character', 'writer'], inYuanPerMTok: 22, outYuanPerMTok: 110, contextK: 200, region: 'overseas', grade: 'flag', defaultBaseUrl: 'https://api.anthropic.com/v1', note: '叙事/人物/去AI腔第一梯队，旗舰人设润色' },
  { id: 'claude_opus5', vendor: 'Anthropic', name: 'Claude Opus 5', modality: 'text', goodAt: ['polish', 'architect'], inYuanPerMTok: 36, outYuanPerMTok: 180, contextK: 200, region: 'overseas', grade: 'flag', defaultBaseUrl: 'https://api.anthropic.com/v1', note: '2026智能指数第一，但每集成本过高，仅用于按本精修增值，不进每集组合' },
  { id: 'gemini_3pro', vendor: 'Google', name: 'Gemini 3.x Pro', modality: 'text', goodAt: ['market_pre', 'character', 'compliance'], inYuanPerMTok: 14, outYuanPerMTok: 86, contextK: 1024, region: 'overseas', grade: 'flag', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', note: '百万级超长上下文、多语，旗舰市场前置/海外资料消化' },
];

export const IMAGE_MODELS: ModelInfo[] = [
  { id: 'gpt_image', vendor: 'OpenAI', name: 'GPT-image-1(image2位)', modality: 'image', goodAt: ['poster'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'overseas', grade: 'flag', defaultBaseUrl: 'https://api.openai.com/v1', note: '文字排版与语义准确，旗舰海报（用户指定必接）' },
  { id: 'seedream', vendor: '字节即梦', name: 'Seedream 4.x', modality: 'image', goodAt: ['poster', 'storyboard'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', note: '中文国风海报强、性价比高' },
  { id: 'wanx', vendor: '阿里通义万相', name: '通义万相 wanx', modality: 'image', goodAt: ['poster'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'domestic', grade: 'eco', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', note: '便宜稳定走量' },
  { id: 'kling_image', vendor: '快手可灵', name: '可灵 KLING 图像', modality: 'image', goodAt: ['poster', 'storyboard'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'domestic', grade: 'std', defaultBaseUrl: 'https://api.klingai.com', note: '写实人像/电影感' },
  { id: 'flux', vendor: 'Black Forest', name: 'Flux 1.1 Pro', modality: 'image', goodAt: ['poster'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'overseas', grade: 'std', defaultBaseUrl: 'https://api.bfl.ml/v1', note: '质感细节强' },
  { id: 'sd3', vendor: 'Stability', name: 'Stable Diffusion 3.x', modality: 'image', goodAt: ['storyboard'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'overseas', grade: 'eco', defaultBaseUrl: 'https://api.stability.ai/v2beta', note: '开源生态、可控' },
  { id: 'recraft', vendor: 'Recraft', name: 'Recraft V3', modality: 'image', goodAt: ['poster'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'overseas', grade: 'std', defaultBaseUrl: 'https://external.api.recraft.ai/v1', note: '海报文字排版突出' },
  { id: 'midjourney_proxy', vendor: 'Midjourney(代理)', name: 'MJ(第三方兼容代理)', modality: 'image', goodAt: ['poster'], inYuanPerMTok: 0, outYuanPerMTok: 0, contextK: 0, region: 'overseas', grade: 'flag', defaultBaseUrl: '', note: '无官方API，需可信中转' },
];

export function findModel(id: string): ModelInfo | undefined {
  if (id === LOCAL_ENGINE) return undefined;
  return [...TEXT_MODELS, ...IMAGE_MODELS].find((m) => m.id === id);
}
function gradeRank(g: ModelInfo['grade']) { return g === 'flag' ? 3 : g === 'std' ? 2 : 1; }
export function candidatesForRole(role: string): { primary?: ModelInfo; backups: ModelInfo[] } {
  const sorted = [...TEXT_MODELS.filter((m) => m.goodAt.includes(role))].sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade));
  return { primary: sorted[0], backups: sorted.slice(1) };
}

/** 每岗每集 token 吞吐估算（in/out） */
export const ROLE_TOKENS_PER_EP: Record<string, { in: number; out: number }> = {
  market_pre: { in: 1000, out: 800 }, architect: { in: 1500, out: 1500 }, character: { in: 1000, out: 1000 },
  writer: { in: 2000, out: 3000 }, audience: { in: 2500, out: 500 }, polish: { in: 3000, out: 2500 },
  compliance: { in: 1500, out: 300 }, market_post: { in: 1500, out: 500 },
};

export interface RolePick { role: string; modelId: string; backupIds: string[] }
// 经济档：DeepSeek-V4-Flash 管逻辑 + 豆包Seed-Flash 管中文成稿（去AI味），本地合规/市场（裸成本约 0.026 元/集）
// v2.52 第一替补统一为该岗「国产最强」（故障时宁可上调强度不降配），原经济型号留作第二替补
const ECONOMY: RolePick[] = [
  { role: 'market_pre', modelId: LOCAL_ENGINE, backupIds: ['qwen38max', 'doubao_seedflash'] },
  { role: 'architect', modelId: 'deepseek_v4flash', backupIds: ['deepseek_v4pro', 'doubao_seedflash'] },
  { role: 'character', modelId: 'doubao_seedflash', backupIds: ['minimax_m25', 'deepseek_v4flash'] },
  { role: 'writer', modelId: 'doubao_seedflash', backupIds: ['doubao_seed2pro', 'deepseek_v4flash'] },
  { role: 'audience', modelId: 'deepseek_v4flash', backupIds: ['deepseek_v4pro', 'doubao_seedflash'] },
  { role: 'polish', modelId: 'doubao_seedflash', backupIds: ['doubao_seed2pro', 'deepseek_v4flash'] },
  { role: 'compliance', modelId: LOCAL_ENGINE, backupIds: ['qwen38max'] },
  { role: 'market_post', modelId: LOCAL_ENGINE, backupIds: ['deepseek_v4pro', 'deepseek_v4flash'] },
];
// 标准档：V4-Pro 搭架构挑漏 + 豆包Seed2.0-Pro成稿（最像人）+ MiniMax立人物（裸成本约 0.14 元/集）
const STANDARD: RolePick[] = [
  { role: 'market_pre', modelId: LOCAL_ENGINE, backupIds: ['qwen38max'] },
  { role: 'architect', modelId: 'deepseek_v4pro', backupIds: ['qwen38max'] },
  { role: 'character', modelId: 'minimax_m25', backupIds: ['doubao_seed2pro'] },
  { role: 'writer', modelId: 'doubao_seed2pro', backupIds: ['minimax_m25'] },
  { role: 'audience', modelId: 'deepseek_v4pro', backupIds: ['kimi_k3'] },
  { role: 'polish', modelId: 'doubao_seed2pro', backupIds: ['kimi_k3'] },
  { role: 'compliance', modelId: LOCAL_ENGINE, backupIds: ['qwen38max'] },
  // v2.52 市场终评首选升级 V4-Pro（六维评分/价值评估要最强推理，单集仅增约0.005元，铁底不破）
  { role: 'market_post', modelId: 'deepseek_v4pro', backupIds: ['deepseek_v4flash', 'qwen38max'] },
];
// 旗舰档：全国产顶配（v2.54 改造：原 GPT-5/Claude/Gemini 海外组合迁移到 OVERSEAS 海外档）
// v2.54 设计理由：用户当前不接海外 API；旗舰档用 DeepSeek V4-Pro 架构 + 豆包 Seed 2.0 Pro 成稿 +
// MiniMax M2.5 人设 + Kimi K3 长上下文观众挑漏 + Qwen 3.8 Max 多语市场前置；异构最强且全直连
const FLAGSHIP: RolePick[] = [
  // 市场前置升级 Qwen 3.8 Max：长上下文 + 多语市场资料消化（替代原 Gemini 3 Pro）
  // 第一替补 kimi_k3：goodAt 含 market_pre 且为国产最强替补（deepseek_v4pro 不擅长 market_pre）
  { role: 'market_pre', modelId: 'qwen38max', backupIds: ['kimi_k3'] },
  { role: 'architect', modelId: 'deepseek_v4pro', backupIds: ['qwen38max', 'deepseek_v4flash'] },
  { role: 'character', modelId: 'minimax_m25', backupIds: ['doubao_seed2pro'] },
  { role: 'writer', modelId: 'doubao_seed2pro', backupIds: ['minimax_m25'] },
  // 观众挑漏升级 Kimi K3：20万级长上下文，比 V4-Pro 挑得更细（旗舰档差异化点）
  { role: 'audience', modelId: 'kimi_k3', backupIds: ['deepseek_v4pro'] },
  { role: 'polish', modelId: 'doubao_seed2pro', backupIds: ['minimax_m25', 'kimi_k3'] },
  { role: 'compliance', modelId: 'qwen38max', backupIds: ['kimi_k3'] },
  { role: 'market_post', modelId: 'deepseek_v4pro', backupIds: ['deepseek_v4flash', 'kimi_k3'] },
];
// 海外 API 创作引擎（v2.54 预留档：用户搞定海外 API 时启用，EP_PRICE 未列 → C 端不可购买）
// 设计原则：GPT-5 架构 + Claude Sonnet5 人设/润色 + Gemini 3 Pro 多语市场前置（异构最强）；
// 但 writer 仍用豆包 Seed 2.0 Pro（中文成稿「最像人」，Claude 中文文笔不如豆包）；
// audience/market_post/compliance 仍国产控成本（避免每集成本爆炸击穿铁底）
const OVERSEAS: RolePick[] = [
  { role: 'market_pre', modelId: 'gemini_3pro', backupIds: ['qwen38max'] },
  { role: 'architect', modelId: 'gpt_5flag', backupIds: ['deepseek_v4pro'] },
  { role: 'character', modelId: 'claude_sonnet5', backupIds: ['minimax_m25'] },
  { role: 'writer', modelId: 'doubao_seed2pro', backupIds: ['minimax_m25'] },
  { role: 'audience', modelId: 'deepseek_v4pro', backupIds: ['kimi_k3'] },
  { role: 'polish', modelId: 'claude_sonnet5', backupIds: ['doubao_seed2pro'] },
  { role: 'compliance', modelId: 'qwen38max', backupIds: ['kimi_k3'] },
  { role: 'market_post', modelId: 'deepseek_v4pro', backupIds: ['deepseek_v4flash', 'kimi_k3'] },
];

export interface EngineCombo { id: TierId; name: string; picks: RolePick[]; costFen: number; desc: string }
export function estimateComboCostFen(picks: RolePick[]): number {
  let yuan = 0;
  for (const p of picks) {
    const m = findModel(p.modelId); if (!m) continue;
    const t = ROLE_TOKENS_PER_EP[p.role] || { in: 1000, out: 1000 };
    yuan += (t.in / 1e6) * m.inYuanPerMTok + (t.out / 1e6) * m.outYuanPerMTok;
  }
  return Math.ceil(yuan * 100);
}
export function buildTiers(): EngineCombo[] {
  return [
    { id: 'economy', name: '经济引擎', picks: ECONOMY, costFen: estimateComboCostFen(ECONOMY), desc: '国产高性价比多岗协同+本地合规市场，锚点1元/集档' },
    { id: 'standard', name: '标准引擎', picks: STANDARD, costFen: estimateComboCostFen(STANDARD), desc: '推理模型搭架构+中文旗舰立人设，均衡强组合' },
    { id: 'flagship', name: '旗舰引擎(全国产顶配)', picks: FLAGSHIP, costFen: estimateComboCostFen(FLAGSHIP), desc: 'DeepSeek V4-Pro架构+豆包Seed2.0成稿+MiniMax立人物+Kimi K3长上下文观众挑漏，全国产异构最强' },
    // v2.54 海外档：预留不开放购买，等用户搞定海外 API 时在 EP_PRICE 加列 + MemberLevel.engines 加项即可启用
    { id: 'overseas', name: '海外API创作引擎(预留)', picks: OVERSEAS, costFen: estimateComboCostFen(OVERSEAS), desc: 'GPT-5架构+Claude Sonnet5人设/润色+Gemini3市场前置异构最强；中文成稿/挑漏/合规仍用国产控成本；暂不开放购买' },
  ];
}

/** 档位能否使用：唯一以 pricing.MEMBERSHIP[等级].engines 为准 */
export function canUseTier(level: MemberLevel, id: TierId): boolean {
  return (MEMBERSHIP[level] as { engines: readonly EngineTier[] }).engines.includes(TIER_TO_ENGINE[id]);
}
/** 等级越高默认越强；高级默认标准（旗舰按需手动选，控成本），专业默认旗舰 */
export function defaultTierForLevel(level: MemberLevel): TierId {
  if (level === MemberLevel.PRO) return 'flagship';
  if (level === MemberLevel.BASIC || level === MemberLevel.ADVANCED) return 'standard';
  return 'economy';
}

export interface TierPrice {
  tier: TierId; chargedFen: number; costFen: number; grossFen: number; margin: number; ok: boolean;
}
/** 某会员用某档的单集经济性：实付价唯一查 pricing.EP_PRICE，成本用裸 token 估算，铁底=实付≥成本×2 */
export function priceForTier(level: MemberLevel, id: TierId): TierPrice {
  const combo = buildTiers().find((x) => x.id === id)!;
  const pts = EP_PRICE[level][TIER_TO_ENGINE[id]] ?? 0;
  const chargedFen = pts * FEN_PER_POINT;
  const costFen = combo.costFen;
  return {
    tier: id, chargedFen, costFen, grossFen: chargedFen - costFen,
    margin: chargedFen > 0 ? (chargedFen - costFen) / chargedFen : -1,
    ok: chargedFen >= costFen * 2,
  };
}

export interface Combo { level: MemberLevel; tier: TierId; picks: RolePick[]; estCostFenPerEp: number; rationale: string }
export function recommendCombo(level: MemberLevel, tierSel: TierId = defaultTierForLevel(level)): Combo {
  const t = buildTiers().find((x) => x.id === tierSel)!;
  return { level, tier: tierSel, picks: t.picks.map((p) => ({ ...p })), estCostFenPerEp: t.costFen, rationale: t.desc };
}
export function comboProfitability(estCostFen: number, priceFen: number) {
  return { ok: priceFen >= estCostFen * 2, estCostFen, priceFen, grossFen: priceFen - estCostFen, margin: priceFen > 0 ? (priceFen - estCostFen) / priceFen : -1 };
}

/**
 * 后台“最强组合自动优化建议”机制：输出每岗首选/备选与替换触发条件。
 * 当市面出现新模型时，管理员只需在 TEXT_MODELS 登记并按 goodAt/grade 排序，
 * 或在此调整首选；系统据此给出“是否替换、为什么、成本变化多少”的可审计建议。
 */
export function portfolioAdvice(): { role: string; primary: string; backups: string[]; rule: string }[] {
  const roles = ['market_pre', 'architect', 'character', 'writer', 'audience', 'polish', 'compliance', 'market_post'];
  return roles.map((role) => {
    const c = domesticCandidatesForRole(role);
    return {
      role,
      primary: c.primary ? `${c.primary.vendor}·${c.primary.name}` : 'LOCAL本地引擎',
      backups: c.backups.slice(0, 3).map((m) => `${m.vendor}·${m.name}`),
      rule: '同岗出现 grade 更高且单集成本不致击穿售价×2铁底的新模型时，自动升为首选、现首选转备选；每次变更跑 priceForTier 全量回归；替补池只放国产可直连模型',
    };
  });
}

/**
 * v2.51 国产替补硬约束 + 组合自我体检
 * ------------------------------------------------------------------
 * 用户铁规：每个岗位都必须有替补，且替补必须是中国国内 API（region==='domestic'），
 * 海外模型只能做首选、不能做唯一兜底；LOCAL 本地引擎可做首选（零成本），但不能当“替补API”。
 */
const COMBO_ROLES = ['market_pre', 'architect', 'character', 'writer', 'audience', 'polish', 'compliance', 'market_post'];

/**
 * v2.52 岗位「国产最强替补」策展排序（可审计、可随横评更新）
 * 同 grade 不按价格取巧：按岗位能力契合度排序——
 * 架构/挑漏/终评看推理（DeepSeek-V4-Pro）、中文成稿/润色看去AI味（豆包Seed2.0-Pro）、
 * 人设看角色声口（MiniMax-M2.5）、合规/前置看均衡与政策尺度（Qwen3.8-Max）、长上下文消化用 Kimi-K3。
 * 数组即该岗国产模型由强到弱的次序；validateStrongestBackup 以此为唯一准绳。
 */
export const DOMESTIC_FIT_ORDER: Record<string, string[]> = {
  market_pre: ['qwen38max', 'kimi_k3', 'deepseek_v4pro', 'doubao_seed2pro', 'minimax_m25', 'deepseek_v4flash', 'doubao_seedflash'],
  architect: ['deepseek_v4pro', 'qwen38max', 'kimi_k3', 'deepseek_v4flash', 'doubao_seed2pro', 'minimax_m25', 'doubao_seedflash'],
  character: ['minimax_m25', 'doubao_seed2pro', 'qwen38max', 'kimi_k3', 'doubao_seedflash', 'deepseek_v4pro', 'deepseek_v4flash'],
  writer: ['doubao_seed2pro', 'minimax_m25', 'kimi_k3', 'qwen38max', 'doubao_seedflash', 'deepseek_v4pro', 'deepseek_v4flash'],
  audience: ['deepseek_v4pro', 'kimi_k3', 'qwen38max', 'deepseek_v4flash', 'doubao_seed2pro', 'doubao_seedflash'],
  polish: ['doubao_seed2pro', 'kimi_k3', 'minimax_m25', 'qwen38max', 'doubao_seedflash', 'deepseek_v4pro', 'deepseek_v4flash'],
  compliance: ['qwen38max', 'kimi_k3', 'deepseek_v4pro', 'deepseek_v4flash', 'doubao_seed2pro', 'doubao_seedflash'],
  market_post: ['deepseek_v4pro', 'deepseek_v4flash', 'qwen38max', 'kimi_k3', 'doubao_seed2pro', 'doubao_seedflash'],
};
/** 某岗国产最强替补：策展排序中第一个不等于当前首选、且确实存在的国产模型 */
export function strongestDomesticBackup(role: string, primaryId: string): ModelInfo | undefined {
  const order = DOMESTIC_FIT_ORDER[role] || [];
  const id = order.find((x) => x !== primaryId && findModel(x)?.region === 'domestic');
  return id ? findModel(id) : undefined;
}

/** 某岗的国产候选（按策展契合度排序），供替补选择与自动迭代 */
export function domesticCandidatesForRole(role: string): { primary?: ModelInfo; backups: ModelInfo[] } {
  const order = DOMESTIC_FIT_ORDER[role];
  const list = order
    ? order.map(findModel).filter((m): m is ModelInfo => !!m && m.region === 'domestic')
    : TEXT_MODELS.filter((m) => m.region === 'domestic' && m.goodAt.includes(role))
      .sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || a.outYuanPerMTok - b.outYuanPerMTok);
  return { primary: list[0], backups: list.slice(1) };
}

/** v2.52 最强替补校验：第一替补必须就是该岗国产最强（排除首选自身），否则给出应换型号 */
export function validateStrongestBackup(picks: RolePick[]): BackupIssue[] {
  const issues: BackupIssue[] = [];
  for (const role of COMBO_ROLES) {
    const pick = picks.find((p) => p.role === role);
    if (!pick) continue;
    const best = strongestDomesticBackup(role, pick.modelId);
    if (!best) { issues.push({ role, problem: '目录中找不到任何国产替补', suggest: [] }); continue; }
    if (!pick.backupIds.includes(best.id)) {
      issues.push({ role, problem: `第一替补不是国产最强（应为 ${best.id}·${best.name}）`, suggest: [best.id] });
    }
  }
  return issues;
}

export interface BackupIssue { role: string; problem: string; suggest: string[] }
/** 单档组合体检：替补缺失/不是真实API/含海外模型/模型id不存在，逐条给出国产替代建议 */
export function validateComboBackups(picks: RolePick[]): BackupIssue[] {
  const issues: BackupIssue[] = [];
  for (const role of COMBO_ROLES) {
    const pick = picks.find((p) => p.role === role);
    if (!pick) { issues.push({ role, problem: '缺少该岗位', suggest: [] }); continue; }
    if (!pick.backupIds.length) {
      issues.push({ role, problem: '没有替补API', suggest: domesticCandidatesForRole(role).backups.map((m) => m.id) });
      continue;
    }
    for (const bid of pick.backupIds) {
      if (bid === LOCAL_ENGINE) {
        issues.push({ role, problem: '替补不能是LOCAL本地引擎，必须是国产API', suggest: domesticCandidatesForRole(role).backups.map((m) => m.id) });
        continue;
      }
      const m = findModel(bid);
      if (!m) issues.push({ role, problem: `替补${bid}在模型目录不存在`, suggest: [] });
      else if (m.region !== 'domestic') {
        issues.push({ role, problem: `替补${bid}是海外模型，违反国产替补铁规`, suggest: domesticCandidatesForRole(role).backups.map((x) => x.id) });
      }
    }
  }
  return issues;
}

/** 三档全量体检：国产替补存在性 + 第一替补必须国产最强，返回问题清单（空数组=完全合规） */
export function validateAllTierBackups(): BackupIssue[] {
  return buildTiers().flatMap((t) => [
    ...validateComboBackups(t.picks),
    ...validateStrongestBackup(t.picks),
  ].map((i) => ({ ...i, problem: `[${t.id}] ${i.problem}` })));
}

export interface SelfCheckItem { role: string; primaryId: string; stronger?: string; note: string }
/**
 * 自我迭代发现：目录中同岗若出现比当前首选 grade 更高的国产模型，提示可升级；
 * 系统无法自动判断“新模型是否真的更强”（需联网横评/真实账单），此类只给建议、不自动切换，并在 note 明示需人工确认。
 */
export function portfolioSelfCheck(): { ok: boolean; issues: BackupIssue[]; upgradeHints: SelfCheckItem[]; manualNeeded: string[] } {
  const issues = validateAllTierBackups();
  const upgradeHints: SelfCheckItem[] = [];
  for (const tier of buildTiers()) {
    for (const pick of tier.picks) {
      const cur = findModel(pick.modelId);
      const bestDomestic = domesticCandidatesForRole(pick.role).primary;
      if (cur && bestDomestic && gradeRank(bestDomestic.grade) > gradeRank(cur.grade)) {
        upgradeHints.push({
          role: pick.role, primaryId: pick.modelId, stronger: bestDomestic.id,
          note: `${tier.id}档该岗当前首选 grade=${cur.grade}，目录中存在更高 grade 国产模型 ${bestDomestic.id}，建议联网横评确认后升级`,
        });
      }
    }
  }
  return {
    ok: issues.length === 0,
    issues,
    upgradeHints,
    manualNeeded: [
      '模型“当下最强”无法离线自证：新模型发布后需联网横评（创作质量/中文去AI味/稳定性）并以后台真实账单校准单价，确认后再在后台一键换型',
      '若某岗连一个国产候选都没有（backups 为空），系统无法自动补位，会在此明示，需人工登记新国产模型',
    ],
  };
}
