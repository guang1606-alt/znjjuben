import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.140 误会拖延 / 拒绝沟通检测（PRD 2.1.37 冲突不能靠"按头误会"硬撑）
 * ------------------------------------------------------------------
 * 分工：
 *  - causal-logic：宏观因果（巧合过载/机械降神/无因获知/誓言烂尾）
 *  - subtext-check：台词"说得太直"（底牌直给/反派自曝）
 *  - relationship-progression：关系推进的合理性
 *  - v2.140（本引擎）：该说不说、拒绝倾听——"为了误会而误会"的沟通失效
 *
 * 四类问题：
 *  1) refusal_to_listen       拒绝沟通：一方"你听我解释"，对方"我不听"+摔门挂断
 *  2) misunderstanding_repeat 误会反复：同一个误会跨 ≥3 场不解，也无澄清证据
 *  3) forced_silence          有嘴不说：话到嘴边咽回去/必须瞒住 反复 ≥2 次
 *  4) half_truth_conviction   偷听定罪：只听到半句/在门外听到片段就直接走人
 *
 * 正信号：拒绝当场或紧邻下一场即澄清（误会解除/我错怪你了/it was a misunderstanding）
 * ——"一场误会一场解"是短剧正常用法，不罚；拖才罚。
 */

export type MdLang = 'zh' | 'en';

export interface MisunderstandingIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'refusal_to_listen'
    | 'misunderstanding_repeat'
    | 'forced_silence'
    | 'half_truth_conviction';
  evidence: string;
  advice: string;
  /** 出现的场景序号（1 基） */
  scene: number;
  key: string;
}

export interface MisunderstandingSceneReport {
  index: number;
  header: string;
  contradictionCount: number;
}

export interface MisunderstandingDragResult {
  score: number;
  sceneCount: number;
  /** 沟通类信号行命中总数（求解释/拒绝/误会词根/咽话/偷听） */
  signalCount: number;
  issueCount: number;
  refusalCount: number;
  repeatCount: number;
  forcedSilenceCount: number;
  halfTruthCount: number;
  /** 快速澄清次数（拒绝当场或下一场即解开） */
  resolvedCount: number;
  scenes: MisunderstandingSceneReport[];
  issues: MisunderstandingIssue[];
}

// —— 场景切分（复用 v2.132/v2.138/v2.139 标题约定）——

// —— 中文词库 ——
// 求解释/要求澄清（必须是明确的解释请求，避免与正常争执混淆）
const EXPLAIN_ZH = /(?:你听我解释|听我解释|让我解释|我可以解释|你听我说|先听我说|听我把话说完|不是你想的(?:那样|这样)|事情不是(?:你想的|这样)|你误会(?:了|我了)|你(?:肯定|一定|可能|怕是)是误会|让我把话说清楚|给我(?:一)?分钟解释)/;
// 拒绝倾听/切断沟通（必须落在解释请求后 3 行窗口内才成对）
const REFUSE_ZH = /(?:我不听|我不想听|不想听(?:你|你解释|这些|解释)|不要听|没什么好(?:说|解释|听)的|(?:我|对你)?无话可说|你闭嘴|摔门(?:而)?(?:去|走|离|出)|(?:夺门|摔门)而出|挂断(?:了)?(?:电话)?|扭头就走|转身就走|掉头就走|拂袖而去|捂(?:住|着)?耳朵|不想(?:再)?(?:看见|见到)你|给我滚(?:出去)?|你给我走)/;
// 误会词根
const MIS_ZH = /(?:误会|误解|错怪|会错意)/;
// 成功澄清（从严：必须是明确认错/误会解除/实锤还清白，不收裸"原来"）
const RESOLVE_ZH = /(?:误会(?:终于)?(?:解除|消除|解开|化开)|这(?:只|就)?是(?:一)?个误会|我错怪(?:你|他|她)了|错怪(?:你|他|她)了|原来(?:是)?我错(?:怪|了)|真相(?:终于)?大白|终于水落石出|水落石出|(?:监控|录音|证据|录像)[^，。；？！\n]{0,10}(?:证明|还(?:了|给)?)(?:[^，。；？！\n]{0,8})?(?:清白|真相)|终于(?:肯听|相信)(?:我|他|她))/;
// 有嘴不说（咽回真相/刻意隐瞒，单条不报，≥2 才报）
const SILENCE_ZH = /(?:欲言又止|话到嘴边(?:又|却)?(?:咽|吞|收)(?:了)?(?:回去)?|把(?:到了嘴边的)?话(?:又|重新)?咽(?:了)?回去|差点(?:就|要)?说(?:出|了)出口|话(?:到了嘴边)?[^，。；？！\n]{0,2}没说出口|张了张嘴(?:，)?(?:却|最终|还是)?(?:没说|什么都没说)|不能让(?:他|她|他们)知道|必须瞒(?:着|住|下去)|还是(?:先)?别说(?:了|吧))/;
// 偷听半句话
const HALF_ZH = /(?:只听到(?:半句|一半|后(?:半)?句)|(?:刚|才)?听(?:到)?(?:一)?半(?:句)?[^，。；？！\n]{0,8}(?:转身就走|扭头就走|跑(?:了|出去|开)|离开了?)|断章取义|在门外(?:偷)?听到[^，。；？！\n]{0,12}(?:认定|定罪|误会|摔门|跑|走))/;

// —— 英文词库 ——
const EXPLAIN_EN = /\b(?:let me explain|i can explain|hear me out|listen to me(?: first)?|let me finish|it(?:'s| is) not what you think|it(?:'s| is)n(?:'t|ot) what you think|you(?:'ve| have) got it wrong|you got it wrong|you misunderstood(?: me)?|that(?:'s| is) not (?:what|how) (?:really )?(?:happened|it happened)|let me tell you what really (?:happened|went on))\b/i;
const REFUSE_EN = /\b(?:i don(?:'t|ot) want to hear(?: it| this| any more| anymore)?|i won(?:'t|ot) listen|i don(?:'t|ot) wanna hear|save it|shut up|there(?:'s| is) nothing to explain|nothing (?:more )?to say|slammed the door|stormed out|storms out|hung up(?: on(?: him| her| me)?| the phone)?|hangs up|walked away(?: without (?:him|her))?|turned (?:and )?away|covered (?:his|her) ears|don(?:'t|ot) want to see you|get out|leave me alone)\b/i;
const MIS_EN = /\b(?:misunderstand(?:ing|s|s tood)?|mistaken(?:ly| about)?|got the wrong idea|wrong (?:idea|about (?:him|her|it)))\b/i;
const RESOLVE_EN = /\b(?:it was (?:all )?a (?:big |huge )?misunderstanding|the misunderstanding (?:was |got )?(?:cleared up|resolved|sorted out)|realized (?:he|she|they) (?:was|were) wrong|he had it wrong(?: all along)?|wrong about (?:him|her) (?:all along|after all)|the truth (?:finally )?came out|truth was (?:finally )?revealed|(?:footage|recording|evidence) proved(?: his| her)? (?:innocence|the truth)|finally believed (?:him|her))\b/i;
const SILENCE_EN = /\b(?:swallowed (?:his|her|the) words|bit (?:his|her) tongue|held (?:his|her) tongue|stopped (?:him|her)self(?: from saying)?|almost said (?:it|the truth)|couldn(?:'t|ot) bring (?:him|her)self to tell|couldn(?:'t|ot) tell (?:him|her)(?: the truth)?|had to keep it (?:a )?secret|opened (?:his|her) mouth but said nothing|held back the truth)\b/i;
const HALF_EN = /\b(?:only heard (?:half(?: of it)?|the last part)|heard (?:just )?half(?: of it| the argument)?|caught the tail end|eavesdropped(?: at the door)?|overheard(?: only)?(?: a fragment| part of it)[^.\n]{0,40}?(?:left|walked away|ran off|concluded))\b/i;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface SplitScene { header: string; lines: string[] }

function splitScenes(text: string, isZh: boolean): SplitScene[] {
  const raw = text.split(/\r?\n/);
  const scenes: SplitScene[] = [];
  let cur: SplitScene = { header: isZh ? '开场' : 'Opening', lines: [] };
  for (const line of raw) {
    const t = line.trim();
    if (t && isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      if (cur.lines.length || cur.header !== (isZh ? '开场' : 'Opening')) scenes.push(cur);
      cur = { header: t.slice(0, 30), lines: [] };
    } else if (t) {
      cur.lines.push(t);
    }
  }
  scenes.push(cur);
  return scenes;
}

/**
 * 误会拖延检测
 * @param text 剧本全文
 * @param lang zh | en
 */
export function misunderstandingDragCheck(text: string, lang: MdLang = 'zh'): MisunderstandingDragResult {
  const isZh = lang !== 'en';
  const empty: MisunderstandingDragResult = {
    score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
    refusalCount: 0, repeatCount: 0, forcedSilenceCount: 0, halfTruthCount: 0,
    resolvedCount: 0, scenes: [], issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const scenes = splitScenes(text, isZh);
  if (!scenes.length) return empty;

  const EXPLAIN = isZh ? EXPLAIN_ZH : EXPLAIN_EN;
  const REFUSE = isZh ? REFUSE_ZH : REFUSE_EN;
  const MIS = isZh ? MIS_ZH : MIS_EN;
  const RESOLVE = isZh ? RESOLVE_ZH : RESOLVE_EN;
  const SILENCE = isZh ? SILENCE_ZH : SILENCE_EN;
  const HALF = isZh ? HALF_ZH : HALF_EN;

  const issues: MisunderstandingIssue[] = [];
  const sceneFlags = new Map<number, number>();
  const flag = (scene: number) => sceneFlags.set(scene, (sceneFlags.get(scene) ?? 0) + 1);

  let signalCount = 0;
  let resolvedCount = 0;
  let forcedSilenceCount = 0;
  let firstSilenceScene = 0;
  let firstSilenceLine = '';
  const misScenes: number[] = [];
  const resolveScenes = new Set<number>();
  interface RefusalEvent { scene: number; line: string }
  const refusalEvents: RefusalEvent[] = [];

  // —— 逐场提取信号 ——
  scenes.forEach((sc, si) => {
    const sceneIdx = si + 1;
    const explainIdx: number[] = [];
    const refuseIdx: number[] = [];
    let sceneMis = false;
    let sceneResolve = false;
    sc.lines.forEach((line, li) => {
      if (EXPLAIN.test(line)) { explainIdx.push(li); signalCount++; }
      if (REFUSE.test(line)) { refuseIdx.push(li); signalCount++; }
      if (MIS.test(line)) { sceneMis = true; signalCount++; }
      if (RESOLVE.test(line)) { sceneResolve = true; signalCount++; }
      if (SILENCE.test(line)) {
        forcedSilenceCount++;
        signalCount++;
        if (!firstSilenceScene) { firstSilenceScene = sceneIdx; firstSilenceLine = line; }
      }
      if (HALF.test(line)) signalCount++;
    });
    if (sceneMis) misScenes.push(sceneIdx);
    if (sceneResolve) resolveScenes.add(sceneIdx);

    // 解释请求后 3 行窗口内出现拒绝 → 一次拒绝沟通（每场最多计 2 次，避免台词乒乓刷屏）
    let paired = 0;
    for (const e of explainIdx) {
      if (paired >= 2) break;
      if (refuseIdx.some((r) => r > e && r <= e + 3)) {
        refusalEvents.push({ scene: sceneIdx, line: sc.lines[refuseIdx.find((r) => r > e && r <= e + 3)!] });
        paired++;
      }
    }
  });

  // —— ① 拒绝沟通：当场或下一场即澄清视为快速解开，不罚 ——
  for (const ev of refusalEvents) {
    const bridged = resolveScenes.has(ev.scene) || resolveScenes.has(ev.scene + 1);
    if (bridged) {
      resolvedCount++;
      continue;
    }
    const prior = issues.filter((i) => i.type === 'refusal_to_listen').length;
    issues.push({
      severity: prior >= 1 ? 'high' : 'mid',
      type: 'refusal_to_listen', key: 'refusal', scene: ev.scene,
      evidence: isZh ? `第${ev.scene}场：${ev.line.slice(0, 34)}` : `Scene ${ev.scene}: ${ev.line.slice(0, 60)}`,
      advice: isZh
        ? '一方要求解释，另一方拒听离场——冲突靠"按头误会"硬撑。让对方至少听完一句关键信息（再用新阻碍打断），或给出拒听的具体来由（前科、实锤在手），不要只会"我不听"。'
        : 'One character demands to explain and the other refuses to listen and leaves. Let at least one key fact land before a new obstacle interrupts, or ground the refusal in a concrete reason (past betrayal, hard evidence).',
    });
    flag(ev.scene);
  }

  // —— ② 误会反复：首场澄清之前，误会词根存活 ≥3 场 ——
  const firstResolve = resolveScenes.size ? Math.min(...resolveScenes) : Infinity;
  const aliveMisScenes = misScenes.filter((s) => s < firstResolve);
  if (aliveMisScenes.length >= 3) {
    issues.push({
      severity: 'mid', type: 'misunderstanding_repeat', key: 'misunderstanding', scene: aliveMisScenes[aliveMisScenes.length - 1],
      evidence: isZh
        ? `第${aliveMisScenes.join('、')}场反复提及误会，直到第${aliveMisScenes[aliveMisScenes.length - 1]}场仍未澄清`
        : `Misunderstanding persists across scenes ${aliveMisScenes.join(', ')} with no clarification`,
      advice: isZh
        ? `同一个误会拖了${aliveMisScenes.length}场不解。要么安排一次信息交换把误会坐实成"真冲突"（双方立场确实对立），要么用证据/第三方当场解开，别让角色反复说"你误会了"却什么都不推进。`
        : `The same misunderstanding drags across ${aliveMisScenes.length} scenes. Either turn it into a real conflict of interests through an information exchange, or clear it on screen with evidence or a third party.`,
    });
    flag(aliveMisScenes[aliveMisScenes.length - 1]);
  }

  // —— ③ 有嘴不说：咽话/刻意隐瞒 ≥2 次 ——
  if (forcedSilenceCount >= 2 && firstSilenceScene) {
    issues.push({
      severity: 'low', type: 'forced_silence', key: 'silence', scene: firstSilenceScene,
      evidence: isZh
        ? `第${firstSilenceScene}场：${firstSilenceLine.slice(0, 34)}（全片共${forcedSilenceCount}次欲言又止）`
        : `Scene ${firstSilenceScene}: ${firstSilenceLine.slice(0, 60)} (${forcedSilenceCount} swallowed-truth beats)`,
      advice: isZh
        ? `人物${forcedSilenceCount}次"话到嘴边又咽回去"。给沉默一个真实代价或理由（说出口会立刻伤人/被威胁封口），并让沉默者改用行动补救；反复用沉默吊误会，观众会觉得角色被编剧缝了嘴。`
        : `The truth is swallowed ${forcedSilenceCount} times. Give the silence a real cost or reason (speaking hurts someone immediately, a threat enforces it) and let the character compensate through action instead.`,
    });
    flag(firstSilenceScene);
  }

  // —— ④ 偷听半句话定罪 ——
  const halfIssues: { scene: number; line: string }[] = [];
  scenes.forEach((sc, si) => {
    for (const line of sc.lines) {
      if (halfIssues.length >= 2) return;
      if (HALF.test(line)) halfIssues.push({ scene: si + 1, line });
    }
  });
  for (const h of halfIssues) {
    issues.push({
      severity: 'low', type: 'half_truth_conviction', key: 'eavesdrop', scene: h.scene,
      evidence: isZh ? `第${h.scene}场：${h.line.slice(0, 34)}` : `Scene ${h.scene}: ${h.line.slice(0, 60)}`,
      advice: isZh
        ? '角色只听到半句话就当场定罪离开。至少补一个"为什么此刻不能问"的推力（对方正与共犯同行/孩子在场），或让他听完后选择求证而非直接判死刑。'
        : 'A character hears only half a sentence and convicts on the spot. Add a reason they cannot ask now (accomplice present, a child in the room), or have them seek proof instead of storming off.',
    });
    flag(h.scene);
  }

  // —— 汇总打分 ——
  const refusalCount = issues.filter((i) => i.type === 'refusal_to_listen').length;
  const repeatCount = issues.filter((i) => i.type === 'misunderstanding_repeat').length;
  const halfTruthCount = halfIssues.length;
  const issueCount = issues.length;

  let penalty = 0;
  penalty += Math.min(refusalCount * 14, 28);
  penalty += Math.min(repeatCount * 11, 11);
  if (forcedSilenceCount >= 2) penalty += 7;
  penalty += Math.min(halfTruthCount * 6, 12);
  const bonus = Math.min(resolvedCount * 2, 6);

  issues.sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity] || a.scene - b.scene;
  });

  const sceneReports: MisunderstandingSceneReport[] = scenes.map((s, i) => ({
    index: i + 1,
    header: s.header,
    contradictionCount: sceneFlags.get(i + 1) ?? 0,
  }));

  return {
    score: clamp(100 - penalty + bonus, 0, 100),
    sceneCount: scenes.length,
    signalCount,
    issueCount,
    refusalCount,
    repeatCount,
    forcedSilenceCount,
    halfTruthCount,
    resolvedCount,
    scenes: sceneReports,
    issues,
  };
}
