/**
 * v2.80 生成侧跨集连续性简报（Continuity Brief）——台账进提示词，修复"检测与生成脱节"
 * ------------------------------------------------------------------
 * 缺口：prevForeshadow/prevArc（v2.108）与 prevSecrets/prevStates（v2.80）此前只在
 * 成稿后 QC 重算点被消费，生成侧（架构师/撰写师）从未见过这些跨集状态——
 * 检测发现了悬空秘密/未桥接状态，生成时却无人告知，只能事后挨罚。
 * 本引擎在【生成前】把台账状态转成岗位可执行的连续性指令：
 *   secret     未揭示秘密 → 本集必须推进（当众揭穿 / 差一点揭穿的擦肩钩子），不许无声消失
 *   revealed   已揭穿主题 → 不得再按"瞒着"写（防揭示失忆，直接写揭穿后清算）
 *   state      未桥接人物状态 → 必须交代去向或有意维持，不得凭空消失
 *   foreshadow 前集伏笔未回收 → 本集回收或显式推进
 *   arc        前集角色弧光（仅危机/转变/绝望/愤怒等高危角色）→ 情绪/阶段/关系延续，禁跳变
 * 纯函数、零 IO、可离线对拍；中英双语，英文层零中文（由测试守护）。
 * 注意：en 模式下输入的 topic 需来自 en 词表（生成管线 en 模式的台账本就如此）。
 */
import type { ForeshadowItem } from './foreshadow-ledger';
import type { CharacterArc, EmotionState, ArcStage } from './arc-tracker';
import type { SecretLedgerResult } from './secret-ledger';
import { CHAR_STATE_META, type CharacterStateLedgerResult, type CharStateId } from './character-state-ledger';

export interface ContinuityBriefInput {
  /** 正在生成的集号（1 基）；缺省/偏小时按各台账 epNo+1 自愈 */
  curEpNo?: number | null;
  prevSecrets?: SecretLedgerResult['nextState'] | null;
  prevStates?: CharacterStateLedgerResult['nextState'] | null;
  prevForeshadow?: { plants: ForeshadowItem[]; payoffs: ForeshadowItem[]; epNo: number } | null;
  prevArc?: { characters: CharacterArc[]; epNo: number } | null;
  /** v2.80 前集结尾原句（最后一段，≤400 字）：跨集焊点——下一集开场必须从此瞬间接起 */
  prevEnding?: string | null;
}

export type ContinuityItemKind = 'secret' | 'revealed' | 'state' | 'foreshadow' | 'arc';
export interface ContinuityItem {
  kind: ContinuityItemKind;
  priority: 'high' | 'mid';
  zh: string;
  en: string;
}
export interface ContinuityBriefResult {
  curEpNo: number;
  items: ContinuityItem[];
  /** 拼接就绪的完整指令（无内容时为 ''），pipeline 按 hookLang 取层 */
  directiveZh: string;
  directiveEn: string;
  /** v2.80 前集结尾焊点块（原句按引用透传，独立于 items 指令层；无 prevEnding 时为 ''）。
   *  不并入 directive 的原因：en 层零中文由测试守护，而原句引用可能是中文正文。 */
  endingBlockZh: string;
  endingBlockEn: string;
}

const EMOTION_ZH: Record<EmotionState, string> = { anger: '愤怒', fear: '恐惧', hope: '希望', despair: '绝望', calm: '平静', joy: '喜悦', unknown: '未知' };
const STAGE_ZH: Record<ArcStage, string> = { setup: '铺垫', conflict: '冲突', crisis: '危机', transformation: '转变', resolution: '收束', unknown: '未知' };
/** 每类条目注入上限：提示词预算有限，按悬空时长/风险权重取最要紧的 */
const CAP = 3;

function arcWeight(c: CharacterArc): number {
  return (c.stage === 'crisis' || c.stage === 'transformation' ? 2 : 0) + (c.emotion === 'despair' || c.emotion === 'anger' ? 1 : 0);
}

export function continuityBrief(input: ContinuityBriefInput = {}): ContinuityBriefResult {
  const curEpNo = Math.max(
    1,
    Math.round(input.curEpNo ?? 0) || 0,
    (input.prevSecrets?.epNo ?? 0) + 1,
    (input.prevStates?.epNo ?? 0) + 1,
    (input.prevForeshadow?.epNo ?? 0) + 1,
    (input.prevArc?.epNo ?? 0) + 1,
  );
  const prevEpNo = curEpNo - 1;
  const items: ContinuityItem[] = [];

  // 1) 未揭示秘密：已揭示主题出池，其余按悬空时长降序（最老优先）
  const revealedTopics = input.prevSecrets?.revealedTopics ?? [];
  const unresolvedSecrets = (input.prevSecrets?.plants ?? [])
    .filter((p) => !revealedTopics.includes(p.topic))
    .map((p) => ({ ...p, age: Math.max(1, curEpNo - p.plantedInEp) }))
    .sort((a, b) => b.age - a.age)
    .slice(0, CAP);
  for (const s of unresolvedSecrets) {
    items.push({
      kind: 'secret', priority: s.age >= 2 ? 'high' : 'mid',
      zh: `秘密「${s.topic}」第${s.plantedInEp}集植入、已悬 ${s.age} 集未揭示——本集必须推进：当众揭穿，或写一场"差一点揭穿"的擦肩钩子；不许无声消失。`,
      en: `Secret "${s.topic}" planted ep${s.plantedInEp}, unresolved for ${s.age} ep(s) — this episode MUST advance it: stage a public reveal or a near-miss tease; never let it silently vanish.`,
    });
  }

  // 2) 已揭穿主题 → 防揭示失忆（本集不得再按"瞒着"写）
  const revealed = revealedTopics.filter(Boolean).slice(0, 5);
  if (revealed.length) {
    items.push({
      kind: 'revealed', priority: 'high',
      zh: `以下真相已当众揭穿，本集不得再按"瞒着/不能说"写，直接写揭穿后的清算与关系重排：${revealed.join('、')}。`,
      en: `These truths are already public — do NOT write them as hidden again; write post-reveal fallout instead: ${revealed.join(', ')}.`,
    });
  }

  // 3) 未桥接人物状态：同状态去重（取最早 onset），按悬空时长降序
  const resolvedStates = input.prevStates?.resolved ?? [];
  const seenStates = new Set<CharStateId>();
  const unresolvedStates = (input.prevStates?.onsets ?? [])
    .filter((o) => !resolvedStates.includes(o.state))
    .filter((o) => (seenStates.has(o.state) ? false : (seenStates.add(o.state), true)))
    .map((o) => ({ ...o, age: Math.max(1, curEpNo - o.onsetInEp) }))
    .sort((a, b) => b.age - a.age)
    .slice(0, CAP);
  for (const st of unresolvedStates) {
    items.push({
      kind: 'state', priority: st.age >= 2 ? 'high' : 'mid',
      zh: `人物状态「${CHAR_STATE_META[st.state].zh}」第${st.onsetInEp}集确立、至今未交代——本集必须桥接：给出去向/恢复，或借他人之口明确"有意维持"；不得凭空消失。`,
      en: `Character state "${CHAR_STATE_META[st.state].en}" set in ep${st.onsetInEp} is still unaddressed — bridge it this episode: show the outcome/recovery or deliberately maintain it via other characters; never let it vanish.`,
    });
  }

  // 4) 前集伏笔未回收（按 signal 判定回收）
  const paySigs = new Set((input.prevForeshadow?.payoffs ?? []).map((q) => q.signal));
  const fsEpNo = input.prevForeshadow?.epNo ?? prevEpNo;
  const unrecovered = (input.prevForeshadow?.plants ?? [])
    .filter((p) => !paySigs.has(p.signal))
    .slice(0, CAP);
  for (const f of unrecovered) {
    items.push({
      kind: 'foreshadow', priority: 'mid',
      zh: `前集伏笔"${f.signal}"（第${fsEpNo}集埋下）尚未回收——本集优先回收，或再次给镜头/被提及显式推进。`,
      en: `Foreshadow "${f.signal}" planted ep${fsEpNo} is unrecovered — pay it off or explicitly advance it (re-show it / have it mentioned) this episode.`,
    });
  }

  // 5) 角色弧光延续：只注入高危角色（危机/转变阶段或绝望/愤怒情绪），普通角色由前集摘要兜底
  const arcs = (input.prevArc?.characters ?? [])
    .filter((c) => arcWeight(c) > 0)
    .sort((a, b) => arcWeight(b) - arcWeight(a))
    .slice(0, CAP);
  for (const c of arcs) {
    const rel = (c.relations ?? []).slice(0, 3).map((r) => r.target);
    items.push({
      kind: 'arc', priority: arcWeight(c) >= 2 ? 'high' : 'mid',
      zh: `角色「${c.name}」前集处于${STAGE_ZH[c.stage]}/${EMOTION_ZH[c.emotion]}${rel.length ? `，关系对象：${rel.join('、')}` : ''}——本集情绪与关系必须从此状态延续，变化要有过程，禁跳变。`,
      en: `Character "${c.name}" left ep${input.prevArc?.epNo ?? prevEpNo} at stage "${c.stage}" / emotion "${c.emotion}"${rel.length ? `, relations with: ${rel.join(', ')}` : ''} — continue from this state; emotional shifts need process, no jump cuts.`,
    });
  }

  const directiveZh = items.length
    ? `【跨集连续性简报·本集必须兑现】（依据第${prevEpNo}集台账，检测与生成同源）\n${items.map((it) => `  - ${it.zh}`).join('\n')}\n`
    : '';
  const directiveEn = items.length
    ? `[Cross-episode continuity brief — MUST honor this episode] (from the ep${prevEpNo} ledgers)\n${items.map((it) => `  - ${it.en}`).join('\n')}\n`
    : '';
  // v2.80 前集结尾焊点：原句是正文引用（透传，可能是中文），独立于 items 指令层拼装
  const ending = (input.prevEnding ?? '').trim();
  const endingBlockZh = ending
    ? `【前集结尾·本集开场必须从此瞬间无缝接起】\n  「${ending}」\n`
    : '';
  const endingBlockEn = ending
    ? `[Previous episode's final lines — the opening MUST pick up from this exact moment]\n  "${ending}"\n`
    : '';
  return { curEpNo, items, directiveZh, directiveEn, endingBlockZh, endingBlockEn };
}
