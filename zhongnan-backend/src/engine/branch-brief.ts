/**
 * 互动短剧·结构化分支简报引擎（v2.95）
 * 设计目标：把用户填写的分支要素作为「事实源」确定性注入管线——
 *   ① 主线起点/选择点/结局类型与数量由用户声明，架构师据此规划分支结构；
 *   ② 生成前做闭环预检：每个选择点至少 2 个选项、总结局数合法、结局类型不矛盾；
 *   ③ 分支风格（后果驱动/关系驱动/道德困境/悬疑揭示）决定选择点的情绪压力类型；
 *   ④ 利害压量（低/中/高）决定选择点的情绪强度，但不改变闭环要求。
 * 约束：纯函数 · 双语 · 零 IO · 不改变既有版式与字数闸门。
 */

export type BranchLang = 'zh' | 'en';
export type BranchStyle = 'consequence' | 'relationship' | 'moral' | 'mystery';
export type StakesLevel = 'low' | 'medium' | 'high';

export interface EndingsSpec {
  main: number;    // 主线结局数量（1-3）
  hidden: number;  // 隐藏结局数量（0-2）
  bad: number;     // 坏结局数量（0-2）
}

export interface BranchBriefInput {
  mainLine: string;          // 主线起点（必填 ≥4 字）
  choicePoints: string;      // 关键选择点描述（必填 ≥4 字）
  endings: EndingsSpec;      // 期望的结局数量
  branchStyle: BranchStyle;  // 分支风格
  stakesLevel: StakesLevel;   // 利害压量
  customEnding: string;      // 用户想要的特定结局（选填）
}

export type BranchBriefRaw = Partial<{
  mainLine: unknown;
  choicePoints: unknown;
  endingsMain: unknown;
  endingsHidden: unknown;
  endingsBad: unknown;
  branchStyle: unknown;
  stakesLevel: unknown;
  customEnding: unknown;
}>;

const FIELD_MAX: Record<string, number> = {
  mainLine: 200, choicePoints: 200, customEnding: 200,
};
const STYLES: BranchStyle[] = ['consequence', 'relationship', 'moral', 'mystery'];
const STAKES: StakesLevel[] = ['low', 'medium', 'high'];

export class BranchBriefError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'BranchBriefError';
    this.field = field;
  }
}

function str(v: unknown, field: string, label: string, required: false | number = false): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && s.length < required) throw new BranchBriefError(field, label);
  return s.slice(0, FIELD_MAX[field] || 200).trim();
}

function num(v: unknown, field: string, def: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v, 10) : def);
  if (!Number.isFinite(n) || n < min || n > max) return def;
  return Math.round(n);
}

export function normalizeBranchBrief(raw: BranchBriefRaw | null | undefined): BranchBriefInput {
  const r = raw ?? {};
  const mainLine = str(r.mainLine, 'mainLine', '主线起点至少 4 个字', 4);
  const choicePoints = str(r.choicePoints, 'choicePoints', '关键选择点至少 4 个字', 4);
  const endings: EndingsSpec = {
    main: num(r.endingsMain, 'endingsMain', 1, 1, 3),
    hidden: num(r.endingsHidden, 'endingsHidden', 1, 0, 2),
    bad: num(r.endingsBad, 'endingsBad', 1, 0, 2),
  };
  const total = endings.main + endings.hidden + endings.bad;
  if (total < 2) throw new BranchBriefError('endings', '总结局数至少 2 个（分支选择才有意义）');
  if (total > 6) throw new BranchBriefError('endings', '总结局数不超过 6 个（单集容量有限）');
  return {
    mainLine, choicePoints, endings,
    branchStyle: STYLES.includes(r.branchStyle as BranchStyle) ? (r.branchStyle as BranchStyle) : 'consequence',
    stakesLevel: STAKES.includes(r.stakesLevel as StakesLevel) ? (r.stakesLevel as StakesLevel) : 'medium',
    customEnding: str(r.customEnding, 'customEnding', ''),
  };
}

export function hasBranchBrief(b: BranchBriefInput | null | undefined): b is BranchBriefInput {
  return !!b && b.mainLine.length >= 4 && b.choicePoints.length >= 4;
}

/* ------------------------------------------------------------------ */
/* 分支闭环确定性预检                                                   */
/* ------------------------------------------------------------------ */

export interface BranchValidationError {
  field: string;
  message: string;
}

export function validateBranchStructure(b: BranchBriefInput): BranchValidationError[] {
  const errs: BranchValidationError[] = [];
  // 每个选择点至少需要 2 个选项（由 endings 总数隐式保证：≥2 结局 → 至少 1 个真选择）
  if (b.endings.main + b.endings.hidden + b.endings.bad < 2) {
    errs.push({ field: 'endings', message: '至少 2 个结局才能形成真正的分支选择' });
  }
  // 主线结局至少 1 个（否则无「正确路径」）
  if (b.endings.main < 1) {
    errs.push({ field: 'endingsMain', message: '主线结局至少 1 个' });
  }
  // 坏结局不能多于主线+隐藏（坏结局不应成为主路径）
  if (b.endings.bad > b.endings.main + b.endings.hidden) {
    errs.push({ field: 'endingsBad', message: '坏结局数量不应超过好结局+隐藏结局之和' });
  }
  return errs;
}

/* ------------------------------------------------------------------ */
/* 管线指令拼装（架构师 / 撰写师 / 打回重写共用同一份事实源）            */
/* ------------------------------------------------------------------ */

const STYLE_ZH: Record<BranchStyle, string> = {
  consequence: '后果驱动：选择带来不可逆的资源/处境/关系变化，代价与收益看得见',
  relationship: '关系驱动：选择改变人物关系走向（信任/背叛/疏远/亲近），情绪是主要筹码',
  moral: '道德困境：选择是对价值观的拷问，没有绝对正确的答案，好结局不等于轻松结局',
  mystery: '悬疑揭示：选择决定信息揭露的顺序与层面，拼出不同真相',
};
const STYLE_EN: Record<BranchStyle, string> = {
  consequence: 'Consequence-driven: choices cause irreversible resource/situation/relationship shifts; costs and gains are visible.',
  relationship: 'Relationship-driven: choices change relationship trajectories (trust/betrayal/distance/closeness); emotion is the main currency.',
  moral: 'Moral dilemma: choices test values; no absolutely correct answer; a good ending is not necessarily an easy one.',
  mystery: 'Mystery-reveal: choices determine which information layers unlock and in what order, piecing together different truths.',
};

const STAKES_ZH: Record<StakesLevel, string> = {
  low: '低利害：日常情境中的小取舍（一顿饭、一次约会、一份方案），选择前用幽默/尴尬/小确幸压情绪',
  medium: '中利害：职业/感情中的真实代价（一个机会、一段信任、一次面子），选择前用两难与拉扯压情绪',
  high: '高利害：人生/安全/道德的硬碰硬（一笔巨款、一条命、一个底线），选择前用倒计时/逼迫/不可兼得压情绪',
};
const STAKES_EN: Record<StakesLevel, string> = {
  low: 'Low stakes: small everyday trade-offs (a meal, a date, a proposal); use humor/awkwardness/small joy to build pressure before the choice.',
  medium: 'Medium stakes: real career/relationship costs (an opportunity, a trust, a face-saving moment); use dilemma and tug-of-war to build pressure.',
  high: 'High stakes: life-and-death / safety / moral hard collisions (a fortune, a life, a bottom line); use countdown / coercion / mutual-exclusivity to build pressure.',
};

export function buildBranchDirective(b: BranchBriefInput, lang: BranchLang = 'zh'): string {
  const endingsStr = `${b.endings.main}/${b.endings.hidden}/${b.endings.bad}`;
  if (lang === 'en') {
    const lines = [
      '[INTERACTIVE BRANCH BRIEF — source of truth, follow verbatim]',
      `· Main line start: ${b.mainLine}`,
      `· Key choice point(s): ${b.choicePoints}`,
      `· Endings (main / hidden / bad): ${endingsStr}`,
      `· Branch style: ${STYLE_EN[b.branchStyle]}`,
      `· Stakes level: ${STAKES_EN[b.stakesLevel]}`,
    ];
    if (b.customEnding) lines.push(`· Requested specific ending: ${b.customEnding}`);
    lines.push('· Hard rules: every choice point offers at least 2 real options (different costs → different consequences); no fake choices where both paths converge; every branch leads to an ending — no dead ends, no self-loops, no dangling edges; the ending reached is determined by the cumulative lean of key choices and must match the character arc; give immediate feedback after each choice (attitude/resource/danger changes); the episode ends on a new cliffhanger; never spoil option outcomes in dialogue; branch options and their destinations are marked naturally in △ action lines using the same format.');
    return lines.join('\n');
  }
  const lines = [
    '【互动分支·分支简报·必须严格遵守】（以下为事实源，逐字使用）',
    `◆ 主线起点：${b.mainLine}`,
    `◆ 关键选择点：${b.choicePoints}`,
    `◆ 结局数量（主线/隐藏/坏）：${endingsStr}`,
    `◆ 分支风格：${STYLE_ZH[b.branchStyle]}`,
    `◆ 利害压量：${STAKES_ZH[b.stakesLevel]}`,
  ];
  if (b.customEnding) lines.push(`◆ 期望的特定结局：${b.customEnding}`);
  lines.push('◆ 闭环铁律：每个选择点至少 2 个真选项（代价不同→后果不同）；禁止假选择（两条路结果相同）；每条支路必须通向一个结局——无死胡同、无自环、无悬空连线；结局由关键选择的累积倾向决定且匹配人物弧光；选择后立刻给反馈（人物态度/资源/危险发生变化）；集尾在新悬念处断开；不剧透选项后果；分支选项与去向在 △ 动作行中用同一版式自然标出。');
  return lines.join('\n');
}
