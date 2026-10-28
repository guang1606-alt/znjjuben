/**
 * 闸门引擎统一削形与重扫（c218）
 * ------------------------------------------------------------------
 * 病象：cliche/tongue/grounded/lengthPlan 四个 QC 闸门引擎的结果没有顶层 score 字段
 * （契约分别是 pass+noveltyScore、pass+colloquialScore、groundedScore、ready+status），
 * 被 buildQcEngineDigest 的 `typeof o.score !== 'number'` 硬过滤整体排除——
 * 落库无、SSE done 无、/fix 重放无、前端无任何渲染，四点全盲。
 * 其中 cliche/tongue 还是 QC 重试闸门引擎：重试耗尽后的失败态静默出货，用户看不到痕迹。
 *
 * 同族半盲键（rhythm/character/styleCheck/propMotifRhythm）有 score，走既有
 * buildQcEngineDigest 路径 A/B 补 SSE done 与 /fix（见 generate.ts c218 接线块），
 * 本模块不写分叉形态。
 *
 * 本模块提供：
 * - shapeGateEngines(result)：从 pipeline 终稿原值限界削形（零重算），落库字面量与 SSE done 共用；
 * - rescanGateEngines(text, opts)：供 /fix 在无 pipeline 上下文时对新正文纯函数重跑（零 LLM）。
 *
 * 诚实近似声明（c222 起收敛为「落库读档、缺省回退」）：
 * - c222 前：antiStrength/colloquialLevel 为请求级参数不落库，重放只能用默认档 balanced/mid
 *   （错档会改 pass 阈值：classic≤4/balanced≤2、low≤5/mid≤2.5/high≤1，见 SKILL #82②）；
 * - c222 起：pipeline 终稿返回 _profile（生成期实档），生成落库写入 qcReport._profile，
 *   /fix 重放从旧 qcReport._profile 读取传入，本模块用 normalize* 白名单校验（脏数据/旧项目
 *   无 _profile 时回退默认档，绝不因档位异常抛错阻断付费交付）；
 * - lengthPlan 的 aigcDurationMin 沿用 c219 口径：调用方从旧 qcReport._aigc.durationMin 读取；
 *   scriptFormat 由调用方从 project.format 重建（AIGC/LIVE），比盲用默认档更接近生成时口径。
 */
import { clicheScan } from './creativity';
import { dialogueScan } from './dialogue';
import type { AntiStrength } from './creativity';
import type { ColloquialLevel } from './dialogue';
import { groundedScan } from './lifelike';
import { adaptScriptLength } from './script-length';
import { validateScript, type FormatReport, type ScriptMode } from './script-format';

/** 无 score 四闸门键：qcReport/SSE/fix 三处共用这一份键名事实源 */
export const GATE_ENGINE_KEYS = ['cliche', 'tongue', 'grounded', 'lengthPlan'] as const;

const GATE_HIT_LIMIT = 8;
const GATE_ID_MAX = 40;
const GATE_CAT_MAX = 20;
const GATE_FOUND_MAX = 40;
const GATE_ALT_MAX = 160;
const GATE_WORD_MAX = 40;
const GATE_FIX_MAX = 120;
const GATE_ABSTRACT_MAX = 40;
const GATE_SUGGESTION_MAX = 200;
const GATE_STATUS_MAX = 12;
const GATE_MODE_MAX = 12;

/** c222 档位白名单归一：存档 JSON 可能脏（旧项目无 _profile/手工污染），非法值一律回退默认档，不抛错 */
const ANTI_STRENGTH_TIERS: ReadonlySet<string> = new Set(['classic', 'balanced', 'innovative']);
const COLLOQUIAL_TIERS: ReadonlySet<string> = new Set(['low', 'mid', 'high']);
export function normalizeAntiStrength(v: unknown): AntiStrength {
  return ANTI_STRENGTH_TIERS.has(v as string) ? (v as AntiStrength) : 'balanced';
}
export function normalizeColloquialLevel(v: unknown): ColloquialLevel {
  return COLLOQUIAL_TIERS.has(v as string) ? (v as ColloquialLevel) : 'mid';
}

export interface ClicheGateDigest {
  pass: boolean;
  noveltyScore: number;
  issueCount: number;
  hits: Array<{ id: string; cat: string; found: string; alt: string }>;
}
export interface TongueGateDigest {
  pass: boolean;
  colloquialScore: number;
  writtenPer100: number;
  issueCount: number;
  hits: Array<{ word: string; fix: string }>;
}
export interface GroundedGateDigest {
  groundedScore: number;
  issueCount: number;
  abstractHits: string[];
  suggestions: string[];
}
export interface LengthPlanGateDigest {
  ready: boolean;
  status: string;
  mode: string;
  current: number;
  target: number;
  range: [number, number];
  issueCount: number;
}

export type GateDigestMap = {
  cliche?: ClicheGateDigest;
  tongue?: TongueGateDigest;
  grounded?: GroundedGateDigest;
  lengthPlan?: LengthPlanGateDigest;
};

const str = (val: unknown, max: number): string | undefined =>
  (typeof val === 'string' && val ? val.slice(0, max) : undefined);
const num = (val: unknown): number | undefined =>
  (typeof val === 'number' && Number.isFinite(val) ? val : undefined);

function shapeCliche(raw: unknown): ClicheGateDigest | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.pass !== 'boolean') return undefined;
  const rawHits = Array.isArray(o.hits) ? o.hits : [];
  const hits = rawHits
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && !Array.isArray(h))
    .slice(0, GATE_HIT_LIMIT)
    .map((h) => ({
      id: str(h.id, GATE_ID_MAX) ?? '',
      cat: str(h.cat, GATE_CAT_MAX) ?? '',
      found: str(h.found, GATE_FOUND_MAX) ?? '',
      alt: str(h.alt, GATE_ALT_MAX) ?? '',
    }));
  return {
    pass: o.pass,
    noveltyScore: num(o.noveltyScore) ?? 0,
    issueCount: rawHits.length,
    hits,
  };
}

function shapeTongue(raw: unknown): TongueGateDigest | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.pass !== 'boolean') return undefined;
  const rawHits = Array.isArray(o.hits) ? o.hits : [];
  const hits = rawHits
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && !Array.isArray(h))
    .slice(0, GATE_HIT_LIMIT)
    .map((h) => ({
      word: str(h.word, GATE_WORD_MAX) ?? '',
      fix: str(h.fix, GATE_FIX_MAX) ?? '',
    }));
  return {
    pass: o.pass,
    colloquialScore: num(o.colloquialScore) ?? 0,
    writtenPer100: num(o.writtenPer100) ?? 0,
    issueCount: rawHits.length,
    hits,
  };
}

function shapeGrounded(raw: unknown): GroundedGateDigest | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const score = num(o.groundedScore);
  if (score === undefined) return undefined;
  const rawAbs = Array.isArray(o.abstractHits) ? o.abstractHits : [];
  const rawSug = Array.isArray(o.suggestions) ? o.suggestions : [];
  return {
    groundedScore: score,
    issueCount: rawAbs.filter((h) => typeof h === 'string').length,
    abstractHits: rawAbs.filter((h): h is string => typeof h === 'string').slice(0, GATE_HIT_LIMIT).map((h) => h.slice(0, GATE_ABSTRACT_MAX)),
    suggestions: rawSug.filter((s): s is string => typeof s === 'string').slice(0, 3).map((s) => s.slice(0, GATE_SUGGESTION_MAX)),
  };
}

function shapeLengthPlan(raw: unknown): LengthPlanGateDigest | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.ready !== 'boolean') return undefined;
  const range: [number, number] = Array.isArray(o.range) && o.range.length >= 2
    ? [num(o.range[0]) ?? 0, num(o.range[1]) ?? 0]
    : [0, 0];
  return {
    ready: o.ready,
    status: str(o.status, GATE_STATUS_MAX) ?? 'unknown',
    mode: str(o.mode, GATE_MODE_MAX) ?? 'LIVE',
    current: num(o.current) ?? 0,
    target: num(o.target) ?? 0,
    range,
    issueCount: o.ready ? 0 : 1,
  };
}

/**
 * 从 pipeline 终稿 result 原值削形（零重算）。值不符合契约的键直接省略——
 * 不写假健康壳，缺键语义为「本集该引擎未产出/被跳过」，与 digest 排除集语义一致。
 */
export function shapeGateEngines(result: Record<string, unknown> | null | undefined): GateDigestMap {
  const out: GateDigestMap = {};
  if (!result) return out;
  const cliche = shapeCliche(result.cliche);
  if (cliche) out.cliche = cliche;
  const tongue = shapeTongue(result.tongue);
  if (tongue) out.tongue = tongue;
  const grounded = shapeGrounded(result.grounded);
  if (grounded) out.grounded = grounded;
  const lengthPlan = shapeLengthPlan(result.lengthPlan);
  if (lengthPlan) out.lengthPlan = lengthPlan;
  return out;
}

/**
 * 供 /fix 对改写后正文重跑四闸门。逐键 try/catch：单引擎异常只跳过该键（保留旧值），
 * 绝不因质检附加逻辑阻断付费交付（与 structuralRescan 同纪律）。
 * 覆盖语义：健康结果也写壳（pass:true/issueCount:0），清掉 v1 残留问题。
 */
export function rescanGateEngines(
  text: string,
  opts: { scriptFormat?: ScriptMode; aigcDurationMin?: number; antiStrength?: unknown; colloquialLevel?: unknown } = {},
): GateDigestMap {
  const out: GateDigestMap = {};
  if (!text || !text.trim()) return out;
  // 逐键条件赋值：shape 返回 undefined（契约不符）时键不出现，避免落库写入 undefined
  // c222：antiStrength/colloquialLevel 从调用方传入（旧 qcReport._profile 读档），normalize 白名单校验后回退默认档
  try { const v = shapeCliche(clicheScan(text, normalizeAntiStrength(opts.antiStrength))); if (v) out.cliche = v; } catch { /* 保留旧值 */ }
  try { const v = shapeTongue(dialogueScan(text, normalizeColloquialLevel(opts.colloquialLevel))); if (v) out.tongue = v; } catch { /* 保留旧值 */ }
  try { const v = shapeGrounded(groundedScan(text)); if (v) out.grounded = v; } catch { /* 保留旧值 */ }
  try {
    const v = shapeLengthPlan(adaptScriptLength(text, opts.scriptFormat ?? 'LIVE', opts.aigcDurationMin ?? 1));
    if (v) out.lengthPlan = v;
  } catch { /* 保留旧值 */ }
  return out;
}

/**
 * 供 /fix 对改写后正文重算顶层 format（v2.339）。
 * 病象：生成期 pipeline 无条件下写 qcReport.format（LIVE 含 v2.337 制片可行性与 score 折损），
 * 但 /fix 只重算 _aigc.format，LIVE 改写后闸门结论停在旧稿——旧稿的「不可拍」红字挂在新稿上，
 * 或新稿其实已 9 场却仍显示 ok，QC 面板与真实稿子名实不符。
 * 空文本/异常返回 {}：调用方展开后保留旧值，不写空壳、不阻断付费交付。
 */
export function rescanScriptFormat(
  text: string,
  opts: { scriptFormat?: ScriptMode; aigcDurationMin?: number } = {},
): { format?: FormatReport } {
  if (!text || !text.trim()) return {};
  try {
    return { format: validateScript(text, opts.scriptFormat ?? 'LIVE', opts.aigcDurationMin ?? 1) };
  } catch { return {}; }
}
