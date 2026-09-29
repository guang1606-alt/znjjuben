/**
 * v2.80 关系翻转账本（Relationship Ledger）
 * ------------------------------------------------------------------
 * 查重分工（四个近邻引擎）：
 *  - relationship-progression-check（v2.131）：单集 CP 亲密节拍质量（铺垫/阻碍/升级）
 *  - supporting-arc-check：单集配角态度突变检测（单集内转变缺铺垫）
 *  - character-state-ledger（v2.80）：跨集"大状态"（怀孕/坐牢/昏迷…单人维度）
 *  - 本引擎：**跨集人名对"关系翻转"连续性**——A 与 B 已决裂（离婚/分手/断绝
 *    关系/反目/退婚…）入"已翻转账本名册"，后续集无修复交代（和好/和解/复合）
 *    两人再次亲密互动（拥抱/亲吻/牵手/依偎…）= 关系穿帮（high，
 *    "上集刚离婚这集就贴贴"是评论区抓虫重灾区）；
 *    豁免：和好/和解/冰释前嫌/复合（出册）；决裂与亲密同集出现视为本集内
 *    翻转过渡（先决裂后和解是合法弧光）。
 *
 * 记账模型（与信物归属/创伤账本同构，纯确定性）：
 *   每集摘要 { ep, name, other, rift, reconciled, close }（句内两人名×信号词
 *   两两配对提取，pair 以无序对入账——决裂是双向的）：
 *   rift = 名字对×决裂词同句；reconciled = 名字对×修复词同句；
 *   close = 名字对×亲密词同句。
 *   按集升序过账（同集同对以后到为准）：
 *     ① 册中者本集 close 且无 rift/reconciled → rifted_but_close（high，
 *        每对只报 1 次）；同集 rift+close = 先决裂后和解的合法弧光不报
 *     ② reconciled 出册；③ rift 入册（覆盖集号）。
 * 输出：已翻转账本名册 + issue + 架构师"关系维持"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名透传）。
 */

export interface RelRow {
  /** 集号 */
  ep: number;
  /** 角色名 A（≥2 字符） */
  name: string;
  /** 角色名 B（≥2 字符） */
  other: string;
  /** 本集决裂（离婚/分手/断绝关系…两人同句） */
  rift: boolean;
  /** 本集修复豁免（和好/和解/复合…两人同句） */
  reconciled: boolean;
  /** 本集亲密互动（拥抱/亲吻/牵手…两人同句） */
  close: boolean;
}

export interface RelIssue {
  severity: 'high';
  type: 'rifted_but_close';
  evidence: string;
  advice: string;
}

export interface RelLedgerResult {
  /** 已翻转账本名册：决裂后未修复（跨集关系维持监控池） */
  rifted: { a: string; b: string; riftEp: number }[];
  issues: RelIssue[];
}

/** 文本最短触发长度（防空白/超短文本误判） */
const MIN_TEXT = 6;
/** 名字最短长度（防单字误伤） */
const MIN_NAME = 2;
/** 名字最长长度（防整段设定误当人名） */
const MAX_NAME = 24;
/** 句内配对的名字数上限（防长名单两两爆炸） */
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 决裂信号词（关系翻转成立即入册；"离婚"作为状态证据同样有效）——
const RIFT_ZH: string[] = ['决裂', '断绝关系', '断绝父子关系', '断绝母女关系', '绝交', '反目', '恩断义绝', '割袍断义', '势不两立', '不共戴天', '划清界限', '一刀两断', '离婚', '分手', '退婚', '解除婚约', '退掉婚约', '逐出家门', '赶出家门', '脱离关系'];
// —— 修复豁免信号词 ——
const RECONCILE_ZH: string[] = ['和好', '和解', '冰释前嫌', '尽释前嫌', '重归于好', '言归于好', '握手言和', '复合', '复婚', '破镜重圆', '原谅了', '原谅了他', '原谅了她', '重修旧好'];
// —— 亲密互动信号词（册中对命中=无修复交代的亲密）——
const CLOSE_ZH: string[] = ['拥抱', '相拥', '拥吻', '亲吻', '吻了', '吻住', '牵手', '牵起', '十指相扣', '依偎', '偎依', '搂着', '搂住', '抱着', '相拥而眠', '同床', '共枕'];

const RIFT_EN: string[] = ['divorced', 'break up', 'broke up', 'breakup', 'cut ties', 'severed ties', 'estranged', 'turned against', 'sworn enemies', 'disowned', 'annulled', 'called off the engagement', 'no longer friends'];
const RECONCILE_EN: string[] = ['reconciled', 'made up', 'made peace', 'made amends', 'got back together', 'back together', 'forgave', 'remarried', 'buried the hatchet'];
const CLOSE_EN: string[] = ['hugged', 'hug', 'kissed', 'kiss', 'held hands', 'holding hands', 'embraced', 'snuggled', 'cuddled', 'in his arms', 'in her arms'];

/** 切句：按中英句终符与换行 */
function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

/** zh 子串 / en 词界（防 kiss 误中 skiss 之类） */
function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

function anyWordIn(sentence: string, words: string[], isZh: boolean): boolean {
  return words.some((w) => wordHit(sentence, w, isZh));
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

/** 无序对 key（决裂/亲密都是双向关系） */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('\u0000');
}

/**
 * 单集关系信号提取：名单内名字两两配对，决裂/修复/亲密词同句命中。
 * @param names 已知角色名列表（来自人物卡 cast，逐句配对提取）
 * @returns 每个命中关系对一行 { name, other, rift, reconciled, close }；空文本/名单不足两人返回 []。
 */
export function deriveRelationRows(text: string, names: string[]): { name: string; other: string; rift: boolean; reconciled: boolean; close: boolean }[] {
  const list = (names ?? []).map((n) => (n ?? '').trim()).filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!text || text.trim().length < MIN_TEXT || list.length < 2) return [];
  const isZh = isZhText(text);
  const map = new Map<string, { name: string; other: string; rift: boolean; reconciled: boolean; close: boolean }>();
  for (const sen of sentences(text)) {
    const hit = list.filter((n) => nameIn(sen, n, isZh)).slice(0, MAX_NAMES_PER_SENT);
    if (hit.length < 2) continue;
    const rift = anyWordIn(sen, isZh ? RIFT_ZH : RIFT_EN, isZh);
    const reconciled = anyWordIn(sen, isZh ? RECONCILE_ZH : RECONCILE_EN, isZh);
    const close = anyWordIn(sen, isZh ? CLOSE_ZH : CLOSE_EN, isZh);
    if (!rift && !reconciled && !close) continue;
    for (let i = 0; i < hit.length; i++) {
      for (let j = i + 1; j < hit.length; j++) {
        const a = hit[i];
        const b = hit[j];
        const key = pairKey(a, b);
        const row = map.get(key) ?? { name: a, other: b, rift: false, reconciled: false, close: false };
        if (rift) row.rift = true;
        if (reconciled) row.reconciled = true;
        if (close) row.close = true;
        map.set(key, row);
      }
    }
  }
  return [...map.values()];
}

/** 落库摘要 → RelRow（规范化容错：ep/name/other 非法丢弃、布尔仅认 true） */
export function normalizeRelRow(raw: unknown): RelRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string' || typeof r.other !== 'string') return null;
  const name = r.name.trim();
  const other = r.other.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME || other.length < MIN_NAME || other.length > MAX_NAME) return null;
  if (name === other) return null;
  return { ep, name, other, rift: r.rift === true, reconciled: r.reconciled === true, close: r.close === true };
}

/**
 * 关系翻转跨集记账：按集升序，决裂入册 / 修复出册 / 册中对再亲密即穿帮。
 * @param rows    前集关系摘要序列（乱序安全，内部按 ep 升序，同集同对以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function relationshipLedger(rows: RelRow[], curEpNo: number): RelLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, RelRow>();
  for (const raw of rows ?? []) {
    const r = normalizeRelRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${pairKey(r.name, r.other)}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { a: string; b: string; riftEp: number }>();
  const issues: RelIssue[] = [];
  const reported = new Set<string>();
  for (const r of sorted) {
    const key = pairKey(r.name, r.other);
    const held = pool.get(key);
    // ① 册中者本集亲密且无决裂/修复（同集先决裂后和解是合法弧光）
    if (held && r.close && !r.rift && !r.reconciled) {
      if (!reported.has(key)) {
        reported.add(key);
        issues.push({
          severity: 'high',
          type: 'rifted_but_close',
          evidence: `${held.a}与${held.b}（第 ${held.riftEp} 集已决裂）在第 ${r.ep} 集亲密互动且无修复交代`,
          advice: '关系翻转穿帮：已决裂/离婚的两人不得无交代地亲密如初。要么本集保持关系距离（敌对/回避），要么先给修复台阶（道歉/误会解开/和解戏）再让关系回暖',
        });
      }
      pool.delete(key); // 每对只报 1 次
      continue;
    }
    // ② 修复出册
    if (held && r.reconciled) {
      pool.delete(key);
    }
    // ③ 决裂入册（同集 reconciled+rift = 本集内翻转过渡，覆盖集号）
    if (r.rift) {
      pool.set(key, { a: r.name, b: r.other, riftEp: r.ep });
    }
  }
  return { rifted: [...pool.values()], issues };
}

/**
 * 关系维持调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名透传）。
 */
export function relationshipDirective(rows: RelRow[]): { zh: string; en: string } {
  const r = relationshipLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.rifted.length) return { zh: '', en: '' };
  const listZh = r.rifted.map((h) => `${h.a}×${h.b}（第${h.riftEp}集决裂）`).join('、');
  const listEn = r.rifted.map((h) => `${h.a} × ${h.b} (rift ep${h.riftEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode relationship — rift watch]'] : ['【跨集关系·翻转账本】'];
    lines.push(isEn
      ? `  - Rifted and unreconciled: ${listEn}. These pairs must NOT act intimate this episode; if the plot needs a thaw, first show an explicit repair beat (apology / misunderstanding resolved / reconciliation scene) BEFORE any closeness.`
      : `  - 已决裂未修复关系：${listZh}。本集严禁这些关系对无修复交代地亲密互动；剧情确需和好，必须先给修复台阶（道歉/误会解开/和解戏）再回暖。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
