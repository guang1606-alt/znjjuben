/**
 * 创作引擎批量重扫（c215）
 * ------------------------------------------------------------------
 * 病象：pipeline 终稿 result 产出 ~130 个引擎结果，但 /fix 一键改写后只重算
 * cliffhanger/arcTrack/sceneSoftEnding/showDontTell/structuralRescan(32键)/
 * villainStall/teamBriefing/deadlineStretch/openingWeld；其余 ~96 个纯函数创作引擎
 * （v2.80 对白/叙事家族 + v2.81-v2.133 阀门家族）在 /fix 后仍挂 v1 旧值——
 * 改写修好了问题，质检面板仍挂旧账。
 *
 * 本模块供 /fix 在无 pipeline 上下文时对新正文纯函数重跑这批引擎（零 LLM、零外部依赖），
 * 统一走 buildQcEngineDigest（路径 A hits 形态 / 路径 B issues 形态自动识别），
 * 产出与 generate.ts 落库 qcReport 兼容的 digest，供 /fix 落库直接展开覆盖。
 * 键名与 pipeline result 键名逐一对齐（如 actionEcho/eavesdropDump/selfPity/
 * villainConfession/fightReconcile/talkDown 等非同名键）。
 *
 * 不含（避免重复，勿加回）：
 * - structural-rescan.ts 已覆盖的 32 个结构引擎（coolMoment/dialogueWater/…/characterBalance）；
 * - cliffhanger/arcTrack/sceneSoftEnding/showDontTell/villainStall/teamBriefing/
 *   deadlineStretch/openingWeld（/fix 块 c214 单独重算）。
 *
 * 覆盖语义（与 structuralRescan 同）：/fix 必须用"健康"清掉 v1 残留，所以 digest 不出键的
 * 健康引擎要显式写健康壳——hits 形态写 {score, hits:[]}，issues 形态写 {score, issueCount:0,
 * issues:[]}；壳形态按 raw 结果里存在的数组字段判定。非健康但 digest 不出键（如 issues 元素
 * 缺标识字段被 shaped 滤空）属契约外形态，不写壳、保留旧值（保守不谎报健康）。
 *
 * 纪律：逐引擎 try/catch，单引擎异常只跳过该键（保留旧值，不用空壳覆盖，异常 ≠ 健康），
 * 绝不因质检附加逻辑阻断付费交付（与 structuralRescan/freshArc/freshSoft 同纪律）。
 */
import type { CastMap } from './character-logic';
import { buildQcEngineDigest } from './qc-digest';
import { detectRescanLang } from './structural-rescan';
import { voicePrint } from './voice-print';
import { dialogueAiTaste } from './dialogue-ai-taste';
import { sceneEmotionFlat } from './scene-emotion-flat';
import { sensoryDetail } from './sensory-detail';
import { vagueWord } from './vague-word';
import { dialogueNameCall } from './dialogue-name-call';
import { dialoguePingpong } from './dialogue-pingpong';
import { hollowAction } from './hollow-action';
import { emotionWhiplash } from './emotion-whiplash';
import { echoDialogue } from './echo-dialogue';
import { expositionDialogue } from './exposition-dialogue';
import { emotionLabelDialogue } from './emotion-label-dialogue';
import { roundRobinDialogue } from './round-robin-dialogue';
import { rhetoricalBarrage } from './rhetorical-barrage';
import { mirrorVisualDialogue } from './mirror-visual-dialogue';
import { mindReadingNarration } from './mind-reading-narration';
import { crowdReaction } from './crowd-reaction';
import { patheticFallacy } from './pathetic-fallacy';
import { omniscientTease } from './omniscient-tease';
import { effortGloss } from './effort-gloss';
import { reactionCliche } from './reaction-cliche';
import { infoDelivery } from './info-delivery';
import { atmosphereTell } from './atmosphere-tell';
import { confrontationDodge } from './confrontation-dodge';
import { selfIntroDump } from './self-intro-dump';
import { moralNarration } from './moral-narration';
import { emptyThreat } from './empty-threat';
import { timeJumpPayoff } from './time-jump-payoff';
import { emotionPropCrutch } from './emotion-prop-crutch';
import { emotionVentCliche } from './emotion-vent-cliche';
import { actionEchoDialogue } from './action-echo-dialogue';
import { eavesdropDump } from './eavesdrop-dump';
import { selfPityLitany } from './self-pity-litany';
import { villainOverconfession } from './villain-overconfession';
import { cheapForgiveness } from './cheap-forgiveness';
import { witnessGratuity } from './witness-gratuity';
import { previewVoiceover } from './preview-voiceover';
import { stanceFlip } from './stance-flip';
import { unplantedAsset } from './unplanted-asset';
import { subtextErase } from './subtext-erase';
import { exitCliche } from './exit-cliche';
import { phoneRelay } from './phone-relay';
import { fakeChoice } from './fake-choice';
import { parenOverdirect } from './paren-overdirect';
import { abstractAccusation } from './abstract-accusation';
import { cheapEmpathy } from './cheap-empathy';
import { fidgetProp } from './fidget-prop';
import { emptyVow } from './empty-vow';
import { apologyLoop } from './apology-loop';
import { flashbackCrutch } from './flashback-crutch';
import { accidentalSpark } from './accidental-spark';
import { commFailCrutch } from './comm-fail-crutch';
import { drunkTruth } from './drunk-truth';
import { tearBait } from './tear-bait';
import { instantDeduction } from './instant-deduction';
import { recordsOnDemand } from './records-on-demand';
import { walkInTiming } from './walk-in-timing';
import { helpOnDemand } from './help-on-demand';
import { delayedReveal } from './delayed-reveal';
import { instantTrust } from './instant-trust';
import { instantKinship } from './instant-kinship';
import { faintOnCue } from './faint-on-cue';
import { alwaysLate } from './always-late';
import { instantLove } from './instant-love';
import { convenientEncounter } from './convenient-encounter';
import { forcedProximity } from './forced-proximity';
import { rescueRomance } from './rescue-romance';
import { fightReconcileCrutch } from './fight-reconcile-crutch';
import { instantRepentance } from './instant-repentance';
import { talkDownCrutch } from './talk-down-crutch';
import { instantSurgery } from './instant-surgery';
import { crowdFlip } from './crowd-flip';
import { instantHack } from './instant-hack';
import { instantMarksman } from './instant-marksman';
import { instantLanguage } from './instant-language';
import { wakeUpCall } from './wake-up-call';
import { wakeOnCue } from './wake-on-cue';
import { woundOnCue } from './wound-on-cue';
import { fatigueOverdrive } from './fatigue-overdrive';
import { instantEscape } from './instant-escape';
import { weaponJam } from './weapon-jam';
import { evidenceBlank } from './evidence-blank';
import { propMotifRhythm } from './prop-motif-rhythm';
import { childBlurt } from './child-blurt';
import { rumorSpeed } from './rumor-speed';
import { resultsOnCue } from './results-on-cue';
import { trafficOnCue } from './traffic-on-cue';
import { vehicleJam } from './vehicle-jam';
import { sleepTalk } from './sleep-talk';
import { feverTruth } from './fever-truth';
import { instantEndowment } from './instant-endowment';
import { lastSecondRescue } from './last-second-rescue';
import { softInterrogation } from './soft-interrogation';
import { deathbedConfession } from './deathbed-confession';
import { truthSerum } from './truth-serum';
import { pregnancyOnCue } from './pregnancy-on-cue';
import { amnesiaOnCue } from './amnesia-on-cue';
import { terminalDiagnosisOnCue } from './terminal-diagnosis-on-cue';
import { allergyOnCue } from './allergy-on-cue';
import { blindnessOnCue } from './blindness-on-cue';
import { poisonOnCue } from './poison-on-cue';
import { muteOnCue } from './mute-on-cue';
import { deafOnCue } from './deaf-on-cue';
import { paralysisOnCue } from './paralysis-on-cue';

type Runner = (text: string) => unknown;

// 94 键纯 draft 引擎：result 键名 → runner。键名与 pipeline result 字面量对齐（含非同名片段），
// 顺序与 pipeline result 对齐，便于人工核对。
const RUNNERS: Array<[key: string, fn: Runner]> = [
  // v2.80 对白/叙事家族
  ['dialogueAiTaste', (t) => dialogueAiTaste(t)],
  ['sceneEmotionFlat', (t) => sceneEmotionFlat(t)],
  ['sensoryDetail', (t) => sensoryDetail(t)],
  ['vagueWord', (t) => vagueWord(t)],
  ['dialoguePingpong', (t) => dialoguePingpong(t)],
  ['hollowAction', (t) => hollowAction(t)],
  ['emotionWhiplash', (t) => emotionWhiplash(t)],
  ['echoDialogue', (t) => echoDialogue(t)],
  ['expositionDialogue', (t) => expositionDialogue(t)],
  ['emotionLabelDialogue', (t) => emotionLabelDialogue(t)],
  ['roundRobinDialogue', (t) => roundRobinDialogue(t)],
  ['rhetoricalBarrage', (t) => rhetoricalBarrage(t)],
  ['mirrorVisualDialogue', (t) => mirrorVisualDialogue(t)],
  ['mindReadingNarration', (t) => mindReadingNarration(t)],
  ['crowdReaction', (t) => crowdReaction(t)],
  ['patheticFallacy', (t) => patheticFallacy(t)],
  ['omniscientTease', (t) => omniscientTease(t)],
  ['effortGloss', (t) => effortGloss(t)],
  ['reactionCliche', (t) => reactionCliche(t)],
  ['infoDelivery', (t) => infoDelivery(t)],
  ['atmosphereTell', (t) => atmosphereTell(t)],
  ['confrontationDodge', (t) => confrontationDodge(t)],
  ['selfIntroDump', (t) => selfIntroDump(t)],
  ['moralNarration', (t) => moralNarration(t)],
  ['emptyThreat', (t) => emptyThreat(t)],
  ['timeJumpPayoff', (t) => timeJumpPayoff(t)],
  ['emotionPropCrutch', (t) => emotionPropCrutch(t)],
  ['emotionVentCliche', (t) => emotionVentCliche(t)],
  ['actionEcho', (t) => actionEchoDialogue(t)],
  ['eavesdropDump', (t) => eavesdropDump(t)],
  ['selfPity', (t) => selfPityLitany(t)],
  ['villainConfession', (t) => villainOverconfession(t)],
  ['cheapForgiveness', (t) => cheapForgiveness(t)],
  ['witnessGratuity', (t) => witnessGratuity(t)],
  ['previewVoiceover', (t) => previewVoiceover(t)],
  ['stanceFlip', (t) => stanceFlip(t)],
  ['unplantedAsset', (t) => unplantedAsset(t)],
  ['subtextErase', (t) => subtextErase(t)],
  ['exitCliche', (t) => exitCliche(t)],
  ['phoneRelay', (t) => phoneRelay(t)],
  ['fakeChoice', (t) => fakeChoice(t)],
  ['parenOverdirect', (t) => parenOverdirect(t)],
  ['abstractAccusation', (t) => abstractAccusation(t)],
  ['cheapEmpathy', (t) => cheapEmpathy(t)],
  ['fidgetProp', (t) => fidgetProp(t)],
  ['emptyVow', (t) => emptyVow(t)],
  ['flashbackCrutch', (t) => flashbackCrutch(t)],
  ['accidentalSpark', (t) => accidentalSpark(t)],
  ['commFailCrutch', (t) => commFailCrutch(t)],
  ['drunkTruth', (t) => drunkTruth(t)],
  ['tearBait', (t) => tearBait(t)],
  ['instantDeduction', (t) => instantDeduction(t)],
  ['recordsOnDemand', (t) => recordsOnDemand(t)],
  // v2.81-v2.99 阀门家族
  ['walkInTiming', (t) => walkInTiming(t)],
  ['helpOnDemand', (t) => helpOnDemand(t)],
  ['delayedReveal', (t) => delayedReveal(t)],
  ['instantTrust', (t) => instantTrust(t)],
  ['instantKinship', (t) => instantKinship(t)],
  ['faintOnCue', (t) => faintOnCue(t)],
  ['alwaysLate', (t) => alwaysLate(t)],
  ['instantLove', (t) => instantLove(t)],
  ['convenientEncounter', (t) => convenientEncounter(t)],
  ['instantHack', (t) => instantHack(t)],
  ['instantMarksman', (t) => instantMarksman(t)],
  ['instantLanguage', (t) => instantLanguage(t)],
  ['wakeUpCall', (t) => wakeUpCall(t)],
  ['wakeOnCue', (t) => wakeOnCue(t)],
  ['woundOnCue', (t) => woundOnCue(t)],
  ['instantEscape', (t) => instantEscape(t)],
  ['weaponJam', (t) => weaponJam(t)],
  ['evidenceBlank', (t) => evidenceBlank(t)],
  ['childBlurt', (t) => childBlurt(t)],
  ['rumorSpeed', (t) => rumorSpeed(t)],
  ['resultsOnCue', (t) => resultsOnCue(t)],
  ['trafficOnCue', (t) => trafficOnCue(t)],
  ['vehicleJam', (t) => vehicleJam(t)],
  ['sleepTalk', (t) => sleepTalk(t)],
  ['feverTruth', (t) => feverTruth(t)],
  ['instantEndowment', (t) => instantEndowment(t)],
  ['lastSecondRescue', (t) => lastSecondRescue(t)],
  // v2.101-v2.133 阀门/节奏家族
  ['softInterrogation', (t) => softInterrogation(t)],
  ['deathbedConfession', (t) => deathbedConfession(t)],
  ['truthSerum', (t) => truthSerum(t)],
  ['pregnancyOnCue', (t) => pregnancyOnCue(t)],
  ['amnesiaOnCue', (t) => amnesiaOnCue(t)],
  ['terminalDiagnosisOnCue', (t) => terminalDiagnosisOnCue(t)],
  ['allergyOnCue', (t) => allergyOnCue(t)],
  ['blindnessOnCue', (t) => blindnessOnCue(t)],
  ['poisonOnCue', (t) => poisonOnCue(t)],
  ['muteOnCue', (t) => muteOnCue(t)],
  ['deafOnCue', (t) => deafOnCue(t)],
  ['paralysisOnCue', (t) => paralysisOnCue(t)],
  ['fatigueOverdrive', (t) => fatigueOverdrive(t)],
  ['apologyLoop', (t) => apologyLoop(t)],
  ['forcedProximity', (t) => forcedProximity(t)],
  ['rescueRomance', (t) => rescueRomance(t)],
  ['fightReconcile', (t) => fightReconcileCrutch(t)],
  ['instantRepentance', (t) => instantRepentance(t)],
  ['talkDown', (t) => talkDownCrutch(t)],
  ['instantSurgery', (t) => instantSurgery(t)],
  ['crowdFlip', (t) => crowdFlip(t)],
  ['propMotifRhythm', (t) => propMotifRhythm(t)],
];

/**
 * 对改写后正文批量重跑纯函数创作引擎，产出与 buildQcEngineDigest（路径 A/B）兼容的 digest，
 * 供 /fix 落库直接展开覆盖 qcReport 对应键。逐引擎 try/catch：单引擎异常只跳过该键
 * （保留旧值），绝不因质检附加逻辑阻断付费交付。
 * @param text 改写后的新正文
 * @param castNames 角色名表；为空时跳过 voicePrint/dialogueNameCall 两个需 cast 引擎
 *   （characterBalance 已由 structuralRescan 32 键覆盖，不在此重跑）
 */
export function batchCreativeDigest(text: string, castNames?: string[]): Record<string, unknown> {
  if (!text || !text.trim()) return {};
  const raw: Record<string, unknown> = {};
  for (const [key, fn] of RUNNERS) {
    try {
      raw[key] = fn(text);
    } catch {
      // 单引擎异常：跳过该键，保留旧值（异常 ≠ 健康）
    }
  }
  const names = (castNames ?? []).filter((n): n is string => typeof n === 'string' && !!n.trim());
  if (names.length) {
    const lang = detectRescanLang(text);
    // 与 structuralRescan 同纪律：/fix 场景只有名字，空 profile 即可
    const castMap: CastMap = Object.fromEntries(names.map((n) => [n, {}]));
    try {
      raw.voicePrint = voicePrint(castMap, text, lang);
    } catch {
      // 同上：异常跳过
    }
    try {
      raw.dialogueNameCall = dialogueNameCall(text, names);
    } catch {
      // 同上：异常跳过
    }
  }
  const digest = buildQcEngineDigest(raw);
  // 覆盖语义：digest 不出键的健康引擎显式写健康壳清旧账。
  // 壳形态按 raw 里存在的数组字段判定（hits 形态 / issues 形态），与 c214 freshHitsEngines 同纪律。
  for (const [key, r] of Object.entries(raw)) {
    if (digest[key]) continue; // 非健康（或恰好空 hits 但路径 A 已收）——digest 已覆盖
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.score !== 'number' || !Number.isFinite(o.score)) continue; // 无分契约外，不碰
    const score = Math.max(0, Math.min(100, Math.round(o.score)));
    if (Array.isArray(o.hits)) {
      if (o.hits.length > 0) continue; // 有 hits 却没过 digest = 形态异常，保守保留旧值
      digest[key] = {
        score,
        hits: [],
        ...(typeof o.unrescuedCount === 'number' ? { unrescuedCount: 0 } : {}),
      };
    } else if (Array.isArray(o.issues)) {
      if (o.issues.length > 0) continue; // 有 issues 却没过 shaped = 契约外形态，不谎报健康
      digest[key] = { score, issueCount: 0, issues: [] };
    }
    // 其他形态（无 hits/issues 数组）：不是 digest 契约族，跳过
  }
  return digest;
}
