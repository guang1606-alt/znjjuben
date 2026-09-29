/**
 * QC 引擎摘要（v2.150 复盘修复）
 * ------------------------------------------------------------------
 * 病象：v2.129 前端「创作质检聚合卡」按 score+hits[] 形态遍历落库 qcReport 渲染 chip；
 * 但 v2.80 台账重构后，generate.ts 落库的 qcReport 只写跨集台账键（cliffhanger/payoffRhythm/
 * timeline/各 ledger 等），引擎命中数据不再进库 → 新生成的集子 chip 卡永远为空，
 * v2.133 补齐的 107+ 引擎中文词条在事后回看场景中无的放矢。
 *
 * 修复：落库前从 pipeline result 中摘取 score+hits 形态引擎的轻量摘要（hits 截断防膨胀、
 * issues/advice 截断、透传 unrescuedCount），排除已被跨集台账占用的键，与台账键合并落库
 * （台账键后写优先，双保险）。前端零改动即恢复 chip 卡渲染。
 */
export interface QcEngineDigestEntry {
  score: number;
  hits: unknown[];
  issues?: unknown[];
  advice?: unknown[];
  unrescuedCount?: number;
}

/**
 * c212 issues 形态摘要（无顶层 hits 的引擎）：
 * v2.113-v2.147 结构维度族（causalLogic/sceneDensity/suspenseTension/cheatRule…）及
 * voicePrint/dialogueAiTaste 等 issues-only 创作引擎，结果是 {score, issues:[{severity,type,evidence,advice}]}。
 * 旧通用扫描只认 hits[]，这批引擎只进 SSE 流、从不落库，刷新后质检面板永久失明。
 */
export interface QcIssuesDigestEntry {
  score: number;
  /** 全量问题数（issues 数组只落前 5 条，计数保留全量供副标题） */
  issueCount: number;
  issues: Array<{ severity: 'high' | 'mid' | 'low'; type?: string; evidence?: string; advice?: string }>;
  /** cheatRule 等题材门控引擎的门控标记（如 rebirth/system/ancient） */
  gate?: string;
}

export const QC_ISSUES_LIMIT = 5;
export const QC_ISSUE_TYPE_MAX = 40;
export const QC_ISSUE_EVIDENCE_MAX = 160;
export const QC_ISSUE_ADVICE_MAX = 200;
export const QC_ISSUE_GATE_MAX = 20;

/** 已被跨集台账/闭环面板占用的 qcReport 键（generate.ts 落库字面量），摘要不得覆盖 */
export const QC_LEDGER_KEYS: ReadonlySet<string> = new Set([
  'foreshadow', 'arcTrack', 'secretLedger', 'stateLedger', 'fixLoop', 'beats', 'outline',
  'payoffRhythm', 'cliffhanger', 'openHook', 'props', 'humiliation', 'mystery', 'promise',
  'villain', 'timeline', 'cost', 'death', 'villainFate', 'wound', 'power', 'item', 'relation',
  'affiliation', 'location', 'secretLeak', 'disguise', 'debt', 'alliance', 'memory',
  'impersonation', 'betrayal', 'sacrifice', 'curse', 'possession', 'timeTravel',
  'transformation', 'poison', 'recap', 'targetedFix',
]);

/**
 * c211 拥有专用 digest + 专用质检卡的单集引擎：通用 score+hits 摘要不得再写一份分叉形态。
 * - sceneSoftEnding 虽是 hits 形态，但统一形态走 sceneSoftEndingDigest（含截断后的 advice/issues）；
 * - showDontTell 是 issues 形态（无顶层 hits），通用扫描天然漏掉，统一形态走 showDontTellDigest。
 */
export const QC_SPECIAL_DIGEST_KEYS: ReadonlySet<string> = new Set([
  'sceneSoftEnding', 'showDontTell',
]);

/**
 * 从 pipeline result 摘取 QC 引擎摘要。
 * 路径 A（hits 形态）：值是对象、score 为数值、hits 为非空数组——创作能力引擎统一形态。
 * 路径 B（c212 issues 形态）：无顶层 hits（或空）、score 为数值、issues 为非空对象数组，
 *   且元素至少含字符串 type 或 evidence/advice——结构维度族（v2.113-v2.147）与
 *   voicePrint 等 issues-only 创作引擎。string[] issues（hits 族旧形态）不进此路径。
 * 两条路径互斥：hits 非空优先 A，行为零变化。
 * （cliche/tongue 无 score、sceneSoftEnding/showDontTell 在 SPECIAL 集合，天然排除。）
 */
export function buildQcEngineDigest(
  result: Record<string, unknown> | null | undefined,
  opts: { hitLimit?: number } = {},
): Record<string, QcEngineDigestEntry | QcIssuesDigestEntry> {
  const hitLimit = opts.hitLimit ?? 8;
  const out: Record<string, QcEngineDigestEntry | QcIssuesDigestEntry> = {};
  for (const [k, v] of Object.entries(result ?? {})) {
    if (QC_LEDGER_KEYS.has(k)) continue;
    if (QC_SPECIAL_DIGEST_KEYS.has(k)) continue; // c211：专用 digest 在 generate.ts 显式落库，禁止通用扫描写出分叉形态
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.score !== 'number') continue;
    // 路径 A：hits 形态（既有行为，不得改变）
    if (Array.isArray(o.hits) && o.hits.length > 0) {
      out[k] = {
        score: o.score,
        hits: o.hits.slice(0, hitLimit),
        ...(Array.isArray(o.issues) && o.issues.length ? { issues: o.issues.slice(0, 3) } : {}),
        ...(Array.isArray(o.advice) && o.advice.length ? { advice: o.advice.slice(0, 3) } : {}),
        ...(typeof o.unrescuedCount === 'number' ? { unrescuedCount: o.unrescuedCount } : {}),
      };
      continue;
    }
    // 路径 B：issues 形态（c212）
    if (!Array.isArray(o.issues) || o.issues.length === 0) continue;
    const shaped = o.issues
      .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object' && !Array.isArray(it))
      .filter((it) => typeof it.type === 'string' || typeof it.evidence === 'string' || typeof it.advice === 'string')
      .slice(0, QC_ISSUES_LIMIT)
      .map((it) => {
        const sev = it.severity === 'high' || it.severity === 'low' ? it.severity : 'mid';
        const str = (val: unknown, max: number) => (typeof val === 'string' ? val.slice(0, max) : undefined);
        return {
          severity: sev as 'high' | 'mid' | 'low',
          ...(str(it.type, QC_ISSUE_TYPE_MAX) !== undefined ? { type: str(it.type, QC_ISSUE_TYPE_MAX) } : {}),
          ...(str(it.evidence, QC_ISSUE_EVIDENCE_MAX) !== undefined ? { evidence: str(it.evidence, QC_ISSUE_EVIDENCE_MAX) } : {}),
          ...(str(it.advice, QC_ISSUE_ADVICE_MAX) !== undefined ? { advice: str(it.advice, QC_ISSUE_ADVICE_MAX) } : {}),
        };
      });
    if (!shaped.length) continue; // 全是 string/null/无标识元素：不是结构 issues 契约，不收录
    const entry: QcIssuesDigestEntry = {
      score: o.score,
      issueCount: o.issues.length,
      issues: shaped,
    };
    if (typeof o.gate === 'string' && o.gate.trim()) entry.gate = o.gate.slice(0, QC_ISSUE_GATE_MAX);
    out[k] = entry;
  }
  return out;
}
