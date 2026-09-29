/**
 * v2.80 冒充账本（Impersonation Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - disguise-ledger：管人名→alias 的化名/伪装（alias 不一定是真人），检测揭穿后复穿；
 *  - 本引擎：管**冒充特定真人**——A 冒充 B（B 是 cast 中真实角色），
 *    核心冲突：A 仍在冒充 B 时，真 B 被认出/真身显现 → 身份重叠穿帮（high）。
 *
 * 提取（纯确定性，人名配对）：
 *  - impersonated：句内两人名 + 冒充动词（冒充/冒名顶替/假扮成…）→ A 冒充 B
 *  - exposed：句内两人名 + 揭穿动词（揭穿/识破/拆穿…）→ A 冒充 B 被揭穿
 *  - recognized：句内人名 + 认出动词（认出/真身/是本人/确认身份…）→ 真 B 被确认
 *
 * 记账模型（与 disguise-ledger 同构，纯确定性）：
 *   每集摘要 { ep, imposter, victim, impersonated, exposed, recognized }：
 *   按集升序过账：
 *     ① exposed 解除 A→B 冒充；
 *     ② impersonated 建立 A→B 冒充；
 *     ③ recognized(B)：若存在任一 A 正在冒充 B → identity_conflict（high，同对只报1次）。
 * 输出：当前冒充名册 + issue + 架构师"冒充"指令。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface ImpersonationRow {
  ep: number;
  /** 冒充者 A */
  imposter: string;
  /** 被冒充者 B（真人） */
  victim: string;
  /** 本集 A 冒充 B */
  impersonated: boolean;
  /** 本集 A 冒充 B 被揭穿 */
  exposed: boolean;
  /** 本集 B 真身被认出 */
  recognized: boolean;
}

export interface ImpersonationIssue {
  severity: 'high';
  type: 'identity_conflict';
  evidence: string;
  advice: string;
}

export interface ImpersonationLedgerResult {
  /** 当前冒充名册 */
  impersonations: { imposter: string; victim: string; sinceEp: number }[];
  issues: ImpersonationIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 冒充动词
const IMP_ZH = ['冒充', '冒名顶替', '假扮成', '顶替', '冒名', '装作是', '假装是'];
// 揭穿动词
const EXP_ZH = ['揭穿', '识破', '拆穿', '发现是假的', '揭下伪装', '戳穿', '身份暴露'];
// 认出/真身动词
const REC_ZH = ['认出', '真身', '是本人', '确认身份', '真是你', '本尊', '现身'];

const IMP_EN = ['impersonated', 'pretended to be', 'masqueraded as', 'passed himself off as', 'passed herself off as', 'posed as'];
const EXP_EN = ['exposed', 'uncovered', 'unmasked', 'found out', 'revealed as an impostor'];
const REC_EN = ['recognized', 'confirmed identity', 'the real', 'in person', 'showed up as himself', 'showed up as herself'];

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
  return `${a}::${b}`;
}

export function deriveImpersonationRows(draft: string, names: string[]): Omit<ImpersonationRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<ImpersonationRow, 'ep'>[] = [];
  const impW = isZh ? IMP_ZH : IMP_EN;
  const expW = isZh ? EXP_ZH : EXP_EN;
  const recW = isZh ? REC_ZH : REC_EN;

  const pushRow = (imposter: string, victim: string, impersonated: boolean, exposed: boolean, recognized: boolean) => {
    if (imposter === victim) return;
    const key = pairKey(imposter, victim);
    const existing = out.find((x) => pairKey(x.imposter, x.victim) === key);
    if (existing) {
      existing.impersonated = existing.impersonated || impersonated;
      existing.exposed = existing.exposed || exposed;
      existing.recognized = existing.recognized || recognized;
    } else {
      out.push({ imposter, victim, impersonated, exposed, recognized });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh))
      .sort((a, b) => sent.indexOf(a) - sent.indexOf(b))
      .slice(0, MAX_NAMES_PER_SENT);
    if (!hitNames.length) continue;

    // impersonated / exposed：需要句内两人名（冒充者在前，被冒充者在后）
    if (hitNames.length >= 2) {
      const a = hitNames[0];
      const b = hitNames[1];
      if (impW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, true, false, false);
      if (expW.some((w) => wordHit(sent, w, isZh))) pushRow(a, b, false, true, false);
    }
    // recognized：句内任一人名 + 认出动词（真身显现）
    if (recW.some((w) => wordHit(sent, w, isZh))) {
      // 对句内所有人名标记 recognized（真身被确认），imposter 留空
      for (const n of hitNames) {
        const key = `__rec__::${n}`;
        const existing = out.find((x) => pairKey(x.imposter, x.victim) === key);
        if (existing) {
          existing.recognized = true;
        } else {
          out.push({ imposter: '', victim: n, impersonated: false, exposed: false, recognized: true });
        }
      }
    }
  }
  return out;
}

export function normalizeImpersonationRow(raw: Record<string, unknown>): ImpersonationRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const imposter = typeof raw.imposter === 'string' ? raw.imposter : '';
  const victim = typeof raw.victim === 'string' ? raw.victim : '';
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  const recognized = bl(raw.recognized);
  if (!Number.isFinite(ep) || !victim) return null;
  // recognized 行 imposter 可为空；其余行 imposter 必须非空且不等于 victim
  if (!recognized && (!imposter || imposter === victim)) return null;
  return {
    ep, imposter, victim,
    impersonated: bl(raw.impersonated),
    exposed: bl(raw.exposed),
    recognized,
  };
}

export function impersonationLedger(rows: ImpersonationRow[], currentEp: number): ImpersonationLedgerResult {
  const sorted = [...rows].sort((x, y) => x.ep - y.ep || pairKey(x.imposter, x.victim).localeCompare(pairKey(y.imposter, y.victim)));
  // 冒充状态：pairKey(imposter, victim) → sinceEp
  const state = new Map<string, number>();
  const impersonations: { imposter: string; victim: string; sinceEp: number }[] = [];
  const issues: ImpersonationIssue[] = [];
  const reported = new Set<string>();

  const byEp = new Map<number, ImpersonationRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((x, y) => x - y);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① impersonated 建立冒充
    for (const r of epRows) {
      if (r.impersonated) state.set(pairKey(r.imposter, r.victim), ep);
    }
    // ② exposed 解除冒充（同集既冒充又揭穿时，exposed 获胜）
    for (const r of epRows) {
      if (r.exposed) state.delete(pairKey(r.imposter, r.victim));
    }
    // ③ recognized(victim)：若存在任一 A 正在冒充 victim → identity_conflict
    for (const r of epRows) {
      if (!r.recognized) continue;
      const victim = r.victim;
      // 找出所有正在冒充 victim 的冒充者
      for (const [key, sinceEp] of state) {
        const [imp, vic] = key.split('::');
        if (vic === victim && imp !== victim) {
          const issueKey = pairKey(imp, victim);
          if (!reported.has(issueKey)) {
            reported.add(issueKey);
            issues.push({
              severity: 'high',
              type: 'identity_conflict',
              evidence: `${imp} 自第 ${sinceEp} 集冒充 ${victim}，本集 ${victim} 真身却被认出（身份重叠，无揭穿交代）`,
              advice: `补充 ${imp} 冒充 ${victim} 被揭穿的交代，或让 ${victim} 真身显现在揭穿之后`,
            });
          }
        }
      }
    }
  }

  for (const [key, sinceEp] of state) {
    const [imposter, victim] = key.split('::');
    impersonations.push({ imposter, victim, sinceEp });
  }
  impersonations.sort((x, y) => x.sinceEp - y.sinceEp);
  return { impersonations, issues };
}

export function impersonationDirective(rows: ImpersonationRow[]): { en: string; zh: string } {
  const result = impersonationLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【冒充约束】'];
  const en: string[] = ['[Impersonation Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
