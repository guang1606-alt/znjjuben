/**
 * c216 跨集诊断台账六键：落库限界形态 + /fix 按新正文重算
 *
 * 病象（c216 复盘坐实）：hookPayoff / humiliationDebt / mysteryDrought / hookFatigue /
 * promiseDrought / villainThreat 是 v2.80 六个跨集诊断台账，结果形态为「状态字段 + issues[]」
 * 但**无顶层 score**。pipeline 终稿逐集重算（注释自述"终稿重算落库"），然而：
 *   1) buildQcEngineDigest 通用扫描要求 numeric score，六键被整体跳过；
 *   2) generate.ts 落库字面量只有短名摘要行（humiliation/mystery/promise/villain…供下一集 prev 输入），
 *      没有长名诊断键；
 *   3) SSE done 事件手工列举的载荷也不带；
 *   4) /fix 整集重写后不重算。
 * 三处全丢：掉钩/欠账/悬念干旱/钩型疲劳/承诺欠账/反派空转的告警只活在进程内存，
 * 刷新后质检卡永久失明（与 c211 showDontTell 同族），/fix 修好了也无任何通道反映。
 *
 * 本模块：
 * - shapeLedgerDiagnoses：生成路径零重算，把 pipeline 已算好的六个 result 削成限界 digest
 *   （状态字段白名单透传 + issueCount 原始计数 + issues≤5、severity/type/evidence/advice 白名单截断），
 *   与 buildQcEngineDigest 路径 B 同一截断常量、同一前端 issues 卡契约。
 * - rescanLedgerDiagnoses：/fix 路径按新正文 + 前序集 qcReport 短名摘要行重放六引擎，
 *   前序行收集与本集行构造严格对齐 pipeline.runScript 终稿块（L2784-L2805）与
 *   generate 路由前序读取块（normalize* 系列），逐引擎 try/catch——异常键缺席，由 /fix 的
 *   展开旧 qcReport 保留旧值，绝不因诊断重算阻断付费交付。
 *   c197 语义修正：/fix 改写的是已完成集，引擎一律按 cur+1 评估（等价下一集生成时看到的账面），
 *   本集新埋雷/新承诺/反派当集缺席全部当场入账——旧码按 ep<cur 过滤本集行，诊断与新正文脱节。
 *   需要本集短名摘要行回写时用 rescanLedgerDiagnosisBundle（humiliation/mystery/promise/villain）。
 *
 * 与短名台账键零碰撞：输出仅六个长名诊断键；短名键（humiliation/mystery/promise/villain/
 * hookFatigue 输入通道的 openHook+cliffhanger）是给下一集的摘要行，归属与生命周期均不同。
 */
import { hookPayoffCheck, deriveHookBit, type HookBit } from './cliffhanger-payoff';
import {
  humiliationDebtLedger, extractHumiliationBits, normalizeDebtEp, type DebtEpInput,
} from './humiliation-ledger';
import {
  mysteryDroughtLedger, deriveMysteryHook, mysteryAdvanceCheck, normalizeMysteryRow, type MysteryRow,
} from './mystery-drought';
import {
  hookFatigueLedger, deriveEndHookType, deriveOpenHookId, normalizeHookTypeRow, type HookTypeRow,
} from './hook-fatigue';
import {
  promiseDroughtLedger, derivePromiseLine, promiseAdvanceCheck, normalizePromiseRow, type PromiseRow,
} from './promise-ledger';
import {
  villainThreatLedger, detectVillainAction, normalizeVillainRow, type VillainRow,
} from './villain-threat';
import { payoffRhythmCheck } from './payoff-rhythm-check';
import { detectRescanLang } from './structural-rescan';
import { QC_ISSUES_LIMIT, QC_ISSUE_EVIDENCE_MAX, QC_ISSUE_ADVICE_MAX } from './qc-digest';

export const LEDGER_DIAGNOSIS_KEYS = [
  'hookPayoff',
  'humiliationDebt',
  'mysteryDrought',
  'hookFatigue',
  'promiseDrought',
  'villainThreat',
] as const;
export type LedgerDiagnosisKey = (typeof LEDGER_DIAGNOSIS_KEYS)[number];

/** 各键允许透传的顶层状态字段（issues/issueCount 由 shape 统一附加，其余字段一律剥除） */
const STATE_FIELDS: Record<LedgerDiagnosisKey, readonly string[]> = {
  hookPayoff: ['checked', 'paid', 'prevType'],
  hookFatigue: ['endRun', 'openRun', 'level', 'endType', 'openId'],
  humiliationDebt: ['debt', 'level', 'lastMarkers'],
  mysteryDrought: ['drought', 'level', 'line'],
  promiseDrought: ['drought', 'level', 'line'],
  villainThreat: ['silentRun', 'stagnantRun', 'level', 'line'],
};

function isPlainStateValue(v: unknown): boolean {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || Array.isArray(v);
}

/** 统一 issues 削形：原始计数 + 至多 5 条 + 四字段白名单 + 字符串截断（与 buildQcEngineDigest 路径 B 同口径） */
function shapeIssues(raw: unknown): { issueCount: number; issues: unknown[] } {
  const arr = (raw as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(arr)) return { issueCount: 0, issues: [] };
  const issues = arr
    .filter((it) => it && typeof it === 'object')
    .slice(0, QC_ISSUES_LIMIT)
    .map((it) => {
      const r = it as Record<string, unknown>;
      const out: Record<string, unknown> = {
        severity: r.severity === 'high' || r.severity === 'low' ? r.severity : 'mid',
      };
      if (typeof r.type === 'string') out.type = r.type;
      if (typeof r.evidence === 'string') out.evidence = r.evidence.slice(0, QC_ISSUE_EVIDENCE_MAX);
      if (typeof r.advice === 'string') out.advice = r.advice.slice(0, QC_ISSUE_ADVICE_MAX);
      return out;
    });
  return { issueCount: arr.length, issues };
}

function shapeOne(key: LedgerDiagnosisKey, raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const state: Record<string, unknown> = {};
  for (const f of STATE_FIELDS[key]) {
    if (f in r && isPlainStateValue(r[f])) state[f] = r[f];
  }
  return { ...state, ...shapeIssues(raw) };
}

/**
 * 生成路径：pipeline 已算好的六个 result → 限界 digest 字典。
 * 非对象/缺失的键不出现在输出中（调用方无需判空）。
 */
export function shapeLedgerDiagnoses(
  raws: Partial<Record<LedgerDiagnosisKey, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LEDGER_DIAGNOSIS_KEYS) {
    const shaped = shapeOne(key, raws[key]);
    if (shaped) out[key] = shaped;
  }
  return out;
}

export interface LedgerRescanPrevScript {
  epNo: number;
  /** 前序集落库的 qcReport（任意对象；短名键缺失按无行处理，与生成路径同样容错） */
  qcReport: unknown;
}

export interface RescanLedgerDiagnosesInput {
  /** /fix 改写后的整集正文 */
  text: string;
  /** 当前重写集集号（1 基） */
  epNo: number;
  /** 前序集（epNo < epNo）；乱序安全，内部按 epNo 升序；建议至多 8 集（与生成路径读取窗一致） */
  prevScripts: LedgerRescanPrevScript[];
  /** 本集集尾钩（/fix 传 freshCliffhanger 存储形态；deriveMysteryHook/deriveEndHookType 容错读 type） */
  cliffhanger: unknown;
  /** 本集开场钩规划原始值（qcReport.openHook；改写不变；null/非法=空 ID 断段） */
  openHookRaw?: unknown;
}

/**
 * /fix 路径：按新正文重放六个跨集诊断引擎。
 * c197 语义修正：/fix 改写的是「已完成集」——五个行台账引擎按 cur+1 评估（等价下一集生成时
 * 看到的账面），改写集自身的埋雷/兑付/推进/沉默当集入账；bundle.curRows 另出
 * humiliation/mystery/promise/villain 四个短名摘要行供 /fix 回写，否则后续集读的还是旧稿状态。
 * hookPayoff 不是行台账（直接比对前集钩与新正文），评估口径不变。
 */
export interface LedgerDiagnosisBundle {
  /** 六个长名诊断键（限界形态，直接展开进 qcReport） */
  diagnoses: Record<string, unknown>;
  /** 四个短名摘要行（humiliation/mystery/promise/villain），供后续集 prev 读取 */
  curRows: Record<string, unknown>;
}

export function rescanLedgerDiagnosisBundle(input: RescanLedgerDiagnosesInput): LedgerDiagnosisBundle {
  const text = typeof input.text === 'string' ? input.text : '';
  const cur = Math.round(Number(input.epNo));
  if (!Number.isFinite(cur) || cur < 1) return { diagnoses: {}, curRows: {} };

  const prevs = [...(input.prevScripts ?? [])]
    .filter((s) => s && Number.isFinite(Math.round(Number(s.epNo))))
    .map((s) => ({ epNo: Math.round(Number(s.epNo)), qcReport: s.qcReport }))
    .filter((s) => s.epNo < cur)
    .sort((a, b) => a.epNo - b.epNo);

  // —— 前序行收集（对齐 generate 路由 L2467-L2507）——
  let prevHook: HookBit | null = null;
  const prevHumDebt: DebtEpInput[] = [];
  const prevMystery: MysteryRow[] = [];
  const prevHookTypes: HookTypeRow[] = [];
  const prevPromises: PromiseRow[] = [];
  const prevVillains: VillainRow[] = [];
  for (const [idx, s] of prevs.entries()) {
    const qcr = (s.qcReport ?? {}) as Record<string, unknown>;
    // 集尾钩子只认最近一集（生成路径用降序首行；prevs 已升序，末位即最近完成集）
    if (idx === prevs.length - 1) {
      const h = deriveHookBit(qcr.cliffhanger, s.epNo);
      if (h) prevHook = h;
    }
    const hum = normalizeDebtEp({ ...((qcr.humiliation as Record<string, unknown>) ?? {}), ep: s.epNo });
    if (hum) prevHumDebt.push(hum);
    const mys = normalizeMysteryRow({ ...((qcr.mystery as Record<string, unknown>) ?? {}), ep: s.epNo });
    if (mys) prevMystery.push(mys);
    const ht = normalizeHookTypeRow({
      ep: s.epNo,
      openId: (qcr.openHook as { id?: unknown } | undefined)?.id,
      endType: (qcr.cliffhanger as { type?: unknown } | undefined)?.type,
    });
    if (ht) prevHookTypes.push(ht);
    const prm = normalizePromiseRow({ ...((qcr.promise as Record<string, unknown>) ?? {}), ep: s.epNo });
    if (prm) prevPromises.push(prm);
    const vil = normalizeVillainRow({ ...((qcr.villain as Record<string, unknown>) ?? {}), ep: s.epNo });
    if (vil) prevVillains.push(vil);
  }

  const lang = detectRescanLang(text);
  const raws: Partial<Record<LedgerDiagnosisKey, unknown>> = {};
  // c197：本集四个短名摘要行（与生成路径 qcReport 落库形态同构），异常的键不出行
  const curRows: Record<string, unknown> = {};

  // hookPayoff：前集硬钩 vs 新正文（无 prevHook/文本过短引擎自返 checked:false）
  try {
    raws.hookPayoff = hookPayoffCheck(prevHook, text, lang);
  } catch { /* 异常保留旧值 */ }

  // humiliationDebt：本集羞辱雷 + 新正文兑付计数（payoffRhythm 纯函数重算，仅取计数不落库）
  try {
    const bits = extractHumiliationBits(text, cur);
    const pr = payoffRhythmCheck(text, lang);
    const curHum = {
      planted: bits.length,
      paid: pr.humiliationPaidCount,
      strong: pr.strongReleaseCount,
      markers: [...new Set(bits.map((b) => b.marker))].slice(0, 5),
    };
    prevHumDebt.push({ ep: cur, ...curHum });
    raws.humiliationDebt = humiliationDebtLedger(prevHumDebt, cur + 1);
    curRows.humiliation = curHum;
  } catch { /* 异常保留旧值 */ }

  // mysteryDrought：集尾悬念钩定线，无钩继承前集活跃线
  try {
    const hook = deriveMysteryHook(input.cliffhanger, cur);
    const prevLast = prevMystery.length ? prevMystery[prevMystery.length - 1] : null;
    const line = hook?.line || prevLast?.line || '';
    const curMystery = {
      line,
      advanced: line ? mysteryAdvanceCheck(line, text) : false,
      hooked: !!hook?.hooked,
    };
    prevMystery.push({ ep: cur, ...curMystery });
    raws.mysteryDrought = mysteryDroughtLedger(prevMystery, cur + 1);
    curRows.mystery = curMystery;
  } catch { /* 异常保留旧值 */ }

  // hookFatigue：开场=本集规划 ID（改写不变），集尾=新正文实测钩型
  try {
    const curHookType = {
      openId: deriveOpenHookId(input.openHookRaw) ?? '',
      endType: deriveEndHookType(input.cliffhanger) ?? '',
    };
    prevHookTypes.push({ ep: cur, ...curHookType });
    raws.hookFatigue = hookFatigueLedger(prevHookTypes, cur + 1);
  } catch { /* 异常保留旧值 */ }

  // promiseDrought：本集新誓言定线，无新誓继承前集活跃承诺
  try {
    const freshLine = derivePromiseLine(text);
    const prevLast = prevPromises.length ? [...prevPromises].sort((a, b) => a.ep - b.ep)[prevPromises.length - 1] : null;
    const line = freshLine || prevLast?.line || '';
    const curPromise = { line, advanced: line ? promiseAdvanceCheck(line, text) : false };
    prevPromises.push({ ep: cur, ...curPromise });
    raws.promiseDrought = promiseDroughtLedger(prevPromises, cur + 1);
    curRows.promise = curPromise;
  } catch { /* 异常保留旧值 */ }

  // villainThreat：新正文反派威胁动作分档
  try {
    const action = detectVillainAction(text);
    const curVillain = { line: action.line, acted: action.level > 0, level: action.level };
    prevVillains.push({ ep: cur, ...curVillain });
    raws.villainThreat = villainThreatLedger(prevVillains, cur + 1);
    curRows.villain = curVillain;
  } catch { /* 异常保留旧值 */ }

  return { diagnoses: shapeLedgerDiagnoses(raws), curRows };
}

/**
 * 旧入口兼容：只返回六个长名诊断键（新代码请用 rescanLedgerDiagnosisBundle，同时取回短名摘要行）。
 */
export function rescanLedgerDiagnoses(input: RescanLedgerDiagnosesInput): Record<string, unknown> {
  return rescanLedgerDiagnosisBundle(input).diagnoses;
}
