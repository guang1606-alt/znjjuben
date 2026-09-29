/**
 * 自主学习·信号源（把工具内部/外部数据自动转成 LearnSignal，喂给 self-learning 引擎）
 * ------------------------------------------------------------------
 * 三类自动来源，全部纯函数、可离线对拍、不臆造数据：
 *   1) 全网榜单 BoardItem（trending-collector 归一化后的结果）→ MARKET_TREND 市场趋势信号；
 *   2) 平台规则/合规更新文档 → POLICY_UPDATE 政策信号（下游强制人工审，不自动生效）；
 *   3) 站内高分成稿（只取梗概与六维强项，脱敏泛化，绝不照抄正文/不带用户标识）→ HIGH_SCORE_SCRIPT。
 * 已学过的信号用稳定 key 去重，避免每天重复学习同一条。
 */
import { BoardItem, BoardRegion, trendingSignals } from './context-personalization';
import { LearnSignal } from './self-learning';

export type KeyedLearnSignal = LearnSignal & { key: string };

/* ---------------- 1) 榜单 → 市场趋势信号 ---------------- */
export interface BoardsOpts { now?: Date; topN?: number; region?: BoardRegion | 'all' }
export function signalsFromBoards(boards: BoardItem[], o: BoardsOpts = {}): KeyedLearnSignal[] {
  const top = trendingSignals(boards, o.now ?? new Date(), o.topN ?? 8, o.region ?? 'all');
  if (!top.length) return [];
  const maxScore = Math.max(...top.map((t) => t.score), 1);
  return top.map((t) => {
    const platforms = new Set(t.from.map((f) => f.split('·')[0]));
    const resonance = platforms.size >= 2; // 多平台共振
    // 相对归一到 40-73，多平台共振 +5（封顶 78）：强共振热点可自动生效，单平台弱信号进待审
    let score = Math.round(40 + 33 * (t.score / maxScore) + (resonance ? 5 : 0));
    score = Math.max(0, Math.min(78, score));
    const platList = [...platforms].join('、');
    return {
      key: `board:${t.tag}:${(o.now ?? new Date()).toISOString().slice(0, 10)}`,
      kind: 'MARKET_TREND',
      title: `市场热点方向：${t.tag}`,
      content: `近期${platList}等平台榜单中「${t.tag}」集中出现（${t.from.length}部代表作，${resonance ? '多平台共振，趋势可信度高' : '暂以单一平台为主，需继续观察'}）：${t.from.slice(0, 3).join('；')}。创作时可在人设反差、开场钩子与爽点节奏上向该方向做差异化借鉴，只复用规律、不复制具体表达。`,
      category: 'plot', score,
      source: `榜单聚合:${platList}`,
    };
  });
}

/* ---------------- 2) 平台规则/合规更新 → 政策信号 ---------------- */
export interface PolicyDoc { id: string; title: string; content: string; source?: string; effectiveAt?: Date | string }
export function signalsFromPolicyUpdates(docs: PolicyDoc[]): KeyedLearnSignal[] {
  return (docs ?? []).filter((d) => d && d.content && d.content.trim().length >= 8).map((d) => ({
    key: `policy:${d.id}`,
    kind: 'POLICY_UPDATE' as const,
    title: `平台/法规更新：${d.title}`,
    // 政策类固定较高置信，但 self-learning 引擎对 POLICY_UPDATE/compliance 一律强制人工审，不会自动生效
    content: d.content, category: 'compliance' as const, score: 80,
    source: d.source ? `政策来源:${d.source}` : undefined,
  }));
}

/* ---------------- 3) 高分剧本 → 技法信号（脱敏泛化） ---------------- */
export interface TopScriptLike {
  id: string; synopsis: string;
  /** scorecard.aggregateScorecard 的结果或等价 {total,dimensions:[{key,label,score}]} */
  qcReport?: { total?: number; dimensions?: { key: string; label: string; score: number }[] } | null;
  createdAt?: Date | string;
}
const DIM_LABEL: Record<string, string> = {
  character: '人物塑造', plot: '剧情结构', dialogue: '台词', market: '市场适配', format: '格式规范', deai: '去AI化',
};
export function signalsFromTopScripts(scripts: TopScriptLike[], opts: { minTotal?: number; maxN?: number } = {}): KeyedLearnSignal[] {
  const minTotal = opts.minTotal ?? 85;
  const maxN = opts.maxN ?? 10;
  return (scripts ?? [])
    .filter((s) => s && s.synopsis && (s.qcReport?.total ?? 0) >= minTotal)
    .sort((a, b) => (b.qcReport!.total ?? 0) - (a.qcReport!.total ?? 0))
    .slice(0, maxN)
    .map((s) => {
      const total = s.qcReport!.total!;
      const strong = (s.qcReport?.dimensions ?? []).filter((d) => d.score >= 85).map((d) => d.label ?? DIM_LABEL[d.key] ?? d.key);
      return {
        key: `script:${s.id}:v${total}`,
        kind: 'HIGH_SCORE_SCRIPT' as const,
        title: `站内高分剧本技法提炼（综合${total}分）`,
        // 只写泛化方法 + 梗概（梗概本就可外显），不抄正文、不带作者标识
        content: `一部综合评分${total}的成稿，其强项在${strong.length ? strong.join('、') : '整体均衡'}。可复用的创作方向：结合梗概「${s.synopsis.slice(0, 160)}」，沉淀其${strong.slice(0, 3).join('、') || '叙事'}层面的处理手法为通用技法，迁移到同类题材时替换具体人设与表达，只学规律不抄内容。`,
        category: 'plot' as const, score: Math.min(95, total),
        source: `站内高分剧本(脱敏):${s.id.slice(0, 6)}`,
      };
    });
}

/* ---------------- 汇总 + 已学去重 ---------------- */
export interface CollectAllInput {
  boards?: BoardItem[]; boardsOpts?: BoardsOpts;
  policyUpdates?: PolicyDoc[];
  topScripts?: TopScriptLike[]; topScriptOpts?: { minTotal?: number; maxN?: number };
}
export function collectAllSignals(input: CollectAllInput): KeyedLearnSignal[] {
  return [
    ...signalsFromBoards(input.boards ?? [], input.boardsOpts),
    ...signalsFromPolicyUpdates(input.policyUpdates ?? []),
    ...signalsFromTopScripts(input.topScripts ?? [], input.topScriptOpts),
  ];
}
/** 过滤掉已学过的 key（learnedKeys 由知识库历史 AUTO 记录维护），返回本轮新增与跳过数 */
export function onlyNewSignals<T extends { key: string }>(signals: T[], learnedKeys: Set<string>): { fresh: T[]; skipped: number } {
  const fresh: T[] = []; let skipped = 0;
  const seenThisRound = new Set<string>();
  for (const s of signals) {
    if (learnedKeys.has(s.key) || seenThisRound.has(s.key)) { skipped++; continue; }
    seenThisRound.add(s.key); fresh.push(s);
  }
  return { fresh, skipped };
}
