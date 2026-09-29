/**
 * v2.80 穿越账本（Time-Travel Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - timeline-ledger：管事件时间线顺序（事件先后逻辑）；
 *  - transmigrate-craft 等：仅题材/风味层"穿越"分类，不维护状态；
 *  - 本引擎：管**人物时空归属状态连续性**（与 memory/curse/possession 同构）：
 *    - traveled：A 穿越/回到过去/来到未来 → 建立"已穿越"状态；
 *    - returned：A 回到原时间线 → 解除；
 *    - native：A 在原时间线正常行动/出现 →
 *      若 A 仍处已穿越状态且本集无 returned → time_travel_contradiction（high）。
 * 穿帮本质：已穿越设定与"原时间线行动"描写矛盾。
 *
 * 提取（纯确定性，人名）：
 *  - traveled：句内一人名 + 穿越动词
 *  - returned：句内一人名 + 回归动词
 *  - native：句内一人名 + 原时间线动词
 *
 * 记账模型：每集摘要 { ep, name, traveled, returned, native }；
 *   按集升序过账：① returned 解除 ② traveled 建立 ③ native 检测（同人只报1次）。
 * 输出：当前已穿越名册 + issue + 架构师"穿越"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface TimeTravelRow {
  ep: number;
  name: string;
  /** 本集 A 穿越到异时空 */
  traveled: boolean;
  /** 本集 A 回到原时间线 */
  returned: boolean;
  /** 本集 A 在原时间线正常行动 */
  native: boolean;
}

export interface TimeTravelIssue {
  severity: 'high';
  type: 'time_travel_contradiction';
  evidence: string;
  advice: string;
}

export interface TimeTravelLedgerResult {
  /** 当前已穿越名册 */
  traveled: { name: string; sinceEp: number }[];
  issues: TimeTravelIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TRAV_ZH = ['穿越', '回到过去', '回到未来', '穿越到', '回到古代', '来到未来', '重生', '时空穿梭'];
const RET_ZH = ['回到原时间线', '回到现实', '回到现代', '回到了现代', '回到原本', '穿回来了', '回来了', '回归'];
const NAT_ZH = ['现代', '原本的世界', '原来的时代', '自己的时代', '现实世界', '原本时间线'];

const TRAV_EN = ['traveled through time', 'went back in time', 'traveled to the future', 'time traveled', 'jumped through time'];
const RET_EN = ['returned to the present', 'came back', 'returned to his time', 'returned to her time', 'back to the present'];
const NAT_EN = ['the present', 'his own time', 'her own time', 'the real world', 'back in his era', 'back in her era'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

export function deriveTimeTravelRows(draft: string, names: string[]): Omit<TimeTravelRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<TimeTravelRow, 'ep'>[] = [];
  const travW = isZh ? TRAV_ZH : TRAV_EN;
  const retW = isZh ? RET_ZH : RET_EN;
  const natW = isZh ? NAT_ZH : NAT_EN;

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    for (const n of validNames) {
      if (!nameIn(sent, n, isZh)) continue;
      const traveled = travW.some((w) => wordHit(sent, w, isZh));
      const returned = retW.some((w) => wordHit(sent, w, isZh));
      const native = natW.some((w) => wordHit(sent, w, isZh));
      if (!traveled && !returned && !native) continue;
      const existing = out.find((x) => x.name === n);
      if (existing) {
        existing.traveled = existing.traveled || traveled;
        existing.returned = existing.returned || returned;
        existing.native = existing.native || native;
      } else {
        out.push({ name: n, traveled, returned, native });
      }
    }
  }
  return out;
}

export function normalizeTimeTravelRow(raw: Record<string, unknown>): TimeTravelRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name,
    traveled: bl(raw.traveled),
    returned: bl(raw.returned),
    native: bl(raw.native),
  };
}

export function timeTravelLedger(rows: TimeTravelRow[], currentEp: number): TimeTravelLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || x.name.localeCompare(y.name));
  const state = new Map<string, number>();
  const issues: TimeTravelIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, TimeTravelRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① returned 解除
    for (const r of epRows) {
      if (r.returned) state.delete(r.name);
    }
    // ② traveled 建立
    for (const r of epRows) {
      if (r.traveled) state.set(r.name, ep);
    }
    // ③ native 检测
    for (const r of epRows) {
      if (!r.native) continue;
      const since = state.get(r.name);
      const hasReturned = epRows.some((x) => x.name === r.name && x.returned);
      if (since !== undefined && !hasReturned) {
        if (!reported.has(r.name)) {
          reported.add(r.name);
          issues.push({
            severity: 'high',
            type: 'time_travel_contradiction',
            evidence: `${r.name} 自第 ${since} 集穿越，本集却在原时间线行动（无回归交代）`,
            advice: `补充 ${r.name} 回归原时间线的交代，或先描写穿越状态再安排回归`,
          });
        }
      }
    }
  }

  const traveled = [...state.entries()].map(([name, sinceEp]) => ({ name, sinceEp }))
    .sort((x, y) => x.sinceEp - y.sinceEp);
  return { traveled, issues };
}

export function timeTravelDirective(rows: TimeTravelRow[]): { en: string; zh: string } {
  const result = timeTravelLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【穿越约束】'];
  const en: string[] = ['[Time-Travel Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
