/**
 * v2.80 伪装身份账本（Disguise Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - craft 文件中 disguise 仅作剧情提示词，无跨集伪装状态记账
 *  - secret-ledger/secret-leak-ledger：管秘密与知情范围；本引擎管**身份伪装**的揭穿/维持
 *  - 本引擎：人名 × 伪装身份 跨集连续性——
 *    A 伪装成 B（假扮/冒充/化名/易容成…）建立伪装状态；
 *    揭穿（认出/识破/揭穿/原来是你…）解除伪装；
 *    揭穿后无交代又以同一伪装身份出现 = 身份复穿帮（high，"刚被拆穿又装回去了？"）。
 *
 * 提取（纯确定性）：
 *  - disguised 行：句内人名 + 伪装动词 → 取伪装身份名 alias
 *    （伪装动词后 2-8 中文字，截尾缀的/了/成/为/作；或句内第二个已知人名）
 *  - revealed 行：句内人名 + 揭穿动词 → 解除该角色伪装状态
 *  跨集以人名为 key 维护伪装状态与"已揭穿"集合。
 *
 * 记账模型（与秘密泄露账本同构，纯确定性）：
 *   每集摘要 { ep, name, alias, disguised, revealed }：
 *   disguised = 本集 name 伪装成 alias 同句；revealed = 本集 name 伪装被揭穿同句。
 *   按集升序过账：
 *     ① revealed 行从伪装状态删除，并加入 revealedSet(name+alias)；
 *     ② disguised 行建立伪装状态；若 (name, alias) 已在 revealedSet → identity_relapse（high）。
 * 输出：当前伪装名册 + issue + 架构师"伪装身份"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名/身份名透传）。
 */

export interface DisguiseRow {
  /** 集号 */
  ep: number;
  /** 真实角色名 */
  name: string;
  /** 伪装身份名 */
  alias: string;
  /** 本集 name 伪装成 alias */
  disguised: boolean;
  /** 本集 name 伪装被揭穿 */
  revealed: boolean;
}

export interface DisguiseIssue {
  severity: 'high';
  type: 'identity_relapse';
  evidence: string;
  advice: string;
}

export interface DisguiseLedgerResult {
  /** 当前伪装名册：仍处于伪装状态的角色 */
  disguised: { name: string; alias: string; disguiseEp: number }[];
  issues: DisguiseIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 伪装动词 ——
const DISGUISE_ZH: string[] = ['假扮', '冒充', '化名', '伪装成', '易容成', '装作', '假装成', '顶替', '冒名', '扮作'];
// —— 揭穿动词 ——
const REVEAL_ZH: string[] = ['认出', '识破', '揭穿', '原来是你', '发现真实身份', '拆穿', '揭下', '撕下面具', '真身'];
// —— 身份名尾缀截断 ——
const ALIAS_SUFFIX_ZH: string[] = ['的', '了', '成', '为', '作', '叫做', '叫', '是'];

const DISGUISE_EN: string[] = ['disguised as', 'posing as', 'impersonating', 'pretending to be', 'masquerading as', 'under the alias', 'going by the name', 'passing herself off as', 'passing himself off as'];
const REVEAL_EN: string[] = ['recognized', 'saw through', 'exposed', 'unmasked', 'discovered his true identity', 'discovered her true identity', 'it was really', 'turned out to be', 'saw past the disguise'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

/** 从伪装动词后提取身份名 */
function extractAlias(sentence: string, verb: string, isZh: boolean, names: string[]): string {
  const vIdx = sentence.indexOf(verb);
  if (vIdx < 0) return '';
  const after = sentence.slice(vIdx + verb.length);
  if (isZh) {
    // 优先取伪装动词后的已知人名（≠伪装者）
    const afterNames = names.filter((n) => sentence.indexOf(n) > vIdx);
    if (afterNames.length) return afterNames[0];
    // 否则取 2-4 中文字，截尾缀
    let m = after.match(/^[\u4e00-\u9fff]{2,4}/);
    if (m) {
      let alias = m[0];
      for (const suf of ALIAS_SUFFIX_ZH) {
        if (alias.endsWith(suf)) alias = alias.slice(0, -suf.length);
      }
      if (alias.length >= 2) return alias;
    }
  } else {
    // en：取连续大写词序列（专有身份名）或普通名词
    const capMatch = after.match(/^[\s,]+((?:[A-Z][a-z]+\s*){1,3})/);
    if (capMatch) return capMatch[1].trim();
    const nounMatch = after.match(/^[\s,]+(?:the\s+)?([a-z]{3,})/);
    if (nounMatch) return nounMatch[1];
  }
  return '';
}

/**
 * 从单集终稿提取本集伪装身份行（disguised / revealed）。
 */
export function deriveDisguiseRows(draft: string, names: string[]): Omit<DisguiseRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<DisguiseRow, 'ep'>[] = [];
  const seen = new Set<string>();
  const disguiseW = isZh ? DISGUISE_ZH : DISGUISE_EN;
  const revealW = isZh ? REVEAL_ZH : REVEAL_EN;

  const pushRow = (name: string, alias: string, disguised: boolean, revealed: boolean) => {
    // revealed 行 alias 可能为空，合并到已有同 name 行（揭穿同一伪装者的已有身份）
    let existing = out.find((x) => x.name === name && x.alias === alias);
    if (!existing && !alias) existing = out.find((x) => x.name === name);
    if (existing) {
      existing.disguised = existing.disguised || disguised;
      existing.revealed = existing.revealed || revealed;
      if (alias && !existing.alias) existing.alias = alias;
    } else {
      seen.add(`${name}::${alias}`);
      out.push({ name, alias, disguised, revealed });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh))
      .sort((a, b) => sent.indexOf(a) - sent.indexOf(b))
      .slice(0, MAX_NAMES_PER_SENT);
    if (!hitNames.length) continue;

    // disguised：人名 + 伪装动词 → 提取 alias
    const dVerb = disguiseW.find((w) => wordHit(sent, w, isZh));
    if (dVerb) {
      const alias = extractAlias(sent, dVerb, isZh, hitNames);
      if (alias) {
        // 伪装者 = 句内第一个人名
        pushRow(hitNames[0], alias, true, false);
      }
    }

    // revealed：人名 + 揭穿动词 → 解除伪装（alias 取句内第二人名或空）
    const rVerb = revealW.find((w) => wordHit(sent, w, isZh));
    if (rVerb) {
      const alias = hitNames.length >= 2 ? hitNames[1] : '';
      // 揭穿者或被揭穿者：取句内第一个人名作为被揭穿者
      pushRow(hitNames[0], alias, false, true);
    }
  }
  return out;
}

/** 规范化落库摘要 */
export function normalizeDisguiseRow(raw: Record<string, unknown>): DisguiseRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  const alias = typeof raw.alias === 'string' ? raw.alias : '';
  if (!Number.isFinite(ep) || !name) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, name, alias,
    disguised: bl(raw.disguised),
    revealed: bl(raw.revealed),
  };
}

/**
 * 跨集伪装身份记账。
 * @param rows 全剧集伪装行（需含 ep；内部按 ep 升序）
 * @param currentEp 当前集号
 */
export function disguiseLedger(rows: DisguiseRow[], currentEp: number): DisguiseLedgerResult {
  const sorted = [...rows].sort((a, b) => a.ep - b.ep || a.name.localeCompare(b.name));
  // 当前伪装状态：name → { alias, disguiseEp }
  const state = new Map<string, { alias: string; disguiseEp: number }>();
  // 已揭穿集合：name+alias（用于检测揭穿后又伪装）
  const revealedSet = new Set<string>();
  const disguisedList: { name: string; alias: string; disguiseEp: number }[] = [];
  const issues: DisguiseIssue[] = [];

  const byEp = new Map<number, DisguiseRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((a, b) => a - b);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① 先处理 revealed：解除伪装，加入 revealedSet
    for (const r of epRows) {
      if (r.revealed) {
        const key = `${r.name}::${r.alias}`;
        revealedSet.add(key);
        if (state.has(r.name)) {
          state.delete(r.name);
        }
      }
    }
    // ② 再处理 disguised：建立伪装；若已揭穿 → identity_relapse
    for (const r of epRows) {
      if (!r.disguised) continue;
      const key = `${r.name}::${r.alias}`;
      if (revealedSet.has(key)) {
        issues.push({
          severity: 'high',
          type: 'identity_relapse',
          evidence: `${r.name} 伪装成 ${r.alias || '某身份'} 曾在第 ${ep} 集前被揭穿，本集又以同一身份伪装出现（无重新伪装交代）`,
          advice: `补充 ${r.name} 重新伪装的交代，或避免揭穿后立即复用同一伪装身份`,
        });
      } else {
        state.set(r.name, { alias: r.alias, disguiseEp: ep });
      }
    }
  }

  // 输出当前伪装名册
  for (const [name, info] of state) {
    disguisedList.push({ name, alias: info.alias, disguiseEp: info.disguiseEp });
  }
  disguisedList.sort((a, b) => a.disguiseEp - b.disguiseEp);

  return { disguised: disguisedList, issues };
}

/** 架构师"伪装身份"指令（双语，en 零中文；接收 rows 内部调 ledger，与阵营账本同构） */
export function disguiseDirective(rows: DisguiseRow[]): { en: string; zh: string } {
  const result = disguiseLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【伪装身份约束】'];
  const en: string[] = ['[Disguise Identity Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
