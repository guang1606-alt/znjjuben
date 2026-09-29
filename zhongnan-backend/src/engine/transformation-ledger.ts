/**
 * v2.80 变身账本（Transformation Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - disguise-ledger：管身份伪装（假扮/揭穿/认出），属社会身份层；
 *  - 本引擎：管**物理形态状态连续性**（与 memory/curse/possession/time-travel 同构）：
 *    - transformed：A 变身/化形/变形 → 建立"已变身"状态；
 *    - reverted：A 恢复原形/变回 → 解除；
 *    - original：A 以原形行动/出现 →
 *      若 A 仍处已变身状态且本集无 reverted → transformation_contradiction（high）。
 * 穿帮本质：已变身设定与"原形行动"描写矛盾。
 *
 * 提取（纯确定性，人名）：
 *  - transformed：句内一人名 + 变身动词
 *  - reverted：句内一人名 + 恢复动词
 *  - original：句内一人名 + 原形动词
 *
 * 记账模型：每集摘要 { ep, name, transformed, reverted, original }；
 *   按集升序过账：① reverted 解除 ② transformed 建立 ③ original 检测（同人只报1次）。
 * 输出：当前已变身名册 + issue + 架构师"变身"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface TransformationRow {
  ep: number;
  name: string;
  /** 本集 A 变身/化形 */
  transformed: boolean;
  /** 本集 A 恢复原形 */
  reverted: boolean;
  /** 本集 A 以原形行动 */
  original: boolean;
}

export interface TransformationIssue {
  severity: 'high';
  type: 'transformation_contradiction';
  evidence: string;
  advice: string;
}

export interface TransformationLedgerResult {
  /** 当前已变身名册 */
  transformed: { name: string; sinceEp: number }[];
  issues: TransformationIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TF_ZH = ['变身', '化形', '变形', '化作', '变成', '化作人形', '化身'];
const REV_ZH = ['恢复原形', '恢复了原形', '变回原形', '恢复本体', '恢复了本体', '变回本体', '复原', '收了神通'];
const ORIG_ZH = ['原形', '本体', '本来面目', '真身', '原本的样子'];

const TF_EN = ['transformed', 'shape-shifted', 'shapeshifted', 'changed form', 'turned into', 'morphed'];
const REV_EN = ['reverted', 'turned back', 'changed back', 'returned to normal', 'back to his form', 'back to her form'];
const ORIG_EN = ['his true form', 'her true form', 'his original form', 'her original form', 'in his body', 'in her body'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

export function deriveTransformationRows(draft: string, names: string[]): Omit<TransformationRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<TransformationRow, 'ep'>[] = [];
  const tfW = isZh ? TF_ZH : TF_EN;
  const revW = isZh ? REV_ZH : REV_EN;
  const origW = isZh ? ORIG_ZH : ORIG_EN;

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    for (const n of validNames) {
      if (!nameIn(sent, n, isZh)) continue;
      const transformed = tfW.some((w) => wordHit(sent, w, isZh));
      const reverted = revW.some((w) => wordHit(sent, w, isZh));
      const original = origW.some((w) => wordHit(sent, w, isZh));
      if (!transformed && !reverted && !original) continue;
      const existing = out.find((x) => x.name === n);
      if (existing) {
        existing.transformed = existing.transformed || transformed;
        existing.reverted = existing.reverted || reverted;
        existing.original = existing.original || original;
      } else {
        out.push({ name: n, transformed, reverted, original });
      }
    }
  }
  return out;
}

export function normalizeTransformationRow(raw: Record<string, unknown>): TransformationRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name,
    transformed: bl(raw.transformed),
    reverted: bl(raw.reverted),
    original: bl(raw.original),
  };
}

export function transformationLedger(rows: TransformationRow[], currentEp: number): TransformationLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || x.name.localeCompare(y.name));
  const state = new Map<string, number>();
  const issues: TransformationIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, TransformationRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① reverted 解除
    for (const r of epRows) {
      if (r.reverted) state.delete(r.name);
    }
    // ② transformed 建立
    for (const r of epRows) {
      if (r.transformed) state.set(r.name, ep);
    }
    // ③ original 检测
    for (const r of epRows) {
      if (!r.original) continue;
      const since = state.get(r.name);
      const hasReverted = epRows.some((x) => x.name === r.name && x.reverted);
      if (since !== undefined && !hasReverted) {
        if (!reported.has(r.name)) {
          reported.add(r.name);
          issues.push({
            severity: 'high',
            type: 'transformation_contradiction',
            evidence: `${r.name} 自第 ${since} 集变身，本集却以原形行动（无恢复交代）`,
            advice: `补充 ${r.name} 恢复原形的交代，或先描写变身状态再安排恢复`,
          });
        }
      }
    }
  }

  const transformed = [...state.entries()].map(([name, sinceEp]) => ({ name, sinceEp }))
    .sort((x, y) => x.sinceEp - y.sinceEp);
  return { transformed, issues };
}

export function transformationDirective(rows: TransformationRow[]): { en: string; zh: string } {
  const result = transformationLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【变身约束】'];
  const en: string[] = ['[Transformation Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
