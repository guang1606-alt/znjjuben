/**
 * 项目机会雷达（市场分析师岗位核心能力 / 立项前商业价值预判）
 * ----------------------------------------------------------------
 * 在用户动笔前就告诉他：这个方向是蓝海还是红海、能不能吃到平台激励、值不值得做系列化、
 * 情感与创新是否成立——既指导创作，也让用户感知“我的剧本有商业价值”。
 *
 * 打分全部可解释、可复现、纯函数；没有榜单数据时不臆造竞争度（标注数据不足，不惩罚用户）。
 * 不输出虚假精确稿费：只给机会等级与定性，真实成交价以平台/买家实际为准（诚信底线）。
 */
import {
  matchScarce, seriesDesignCheck, incentiveStack, innovationPaths, trueEmotionCheck,
  type IncentiveInput,
} from '../config/platform-playbook';
import { trendingSignals, type BoardItem } from './context-personalization';

export interface RadarInput {
  tags: string[];
  seriesSeason?: 2 | 3;
  board?: BoardItem[];
  now?: Date;
  incentive?: IncentiveInput;
  series?: { hasRecurringCharacters?: boolean; worldExpandable?: boolean; mainlineEscalates?: boolean };
  emotion?: { groundedInPlight?: boolean; hasForeshadow?: boolean; restrained?: boolean };
}
export type OceanLevel = '蓝海机会' | '细分机会' | '红海谨慎';
export interface RadarResult {
  opportunityScore: number;          // 0-100
  ocean: OceanLevel;
  grade: 'S' | 'A' | 'B' | 'C';
  scarce: ReturnType<typeof matchScarce>;
  competition: number;               // 0-100，榜单重合热度；无数据=0 且 dataLimited=true
  dataLimited: boolean;
  incentiveTotalPct: number;
  incentiveLines: { channel: string; pct: number; note: string }[];
  seriesOk: boolean;
  seriesAdvice: string;
  innovation: string[];
  emotionOk: boolean;
  emotionAdvice: string;
  breakdown: { factor: string; score: number }[];
  verdict: string;
}

export function opportunityRadar(inp: RadarInput): RadarResult {
  const tags = inp.tags ?? [];
  const breakdown: { factor: string; score: number }[] = [];
  let score = 40; // 成型项目基础分
  breakdown.push({ factor: '成型项目基础分', score: 40 });

  // 1) 稀缺题材：每命中 1 个 +12，封顶 24
  const scarce = matchScarce(tags);
  const scarceScore = Math.min(24, scarce.length * 12);
  score += scarceScore; breakdown.push({ factor: `稀缺题材×${scarce.length}`, score: scarceScore });

  // 2) 竞争度：榜单标签与本项目标签重合热度，越高越减分
  const trend = trendingSignals(inp.board ?? [], inp.now ?? new Date(), 30, 'all');
  const tagSet = new Set(tags);
  const overlap = trend.filter((t) => tagSet.has(t.tag)).reduce((s, t) => s + t.score, 0);
  const dataLimited = (inp.board ?? []).length === 0;
  const competition = dataLimited ? 0 : Math.min(100, Math.round(overlap / 2));
  // 无榜单数据时按中性 15 分计，不因“没数据”而白送竞争优势
  const compScore = dataLimited ? 15 : Math.round((100 - competition) * 0.25);
  score += compScore; breakdown.push({ factor: dataLimited ? '竞争度(无榜单数据,中性计)' : `竞争度反向(竞争${competition})`, score: compScore });

  // 3) 平台激励叠加：每 10% +2，封顶 20
  const incentive = incentiveStack(inp.incentive ?? {});
  const incScore = Math.min(20, Math.round(incentive.totalPct / 10) * 2);
  score += incScore; breakdown.push({ factor: `平台激励叠加${incentive.totalPct}%`, score: incScore });

  // 4) 系列化：骨架成立 +10，续季再 +5
  const series = seriesDesignCheck({ ...(inp.series ?? {}), season: inp.seriesSeason });
  const seriesScore = (series.ok ? 10 : 0) + (inp.seriesSeason ? 5 : 0);
  score += seriesScore; breakdown.push({ factor: '系列化潜力', score: seriesScore });

  // 5) 真情感成立 +10
  const emotion = trueEmotionCheck(inp.emotion ?? {});
  const emoScore = emotion.ok ? 10 : 0;
  score += emoScore; breakdown.push({ factor: '真情感成立', score: emoScore });

  // 6) 创新增量：每开辟 1 条 +3，封顶 9
  const innovation = innovationPaths(tags);
  const innovScore = Math.min(9, innovation.length * 3);
  score += innovScore; breakdown.push({ factor: `可开辟增量×${innovation.length}`, score: innovScore });

  const opportunityScore = Math.max(0, Math.min(100, score));
  const ocean: OceanLevel = opportunityScore >= 72 ? '蓝海机会' : opportunityScore >= 55 ? '细分机会' : '红海谨慎';
  const grade = opportunityScore >= 80 ? 'S' : opportunityScore >= 70 ? 'A' : opportunityScore >= 55 ? 'B' : 'C';
  const verdict = buildVerdict(ocean, grade, scarce.length, incentive.totalPct, series.ok, dataLimited);

  return {
    opportunityScore, ocean, grade, scarce, competition, dataLimited,
    incentiveTotalPct: incentive.totalPct, incentiveLines: incentive.lines,
    seriesOk: series.ok, seriesAdvice: series.advice,
    innovation, emotionOk: emotion.ok, emotionAdvice: emotion.advice,
    breakdown, verdict,
  };
}

function buildVerdict(ocean: OceanLevel, grade: string, scarceN: number, incPct: number, seriesOk: boolean, dataLimited: boolean): string {
  const parts: string[] = [];
  parts.push(`综合机会等级 ${grade}（${ocean}）`);
  if (scarceN) parts.push(`命中${scarceN}个平台鼓励的稀缺方向，差异化空间大`);
  if (incPct > 0) parts.push(`可叠加约${incPct}%平台激励`);
  if (seriesOk) parts.push('具备系列化IP潜力，可规划续季');
  if (dataLimited) parts.push('当前未接入实时榜单，竞争度为中性估算，接入后结论更准');
  parts.push('机会分只指导立项方向，不代表成交承诺，真实价值以成片质量与平台/买家为准');
  return parts.join('；') + '。';
}
