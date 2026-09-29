/**
 * v2.80 秘密泄露账本（Secret Leak Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - secret-ledger（v2.80）：跨集秘密的**植入/揭示节奏**（悬空秘密、揭示失忆、节奏失衡），
 *    管"秘密这个主题何时埋何时揭"；本引擎不做主题生命周期检测
 *  - relationship-ledger（v2.80）：跨集人名对关系翻转；本引擎管"人名对知情范围"
 *  - 本引擎：**人名×秘密知情范围连续性**——A 向 B 透露秘密（告诉/透露/坦白…+秘密/真相）
 *    建立知情圈 {A, B}，后续集非知情者 C 无交代却声称知道/说出该秘密
 *    （知道/揭穿/说出…+秘密/真相）= 信息泄露穿帮（high，"他怎么知道的？"是评论区抓虫重灾区）；
 *    豁免：C 为合法偷听/目击者（偷听到/撞见/亲眼看见…）。
 *
 * 提取（纯确定性，无秘密主题词典——以"透露动词+秘密词"共现作为知情事件锚点）：
 *  - told 行：句内 ≥2 人名 + 透露动词 + 秘密词 → (说者 a, 听者 b, told=true)
 *    说者=动词前最近人名；听者=动词后、秘密词前最近人名
 *  - knows 行：句内人名 + 知道/揭穿动词 + 秘密词 → (a, '__self__', knows=true)
 *  - witness 标记：句内人名 + 偷听/目击词 → 同人名行 witness=true（豁免 knows）
 *  跨集以人名为 key 累积知情圈；知情圈只增不减（被告知即永久知情，除非剧情明确"忘了"，暂不建模）。
 *
 * 记账模型（与阵营/关系/地点账本同构，纯确定性）：
 *   每集摘要 { ep, a, b, told, knows, witness }：
 *   told = a 向 b 透露秘密同句；knows = a 声称知道/说出秘密同句；
 *   witness = a 合法偷听/目击同句。
 *   按集升序过账：
 *     ① 先把本集 told 对的 {a, b} 加入知情圈；
 *     ② 本集 knows 且 !witness 且 a 不在知情圈 → secret_leak（high，每 a 只报1次）。
 * 输出：知情圈 + issue + 架构师"秘密知情范围"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface LeakRow {
  /** 集号 */
  ep: number;
  /** 透露者（told 时）或声称知道秘密者（knows 时） */
  a: string;
  /** 听者（told 时）；knows 行固定 '__self__' */
  b: string;
  /** 本集 a 向 b 透露了秘密 */
  told: boolean;
  /** 本集 a 声称知道/说出了秘密 */
  knows: boolean;
  /** 本集 a 为合法偷听/目击者（豁免 knows） */
  witness: boolean;
}

export interface SecretLeakIssue {
  severity: 'high';
  type: 'secret_leak';
  evidence: string;
  advice: string;
}

export interface SecretLeakLedgerResult {
  /** 知情圈：已通过透露/目击合法获知秘密的角色 */
  informed: { name: string; informedEp: number }[];
  issues: SecretLeakIssue[];
}

const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 透露动词（a 向 b 告知秘密）——
const TELL_ZH: string[] = ['告诉', '告知', '透露', '坦白', '说出', '和盘托出', '泄密', '泄露给', '吐露', '如实相告', '坦言', '交底'];
// —— 秘密/真相锚点词 ——
const SECRET_ZH: string[] = ['秘密', '真相', '实情', '内情', '底细', '隐情', '玄机', '内幕', '隐密'];
// —— 知道/揭穿动词（声称知道秘密）——
const KNOW_ZH: string[] = ['知道', '清楚', '明白', '说出', '揭穿', '揭露', '捅破', '点破', '道破', '识破'];
// —— 合法偷听/目击豁免 ——
const WITNESS_ZH: string[] = ['偷听到', '撞见', '亲眼看见', '无意中听到', '偶然得知', '碰巧听到', '窥见到', '耳闻目睹'];

const TELL_EN: string[] = ['told', 'revealed', 'confessed', 'disclosed', 'let slip', 'spilled the beans', 'confided in', 'informed', 'filled in', 'clued in'];
const SECRET_EN: string[] = ['secret', 'the truth', 'what really happened', 'inside information', 'the real story', 'confidential'];
const KNOW_EN: string[] = ['knows', 'knew', 'aware', 'figured out', 'found out', 'exposed', 'blew the lid off', 'revealed', 'spilled'];
const WITNESS_EN: string[] = ['overheard', 'caught', 'saw', 'witnessed', 'accidentally heard', 'stumbled upon', 'eavesdropped'];

function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

/** 句内人名位置（首次出现索引） */
function nameIdx(sentence: string, name: string): number {
  return sentence.indexOf(name);
}

/**
 * 从单集终稿提取本集秘密知情行（told / knows / witness）。
 */
export function deriveLeakRows(draft: string, names: string[]): Omit<LeakRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<LeakRow, 'ep'>[] = [];
  const seen = new Set<string>();
  const tellW = isZh ? TELL_ZH : TELL_EN;
  const secretW = isZh ? SECRET_ZH : SECRET_EN;
  const knowW = isZh ? KNOW_ZH : KNOW_EN;
  const witnessW = isZh ? WITNESS_ZH : WITNESS_EN;

  const pushRow = (a: string, b: string, told: boolean, knows: boolean, witness: boolean) => {
    const key = `${a}::${b}`;
    const existing = out.find((x) => x.a === a && x.b === b);
    if (existing) {
      existing.told = existing.told || told;
      existing.knows = existing.knows || knows;
      existing.witness = existing.witness || witness;
    } else {
      seen.add(key);
      out.push({ a, b, told, knows, witness });
    }
  };

  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh)).slice(0, MAX_NAMES_PER_SENT);
    if (!hitNames.length) continue;
    const hasSecret = secretW.some((w) => wordHit(sent, w, isZh));
    if (!hasSecret) continue;

    // told：句内 ≥2 人名 + 透露动词 + 秘密词
    const tellVerb = tellW.find((w) => wordHit(sent, w, isZh));
    if (tellVerb && hitNames.length >= 2) {
      const vIdx = sent.indexOf(tellVerb);
      // 说者 = 动词前最近人名
      const before = hitNames.filter((n) => nameIdx(sent, n) < vIdx);
      const speaker = before.length ? before[before.length - 1] : hitNames[0];
      // 听者 = 动词后、最近的其他人名
      const after = hitNames.filter((n) => nameIdx(sent, n) > vIdx && n !== speaker);
      const listener = after.length ? after[0] : hitNames.find((n) => n !== speaker) ?? hitNames[0];
      if (speaker !== listener) pushRow(speaker, listener, true, false, false);
    }

    // knows：人名 + 知道/揭穿动词 + 秘密词
    const knowVerb = knowW.find((w) => wordHit(sent, w, isZh));
    if (knowVerb) {
      for (const n of hitNames) pushRow(n, '__self__', false, true, false);
    }

    // witness：人名 + 偷听/目击词（豁免 knows）
    const witnessVerb = witnessW.find((w) => wordHit(sent, w, isZh));
    if (witnessVerb) {
      for (const n of hitNames) pushRow(n, '__self__', false, false, true);
    }
  }
  return out;
}

/** 规范化落库摘要 */
export function normalizeLeakRow(raw: Record<string, unknown>): LeakRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const a = typeof raw.a === 'string' ? raw.a : '';
  const b = typeof raw.b === 'string' ? raw.b : '';
  if (!Number.isFinite(ep) || !a || !b) return null;
  const bl = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep, a, b,
    told: bl(raw.told),
    knows: bl(raw.knows),
    witness: bl(raw.witness),
  };
}

/**
 * 跨集秘密泄露记账。
 * @param rows 全剧集知情行（需含 ep；内部按 ep 升序）
 * @param currentEp 当前集号
 */
export function secretLeakLedger(rows: LeakRow[], currentEp: number): SecretLeakLedgerResult {
  const sorted = [...rows].sort((a, b) => a.ep - b.ep || a.a.localeCompare(b.a));
  // 知情圈：name → 首次知情集号
  const informed = new Map<string, number>();
  const informedList: { name: string; informedEp: number }[] = [];
  const issues: SecretLeakIssue[] = [];
  const reported = new Set<string>();

  // 按集分组
  const byEp = new Map<number, LeakRow[]>();
  for (const r of sorted) {
    if (!byEp.has(r.ep)) byEp.set(r.ep, []);
    byEp.get(r.ep)!.push(r);
  }
  const eps = [...byEp.keys()].sort((a, b) => a - b);

  for (const ep of eps) {
    const epRows = byEp.get(ep)!;
    // ① 先把本集 told 对的 {a, b} 加入知情圈
    for (const r of epRows) {
      if (r.told && r.b !== '__self__') {
        for (const n of [r.a, r.b]) {
          if (!informed.has(n)) {
            informed.set(n, ep);
            informedList.push({ name: n, informedEp: ep });
          }
        }
      }
      // witness 也加入知情圈（合法获知）
      if (r.witness) {
        if (!informed.has(r.a)) {
          informed.set(r.a, ep);
          informedList.push({ name: r.a, informedEp: ep });
        }
      }
    }
    // ② 检测本集 knows 行：a 不在知情圈且非 witness → 信息泄露
    for (const r of epRows) {
      if (!r.knows || r.witness) continue;
      if (!informed.has(r.a)) {
        if (!reported.has(r.a)) {
          reported.add(r.a);
          issues.push({
            severity: 'high',
            type: 'secret_leak',
            evidence: `${r.a} 在第${ep}集声称知道/说出秘密，但此前无任何透露或目击交代（知情圈中无 ${r.a}）`,
            advice: `补充 ${r.a} 获知该秘密的交代（被某人告知/偷听到/亲眼目击），否则信息泄露逻辑断裂`,
          });
        }
      }
    }
  }
  return { informed: informedList, issues };
}

/** 架构师"秘密知情范围"指令（双语，en 零中文；接收 rows 内部调 ledger，与阵营账本同构） */
export function secretLeakDirective(rows: LeakRow[]): { en: string; zh: string } {
  const result = secretLeakLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length) return { en: '', zh: '' };
  const zh: string[] = ['【秘密知情范围约束】'];
  const en: string[] = ['[Secret Knowledge Boundary]'];
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
