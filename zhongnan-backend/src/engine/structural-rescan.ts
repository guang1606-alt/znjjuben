/**
 * 结构维度统一重扫（c212）
 * ------------------------------------------------------------------
 * 病象：v2.113-v2.147 的 32 个结构维度引擎（爽点/水分/密度/因果/目标/反派/连续性家族…）
 * 在 pipeline 终稿 result 里随 SSE 全量发送，但（1）无顶层 hits 的 25 键被 buildQcEngineDigest
 * 旧硬过滤整体排除，从不落库；（2）/fix 一键改写只重算 cliffhanger/arcTrack/软收尾/SDT 四件，
 * 结构维度永远停在 v1 旧结论——改写修好了问题，质检卡仍挂旧账。
 *
 * 本模块供 /fix 在无 pipeline 上下文时对新正文纯函数重跑 32 键（零 LLM、零外部依赖），
 * 统一产出与 qc-digest 路径 B 同构的限界形态；与批量落库不同，健康引擎也输出空壳
 * （issueCount:0/issues:[]），因为 /fix 是覆盖语义：必须能用"健康"清掉 v1 残留问题。
 *
 * 不含：
 * - openingWeld（依赖前集结尾文本，本模块无此前缀输入；/fix 整集重写会改开场，
 *   由 generate.ts /fix 块 c214 带上前集结尾单独重算覆盖，不由本模块负责）；
 * - timeline/payoffRhythm（qcReport 同名键是跨集台账，覆盖会毁台账契约）；
 * - villainStall/teamBriefing/deadlineStretch（hits 形态 + string[] issues，本模块
 *   shapeEntry 只收对象 issues，会产假健康壳；由 /fix 块 c214 走 buildQcEngineDigest
 *   路径 A 同形态覆盖）。
 */
import type { CastMap } from './character-logic';
import { coolMomentScore } from './cool-moment-score';
import { dialogueWaterCheck } from './dialogue-water-check';
import { conflictDensityCheck } from './conflict-density-check';
import { punchlineDensityScore } from './punchline-density-score';
import { sceneDensityScore } from './scene-density-score';
import { repetitionCheck } from './repetition-check';
import { characterBalanceCheck } from './character-balance-check';
import { twistDensityScore } from './twist-density-score';
import { dialogueLengthScore } from './dialogue-length-score';
import { informationDensityScore } from './information-density-score';
import { suspenseTensionCurve } from './suspense-tension-curve';
import { sceneHeaderConvention } from './scene-header-convention';
import { dialogueFunctionalityCheck } from './dialogue-functionality-check';
import { causalLogicCheck } from './causal-logic-check';
import { protagonistGoalCheck } from './protagonist-goal-check';
import { antagonistQualityCheck } from './antagonist-quality-check';
import { relationshipProgressionCheck } from './relationship-progression-check';
import { scenePaddingCheck } from './scene-padding-check';
import { supportingCharacterCheck } from './supporting-character-check';
import { conflictEscalationCheck } from './conflict-escalation-check';
import { subtextCheck } from './subtext-check';
import { supportingArcCheck } from './supporting-arc-check';
import { scenePurposeCheck } from './scene-purpose-check';
import { continuitySupervisionCheck } from './continuity-supervision-check';
import { misunderstandingDragCheck } from './misunderstanding-drag-check';
import { plotArmorCheck } from './plot-armor-check';
import { evidenceChainCheck } from './evidence-chain-check';
import { cheatRuleCheck } from './cheat-rule-check';
import { memoryFakeoutCheck } from './memory-fakeout-check';
import { emotionalAftermathCheck } from './emotional-aftermath-check';
import { locationContinuityCheck } from './location-continuity-check';
import { characterPresenceCheck } from './character-presence-check';
import {
  QC_ISSUES_LIMIT, QC_ISSUE_TYPE_MAX, QC_ISSUE_EVIDENCE_MAX, QC_ISSUE_ADVICE_MAX, QC_ISSUE_GATE_MAX,
} from './qc-digest';

export interface StructuralRescanEntry {
  score: number;
  issueCount: number;
  issues: Array<{ severity: 'high' | 'mid' | 'low'; type?: string; evidence?: string; advice?: string }>;
  gate?: string;
}

/** 与 showDontTellForStorage 同纪律：无语言入参时按汉字自探测，错误语种会让两家族引擎集体漏报 */
export function detectRescanLang(text: string): 'zh' | 'en' {
  return /[一-鿿]/.test(text) ? 'zh' : 'en';
}

type RawResult = { score?: unknown; issues?: unknown; gate?: unknown };
type Runner = (text: string, lang: 'zh' | 'en', cast: CastMap) => RawResult;

// 32 键：result 键名 → runner。顺序与 pipeline result 对齐，便于人工核对。
const RUNNERS: Array<[key: string, fn: Runner]> = [
  // v2.114-v2.123 hits 形态七键（issues 同族，统一提取 issues；hits 富列表只在 SSE 流）
  ['coolMoment', (t, l) => coolMomentScore(t, l)],
  ['dialogueWater', (t, l) => dialogueWaterCheck(t, l)],
  ['conflictDensity', (t, l) => conflictDensityCheck(t, l)],
  ['punchlineDensity', (t, l) => punchlineDensityScore(t, l)],
  ['repetition', (t, l) => repetitionCheck(t, l)],
  ['twistDensity', (t, l) => twistDensityScore(t, l)],
  ['informationDensity', (t, l) => informationDensityScore(t, l)],
  // v2.118/v2.120/v2.122 等无 hits 结构键
  ['sceneDensity', (t, l) => sceneDensityScore(t, l)],
  ['characterBalance', (t, l, c) => characterBalanceCheck(t, c, l)],
  ['dialogueLength', (t, l) => dialogueLengthScore(t, l)],
  ['suspenseTension', (t, l) => suspenseTensionCurve(t, l)],
  ['sceneHeader', (t, l) => sceneHeaderConvention(t, l)],
  ['dialogueFunction', (t, l) => dialogueFunctionalityCheck(t, l)],
  ['causalLogic', (t, l) => causalLogicCheck(t, l)],
  ['protagonistGoal', (t, l) => protagonistGoalCheck(t, l)],
  ['antagonistQuality', (t, l) => antagonistQualityCheck(t, l)],
  ['relationship', (t, l) => relationshipProgressionCheck(t, l)],
  ['scenePadding', (t, l) => scenePaddingCheck(t, l)],
  ['supporting', (t, l, c) => supportingCharacterCheck(t, c, l)],
  ['conflictEscalation', (t, l) => conflictEscalationCheck(t, l)],
  ['subtext', (t, l) => subtextCheck(t, l)],
  ['supportingArc', (t, l, c) => supportingArcCheck(t, c, l)],
  ['scenePurpose', (t, l) => scenePurposeCheck(t, l)],
  ['continuity', (t, l) => continuitySupervisionCheck(t, l)],
  ['misunderstanding', (t, l) => misunderstandingDragCheck(t, l)],
  ['plotArmor', (t, l) => plotArmorCheck(t, l)],
  ['evidenceChain', (t, l) => evidenceChainCheck(t, l)],
  ['cheatRule', (t, l) => cheatRuleCheck(t, l)],
  ['memoryFakeout', (t, l) => memoryFakeoutCheck(t, l)],
  ['emotionalAftermath', (t, l) => emotionalAftermathCheck(t, l)],
  ['locationContinuity', (t, l) => locationContinuityCheck(t, l)],
  ['characterPresence', (t, l) => characterPresenceCheck(t, l)],
];

function shapeEntry(raw: RawResult): StructuralRescanEntry | null {
  if (typeof raw?.score !== 'number' || !Number.isFinite(raw.score)) return null;
  const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];
  const issues = rawIssues
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object' && !Array.isArray(it))
    .filter((it) => typeof it.type === 'string' || typeof it.evidence === 'string' || typeof it.advice === 'string')
    .slice(0, QC_ISSUES_LIMIT)
    .map((it) => {
      const severity = it.severity === 'high' || it.severity === 'low' ? it.severity : 'mid';
      const str = (val: unknown, max: number) => (typeof val === 'string' ? val.slice(0, max) : undefined);
      return {
        severity: severity as 'high' | 'mid' | 'low',
        ...(str(it.type, QC_ISSUE_TYPE_MAX) !== undefined ? { type: str(it.type, QC_ISSUE_TYPE_MAX) } : {}),
        ...(str(it.evidence, QC_ISSUE_EVIDENCE_MAX) !== undefined ? { evidence: str(it.evidence, QC_ISSUE_EVIDENCE_MAX) } : {}),
        ...(str(it.advice, QC_ISSUE_ADVICE_MAX) !== undefined ? { advice: str(it.advice, QC_ISSUE_ADVICE_MAX) } : {}),
      };
    });
  const entry: StructuralRescanEntry = {
    score: Math.max(0, Math.min(100, Math.round(raw.score))),
    issueCount: rawIssues.filter((it) => !!it && typeof it === 'object').length,
    issues,
  };
  if (typeof raw.gate === 'string' && raw.gate.trim()) entry.gate = raw.gate.slice(0, QC_ISSUE_GATE_MAX);
  return entry;
}

/**
 * 对改写后正文重跑 32 个结构引擎。逐键 try/catch：单个引擎异常只跳过该键（保留旧值），
 * 绝不因质检附加逻辑阻断付费交付（与 freshArc/freshSoft 同纪律）。
 * @param cast 圣经名表（CastMap）或名字数组（/fix 场景只有名字，空 profile 即可）
 */
export function structuralRescan(
  text: string,
  cast?: CastMap | ReadonlyArray<string> | null,
): Record<string, StructuralRescanEntry> {
  const out: Record<string, StructuralRescanEntry> = {};
  if (!text || !text.trim()) return out;
  const lang = detectRescanLang(text);
  let castMap: CastMap = {};
  if (Array.isArray(cast)) {
    castMap = Object.fromEntries(cast.filter((n) => typeof n === 'string' && n).map((n) => [n, {}]));
  } else if (cast) {
    castMap = cast as CastMap;
  }
  for (const [key, fn] of RUNNERS) {
    try {
      const entry = shapeEntry(fn(text, lang, castMap));
      if (entry) out[key] = entry;
    } catch {
      // 单引擎异常：保留 v1 旧值，不用空壳覆盖（异常 ≠ 健康）
    }
  }
  return out;
}
