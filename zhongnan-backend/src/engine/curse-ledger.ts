/**
 * v2.80 诅咒账本（Curse Ledger）
 * ------------------------------------------------------------------
 * 查重分工：现有账本无人名×诅咒状态连续性（grep 全 src 无"诅咒"命中）。
 * 本引擎管**超自然诅咒的状态连续性**（与 memory-ledger 同构）：
 *  - cursed：A 被诅咒/中咒/立下诅咒 → 建立"中咒"状态；
 *  - lifted：A 的诅咒被解除（解除/破解/驱散…）→ 解除；
 *  - unaffected：A 被描述为"不受诅咒影响/安然无恙/诅咒无效" →
 *    若 A 仍处中咒状态且本集无 lifted → curse_contradiction（high）。
 * 穿帮本质：中咒设定与"不受影响"描写矛盾（同"失忆却回忆"）。
 *
 * 提取（纯确定性，人名）：
 *  - cursed：句内一人名 + 中咒动词
 *  - lifted：句内一人名 + 解除动词
 *  - unaffected：句内一人名 + 不受影响动词
 *
 * 记账模型：每集摘要 { ep, name, cursed, lifted, unaffected }；
 *   按集升序过账：① lifted 解除 ② cursed 建立 ③ unaffected 检测（同人只报1次）。
 * 输出：当前中咒名册 + issue + 架构师"诅咒"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface CurseRow {
  ep: number;
  name: string;
  /** 本集 A 被诅咒 */
  cursed: boolean;
  /** 本集 A 的诅咒被解除 */
  lifted: boolean;
  /** 本集 A 被描写为不受诅咒影响 */
  unaffected: boolean;
}

export interface CurseIssue {
  severity: 'high';
  type: 'curse_contradiction';
  evidence: string;
  advice: string;
}

export interface CurseLedgerResult {
  /** 当前中咒名册 */
  cursed: { name: string; sinceEp: number }[];
  issues: CurseIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CUR_ZH = ['被诅咒', '中了诅咒', '立下诅咒', '受诅咒', '遭咒', '种咒', '中咒', '身中诅咒'];
const LIFT_ZH = ['解除诅咒', '破解诅咒', '诅咒消失', '驱散诅咒', '解封', '咒力消散', '破除诅咒', '诅咒被解除', '诅咒解除'];
const UNAFF_ZH = ['不受影响', '毫无反应', '安然无恙', '诅咒无效', '对他无效', '毫发无损', '不受诅咒'];

const CUR_EN = ['cursed', 'under a curse', 'hexed', 'placed a curse', 'afflicted by a curse'];
const LIFT_EN = ['curse lifted', 'broke the curse', 'curse broken', 'dispelled the curse', 'curse gone', 'curse was lifted', 'curse was broken'];
const UNAFF_EN = ['unaffected', 'no effect', 'unharmed', 'curse had no effect', 'immune to the curse'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

export function deriveCurseRows(draft: string, names: string[]): Omit<CurseRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<CurseRow, 'ep'>[] = [];
  const curW = isZh ? CUR_ZH : CUR_EN;
  const liftW = isZh ? LIFT_ZH : LIFT_EN;
  const unaffW = isZh ? UNAFF_ZH : UNAFF_EN;

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    for (const n of validNames) {
      if (!nameIn(sent, n, isZh)) continue;
      const cursed = curW.some((w) => wordHit(sent, w, isZh));
      const lifted = liftW.some((w) => wordHit(sent, w, isZh));
      const unaffected = unaffW.some((w) => wordHit(sent, w, isZh));
      if (!cursed && !lifted && !unaffected) continue;
      const existing = out.find((x) => x.name === n);
      if (existing) {
        existing.cursed = existing.cursed || cursed;
        existing.lifted = existing.lifted || lifted;
        existing.unaffected = existing.unaffected || unaffected;
      } else {
        out.push({ name: n, cursed, lifted, unaffected });
      }
    }
  }
  return out;
}

export function normalizeCurseRow(raw: Record<string, unknown>): CurseRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name,
    cursed: bl(raw.cursed),
    lifted: bl(raw.lifted),
    unaffected: bl(raw.unaffected),
  };
}

export function curseLedger(rows: CurseRow[], currentEp: number): CurseLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || x.name.localeCompare(y.name));
  const state = new Map<string, number>();
  const issues: CurseIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, CurseRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① lifted 解除
    for (const r of epRows) {
      if (r.lifted) state.delete(r.name);
    }
    // ② cursed 建立
    for (const r of epRows) {
      if (r.cursed) state.set(r.name, ep);
    }
    // ③ unaffected 检测
    for (const r of epRows) {
      if (!r.unaffected) continue;
      const since = state.get(r.name);
      const hasLifted = epRows.some((x) => x.name === r.name && x.lifted);
      if (since !== undefined && !hasLifted) {
        if (!reported.has(r.name)) {
          reported.add(r.name);
          issues.push({
            severity: 'high',
            type: 'curse_contradiction',
            evidence: `${r.name} 自第 ${since} 集中咒，本集却被描写为不受诅咒影响（无解除交代）`,
            advice: `补充 ${r.name} 诅咒解除的交代，或先描写诅咒发作再安排破解`,
          });
        }
      }
    }
  }

  const cursed = [...state.entries()].map(([name, sinceEp]) => ({ name, sinceEp }))
    .sort((x, y) => x.sinceEp - y.sinceEp);
  return { cursed, issues };
}

export function curseDirective(rows: CurseRow[]): { en: string; zh: string } {
  const result = curseLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【诅咒约束】'];
  const en: string[] = ['[Curse Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
