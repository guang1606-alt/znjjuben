/**
 * v2.330 多方评议引擎（纯函数、零 IO、确定性）
 *
 * 一句话：把「会员等级/权限该定在哪一档」从单人拍板，改成 8 个立场不同的席位
 * 按各自权重与关注面投票，再由主席对战略锚点与已知例外做显式裁定，并把分歧如实留档。
 *
 * 与 config/council.ts 的分工：
 *  · config 只描述「谁评、评什么、各维度建议档位、主席保留理由」；
 *  · 本文件只做聚合与比对，绝不改写 modes.ts / pricing.ts / assistant-capability.ts；
 *  · 因此评议结论与线上真实档位不一致时，只能报 raise / lower / upheld，不能偷偷生效。
 *
 * 可复用性（举一反三）：任何需要分级的板块，只要提供 CouncilItem[]（五维建议档位 + 现行档位），
 * 就能套用同一套 conveneItem / reviewCouncil，得到同样的结论、共识度与异议记录。
 */
import {
  CHAIR_OVERRIDES, COUNCIL_ITEMS, COUNCIL_ITEM_MAP, COUNCIL_MODULES, COUNCIL_SEATS,
  DIMENSIONS,
  type CouncilGroup, type CouncilItem, type CouncilModuleId, type Dimension, type SeatId, type TierIndex,
} from '../config/council';

export const COUNCIL_VERSION = 'v2.330';

/** 共识度低于此阈值视为「分歧过大」，主席不得据其改档，只能进入观察 */
export const CONSENSUS_DEFER = 0.5;

/** 价格姿态语义（与 council.ts 中 kind:'posture' 的档位一致） */
export const POSTURE_NAME_ZH = ['下调', '维持', '观察上调', '显著上调'] as const;
export const POSTURE_NAME_EN = ['lower', 'hold', 'watch & raise', 'raise notably'] as const;

/**
 * 评议结论：
 *  aligned 建议与现行一致 / anchor 战略锚点维持 / upheld 主席保留现行 /
 *  raise 建议上调待执行 / lower 建议下调待执行 / observe 分歧过大暂不调整 /
 *  posture 价格姿态（不涉及权限闸门）
 */
export type CouncilStatus =
  | 'aligned' | 'anchor' | 'upheld' | 'raise' | 'lower' | 'observe' | 'posture';

export interface CouncilVote {
  seat: SeatId;
  /** 该席位按 stance 加权后的档位分（0..3，两位小数） */
  score: number;
  /** 该席位主张的档位 */
  suggest: TierIndex;
}

export interface CouncilResult {
  id: string;
  module: CouncilModuleId;
  group: CouncilGroup;
  name: string;
  nameEn: string;
  kind: 'gate' | 'posture';
  anchor: boolean;
  /** 线上现行档位（gate 项读真实注册表） */
  current: TierIndex;
  scores: Record<Dimension, TierIndex>;
  votes: CouncilVote[];
  /** 8 席加权总分（0..3） */
  weighted: number;
  /** 评议建议档位 */
  suggested: TierIndex;
  /** 共识度 0..1（1 = 全席同档，0 = 0 档与 3 档直接对立） */
  consensus: number;
  /** 与多数意见不一致的席位 */
  dissent: SeatId[];
  status: CouncilStatus;
  /** 主席最终采纳档位；与 current 不等即为待执行变更 */
  target: TierIndex;
  /** target - current */
  delta: number;
  summary: string;
  summaryEn: string;
  chairNote?: { zh: string; en: string };
  note?: string;
  noteEn?: string;
}

/* ------------------------------------------------------------------ *
 * 一、聚合
 * ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampTier(n: number): TierIndex {
  return Math.max(0, Math.min(3, Math.round(n))) as TierIndex;
}

/** 逐席投票：每席按自身 stance 对该项五个维度加权，得到 0..3 的档位主张 */
export function councilVotes(item: CouncilItem): CouncilVote[] {
  return COUNCIL_SEATS.map((seat) => {
    const score = DIMENSIONS.reduce(
      (sum, d) => sum + seat.stance[d.id] * item.scores[d.id], 0,
    );
    return { seat: seat.id, score: round2(score), suggest: clampTier(score) };
  });
}

/** 席位权重加权：权重合计为 1，因此结果天然落在 0..3 */
export function councilWeighted(votes: CouncilVote[]): number {
  const total = votes.reduce((sum, v, i) => sum + v.score * COUNCIL_SEATS[i].weight, 0);
  return round2(total);
}

/** 共识度：只看「主张档位」的极差，1 - (max-min)/3 */
export function councilConsensus(votes: CouncilVote[]): number {
  const tiers = votes.map((v) => v.suggest);
  return round2(1 - (Math.max(...tiers) - Math.min(...tiers)) / 3);
}

function pct(n: number): number {
  return Math.round(n * 100);
}

/* ------------------------------------------------------------------ *
 * 二、主席裁定 + 结论
 * ------------------------------------------------------------------ */

export function conveneItem(item: CouncilItem): CouncilResult {
  const votes = councilVotes(item);
  const weighted = councilWeighted(votes);
  const suggested = clampTier(weighted);
  const consensus = councilConsensus(votes);
  const dissent = votes.filter((v) => v.suggest !== suggested).map((v) => v.seat);
  const override = CHAIR_OVERRIDES[item.id];
  const anchor = item.anchor === true;

  let status: CouncilStatus;
  let target: TierIndex = item.current;

  if (item.kind === 'posture') {
    // 价格姿态不涉及权限闸门：建议值即目标值，由经营侧决定是否落地
    status = 'posture';
    target = suggested;
  } else if (anchor) {
    // 战略锚点：获客入口与主力语种由主席显式保留，不能被「成本优化」抬价
    status = 'anchor';
  } else if (suggested === item.current) {
    // 建议与现行一致：即使登记了主席理由，也属于「结论一致」，不能伪装成分歧
    status = 'aligned';
  } else if (override && !override.executed) {
    // 主席显式保留：理由必须写进 CHAIR_OVERRIDES，可审计
    status = 'upheld';
  } else if (consensus < CONSENSUS_DEFER) {
    // 分歧过大：不拿一个 0.3 共识的结论去改真实权限
    status = 'observe';
  } else {
    status = suggested > item.current ? 'raise' : 'lower';
    target = suggested;
  }

  const chairNote = override ? { zh: override.zh, en: override.en } : undefined;
  const { summary, summaryEn } = describeResult({
    item, status, suggested, target, consensus, chairNote,
  });

  return {
    id: item.id, module: item.module, group: item.group,
    name: item.name, nameEn: item.nameEn, kind: item.kind, anchor,
    current: item.current, scores: item.scores, votes, weighted, suggested, consensus,
    dissent, status, target, delta: target - item.current,
    summary, summaryEn,
    ...(chairNote ? { chairNote } : {}),
    ...(item.note ? { note: item.note } : {}),
    ...(item.noteEn ? { noteEn: item.noteEn } : {}),
  };
}

interface DescribeInput {
  item: CouncilItem;
  status: CouncilStatus;
  suggested: TierIndex;
  target: TierIndex;
  consensus: number;
  chairNote?: { zh: string; en: string };
}

function tierZh(t: TierIndex): string {
  return ['免费', '基础', '高级', '专业'][t];
}
function tierEn(t: TierIndex): string {
  return ['Free', 'Basic', 'Advanced', 'Pro'][t];
}

function describeResult(input: DescribeInput): { summary: string; summaryEn: string } {
  const { item, status, suggested, target, consensus, chairNote } = input;
  const curZh = tierZh(item.current);
  const sugZh = tierZh(suggested);
  const curEn = tierEn(item.current);
  const sugEn = tierEn(suggested);
  const cp = pct(consensus);
  const extraZh = chairNote ? ` ${chairNote.zh}` : '';
  const extraEn = chairNote ? ` ${chairNote.en}` : '';

  if (status === 'posture') {
    const postureZh = POSTURE_NAME_ZH[suggested];
    const postureEn = POSTURE_NAME_EN[suggested];
    return {
      summary: `价格姿态评议：建议「${postureZh}」，现行「维持」（共识 ${cp}%）。${item.note ?? ''}`.trim(),
      summaryEn: `Price posture: council suggests "${postureEn}" vs current "hold" (consensus ${cp}%). ${item.noteEn ?? ''}`.trim(),
    };
  }
  if (status === 'anchor') {
    return {
      summary: `评议建议「${sugZh}」，但属战略锚点：主席裁定维持在「${curZh}」，不参与上调（共识 ${cp}%）。${extraZh}`.trim(),
      summaryEn: `Council suggests ${sugEn}; strategic anchor holds at ${curEn} (consensus ${cp}%).${extraEn}`.trim(),
    };
  }
  if (status === 'upheld') {
    return {
      summary: `评议建议「${sugZh}」，主席裁定维持「${curZh}」（共识 ${cp}%）。${extraZh}`.trim(),
      summaryEn: `Council suggests ${sugEn}; the chair retains ${curEn} (consensus ${cp}%).${extraEn}`.trim(),
    };
  }
  if (status === 'observe') {
    return {
      summary: `评议分歧过大（共识 ${cp}%，建议「${sugZh}」vs 现行「${curZh}」）：暂不调整，进入观察。`,
      summaryEn: `Disagreement too wide (consensus ${cp}%, ${sugEn} vs ${curEn}): no change, under observation.`,
    };
  }
  if (status === 'raise') {
    return {
      summary: `评议建议「${sugZh}」，高于现行「${curZh}」：机制建议上调，待执行确认（共识 ${cp}%）。`,
      summaryEn: `Council suggests ${sugEn} above current ${curEn}: raise recommended, pending execution (consensus ${cp}%).`,
    };
  }
  if (status === 'lower') {
    return {
      summary: `评议建议「${sugZh}」，低于现行「${curZh}」：机制建议下调，待执行确认（共识 ${cp}%）。`,
      summaryEn: `Council suggests ${sugEn} below current ${curEn}: lower recommended, pending execution (consensus ${cp}%).`,
    };
  }
  return {
    summary: `评议建议「${sugZh}」，与现行「${curZh}」一致（共识 ${cp}%）。${extraZh}`.trim(),
    summaryEn: `Council suggests ${sugEn}, aligned with current ${curEn} (consensus ${cp}%).${extraEn}`.trim(),
  };
}

/* ------------------------------------------------------------------ *
 * 三、整版 / 分板块复盘
 * ------------------------------------------------------------------ */

export interface CouncilCounts {
  total: number;
  byStatus: Record<CouncilStatus, number>;
  byModule: Record<CouncilModuleId, number>;
  /** 平均共识度（两位小数） */
  averageConsensus: number;
  /** 待执行变更（raise + lower） */
  pending: string[];
  /** 分歧最大、需要人看的前 N 项 */
  tensions: string[];
}

const STATUS_ORDER: CouncilStatus[] = [
  'aligned', 'anchor', 'upheld', 'raise', 'lower', 'observe', 'posture',
];

function summarizeResults(results: CouncilResult[]): CouncilCounts {
  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<CouncilStatus, number>;
  const byModule = Object.fromEntries(COUNCIL_MODULES.map((m) => [m.id, 0])) as Record<CouncilModuleId, number>;
  for (const r of results) {
    byStatus[r.status] += 1;
    byModule[r.module] += 1;
  }
  const total = results.length;
  const avg = total ? round2(results.reduce((s, r) => s + r.consensus, 0) / total) : 1;
  const pending = results.filter((r) => r.status === 'raise' || r.status === 'lower').map((r) => r.id);
  const tensions = [...results]
    .filter((r) => r.kind === 'gate')
    .sort((a, b) => (a.consensus - b.consensus) || (Math.abs(b.delta) - Math.abs(a.delta)))
    .slice(0, 5)
    .map((r) => r.id);
  return { total, byStatus, byModule, averageConsensus: avg, pending, tensions };
}

export interface CouncilReview {
  version: string;
  module: CouncilModuleId | 'all';
  items: CouncilResult[];
  summary: CouncilCounts;
}

/** 复核：module 缺省为全部；未知板块由路由层校验并返回 400 */
export function reviewCouncil(module?: CouncilModuleId | 'all'): CouncilReview {
  const scope = module ?? 'all';
  const items = COUNCIL_ITEMS
    .filter((item) => scope === 'all' || item.module === scope)
    .map(conveneItem);
  return { version: COUNCIL_VERSION, module: scope, items, summary: summarizeResults(items) };
}

/* ------------------------------------------------------------------ *
 * 四、其他板块接入协议（举一反三）
 * ------------------------------------------------------------------ */

export interface CouncilProtocolStep {
  step: number;
  zh: string;
  en: string;
}

export const COUNCIL_PROTOCOL: CouncilProtocolStep[] = [
  { step: 1, zh: '定项：把板块拆成可单独裁决的项（一项一个权限或一个价格）', en: 'Scope: split the board into individually decidable items (one gate or one price each)' },
  { step: 2, zh: '备料：每项填 5 个维度的建议档位（市场 / 差异化 / 算力 / 合规风险 / 入门门槛）', en: 'Prepare: give each item five 0-3 tier suggestions (market / differentiation / compute / risk / entry)' },
  { step: 3, zh: '开席：8 席按各自 stance 加权投票，得出建议档位与共识度', en: 'Convene: eight seats vote by their own stance; derive the suggested tier and consensus' },
  { step: 4, zh: '亮分歧：保留与多数意见不同的席位，不做平均抹平', en: 'Surface dissent: keep minority seats on the record instead of averaging them away' },
  { step: 5, zh: '主席裁定：战略锚点不得上调、override 必写理由、低共识只能观察', en: 'Chair ruling: anchors never rise, overrides need written reasons, low consensus only observes' },
  { step: 6, zh: '落执行：只改被采纳的项，其余如实记为 raise/lower 待办', en: 'Execute: change only adopted items; leave the rest as raise/lower backlog' },
];

export interface CouncilBoard {
  version: string;
  protocol: CouncilProtocolStep[];
  seats: typeof COUNCIL_SEATS;
  dimensions: typeof DIMENSIONS;
  modules: typeof COUNCIL_MODULES;
  review: CouncilReview;
  /** 每行的紧凑结论，供前端在锁定项上直接挂理由 */
  digest: Record<string, CouncilDigest>;
  tensions: CouncilResult[];
}

export interface CouncilDigest {
  current: TierIndex;
  suggested: TierIndex;
  target: TierIndex;
  status: CouncilStatus;
  consensus: number;
  delta: number;
  hint: string;
  hintEn: string;
}

export function councilDigestOf(result: CouncilResult): CouncilDigest {
  return {
    current: result.current, suggested: result.suggested, target: result.target,
    status: result.status, consensus: result.consensus, delta: result.delta,
    hint: result.summary, hintEn: result.summaryEn,
  };
}

export function councilBoard(): CouncilBoard {
  const review = reviewCouncil('all');
  const digest: Record<string, CouncilDigest> = {};
  for (const r of review.items) digest[r.id] = councilDigestOf(r);
  const tensions = review.summary.tensions
    .map((id) => review.items.find((r) => r.id === id))
    .filter((r): r is CouncilResult => Boolean(r));
  return {
    version: COUNCIL_VERSION,
    protocol: COUNCIL_PROTOCOL,
    seats: COUNCIL_SEATS,
    dimensions: DIMENSIONS,
    modules: COUNCIL_MODULES,
    review,
    digest,
    tensions,
  };
}

/** 单项速查（前端锁定项 tooltip / 客服答疑）；未知 id 返回 null */
export function councilOf(itemId: string): CouncilDigest | null {
  const item = COUNCIL_ITEM_MAP[itemId];
  return item ? councilDigestOf(conveneItem(item)) : null;
}

/** /modes 用的极简结论：只带状态、建议档位与共识度，不含长文案 */
export interface CouncilBrief {
  status: CouncilStatus;
  suggested: TierIndex;
  consensus: number;
}

export function councilBrief(itemId: string): CouncilBrief | null {
  const item = COUNCIL_ITEM_MAP[itemId];
  if (!item) return null;
  const r = conveneItem(item);
  return { status: r.status, suggested: r.suggested, consensus: r.consensus };
}
