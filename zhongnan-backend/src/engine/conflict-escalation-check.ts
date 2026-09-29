import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.134 冲突升级阶梯检测器（Conflict Escalation Ladder Check）
 *
 * 竖屏短剧的冲突是"爬坡"不是"平移"：一集之内烈度必须一级级顶上去。
 * 与现有引擎分工：
 * - conflict-density-check：冲突"数量"够不够（量）
 * - antagonist-quality-check：反派施压"含金量"（对手质）
 * - scene-padding-check：场景里有没有推进（场效率）
 * - repetition-check：具体词句/动作动词的复用（形式重复）
 * - conflict-escalation-check（本引擎）：冲突烈度沿时间轴"有没有爬坡"（结构曲线）
 *
 * 五类结构病：
 * 1. flat_conflict（high）原地踏步：≥3 个冲突窗口全部停在同一中档烈度，
 *    吵了半集还是同一级台阶，没有向最高潮攀登
 * 2. no_peak（mid）全程无高潮：最高烈度只有口角档（L1），吵得很热闹但没人掀桌子
 * 3. front_loaded（mid）开局即顶格：第一窗就是高档冲突，后面一路往下走，
 *    钩子打完无以为继（注：开场高烈度本身是短剧优点，病在"后续再也接不住"）
 * 4. abrupt_escalation（mid）跳台阶：中后段从口角档直跳生死档，
 *    中间没有威胁/决裂级的过渡，观众觉得"突然就玩这么大"
 * 5. narrow_methods（low）冲突手段贫乏：全剧 L2/L3 冲突动作 ≥6 次，
 *    但实际只用过 ≤2 种动作（拍桌摔门轮着来）
 *
 * 窗口划分：优先按场景标题切窗；场景不足 3 个时按文本长度四等分。
 * 纯文本启发式：信号库中英双语，中文层为单一事实源。
 */

export type CeLang = 'zh' | 'en';

export interface EscalationIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'flat_conflict' | 'no_peak' | 'front_loaded' | 'abrupt_escalation' | 'narrow_methods';
  evidence: string;
  advice: string;
}

export interface RepeatedAction {
  marker: string;
  count: number;
}

export interface ConflictEscalationResult {
  score: number;
  /** 实际窗口数 */
  windowCount: number;
  /** 每个窗口的冲突烈度档 0-3 */
  levels: number[];
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
  /** 全剧最高烈度档 0-3 */
  maxLevel: number;
  /** 首个窗口烈度档 */
  firstWindowLevel: number;
  /** 跳台阶窗口索引（-1 = 无） */
  abruptIndex: number;
  /** L2/L3 冲突动作种类数 */
  actionKinds: number;
  /** 出现过的冲突动作频次（按次数降序） */
  actionFrequency: RepeatedAction[];
  issues: EscalationIssue[];
}

// —— 中文三档烈度信号库 ——
// L1 口角档：情绪对抗，没有实质动作/后果
const L1_ZH = /(争吵|吵架|争执|争论|争辩|质问|质疑|反驳|顶嘴|呛(?:声|道|了)?|怒视|瞪(?:着|了|向|向他|向她)?|冷笑(?:着|道|说)?|讽刺|挖苦|嘲讽|嘲弄|抱怨|埋怨|赌气|甩手|扭头就走|转身就走|挂(?:断)?电话|不耐烦|皱眉|皱起|不满|翻(?:了)?白眼|冷哼)/g;
// L2 决裂档：威胁/羞辱/肢体推搡/财物破坏/关系切割，冲突有了实质后果
const L2_ZH = /(威胁|恐吓|威逼|逼(?:债|婚|签|迁|我|他|她|你)|羞辱|奚落|拍桌|拍桌子|猛拍|摔门|甩门|摔在|撕碎|撕了|撕毁|泼(?:了|在)?|推倒|撞倒|一把推开|开除|解雇|赶走|赶出去|逐出|断绝关系|拉黑|摊牌|翻脸|怒吼|揪(?:住|起)|掐住|摁住|抢过|夺过|拽住|拦住|挡住|摔下|扔出|指着(?:他|她|我|你)的?鼻子)/g;
// L3 生死档：法律/暴力/生死/家破人亡级的不可逆冲突
const L3_ZH = /(报警|警察|警笛声|逮捕|坐牢|入狱|起诉|打官司|官司|绑架|被绑|车祸|一刀|拿刀|掏出刀|拔出刀|拔出枪|开枪|中枪|枪响|见血|流血|出血|一拳|一拳打|一巴掌|耳光|扇(?:了|过|在)|打流|破产|跳楼|晕倒|昏迷|绝症|自杀|杀(?:了|人|死)?|害死|谋杀|血泊)/g;

// —— 英文三档烈度信号库 ——
const L1_EN = /\b(?:argued?|argument|quarrel|snapped(?: back)?|glared|sneered|sneer|sarcastic(?:ally)?|complained|muttered|hung up|walked off|frowned|scoffed|retorted|dismissively|rolled (?:his|her) eyes|in annoyance|coldly)\b/gi;
const L2_EN = /\b(?:threatened?|threat|blackmail(?:ed)?|humiliat(?:ed|ing)|slammed(?: the door| the table| his fist| her fist)?|tore up|ripped up|shoved|smashed|grabbed (?:him|her|my) (?:collar|arm|wrist)|seized|fired(?: him| her| me)?|evicted|threw (?:him|her) out|kicked (?:him|her) out|cut (?:him|her) off|disowned|pointed a finger|clenched (?:his|her) fist|cornered|confronted|snatched|marched toward)\b/gi;
const L3_EN = /\b(?:arrested|called the cops|police|lawsuit|sued|kidnapped|car crash|pulled a knife|pulled a gun|knife|gunshot|shot(?: at)?|bled|blood|punched(?: him| her)?|beat him|slapped(?: him| her)? across the face|slapped(?: him| her)?|bankrupt(?:cy)?|ambulance|hospitalized|collapsed|fainted|jumped from|terminal(?: illness)?|murder(?:ed)?|killed|stabbed)\b/gi;

// 具体冲突动作（用于"手段多样性"统计；长串放短串前，保证 slammed the door 优先命中）
const ACTIONS_ZH = /(拍桌子|拍桌|猛拍|摔门|甩门|撕碎|撕了|撕毁|一巴掌|耳光|推倒|撞倒|一把推开|摔在|摔下|揪住|掐住|摁住|抢过|夺过|拽住|拦住|指着鼻子|泼了|泼在|扔出)/g;
const ACTIONS_EN = /(slammed the door|slammed the table|slammed|tore up|ripped up|slapped|shoved|smashed|grabbed|punched|kicked|seized|pinned|snatched|clenched (?:his|her) fist|pointed a finger)/gi;

function countMatches(text: string, re: RegExp): number {
  let n = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    n++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return n;
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].toLowerCase());
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));


/** 切窗：优先按场景行；场景不足 3 个时按文本长度四等分 */
function splitWindows(text: string, lang: CeLang): string[] {
  const isHeader = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    return isSceneHeaderLine(t, lang); // c213：收口共享切分器
  };
  const scenes: string[] = [];
  let cur = '';
  let seenHeader = false;
  for (const line of text.split('\n')) {
    if (isHeader(line)) {
      if (cur.trim()) scenes.push(cur);
      cur = '';
      seenHeader = true;
    }
    cur += line + '\n';
  }
  if (cur.trim()) scenes.push(cur);
  if (seenHeader && scenes.length >= 3) return scenes;

  // 回退：四等份（按字符长度，不切断文本结构太多也无所谓——只做信号计数）
  const size = Math.ceil(text.length / 4);
  const buckets: string[] = [];
  for (let i = 0; i < text.length; i += size) buckets.push(text.slice(i, i + size));
  return buckets.filter((b) => b.trim().length > 0);
}

/**
 * v2.134 冲突升级阶梯检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function conflictEscalationCheck(text: string, lang: CeLang): ConflictEscalationResult {
  const empty: ConflictEscalationResult = {
    score: 100,
    windowCount: 0,
    levels: [],
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    maxLevel: 0,
    firstWindowLevel: 0,
    abruptIndex: -1,
    actionKinds: 0,
    actionFrequency: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const L1 = isZh ? L1_ZH : L1_EN;
  const L2 = isZh ? L2_ZH : L2_EN;
  const L3 = isZh ? L3_ZH : L3_EN;
  const ACTIONS = isZh ? ACTIONS_ZH : ACTIONS_EN;

  const windows = splitWindows(text, lang);
  const levels = windows.map((w) => {
    const l1 = countMatches(w, L1);
    const l2 = countMatches(w, L2);
    const l3 = countMatches(w, L3);
    if (l3 > 0) return 3;
    if (l2 >= 2 || (l2 >= 1 && l1 >= 2)) return 2;
    if (l2 >= 1 || l1 >= 1) return 1;
    return 0;
  });

  const l1Hits = countMatches(text, L1);
  const l2Hits = countMatches(text, L2);
  const l3Hits = countMatches(text, L3);
  const totalHits = l1Hits + l2Hits + l3Hits;
  const maxLevel = levels.length ? Math.max(...levels) : 0;
  const firstWindowLevel = levels[0] ?? 0;
  const conflictWindows = levels.filter((lv) => lv >= 1);

  // 冲突总量太少不评结构（短剧极短片段/纯过场文本）
  if (windows.length < 3 || totalHits < 4) {
    return { ...empty, windowCount: windows.length, levels, l1Hits, l2Hits, l3Hits, maxLevel, firstWindowLevel };
  }

  // 跳台阶：中后段窗口（i>=2）从上一口角档直跳生死档；开场高烈度钩子豁免
  let abruptIndex = -1;
  for (let i = 2; i < levels.length; i++) {
    if (levels[i] === 3 && levels[i - 1] <= 1) {
      abruptIndex = i;
      break;
    }
  }

  // 手段多样性：L2/L3 具体动作的种类覆盖
  const actionSeq = matchAll(text, ACTIONS);
  const freqMap = new Map<string, number>();
  for (const a of actionSeq) freqMap.set(a, (freqMap.get(a) ?? 0) + 1);
  const actionFrequency = Array.from(freqMap.entries())
    .map(([marker, count]) => ({ marker, count }))
    .sort((a, b) => b.count - a.count);
  const actionKinds = freqMap.size;
  const heavyActionTotal = actionSeq.length;

  const issues: EscalationIssue[] = [];
  let penalty = 0;

  // 1) 原地踏步：≥3 个冲突窗口，全部钉在中档（L2），一个都没爬上 L3
  const allMidPlateau = conflictWindows.length >= 3 && conflictWindows.every((lv) => lv === 2);
  if (allMidPlateau) {
    penalty += 16;
    issues.push({
      severity: 'high',
      type: 'flat_conflict',
      evidence: isZh
        ? `${conflictWindows.length} 个冲突窗口全部停在"威胁/摔砸"同一档烈度（烈度序列 ${levels.join('→')}），没有一场冲上最高潮`
        : `All ${conflictWindows.length} conflict windows plateau at the same threat/destruction level (curve ${levels.join('→')}); none reaches the climax`,
      advice: isZh
        ? '冲突是爬坡，不是跑步机。每一场冲突都要比上一场多押一样东西：第一场摔门，第二场就得撕合同，第三场必须见血/报警/彻底翻脸。给每场戏发一张"加码牌"——更高的代价、更狠的把柄、更不可逆的动作，把观众的血压一级级顶到集尾。'
        : 'Conflict must climb, not jog in place. Every clash raises the stake over the last: a slammed door, then a torn contract, then blood/police/a permanent break. Deal each scene an escalation card — a higher price, a deadlier leverage, an irreversible move — and ride the audience\'s blood pressure to the episode hook.',
    });
  }

  // 2) 全程无高潮：最高只到口角档
  if (maxLevel === 1) {
    penalty += 12;
    issues.push({
      severity: 'mid',
      type: 'no_peak',
      evidence: isZh
        ? `全剧 ${totalHits} 处冲突信号全是口角/情绪对抗，没有一个威胁、决裂或更高级别的实质动作`
        : `All ${totalHits} conflict cues stay at bickering level — zero threats, breaks, or higher-stakes action`,
      advice: isZh
        ? '吵架吵不出爽点，观众要的是"事情真的发生了"。在集尾前安排至少一次不可逆的实质动作：一纸合同被撕、一个耳光落下、一次报警或开除。口角负责点火，动作负责爆炸——光点火不爆炸，观众只会觉得雷声大雨点小。'
        : 'Bickering never pays off — the audience needs something to actually happen. Land at least one irreversible action before the episode hook: a contract torn, a slap, a call to the police, a firing. Arguments light the fuse; action is the explosion. Fuse without explosion is all thunder, no rain.',
    });
  }

  // 3) 开局即顶格：首窗已高档，后续接不住（全平台场景已归 flat_conflict，此处只判"高开低走"）
  const laterMax = levels.length > 1 ? Math.max(...levels.slice(1)) : 0;
  if (firstWindowLevel >= 2 && laterMax < firstWindowLevel && conflictWindows.length >= 3 && !allMidPlateau) {
    penalty += 10;
    issues.push({
      severity: 'mid',
      type: 'front_loaded',
      evidence: isZh
        ? `开场第 1 个窗口烈度已达 ${firstWindowLevel} 档，之后最高只有 ${laterMax} 档（${levels.join('→')}）——钩子打完后劲不足`
        : `Window 1 opens at level ${firstWindowLevel}, but the rest peaks at ${laterMax} (${levels.join('→')}) — the hook has nowhere to climb`,
      advice: isZh
        ? '开局炸场是对的，但炸完要留更大的雷。把最高潮的"核武器"（真正的反转/生死/家破人亡）压到集尾，开场只用它的导火索：先让警察进门，集尾才亮出手铐。给后续每一场都准备比开场更狠的一手。'
        : 'A cold open bang is right — but keep a bigger bomb for later. Save the nuclear beat (the real reversal, life-and-death stakes) for the episode hook; open on the fuse only — police at the door, cuffs shown at the end. Each following scene must hold a worse hand than the opening.',
    });
  }

  // 4) 跳台阶：中后段口角档直跳生死档
  if (abruptIndex >= 0) {
    penalty += 8;
    issues.push({
      severity: 'mid',
      type: 'abrupt_escalation',
      evidence: isZh
        ? `第 ${abruptIndex + 1} 个窗口从口角档直接跳到生死档（${levels.slice(Math.max(0, abruptIndex - 1), abruptIndex + 1).join('→')}），中间缺威胁/决裂级铺垫`
        : `Window ${abruptIndex + 1} jumps from bickering straight to life-or-death stakes (${levels.slice(Math.max(0, abruptIndex - 1), abruptIndex + 1).join('→')}) with no threat/break in between`,
      advice: isZh
        ? '大冲突要"借坡下驴"。在口角和玩命之间补两级台阶：先让对方口头威胁（"你别后悔"），再让威胁落地（摔东西/赶走/拉黑），最后才是报警动手。观众需要看着角色一步步被逼过线，跳级的冲突只会显得编剧急了。'
        : 'Big stakes need stairs. Insert two rungs between a quarrel and mortal danger: first a verbal threat ("you\'ll regret this"), then the threat made physical (smashing property, eviction, being cut off) — and only then police or violence. The audience must watch a person get pushed over the line step by step; a leap just looks like an impatient writer.',
    });
  }

  // 5) 手段贫乏：L2/L3 动作 ≥6 次但种类 ≤2
  if (heavyActionTotal >= 6 && actionKinds <= 2) {
    penalty += 6;
    const top = actionFrequency.slice(0, 3).map((a) => `${a.marker}×${a.count}`).join('、');
    issues.push({
      severity: 'low',
      type: 'narrow_methods',
      evidence: isZh
        ? `全剧 ${heavyActionTotal} 次实质冲突动作只用了 ${actionKinds} 种（${top}）——冲突手段重复`
        : `${heavyActionTotal} heavy conflict actions use only ${actionKinds} kind(s) (${top}) — repetitive conflict vocabulary`,
      advice: isZh
        ? '反派和主角不能只有一招。拍桌三次之后观众就免疫了。给不同情绪配不同动作：算计是按灭烟头、暴怒是掀桌、决裂是摘戒指、狠辣是笑着把证据推回去。动作库翻一倍，冲突的层次就翻一倍。'
        : 'Characters can\'t have just one move — after the third table-slam the audience is immune. Match distinct actions to distinct emotions: cold calculation crushes a cigarette, rage flips the table, severance removes a ring, cruelty smiles while sliding evidence back. Double the action vocabulary and you double the conflict\'s layers.',
    });
  }

  issues.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));

  return {
    score: clamp(100 - penalty),
    windowCount: windows.length,
    levels,
    l1Hits,
    l2Hits,
    l3Hits,
    maxLevel,
    firstWindowLevel,
    abruptIndex,
    actionKinds,
    actionFrequency,
    issues,
  };
}
