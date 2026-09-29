/**
 * v2.80 背叛账本（Betrayal Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - debt-ledger：管"欠债状态下背叛"（恩将仇报，debt_betrayal）；
 *  - relationship-ledger：管显式决裂/和好关系状态（rift/reconciled/close）；
 *  - 本引擎：管**无条件背叛后的信任连续性**——
 *    A 背叛 B（背叛/出卖/倒戈…）进入"信任破裂"状态；
 *    和解（和好/和解/冰释前嫌…）解除；
 *    信任破裂状态下无和解交代却亲密合作（合作/并肩/信任/联手…）= 信任穿帮（high）。
 *
 * 提取（纯确定性，人名配对）：
 *  - betrayed：句内两人名 + 背叛动词 → A 背叛 B
 *  - reconciled：句内两人名 + 和解动词 → A 与 B 和解
 *  - cooperated：句内两人名 + 合作动词 → A 与 B 亲密合作
 *
 * 记账模型（与 alliance-ledger 同构，纯确定性）：
 *   每集摘要 { ep, betrayer, victim, betrayed, reconciled, cooperated }：
 *   按集升序过账：
 *     ① reconciled 解除信任破裂；
 *     ② betrayed 建立信任破裂；
 *     ③ cooperated：若 A-B 仍信任破裂且本集无 reconciled → trust_breach（high，同对只报1次）。
 * 输出：当前信任破裂名册 + issue + 架构师"背叛"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface BetrayalRow {
  ep: number;
  /** 背叛者 A */
  betrayer: string;
  /** 被背叛者 B */
  victim: string;
  /** 本集 A 背叛 B */
  betrayed: boolean;
  /** 本集 A 与 B 和解 */
  reconciled: boolean;
  /** 本集 A 与 B 亲密合作 */
  cooperated: boolean;
}

export interface BetrayalIssue {
  severity: 'high';
  type: 'trust_breach';
  evidence: string;
  advice: string;
}

export interface BetrayalLedgerResult {
  /** 当前信任破裂名册 */
  breaches: { betrayer: string; victim: string; sinceEp: number }[];
  issues: BetrayalIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BETRAY_ZH = ['背叛', '出卖', '倒戈', '背弃', '捅刀子', '背后一刀', '卖友求荣', '背信弃义', '反水'];
const RECON_ZH = ['和好', '和解', '冰释前嫌', '重修旧好', '言归于好', '握手言和', '尽释前嫌', '化干戈为玉帛'];
const COOP_ZH = ['合作', '并肩', '信任', '联手', '同心协力', '同舟共济', '齐心协力', '配合默契'];

const BETRAY_EN = ['betrayed', 'sold out', 'double-crossed', 'stabbed in the back', 'turned against', 'deserted', 'switched sides'];
const RECON_EN = ['made up', 'reconciled', 'buried the hatchet', 'patched things up', 'forgave each other'];
const COOP_EN = ['cooperated', 'worked together', 'teamed up', 'trusted each other', 'joined forces', 'stood together'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

export function deriveBetrayalRows(draft: string, names: string[]): Omit<BetrayalRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<BetrayalRow, 'ep'>[] = [];
  const betrayW = isZh ? BETRAY_ZH : BETRAY_EN;
  const reconW = isZh ? RECON_ZH : RECON_EN;
  const coopW = isZh ? COOP_ZH : COOP_EN;

  const pushRow = (a: string, b: string, betrayed: boolean, reconciled: boolean, cooperated: boolean) => {
    if (a === b) return;
    const key = pairKey(a, b);
    const existing = out.find((x) => pairKey(x.betrayer, x.victim) === key);
    if (existing) {
      existing.betrayed = existing.betrayed || betrayed;
      existing.reconciled = existing.reconciled || reconciled;
      existing.cooperated = existing.cooperated || cooperated;
    } else {
      out.push({ betrayer: a, victim: b, betrayed, reconciled, cooperated });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh))
      .sort((a, b) => sent.indexOf(a) - sent.indexOf(b))
      .slice(0, MAX_NAMES_PER_SENT);
    if (hitNames.length < 2) continue;
    const a = hitNames[0];
    const b = hitNames[1];

    if (betrayW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, true, false, false);
    if (reconW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, false, true, false);
    if (coopW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, false, false, true);
  }
  return out;
}

export function normalizeBetrayalRow(raw: Record<string, unknown>): BetrayalRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const betrayer = typeof raw.betrayer === 'string' ? raw.betrayer : '';
  const victim = typeof raw.victim === 'string' ? raw.victim : '';
  if (!Number.isFinite(ep) || !betrayer || !victim || betrayer === victim) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, betrayer, victim,
    betrayed: bl(raw.betrayed),
    reconciled: bl(raw.reconciled),
    cooperated: bl(raw.cooperated),
  };
}

export function betrayalLedger(rows: BetrayalRow[], currentEp: number): BetrayalLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || pairKey(x.betrayer, x.victim).localeCompare(pairKey(y.betrayer, y.victim)));
  const state = new Map<string, number>();
  const breaches: { betrayer: string; victim: string; sinceEp: number }[] = [];
  const issues: BetrayalIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, BetrayalRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① reconciled 解除信任破裂
    for (const r of epRows) {
      if (r.reconciled) state.delete(pairKey(r.betrayer, r.victim));
    }
    // ② betrayed 建立信任破裂
    for (const r of epRows) {
      if (r.betrayed) state.set(pairKey(r.betrayer, r.victim), ep);
    }
    // ③ cooperated 检测
    for (const r of epRows) {
      if (!r.cooperated) continue;
      const key = pairKey(r.betrayer, r.victim);
      const since = state.get(key);
      const hasReconciled = epRows.some((x) => pairKey(x.betrayer, x.victim) === key && x.reconciled);
      if (since !== undefined && !hasReconciled) {
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            severity: 'high',
            type: 'trust_breach',
            evidence: `${r.betrayer} 自第 ${since} 集背叛 ${r.victim}，本集却亲密合作（无和解交代）`,
            advice: `补充 ${r.betrayer} 与 ${r.victim} 和解的交代，或先安排信任修复再合作`,
          });
        }
      }
    }
  }

  for (const [key, sinceEp] of state) {
    const [betrayer, victim] = key.split('::');
    breaches.push({ betrayer, victim, sinceEp });
  }
  breaches.sort((x, y) => x.sinceEp - y.sinceEp);
  return { breaches, issues };
}

export function betrayalDirective(rows: BetrayalRow[]): { en: string; zh: string } {
  const result = betrayalLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【背叛约束】'];
  const en: string[] = ['[Betrayal Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
