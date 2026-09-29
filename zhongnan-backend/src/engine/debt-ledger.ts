/**
 * v2.80 人情债账本（Debt Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - humiliation-ledger：管"屈辱债"（被羞辱后复仇的爽点线）；本引擎管"恩情/人情"——
 *    A 对 B 有恩（救命/相助/赠物）→ B 欠 A 人情；偿还（报恩/报答）消除；
 *    欠债状态下无交代却恩将仇报（背叛/出卖/反目）= 人情穿帮（high）。
 *    注：恩将仇报本身是强戏剧冲突，仅在"欠债状态下无任何交代直接背叛"时报，
 *    作为架构师提示（可设计为有反转/误会/被胁迫的合理剧情）。
 *  - promise-ledger：管誓言线欠账推进；本引擎管施恩/报恩/背叛的人际债务连续性。
 *
 * 提取（纯确定性，人名配对）：
 *  - owed：句内两人名 + 施恩动词（救了/帮了/相助/赠给/借给/扶持…）
 *    → creditor=动词前人名（施恩者），debtor=动词后人名（受恩者）
 *  - repaid：句内两人名 + 偿还动词（报恩/还人情/报答/酬谢/涌泉相报…）→ 消除债务
 *  - betrayed：句内两人名 + 背叛动词（背叛/出卖/反目/恩将仇报/倒戈…）→ 检测穿帮
 *
 * 记账模型（与伪装账本同构，纯确定性）：
 *   每集摘要 { ep, debtor, creditor, owed, repaid, betrayed }：
 *   按集升序过账：
 *     ① repaid 行消除债务（从 state 删除）；
 *     ② owed 行建立债务；
 *     ③ betrayed 行：若 debtor 仍欠 creditor 且本集无 repaid → debt_betrayal（high）。
 * 输出：当前人情债名册 + issue + 架构师"人情债"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface DebtRow {
  /** 集号 */
  ep: number;
  /** 负债者（欠人情的人） */
  debtor: string;
  /** 债主（施恩的人） */
  creditor: string;
  /** 本集 debtor 欠 creditor 人情 */
  owed: boolean;
  /** 本集 debtor 偿还了 creditor 的人情 */
  repaid: boolean;
  /** 本集 debtor 背叛了 creditor */
  betrayed: boolean;
}

export interface DebtIssue {
  severity: 'high';
  type: 'debt_betrayal';
  evidence: string;
  advice: string;
}

export interface DebtLedgerResult {
  /** 当前人情债名册：仍欠人情的角色 */
  debts: { debtor: string; creditor: string; sinceEp: number }[];
  issues: DebtIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 施恩动词（A 救/帮 B，B 欠 A）——
const OWE_ZH: string[] = ['救了', '救下', '救命', '帮了', '相助', '扶持', '赠给', '赠予', '借给', '借予', '收留', '庇护', '解围', '搭救'];
// —— 偿还动词 ——
const REPAY_ZH: string[] = ['报恩', '还人情', '报答', '酬谢', '涌泉相报', '答谢', '回报', '偿还人情'];
// —— 背叛动词 ——
const BETRAY_ZH: string[] = ['背叛', '出卖', '反目', '恩将仇报', '倒戈', '背弃', '捅刀子', '背后一刀'];

const OWE_EN: string[] = ['saved', 'rescued', 'helped', 'assisted', 'gave', 'lent', 'sheltered', 'protected', 'bailed out', 'came to the aid of'];
const REPAY_EN: string[] = ['repaid the debt', 'returned the favor', 'repaid', 'thanked', 'gratitude', 'owed you one', 'paid back'];
const BETRAY_EN: string[] = ['betrayed', 'sold out', 'turned against', 'stabbed in the back', 'double-crossed', 'deserted', 'switched sides'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

/**
 * 从单集终稿提取本人情债行（owed / repaid / betrayed）。
 */
export function deriveDebtRows(draft: string, names: string[]): Omit<DebtRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<DebtRow, 'ep'>[] = [];
  const oweW = isZh ? OWE_ZH : OWE_EN;
  const repayW = isZh ? REPAY_ZH : REPAY_EN;
  const betrayW = isZh ? BETRAY_ZH : BETRAY_EN;

  const pushRow = (debtor: string, creditor: string, owed: boolean, repaid: boolean, betrayed: boolean) => {
    const existing = out.find((x) => x.debtor === debtor && x.creditor === creditor);
    if (existing) {
      existing.owed = existing.owed || owed;
      existing.repaid = existing.repaid || repaid;
      existing.betrayed = existing.betrayed || betrayed;
    } else {
      out.push({ debtor, creditor, owed, repaid, betrayed });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh))
      .sort((a, b) => sent.indexOf(a) - sent.indexOf(b))
      .slice(0, MAX_NAMES_PER_SENT);
    if (hitNames.length < 2) continue;

    // owed：施恩动词 → creditor=动词前人名, debtor=动词后人名
    const oVerb = oweW.find((w) => wordHit(sent, w, isZh));
    if (oVerb) {
      const vIdx = sent.indexOf(oVerb);
      const before = hitNames.filter((n) => sent.indexOf(n) < vIdx);
      const after = hitNames.filter((n) => sent.indexOf(n) > vIdx);
      const creditor = before.length ? before[before.length - 1] : hitNames[0];
      const debtor = after.length ? after[0] : hitNames[1] ?? hitNames[0];
      if (debtor !== creditor) pushRow(debtor, creditor, true, false, false);
    }

    // repaid：偿还动词 → debtor=动词前人名, creditor=动词后人名
    const rVerb = repayW.find((w) => wordHit(sent, w, isZh));
    if (rVerb) {
      const vIdx = sent.indexOf(rVerb);
      const before = hitNames.filter((n) => sent.indexOf(n) < vIdx);
      const after = hitNames.filter((n) => sent.indexOf(n) > vIdx);
      const debtor = before.length ? before[before.length - 1] : hitNames[0];
      const creditor = after.length ? after[0] : hitNames[1] ?? hitNames[0];
      if (debtor !== creditor) pushRow(debtor, creditor, false, true, false);
    }

    // betrayed：背叛动词 → debtor=动词前人名, creditor=动词后人名
    const bVerb = betrayW.find((w) => wordHit(sent, w, isZh));
    if (bVerb) {
      const vIdx = sent.indexOf(bVerb);
      const before = hitNames.filter((n) => sent.indexOf(n) < vIdx);
      const after = hitNames.filter((n) => sent.indexOf(n) > vIdx);
      const debtor = before.length ? before[before.length - 1] : hitNames[0];
      const creditor = after.length ? after[0] : hitNames[1] ?? hitNames[0];
      if (debtor !== creditor) pushRow(debtor, creditor, false, false, true);
    }
  }
  return out;
}

/** 规范化落库摘要 */
export function normalizeDebtRow(raw: Record<string, unknown>): DebtRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const debtor = typeof raw.debtor === 'string' ? raw.debtor : '';
  const creditor = typeof raw.creditor === 'string' ? raw.creditor : '';
  if (!Number.isFinite(ep) || !debtor || !creditor) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, debtor, creditor,
    owed: bl(raw.owed),
    repaid: bl(raw.repaid),
    betrayed: bl(raw.betrayed),
  };
}

/**
 * 跨集人情债记账。
 * @param rows 全剧集债务行（需含 ep；内部按 ep 升序）
 * @param currentEp 当前集号
 */
export function debtLedger(rows: DebtRow[], currentEp: number): DebtLedgerResult {
  const sorted = [...rows].sort((a, b) => a.ep - b.ep || a.debtor.localeCompare(b.debtor));
  // 债务状态：debtor → { creditor, sinceEp }
  const state = new Map<string, { creditor: string; sinceEp: number }>();
  const debtsList: { debtor: string; creditor: string; sinceEp: number }[] = [];
  const issues: DebtIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, DebtRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((a, b) => a - b);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① repaid 消除债务
    for (const r of epRows) {
      if (r.repaid) {
        if (state.has(r.debtor)) state.delete(r.debtor);
      }
    }
    // ② owed 建立债务
    for (const r of epRows) {
      if (r.owed) {
        state.set(r.debtor, { creditor: r.creditor, sinceEp: ep });
      }
    }
    // ③ betrayed：debtor 仍欠 creditor 且本集无 repaid → 穿帮
    for (const r of epRows) {
      if (!r.betrayed) continue;
      const cur = state.get(r.debtor);
      const hasRepaid = epRows.some((x) => x.repaid && x.debtor === r.debtor);
      if (cur && cur.creditor === r.creditor && !hasRepaid) {
        const key = `${r.debtor}::${r.creditor}`;
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            severity: 'high',
            type: 'debt_betrayal',
            evidence: `${r.debtor} 自第 ${cur.sinceEp} 集起欠 ${r.creditor} 人情，本集却背叛 ${r.creditor}（无偿还或反水交代）`,
            advice: `补充 ${r.debtor} 恩将仇报的动机交代（被胁迫/误会/利益权衡），或先安排偿还人情再反转`,
          });
        }
      }
    }
  }

  for (const [debtor, info] of state) {
    debtsList.push({ debtor, creditor: info.creditor, sinceEp: info.sinceEp });
  }
  debtsList.sort((a, b) => a.sinceEp - b.sinceEp);

  return { debts: debtsList, issues };
}

/** 架构师"人情债"指令（双语，en 零中文；接收 rows 内部调 ledger，与阵营账本同构） */
export function debtDirective(rows: DebtRow[]): { en: string; zh: string } {
  const result = debtLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【人情债约束】'];
  const en: string[] = ['[Debt of Gratitude Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
