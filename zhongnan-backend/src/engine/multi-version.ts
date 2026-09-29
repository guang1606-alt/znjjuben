/**
 * 多版本强制差异化（PRD 2.1.1 反同质化）
 * 两道闸：
 *  A) pickDiverseSeeds：生成前为第 N 版分配正交创作种子（主角原型×核心冲突×反转路径×结局基调），
 *     从源头保证不同版本“不是一个模子”，模拟不同编剧思路。
 *  B) diversityAudit：生成后两两比对，主角原型/冲突标签/走向标签/梗概文本任一维过度重合即判“伪多版本”，
 *     指出哪两版、撞在哪、怎么拉开。
 */

// —— 正交创作种子库（可由学习中台持续扩充）——
export const ARCHETYPES = ['落魄原配', '隐藏大佬', '替身打工人', '被逐继承人', '市井小人物', '隐忍复仇者', '天才少女', '落魄神医'];
export const CONFLICTS = ['婚姻背叛', '身份错位', '职场倾轧', '血缘误会', '财产争夺', '尊严羞辱', '生死危机', '信任崩塌'];
export const TURNS = ['隐藏身份揭晓', '以退为进', '反向利用', '借力打力', '时间错位', '反派倒戈', '证据反杀', '苦肉计'];
export const TONES = ['爽感打脸', '治愈和解', '黑色反讽', '开放式留白', '正义审判'];
// v1.89 英文版正交种子库（与中文一一对应，英文界面/英文剧本时输出）
const ARCHETYPES_EN = ['Disgraced first spouse', 'Hidden powerhouse', 'Stand-in worker', 'Disinherited heir', 'Street-level underdog', 'Patient avenger', 'Young prodigy', 'Fallen miracle doctor'];
const CONFLICTS_EN = ['Betrayal in marriage', 'Mistaken identity', 'Office power play', 'Kinship misunderstanding', 'Battle over assets', 'Humiliation of dignity', 'Life-or-death crisis', 'Collapse of trust'];
const TURNS_EN = ['Hidden identity revealed', 'Retreat to advance', 'Turn their move against them', 'Borrow strength to strike', 'Timeline twist', 'Villain switches sides', 'Evidence counter-kill', 'Self-sacrifice ruse'];
const TONES_EN = ['Satisfying comeuppance', 'Healing & reconciliation', 'Dark irony', 'Open-ended', 'Justice served'];
export type DivLang = 'zh' | 'en';

export interface DiverseSeed {
  version: number;
  archetype: string;
  conflict: string;
  turn: string;
  tone: string;
  directive: string;
}

/** 轮转取互不重复的正交组合，n 超过单库长度时循环但仍尽量错开 */
export function pickDiverseSeeds(n: number, lang: DivLang = 'zh'): DiverseSeed[] {
  const seeds: DiverseSeed[] = [];
  const en = lang === 'en';
  const AR = en ? ARCHETYPES_EN : ARCHETYPES, CF = en ? CONFLICTS_EN : CONFLICTS, TU = en ? TURNS_EN : TURNS, TO = en ? TONES_EN : TONES;
  for (let i = 0; i < n; i++) {
    const archetype = AR[i % AR.length];
    const conflict = CF[(i * 3 + 1) % CF.length];
    const turn = TU[(i * 5 + 2) % TU.length];
    const tone = TO[i % TO.length];
    seeds.push({
      version: i + 1, archetype, conflict, turn, tone,
      directive: en
        ? `Version ${i + 1} differentiation: lead archetype "${archetype}", core conflict "${conflict}", key reversal "${turn}", ending tone "${tone}"; do not share lead setup, conflict type, or reversal path with other versions.`
        : `第${i + 1}版差异化定位：主角原型「${archetype}」，核心冲突走「${conflict}」，关键反转用「${turn}」，结局基调「${tone}」；不得与其他版本共用主角设定、冲突类型与反转路径。`,
    });
  }
  return seeds;
}

// —— 生成后审计 ——
export interface VersionInput {
  id: string | number;
  logline: string;
  archetype?: string;
  conflictTags?: string[];
  plotTags?: string[];
}
export interface PairIssue {
  severity: 'high' | 'mid';
  a: string | number; b: string | number;
  dimension: 'archetype' | 'conflict' | 'plot' | 'logline';
  value: number;
  advice: string;
}

function jaccard(a: string[] = [], b: string[] = []): number {
  const sa = new Set(a), sb = new Set(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((x) => { if (sb.has(x)) inter += 1; });
  return inter / new Set([...a, ...b]).size;
}

function bigrams(s: string): Set<string> {
  const t = (s || '').replace(/[\s，。、…？！：；“”"'（）()·\-—]/g, '');
  const g = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
}
function bigramSim(a: string, b: string): number {
  const ga = bigrams(a), gb = bigrams(b);
  if (!ga.size || !gb.size) return 0;
  let inter = 0;
  ga.forEach((x) => { if (gb.has(x)) inter += 1; });
  return inter / new Set([...ga, ...gb]).size;
}

export interface DiversityReport {
  pairs: number;
  issues: PairIssue[];
  score: number;                 // 整体差异化分，越高越不同
  pseudoVersion: boolean;        // 是否存在伪多版本
  matrix: { a: string | number; b: string | number; conflictOverlap: number; plotOverlap: number; loglineSim: number }[];
}

export function diversityAudit(versions: VersionInput[], lang: DivLang = 'zh'): DiversityReport {
  const en = lang === 'en';
  const adv = {
    arch: (a: string | number, b: string | number) => en ? `Versions ${a} and ${b} share the same lead archetype and overlapping conflicts — change the lead identity or core conflict type` : `版本${a}与${b}主角原型相同且冲突雷同，必须更换主角身份或核心冲突类型`,
    conf: (a: string | number, b: string | number) => en ? `Versions ${a} and ${b} overlap too much on core conflict — use a different main conflict line` : `版本${a}与${b}核心冲突重合过高，换一条主冲突线`,
    plot: (a: string | number, b: string | number) => en ? `Versions ${a} and ${b} converge in plot direction — adjust reversal beats and ending path` : `版本${a}与${b}剧情走向趋同，调整反转节点与结局路径`,
    log: (a: string | number, b: string | number) => en ? `Versions ${a} and ${b} have near-identical loglines (same story in disguise) — rewrite the core premise` : `版本${a}与${b}梗概文本高度相似，属于换汤不换药，需重写故事核`,
  };
  const issues: PairIssue[] = [];
  const matrix: DiversityReport['matrix'] = [];
  let pairs = 0;
  for (let i = 0; i < versions.length; i++) {
    for (let j = i + 1; j < versions.length; j++) {
      pairs += 1;
      const a = versions[i], b = versions[j];
      const conflictOverlap = jaccard(a.conflictTags, b.conflictTags);
      const plotOverlap = jaccard(a.plotTags, b.plotTags);
      const loglineSim = bigramSim(a.logline, b.logline);
      matrix.push({ a: a.id, b: b.id, conflictOverlap: Number(conflictOverlap.toFixed(2)), plotOverlap: Number(plotOverlap.toFixed(2)), loglineSim: Number(loglineSim.toFixed(2)) });

      if (a.archetype && b.archetype && a.archetype === b.archetype && conflictOverlap >= 0.5) {
        issues.push({ severity: 'high', a: a.id, b: b.id, dimension: 'archetype', value: conflictOverlap, advice: adv.arch(a.id, b.id) });
      }
      if (conflictOverlap >= 0.6) issues.push({ severity: 'high', a: a.id, b: b.id, dimension: 'conflict', value: conflictOverlap, advice: adv.conf(a.id, b.id) });
      if (plotOverlap >= 0.6) issues.push({ severity: 'mid', a: a.id, b: b.id, dimension: 'plot', value: plotOverlap, advice: adv.plot(a.id, b.id) });
      if (loglineSim >= 0.55) issues.push({ severity: 'high', a: a.id, b: b.id, dimension: 'logline', value: loglineSim, advice: adv.log(a.id, b.id) });
    }
  }
  const deduct = issues.reduce((s, x) => s + (x.severity === 'high' ? 22 : 10), 0);
  return { pairs, issues, score: Math.max(0, 100 - deduct), pseudoVersion: issues.some((x) => x.severity === 'high'), matrix };
}
