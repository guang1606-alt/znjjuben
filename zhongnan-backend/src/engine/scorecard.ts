/**
 * 剧本质量六维评分聚合（PRD 2.4）
 * 把各专项引擎的结果归一为“越高越好”的六维质量分：
 * 人物 / 剧情 / 台词 / 市场 / 格式 / 去AI化，输出总评、等级、最短短板与优先优化顺序。
 * 去AI化为核心护城河，权重略高。
 */

export type DimKey = 'character' | 'plot' | 'dialogue' | 'market' | 'format' | 'deai';
export interface DimInput { character: number; plot: number; dialogue: number; market: number; format: number; deai: number }

const DIM_META: Record<DimKey, { label: string; weight: number; advice: string }> = {
  character: { label: '人物', weight: 1, advice: '补人物隐性设定与独立动机，避免工具人/人设崩塌' },
  plot: { label: '剧情', weight: 1, advice: '强化黄金钩子、冲突密度与转折，补结尾留白' },
  dialogue: { label: '台词', weight: 1, advice: '台词去书面腔、贴人物身份，加自然语气与潜台词' },
  market: { label: '市场', weight: 1, advice: '对齐目标平台尺度与受众爽点，参考热度榜选题' },
  format: { label: '格式', weight: 1, advice: '修正剧本格式与单集字数，补齐场景/镜头要素' },
  deai: { label: '去AI化', weight: 1.3, advice: '清除AI腔与套路桥段，注入烟火气与不完美感' },
};

export interface DimScore { key: DimKey; label: string; score: number; level: string; advice: string }
export interface Scorecard {
  dimensions: DimScore[];
  total: number;
  level: string;
  weakest: DimScore;
  priorityActions: DimScore[];   // 按短板严重度排序的优化清单
}

function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }
function levelOf(s: number): string { return s >= 85 ? '优秀' : s >= 70 ? '良好' : s >= 60 ? '及格' : '待打磨'; }

export function aggregateScorecard(raw: DimInput): Scorecard {
  const keys: DimKey[] = ['character', 'plot', 'dialogue', 'market', 'format', 'deai'];
  const dimensions: DimScore[] = keys.map((k) => ({
    key: k, label: DIM_META[k].label, score: clamp(raw[k]), level: levelOf(clamp(raw[k])), advice: DIM_META[k].advice,
  }));
  const wsum = keys.reduce((s, k) => s + DIM_META[k].weight, 0);
  const total = Math.round(keys.reduce((s, k) => s + clamp(raw[k]) * DIM_META[k].weight, 0) / wsum);
  const sorted = [...dimensions].sort((a, b) => a.score - b.score);
  return {
    dimensions,
    total,
    level: levelOf(total),
    weakest: sorted[0],
    priorityActions: sorted.filter((d) => d.score < 85),
  };
}
