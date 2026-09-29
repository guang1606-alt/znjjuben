/**
 * v2.80 信物归属账本（Item Ownership Ledger）
 * ------------------------------------------------------------------
 * 查重分工（四个近邻引擎）：
 *  - prop-ledger：信物级（不分手）——销毁/丢失封禁、悬空挖坑预警、phantom 凭空再现；
 *    其 CLOSE 动词只收物理销毁/丢失（碎/烧/扔…），所有权转移（交给/归还）≠ 封禁，
 *    信物在受让者手上再现是合法的，prop-ledger 特意不收"夺/交"
 *  - promise-ledger：口头承诺兑现；evidence-chain-check：单集证据链
 *  - 本引擎：**人名级所有权转移连续性**——具名角色把信物让渡（交给/赠予/归还/
 *    上交/卖掉/抵押/托付…）入"已让渡名册"，后续集无拿回交代再次经手该信物 =
 *    所有权穿帮（high，"都送给人家了还戴在身上"是评论区抓虫重灾区）；
 *    豁免：拿回/要回/赎回/夺回/重新得到（出册）；回忆性失去表述
 *    （"那玉佩我早送人了"）不算经手。
 *  - 让渡动词只收"主动让渡"类（主语近旁人名=失去方）；夺类（夺走/抢走/偷走/
 *    没收）方向模糊不收（误伤率高，归剧情自由）。
 *
 * 记账模型（与下场/创伤账本同构，纯确定性）：
 *   每集摘要 { ep, name, item, handed, regain, touched }（具名角色×信物词典逐句提取）：
 *   handed = 名字×信物×让渡动词同句共现；regain = 名字×信物×拿回动词同句共现；
 *   touched = 名字×信物同句共现（弱信号，穿帮判定时用回忆句豁免过滤）。
 *   按集升序过账（同集同名同信物以后到为准）：
 *     ① 册中者本集 touched 且无 regain/GIVE/回忆豁免 → handed_but_touched（high，
 *        每 name×item 只报 1 次）；regain/GIVE 同集命中 = 先拿回再转手的合法链
 *     ② regain 出册；③ handed 入册。
 *   信物词典复用 prop-ledger 的 PROP_WORDS_ZH/EN（单一事实源）。
 * 输出：已让渡名册 + issue + 架构师"归属连续性"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名/信物名透传）。
 */

import { PROP_WORDS_ZH, PROP_WORDS_EN } from './prop-ledger';

export interface ItemRow {
  /** 集号 */
  ep: number;
  /** 角色名（具名，≥2 字符） */
  name: string;
  /** 信物名（词典原样） */
  item: string;
  /** 本集让渡（交给/赠予/归还/卖掉…与名字、信物同句） */
  handed: boolean;
  /** 本集拿回豁免（拿回/要回/赎回…与名字、信物同句） */
  regain: boolean;
  /** 本集经手（名字×信物同句共现，弱信号） */
  touched: boolean;
}

export interface ItemOwnershipIssue {
  severity: 'high';
  type: 'handed_but_touched';
  evidence: string;
  advice: string;
}

export interface ItemOwnershipLedgerResult {
  /** 已让渡名册：交出/归还后未拿回（跨集归属监控池） */
  handed: { name: string; item: string; handEp: number }[];
  issues: ItemOwnershipIssue[];
}

/** 文本最短触发长度（防空白/超短文本误判） */
const MIN_TEXT = 6;
/** 名字最短长度（防单字误伤） */
const MIN_NAME = 2;
/** 名字最长长度（防整段设定误当人名） */
const MAX_NAME = 24;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 让渡动词（主动让渡：主语近旁人名=失去方；不收夺类，方向模糊）——
const GIVE_ZH: string[] = ['交给', '送给了', '送给了他', '送给', '赠给', '赠予', '归还给', '归还', '退还', '上交', '献给了', '献给', '托付给', '托付', '递给', '塞给', '留给了', '留给', '抵押', '卖给了', '卖掉', '捐给', '赔给', '赔偿给', '还给了', '转交'];
// —— 拿回动词（豁免出册）——
const REGAIN_ZH: string[] = ['拿回', '要回', '取回', '收回', '夺回', '抢回', '赎回', '偷回', '重新得到', '物归原主', '物还原主'];
// —— 回忆性失去表述（breach 判定豁免："那玉佩我早送人了"不是经手）——
const LOSS_MENTION_ZH: string[] = ['送给', '交了', '还了', '给了', '卖了', '抵押', '当了', '在他那里', '在她那里', '在他手上', '在她手上', '不在', '没了', '丢了', '被夺', '被抢', '被偷', '被骗', '送人', '转交', '早就给'];

const GIVE_EN: string[] = ['gave', 'handed over', 'handed him', 'handed her', 'handed them', 'returned', 'sold', 'donated', 'bequeathed', 'left him', 'left her', 'left them', 'surrendered', 'passed to'];
const REGAIN_EN: string[] = ['took back', 'got back', 'won back', 'retrieved', 'redeemed', 'bought back', 'regained', 'asked for it back', 'came back to'];
const LOSS_MENTION_EN: string[] = ['gave it away', 'gave away', 'sent it', 'no longer', 'lost it', 'stolen', 'taken', 'not with', 'sold it', 'handed it over', 'returned it', 'with him', 'with her', 'with them'];

/** 切句：按中英句终符与换行 */
function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

/** zh 子串 / en 词界（防 ring 误中 during） */
function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

function anyWordIn(sentence: string, words: string[], isZh: boolean): boolean {
  return words.some((w) => wordHit(sentence, w, isZh));
}

/** 信物词典命中（zh 直接 includes；en 词界多词短语匹配） */
function itemIn(sentence: string, isZh: boolean): string | null {
  const list = isZh ? PROP_WORDS_ZH : PROP_WORDS_EN;
  for (const it of list) {
    if (wordHit(sentence, it, isZh)) return it;
  }
  return null;
}

/**
 * 单集单角色信物归属信号提取：逐句匹配信物词典 × 名字 × 动词。
 * @returns 每个命中信物一行 { item, handed, regain, touched }；空文本/超短名字返回 []。
 */
export function deriveOwnershipRows(text: string, name: string): { item: string; handed: boolean; regain: boolean; touched: boolean }[] {
  const n = (name ?? '').trim();
  if (!text || text.trim().length < MIN_TEXT || n.length < MIN_NAME || n.length > MAX_NAME) return [];
  const isZh = isZhText(text);
  const map = new Map<string, { item: string; handed: boolean; regain: boolean; touched: boolean }>();
  for (const sen of sentences(text)) {
    const item = itemIn(sen, isZh);
    if (!item || !nameIn(sen, n, isZh)) continue;
    const row = map.get(item) ?? { item, handed: false, regain: false, touched: false };
    const give = anyWordIn(sen, isZh ? GIVE_ZH : GIVE_EN, isZh);
    const regain = anyWordIn(sen, isZh ? REGAIN_ZH : REGAIN_EN, isZh);
    const lossMention = anyWordIn(sen, isZh ? LOSS_MENTION_ZH : LOSS_MENTION_EN, isZh);
    // 回忆性失去句（"那玉佩我早送人了"）不算经手
    if (!(lossMention && !give && !regain)) row.touched = true;
    if (give) row.handed = true;
    if (regain) row.regain = true;
    map.set(item, row);
  }
  return [...map.values()];
}

/** 落库摘要 → ItemRow（规范化容错：ep/name/item 非法丢弃、布尔仅认 true） */
export function normalizeItemRow(raw: unknown): ItemRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string') return null;
  const name = r.name.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  if (typeof r.item !== 'string') return null;
  const item = r.item.trim();
  if (!item) return null;
  return { ep, name, item, handed: r.handed === true, regain: r.regain === true, touched: r.touched === true };
}

/**
 * 信物归属跨集记账：按集升序，让渡入册 / 拿回出册 / 册中者再经手即穿帮。
 * @param rows    前集归属摘要序列（乱序安全，内部按 ep 升序，同集同名同信物以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function itemOwnershipLedger(rows: ItemRow[], curEpNo: number): ItemOwnershipLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, ItemRow>();
  for (const raw of rows ?? []) {
    const r = normalizeItemRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${r.name}\u0000${r.item}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { name: string; item: string; handEp: number }>();
  const issues: ItemOwnershipIssue[] = [];
  const reported = new Set<string>();
  for (const r of sorted) {
    const key = `${r.name}\u0000${r.item}`;
    const held = pool.get(key);
    // ① 册中者本集再经手（该行无拿回/再让渡动作——同集先拿回再转手是合法链）
    if (held && r.touched && !r.regain && !r.handed) {
      if (!reported.has(key)) {
        reported.add(key);
        issues.push({
          severity: 'high',
          type: 'handed_but_touched',
          evidence: `${r.name}（第 ${held.handEp} 集已让渡「${r.item}」）在第 ${r.ep} 集再次经手「${r.item}」且无拿回交代`,
          advice: '信物所有权穿帮：已交出/归还的信物不得凭空回到手上。要么本集保持"信物不在"（借台词交代去向），要么先补拿回交代（要回/赎回/对方归还）再让他经手',
        });
      }
      pool.delete(key); // 每 name×item 只报 1 次
      continue;
    }
    // ② 拿回出册
    if (held && r.regain) {
      pool.delete(key);
    }
    // ③ 让渡入册（同集 regain+handed = 先拿回再转手的合法链，覆盖时间戳）
    if (r.handed) {
      pool.set(key, { name: r.name, item: r.item, handEp: r.ep });
    }
  }
  return { handed: [...pool.values()], issues };
}

/**
 * 归属连续性调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名/信物名透传）。
 */
export function ownershipDirective(rows: ItemRow[]): { zh: string; en: string } {
  const r = itemOwnershipLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.handed.length) return { zh: '', en: '' };
  const listZh = r.handed.map((h) => `${h.name}的「${h.item}」（第${h.handEp}集让渡）`).join('、');
  const listEn = r.handed.map((h) => `${h.name}'s "${h.item}" (handed over ep${h.handEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Item ownership continuity — handed-over items watch]'] : ['【跨集信物·归属连续性】'];
    lines.push(isEn
      ? `  - Handed over and not recovered: ${listEn}. These characters must NOT touch or hold those items this episode; if the plot needs them back, show an explicit recovery (asked for it back / redeemed / the other party returned it) BEFORE they handle the item again.`
      : `  - 已让渡未拿回信物：${listZh}。本集严禁这些角色再经手对应信物；剧情确需回到手上，必须先给拿回交代（要回/赎回/对方归还）再经手。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
