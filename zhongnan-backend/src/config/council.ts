/**
 * v2.330 多方评议（Council）——会员等级/权限与各板块设定的共同商讨机制
 *
 * 背景：v2.329 的三维分级由单一成本视角拍定，缺少市场化与特色化的对抗性检验。
 * 本文件把「谁来评、评什么、各席位如何投票、主席如何裁定」固化为可复用的数据契约，
 * 让会员、定价、助理能力（以及后续任何需要分级的板块）共用同一套商讨协议。
 *
 * 设计约束：
 *  · 全部为纯数据 + 纯函数，零 IO、确定性，同一输入永远得到同一结论（可回归、可审计）；
 *  · 每个维度都是「建议档位 0..3」而非模糊打分，席位的分歧直接体现为票差；
 *  · 战略锚点（获客入口、成本铁底等）由主席显式裁定，分歧不会被悄悄抹平。
 *
 * 铁律：本文件只描述评议结论，不直接改权限；真正的权限仍以 modes.ts / pricing.ts /
 * assistant-capability.ts 为准。engine/council.ts 负责比对两者并如实报告偏差。
 */
import { MemberLevel } from './pricing';
import {
  CREATION_MODES, SPARK_TRACKS, SCRIPT_TYPES, OUTPUT_LANGUAGES,
  type LanguageCode, type ModeId, type ScriptTypeId, type SparkTrack,
} from './modes';
import { ASSISTANT_MATRIX, type AssistantAction } from './assistant-capability';

/* ------------------------------------------------------------------ *
 * 一、档位与维度
 * ------------------------------------------------------------------ */

/** 档位下标：0 免费 / 1 基础 / 2 高级 / 3 专业 */
export type TierIndex = 0 | 1 | 2 | 3;

export const TIER_LEVELS: MemberLevel[] = [
  MemberLevel.FREE, MemberLevel.BASIC, MemberLevel.ADVANCED, MemberLevel.PRO,
];
export const TIER_NAME_ZH = ['免费', '基础', '高级', '专业'] as const;
export const TIER_NAME_EN = ['Free', 'Basic', 'Advanced', 'Pro'] as const;

export function tierIndexOf(level: MemberLevel | string | null | undefined): TierIndex {
  const i = TIER_LEVELS.indexOf((level ?? MemberLevel.FREE) as MemberLevel);
  return (i < 0 ? 0 : i) as TierIndex;
}
export function levelOfTier(tier: TierIndex): MemberLevel {
  return TIER_LEVELS[tier] ?? MemberLevel.FREE;
}
export function tierNameZh(tier: TierIndex): string {
  return TIER_NAME_ZH[tier] ?? '免费';
}
export function tierNameEn(tier: TierIndex): string {
  return TIER_NAME_EN[tier] ?? 'Free';
}

/** 五个研判维度，取值均为「该维度建议的会员档位」（0..3） */
export type Dimension = 'market' | 'differentiation' | 'compute' | 'risk' | 'entry';

export interface DimensionDef {
  id: Dimension;
  name: string;
  nameEn: string;
  /** 席位要回答的问题 */
  question: string;
  questionEn: string;
}

export const DIMENSIONS: DimensionDef[] = [
  { id: 'market', name: '市场定价带', nameEn: 'Market price band', question: '同类产品在这一能力上收什么档位的钱？', questionEn: 'What tier do comparable products charge for this?' },
  { id: 'differentiation', name: '差异化溢价', nameEn: 'Differentiation premium', question: '这项能力是否稀缺、难被替代，能撑起更高档位？', questionEn: 'Is it scarce and hard to replace, enough to justify a higher tier?' },
  { id: 'compute', name: '算力成本带', nameEn: 'Compute cost band', question: '单次生成的算力成本落在哪个档位？', questionEn: 'Which tier does the per-run compute cost belong to?' },
  { id: 'risk', name: '合规与运营复杂度', nameEn: 'Compliance & ops complexity', question: '合规、版权、隐私或人工运营成本有多重？', questionEn: 'How heavy are compliance, copyright, privacy or manual ops?' },
  { id: 'entry', name: '入门门槛', nameEn: 'Entry threshold', question: '它更像获客钩子（低门槛）还是进阶能力（高门槛）？', questionEn: 'Is it an acquisition hook (low gate) or an advanced capability (high gate)?' },
];

export const DIMENSION_NAME_ZH: Record<Dimension, string> = {
  market: '市场定价带', differentiation: '差异化溢价', compute: '算力成本带',
  risk: '合规与运营复杂度', entry: '入门门槛',
};
export const DIMENSION_NAME_EN: Record<Dimension, string> = {
  market: 'Market price band', differentiation: 'Differentiation premium', compute: 'Compute cost band',
  risk: 'Compliance & ops complexity', entry: 'Entry threshold',
};

/* ------------------------------------------------------------------ *
 * 二、评议席位（8 方）
 * ------------------------------------------------------------------ */

export type SeatId =
  | 'market' | 'competitive' | 'craft' | 'cost'
  | 'legal' | 'growth' | 'user' | 'ops';

export interface CouncilSeat {
  id: SeatId;
  name: string;
  nameEn: string;
  /** 席位角色说明 */
  role: string;
  roleEn: string;
  /** 表决权重（8 席合计 1） */
  weight: number;
  /** 该席位对各维度的重视程度（每行合计 1） */
  stance: Record<Dimension, number>;
}

/**
 * 席位构造原则：既要覆盖商业闭环（市场/竞品/增长/成本/合规/运营），
 * 也要有真实的价值冲突源（创作者 vs 成本会计、老用户 vs 增长）。
 */
export const COUNCIL_SEATS: CouncilSeat[] = [
  {
    id: 'market', name: '市场分析师', nameEn: 'Market analyst',
    role: '看同类产品的定价带与付费意愿，防止把大众功能锁进高等级',
    roleEn: 'Benchmarks price bands and willingness to pay; stops gating mass features too high',
    weight: 0.16,
    stance: { market: 0.40, differentiation: 0.20, compute: 0.10, risk: 0.05, entry: 0.25 },
  },
  {
    id: 'competitive', name: '竞品情报官', nameEn: 'Competitive intelligence',
    role: '盯竞品的差异化与替代成本，避免为“看起来高级”买单',
    roleEn: 'Tracks differentiation and switching costs; avoids paying for mere novelty',
    weight: 0.12,
    stance: { market: 0.30, differentiation: 0.40, compute: 0.05, risk: 0.05, entry: 0.20 },
  },
  {
    id: 'craft', name: '首席编剧', nameEn: 'Head writer',
    role: '判断这项能力对成稿质量是否不可替代，拒绝把工艺价值廉价化',
    roleEn: 'Judges craft irreplaceability; refuses to cheapen craft value',
    weight: 0.14,
    stance: { market: 0.10, differentiation: 0.45, compute: 0.10, risk: 0.10, entry: 0.25 },
  },
  {
    id: 'cost', name: '成本会计', nameEn: 'Cost controller',
    role: '按单次算力与人力成本投票，守住毛利铁底',
    roleEn: 'Votes by per-run compute and labour cost; protects the margin floor',
    weight: 0.14,
    stance: { market: 0.10, differentiation: 0.10, compute: 0.60, risk: 0.05, entry: 0.15 },
  },
  {
    id: 'legal', name: '合规风控', nameEn: 'Risk & compliance',
    role: '按版权、隐私、分级与平台责任投票，宁高勿低',
    roleEn: 'Votes by copyright, privacy, age-gating and platform duty; errs high',
    weight: 0.12,
    stance: { market: 0.10, differentiation: 0.10, compute: 0.05, risk: 0.65, entry: 0.10 },
  },
  {
    id: 'growth', name: '增长与定价', nameEn: 'Growth & pricing',
    role: '看转化、升级路径与价格阶梯，反对既锁死又无升级动机',
    roleEn: 'Optimises conversion, upgrade paths and the price ladder',
    weight: 0.14,
    stance: { market: 0.30, differentiation: 0.15, compute: 0.20, risk: 0.05, entry: 0.30 },
  },
  {
    id: 'user', name: '用户代表', nameEn: 'User advocate',
    role: '代表新手与付费用户，优先保障“先能用起来”',
    roleEn: 'Speaks for newcomers and paying users; protects “get started first”',
    weight: 0.10,
    stance: { market: 0.15, differentiation: 0.10, compute: 0.05, risk: 0.05, entry: 0.65 },
  },
  {
    id: 'ops', name: '平台运营', nameEn: 'Platform ops',
    role: '看留存、履约与客服成本，兼顾长期经营',
    roleEn: 'Weighs retention, fulfilment and support load for the long run',
    weight: 0.08,
    stance: { market: 0.25, differentiation: 0.15, compute: 0.25, risk: 0.10, entry: 0.25 },
  },
];

/* ------------------------------------------------------------------ *
 * 三、评议目录：待裁决的能力项
 * ------------------------------------------------------------------ */

export type CouncilModuleId = 'membership' | 'pricing' | 'assistant';

export const COUNCIL_MODULES: { id: CouncilModuleId; name: string; nameEn: string }[] = [
  { id: 'membership', name: '会员等级与权限', nameEn: 'Membership tiers & permissions' },
  { id: 'pricing', name: '定价与交易', nameEn: 'Pricing & marketplace' },
  { id: 'assistant', name: 'AI 助理与高级能力', nameEn: 'Assistant & advanced capabilities' },
];

export type CouncilGroup = 'mode' | 'track' | 'scriptType' | 'language' | 'assistant' | 'pricing';

export interface CouncilItem {
  id: string;
  module: CouncilModuleId;
  group: CouncilGroup;
  name: string;
  nameEn: string;
  /** 现行档位（gate 项取自真实注册表；pricing 项 1 = 维持现行价格） */
  current: TierIndex;
  /** 各维度建议档位 */
  scores: Record<Dimension, TierIndex>;
  /** gate：权限闸门；posture：价格姿态（0 下调 / 1 维持 / 2 观察上调 / 3 显著上调） */
  kind: 'gate' | 'posture';
  /** 战略锚点：主席不得上调（获客入口等） */
  anchor?: boolean;
  note?: string;
  noteEn?: string;
}

/** 维度打分简写：market, differentiation, compute, risk, entry */
type ScoreTuple = [TierIndex, TierIndex, TierIndex, TierIndex, TierIndex];
const sc = (t: ScoreTuple): Record<Dimension, TierIndex> => ({
  market: t[0], differentiation: t[1], compute: t[2], risk: t[3], entry: t[4],
});

/* ---- 3.1 创作模式（8） ---- */
const MODE_SCORES: Record<ModeId, ScoreTuple> = {
  // 标签式：单稿直出、零门槛，是获客入口；市场不会为它单独付费
  tag: [1, 0, 0, 0, 0],
  // 采访式：把模糊创意聊清楚，单线对话成本，属于基础能力
  interview: [1, 1, 1, 0, 1],
  // 日记式：素材独特、隐私授权复杂，但仍是单稿；基础档 + 三档授权即可
  diary: [1, 2, 1, 1, 1],
  // 灵感式：多轮对话 + 三条子轨道，基础档是核心留存入口
  spark: [1, 2, 2, 1, 1],
  // 热点式：时效检索 + 合规风险，值得高级档
  hot: [2, 2, 2, 2, 2],
  // 角色自述：声线工艺 + 不可靠叙述，差异化强
  persona: [2, 3, 2, 1, 2],
  // 双人对撞：双角色 token ×2，工艺与成本双高
  duel: [2, 3, 3, 1, 2],
  // 世界线推演：多分支 token ×4，专业档的旗舰能力
  multiverse: [2, 3, 3, 3, 3],
};

/* ---- 3.2 灵感式轨道（3） ---- */
const TRACK_SCORES: Record<SparkTrack, ScoreTuple> = {
  material_rewrite: [2, 2, 1, 1, 1],
  signature_scene: [2, 3, 2, 1, 2],
  hit_reverse: [3, 3, 3, 2, 3],
};

/* ---- 3.3 剧本类型（9） ---- */
const SCRIPT_TYPE_SCORES: Record<ScriptTypeId, ScoreTuple> = {
  // 真人短剧：大众成品形态，必须留在免费入口
  live_action_drama: [1, 1, 1, 1, 0],
  aigc_drama: [1, 1, 1, 1, 1],
  short_video: [2, 1, 1, 1, 1],
  ad_script: [1, 2, 1, 1, 1],
  promo_script: [1, 2, 1, 1, 1],
  tv_series: [2, 2, 2, 1, 2],
  interactive_drama: [2, 3, 3, 1, 2],
  feature_film: [2, 3, 3, 2, 3],
  long_series: [2, 3, 3, 2, 3],
};

/* ---- 3.4 输出语言（10） ---- */
const LANGUAGE_SCORES: Record<LanguageCode, ScoreTuple> = {
  zh: [1, 1, 0, 0, 0],
  en: [1, 1, 0, 0, 0],
  // 日韩：短剧市场成熟、本地化要求高，基础档可覆盖
  ja: [2, 2, 1, 1, 1],
  ko: [2, 2, 1, 1, 1],
  // 西葡：拉美短剧增长快，基础档
  es: [2, 2, 1, 1, 1],
  pt: [2, 2, 1, 1, 1],
  // 泰/印尼/越：新兴市场，语料与本地化运营成本更高
  th: [2, 2, 2, 2, 1],
  id: [2, 2, 2, 2, 1],
  vi: [2, 2, 2, 2, 1],
  // 阿拉伯语：右到左排版 + 文化合规，风险最高
  ar: [2, 2, 3, 3, 1],
};

/* ---- 3.5 小南助理能力（13） ---- */
const ASSISTANT_LABELS: Record<AssistantAction, { zh: string; en: string }> = {
  guide: { zh: '操作引导 / FAQ', en: 'Guided onboarding / FAQ' },
  notice: { zh: '余额与进度通知', en: 'Balance & progress notice' },
  inspiration: { zh: '创作灵感建议', en: 'Inspiration suggestions' },
  dialogue_polish: { zh: '台词润色', en: 'Dialogue polish' },
  deep_advice: { zh: '深度创作建议', en: 'Deep writing advice' },
  character_plot_fix: { zh: '人设 / 剧情优化', en: 'Character & plot fixes' },
  personalized_reco: { zh: '个性化题材推荐', en: 'Personalised genre picks' },
  long_memory: { zh: '长期创作记忆', en: 'Long-term creative memory' },
  voice_control: { zh: '全功能语音操控', en: 'Full voice control' },
  dedicated_assistant: { zh: '专属创作助理', en: 'Dedicated assistant' },
  market_analysis: { zh: '深度市场分析', en: 'Deep market analysis' },
  habit_learning: { zh: '创作习惯学习', en: 'Habit learning' },
  listen_script: { zh: '听剧本（语音听稿）', en: 'Listen-to-script (TTS)' },
};

const ASSISTANT_SCORES: Record<AssistantAction, ScoreTuple> = {
  guide: [1, 1, 0, 0, 0],
  notice: [1, 1, 0, 0, 0],
  inspiration: [1, 2, 1, 0, 1],
  dialogue_polish: [1, 2, 1, 0, 1],
  deep_advice: [1, 3, 1, 0, 2],
  character_plot_fix: [1, 3, 1, 0, 2],
  personalized_reco: [1, 3, 1, 1, 2],
  long_memory: [1, 3, 1, 1, 2],
  voice_control: [2, 3, 2, 1, 3],
  dedicated_assistant: [2, 3, 2, 1, 3],
  market_analysis: [2, 3, 2, 2, 3],
  habit_learning: [2, 3, 2, 1, 3],
  // 听剧本：成本极低（TTS 13 分/本），但留存与可访问性价值高 → 基础档更合理
  listen_script: [2, 2, 1, 0, 1],
};

/* ---- 3.6 定价与交易（4，价格姿态） ---- */
const PRICING_ITEMS: CouncilItem[] = [
  {
    id: 'pricing:membership_fee', module: 'pricing', group: 'pricing', kind: 'posture',
    name: '会员月费阶梯（39 / 99 / 299）', nameEn: 'Membership ladder (39 / 99 / 299 CNY)',
    current: 1, scores: sc([1, 1, 1, 1, 2]),
    note: '对齐国内创作工具 30-100 元与海外 $19-29 的月费带', noteEn: 'In line with domestic 30-100 CNY and overseas $19-29 monthly bands',
  },
  {
    id: 'pricing:commission', module: 'pricing', group: 'pricing', kind: 'posture',
    name: '交易分佣（15% / 10% / 5%）', nameEn: 'Marketplace commission (15 / 10 / 5%)',
    current: 1, scores: sc([1, 1, 1, 1, 2]),
    note: '低于内容平台常见 20-30% 抽成，用低抽成换供给', noteEn: 'Below the usual 20-30% platform take; low commission buys supply',
  },
  {
    id: 'pricing:engine_price', module: 'pricing', group: 'pricing', kind: 'posture',
    name: '单集积分价（12 / 10 / 8 / 5）', nameEn: 'Per-episode credits (12 / 10 / 8 / 5)',
    current: 1, scores: sc([1, 1, 2, 0, 2]),
    note: '成本×2 铁底已由 assertNoLoss 锁死，不需要再抬价', noteEn: 'The cost×2 floor is already enforced by assertNoLoss',
  },
  {
    id: 'pricing:value_added_rate', module: 'pricing', group: 'pricing', kind: 'posture',
    name: '增值服务等级折扣（1 / 1 / 0.8 / 0.6）', nameEn: 'Value-added tier discount (1 / 1 / 0.8 / 0.6)',
    current: 1, scores: sc([1, 1, 1, 1, 2]),
    note: '折扣阶梯已形成升级动机，且不低于成本×2', noteEn: 'The discount ladder already creates upgrade intent without breaking cost×2',
  },
];

/* ------------------------------------------------------------------ *
 * 四、目录组装（现行档位一律读真实注册表，避免双源漂移）
 * ------------------------------------------------------------------ */

export const COUNCIL_ITEMS: CouncilItem[] = [
  ...CREATION_MODES.map((m): CouncilItem => ({
    id: `mode:${m.id}`, module: 'membership', group: 'mode', name: m.name, nameEn: m.nameEn,
    current: tierIndexOf(m.minLevel), scores: sc(MODE_SCORES[m.id]), kind: 'gate',
    anchor: m.id === 'tag',
    ...(m.id === 'tag' ? { note: '获客入口：免费即用，收费会直接掐断新用户第一次成功体验', noteEn: 'Acquisition anchor: charging here would cut off a newcomer’s first success' } : {}),
  })),
  ...SPARK_TRACKS.map((t): CouncilItem => ({
    id: `track:${t.id}`, module: 'membership', group: 'track', name: t.name, nameEn: t.nameEn,
    current: tierIndexOf(t.minLevel), scores: sc(TRACK_SCORES[t.id]), kind: 'gate',
  })),
  ...SCRIPT_TYPES.map((t): CouncilItem => ({
    id: `scriptType:${t.id}`, module: 'membership', group: 'scriptType', name: t.name, nameEn: t.nameEn,
    current: tierIndexOf(t.minLevel), scores: sc(SCRIPT_TYPE_SCORES[t.id]), kind: 'gate',
    anchor: t.id === 'live_action_drama',
    ...(t.id === 'live_action_drama' ? { note: '大众成品形态：免费档必须能从头到尾走完一遍', noteEn: 'Mass format: the free tier must be able to finish one full run' } : {}),
  })),
  ...OUTPUT_LANGUAGES.map((l): CouncilItem => ({
    id: `language:${l.code}`, module: 'membership', group: 'language', name: `${l.name}（${l.native}）`, nameEn: l.nameEn,
    current: tierIndexOf(l.minLevel), scores: sc(LANGUAGE_SCORES[l.code]), kind: 'gate',
    anchor: l.code === 'zh' || l.code === 'en',
    ...(l.code === 'zh' || l.code === 'en' ? { note: '主力语种：中英双语必须免费可用', noteEn: 'Primary languages: Chinese and English must stay free' } : {}),
  })),
  ...(Object.keys(ASSISTANT_MATRIX) as AssistantAction[]).map((a): CouncilItem => ({
    id: `assistant:${a}`, module: 'assistant', group: 'assistant',
    name: ASSISTANT_LABELS[a].zh, nameEn: ASSISTANT_LABELS[a].en,
    current: tierIndexOf(ASSISTANT_MATRIX[a]), scores: sc(ASSISTANT_SCORES[a]), kind: 'gate',
  })),
  ...PRICING_ITEMS,
];

export const COUNCIL_ITEM_MAP: Record<string, CouncilItem> = Object.fromEntries(
  COUNCIL_ITEMS.map((item) => [item.id, item]),
);

/**
 * 主席裁定（显式、可审计）：对“评议建议 ≠ 现行档位”的项给出保留理由。
 * 未列出的项，若建议与现行不一致则如实报告为 raise / lower，不做隐式调和。
 */
export const CHAIR_OVERRIDES: Record<string, { zh: string; en: string; executed?: boolean }> = {
  'mode:spark': {
    zh: '成本席主张抬到高级，但按集积分已单独计费，基础档是核心留存入口，维持基础。',
    en: 'The cost seat pushes for Advanced, but per-episode credits already recover cost; Spark stays Basic as the core retention entry.',
  },
  'scriptType:ad_script': {
    zh: '商用溢价交给品牌简报与商用授权，不抬成品类型门槛，避免小客户无法起步。',
    en: 'Commercial premium is sold via brand briefs and licensing, not by raising the format gate.',
  },
  'scriptType:promo_script': {
    zh: '与广告脚本同理：B 端愿付溢价走增值服务，类型门槛维持基础。',
    en: 'Same as ad scripts: B2B premium is sold as a value-added service; the format gate stays Basic.',
  },
  'pricing:engine_price': {
    zh: '成本×2 铁底已由启动自检锁死，评议的抬价倾向不执行，维持现行积分价。',
    en: 'The cost×2 floor is enforced at boot; the council’s upward pressure is not executed.',
  },
  'assistant:listen_script': {
    zh: '听稿是留存型基础需求、TTS 成本仅 13 分/本，评级由高级下调为基础（v2.330 已执行）。',
    en: 'Listening is a retention-led basic need and TTS costs only 13 fen per script; downgraded from Advanced to Basic in v2.330.',
    executed: true,
  },
  'assistant:habit_learning': {
    zh: '习惯学习依赖的是长期数据而非额外算力，高级档用量已能形成有效画像；下调至高级（v2.330 已执行），专业档保留三项独占能力。',
    en: 'Habit learning depends on longitudinal data, not extra compute; Advanced usage already yields a usable profile. Downgraded to Advanced in v2.330 (executed).',
    executed: true,
  },
  'assistant:voice_control': {
    zh: '评议被「入门门槛」维度拉低，但全功能语音操控是专业档的体验锚点，下调会让升级失去可感知理由，维持专业。',
    en: 'The entry dimension pulls it down, yet full voice control is the Pro tier’s experience anchor; lowering it removes a felt reason to upgrade. Stays Pro.',
  },
  'assistant:dedicated_assistant': {
    zh: '专属创作助理是专业档的服务承诺与身份核心（不是可拆卖的功能），维持专业。',
    en: 'The dedicated assistant is Pro’s service promise and identity core, not a separable feature. Stays Pro.',
  },
  'assistant:market_analysis': {
    zh: '深度市场分析是重算力 + B 端价值，市场定价带支持专业档；评议的入门门槛维度不适用于 B 端能力，维持专业。',
    en: 'Deep market analysis is compute-heavy with B2B value; the entry-threshold dimension does not apply to B2B capabilities. Stays Pro.',
  },
};
