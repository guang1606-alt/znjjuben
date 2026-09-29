/**
 * pk-rank.ts — 剧本PK 战力榜与赛季段位（v2.68，纯确定性、零外部依赖）
 *
 * 数据来源：PkBattle 记录（v2.67 起每次 PK 落库一条，result.structured 内含 totalA/winner）。
 * 设计原则：
 *  - 只做可复现的确定性聚合，不依赖 LLM、不伪造任何用户/分数；没有对战记录就诚实显示"未上榜"。
 *  - 战力 = 0.7×历史均分 + 0.3×历史最高分（避免一局定终身，也鼓励持续打磨），再叠加胜率加成（上限10分）。
 *  - 段位六档：青铜/白银/黄金/铂金/钻石/王者，英文层零中文。
 */

export interface RawBattle {
  userId: string;
  result?: any;
  createdAt?: Date | string | null;
}

export interface UserMeta {
  nickname?: string | null;
  penName?: string | null;
  avatar?: string | null;
}

export type TierKey = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'KING';

export interface RankEntry {
  userId: string;
  displayName: string;
  battles: number;
  wins: number;
  winRate: number; // 0..1
  avgScore: number;
  bestScore: number;
  power: number; // 0..100+
  tier: TierKey;
  tierZh: string;
  tierEn: string;
  rank: number; // 1-based，0 表示未上榜
}

export interface RankBoard {
  seasonId: string;
  totalPlayers: number;
  totalBattles: number;
  top: RankEntry[];
  mine: RankEntry | null;
}

interface TierDef { key: TierKey; zh: string; en: string; min: number }

/** 段位阈值（按战力 power 划分，闭区间下界） */
export const TIERS: TierDef[] = [
  { key: 'KING', zh: '王者编剧', en: 'King', min: 90 },
  { key: 'DIAMOND', zh: '钻石编剧', en: 'Diamond', min: 80 },
  { key: 'PLATINUM', zh: '铂金编剧', en: 'Platinum', min: 70 },
  { key: 'GOLD', zh: '黄金编剧', en: 'Gold', min: 62 },
  { key: 'SILVER', zh: '白银编剧', en: 'Silver', min: 52 },
  { key: 'BRONZE', zh: '青铜编剧', en: 'Bronze', min: 0 },
];

export function tierOf(power: number): TierDef {
  return TIERS.find((t) => power >= t.min) ?? TIERS[TIERS.length - 1];
}

/** 赛季 ID：按月一个赛季（S2026-09），便于日后做赛季重置与历史榜 */
export function seasonIdOf(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `S${y}-${m}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 从单条 PkBattle 取出"发起方"得分与是否获胜（A 永远是发起者自己） */
function extract(b: RawBattle): { score: number; win: boolean } | null {
  const st = b.result && b.result.structured;
  if (!st || typeof st.totalA !== 'number') return null;
  return { score: clamp(st.totalA, 0, 100), win: st.winner === 'A' };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 聚合单个用户的全部对战 → 战力指标
 */
export function summarizeUser(userId: string, battles: RawBattle[]): Omit<RankEntry, 'userId' | 'displayName' | 'rank'> | null {
  const rows = battles.map(extract).filter((x): x is { score: number; win: boolean } => !!x);
  if (!rows.length) return null;
  const scores = rows.map((r) => r.score);
  const avg = scores.reduce((a, c) => a + c, 0) / scores.length;
  const best = Math.max(...scores);
  const wins = rows.filter((r) => r.win).length;
  const winRate = wins / rows.length;
  // 战力：均值为主、最高分为辅，胜率加成（+winRate*10，封顶100）
  const base = 0.7 * avg + 0.3 * best;
  const power = clamp(round1(base + winRate * 10), 0, 100);
  const tier = tierOf(power);
  return {
    battles: rows.length,
    wins,
    winRate: round1(winRate),
    avgScore: round1(avg),
    bestScore: round1(best),
    power,
    tier: tier.key,
    tierZh: tier.zh,
    tierEn: tier.en,
  };
}

/**
 * 构建战力榜。
 * @param battles 全量 PkBattle（或当前赛季过滤后的）
 * @param currentUserId 当前用户
 * @param metaMap userId → 用户展示信息（笔名优先，其次昵称）
 * @param topN 榜单返回前 N 名（默认 20）
 * @param now 赛季时间锚点（测试可注入）
 */
export function buildRankBoard(
  battles: RawBattle[],
  currentUserId: string | null,
  metaMap: Record<string, UserMeta> = {},
  topN = 20,
  now: Date = new Date(),
): RankBoard {
  const byUser = new Map<string, RawBattle[]>();
  for (const b of battles) {
    if (!b.userId) continue;
    if (!byUser.has(b.userId)) byUser.set(b.userId, []);
    byUser.get(b.userId)!.push(b);
  }
  const entries: RankEntry[] = [];
  for (const [uid, list] of byUser.entries()) {
    const s = summarizeUser(uid, list);
    if (!s) continue;
    const meta = metaMap[uid] || {};
    const displayName = meta.penName || meta.nickname || `编剧${String(uid).slice(-4)}`;
    entries.push({ userId: uid, displayName, rank: 0, ...s });
  }
  // 排序：战力降序 → 胜场降序 → 对战数降序（确定性，无随机）
  entries.sort((a, b) => (b.power - a.power) || (b.wins - a.wins) || (b.battles - a.battles) || a.userId.localeCompare(b.userId));
  entries.forEach((e, i) => { e.rank = i + 1; });
  const mine = entries.find((e) => e.userId === currentUserId)
    ? JSON.parse(JSON.stringify(entries.find((e) => e.userId === currentUserId)))
    : null;
  return {
    seasonId: seasonIdOf(now),
    totalPlayers: entries.length,
    totalBattles: battles.length,
    top: entries.slice(0, topN),
    mine,
  };
}

/** 下一段位进度：返回当前段位内 [0,1] 的进度与下一阶名称（王者返回 1/null） */
export function nextTierProgress(power: number): { progress: number; nextTierEn: string | null; nextTierZh: string | null; gap: number } {
  const cur = tierOf(power);
  const idx = TIERS.findIndex((t) => t.key === cur.key);
  // TIERS 从高到低；下一阶 = idx-1
  if (idx <= 0) return { progress: 1, nextTierEn: null, nextTierZh: null, gap: 0 };
  const next = TIERS[idx - 1];
  const span = next.min - cur.min;
  const progress = clamp((power - cur.min) / Math.max(1, span), 0, 1);
  return { progress: Math.round(progress * 100) / 100, nextTierEn: next.en, nextTierZh: next.zh, gap: Math.max(0, Math.round((next.min - power) * 10) / 10) };
}
