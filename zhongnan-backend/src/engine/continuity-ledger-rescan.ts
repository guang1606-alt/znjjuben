/**
 * c217 跨集连续性台账 24 键：落库限界形态 + /fix 按新正文重算
 *
 * 病象（c217 复盘坐实）：propLedger / timelineLedger / costLedger / deathLedger / villainFate /
 * woundRecovery / powerProgress / itemOwnership / relLedger / affLedger / locLedger / leakLedger /
 * disguiseLedger / debtLedger / allianceLedger / memoryLedger / impersonationLedger / betrayalLedger /
 * sacrificeLedger / curseLedger / possessionLedger / timeTravelLedger / transformationLedger /
 * poisonLedger 是 v2.80 二十四本跨集连续性台账，结果形态为「名册状态字段 + issues[]」，
 * **全部无顶层 score**。pipeline.runScript 终稿逐集重算（L2796-L2905，注释自述"终稿重算落库"），
 * 然而与 c216 六键同族、规模四倍：
 *   1) buildQcEngineDigest 两条路径都要求 numeric score，24 键被整体跳过；
 *   2) generate.ts 批量落库字面量只有 24 个短名摘要行（props/death/wound/…供下一集 prev 输入），
 *      没有长名诊断键；
 *   3) SSE done 载荷同样不带；
 *   4) /fix 整集重写后不重算；
 *   5) 前端无任何渲染分支。
 * 封禁信物凭空再用、死者复活、已下场反派再行动、伤势秒愈、境界跳级、物品让渡后再经手、
 * 决裂后秒亲密、叛出后仍效忠、被困瞬移、非知情者知悉秘密……二十四类硬伤告警只活在进程内存，
 * 刷新后永久失明，/fix 修好了也无任何通道反映。
 *
 * 同名碰撞处置（villainFate）：qcReport.villainFate 短名行已是 { rows: curFateRows }（供下一集
 * prev 输入），不能被诊断覆盖。本模块对 villainFate 只输出纯诊断（felled+issueCount+issues，
 * **不含 rows**），由调用方在短名行处合流（{ rows, ...diagnosis }）；/fix 重算时展开保留旧 rows。
 *
 * 本模块：
 * - shapeContinuityLedgers：生成路径零重算，把 pipeline 已算好的 24 个 result 削成限界 digest
 *   （标量状态白名单透传 + 名册数组元素白名单削形且 ≤30 条 + issueCount 原始计数 +
 *   issues≤5、severity/type/evidence/advice 白名单截断），与 buildQcEngineDigest 路径 B、
 *   c216 shapeLedgerDiagnoses 同一截断常量、同一前端 issues 卡契约。
 * - rescanContinuityLedgers：/fix 路径按新正文 + 前序集 qcReport 短名摘要行重放 24 引擎，
 *   前序行收集与本集行构造严格对齐 pipeline.runScript 终稿块（L2796-L2905）与 generate 路由
 *   前序读取块（L2521-L2718 的 normalize* 系列），逐引擎 try/catch——异常键缺席，由 /fix 的
 *   展开旧 qcReport 保留旧值，绝不因诊断重算阻断付费交付。
 *   c197 语义修正：/fix 改写的是已完成集，引擎一律按 cur+1 评估（等价下一集生成时看到的账面），
 *   死者本集再开口等改写集自引入穿帮当场判，不再滞后一集；需要 24 个本集短名摘要行随 v2
 *   回写（修复"后续集 prev 永远读 v1 旧稿账面"）时用 rescanContinuityBundle。
 */
import {
  propLedger, extractPropMentions, normalizePropRow,
} from './prop-ledger';
import {
  timelineLedger, deriveTimelineMark, normalizeTimelineRow,
} from './timeline-ledger';
import {
  costLedger, deriveCostSignal, normalizeCostRow,
} from './cost-ledger';
import {
  deathLedger, deriveDeathSignal, normalizeDeathRow,
} from './death-ledger';
import {
  villainFateLedger, deriveFateSignal, normalizeFateRow,
} from './villain-fate-ledger';
import {
  woundRecoveryLedger, deriveWoundSignal, normalizeWoundRow,
} from './wound-recovery-ledger';
import {
  powerProgressLedger, derivePowerSignal, normalizePowerRow,
} from './power-progress-ledger';
import {
  itemOwnershipLedger, deriveOwnershipRows, normalizeItemRow,
} from './item-ownership-ledger';
import {
  relationshipLedger, deriveRelationRows, normalizeRelRow,
} from './relationship-ledger';
import {
  affiliationLedger, deriveAffiliationRows, normalizeAffRow,
} from './affiliation-ledger';
import {
  locationLedger, deriveLocationRows, normalizeLocRow,
} from './location-ledger';
import {
  secretLeakLedger, deriveLeakRows, normalizeLeakRow,
} from './secret-leak-ledger';
import {
  disguiseLedger, deriveDisguiseRows, normalizeDisguiseRow,
} from './disguise-ledger';
import {
  debtLedger, deriveDebtRows, normalizeDebtRow,
} from './debt-ledger';
import {
  allianceLedger, deriveAllianceRows, normalizeAllianceRow,
} from './alliance-ledger';
import {
  memoryLedger, deriveMemoryRows, normalizeMemoryRow,
} from './memory-ledger';
import {
  impersonationLedger, deriveImpersonationRows, normalizeImpersonationRow,
} from './impersonation-ledger';
import {
  betrayalLedger, deriveBetrayalRows, normalizeBetrayalRow,
} from './betrayal-ledger';
import {
  sacrificeLedger, deriveSacrificeRows, normalizeSacrificeRow,
} from './sacrifice-ledger';
import {
  curseLedger, deriveCurseRows, normalizeCurseRow,
} from './curse-ledger';
import {
  possessionLedger, derivePossessionRows, normalizePossessionRow,
} from './possession-ledger';
import {
  timeTravelLedger, deriveTimeTravelRows, normalizeTimeTravelRow,
} from './time-travel-ledger';
import {
  transformationLedger, deriveTransformationRows, normalizeTransformationRow,
} from './transformation-ledger';
import {
  poisonLedger, derivePoisonRows, normalizePoisonRow,
} from './poison-ledger';
import { QC_ISSUES_LIMIT, QC_ISSUE_EVIDENCE_MAX, QC_ISSUE_ADVICE_MAX } from './qc-digest';

export const CONTINUITY_LEDGER_KEYS = [
  'propLedger',
  'timelineLedger',
  'costLedger',
  'deathLedger',
  'villainFate',
  'woundRecovery',
  'powerProgress',
  'itemOwnership',
  'relLedger',
  'affLedger',
  'locLedger',
  'leakLedger',
  'disguiseLedger',
  'debtLedger',
  'allianceLedger',
  'memoryLedger',
  'impersonationLedger',
  'betrayalLedger',
  'sacrificeLedger',
  'curseLedger',
  'possessionLedger',
  'timeTravelLedger',
  'transformationLedger',
  'poisonLedger',
] as const;
export type ContinuityLedgerKey = (typeof CONTINUITY_LEDGER_KEYS)[number];

/**
 * 各键允许透传的顶层状态字段（issues/issueCount 由 shape 统一附加，其余字段一律剥除）。
 * 字段名逐一对齐 24 引擎 *LedgerResult 接口（prop/timeline/cost 带 level 与标量计数，
 * 其余 21 键只有当前名册数组）。
 */
const STATE_FIELDS: Record<ContinuityLedgerKey, readonly string[]> = {
  propLedger: ['plantedCount', 'stale', 'closed', 'phantom', 'level'],
  timelineLedger: ['droughtRun', 'level', 'line'],
  costLedger: ['streak', 'fromEp', 'level'],
  deathLedger: ['dead'],
  villainFate: ['felled'],
  woundRecovery: ['wounded'],
  powerProgress: ['tracked'],
  itemOwnership: ['handed'],
  relLedger: ['rifted'],
  affLedger: ['departed'],
  locLedger: ['strandeds'],
  leakLedger: ['informed'],
  disguiseLedger: ['disguised'],
  debtLedger: ['debts'],
  allianceLedger: ['alliances'],
  memoryLedger: ['amnesiacs'],
  impersonationLedger: ['impersonations'],
  betrayalLedger: ['breaches'],
  sacrificeLedger: ['debts'],
  curseLedger: ['cursed'],
  possessionLedger: ['possessed'],
  timeTravelLedger: ['traveled'],
  transformationLedger: ['transformed'],
  poisonLedger: ['poisoned'],
};

/** 名册数组条数上限（监控池名册只做状态展示，严防无界落库） */
const ROSTER_LIMIT = 30;
/** 名册元素字符串字段上限（人名/组织名/信物名/时间锚均为短词） */
const ROSTER_STR_MAX = 40;
/** 标量字符串状态字段上限（timeline.line 等） */
const STATE_STR_MAX = 160;

/**
 * 名册「对象元素」字段白名单：数组名 → 元素允许键（逐一对齐 24 引擎 Result 名册接口）。
 * 字符串数组（propLedger.closed）无需配置；未配置白名单的数组若混入对象元素，对象整体丢弃
 * （标量/字符串元素仍保留）——宁可丢展示也不允许嵌套/未知字段无界落库。
 * debts 同时用于人情债（debtor/creditor）与牺牲恩义（giver/receiver），合并白名单。
 */
const ROSTER_ELEMENT_FIELDS: Record<string, readonly string[]> = {
  stale: ['name', 'plantedEp', 'lastSeenEp', 'gap'],
  phantom: ['name', 'closedEp', 'reopenedEp'],
  dead: ['name', 'deathEp'],
  felled: ['name', 'fateEp'],
  wounded: ['name', 'woundEp'],
  tracked: ['name', 'realm', 'realmLabel', 'realmLabelEn', 'lastEp'],
  handed: ['name', 'item', 'handEp'],
  rifted: ['a', 'b', 'riftEp'],
  departed: ['name', 'org', 'leftEp'],
  strandeds: ['name', 'place', 'strandEp'],
  informed: ['name', 'informedEp'],
  disguised: ['name', 'alias', 'disguiseEp'],
  debts: ['debtor', 'creditor', 'giver', 'receiver', 'sinceEp'],
  alliances: ['a', 'b', 'sinceEp'],
  amnesiacs: ['name', 'sinceEp'],
  impersonations: ['imposter', 'victim', 'sinceEp'],
  breaches: ['betrayer', 'victim', 'sinceEp'],
  cursed: ['name', 'sinceEp'],
  possessed: ['name', 'sinceEp'],
  traveled: ['name', 'sinceEp'],
  transformed: ['name', 'sinceEp'],
  poisoned: ['name', 'sinceEp'],
};

/**
 * 名册数组通用削形：≤30 条；元素仅保留 string(≤40)/number/boolean；
 * 对象元素按字段白名单逐键剥形（同名键值类型不符/白名单外直接丢弃），嵌套数组/对象一律不进。
 */
function shapeRoster(value: unknown, allowedObjKeys?: readonly string[]): unknown[] {
  if (!Array.isArray(value)) return [];
  const allow = allowedObjKeys ? new Set(allowedObjKeys) : null;
  const out: unknown[] = [];
  for (const el of value.slice(0, ROSTER_LIMIT)) {
    if (typeof el === 'string') {
      out.push(el.slice(0, ROSTER_STR_MAX));
    } else if (typeof el === 'number' || typeof el === 'boolean') {
      out.push(el);
    } else if (el && typeof el === 'object' && allow) {
      const r = el as Record<string, unknown>;
      const item: Record<string, unknown> = {};
      for (const k of allow) {
        const v = r[k];
        if (typeof v === 'string') item[k] = v.slice(0, ROSTER_STR_MAX);
        else if (typeof v === 'number' || typeof v === 'boolean') item[k] = v;
      }
      out.push(item);
    }
  }
  return out;
}

/** 统一 issues 削形：原始计数 + 至多 5 条 + 四字段白名单 + 字符串截断（与 c216/digest 路径 B 同口径） */
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

function shapeOne(key: ContinuityLedgerKey, raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const state: Record<string, unknown> = {};
  for (const f of STATE_FIELDS[key]) {
    if (!(f in r)) continue;
    const v = r[f];
    if (typeof v === 'string') state[f] = v.slice(0, STATE_STR_MAX);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) state[f] = v;
    else if (Array.isArray(v)) state[f] = shapeRoster(v, ROSTER_ELEMENT_FIELDS[f]);
  }
  return { ...state, ...shapeIssues(raw) };
}

/**
 * 生成路径：pipeline 已算好的 24 个 result → 限界 digest 字典。
 * 非对象/缺失的键不出现在输出中（调用方无需判空）。
 * villainFate 输出不含 rows——rows 是短名摘要行，由调用方合流，严禁覆盖。
 */
export function shapeContinuityLedgers(
  raws: Partial<Record<ContinuityLedgerKey, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CONTINUITY_LEDGER_KEYS) {
    const shaped = shapeOne(key, raws[key]);
    if (shaped) out[key] = shaped;
  }
  return out;
}

export interface ContinuityRescanPrevScript {
  epNo: number;
  /** 前序集落库的 qcReport（任意对象；短名键缺失按无行处理，与生成路径同样容错） */
  qcReport: unknown;
}

export interface RescanContinuityLedgersInput {
  /** /fix 改写后的整集正文 */
  text: string;
  /** 当前重写集集号（1 基） */
  epNo: number;
  /** 具名角色表（bible.characters 名表，extractBibleCastNames 三形态归一；c196 前误读从不落库的 bible.cast 导致恒空） */
  castNames: string[];
  /** 前序集（epNo < epNo）；乱序安全，内部按 epNo 升序；建议至多 8 集（与生成路径读取窗一致） */
  prevScripts: ContinuityRescanPrevScript[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;

/**
 * 24 引擎重放定义。kind 对齐 pipeline 终稿块四种行构造形态：
 * - prop：{ep,items: extractPropMentions(text)}；前序为 qcr.props 单对象
 * - timeline：{ep,mark,spanDays}=deriveTimelineMark(text)；前序为 qcr.timeline 单对象
 * - cost：{ep,won,paid}=deriveCostSignal(text)；前序为 qcr.cost 单对象
 * - signal：逐角色 {ep,name,...derive*Signal(text,name)}；前序为 qcr[short].rows[]
 * - item：逐角色 flatten deriveOwnershipRows(text,name) 配 {ep,name,...row}；前序 rows[]
 * - rows：derive*Rows(text,names) 全句配对配 {ep,...row}；前序 rows[]
 */
interface RescanDef {
  key: ContinuityLedgerKey;
  /** qcReport 短名摘要行键名 */
  short: string;
  kind: 'prop' | 'timeline' | 'cost' | 'signal' | 'item' | 'rows';
  normalize: AnyFn;
  engine: AnyFn;
  /** signal 族：(text, name) => 本集该角色信号位 */
  signal?: AnyFn;
  /** item/rows 族：(text, names) => 本集行（不含 ep） */
  rowsOf?: AnyFn;
}

const RESCAN_DEFS: RescanDef[] = [
  { key: 'propLedger', short: 'props', kind: 'prop', normalize: normalizePropRow, engine: propLedger },
  { key: 'timelineLedger', short: 'timeline', kind: 'timeline', normalize: normalizeTimelineRow, engine: timelineLedger },
  { key: 'costLedger', short: 'cost', kind: 'cost', normalize: normalizeCostRow, engine: costLedger },
  { key: 'deathLedger', short: 'death', kind: 'signal', normalize: normalizeDeathRow, engine: deathLedger, signal: deriveDeathSignal },
  { key: 'villainFate', short: 'villainFate', kind: 'signal', normalize: normalizeFateRow, engine: villainFateLedger, signal: deriveFateSignal },
  { key: 'woundRecovery', short: 'wound', kind: 'signal', normalize: normalizeWoundRow, engine: woundRecoveryLedger, signal: deriveWoundSignal },
  { key: 'powerProgress', short: 'power', kind: 'signal', normalize: normalizePowerRow, engine: powerProgressLedger, signal: derivePowerSignal },
  { key: 'itemOwnership', short: 'item', kind: 'item', normalize: normalizeItemRow, engine: itemOwnershipLedger, rowsOf: deriveOwnershipRows },
  { key: 'relLedger', short: 'relation', kind: 'rows', normalize: normalizeRelRow, engine: relationshipLedger, rowsOf: deriveRelationRows },
  { key: 'affLedger', short: 'affiliation', kind: 'rows', normalize: normalizeAffRow, engine: affiliationLedger, rowsOf: deriveAffiliationRows },
  { key: 'locLedger', short: 'location', kind: 'rows', normalize: normalizeLocRow, engine: locationLedger, rowsOf: deriveLocationRows },
  { key: 'leakLedger', short: 'secretLeak', kind: 'rows', normalize: normalizeLeakRow, engine: secretLeakLedger, rowsOf: deriveLeakRows },
  { key: 'disguiseLedger', short: 'disguise', kind: 'rows', normalize: normalizeDisguiseRow, engine: disguiseLedger, rowsOf: deriveDisguiseRows },
  { key: 'debtLedger', short: 'debt', kind: 'rows', normalize: normalizeDebtRow, engine: debtLedger, rowsOf: deriveDebtRows },
  { key: 'allianceLedger', short: 'alliance', kind: 'rows', normalize: normalizeAllianceRow, engine: allianceLedger, rowsOf: deriveAllianceRows },
  { key: 'memoryLedger', short: 'memory', kind: 'rows', normalize: normalizeMemoryRow, engine: memoryLedger, rowsOf: deriveMemoryRows },
  { key: 'impersonationLedger', short: 'impersonation', kind: 'rows', normalize: normalizeImpersonationRow, engine: impersonationLedger, rowsOf: deriveImpersonationRows },
  { key: 'betrayalLedger', short: 'betrayal', kind: 'rows', normalize: normalizeBetrayalRow, engine: betrayalLedger, rowsOf: deriveBetrayalRows },
  { key: 'sacrificeLedger', short: 'sacrifice', kind: 'rows', normalize: normalizeSacrificeRow, engine: sacrificeLedger, rowsOf: deriveSacrificeRows },
  { key: 'curseLedger', short: 'curse', kind: 'rows', normalize: normalizeCurseRow, engine: curseLedger, rowsOf: deriveCurseRows },
  { key: 'possessionLedger', short: 'possession', kind: 'rows', normalize: normalizePossessionRow, engine: possessionLedger, rowsOf: derivePossessionRows },
  { key: 'timeTravelLedger', short: 'timeTravel', kind: 'rows', normalize: normalizeTimeTravelRow, engine: timeTravelLedger, rowsOf: deriveTimeTravelRows },
  { key: 'transformationLedger', short: 'transformation', kind: 'rows', normalize: normalizeTransformationRow, engine: transformationLedger, rowsOf: deriveTransformationRows },
  { key: 'poisonLedger', short: 'poison', kind: 'rows', normalize: normalizePoisonRow, engine: poisonLedger, rowsOf: derivePoisonRows },
];

/** 角色表上限（纯函数重放成本与正文长度×角色数成正比；与生成路径名表 cap 对齐） */
const RESCAN_CAST_LIMIT = 20;

/**
 * /fix 路径：按新正文重放 24 个跨集连续性引擎。
 * c197 语义修正：/fix 改写的是「已完成集」，不是正在生成的预览集——引擎按 cur+1 评估，
 * 等价于下一集生成时看到这本账：①改写集自身引入的跨集穿帮（如死者本集再开口）当场可判，
 * 不再滞后一集；②本集短名摘要行随 bundle.curRows 产出，供 /fix 回写 qcReport，否则后续
 * 集仍按旧稿状态记账（死人没死/埋的道具没埋）。前序行仍只取 ep<cur，乱序安全；逐引擎异常隔离。
 */
export interface ContinuityRescanBundle {
  /** 24 个长名诊断键（限界形态，直接展开进 qcReport；villainFate 与短名行同名碰撞需合流） */
  ledgers: Record<string, unknown>;
  /** 24 个短名摘要行（props/timeline/cost/death/villainFate/wound/…），供后续集 prev 读取 */
  curRows: Record<string, unknown>;
}

export function rescanContinuityBundle(input: RescanContinuityLedgersInput): ContinuityRescanBundle {
  const text = typeof input.text === 'string' ? input.text : '';
  const cur = Math.round(Number(input.epNo));
  if (!Number.isFinite(cur) || cur < 1) return { ledgers: {}, curRows: {} };

  const names = (Array.isArray(input.castNames) ? input.castNames : [])
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .map((n) => n.trim())
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .slice(0, RESCAN_CAST_LIMIT);

  const prevs = [...(input.prevScripts ?? [])]
    .filter((s) => s && Number.isFinite(Math.round(Number(s.epNo))))
    .map((s) => ({ epNo: Math.round(Number(s.epNo)), qcReport: s.qcReport }))
    .filter((s) => s.epNo < cur)
    .sort((a, b) => a.epNo - b.epNo);

  // —— 前序行收集（对齐 generate 路由 L2521-L2718）——
  const prevRowsByKey = new Map<ContinuityLedgerKey, any[]>();
  for (const def of RESCAN_DEFS) prevRowsByKey.set(def.key, []);
  for (const s of prevs) {
    const qcr = (s.qcReport ?? {}) as Record<string, unknown>;
    for (const def of RESCAN_DEFS) {
      const bucket = prevRowsByKey.get(def.key)!;
      const q = qcr[def.short];
      if (!q || typeof q !== 'object') continue;
      if (def.kind === 'prop' || def.kind === 'timeline' || def.kind === 'cost') {
        // 单对象摘要行：整对象补 ep 后规范化
        try {
          const row = def.normalize({ ...(q as Record<string, unknown>), ep: s.epNo });
          if (row) bucket.push(row);
        } catch { /* 脏摘要跳过 */ }
      } else {
        // 角色/配对摘要行：qcr[short].rows[] 逐条补 ep 后规范化
        const rows = (q as { rows?: unknown }).rows;
        if (!Array.isArray(rows)) continue;
        for (const r of rows) {
          if (!r || typeof r !== 'object') continue;
          try {
            const row = def.normalize({ ...(r as Record<string, unknown>), ep: s.epNo });
            if (row) bucket.push(row);
          } catch { /* 脏行跳过 */ }
        }
      }
    }
  }

  // —— 本集行构造 + 引擎重放（对齐 pipeline L2796-L2905）——
  // c197：同时产出与生成路径同构的短名摘要行（不带 ep，读取侧补 ep）；引擎按 cur+1 评估。
  const raws: Partial<Record<ContinuityLedgerKey, unknown>> = {};
  const curRows: Record<string, unknown> = {};
  for (const def of RESCAN_DEFS) {
    try {
      const rows: any[] = [...(prevRowsByKey.get(def.key) ?? [])];
      let curShort: unknown;
      if (def.kind === 'prop') {
        const items = extractPropMentions(text);
        rows.push({ ep: cur, items });
        curShort = { items };
      } else if (def.kind === 'timeline') {
        const m = deriveTimelineMark(text);
        rows.push({ ep: cur, mark: m.mark, spanDays: m.spanDays });
        curShort = { mark: m.mark, spanDays: m.spanDays };
      } else if (def.kind === 'cost') {
        const c = deriveCostSignal(text);
        rows.push({ ep: cur, won: c.won, paid: c.paid });
        curShort = { won: c.won, paid: c.paid };
      } else if (def.kind === 'signal') {
        const curSignals = names.map((nm) => ({ name: nm, ...def.signal!(text, nm) }));
        for (const r of curSignals) rows.push({ ep: cur, ...r });
        curShort = { rows: curSignals };
      } else if (def.kind === 'item') {
        // deriveOwnershipRows 签名是 (text, name: string) 逐角色调用（对齐 pipeline L2839）；
        // 曾误传 [nm] 数组导致 name.trim 抛 TypeError、该键被异常隔离永久缺席
        const curItemRows: any[] = [];
        for (const nm of names) {
          for (const row of def.rowsOf!(text, nm) as any[]) {
            curItemRows.push({ name: nm, ...row });
            rows.push({ ep: cur, name: nm, ...row });
          }
        }
        curShort = { rows: curItemRows };
      } else {
        const curKindRows = def.rowsOf!(text, names) as any[];
        for (const row of curKindRows) rows.push({ ep: cur, ...row });
        curShort = { rows: curKindRows };
      }
      raws[def.key] = def.engine(rows, cur + 1);
      curRows[def.short] = curShort;
    } catch { /* 单引擎异常：该键缺席，/fix 展开时保留旧值 */ }
  }

  return { ledgers: shapeContinuityLedgers(raws), curRows };
}

/**
 * 旧入口兼容：只返回 24 个长名诊断键（新代码请用 rescanContinuityBundle，同时取回短名摘要行）。
 */
export function rescanContinuityLedgers(input: RescanContinuityLedgersInput): Record<string, unknown> {
  return rescanContinuityBundle(input).ledgers;
}
