/**
 * v2.80 中毒账本（Poison Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - curse-ledger：管超自然诅咒（中咒/解除/不受影响）；
 *  - wound-recovery：管伤势恢复；
 *  - 本引擎：管**生理中毒状态连续性**（与 memory/curse/possession/time-travel/transformation 同构）：
 *    - poisoned：A 中毒/身中剧毒 → 建立"已中毒"状态；
 *    - cured：A 解毒/服下解药 → 解除；
 *    - healthy：A 运功/无恙/行动自如 →
 *      若 A 仍处已中毒状态且本集无 cured → poison_contradiction（high）。
 * 穿帮本质：已中毒设定与"无恙行动"描写矛盾。
 *
 * 提取（纯确定性，人名）：
 *  - poisoned：句内一人名 + 中毒动词
 *  - cured：句内一人名 + 解毒动词
 *  - healthy：句内一人名 + 无恙动词
 *
 * 记账模型：每集摘要 { ep, name, poisoned, cured, healthy }；
 *   按集升序过账：① cured 解除 ② poisoned 建立 ③ healthy 检测（同人只报1次）。
 * 输出：当前已中毒名册 + issue + 架构师"中毒"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface PoisonRow {
  ep: number;
  name: string;
  /** 本集 A 中毒 */
  poisoned: boolean;
  /** 本集 A 解毒 */
  cured: boolean;
  /** 本集 A 无恙/行动自如 */
  healthy: boolean;
}

export interface PoisonIssue {
  severity: 'high';
  type: 'poison_contradiction';
  evidence: string;
  advice: string;
}

export interface PoisonLedgerResult {
  /** 当前已中毒名册 */
  poisoned: { name: string; sinceEp: number }[];
  issues: PoisonIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const POI_ZH = ['中毒', '身中剧毒', '下毒', '中了毒', '毒发', '身中奇毒', '中毒了'];
const CUR_ZH = ['解毒', '服下解药', '服下了解药', '服了解药', '清除毒素', '逼出毒', '毒解了', '解了毒'];
const HEA_ZH = ['运功', '无恙', '行动自如', '健步如飞', '安然无恙', '生龙活虎', '毫发无损'];

const POI_EN = ['poisoned', 'took poison', 'was poisoned', 'struck by poison', 'ingested poison'];
const CUR_EN = ['cured the poison', 'took the antidote', 'neutralized the poison', 'detoxified', 'the antidote'];
const HEA_EN = ['unharmed', 'in good health', 'moved freely', 'full of energy', 'sound and well'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

export function derivePoisonRows(draft: string, names: string[]): Omit<PoisonRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<PoisonRow, 'ep'>[] = [];
  const poiW = isZh ? POI_ZH : POI_EN;
  const curW = isZh ? CUR_ZH : CUR_EN;
  const heaW = isZh ? HEA_ZH : HEA_EN;

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    for (const n of validNames) {
      if (!nameIn(sent, n, isZh)) continue;
      const poisoned = poiW.some((w) => wordHit(sent, w, isZh));
      const cured = curW.some((w) => wordHit(sent, w, isZh));
      const healthy = heaW.some((w) => wordHit(sent, w, isZh));
      if (!poisoned && !cured && !healthy) continue;
      const existing = out.find((x) => x.name === n);
      if (existing) {
        existing.poisoned = existing.poisoned || poisoned;
        existing.cured = existing.cured || cured;
        existing.healthy = existing.healthy || healthy;
      } else {
        out.push({ name: n, poisoned, cured, healthy });
      }
    }
  }
  return out;
}

export function normalizePoisonRow(raw: Record<string, unknown>): PoisonRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name,
    poisoned: bl(raw.poisoned),
    cured: bl(raw.cured),
    healthy: bl(raw.healthy),
  };
}

export function poisonLedger(rows: PoisonRow[], currentEp: number): PoisonLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || x.name.localeCompare(y.name));
  const state = new Map<string, number>();
  const issues: PoisonIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, PoisonRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① cured 解除
    for (const r of epRows) {
      if (r.cured) state.delete(r.name);
    }
    // ② poisoned 建立
    for (const r of epRows) {
      if (r.poisoned) state.set(r.name, ep);
    }
    // ③ healthy 检测
    for (const r of epRows) {
      if (!r.healthy) continue;
      const since = state.get(r.name);
      const hasCured = epRows.some((x) => x.name === r.name && x.cured);
      if (since !== undefined && !hasCured) {
        if (!reported.has(r.name)) {
          reported.add(r.name);
          issues.push({
            severity: 'high',
            type: 'poison_contradiction',
            evidence: `${r.name} 自第 ${since} 集中毒，本集却无恙行动（无解毒交代）`,
            advice: `补充 ${r.name} 解毒的交代，或先描写中毒症状再安排解毒`,
          });
        }
      }
    }
  }

  const poisoned = [...state.entries()].map(([name, sinceEp]) => ({ name, sinceEp }))
    .sort((x, y) => x.sinceEp - y.sinceEp);
  return { poisoned, issues };
}

export function poisonDirective(rows: PoisonRow[]): { en: string; zh: string } {
  const result = poisonLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【中毒约束】'];
  const en: string[] = ['[Poison Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
