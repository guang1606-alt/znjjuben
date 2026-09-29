/**
 * 字数自适应改写（与 script-format 闸门咬合成闭环：闸门“判”，本模块“改”）
 * 离线确定性能力，严守“不伤剧情”：
 *  - 超标：只对 △ 动作/叙述行做无损精简（删书面填充词、归一冗余标点），
 *          绝不动角色台词（台词承载人物与剧情，且要保口语感）。
 *  - 不足：离线不编造剧情，只产出“精确到场景/补写类型/字数”的扩写规划，交润色岗或大模型补。
 *  - 达标：直接放行。
 */
import { scriptUnits, validateScript, ScriptMode } from './script-format';
import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源


// 仅在叙述行可安全删除的书面填充（不改变事实与动作）
const NARRATIVE_FILLER = [
  '值得一提的是', '不得不说', '换句话说', '与此同时', '某种程度上',
  '事实上', '可以说', '显而易见', '众所周知', '非常地', '十分地', '不由得',
];
// 英文叙述行同等书面填充（仅 LIVE △ 行压缩时使用，整词匹配、不碰台词）
const NARRATIVE_FILLER_EN = [
  'it is worth noting that', 'needless to say', 'in other words', 'at the same time',
  'to some extent', 'in fact', 'it goes without saying', 'obviously,',
];

export interface RemovedItem { scene: number; word: string }
export interface CompressResult {
  text: string;
  before: number;
  after: number;
  removed: RemovedItem[];
  dialogueKept: boolean;
}

function isDialogue(line: string): boolean {
  return /^(?:[一-龥·]{1,6}|[A-Z][A-Za-z.'-]{1,19}(?:\s[A-Z][A-Za-z.'-]{1,19})?)(?:（[^）]*）|\([^)]*\))?[：:]/.test(line) && !line.startsWith('△');
}
function isScene(line: string): boolean {
  // c213：收口共享切分器（全格式场头；此处用于场号计数，剧名页/FADE OUT 不计数）
  return isSceneHeaderLine(line);
}

/** 无损压缩：只精简 △ 叙述行，台词逐字保留 */
export function compressNarrative(text: string): CompressResult {
  const removed: RemovedItem[] = [];
  let scene = 0;
  const beforeLines = text.split('\n').filter(isDialogue);
  const out = text.split('\n').map((raw) => {
    let line = raw;
    if (isScene(line)) scene += 1;
    if (line.trim().startsWith('△')) {
      for (const w of NARRATIVE_FILLER) {
        if (line.includes(w)) { line = line.split(w).join(''); removed.push({ scene, word: w }); }
      }
      for (const w of NARRATIVE_FILLER_EN) {
        const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (re.test(line)) { line = line.replace(re, ''); removed.push({ scene, word: w }); }
      }
      line = line.replace(/，{2,}/g, '，').replace(/\s{2,}/g, ' ').replace(/，。/g, '。');
    }
    return line;
  });
  const afterLines = out.filter(isDialogue);
  const newText = out.join('\n');
  return {
    text: newText,
    before: scriptUnits(text),
    after: scriptUnits(newText),
    removed,
    dialogueKept: beforeLines.join('\n') === afterLines.join('\n'),
  };
}

const EXPAND_TYPES = ['环境与烟火气细节', '人物微表情/小动作', '内心活动外化', '一个短台词回合', '音效与氛围'];

export interface ScenePlan { scene: number; head: string; current: number; targetAdd: number; types: string[] }
export interface LengthPlan {
  status: 'ok' | 'under' | 'over';
  ready: boolean;
  mode: ScriptMode;
  current: number;
  range: [number, number];
  target: number;
  delta: number;
  need?: 'polish' | 'llm_trim';
  expansion?: ScenePlan[];
  compressed?: CompressResult;
  note: string;
}

function splitScenes(text: string): { head: string; body: string[] }[] {
  const scenes: { head: string; body: string[] }[] = [];
  let cur: { head: string; body: string[] } | null = null;
  for (const line of text.split('\n')) {
    if (isScene(line.trim())) {
      cur = { head: line.trim(), body: [] };
      scenes.push(cur);
    } else if (cur) cur.body.push(line);
  }
  return scenes.length ? scenes : [{ head: '全剧', body: text.split('\n') }];
}

/** 不足时：把缺口按各场景现有体量分配，并轮转指定补写类型，交润色岗执行 */
export function planExpansion(text: string, mode: ScriptMode, need: number): ScenePlan[] {
  const scenes = splitScenes(text);
  const weights = scenes.map((s) => Math.max(20, scriptUnits(s.body.join('\n'))));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  let allocated = 0;
  return scenes.map((s, i) => {
    const current = scriptUnits(s.body.join('\n'));
    let targetAdd = i === scenes.length - 1
      ? need - allocated
      : Math.round((need * weights[i]) / sumW);
    targetAdd = Math.max(0, targetAdd);
    allocated += targetAdd;
    return {
      scene: i + 1,
      head: s.head,
      current,
      targetAdd,
      types: [EXPAND_TYPES[i % EXPAND_TYPES.length], EXPAND_TYPES[(i + 2) % EXPAND_TYPES.length]],
    };
  });
}

// v2.80 AIGC 超限治理：真实模型常把1分钟写成3000+字且拒绝整体砍半，需逐场给硬预算
export interface TrimScenePlan {
  scene: number;
  head: string;
  current: number;
  narrative: number;
  spoken: number;
  targetKeep: number; // 本场允许保留的总量（含台词）
  cutUnits: number;   // 必须砍掉的量（负数表示无需砍）
  spokenRatio: number;
  drop?: boolean;     // 建议整场并入邻场（仅超5场的中间场）
  addDialogueUnits: number; // 为回到18%-28%发声带，建议补的台词/内心量
}
export interface TrimPlan {
  scenes: TrimScenePlan[];
  totalCurrent: number;
  target: number;
  hi: number;
  spoken: number;
  spokenRatio: number;
}

const SCENE_FLOOR = 70; // 保留场的最小体量（单位），低于此剪不出完整画面
const SPOKEN_BAND_LO = 0.18;

/** 超限时逐场削减预算：按体量正比分配，保底开场/卡点场，>5场的中间场标记并入 */
export function planTrim(text: string, mode: ScriptMode, durationMin = 1): TrimPlan {
  const v = validateScript(text, mode, durationMin);
  const target = Math.round(((v.range[0] + v.range[1]) / 2));
  const scenes = splitScenes(text);
  const rows: TrimScenePlan[] = scenes.map((s, i) => {
    const dlgUnits = s.body.filter((l) => isDialogue(l.trim())).reduce((a, l) => a + scriptUnits(l), 0);
    const total = scriptUnits(s.body.join('\n'));
    return { scene: i + 1, head: s.head.slice(0, 24), current: total, narrative: Math.max(0, total - dlgUnits), spoken: dlgUnits, spokenRatio: total ? dlgUnits / total : 0, drop: false, targetKeep: total, cutUnits: 0, addDialogueUnits: 0 };
  });
  const totalCurrent = rows.reduce((a, r) => a + r.current, 0) || 1;
  // 先标记可并入场：保前2场与最后1场，其余中间场按"发声最少"优先标记，直到达标
  if (rows.length > 5) {
    const mids = rows.slice(2, -1).sort((a, b) => a.spoken - b.spoken).map((r) => r.scene);
    for (const sn of mids) {
      const projected = rows.filter((r) => !r.drop).reduce((a, r) => a + r.current, 0);
      if (projected <= target) break;
      const r = rows.find((x) => x.scene === sn)!;
      if (rows.filter((x) => !x.drop).length > 3) r.drop = true;
    }
  }
  const kept = rows.filter((r) => !r.drop);
  const keptTotal = kept.reduce((a, r) => a + r.current, 0) || 1;
  const spokenTotal = kept.reduce((a, r) => a + r.spoken, 0);
  rows.forEach((r) => {
    if (r.drop) { r.targetKeep = 0; r.cutUnits = r.current; r.addDialogueUnits = 0; return; }
    // 正比分配目标体量，保底 SCENE_FLOOR，且台词全保（targetKeep 不低于本场台词量）
    let tk = Math.round((target * r.current) / keptTotal);
    tk = Math.max(SCENE_FLOOR, Math.min(r.current, tk, r.spoken + Math.max(120, r.narrative)));
    tk = Math.max(tk, r.spoken);
    r.targetKeep = tk;
    r.cutUnits = Math.max(0, r.current - tk);
    const afterRatio = r.spoken / Math.max(1, tk);
    r.addDialogueUnits = afterRatio < SPOKEN_BAND_LO ? Math.round(SPOKEN_BAND_LO * tk - r.spoken) : 0;
  });
  return { scenes: rows, totalCurrent, target, hi: v.range[1], spoken: spokenTotal, spokenRatio: spokenTotal / Math.max(1, keptTotal) };
}

function splitSentences(line: string): string[] {
  // 中文先按句读切，再对超长整句按逗号/顿号/分号二级切分（竖屏叙述常是长逗号链）；英文同理
  const parts = line.match(/[^。！？….!?；;]+[。！？….!?；;]*\s*/g);
  const raw = parts ? parts.map((s) => s.trim()).filter(Boolean) : [line.trim()].filter(Boolean);
  const out: string[] = [];
  for (const sent of raw) {
    if (scriptUnits(sent) <= 48) { out.push(sent); continue; }
    const clauses = sent.match(/[^，,、；;]+[，,、；;]?\s*/g);
    if (clauses && clauses.length > 1) out.push(...clauses.map((c) => c.trim()).filter(Boolean));
    else out.push(sent);
  }
  return out;
}

export interface HardTrimResult { text: string; before: number; after: number; droppedScenes: number[] }

/**
 * v2.80 确定性硬剪（仅 AIGC 超限时兜底，模型多轮拒绝砍半时保证落入区间）：
 * 只剪叙述句、逐句保留直到达标；所有台词行原样保留；保每场首句（画面锚点）与最后一场（卡点）；
 * 超过5场时按 planTrim 标记整场并入。不生成新文字，绝不编造剧情。
 */
export function hardTrimToRange(text: string, mode: ScriptMode, durationMin = 1): HardTrimResult {
  const before = scriptUnits(text);
  const v = validateScript(text, mode, durationMin);
  if (v.inRange) return { text, before, after: before, droppedScenes: [] };
  const plan = planTrim(text, mode, durationMin);
  const scenes = splitScenes(text);
  const droppedScenes: number[] = [];
  let out = text;
  let after = before;
  // 逐档收缩叙述预算：句子不可再分，单场可能略超，按比例逐档收紧直到达标或只剩台词
  for (const scale of [1, 0.9, 0.8, 0.68, 0.55]) {
    const blocks = scenes.map((s, si) => {
      const tp = plan.scenes[si];
      if (tp?.drop) { if (scale === 1) droppedScenes.push(si + 1); return { head: null as string | null, kept: [] as string[] }; }
      // 预算随档位收缩，但永远保住本场台词行
      const budget = tp ? Math.max(tp.spoken, Math.round(tp.targetKeep * scale)) : v.range[1];
      const isLast = si === scenes.length - 1;
      const dlgLines = s.body.filter((l) => l.trim() && isDialogue(l.trim()));
      const narrLines = s.body.filter((l) => l.trim() && !isDialogue(l.trim()));
      const headCost = scriptUnits(s.head);
      let used = headCost + dlgLines.reduce((a, l) => a + scriptUnits(l), 0);
      const keptNarr: string[] = [];
      const ordered = isLast ? [...narrLines].reverse() : narrLines;
      ordered.forEach((line) => {
        const sentences = splitSentences(line);
        const keptParts: string[] = [];
        sentences.forEach((sent, k) => {
          const u = scriptUnits(sent);
          if (used + u <= budget || (k === 0 && used + u <= budget + 40)) { used += u; keptParts.push(sent); }
        });
        if (keptParts.join('').trim()) keptNarr.push(keptParts.join(''));
      });
      const narrOut = isLast ? keptNarr.reverse() : keptNarr;
      const kept: string[] = [];
      let ni = 0;
      s.body.forEach((l) => {
        const t = l.trim();
        if (!t) return;
        if (isDialogue(t)) kept.push(l);
        else if (ni < narrOut.length) { kept.push(narrOut[ni]); ni += 1; }
      });
      return { head: s.head, kept };
    });
    out = blocks.filter((b) => b.head).map((b) => [b.head, ...b.kept].join('\n')).join('\n');
    after = scriptUnits(out);
    if (after <= v.range[1]) break;
  }
  return { text: out, before, after, droppedScenes };
}

export function adaptScriptLength(text: string, mode: ScriptMode = 'LIVE', durationMin = 1): LengthPlan {
  const v = validateScript(text, mode, durationMin);
  const [lo, hi] = v.range;
  const target = Math.round((lo + hi) / 2);
  const current = v.cjk;
  const base = { mode, current, range: v.range as [number, number], target };

  if (v.inRange) {
    return { ...base, status: 'ok', ready: true, delta: 0, note: '字数已在标准区间，无需改写' };
  }
  if (current > hi) {
    const c = compressNarrative(text);
    const stillOver = c.after > hi;
    return {
      ...base, status: 'over', delta: current - target,
      ready: !stillOver && c.dialogueKept,
      need: stillOver ? 'llm_trim' : undefined,
      compressed: c,
      note: stillOver
        ? '无损精简后仍超标，叙述填充已删尽，需润色岗精简台词回合（不得删关键剧情）'
        : '已通过精简叙述冗余压回区间，台词一字未动',
    };
  }
  // 不足
  const need = target - current;
  return {
    ...base, status: 'under', delta: need, ready: false, need: 'polish',
    expansion: planExpansion(text, mode, need),
    note: '字数不足，已按场景生成扩写规划，交细节润色岗补足，离线不编造剧情',
  };
}
