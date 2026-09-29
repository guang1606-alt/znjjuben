/**
 * v2.80 阵营归属账本（Affiliation Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - relationship-ledger（v2.80）：跨集人名对"人际关系翻转"（离婚/决裂/绝交…）；
 *    本引擎不收"脱离关系/逐出家门"类人际表述（黑名单过滤，断绝关系类归关系账本）
 *  - character-state-ledger：单人"大状态"（怀孕/坐牢/昏迷…），不涉组织
 *  - prop-ledger / item-ownership-ledger：物件归属；本引擎管"人→组织"归属
 *  - 本引擎：**人名×组织名归属连续性**——具名角色脱离组织（叛出/退出/被逐出/
 *    被除名…）入"已脱离名册"，后续集无回归交代（重归/归顺/加入…）仍以该组织
 *    身份/名义行动（效力/效忠/自称弟子/打旗号…）= 阵营穿帮（high，
 *    "都叛出师门了还自称青云宗弟子"是评论区抓虫重灾区）；
 *    豁免：回归动词出册；卧底/诈降/潜伏表述不算效忠（剧情自由）。
 *
 * 组织名提取（无预置组织词典，纯确定性）：
 *  - zh：动词后连续 2-8 个中文字（可吞 出/离/开/于/自/了/过/掉 连字），
 *        截断于助词 的/了/后/时/中/里，去尾缀 门下/麾下/旗下/帐下；
 *        身份后缀路径取后缀前 2-6 字（按功能字切净人名/虚词残留）；
 *        "以X的名义/打着X的旗号"句式取中间 2-8 字；
 *        "被X除名/开除/革除/驱逐/逐出"取被字后 2-8 字
 *  - en：触发短语后大写开头词序列（可跳 the/a/an/his/her/their/its，
 *        允许 of/the/de/von/la 连接；去尾 's），如 "left the Silver Hand" → "Silver Hand"
 *  - 黑名单过滤人际/泛指残留（关系/家门/家族…）；跨集以 org 原样字符串为记账 key，
 *    提取确定性保证同名组织跨集提取结果一致
 *
 * 记账模型（与关系/信物账本同构，纯确定性）：
 *   每集摘要 { ep, name, org, left, rejoined, loyal }（句内名字×动词×组织名共现）：
 *   left = 名字×脱离动词×org 同句；rejoined = 名字×回归动词×org 同句；
 *   loyal = 名字×org×效忠词/身份后缀/名义旗号句式同句（卧底豁免）。
 *   按集升序过账（同集同名同组织以后到为准）：
 *     ① 册中者本集 loyal 且无 left/rejoined → left_but_loyal（high，
 *        每 name×org 只报 1 次）
 *     ② left 入册（覆盖集号）；③ rejoined 出册（同集先逐出后重归
 *        = 本集内过渡以重归收尾——"逐出又被收回"是常见合法节拍）。
 * 输出：已脱离名册 + issue + 架构师"阵营连续性"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名/组织名透传）。
 */

export interface AffRow {
  /** 集号 */
  ep: number;
  /** 角色名（具名，≥2 字符） */
  name: string;
  /** 组织名（提取原样，≥2 字符） */
  org: string;
  /** 本集脱离（叛出/退出/被逐出…与名字、组织名同句） */
  left: boolean;
  /** 本集回归豁免（重归/归顺/加入…与名字、组织名同句） */
  rejoined: boolean;
  /** 本集仍以该组织身份/名义行动（效力/效忠/弟子/旗号…与名字、组织名同句） */
  loyal: boolean;
}

export interface AffiliationIssue {
  severity: 'high';
  type: 'left_but_loyal';
  evidence: string;
  advice: string;
}

export interface AffiliationLedgerResult {
  /** 已脱离名册：脱离后未回归（跨集阵营监控池） */
  departed: { name: string; org: string; leftEp: number }[];
  issues: AffiliationIssue[];
}

/** 文本最短触发长度（防空白/超短文本误判） */
const MIN_TEXT = 6;
/** 名字最短长度（防单字误伤） */
const MIN_NAME = 2;
/** 名字最长长度（防整段设定误当人名） */
const MAX_NAME = 24;
/** 组织名最短长度（防单字误伤） */
const MIN_ORG = 2;
/** 组织名最长长度（en 大写词序列上限） */
const MAX_ORG = 32;
/** 句内配对的名字数上限（防长名单两两爆炸） */
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 脱离动词（命中即入册；zh 组织名取动词后片段，en 取后随大写词序列）——
const LEFT_ZH: string[] = ['叛出', '叛离', '脱离', '退出', '逐出', '赶出', '被开除', '被革除', '驱逐'];
// —— 回归豁免动词（命中即出册）——
const REJOIN_ZH: string[] = ['重归', '重回', '回归', '归顺', '归附', '投效', '投靠', '加入', '拜入', '重返', '转投'];
// —— 效忠信号动词（册中者命中=无回归交代的身份行动）——
const LOYAL_ZH: string[] = ['效力', '效命', '效忠', '听命', '代表'];

const LEFT_EN: string[] = ['left', 'quit', 'abandoned', 'defected from', 'deserted', 'resigned from', 'seceded from', 'broke away from', 'was expelled from', 'was cast out of', 'was banished from', 'was ousted from', 'walked away from'];
const REJOIN_EN: string[] = ['joined', 'rejoined', 're-joined', 'returned to', 'went back to', 'came back to', 'pledged allegiance to'];
const LOYAL_EN: string[] = ['serving', 'serves', 'served', 'loyal to', 'sworn to', 'answers to', 'obeys', 'works for', 'fights for', 'fights under', 'in the name of', 'on behalf of', 'under the banner of', 'allegiance to', 'member of', 'disciple of', 'apprentice of', 'elder of', 'agent of', 'knight of', 'follower of', 'servant of', 'lieutenant of'];

// —— 身份后缀（zh：后缀前 2-6 字为组织名候选）——
const LOYAL_SUFFIX_ZH: string[] = ['弟子', '门下', '麾下', '门人', '门徒', '教众', '会众', '部下', '手下', '属下', '长老', '执事', '供奉', '成员', '一员'];

// —— 卧底/诈降豁免（句内命中则效忠信号不算，剧情自由）——
const SPY_ZH: string[] = ['卧底', '潜伏', '潜入', '诈降', '假意', '假装', '假投降', '虚与委蛇', '身在曹营', '将计就计', '忍辱负重'];
const SPY_EN: string[] = ['undercover', 'infiltrated', 'infiltrating', 'infiltrate', 'spy', 'spying', 'double agent', 'mole', 'feigned', 'feigning', 'pretend', 'pretending', 'false surrender', 'deep cover', 'secretly working'];

// —— 组织名黑名单（人际/泛指残留：断绝关系类归 relationship-ledger，防跨引擎双册）——
const ORG_BLACKLIST: string[] = ['关系', '家门', '家族', '家庭', '父子关系', '母女关系', '母子关系', '父女关系', '师徒关系', '婚约'];

/** zh 非组织名字集（身份后缀前片段从右往左取连续中文字，遇此集任一字即停；防人名/虚词/动词残尾混入组织名） */
const ZH_NON_ORG_CHARS = '的了后时中里归入出退加叛逐效称为当做任拜投靠顺降属领率掌执管辖率离自以是在这那他她它我你个把被将向从用打与和于';

/** 切句：按中英句终符与换行 */
function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

/** zh 子串 / en 词界（防 ring 误中 during、spy 误中 spying 反向漏配） */
function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

function anyWordIn(sentence: string, words: string[], isZh: boolean): boolean {
  return words.some((w) => wordHit(sentence, w, isZh));
}

/** zh 子串全部出现位置 */
function zhOccurrences(sen: string, w: string): number[] {
  const out: number[] = [];
  let i = sen.indexOf(w);
  while (i >= 0) {
    out.push(i);
    i = sen.indexOf(w, i + 1);
  }
  return out;
}

/** en 词界全部出现位置（\b 包裹，防 huge 误中 hug 类） */
function enOccurrences(sen: string, w: string): number[] {
  const out: number[] = [];
  const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(sen)) !== null) {
    out.push(m.index);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** zh 动词后组织名提取：可吞出/离/开/于/自/了/过/掉连字，截断于助词，去尾缀，≥2 字有效 */
function orgAfterZh(sen: string, from: number): string | null {
  const m = sen.slice(from).match(/^(?:出|离|开|于|自|了|过|掉|出离)?([\u4e00-\u9fff]{2,8})/);
  if (!m) return null;
  let org = m[1];
  const cut = org.search(/[的了后时中里]/);
  if (cut >= 0) org = org.slice(0, cut);
  org = org.replace(/(门下|麾下|旗下|帐下)$/, '');
  return org.length >= MIN_ORG ? org : null;
}

/** 身份后缀前组织名净化：去尾"的/了"，从右往左取连续纯组织中文字（"峰重归青云宗"→"青云宗"），≥2 字有效 */
function cleanOrgBefore(raw: string): string | null {
  let s = raw.replace(/[的了]+$/, '');
  let end = s.length;
  while (end > 0) {
    const ch = s[end - 1];
    if (/[\u4e00-\u9fff]/.test(ch) && !ZH_NON_ORG_CHARS.includes(ch)) end--;
    else break;
  }
  s = s.slice(end);
  return s.length >= MIN_ORG ? s : null;
}

/** en 触发短语后组织名提取：跳冠词/物主限定词，取大写词序列（of/the/de/von/la 连接），去尾 's */
function orgAfterEn(sen: string, from: number): string | null {
  const m = sen.slice(from).match(/^\s*(?:the |a |an |his |her |their |its )?((?:[A-Z][A-Za-z'-]*)(?:(?:\s+(?:of|the|de|von|la)\s+|\s+)(?:[A-Z][A-Za-z'-]*))*)/);
  if (!m) return null;
  const org = m[1].replace(/['’]s$/, '');
  return org.length >= MIN_ORG && org.length <= MAX_ORG ? org : null;
}

/**
 * 单集阵营信号提取：名单内名字逐句配对，脱离/回归/效忠词×组织名共现。
 * 组织名无预置词典，由动词后片段/身份后缀前片段/名义旗号句式确定性提取。
 * @param names 已知角色名列表（来自人物卡 cast，逐句配对提取）
 * @returns 每个命中 name×org 一行 { name, org, left, rejoined, loyal }；空文本/名单空返回 []。
 */
export function deriveAffiliationRows(text: string, names: string[]): { name: string; org: string; left: boolean; rejoined: boolean; loyal: boolean }[] {
  const list = (names ?? []).map((n) => (n ?? '').trim()).filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!text || text.trim().length < MIN_TEXT || !list.length) return [];
  const isZh = isZhText(text);
  const map = new Map<string, { name: string; org: string; left: boolean; rejoined: boolean; loyal: boolean }>();
  for (const sen of sentences(text)) {
    const hit = list.filter((n) => nameIn(sen, n, isZh)).slice(0, MAX_NAMES_PER_SENT);
    if (!hit.length) continue;
    const spy = anyWordIn(sen, isZh ? SPY_ZH : SPY_EN, isZh);
    // 句内组织名候选收集（同组织多路径命中合并标记）
    const orgs = new Map<string, { left: boolean; rejoined: boolean; loyal: boolean }>();
    const noteOrg = (org: string | null, flag: 'left' | 'rejoined' | 'loyal') => {
      if (!org || ORG_BLACKLIST.includes(org)) return;
      const o = orgs.get(org) ?? { left: false, rejoined: false, loyal: false };
      o[flag] = true;
      orgs.set(org, o);
    };
    if (isZh) {
      for (const v of LEFT_ZH) for (const i of zhOccurrences(sen, v)) noteOrg(orgAfterZh(sen, i + v.length), 'left');
      for (const v of REJOIN_ZH) for (const i of zhOccurrences(sen, v)) noteOrg(orgAfterZh(sen, i + v.length), 'rejoined');
      for (const v of LOYAL_ZH) for (const i of zhOccurrences(sen, v)) noteOrg(orgAfterZh(sen, i + v.length), 'loyal');
      // 身份后缀路径：后缀前 2-6 中文字为组织名候选；
      // 后缀前片段本身含脱离/回归动词时（"重归X门下"/"叛出X麾下"）后缀是动作尾巴，跳过效忠标记；
      // 后缀远离动词另起半句时（"已叛出X，为何还自称X弟子"）保留效忠信号
      for (const suf of LOYAL_SUFFIX_ZH) {
        for (const i of zhOccurrences(sen, suf)) {
          if (i < MIN_NAME) continue;
          const m = sen.slice(Math.max(0, i - 6), i).match(/([\u4e00-\u9fff]{2,6})$/);
          if (!m) continue;
          const tail = m[1];
          if (LEFT_ZH.some((v) => tail.includes(v)) || REJOIN_ZH.some((v) => tail.includes(v))) continue;
          const org = cleanOrgBefore(tail);
          if (org && !ORG_BLACKLIST.includes(org)) noteOrg(org, 'loyal');
        }
      }
      // 名义/旗号句式：以X的名义 / 打着X的旗号
      for (const m of sen.matchAll(/以([\u4e00-\u9fff]{2,8}?)的名义/g)) noteOrg(m[1], 'loyal');
      for (const m of sen.matchAll(/打着([\u4e00-\u9fff]{2,8}?)的旗号/g)) noteOrg(m[1], 'loyal');
      // 被 X 除名/开除/革除/驱逐/逐出：组织名在被字与动词之间
      for (const m of sen.matchAll(/被([\u4e00-\u9fff]{2,8}?)(?=除名|开除|革除|驱逐|逐出)/g)) noteOrg(m[1], 'left');
    } else {
      for (const v of LEFT_EN) for (const i of enOccurrences(sen, v)) noteOrg(orgAfterEn(sen, i + v.length), 'left');
      for (const v of REJOIN_EN) for (const i of enOccurrences(sen, v)) noteOrg(orgAfterEn(sen, i + v.length), 'rejoined');
      for (const v of LOYAL_EN) for (const i of enOccurrences(sen, v)) noteOrg(orgAfterEn(sen, i + v.length), 'loyal');
    }
    for (const [org, flags] of orgs) {
      for (const n of hit) {
        const key = `${n}\u0000${org}`;
        const row = map.get(key) ?? { name: n, org, left: false, rejoined: false, loyal: false };
        if (flags.left) row.left = true;
        if (flags.rejoined) row.rejoined = true;
        if (flags.loyal && !spy) row.loyal = true; // 卧底/诈降句式不算效忠
        map.set(key, row);
      }
    }
  }
  // 全假行丢弃（唯一来源：卧底豁免吞掉效忠信号）
  return [...map.values()].filter((r) => r.left || r.rejoined || r.loyal);
}

/** 落库摘要 → AffRow（规范化容错：ep/name/org 非法丢弃、布尔仅认 true） */
export function normalizeAffRow(raw: unknown): AffRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string' || typeof r.org !== 'string') return null;
  const name = r.name.trim();
  const org = r.org.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  if (org.length < MIN_ORG || org.length > MAX_ORG) return null;
  return { ep, name, org, left: r.left === true, rejoined: r.rejoined === true, loyal: r.loyal === true };
}

/**
 * 阵营归属跨集记账：按集升序，脱离入册 / 回归出册 / 册中者再效忠即穿帮。
 * @param rows    前集归属摘要序列（乱序安全，内部按 ep 升序，同集同名同组织以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function affiliationLedger(rows: AffRow[], curEpNo: number): AffiliationLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, AffRow>();
  for (const raw of rows ?? []) {
    const r = normalizeAffRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${r.name}\u0000${r.org}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { name: string; org: string; leftEp: number }>();
  const issues: AffiliationIssue[] = [];
  const reported = new Set<string>();
  for (const r of sorted) {
    const key = `${r.name}\u0000${r.org}`;
    const held = pool.get(key);
    // ① 册中者本集仍以该组织身份/名义行动（无脱离/回归动作——同集先逐出后重归是合法过渡）
    if (held && r.loyal && !r.left && !r.rejoined) {
      if (!reported.has(key)) {
        reported.add(key);
        issues.push({
          severity: 'high',
          type: 'left_but_loyal',
          evidence: `${r.name}（第 ${held.leftEp} 集已脱离「${r.org}」）在第 ${r.ep} 集仍以「${r.org}」的身份/名义行动且无回归交代`,
          advice: '阵营归属穿帮：已叛出/被逐出的组织不得无交代地继续以其成员身份行动。要么本集切断身份关联（换自称/避谈出身），要么先给回归交代（重归/请回/和解）再以该身份行动；卧底/诈降类剧情需有明示铺垫',
        });
      }
      pool.delete(key); // 每 name×org 只报 1 次
      continue;
    }
    // ② 脱离入册（覆盖集号；同集 rejoined+left = 先归后叛的合法弧光，以脱离收尾）
    if (r.left) {
      pool.set(key, { name: r.name, org: r.org, leftEp: r.ep });
    }
    // ③ 回归出册（同集 left+rejoined = 先逐出后重归的本集内过渡，以重归收尾）
    if (r.rejoined) {
      pool.delete(key);
    }
  }
  return { departed: [...pool.values()], issues };
}

/**
 * 阵营连续性调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名/组织名透传）。
 */
export function affiliationDirective(rows: AffRow[]): { zh: string; en: string } {
  const r = affiliationLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.departed.length) return { zh: '', en: '' };
  const listZh = r.departed.map((h) => `${h.name}×「${h.org}」（第${h.leftEp}集脱离）`).join('、');
  const listEn = r.departed.map((h) => `${h.name} × "${h.org}" (left ep${h.leftEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode affiliation — departed-org watch]'] : ['【跨集阵营·归属账本】'];
    lines.push(isEn
      ? `  - Departed and not readmitted: ${listEn}. These characters must NOT act as members, claim the org's banner, or speak in its name this episode; if the plot needs them back, show an explicit readmission beat (return / formal welcome / reconciliation) BEFORE any member identity. Undercover or false-defection plots need on-page setup.`
      : `  - 已脱离未回归组织：${listZh}。本集严禁这些角色以原组织成员身份/名义行动（自称弟子、打旗号、代表出战等）；剧情确需回归，必须先给回归交代（重归/请回/和解）再以该身份行动。卧底/诈降剧情需有明示铺垫。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
