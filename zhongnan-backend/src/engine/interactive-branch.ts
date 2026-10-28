/**
 * 互动短剧分支逻辑校验（PRD 3.5）
 * 节点图：start 为入口，scene 普通剧情，choice 选择点（至少2个不同去向），ending 结局。
 * 自动检测：
 *  - 可达性：是否存在从起点到不了的孤儿节点
 *  - 死胡同：非结局节点却没有任何出边
 *  - 伪选择：选择点少于2个分支 / 两个选项指向同一节点 / 选项自环
 *  - 死循环：某条非结局路径永远到不了任何结局
 *  - 多结局：主线/隐藏/坏结局齐全度统计与建议
 */
import type { ClueSpec } from './branch-brief';

export type NodeType = 'scene' | 'choice' | 'ending';
export type EndingType = 'main' | 'hidden' | 'bad';
/** 选择机制（PRD 3.5 多元随机）：fixed 玩家固定选项 / random 等概率随机 / probability 按 weights 概率触发 */
export type ChoiceKind = 'fixed' | 'random' | 'probability';
export interface BranchNode {
  type: NodeType;
  to?: string[];
  endingType?: EndingType;
  kind?: ChoiceKind;
  weights?: number[];   // kind=probability 时与 to 等长的相对权重
  label?: string;
}
export interface BranchGraph { start: string; nodes: Record<string, BranchNode> }

export interface BranchIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'unreachable' | 'dead_end' | 'single_choice' | 'fake_choice' | 'self_loop' | 'infinite_loop' | 'no_ending' | 'ending_missing' | 'dangling_edge' | 'bad_weights';
  node?: string;
  evidence: string;
  advice: string;
}
export interface BranchReport {
  issues: BranchIssue[];
  reachableCount: number;
  totalCount: number;
  endings: { main: number; hidden: number; bad: number };
  choiceCount: number;
  closedLoop: boolean;     // 所有可达非结局节点都能走到结局 = 闭环
  score: number;
}

function bfs(start: string, adj: Record<string, string[]>): Set<string> {
  const seen = new Set<string>([start]);
  const q = [start];
  while (q.length) {
    const id = q.shift()!;
    for (const nxt of adj[id] || []) {
      if (!seen.has(nxt)) { seen.add(nxt); q.push(nxt); }
    }
  }
  return seen;
}

/* ---------- v1.89 引擎级多语言：分支骨架标签 / 校验问题 / 结构编辑报错（默认中文，en 输出英文） ---------- */
export type BranchLang = 'zh' | 'en';
const SK_LABEL = {
  zh: { start: '开场铺垫', choice: (i: number) => `选择点${i}`, bad: (i: number) => `坏结局${i}`, dev: (i: number) => `发展${i}`, main: '主线结局', hidden: '隐藏结局' },
  en: { start: 'Opening setup', choice: (i: number) => `Choice ${i}`, bad: (i: number) => `Bad ending ${i}`, dev: (i: number) => `Development ${i}`, main: 'Main ending', hidden: 'Hidden ending' },
};
function branchMsg(lang: BranchLang) {
  if (lang === 'en') {
    return {
      dangling: (id: string, t: string) => ({ evidence: `Node "${id}" links to a missing node "${t}"`, advice: 'Create the target node or remove this dangling link' }),
      unreachable: (id: string) => ({ evidence: `Node "${id}" is unreachable from the start`, advice: 'Connect it into the main branch or delete this orphan node' }),
      single: (id: string, n: number) => ({ evidence: `Choice "${id}" has only ${n} outgoing option(s)`, advice: 'An interactive choice needs at least 2 distinct branches' }),
      selfLoop: (id: string) => ({ evidence: `Choice "${id}" loops an option back to itself`, advice: 'Remove the self-loop and give genuinely different outcomes' }),
      fake: (id: string) => ({ evidence: `Choice "${id}" sends multiple options to the same node`, advice: 'This is a fake choice — route options to different results' }),
      badW: (id: string) => ({ evidence: `Choice "${id}" has invalid probability weights (must match option count, be non-negative, and sum above 0)`, advice: 'Set valid weights per branch, or switch to fixed / equal-random' }),
      deadEnd: (id: string) => ({ evidence: `Node "${id}" has no successor and is not an ending`, advice: 'Add a follow-up branch or mark it as an ending' }),
      noEnding: { evidence: 'The graph has no reachable ending', advice: 'Add at least one ending node — an interactive story must have an exit' },
      loop: (id: string) => ({ evidence: `The branch through "${id}" can never reach any ending`, advice: 'A dead loop exists — add an exit that leads to an ending' }),
      noHidden: { evidence: 'No hidden ending', advice: 'Add a hidden ending to reward replay' },
      noBad: { evidence: 'No bad ending', advice: 'Add a bad ending to raise the cost of choice' },
      errMaxNodes: (n: number) => `At most ${n} nodes per graph`,
      errExists: (id: string) => `Node "${id}" already exists`,
      errNoStartDel: 'The start node cannot be deleted',
      errMissing: (id: string) => `Node "${id}" does not exist`,
      errBoth: 'Both ends of a link must exist',
      errFromEnding: 'An ending node cannot link outward',
      errLinkExists: 'This link already exists',
      errMaxOut: (n: number) => `A node can have at most ${n} outgoing links`,
      errOnlyChoiceKind: 'Only a choice node can set a random mechanism',
      errWeightLen: 'The number of weights must equal the number of branches',
      errWeightVal: 'Weights must be non-negative with a positive sum',
      errUnknown: 'Unknown edit operation',
    };
  }
  return {
    dangling: (id: string, t: string) => ({ evidence: `节点「${id}」连向了不存在的节点「${t}」`, advice: '补建目标节点，或删除这条悬空连线' }),
    unreachable: (id: string) => ({ evidence: `节点「${id}」从起点无法到达`, advice: '把它接进主分支，或删除该孤立节点' }),
    single: (id: string, n: number) => ({ evidence: `选择点「${id}」只有${n}个去向`, advice: '互动选择至少需要2个不同分支' }),
    selfLoop: (id: string) => ({ evidence: `选择点「${id}」选项指回自己形成自环`, advice: '去掉自环选项，给玩家真正不同的走向' }),
    fake: (id: string) => ({ evidence: `选择点「${id}」多个选项指向同一节点`, advice: '这是伪选择，让两个选项通向不同结果' }),
    badW: (id: string) => ({ evidence: `选择点「${id}」概率权重非法（需与选项等长、非负、总和大于0）`, advice: '为每个分支配置合法权重，或改用固定/等概率随机' }),
    deadEnd: (id: string) => ({ evidence: `节点「${id}」没有后续且不是结局`, advice: '补上后续分支或把它设为结局节点' }),
    noEnding: { evidence: '全图没有任何可达结局', advice: '至少设置一个结局节点，互动剧必须有出口' },
    loop: (id: string) => ({ evidence: `节点「${id}」所在分支走不到任何结局`, advice: '存在死循环，给该分支补一个通向结局的出口' }),
    noHidden: { evidence: '没有隐藏结局', advice: '可加隐藏结局提升二刷探索欲' },
    noBad: { evidence: '没有坏结局', advice: '可加坏结局强化选择代价感' },
    errMaxNodes: (n: number) => `单图最多 ${n} 个节点`,
    errExists: (id: string) => `节点「${id}」已存在`,
    errNoStartDel: '起点不可删除',
    errMissing: (id: string) => `节点「${id}」不存在`,
    errBoth: '连线两端节点都必须存在',
    errFromEnding: '结局节点不能再向外连线',
    errLinkExists: '这条连线已存在',
    errMaxOut: (n: number) => `单个节点最多连 ${n} 条`,
    errOnlyChoiceKind: '只有选择点能设置随机机制',
    errWeightLen: '概率权重数量必须与分支数一致',
    errWeightVal: '权重必须非负且总和大于0',
    errUnknown: '未知编辑操作',
  };
}
export function validateBranches(g: BranchGraph, lang: BranchLang = 'zh'): BranchReport {
  const M = branchMsg(lang);
  const issues: BranchIssue[] = [];
  const ids = Object.keys(g.nodes);
  const adj: Record<string, string[]> = {};
  ids.forEach((id) => { adj[id] = g.nodes[id].to || []; });

  // 1) 从起点可达
  const reachable = bfs(g.start, adj);
  // 1b) 悬空边：指向根本不存在的节点（最常见的拖拽漏接 bug）
  ids.forEach((id) => {
    (adj[id] || []).forEach((t) => {
      if (!g.nodes[t]) { const x = M.dangling(id, t); issues.push({ severity: 'high', type: 'dangling_edge', node: id, evidence: x.evidence, advice: x.advice }); }
    });
  });
  ids.forEach((id) => {
    if (!reachable.has(id)) { const x = M.unreachable(id); issues.push({ severity: 'mid', type: 'unreachable', node: id, evidence: x.evidence, advice: x.advice }); }
  });

  // 2/3) 死胡同、选择点合法性
  let choiceCount = 0;
  reachable.forEach((id) => {
    const n = g.nodes[id];
    if (!n) return;
    const to = n.to || [];
    if (n.type === 'choice') {
      choiceCount += 1;
      if (to.length < 2) { const x = M.single(id, to.length); issues.push({ severity: 'high', type: 'single_choice', node: id, evidence: x.evidence, advice: x.advice }); }
      if (to.includes(id)) { const x = M.selfLoop(id); issues.push({ severity: 'high', type: 'self_loop', node: id, evidence: x.evidence, advice: x.advice }); }
      if (to.length >= 2 && new Set(to).size < to.length) { const x = M.fake(id); issues.push({ severity: 'mid', type: 'fake_choice', node: id, evidence: x.evidence, advice: x.advice }); }
      // 概率触发：权重必须与去向等长、非负且总和为正
      if (n.kind === 'probability') {
        const w = n.weights || [];
        const sum = w.reduce((s, x) => s + (Number.isFinite(x) && x >= 0 ? x : 0), 0);
        if (w.length !== to.length || w.some((x) => !Number.isFinite(x) || x < 0) || sum <= 0) {
          const x = M.badW(id); issues.push({ severity: 'high', type: 'bad_weights', node: id, evidence: x.evidence, advice: x.advice });
        }
      }
    } else if (n.type !== 'ending' && to.length === 0) {
      const x = M.deadEnd(id); issues.push({ severity: 'high', type: 'dead_end', node: id, evidence: x.evidence, advice: x.advice });
    }
  });

  // 4) 结局统计 + 反向求“能走到结局”的节点集合
  const endingIds = ids.filter((id) => g.nodes[id].type === 'ending' && reachable.has(id));
  const endings = { main: 0, hidden: 0, bad: 0 };
  endingIds.forEach((id) => { const t = g.nodes[id].endingType || 'main'; endings[t] += 1; });
  if (endingIds.length === 0) issues.push({ severity: 'high', type: 'no_ending', evidence: M.noEnding.evidence, advice: M.noEnding.advice });

  const rev: Record<string, string[]> = {};
  ids.forEach((id) => (adj[id] || []).forEach((t) => { (rev[t] = rev[t] || []).push(id); }));
  const canEnd = bfsFromSet(endingIds, rev);
  reachable.forEach((id) => {
    const n = g.nodes[id];
    if (n && n.type !== 'ending' && !canEnd.has(id)) {
      const x = M.loop(id); issues.push({ severity: 'high', type: 'infinite_loop', node: id, evidence: x.evidence, advice: x.advice });
    }
  });

  if (endingIds.length > 0) {
    if (!endings.hidden) issues.push({ severity: 'low', type: 'ending_missing', evidence: M.noHidden.evidence, advice: M.noHidden.advice });
    if (!endings.bad) issues.push({ severity: 'low', type: 'ending_missing', evidence: M.noBad.evidence, advice: M.noBad.advice });
  }

  const deduct = issues.reduce((s, i) => s + (i.severity === 'high' ? 20 : i.severity === 'mid' ? 8 : 3), 0);
  const highLoop = issues.some((i) => i.type === 'infinite_loop' || i.type === 'dead_end');
  return {
    issues,
    reachableCount: reachable.size,
    totalCount: ids.length,
    endings,
    choiceCount,
    closedLoop: endingIds.length > 0 && !highLoop && !issues.some((i) => i.type === 'no_ending'),
    score: Math.max(0, 100 - deduct),
  };
}

function bfsFromSet(seeds: string[], adj: Record<string, string[]>): Set<string> {
  const seen = new Set<string>(seeds);
  const q = [...seeds];
  while (q.length) {
    const id = q.shift()!;
    for (const pre of adj[id] || []) {
      if (!seen.has(pre)) { seen.add(pre); q.push(pre); }
    }
  }
  return seen;
}

/* ---------------- 互动分支骨架生成（快速起稿，保证结构合法） ---------------- */
export interface SkeletonOptions {
  choicePoints?: number;   // 选择点数量（1..6）
  withBad?: boolean;       // 每个选择点是否挂一个坏结局（选择代价）
  withHidden?: boolean;    // 末个选择点是否挂隐藏结局（二刷探索）
  lang?: BranchLang;       // v1.89 骨架节点标签语言，默认 zh
}
/**
 * 生成保证自身校验通过的合法骨架：线性主干 + 每点一个坏结局分支，末点可挂隐藏结局，
 * 主选项一路推进到主线结局。所有选项去向互不相同（杜绝伪选择），无死胡同/死循环。
 */
export function buildBranchSkeleton(opts: SkeletonOptions = {}): BranchGraph {
  const cp = Math.min(6, Math.max(1, opts.choicePoints ?? 2));
  const withBad = opts.withBad !== false;
  const withHidden = opts.withHidden !== false;
  const L = SK_LABEL[opts.lang === 'en' ? 'en' : 'zh'];
  const nodes: Record<string, BranchNode> = {};
  nodes['start'] = { type: 'scene', to: ['c1'], label: L.start };
  for (let i = 1; i <= cp; i++) {
    const mainNext = i < cp ? `s${i + 1}` : 'end_main';
    const to = [mainNext];
    if (withBad) to.push(`bad_${i}`);
    if (i === cp && withHidden) to.push('end_hidden');
    nodes[`c${i}`] = { type: 'choice', kind: 'fixed', to, label: L.choice(i) };
    if (withBad) nodes[`bad_${i}`] = { type: 'ending', endingType: 'bad', label: L.bad(i) };
    if (i < cp) nodes[`s${i + 1}`] = { type: 'scene', to: [`c${i + 1}`], label: L.dev(i + 1) };
  }
  nodes['end_main'] = { type: 'ending', endingType: 'main', label: L.main };
  if (withHidden) nodes['end_hidden'] = { type: 'ending', endingType: 'hidden', label: L.hidden };
  // 若某选择点最终只剩 1 个去向（关闭了坏/隐藏分支），降级为普通剧情节点，避免“单选”伪选择
  for (let i = 1; i <= cp; i++) {
    const key = `c${i}`;
    if ((nodes[key].to || []).length < 2) { nodes[key].type = 'scene'; delete nodes[key].kind; }
  }
  return { start: 'start', nodes };
}

/* ---------------- 可视化编辑器：图结构增删改（纯函数、不可变、可单测） ---------------- */
export type MutateOp =
  | { op: 'addNode'; nodeType: NodeType; label?: string; id?: string; endingType?: EndingType }
  | { op: 'removeNode'; id: string }
  | { op: 'link'; from: string; to: string }
  | { op: 'unlink'; from: string; to: string }
  | { op: 'setType'; id: string; nodeType: NodeType; endingType?: EndingType }
  | { op: 'setKind'; id: string; kind: ChoiceKind; weights?: number[] }
  | { op: 'relabel'; id: string; label: string };

const MAX_NODES = 400;
const MAX_OUT = 8;
function cloneGraph(g: BranchGraph): BranchGraph {
  const nodes: Record<string, BranchNode> = {};
  for (const id of Object.keys(g.nodes)) nodes[id] = { ...g.nodes[id], to: [...(g.nodes[id].to || [])] };
  return { start: g.start, nodes };
}
/** 应用一次结构编辑，返回新图；非法操作抛错（路由转 400 中文提示）。自动维护边的一致性。 */
export function applyMutator(g: BranchGraph, op: MutateOp, lang: BranchLang = 'zh'): BranchGraph {
  const M = branchMsg(lang);
  const next = cloneGraph(g);
  const N = next.nodes;
  switch (op.op) {
    case 'addNode': {
      if (Object.keys(N).length >= MAX_NODES) throw new Error(M.errMaxNodes(MAX_NODES));
      let id = (op.id || '').trim();
      if (!id) { let i = 1; while (N[`n${i}`]) i += 1; id = `n${i}`; }
      if (N[id]) throw new Error(M.errExists(id));
      N[id] = { type: op.nodeType, to: [], ...(op.label ? { label: op.label } : {}), ...(op.nodeType === 'ending' ? { endingType: op.endingType || 'main' } : {}) };
      break;
    }
    case 'removeNode': {
      if (op.id === next.start) throw new Error(M.errNoStartDel);
      if (!N[op.id]) throw new Error(M.errMissing(op.id));
      delete N[op.id];
      Object.keys(N).forEach((k) => { const t = N[k].to || []; const i = t.indexOf(op.id); if (i >= 0) t.splice(i, 1); });
      break;
    }
    case 'link': {
      if (!N[op.from] || !N[op.to]) throw new Error(M.errBoth);
      if (N[op.from].type === 'ending') throw new Error(M.errFromEnding);
      const t = N[op.from].to || (N[op.from].to = []);
      if (t.includes(op.to)) throw new Error(M.errLinkExists);
      if (t.length >= MAX_OUT) throw new Error(M.errMaxOut(MAX_OUT));
      t.push(op.to);
      if (N[op.from].kind === 'probability') (N[op.from].weights ||= []).push(1); // 新分支给默认等权
      break;
    }
    case 'unlink': {
      const node = N[op.from]; const t = node?.to || []; const i = t.indexOf(op.to);
      if (i >= 0) { t.splice(i, 1); if (node?.kind === 'probability' && Array.isArray(node.weights)) node.weights.splice(i, 1); }
      break;
    }
    case 'setKind': {
      if (!N[op.id]) throw new Error(M.errMissing(op.id));
      if (N[op.id].type !== 'choice') throw new Error(M.errOnlyChoiceKind);
      if (op.kind === 'probability') {
        const n = N[op.id], w = Array.isArray(op.weights) ? op.weights : (n.to || []).map(() => 1);
        if (w.length !== (n.to || []).length) throw new Error(M.errWeightLen);
        if (w.some((x) => !Number.isFinite(x) || x < 0) || w.reduce((s, x) => s + x, 0) <= 0) throw new Error(M.errWeightVal);
        n.kind = 'probability'; n.weights = w.map((x) => Math.round(x * 100) / 100);
      } else {
        N[op.id].kind = op.kind; delete N[op.id].weights; // fixed/random 不需要权重
      }
      break;
    }
    case 'setType': {
      if (!N[op.id]) throw new Error(M.errMissing(op.id));
      N[op.id].type = op.nodeType;
      if (op.nodeType === 'ending') { N[op.id].endingType = op.endingType || N[op.id].endingType || 'main'; N[op.id].to = []; }
      else delete N[op.id].endingType;
      break;
    }
    case 'relabel': {
      if (!N[op.id]) throw new Error(M.errMissing(op.id));
      N[op.id].label = String(op.label ?? '').slice(0, 60);
      break;
    }
    default: throw new Error(M.errUnknown);
  }
  return next;
}
/** 分层自动布局：以到起点的最长路径深度分列，同层纵向均布；返回每节点坐标（确定性，前端可再拖拽覆盖）。 */
export function autoLayout(g: BranchGraph, opts: { colWidth?: number; rowHeight?: number } = {}): Record<string, { x: number; y: number; depth: number }> {
  const colWidth = opts.colWidth ?? 230, rowHeight = opts.rowHeight ?? 120;
  const ids = Object.keys(g.nodes);
  const depth: Record<string, number> = {};
  ids.forEach((id) => { depth[id] = g.nodes[id] && id === g.start ? 0 : -1; });
  // BFS 求最短可达深度作为列（环内节点取首次到达层，避免死循环）
  const q = [g.start];
  while (q.length) {
    const id = q.shift()!;
    for (const t of g.nodes[id]?.to || []) {
      if (g.nodes[t] && depth[t] === -1) { depth[t] = (depth[id] ?? 0) + 1; q.push(t); }
    }
  }
  const layers: Record<number, string[]> = {};
  ids.forEach((id) => { const d = depth[id] < 0 ? 99 : depth[id]; (layers[d] = layers[d] || []).push(id); });
  const pos: Record<string, { x: number; y: number; depth: number }> = {};
  Object.keys(layers).map(Number).sort((a, b) => a - b).forEach((d) => {
    const col = layers[d];
    col.forEach((id, i) => { pos[id] = { x: 40 + d * colWidth, y: 40 + i * rowHeight, depth: d === 99 ? -1 : d }; });
  });
  return pos;
}

/* ------------------------------------------------------------------ *
 * v2.334 线索 × 节点联合可达性（线索声明必须真的落在分支图上）
 * v2.333 的线索校验只看线索之间的字符串关系，不知道分支图长什么样：
 *   · 声明「可得于 选择点3」，图上却没有这个节点（或它不可达）→ 玩家永远拿不到；
 *   · 声明某结局必需某线索，图上却存在绕过该线索的路径 → 结局逻辑不自洽；
 *   · 假线索的拆穿点落在不可达节点 → 玩家永远看不到揭晓。
 * 规则：high = 可得点不存在 / 可得点不可达 / 结局可绕过；mid = 可解锁目标不认识 / 拆穿点不可达。
 * 约束：纯函数、零 IO、零模型调用；只做 id/标签/结局类型三层名称解析，不做语义猜测。
 * ------------------------------------------------------------------ */
export type ClueGraphIssueType =
  | 'clue_gain_unknown' | 'clue_gain_unreachable' | 'clue_ending_bypass'
  | 'clue_opens_unknown' | 'clue_expose_unreachable';

export interface ClueGraphIssue {
  severity: 'high' | 'mid';
  type: ClueGraphIssueType;
  clue: string;
  evidence: string;
  advice: string;
}

const key = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const ENDING_ALIAS: Record<string, EndingType> = {
  main: 'main', 'main ending': 'main', '主线': 'main', '主线结局': 'main',
  hidden: 'hidden', 'hidden ending': 'hidden', '隐藏': 'hidden', '隐藏结局': 'hidden',
  bad: 'bad', 'bad ending': 'bad', '坏': 'bad', '坏结局': 'bad',
};

function resolveNodes(g: BranchGraph, entry: string): string[] {
  const k = key(entry);
  if (!k) return [];
  return Object.keys(g.nodes).filter((id) => g.nodes[id] && (key(id) === k || key(g.nodes[id].label || '') === k));
}

function resolveEndings(g: BranchGraph, entry: string): string[] {
  const k = key(entry);
  if (!k) return [];
  const alias = ENDING_ALIAS[k];
  return Object.keys(g.nodes).filter((id) => {
    const n = g.nodes[id];
    if (!n || n.type !== 'ending') return false;
    if (key(id) === k || key(n.label || '') === k) return true;
    return !!alias && (n.endingType || 'main') === alias;
  });
}

function reachSkipping(g: BranchGraph, blocked: Set<string>): Set<string> {
  const seen = new Set<string>();
  const q: string[] = [];
  if (!blocked.has(g.start) && g.nodes[g.start]) { seen.add(g.start); q.push(g.start); }
  while (q.length) {
    const id = q.shift()!;
    for (const t of g.nodes[id]?.to || []) {
      if (blocked.has(t) || seen.has(t) || !g.nodes[t]) continue;
      seen.add(t); q.push(t);
    }
  }
  return seen;
}

export function validateClueGraph(clues: ClueSpec[], g: BranchGraph, lang: BranchLang = 'zh'): ClueGraphIssue[] {
  const issues: ClueGraphIssue[] = [];
  const ids = Object.keys(g?.nodes || {});
  if (!clues?.length || !ids.length || !g.nodes[g.start]) return issues;
  const en = lang === 'en';
  const adj: Record<string, string[]> = {};
  ids.forEach((id) => { adj[id] = g.nodes[id].to || []; });
  const reachable = bfs(g.start, adj);
  const push = (severity: 'high' | 'mid', type: ClueGraphIssueType, clue: string, evidence: string, advice: string) => {
    if (issues.length < 60) issues.push({ severity, type, clue, evidence, advice });
  };

  for (const c of clues) {
    const gainNodes = [...new Set(c.gainAt.flatMap((e) => resolveNodes(g, e)))];
    if (c.gainAt.length && !gainNodes.length) {
      push('high', 'clue_gain_unknown', c.id,
        en ? `Clue "${c.id}" says it is obtained at "${c.gainAt[0]}", but no node with that id or label exists in the branch graph`
           : `线索「${c.id}」声明可得于「${c.gainAt[0]}」，但分支图里没有这个节点`,
        en ? 'Use the node id or label that really exists, or create that choice point / route'
           : '改成图上真实存在的节点 id 或标签，或补建该选择点/支线');
    } else if (gainNodes.length && !gainNodes.some((n) => reachable.has(n))) {
      push('high', 'clue_gain_unreachable', c.id,
        en ? `Clue "${c.id}" can only be obtained at ${gainNodes.join(' / ')}, none of which is reachable from the start`
           : `线索「${c.id}」只能从「${gainNodes.join(' / ')}」拿到，但这些节点从起点都不通`,
        en ? 'Connect the route holding this clue into the main branch, or move the clue to a reachable node'
           : '把承载该线索的支线接进主分支，或把线索挪到可达的节点上');
    }
    // 结局绕过：图上存在不经过任何可得处就抵达该结局的路径 → 「必需」声明与结构矛盾
    if (gainNodes.length && !gainNodes.includes(g.start)) {
      const seen = reachSkipping(g, new Set(gainNodes));
      for (const entry of c.requiredFor) {
        const ends = resolveEndings(g, entry);
        if (!ends.length) continue;
        const bypass = ends.find((e) => seen.has(e));
        if (bypass) {
          push('high', 'clue_ending_bypass', c.id,
            en ? `Clue "${c.id}" is declared required for "${entry}", but the ending "${bypass}" is reachable without ever obtaining it`
               : `线索「${c.id}」声明为「${entry}」的必需线索，但结局「${bypass}」存在不拿到它就抵达的路径`,
            en ? 'Gate that ending behind the clue (a choice that requires it), or drop the required-for claim'
               : '在该结局前加一道以该线索为条件的门控，或去掉「必需」声明');
          break;
        }
      }
    }
    const unknownOpen = c.opens.find((o) => !resolveNodes(g, o).length && !resolveEndings(g, o).length);
    if (unknownOpen) {
      push('mid', 'clue_opens_unknown', c.id,
        en ? `Clue "${c.id}" claims to unlock "${unknownOpen}", which matches no node or ending in the graph`
           : `线索「${c.id}」声称可解锁「${unknownOpen}」，但图上没有对应节点或结局`,
        en ? 'Align the name with a real gate / ending, or treat it as flavor evidence'
           : '把名称对齐到真实的门控/结局，或明确它只是氛围证据');
    }
    if (c.exposeAt) {
      const exp = resolveNodes(g, c.exposeAt);
      if (exp.length && !exp.some((n) => reachable.has(n))) {
        push('mid', 'clue_expose_unreachable', c.id,
          en ? `Clue "${c.id}" is exposed at "${c.exposeAt}", which is unreachable from the start — the reveal never happens`
             : `线索「${c.id}」的拆穿点「${c.exposeAt}」从起点不可达 —— 玩家永远看不到揭晓`,
          en ? 'Move the reveal to a reachable node, or connect this branch into the main line'
             : '把拆穿挪到可达节点，或把该支线接进主线');
      }
    }
  }
  return issues;
}
