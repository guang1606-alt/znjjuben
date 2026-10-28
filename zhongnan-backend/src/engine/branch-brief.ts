/**
 * 互动短剧·结构化分支简报引擎（v2.95）
 * 设计目标：把用户填写的分支要素作为「事实源」确定性注入管线——
 *   ① 主线起点/选择点/结局类型与数量由用户声明，架构师据此规划分支结构；
 *   ② 生成前做闭环预检：每个选择点至少 2 个选项、总结局数合法、结局类型不矛盾；
 *   ③ 分支风格（后果驱动/关系驱动/道德困境/悬疑揭示）决定选择点的情绪压力类型；
 *   ④ 利害压量（低/中/高）决定选择点的情绪强度，但不改变闭环要求。
 * 约束：纯函数 · 双语 · 零 IO · 不改变既有版式与字数闸门。
 */

import { normalizeGraph, GraphFormatError, type BranchGraph, type NodeType } from './interactive-branch';

export type BranchLang = 'zh' | 'en';
export type BranchStyle = 'consequence' | 'relationship' | 'moral' | 'mystery';
export type StakesLevel = 'low' | 'medium' | 'high';

export interface EndingsSpec {
  main: number;    // 主线结局数量（1-3）
  hidden: number;  // 隐藏结局数量（0-2）
  bad: number;     // 坏结局数量（0-2）
}

/* ------------------------------------------------------------------ *
 * v2.333 互动影游·线索链（可选轴，缺省时全链路行为与 v2.332 一致）
 * 设计：线索是「玩家凭什么做选择」的事实源。只做确定性图检查，零模型调用。
 * ------------------------------------------------------------------ */
export type ClueTrust = 'true' | 'half' | 'false';

export interface ClueSpec {
  id: string;              // 线索名（唯一）
  trust: ClueTrust;        // 真 / 半真 / 假
  source: string;          // 来源：谁在什么情境给出
  gainAt: string[];        // 可获得该线索的选择点/支线（至少 1 个，否则玩家永远拿不到）
  opens: string[];         // 可解锁的门控或结局
  requires: string[];      // 前置线索 id（线索链）
  exposeAt: string;        // 假/半真线索的拆穿或揭晓点
  requiredFor: string[];   // 声明该线索为哪些结局的必需线索
}

export interface BranchBriefInput {
  mainLine: string;          // 主线起点（必填 ≥4 字）
  choicePoints: string;      // 关键选择点描述（必填 ≥4 字）
  endings: EndingsSpec;      // 期望的结局数量
  branchStyle: BranchStyle;  // 分支风格
  stakesLevel: StakesLevel;   // 利害压量
  customEnding: string;      // 用户想要的特定结局（选填）
  clues: ClueSpec[];         // 线索链（选填，≤24 条）
  graph: BranchGraph | null; // v2.335 用户已排好的分支图（选填；有图则结构锁定并做联合校验）
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
  clues: unknown;
  graph: unknown;
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
    clues: normalizeClues(r.clues),
    graph: normalizeGraphField(r.graph),
  };
}

/** v2.335 分支图：形状问题（GraphFormatError）统一收敛成 BranchBriefError → 路由 400 带 field=graph */
function normalizeGraphField(raw: unknown): BranchGraph | null {
  try {
    return normalizeGraph(raw);
  } catch (e) {
    if (e instanceof GraphFormatError) throw new BranchBriefError(e.field || 'graph', e.message);
    throw e;
  }
}

const TRUST_ALIAS: Record<string, ClueTrust> = {
  true: 'true', real: 'true', 真: 'true', 真的: 'true', 真实: 'true',
  half: 'half', partial: 'half', 半: 'half', 半真: 'half', 不确定: 'half',
  false: 'false', fake: 'false', 假: 'false', 假的: 'false', 伪: 'false',
};
const MAX_CLUES = 24;

function strList(v: unknown, maxItems = 8): string[] {
  const arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/[,，、;；]/) : []);
  const out: string[] = [];
  for (const item of arr) {
    const s = typeof item === 'string' ? item.trim().slice(0, 60) : '';
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizeClues(raw: unknown): ClueSpec[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.length > MAX_CLUES) throw new BranchBriefError('clues', `线索最多 ${MAX_CLUES} 条（单集容量有限）`);
  return raw.map((item, i) => {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim().slice(0, 40) : '';
    if (!id) throw new BranchBriefError('clues', `第 ${i + 1} 条线索缺少名称（id）`);
    const trustKey = String(o.trust ?? '').trim().toLowerCase();
    return {
      id,
      trust: TRUST_ALIAS[trustKey] ?? 'true',
      source: typeof o.source === 'string' ? o.source.trim().slice(0, 120) : '',
      gainAt: strList(o.gainAt),
      opens: strList(o.opens),
      requires: strList(o.requires),
      exposeAt: typeof o.exposeAt === 'string' ? o.exposeAt.trim().slice(0, 60) : '',
      requiredFor: strList(o.requiredFor),
    };
  });
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
/* v2.333 线索链可达性校验（确定性图检查 · 零模型调用）                   */
/* ------------------------------------------------------------------ */

export type ClueIssueType =
  | 'clue_duplicate' | 'clue_unobtainable' | 'clue_false_unexposed'
  | 'clue_chain_broken' | 'clue_chain_cycle'
  | 'clue_no_gate' | 'clue_half_unexposed' | 'clue_required_unopened';

export interface ClueIssue {
  severity: 'high' | 'mid';
  type: ClueIssueType;
  clue: string;
  evidence: string;
  advice: string;
}

/**
 * high = 拦截（生成前 422，扣费前）；mid = 提示（写进管线指令，由模型在成稿中处理）。
 * 规则：悬空线索 / 假线索无拆穿 / 前置线索不存在 / 前置成环 = 玩家永远拿不到或用不了 → 拦；
 *      线索不打开任何门控 / 半真线索无揭晓 / 声称结局必需却不在 opens = 逻辑可疑 → 提示。
 */
export function validateClueChain(b: BranchBriefInput, lang: BranchLang = 'zh'): ClueIssue[] {
  const clues = b.clues || [];
  if (!clues.length) return [];
  const en = lang === 'en';
  const issues: ClueIssue[] = [];
  const push = (severity: 'high' | 'mid', type: ClueIssueType, clue: string, evidence: string, advice: string) =>
    issues.push({ severity, type, clue, evidence, advice });

  const byId = new Map<string, ClueSpec>();
  for (const c of clues) {
    if (byId.has(c.id)) {
      push('high', 'clue_duplicate', c.id,
        en ? `Clue "${c.id}" is declared more than once` : `线索「${c.id}」重复声明`,
        en ? 'Merge the duplicate entries into one clue' : '合并为一条线索，或给其中一条改名');
      continue;
    }
    byId.set(c.id, c);
  }

  for (const c of byId.values()) {
    if (!c.gainAt.length) {
      push('high', 'clue_unobtainable', c.id,
        en ? `Clue "${c.id}" has no place where the player can obtain it` : `线索「${c.id}」没有任何可获得之处`,
        en ? 'Add at least one choice point / side route where this clue can be found' : '补一个能拿到它的选择点或支线，否则玩家永远得不到');
    }
    if (c.trust === 'false' && !c.exposeAt) {
      push('high', 'clue_false_unexposed', c.id,
        en ? `False clue "${c.id}" is never disproven` : `假线索「${c.id}」没有拆穿点`,
        en ? 'Declare the node where the lie is exposed, or change it to a true clue' : '指定拆穿它的节点；否则玩家被骗到底，结局无法解释');
    }
    if (c.trust === 'half' && !c.exposeAt) {
      push('mid', 'clue_half_unexposed', c.id,
        en ? `Half-true clue "${c.id}" never reveals which part is true` : `半真线索「${c.id}」没有揭晓点`,
        en ? 'Add the point where the true half is confirmed' : '补一个揭晓点，说明哪部分是真、哪部分是误导');
    }
    if (!c.opens.length) {
      push('mid', 'clue_no_gate', c.id,
        en ? `Clue "${c.id}" unlocks no gate or ending` : `线索「${c.id}」不打开任何门控或结局`,
        en ? 'Tie it to a gate/ending, or drop it to avoid a useless prop' : '把它接到某个门控或结局上，否则只是一件无用道具');
    }
    for (const pre of c.requires) {
      if (!byId.has(pre)) {
        push('high', 'clue_chain_broken', c.id,
          en ? `Clue "${c.id}" requires a missing clue "${pre}"` : `线索「${c.id}」的前置线索「${pre}」不存在`,
          en ? 'Declare the prerequisite clue, or remove this dependency' : '补上这条前置线索，或去掉该依赖');
      }
    }
    for (const gate of c.requiredFor) {
      if (!c.opens.includes(gate)) {
        push('mid', 'clue_required_unopened', c.id,
          en ? `Clue "${c.id}" is declared required for "${gate}" but does not unlock it` : `线索「${c.id}」声明为「${gate}」的必需线索，却没打开它`,
          en ? 'Add the gate to this clue’s unlocks, or drop the requirement' : '把该门控加进这条线索的可解锁列表，或去掉必需声明');
      }
    }
  }

  // 前置成环：A 要 B、B 要 A → 两条都永远拿不到
  const reaches = (startId: string, targetId: string): boolean => {
    const seen = new Set<string>();
    const q = [...(byId.get(startId)?.requires || [])];
    while (q.length) {
      const id = q.pop()!;
      if (id === targetId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const pre of byId.get(id)?.requires || []) q.push(pre);
    }
    return false;
  };
  const cyclic = [...byId.values()].filter((c) => reaches(c.id, c.id)).map((c) => c.id);
  if (cyclic.length) {
    push('high', 'clue_chain_cycle', cyclic[0],
      en ? `Prerequisite cycle among clues: ${cyclic.join(' → ')}` : `前置线索成环：${cyclic.join(' → ')}`,
      en ? 'Break the cycle so at least one clue can be obtained first' : '打断环，至少让一条线索能先被拿到');
  }

  return issues;
}

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

/** v2.335 把用户已排好的分支图写进指令块：结构锁定、节点名可作小节标题、线索必须落在图内节点 */
function graphDirectiveLines(g: BranchGraph, lang: BranchLang): string[] {
  const en = lang === 'en';
  const ids = Object.keys(g.nodes);
  const by = (t: NodeType) => ids.filter((id) => g.nodes[id].type === t);
  const lab = (id: string) => {
    const l = g.nodes[id]?.label;
    if (!l) return id;
    return en ? `${id} (${l})` : `${id}（${l}）`;
  };
  const out: string[] = [];
  out.push(en
    ? '◆ FIXED BRANCH GRAPH (structure locked: this episode follows these nodes and edges; never add/remove nodes or rewire links):'
    : '◆ 已定分支图（结构锁定：本集按图的节点与去向落地，不得增删节点或改连线）：');
  out.push(en ? `   · Start: ${lab(g.start)}` : `   · 起点：${lab(g.start)}`);
  const choices = by('choice');
  if (choices.length) {
    const list = choices.slice(0, 12).map((id) => {
      const to = (g.nodes[id].to || []).map(lab).join(' / ');
      const kindTxt = g.nodes[id].kind === 'probability' ? (en ? ' [probability]' : '［概率］')
        : g.nodes[id].kind === 'random' ? (en ? ' [random]' : '［随机］') : '';
      return `${lab(id)}${kindTxt} → ${to || (en ? '(no outgoing edge)' : '（无出边）')}`;
    });
    out.push((en ? '   · Choice points: ' : '   · 选择点：') + list.join(en ? '; ' : '；'));
    if (choices.length > 12) out.push(en ? `   · …and ${choices.length - 12} more choice point(s)` : `   · …另有 ${choices.length - 12} 个选择点`);
  }
  const endings = by('ending');
  if (endings.length) {
    const tag = (id: string) => {
      const t = g.nodes[id].endingType || 'main';
      return en ? ` [${t}]` : `［${t === 'hidden' ? '隐藏' : t === 'bad' ? '坏' : '主线'}］`;
    };
    const list = endings.slice(0, 12).map((id) => `${lab(id)}${tag(id)}`);
    out.push((en ? '   · Endings: ' : '   · 结局：') + list.join(en ? '; ' : '；'));
    if (endings.length > 12) out.push(en ? `   · …and ${endings.length - 12} more ending(s)` : `   · …另有 ${endings.length - 12} 个结局`);
  }
  out.push(en
    ? '   · Every clue must be obtained / exposed inside the named nodes above; node labels may serve as scene section titles where natural. Every player choice must map to an edge in this graph — no extra exits.'
    : '   · 线索的「可得于 / 拆穿于」必须落在上面这些节点名的剧情里，节点标签可自然用作场景小节标题；玩家做出的每个选择都必须对应图里的一条去向，不得新增出口。');
  return out;
}

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
    if (b.graph) lines.push(...graphDirectiveLines(b.graph, 'en'));
    if (b.clues.length) {
      const trustEn: Record<ClueTrust, string> = { true: 'true', half: 'half-true', false: 'false' };
      lines.push('[CLUE CHAIN — source of truth, land every entry]');
      for (const c of b.clues) {
        const parts = [`"${c.id}" (${trustEn[c.trust]})`];
        if (c.source) parts.push(`source ${c.source}`);
        parts.push(`found at ${c.gainAt.join(' / ') || '—'}`, `unlocks ${c.opens.join(' / ') || '—'}`);
        if (c.requires.length) parts.push(`requires ${c.requires.join(' / ')} first`);
        if (c.exposeAt) parts.push(`exposed at ${c.exposeAt}`);
        if (c.requiredFor.length) parts.push(`required for ${c.requiredFor.join(' / ')}`);
        lines.push(`· ${parts.join('; ')}`);
      }
      lines.push('[CLUE RULES] every clue must be obtainable somewhere (no spontaneous clues); a false clue must be disproven at its declared exposure point and must not read as definitely false before that; a clue cannot be used before its prerequisite clue is obtained; a clue that is required for an ending must actually be what unlocks it; clues only supply evidence for the player’s inference — they never make the choice for the player.');
      const mids = validateClueChain(b, 'en').filter((i) => i.severity === 'mid');
      if (mids.length) lines.push(`[CLUE SELF-CHECK — handle in the draft] ${mids.map((i) => i.evidence).join('; ')}`);
    }
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
  if (b.graph) lines.push(...graphDirectiveLines(b.graph, 'zh'));
  if (b.clues.length) {
    const trustZh: Record<ClueTrust, string> = { true: '真线索', half: '半真线索', false: '假线索' };
    lines.push('◆ 线索链（事实源，逐条落地）：');
    for (const c of b.clues) {
      const parts = [`「${c.id}」（${trustZh[c.trust]}）`];
      if (c.source) parts.push(`来源 ${c.source}`);
      parts.push(`可得于 ${c.gainAt.join(' / ') || '—'}`, `可解锁 ${c.opens.join(' / ') || '—'}`);
      if (c.requires.length) parts.push(`需先拿到 ${c.requires.join(' / ')}`);
      if (c.exposeAt) parts.push(`拆穿于 ${c.exposeAt}`);
      if (c.requiredFor.length) parts.push(`该结局必需：${c.requiredFor.join(' / ')}`);
      lines.push(`   · ${parts.join('；')}`);
    }
    lines.push('◆ 线索铁律：每条线索必须有可得之处（不能凭空出现）；假线索必须在声明的拆穿点被证伪，拆穿之前不得让玩家确定它是假的；前置线索未到手不得使用后置线索；声称某结局必需的线索必须真的打开该结局；线索只提供推理依据，不替玩家做选择。');
    const mids = validateClueChain(b, 'zh').filter((i) => i.severity === 'mid');
    if (mids.length) lines.push(`◆ 线索自检提示（成稿中需处理）：${mids.map((i) => i.evidence).join('；')}`);
  }
  lines.push('◆ 闭环铁律：每个选择点至少 2 个真选项（代价不同→后果不同）；禁止假选择（两条路结果相同）；每条支路必须通向一个结局——无死胡同、无自环、无悬空连线；结局由关键选择的累积倾向决定且匹配人物弧光；选择后立刻给反馈（人物态度/资源/危险发生变化）；集尾在新悬念处断开；不剧透选项后果；分支选项与去向在 △ 动作行中用同一版式自然标出。');
  return lines.join('\n');
}
