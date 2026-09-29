/**
 * v2.80 人物状态跨集台账引擎（Character State Ledger）
 * ------------------------------------------------------------------
 * 与既有引擎的分工：
 *  - continuity-supervision-check（v2.139）：单本内镜头间物理状态（受伤/毁物/设备/束缚）
 *  - arc-tracker：人物情绪弧光推进
 *  - 本引擎（v2.80）：跨集"大状态"场记——怀孕/坐牢/破产/昏迷/失忆/生死不明
 *    这类状态一立就是几集的戏，凭空消失/凭空恢复是观众一眼看穿的穿帮。
 *
 * 三类判定：
 *  1) state_unresolved        状态悬空：前集立起、至今无桥接交代（生下/出狱/苏醒/恢复记忆…）
 *     —— 1 集 low 提醒；≥2 集 mid；≥4 集 high（生死不明只到 mid，诈死是短剧合法套路）
 *  2) bridge_without_onset    凭空恢复：出现"出狱/苏醒/东山再起"但从无 onset 交代（空回收）
 *  3) 正信号：onset→bridge 闭环不扣分
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：状态锚点正则 × 桥接正则；
 * 跨集状态由调用方累积传递（prevLedger 模式），引擎返回 nextState 供持久化。
 * 中英双语：中文层为单一事实源，英文层零中文（由测试守护）。
 */

export type CslLang = 'zh' | 'en';

export type CharStateId = 'pregnant' | 'jailed' | 'bankrupt' | 'coma' | 'memory_loss' | 'presumed_dead';

export const CHAR_STATE_META: Record<CharStateId, { zh: string; en: string }> = {
  pregnant: { zh: '怀孕', en: 'pregnancy' },
  jailed: { zh: '入狱', en: 'imprisonment' },
  bankrupt: { zh: '破产', en: 'bankruptcy' },
  coma: { zh: '昏迷', en: 'coma' },
  memory_loss: { zh: '失忆', en: 'memory loss' },
  presumed_dead: { zh: '生死不明', en: 'presumed dead' },
};

export interface StateEvent {
  state: CharStateId;
  /** onset=状态立起 / bridge=合法桥接交代 */
  kind: 'onset' | 'bridge';
  signal: string;
  lineNo: number;
  snippet: string;
}

export interface CslIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'state_unresolved' | 'bridge_without_onset';
  evidence: string;
  advice: string;
}

export interface CharacterStateLedgerResult {
  onsets: StateEvent[];
  bridges: StateEvent[];
  /** 跨集仍未桥接的状态 */
  unresolved: { state: CharStateId; stateLabel: string; labelEn: string; onsetInEp: number; ageEp: number; snippet: string }[];
  score: number;
  issues: CslIssue[];
  /** 累积状态（调用方持久化，下一集作 prev 传入） */
  nextState: {
    onsets: { state: CharStateId; onsetInEp: number; snippet: string }[];
    resolved: CharStateId[];
    epNo: number;
  };
}

// —— 中文 onset / bridge 正则（多字短语，防误伤） ——
const ONSET_ZH: Partial<Record<CharStateId, RegExp[]>> = {
  pregnant: [/(怀孕|有了身孕|身孕已|双杠|孕吐|怀了(?:他的|她的)?(?:孩子|骨肉))/g],
  jailed: [/(被捕|被抓走|被抓进|入狱|坐牢|进了监狱|被拘留|收监|锒铛入狱)/g],
  bankrupt: [/(破产|身无分文|倾家荡产|公司倒闭|一无所有)/g],
  coma: [/(昏迷不醒|陷入昏迷|深度昏迷|成了植物人|成了植物状态|休克)/g],
  memory_loss: [/(失忆|记忆全失|什么都不记得了|不记得自己是谁)/g],
  presumed_dead: [/(坠崖|跳海|葬身火海|葬身大海|坠机|宣布死亡|生死不明|下落不明)/g],
};
const BRIDGE_ZH: Partial<Record<CharStateId, RegExp[]>> = {
  pregnant: [/(生下|顺产|剖腹产|剖腹|生产了|流产|堕胎|孩子出生|孩子平安出生|产后)/g],
  jailed: [/(出狱|刑满释放|无罪释放|取保候审|保释出狱|越狱)/g],
  bankrupt: [/(东山再起|翻本|融资成功|还清了|还清债务|生意回春|公司重组)/g],
  coma: [/(苏醒|醒了过来|睁开了?双眼|睁开了?眼睛|脱离生命危险|脱离危险)/g],
  memory_loss: [/(恢复记忆|记忆恢复|想起了一切|想起了全部|记忆回来了|记忆逐渐恢复)/g],
  presumed_dead: [/(获救|被救起|被救了|诈死|假死|幸存|死里逃生|大难不死|根本没死)/g],
};

// —— 英文层（零中文） ——
const ONSET_EN: Partial<Record<CharStateId, RegExp[]>> = {
  pregnant: [/\bis pregnant\b/gi, /\bgot pregnant\b/gi, /\bexpecting a baby\b/gi, /\bmorning sickness\b/gi],
  jailed: [/\barrested\b/gi, /\bwent to prison\b/gi, /\bsent to jail\b/gi, /\bin jail\b/gi, /\bbehind bars\b/gi],
  bankrupt: [/\bbankrupt\b/gi, /\bstone broke\b/gi, /\bwent under\b/gi, /\blost everything\b/gi],
  coma: [/\bin a coma\b/gi, /\bfell into a coma\b/gi, /\bvegetative state\b/gi],
  memory_loss: [/\bamnesia\b/gi, /\blost (?:her|his|their) memory\b/gi, /\bremembers nothing\b/gi],
  presumed_dead: [/\bfell off a cliff\b/gi, /\bfell into the sea\b/gi, /\bpresumed dead\b/gi, /\bno trace of (?:her|him|them)\b/gi, /\bdeclared dead\b/gi],
};
const BRIDGE_EN: Partial<Record<CharStateId, RegExp[]>> = {
  pregnant: [/\bgave birth\b/gi, /\bthe baby (?:was born|is born)\b/gi, /\bmiscarri(?:ed|age)\b/gi, /\baborted\b/gi],
  jailed: [/\breleased from prison\b/gi, /\bout of jail\b/gi, /\bparole\b/gi, /\bbailed out\b/gi, /\bexonerated\b/gi, /\bescaped from prison\b/gi],
  bankrupt: [/\bmade a comeback\b/gi, /\bwon it back\b/gi, /\bpaid off (?:the|his|her|their) debts?\b/gi, /\bsecured funding\b/gi],
  coma: [/\bwoke up\b/gi, /\bopened (?:her|his|their) eyes\b/gi, /\bcame out of the coma\b/gi, /\bout of danger\b/gi],
  memory_loss: [/\bmemory returned\b/gi, /\bregained (?:her|his|their) memory\b/gi, /\bremembers everything\b/gi],
  presumed_dead: [/\brescued\b/gi, /\bfaked (?:her|his|their) death\b/gi, /\balive after all\b/gi, /\bsurvived\b/gi, /\bnever died\b/gi],
};

function snippetOf(line: string, index: number): string {
  const start = Math.max(0, index - 15);
  return line.slice(start, Math.min(line.length, index + 30));
}

function scan(
  lines: string[], kind: 'onset' | 'bridge', table: Partial<Record<CharStateId, RegExp[]>>,
): StateEvent[] {
  const out: StateEvent[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [state, regs] of Object.entries(table) as [CharStateId, RegExp[]][]) {
      for (const re of regs) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (!m) continue;
        out.push({ state, kind, signal: m[0], lineNo: i + 1, snippet: snippetOf(line, m.index ?? 0) });
        break; // 每行每状态只记一次
      }
    }
  }
  return out;
}

/**
 * 扫描本集并对照前集账本，输出状态悬空/凭空恢复两检 + 累积 nextState。
 * prev 为 null 时按首集处理（epNo=1），不做跨集悬空判定。
 */
export function characterStateLedger(
  text: string,
  prev?: { onsets: { state: CharStateId; onsetInEp: number; snippet: string }[]; resolved: CharStateId[]; epNo: number } | null,
  lang: CslLang = 'zh',
): CharacterStateLedgerResult {
  const isZh = lang !== 'en';
  const lines = text.split('\n');
  const onsets = scan(lines, 'onset', isZh ? ONSET_ZH : ONSET_EN);
  const bridges = scan(lines, 'bridge', isZh ? BRIDGE_ZH : BRIDGE_EN);

  const curEp = prev ? prev.epNo + 1 : 1;
  const resolved = new Set<CharStateId>([...(prev?.resolved ?? []), ...bridges.map((b) => b.state)]);
  const bridgeThisEp = new Set(bridges.map((b) => b.state));

  // 状态悬空：前集立起、本集无桥接、主题从未 resolved
  const unresolved: CharacterStateLedgerResult['unresolved'] = [];
  for (const o of prev?.onsets ?? []) {
    if (resolved.has(o.state)) continue;
    const ageEp = curEp - o.onsetInEp;
    unresolved.push({
      state: o.state,
      stateLabel: CHAR_STATE_META[o.state].zh,
      labelEn: CHAR_STATE_META[o.state].en,
      onsetInEp: o.onsetInEp,
      ageEp,
      snippet: o.snippet,
    });
  }

  // nextState：已 resolved 的移出待收池；onset 池上限 40
  const carried = (prev?.onsets ?? []).filter((o) => !resolved.has(o.state));
  const newOnsets = onsets
    .filter((o) => !resolved.has(o.state))
    .map((o) => ({ state: o.state, onsetInEp: curEp, snippet: o.snippet }));
  const nextState = {
    onsets: [...carried, ...newOnsets].slice(0, 40),
    resolved: [...resolved],
    epNo: curEp,
  };

  // 凭空恢复：本集 bridge 但该状态从未 onset（历史 onset 池 + 本集 onset 均无）
  const everOnset = new Set<CharStateId>([
    ...(prev?.onsets ?? []).map((o) => o.state),
    ...onsets.map((o) => o.state),
  ]);
  const emptyBridges = bridges.filter((b) => !everOnset.has(b.state));

  // 评分
  const sevOf = (s: CharStateId, age: number): 'high' | 'mid' | 'low' => {
    if (s === 'presumed_dead') return age >= 4 ? 'mid' : 'low';
    if (age >= 4) return 'high';
    if (age >= 2) return 'mid';
    return 'low';
  };
  const penBySev = { high: 25, mid: 12, low: 4 } as const;
  let score = 100;
  const resolvedThisSeries = (prev?.resolved ?? []).length + bridges.length;
  for (const u of unresolved) score -= penBySev[sevOf(u.state, u.ageEp)];
  score -= Math.min(40, emptyBridges.length * 15);
  if (resolvedThisSeries > 0 && unresolved.length === 0 && emptyBridges.length === 0) score = Math.min(100, score + 5); // 闭环正信号
  score = Math.round(Math.max(0, Math.min(100, score)));

  // 问题清单
  const issues: CslIssue[] = [];
  for (const u of unresolved) {
    const sev = sevOf(u.state, u.ageEp);
    const label = isZh ? u.stateLabel : u.labelEn;
    const evidence = isZh
      ? `「${label}」自第 ${u.onsetInEp} 集立起，已 ${u.ageEp} 集未交代去向（原文："${u.snippet}"）`
      : `"${label}" established in ep${u.onsetInEp}, ${u.ageEp} episode(s) without resolution (evidence: "${u.snippet}")`;
    const bridgeZh: Record<CharStateId, string> = {
      pregnant: '生下/流产/产子等明确交代', jailed: '出狱/取保/释放等明确交代', bankrupt: '东山再起/还清债务等明确交代',
      coma: '苏醒/脱离危险等明确交代', memory_loss: '恢复记忆等明确交代', presumed_dead: '获救/诈死自曝等明确交代',
    };
    const bridgeEn: Record<CharStateId, string> = {
      pregnant: 'birth / miscarriage on screen', jailed: 'release / bail shown', bankrupt: 'comeback / debts paid shown',
      coma: 'waking up shown', memory_loss: 'memory regained shown', presumed_dead: 'rescue / faked-death self-reveal shown',
    };
    issues.push({
      severity: sev, type: 'state_unresolved', evidence,
      advice: isZh
        ? `大状态是观众的记忆锚点，凭空蒸发必被骂穿帮。要么补一场${bridgeZh[u.state]}，要么借角色台词交代（"那件事之后……"），不许装作没发生过。`
        : `Big states are audience anchors — vanishing reads as a plot hole. Add a scene with ${bridgeEn[u.state]}, or cover it in dialogue ("after that day..."); never pretend it never happened.`,
    });
  }
  if (emptyBridges.length >= 1) {
    const b = emptyBridges[0];
    const label = isZh ? CHAR_STATE_META[b.state].zh : CHAR_STATE_META[b.state].en;
    issues.push({
      severity: 'mid', type: 'bridge_without_onset',
      evidence: isZh
        ? `出现桥接"${b.signal}"（第 ${b.lineNo} 行），但从无「${label}」的 onset 交代`
        : `Bridge "${b.signal}" (line ${b.lineNo}) with no prior onset of "${label}"`,
      advice: isZh
        ? '"出狱/苏醒/恢复"前必须有对应的入狱/昏迷/失忆交代（可跨集，用一句台词补齐），否则恢复无从谈起。'
        : 'A release/waking/recovery needs its prior arrest/coma/amnesia on record (one line across episodes suffices), or the resolution hangs in the air.',
    });
  }

  return { onsets, bridges, unresolved, score, issues, nextState };
}
