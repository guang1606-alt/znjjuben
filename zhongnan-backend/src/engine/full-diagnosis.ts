/**
 * full-diagnosis.ts —— 全本质量诊断聚合（把后端所有“尺子”汇总成用户看得懂的一张报告）
 *
 * 背景：craft-lint / emotion-craft / webnovel-craft / antiAiScan 此前只在生成流水线内部
 * 或独立“围读”里运行，用户在结果页只能看到 3 个裸分。本引擎把它们统一归一为 PRD 2.4
 * 的六维评分（人物/剧情/台词/市场/格式/去AI化），并产出按严重度排序、可一键执行的修改清单。
 *
 * 设计原则：
 *  - 纯函数、可单测、不连数据库、不调模型、不涉及计费；
 *  - 每个维度分都能追溯到具体规则的 issue.score，不做无来源的假精确；
 *  - 无命中的维度回退到所属引擎均分，并允许外部（pipeline 已算出的市场/受众分）覆盖。
 */
import { craftLint, LintIssue } from './craft-lint';
import { emotionCraftLint } from './emotion-craft';
import { webnovelLint } from './webnovel-craft';
import { archetypeLint } from './archetype-craft';
import { narrativeLint } from './narrative-craft';
import { antiAiScan } from './playbook';
import { aggregateScorecard, DimKey, Scorecard } from './scorecard';

export interface DiagnosisEpisode { epNo?: number; title?: string; content: string }

/** 规则归属到六维（只列明确归属的，其余按引擎兜底） */
const RULE_DIM: Record<string, DimKey> = {
  // 人物
  showByChoice: 'character', charEcosystem: 'character', partner: 'character',
  agency: 'character', parity: 'character', villain: 'character', sainthood: 'character', villainDepth: 'character',
  atVillainCheap: 'character', atSaintMary: 'character', atPortrait: 'character', ntPerfectSaint: 'character',
  // 剧情/结构
  cliffhanger: 'plot', goldenFinger: 'plot', debtChain: 'plot', backcast: 'plot', death: 'plot',
  payoffChain: 'plot', payoffTaxonomy: 'plot', powerGrammar: 'plot', earlyRetention: 'plot',
  emotionOutline: 'plot', firstThree: 'plot', threeQ: 'plot', dumbPayoff: 'plot',
  atSystemShop: 'plot', atFlatOpen: 'plot', ntThenChain: 'plot', ntSatisfiedEnd: 'plot',
  // 台词/表达
  filler: 'dialogue', novelistic: 'dialogue', directness: 'dialogue',
  atSubtext: 'dialogue', atHysteria: 'dialogue', ntEmotionTag: 'dialogue', ntFilterWord: 'deai',
  // 格式
  title: 'format',
};

export interface DimGroup { key: DimKey; label: string; score: number; issues: LintIssue[] }
export interface TopFix { rule: string; level: LintIssue['level']; dim: string; dimLabel: string; advice: string; score: number }

export interface FullDiagnosis {
  scorecard: Scorecard;
  groups: DimGroup[];
  topFixes: TopFix[];
  counts: { p0: number; p1: number; p2: number; aiHits: number; episodeCount: number };
  engineAvg: { craft: number; emotion: number; webnovel: number; archetype: number; narrative: number; deai: number };
  marketEstimated: boolean;
}

const DIM_LABEL: Record<DimKey, string> = {
  character: '人物', plot: '剧情', dialogue: '台词', market: '市场', format: '格式', deai: '去AI化',
};
const LEVEL_ORDER: Record<LintIssue['level'], number> = { P0: 0, P1: 1, P2: 2 };

function avg(nums: number[]): number {
  const v = nums.filter((n) => typeof n === 'number' && n >= 0);
  return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : 0;
}
function clamp(n: number): number { return Math.max(0, Math.min(100, Math.round(n))); }

export function diagnoseFull(
  episodes: DiagnosisEpisode[],
  external: { marketScore?: number; audienceScore?: number } = {},
  lintLang: 'zh' | 'en' = 'zh',
): FullDiagnosis {
  const list = (episodes || []).filter((e) => e && (e.content || '').trim());
  const texts = list.map((e) => e.content);
  const full = texts.join('\n\n');
  const ending = texts[texts.length - 1] || full;

  const craft = craftLint({ episodes: texts, text: full, title: list.find((e) => e.title)?.title, lang: lintLang });
  const emo = emotionCraftLint({ text: full, episodes: texts, isIntrigue: /权谋|宫斗|商战|朝堂|夺嫡/.test(full), lang: lintLang });
  const wn = webnovelLint({ text: full, ending, lang: lintLang });
  const arch = archetypeLint({ text: full, opening: texts[0] ? texts[0].slice(0, 600) : full, lang: lintLang });
  const ai = antiAiScan(full);
  const narr = narrativeLint({ text: full, ending, lang: lintLang });

  const all: LintIssue[] = [...craft.issues, ...emo.issues, ...wn.issues, ...arch.issues, ...narr.issues];
  const byRule = new Map<string, LintIssue>();
  all.forEach((i) => { if (!byRule.has(i.rule)) byRule.set(i.rule, i); });

  // 去AI化：每处AI腔扣 6 分，保底 40；与 craft 均分轻微加权
  const deaiRaw = clamp(100 - ai.hitCount * 6);
  const deaiScore = clamp(Math.round(deaiRaw * 0.6 + (craft.avg || deaiRaw) * 0.25 + (narr.avg || deaiRaw) * 0.15));

  // 各维度：先收集明确归属规则的分数，缺失则回退
  const dimIssues = (key: DimKey): LintIssue[] =>
    all.filter((i) => RULE_DIM[i.rule] === key);
  const dimScore = (key: DimKey, fallback: number): number => {
    const iss = dimIssues(key);
    const s = avg(iss.map((i) => i.score));
    return iss.length ? s : fallback;
  };

  const character = dimScore('character', Math.round((craft.avg * 0.35 + emo.avg * 0.35 + arch.avg * 0.15 + narr.avg * 0.15)));
  const plot = dimScore('plot', Math.round((emo.avg * 0.4 + wn.avg * 0.25 + arch.avg * 0.2 + narr.avg * 0.15)));
  const dialogue = dimScore('dialogue', Math.round(craft.avg * 0.55 + arch.avg * 0.2 + narr.avg * 0.25));
  const format = dimScore('format', craft.avg);

  // 市场维度：优先 pipeline 已算的市场分，其次受众追更欲，否则标记为估算
  let market = 0; let marketEstimated = false;
  if (typeof external.marketScore === 'number' && external.marketScore > 0) market = clamp(external.marketScore);
  else if (typeof external.audienceScore === 'number' && external.audienceScore > 0) market = clamp(external.audienceScore);
  else { market = clamp(Math.round(craft.avg * 0.6 + emo.avg * 0.4)); marketEstimated = true; }

  const raw = { character: clamp(character), plot: clamp(plot), dialogue: clamp(dialogue), market, format: clamp(format), deai: deaiScore };
  const scorecard: Scorecard = aggregateScorecard(raw);

  const groups: DimGroup[] = (Object.keys(DIM_LABEL) as DimKey[]).map((key) => ({
    key, label: DIM_LABEL[key], score: raw[key], issues: dimIssues(key),
  }));

  // 优先修改清单：P0>P1>P2，同级按分数升序（越差越靠前），去重、限量 12
  const topFixes: TopFix[] = [...byRule.values()]
    .filter((i) => i.level === 'P0' || i.level === 'P1' || i.score < 72)
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.score - b.score)
    .slice(0, 12)
    .map((i) => {
      const dk = RULE_DIM[i.rule] || 'plot';
      return { rule: i.rule, level: i.level, dim: dk, dimLabel: DIM_LABEL[dk], advice: i.advice, score: i.score };
    });

  return {
    scorecard,
    groups,
    topFixes,
    counts: {
      p0: all.filter((i) => i.level === 'P0').length,
      p1: all.filter((i) => i.level === 'P1').length,
      p2: all.filter((i) => i.level === 'P2').length,
      aiHits: ai.hitCount,
      episodeCount: list.length,
    },
    engineAvg: { craft: craft.avg, emotion: emo.avg, webnovel: wn.avg, archetype: arch.avg, narrative: narr.avg, deai: deaiScore },
    marketEstimated,
  };
}
