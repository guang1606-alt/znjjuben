/**
 * v2.80 附身账本（Possession Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - curse-ledger：管"中咒/解除/不受影响"诅咒状态连续性；
 *  - memory-ledger：管"失忆/恢复/回忆"记忆状态连续性；
 *  - power-progress-ledger：仅把"夺舍/附身"当作单集身份洗牌豁免信号重置境界追踪，不维护附身状态；
 *  - 本引擎：管**附身/夺舍的意识状态连续性**（与 curse/memory 同构）：
 *    - possessed：A 被附身/夺舍/附体 → 建立"被附身"状态；
 *    - freed：A 被解除附身（逼出/驱离/夺回身体…）→ 解除；
 *    - self_willed：A 被描写为按本人意志行动（自己/本人/恢复意识…）→
 *      若 A 仍处被附身状态且本集无 freed → possession_contradiction（high）。
 * 穿帮本质：被附身设定与"本人意志行动"描写矛盾。
 *
 * 提取（纯确定性，人名）：
 *  - possessed：句内一人名 + 附身动词
 *  - freed：句内一人名 + 解除附身动词
 *  - self_willed：句内一人名 + 本人意志动词
 *
 * 记账模型：每集摘要 { ep, name, possessed, freed, self_willed }；
 *   按集升序过账：① freed 解除 ② possessed 建立 ③ self_willed 检测（同人只报1次）。
 * 输出：当前被附身名册 + issue + 架构师"附身"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface PossessionRow {
  ep: number;
  name: string;
  /** 本集 A 被附身 */
  possessed: boolean;
  /** 本集 A 解除附身 */
  freed: boolean;
  /** 本集 A 按本人意志行动 */
  self_willed: boolean;
}

export interface PossessionIssue {
  severity: 'high';
  type: 'possession_contradiction';
  evidence: string;
  advice: string;
}

export interface PossessionLedgerResult {
  /** 当前被附身名册 */
  possessed: { name: string; sinceEp: number }[];
  issues: PossessionIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const POS_ZH = ['被附身', '被夺舍', '附身', '夺舍', '附体', '上身', '被附体', '被上身'];
const FREE_ZH = ['逼出', '驱离', '夺回身体', '解除附身', '赶出体外', '脱离身体', '逐出'];
const WILL_ZH = ['自己', '本人', '恢复意识', '恢复了意识', '我自己', '本我', '恢复神智', '意识回归'];

const POS_EN = ['possessed', 'taken over', 'body snatched', 'occupied', 'hijacked'];
const FREE_EN = ['exorcised', 'freed from possession', 'regained control', 'driven out', 'expelled'];
const WILL_EN = ['myself', 'his own will', 'her own will', 'conscious again', 'back to himself', 'back to herself'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

export function derivePossessionRows(draft: string, names: string[]): Omit<PossessionRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<PossessionRow, 'ep'>[] = [];
  const posW = isZh ? POS_ZH : POS_EN;
  const freeW = isZh ? FREE_ZH : FREE_EN;
  const willW = isZh ? WILL_ZH : WILL_EN;

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    for (const n of validNames) {
      if (!nameIn(sent, n, isZh)) continue;
      const possessed = posW.some((w) => wordHit(sent, w, isZh));
      const freed = freeW.some((w) => wordHit(sent, w, isZh));
      const self_willed = willW.some((w) => wordHit(sent, w, isZh));
      if (!possessed && !freed && !self_willed) continue;
      const existing = out.find((x) => x.name === n);
      if (existing) {
        existing.possessed = existing.possessed || possessed;
        existing.freed = existing.freed || freed;
        existing.self_willed = existing.self_willed || self_willed;
      } else {
        out.push({ name: n, possessed, freed, self_willed });
      }
    }
  }
  return out;
}

export function normalizePossessionRow(raw: Record<string, unknown>): PossessionRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name,
    possessed: bl(raw.possessed),
    freed: bl(raw.freed),
    self_willed: bl(raw.self_willed),
  };
}

export function possessionLedger(rows: PossessionRow[], currentEp: number): PossessionLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || x.name.localeCompare(y.name));
  const state = new Map<string, number>();
  const issues: PossessionIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, PossessionRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① freed 解除
    for (const r of epRows) {
      if (r.freed) state.delete(r.name);
    }
    // ② possessed 建立
    for (const r of epRows) {
      if (r.possessed) state.set(r.name, ep);
    }
    // ③ self_willed 检测
    for (const r of epRows) {
      if (!r.self_willed) continue;
      const since = state.get(r.name);
      const hasFreed = epRows.some((x) => x.name === r.name && x.freed);
      if (since !== undefined && !hasFreed) {
        if (!reported.has(r.name)) {
          reported.add(r.name);
          issues.push({
            severity: 'high',
            type: 'possession_contradiction',
            evidence: `${r.name} 自第 ${since} 集被附身，本集却按本人意志行动（无解除交代）`,
            advice: `补充 ${r.name} 解除附身的交代，或先描写附身状态再安排夺回身体`,
          });
        }
      }
    }
  }

  const possessed = [...state.entries()].map(([name, sinceEp]) => ({ name, sinceEp }))
    .sort((x, y) => x.sinceEp - y.sinceEp);
  return { possessed, issues };
}

export function possessionDirective(rows: PossessionRow[]): { en: string; zh: string } {
  const result = possessionLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【附身约束】'];
  const en: string[] = ['[Possession Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
