/**
 * v2.80 记忆账本（Memory Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - memory-fakeout-check：单集内"记忆反转"套路检测（失忆/恢复/假记忆）；
 *  - 本引擎：跨集**失忆连续性**——
 *    角色失忆（失忆/失去记忆/记不得…）进入失忆状态；
 *    恢复（恢复记忆/想起来了/记起…）解除；
 *    失忆状态下无恢复交代却记得关键信息（记得/想起/回忆/认出…）= 记忆穿帮（high）。
 *
 * 提取（纯确定性，人名触发）：
 *  - lost：句内人名 + 失忆动词（失忆/失去记忆/记不得/忘了一切…）→ 进入失忆
 *  - restored：句内人名 + 恢复动词（恢复记忆/想起来了/记起/恢复了记忆…）→ 解除失忆
 *  - recalled：句内人名 + 回忆动词（记得/想起/回忆/认出/想起了…）→ 检测穿帮
 *
 * 记账模型（与人情债账本同构，纯确定性）：
 *   每集摘要 { ep, name, lost, restored, recalled }：
 *   按集升序过账：
 *     ① restored 解除失忆；
 *     ② lost 进入失忆；
 *     ③ recalled 行：若 name 仍失忆且本集无 restored → memory_breach（high，同人只报1次）。
 * 输出：当前失忆名册 + issue + 架构师"记忆"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface MemoryRow {
  ep: number;
  name: string;
  /** 本集失忆 */
  lost: boolean;
  /** 本集恢复记忆 */
  restored: boolean;
  /** 本集回忆/记得 */
  recalled: boolean;
}

export interface MemoryIssue {
  severity: 'high';
  type: 'memory_breach';
  evidence: string;
  advice: string;
}

export interface MemoryLedgerResult {
  /** 当前失忆名册 */
  amnesiacs: { name: string; sinceEp: number }[];
  issues: MemoryIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LOST_ZH = ['失忆', '失去记忆', '记不得', '忘了一切', '什么都不记得', '不记得了', '失去了记忆', '记忆全无'];
const RESTORED_ZH = ['恢复记忆', '想起来了', '记起了', '恢复了记忆', '记忆恢复', '全都想起来', '找回记忆'];
const RECALLED_ZH = ['记得', '想起了', '回忆起', '认出了', '想起', '回忆', '记得了', '想起来'];

const LOST_EN = ['lost his memory', 'lost her memory', 'amnesia', 'forgot everything', 'cannot remember', 'could not remember'];
const RESTORED_EN = ['regained his memory', 'regained her memory', 'remembered everything', 'memory returned', 'recovered memory'];
const RECALLED_EN = ['remembered', 'recalled', 'recognized', 'thought of', 'reminisced'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

export function deriveMemoryRows(draft: string, names: string[]): Omit<MemoryRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Map<string, Omit<MemoryRow, 'ep'>> = new Map();
  const lostW = isZh ? LOST_ZH : LOST_EN;
  const restW = isZh ? RESTORED_ZH : RESTORED_EN;
  const recW = isZh ? RECALLED_ZH : RECALLED_EN;

  const push = (name: string, lost: boolean, restored: boolean, recalled: boolean) => {
    const existing = out.get(name);
    if (existing) {
      existing.lost = existing.lost || lost;
      existing.restored = existing.restored || restored;
      existing.recalled = existing.recalled || recalled;
    } else {
      out.set(name, { name, lost, restored, recalled });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    for (const name of validNames) {
      if (!nameIn(sent, name, isZh)) continue;
      if (lostW.some((w) => wordHit(sent, w, isZh))) push(name, true, false, false);
      if (restW.some((w) => wordHit(sent, w, isZh))) push(name, false, true, false);
      if (recW.some((w) => wordHit(sent, w, isZh))) push(name, false, false, true);
    }
  }
  return [...out.values()];
}

export function normalizeMemoryRow(raw: Record<string, unknown>): MemoryRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name,
    lost: bl(raw.lost),
    restored: bl(raw.restored),
    recalled: bl(raw.recalled),
  };
}

export function memoryLedger(rows: MemoryRow[], currentEp: number): MemoryLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || x.name.localeCompare(y.name));
  const state = new Map<string, number>();
  const amnesiacs: { name: string; sinceEp: number }[] = [];
  const issues: MemoryIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, MemoryRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① restored 解除失忆
    for (const r of epRows) {
      if (r.restored) state.delete(r.name);
    }
    // ② lost 进入失忆
    for (const r of epRows) {
      if (r.lost) state.set(r.name, ep);
    }
    // ③ recalled 检测
    for (const r of epRows) {
      if (!r.recalled) continue;
      const since = state.get(r.name);
      const hasRestored = epRows.some((x) => x.name === r.name && x.restored);
      if (since !== undefined && !hasRestored) {
        if (!reported.has(r.name)) {
          reported.add(r.name);
          issues.push({
            severity: 'high',
            type: 'memory_breach',
            evidence: `${r.name} 自第 ${since} 集失忆，本集却回忆起关键信息（无恢复交代）`,
            advice: `补充 ${r.name} 记忆恢复的交代（刺激/治疗/触发），或本集改为模糊印象`,
          });
        }
      }
    }
  }

  for (const [name, sinceEp] of state) amnesiacs.push({ name, sinceEp });
  amnesiacs.sort((x, y) => x.sinceEp - y.sinceEp);
  return { amnesiacs, issues };
}

export function memoryDirective(rows: MemoryRow[]): { en: string; zh: string } {
  const result = memoryLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【记忆约束】'];
  const en: string[] = ['[Memory Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
