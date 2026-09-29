/**
 * v2.80 牺牲账本（Sacrifice Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - debt-ledger：管"欠人情→还/背叛"的施恩偿还连续性（owed/repaid/betrayed）；
 *  - 本引擎：管**重大牺牲事件后的感恩连续性**——
 *    A 为 B 牺牲（挡刀/舍命/献祭/替死…）进入"待感恩"状态；
 *    感恩（感恩/致谢/报答/铭记…）解除；
 *    待感恩状态下无感恩交代却轻慢/伤害（轻慢/抛弃/伤害/冷待…）= 忘恩穿帮（high）。
 *
 * 提取（纯确定性，人名配对）：
 *  - sacrificed：句内两人名 + 牺牲动词 → A 为 B 牺牲
 *  - thanked：句内两人名 + 感恩动词 → A 感恩 B（解除 B→A 的待感恩状态）
 *  - mistreated：句内两人名 + 轻慢动词 → A 轻慢 B
 *
 * 记账模型（同 alliance/betrayal 结构）：
 *   每集摘要 { ep, giver, receiver, sacrificed, thanked, mistreated }：
 *   按集升序过账：
 *     ① thanked 解除待感恩（receiver 感恩 giver，或双向）；
 *     ② sacrificed 建立待感恩（giver 为 receiver 牺牲）；
 *     ③ mistreated：若 A 仍待 B 的牺牲恩情且本集无 thanked → ingratitude_breach（high，同对只报1次）。
 * 注意：mistreated 行的 giver/receiver 取句中前两人名，检测时以"被牺牲方 mistreat 了牺牲方"为准，
 * 因此 mistreated 检测需将行的 (giver, receiver) 视为"轻慢者→被轻慢者"，反向匹配待感恩状态。
 * 输出：当前待感恩名册 + issue + 架构师"牺牲"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface SacrificeRow {
  ep: number;
  /** 牺牲付出方 A */
  giver: string;
  /** 接受牺牲方 B */
  receiver: string;
  /** 本集 A 为 B 牺牲 */
  sacrificed: boolean;
  /** 本集 B 感恩 A */
  thanked: boolean;
  /** 本集 B 轻慢 A */
  mistreated: boolean;
}

export interface SacrificeIssue {
  severity: 'high';
  type: 'ingratitude_breach';
  evidence: string;
  advice: string;
}

export interface SacrificeLedgerResult {
  /** 当前待感恩名册（giver 曾为 receiver 牺牲，未获感恩） */
  debts: { giver: string; receiver: string; sinceEp: number }[];
  issues: SacrificeIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SAC_ZH = ['挡刀', '舍命', '替死', '挡枪', '献祭', '以命换命', '代罚', '替死鬼', '舍身', '牺牲自己'];
const THX_ZH = ['感恩', '致谢', '报答', '铭记', '感激', '道谢', '感恩戴德', '没齿难忘'];
const MIS_ZH = ['轻慢', '抛弃', '冷待', '辜负', '恩将仇报', '嫌弃', '弃如敝履', '过河拆桥'];

const SAC_EN = ['took the blade', 'sacrificed', 'died for', 'took the bullet', 'gave their life', 'sacrificed themselves'];
const THX_EN = ['thanked', 'grateful', 'owed a debt of gratitude', 'appreciated', 'acknowledged the sacrifice'];
const MIS_EN = ['betrayed', 'abandoned', 'ingrate', 'ungrateful', 'turned on', 'cast aside'];

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
  return `${a}->${b}`;
}

export function deriveSacrificeRows(draft: string, names: string[]): Omit<SacrificeRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<SacrificeRow, 'ep'>[] = [];
  const sacW = isZh ? SAC_ZH : SAC_EN;
  const thxW = isZh ? THX_ZH : THX_EN;
  const misW = isZh ? MIS_ZH : MIS_EN;

  const pushRow = (giver: string, receiver: string, sacrificed: boolean, thanked: boolean, mistreated: boolean) => {
    if (giver === receiver) return;
    const key = pairKey(giver, receiver);
    const existing = out.find((x) => pairKey(x.giver, x.receiver) === key);
    if (existing) {
      existing.sacrificed = existing.sacrificed || sacrificed;
      existing.thanked = existing.thanked || thanked;
      existing.mistreated = existing.mistreated || mistreated;
    } else {
      out.push({ giver, receiver, sacrificed, thanked, mistreated });
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

    // sacrificed：A 为 B 牺牲 → giver=A, receiver=B
    if (sacW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, true, false, false);
    // thanked：B 感恩 A → giver=A(牺牲方), receiver=B(感恩方)，行内 giver=被感恩者=牺牲方
    if (thxW.some((w) => wordHit(sent, w, isZh))) pushRow(b, a, false, true, false);
    // mistreated：B 轻慢 A → giver=A(被轻慢=牺牲方), receiver=B(轻慢方)
    if (misW.some((w) => wordHit(sent, w, isZh))) pushRow(b, a, false, false, true);
  }
  return out;
}

export function normalizeSacrificeRow(raw: Record<string, unknown>): SacrificeRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const giver = typeof raw.giver === 'string' ? raw.giver : '';
  const receiver = typeof raw.receiver === 'string' ? raw.receiver : '';
  if (!Number.isFinite(ep) || !giver || !receiver || giver === receiver) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, giver, receiver,
    sacrificed: bl(raw.sacrificed),
    thanked: bl(raw.thanked),
    mistreated: bl(raw.mistreated),
  };
}

export function sacrificeLedger(rows: SacrificeRow[], currentEp: number): SacrificeLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || pairKey(x.giver, x.receiver).localeCompare(pairKey(y.giver, y.receiver)));
  // 状态：giver->receiver 表示 giver 曾为 receiver 牺牲，receiver 尚未感恩
  const state = new Map<string, number>();
  const debts: { giver: string; receiver: string; sinceEp: number }[] = [];
  const issues: SacrificeIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, SacrificeRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① thanked 解除待感恩：giver(被感恩=牺牲方) 解除 receiver(感恩方) 对其的待感恩
    for (const r of epRows) {
      if (r.thanked) state.delete(pairKey(r.giver, r.receiver));
    }
    // ② sacrificed 建立待感恩：giver 为 receiver 牺牲
    for (const r of epRows) {
      if (r.sacrificed) state.set(pairKey(r.giver, r.receiver), ep);
    }
    // ③ mistreated 检测：receiver(轻慢方) 轻慢 giver(被轻慢=牺牲方)，若 giver->receiver 待感恩存在且本集无 thanked → 穿帮
    for (const r of epRows) {
      if (!r.mistreated) continue;
      const key = pairKey(r.giver, r.receiver);
      const since = state.get(key);
      const hasThanked = epRows.some((x) => pairKey(x.giver, x.receiver) === key && x.thanked);
      if (since !== undefined && !hasThanked) {
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            severity: 'high',
            type: 'ingratitude_breach',
            evidence: `${r.receiver} 自第 ${since} 集受 ${r.giver} 牺牲之恩，本集却轻慢 ${r.giver}（无感恩交代）`,
            advice: `补充 ${r.receiver} 对 ${r.giver} 牺牲的感恩交代，或先安排情感修复再出现冲突`,
          });
        }
      }
    }
  }

  for (const [key, sinceEp] of state) {
    const [giver, receiver] = key.split('->');
    debts.push({ giver, receiver, sinceEp });
  }
  debts.sort((x, y) => x.sinceEp - y.sinceEp);
  return { debts, issues };
}

export function sacrificeDirective(rows: SacrificeRow[]): { en: string; zh: string } {
  const result = sacrificeLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【牺牲约束】'];
  const en: string[] = ['[Sacrifice Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
