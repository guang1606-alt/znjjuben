/**
 * v2.80 地点跨集账本（Location Ledger）
 * ------------------------------------------------------------------
 * 查重分工（近邻引擎）：
 *  - location-continuity-check（v2.146）：单集内场标间/场内空间位移交代
 *    （跨城瞬移、同场房间瞬移、内外景矛盾）；本引擎不做单集场景级检测
 *  - character-state-ledger / wound-recovery-ledger：单人状态/伤势跨集延续；
 *    本引擎管"人→地点"的跨集空间连续性（重伤被困后无交代出现在别处）
 *  - 本引擎：**人名×地点名跨集连续性**——具名角色被困/重伤滞留某地
 *    （被困/重伤/昏迷/囚禁…）入"滞留名册"，后续集无脱困交代
 *    （脱困/获救/苏醒/逃出…）却出现在另一地点 = 空间穿帮（high，
 *    "上集还重伤昏迷在山洞，下集直接在家门口"是评论区抓虫重灾区）；
 *    豁免：脱困动词出册；到达新地隐含已完成位移。
 *
 * 地点名提取（无预置地名词典，纯确定性）：
 *  - zh：动词后连续 2-8 个中文字（可吞 到/向/往/去/自/从 介词），
 *        截断于助词 的/了/后/时，去尾缀 里/中/内/处/一带/附近/门口/楼前；
 *  - en：触发短语后大写开头词序列（可跳 the/a/an/his/her/their/its，
 *        允许 of/the/de/von/la 连接；去尾 's），如 "arrived at the Silver Lodge" → "Silver Lodge"
 *  - 黑名单过滤泛指残留（这里/那里/哪里/此处/那边/某个地方/一处）；
 *    跨集以 place 原样字符串为记账 key，提取确定性保证同名地点跨集提取一致
 *
 * 记账模型（与阵营/关系/信物账本同构，纯确定性）：
 *   每集摘要 { ep, name, place, left, arrived, stranded, rescued }
 *   （句内名字×动词×地点名共现）：
 *   stranded = 名字×被困/重伤动词×place 同句；rescued = 名字×脱困动词 同句；
 *   left = 名字×离开动词×place 同句；arrived = 名字×到达动词×place 同句。
 *   按集升序过账（同集同名同地点以后到为准）：
 *     ① 上集 stranded=A 未 rescued，本集出现在 B（B≠A）→ trapped_then_free（high）
 *     ② stranded 入册（place+ep）；③ rescued 出册；
 *        arrived/left 隐含脱困（能移动=不再滞留）同步出册。
 * 输出：滞留名册 + issue + 架构师"地点连续性"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名/地名透传）。
 */

export interface LocRow {
  /** 集号 */
  ep: number;
  /** 角色名（具名，≥2 字符） */
  name: string;
  /** 地点名（提取原样，≥2 字符） */
  place: string;
  /** 本集离开该地（离开/出发/赶往…与名字、地点名同句） */
  left: boolean;
  /** 本集到达该地（抵达/回到/赶到…与名字、地点名同句） */
  arrived: boolean;
  /** 本集被困/重伤滞留该地（被困/重伤/昏迷/囚禁…与名字、地点名同句） */
  stranded: boolean;
  /** 本集脱困（脱困/获救/苏醒/逃出…与名字同句，地点可省略） */
  rescued: boolean;
}

export interface LocationIssue {
  severity: 'high';
  type: 'trapped_then_free';
  evidence: string;
  advice: string;
}

export interface LocationLedgerResult {
  /** 滞留名册：被困/重伤后未脱困（跨集空间监控池） */
  strandeds: { name: string; place: string; strandEp: number }[];
  issues: LocationIssue[];
}

/** 文本最短触发长度 */
const MIN_TEXT = 6;
const MIN_NAME = 2;
const MAX_NAME = 24;
const MIN_PLACE = 2;
const MAX_PLACE = 32;
const MAX_NAMES_PER_SENT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 被困/重伤滞留动词（命中即入册；zh 地点取动词后片段，en 取后随大写词序列）——
const STRANDED_ZH: string[] = ['被困', '困住', '受困', '囚禁', '关押', '锁在', '软禁', '重伤', '昏迷', '晕倒', '倒地', '瘫痪', '动弹不得', '奄奄一息', '垂死'];
// —— 脱困豁免动词（命中即出册）——
const RESCUED_ZH: string[] = ['脱困', '获救', '被救', '救出', '苏醒', '醒来', '恢复', '痊愈', '逃出', '挣脱', '破牢', '越狱'];
// —— 离开动词（隐含能移动，同步清滞留）——
const LEFT_ZH: string[] = ['离开', '出发', '动身', '启程', '上路', '告别', '离去', '撤出', '撤退', '赶往', '前往', '奔赴', '逃离', '逃出'];
// —— 到达动词（隐含已完成位移，同步清滞留并更新当前地点）——
const ARRIVED_ZH: string[] = ['抵达', '到达', '回到', '赶回', '赶到', '来到', '踏足', '进入', '踏入', '走进', '步入'];

const STRANDED_EN: string[] = ['trapped', 'stranded', 'stuck', 'imprisoned', 'locked in', 'locked inside', 'held captive', 'held prisoner', 'under house arrest', 'gravely wounded', 'severely injured', 'critically injured', 'unconscious', 'comatose', 'passed out', 'collapsed', 'paralyzed', 'bedridden', 'dying'];
const RESCUED_EN: string[] = ['rescued', 'freed', 'released', 'saved', 'came to', 'regained consciousness', 'recovered', 'healed', 'escaped', 'broke free', 'broke out', 'sneaked out'];
const LEFT_EN: string[] = ['left', 'departed', 'headed to', 'headed for', 'set off', 'set out', 'set forth', 'drove to', 'flew to', 'traveled to', 'travelled to', 'walked out of', 'stormed out', 'fled', 'fled from', 'escaped from'];
const ARRIVED_EN: string[] = ['arrived at', 'arrived in', 'reached', 'returned to', 'got to', 'came to', 'came back to', 'stepped into', 'walked into', 'entered'];

// —— 地点名黑名单（泛指/指示代词残留，无具体地名无法跨集记账）——
const PLACE_BLACKLIST: string[] = ['这里', '那里', '哪里', '此处', '那边', '这边', '某个地方', '一处', '某处', '什么地方', '哪儿'];

/** zh 可吞介词（动词后到地点名之间） */
const ZH_PREP = '到向去往自从打从由在';
/** zh 截断助词 */
const ZH_STOP = '的了后时';

/** 切句 */
function sentences(text: string): string[] {
  return text.split(/[。！？!?\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function nameIn(sentence: string, name: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(name) : new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(sentence);
}

function wordHit(sentence: string, w: string, isZh: boolean): boolean {
  return isZh ? sentence.includes(w) : new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(sentence);
}

/** zh 地点提取：动词后 2-8 中文字，吞介词，截助词，去尾缀 */
function placeAfterZh(sentence: string, verb: string): string | null {
  const idx = sentence.indexOf(verb);
  if (idx < 0) return null;
  let after = sentence.slice(idx + verb.length);
  after = after.replace(new RegExp(`^[${ZH_PREP}]+`), '');
  const m = after.match(/^[\u4e00-\u9fff]{2,8}/);
  if (!m) return null;
  let s = m[0];
  const stop = s.search(/[的了后时]/);
  if (stop > 0) s = s.slice(0, stop);
  // 长后缀优先（防"深处"被单字"处"先切），单字后缀放后
  for (const suf of ['深处', '里面', '外面', '旁边', '一带', '附近', '门口', '楼前', '门外', '院内', '里', '中', '内', '处']) {
    if (s.endsWith(suf) && s.length - suf.length >= 2) s = s.slice(0, -suf.length);
  }
  if (s.length < MIN_PLACE) return null;
  return s;
}

/** en 地点提取：动词后跳介词/冠词/代词，取连续大写词序列（专有地名，最多3词）或首个普通名词 */
function placeAfterEn(sentence: string, verb: string): string | null {
  const re = new RegExp(`${escapeRe(verb)}\\s+(?:in\\s+|at\\s+|inside\\s+|within\\s+|from\\s+|on\\s+|to\\s+)?(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+|its\\s+)?((?:[A-Z][a-zA-Z]*\\s+){0,2}[A-Z][a-zA-Z]*|[a-z]+)`);
  const m = sentence.match(re);
  if (!m) return null;
  let s = m[1].trim();
  s = s.replace(/'s$/, '');
  if (s.length < MIN_PLACE || s.length > MAX_PLACE) return null;
  return s;
}

function blacklisted(place: string): boolean {
  return PLACE_BLACKLIST.includes(place);
}

/**
 * 从单集终稿提取本集地点状态行（句内人名×动词×地点名共现）。
 * 与阵营/关系/信物账本同构：单次调用遍历 cast 全量人名。
 */
export function deriveLocationRows(draft: string, names: string[]): Omit<LocRow, 'ep'>[] {
  if (!draft || draft.length < MIN_TEXT || !names.length) return [];
  const isZh = isZhText(draft);
  const validNames = names.filter((n) => n.length >= MIN_NAME && n.length <= MAX_NAME);
  if (!validNames.length) return [];
  const sents = sentences(draft);
  const out: Omit<LocRow, 'ep'>[] = [];
  const seen = new Set<string>();
  const strandedW = isZh ? STRANDED_ZH : STRANDED_EN;
  const rescuedW = isZh ? RESCUED_ZH : RESCUED_EN;
  const leftW = isZh ? LEFT_ZH : LEFT_EN;
  const arrivedW = isZh ? ARRIVED_ZH : ARRIVED_EN;
  for (const sent of sents) {
    if (sent.length < MIN_TEXT) continue;
    const hitNames = validNames.filter((n) => nameIn(sent, n, isZh)).slice(0, MAX_NAMES_PER_SENT);
    if (!hitNames.length) continue;
    for (const name of hitNames) {
      // stranded：名字×被困动词×地点
      for (const w of strandedW) {
        if (!wordHit(sent, w, isZh)) continue;
        const place = isZh ? placeAfterZh(sent, w) : placeAfterEn(sent, w);
        if (!place || blacklisted(place)) continue;
        const key = `${name}::${place}`;
        if (seen.has(key)) {
          const r = out.find((x) => x.name === name && x.place === place)!;
          r.stranded = true;
        } else {
          seen.add(key);
          out.push({ name, place, left: false, arrived: false, stranded: true, rescued: false });
        }
      }
      // arrived：名字×到达动词×地点
      for (const w of arrivedW) {
        if (!wordHit(sent, w, isZh)) continue;
        const place = isZh ? placeAfterZh(sent, w) : placeAfterEn(sent, w);
        if (!place || blacklisted(place)) continue;
        const key = `${name}::${place}`;
        if (seen.has(key)) {
          const r = out.find((x) => x.name === name && x.place === place)!;
          r.arrived = true;
        } else {
          seen.add(key);
          out.push({ name, place, left: false, arrived: true, stranded: false, rescued: false });
        }
      }
      // left：名字×离开动词×地点
      for (const w of leftW) {
        if (!wordHit(sent, w, isZh)) continue;
        const place = isZh ? placeAfterZh(sent, w) : placeAfterEn(sent, w);
        if (!place || blacklisted(place)) continue;
        const key = `${name}::${place}`;
        if (seen.has(key)) {
          const r = out.find((x) => x.name === name && x.place === place)!;
          r.left = true;
        } else {
          seen.add(key);
          out.push({ name, place, left: true, arrived: false, stranded: false, rescued: false });
        }
      }
      // rescued：名字×脱困动词（地点可省略，单独标 rescued）
      let rescued = false;
      for (const w of rescuedW) {
        if (wordHit(sent, w, isZh)) { rescued = true; break; }
      }
      if (rescued) {
        // rescued 不绑定地点，但需挂到一个已有的 name×place 行或新增占位
        const existing = out.find((x) => x.name === name);
        if (existing) existing.rescued = true;
        else {
          const key = `${name}::__rescued__`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ name, place: '__rescued__', left: false, arrived: false, stranded: false, rescued: true });
          }
        }
      }
    }
  }
  return out;
}

/** 规范化落库摘要（容错） */
export function normalizeLocRow(raw: Record<string, unknown>): LocRow | null {
  const ep = typeof raw.ep === 'number' ? raw.ep : Number(raw.ep);
  const name = typeof raw.name === 'string' ? raw.name : '';
  const place = typeof raw.place === 'string' ? raw.place : '';
  if (!Number.isFinite(ep) || !name || !place) return null;
  const b = (v: unknown) => v === true || v === 'true' || v === 1;
  return {
    ep,
    name,
    place,
    left: b(raw.left),
    arrived: b(raw.arrived),
    stranded: b(raw.stranded),
    rescued: b(raw.rescued),
  };
}

/**
 * 跨集地点连续性记账。
 * @param rows 全剧集地点状态行（需含 ep；内部按 ep 升序）
 * @param currentEp 当前集号（用于判定"本集"）
 */
export function locationLedger(rows: LocRow[], currentEp: number): LocationLedgerResult {
  const sorted = [...rows].sort((a, b) => a.ep - b.ep || a.name.localeCompare(b.name));
  // 按 name 分组过账
  const byName = new Map<string, LocRow[]>();
  for (const r of sorted) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name)!.push(r);
  }
  const strandeds: { name: string; place: string; strandEp: number }[] = [];
  const issues: LocationIssue[] = [];
  const reported = new Set<string>();
  for (const [name, rrows] of byName) {
    // 状态：strandedPlace + strandEp
    let strandedPlace: string | null = null;
    let strandEp = 0;
    // 按集合并同集同名同地点（以后到为准）
    const byEp = new Map<number, Map<string, LocRow>>();
    for (const r of rrows) {
      if (!byEp.has(r.ep)) byEp.set(r.ep, new Map());
      const m = byEp.get(r.ep)!;
      const key = r.place;
      if (m.has(key)) {
        const ex = m.get(key)!;
        ex.left = ex.left || r.left;
        ex.arrived = ex.arrived || r.arrived;
        ex.stranded = ex.stranded || r.stranded;
        ex.rescued = ex.rescued || r.rescued;
      } else {
        m.set(key, { ...r });
      }
    }
    const eps = [...byEp.keys()].sort((a, b) => a - b);
    for (const ep of eps) {
      const placeMap = byEp.get(ep)!;
      const places = [...placeMap.values()];
      const prevStranded = strandedPlace;
      // 本集脱困信号：rescued 或 离开上一集滞留地（能离开=脱困）
      const hasEscape = places.some((r) => r.rescued || (r.left && r.place === prevStranded));
      // 检测：上集 stranded 未清，本集出现在新地点且无脱困交代 → 穿帮
      if (prevStranded && ep > strandEp) {
        const movedElsewhere = places.some((r) => r.place !== '__rescued__' && r.place !== prevStranded && (r.arrived || r.stranded || r.left));
        if (movedElsewhere && !hasEscape) {
          const k = `${name}::${prevStranded}`;
          if (!reported.has(k)) {
            reported.add(k);
            const target = places.find((r) => r.place !== '__rescued__' && r.place !== prevStranded && (r.arrived || r.stranded || r.left));
            issues.push({
              severity: 'high',
              type: 'trapped_then_free',
              evidence: `${name} 在第${strandEp}集被困/重伤于「${prevStranded}」，第${ep}集无脱困交代出现在「${target?.place ?? '其他地点'}」`,
              advice: `在第${ep}集补充 ${name} 从「${prevStranded}」脱困/获救/被转移的交代（苏醒/被救/连夜转移等），重伤状态不能瞬移`,
            });
          }
        }
      }
      // 过账：先脱困，再 stranded/arrived/left；本集已脱困则 stranded 不再置位
      if (hasEscape) strandedPlace = null;
      for (const r of places) {
        if (r.place === '__rescued__') continue;
        if (r.stranded && !hasEscape) { strandedPlace = r.place; strandEp = ep; }
        else if (r.arrived) { strandedPlace = null; } // 到达新地=已位移
        else if (r.left && strandedPlace === r.place) { strandedPlace = null; } // 离开滞留地=脱困
      }
    }
    if (strandedPlace) strandeds.push({ name, place: strandedPlace, strandEp });
  }
  return { strandeds, issues };
}

/** 架构师"地点连续性"指令（双语，en 零中文；接收 rows 内部调 ledger，与阵营账本同构） */
export function locationDirective(rows: LocRow[]): { en: string; zh: string } {
  const result = locationLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!result.issues.length && !result.strandeds.length) return { en: '', zh: '' };
  const zh: string[] = ['【地点连续性约束】'];
  const en: string[] = ['[Location Continuity]'];
  for (const s of result.strandeds) {
    zh.push(`- ${s.name} 自第${s.strandEp}集起被困/重伤于「${s.place}」，本集若无脱困交代不得让其出现在其他地点`);
    en.push(`- ${s.name} has been stranded/injured at "${s.place}" since ep${s.strandEp}; do not move them elsewhere without an escape/rescue transition`);
  }
  for (const iss of result.issues) {
    zh.push(`- ⚠️ ${iss.evidence}（${iss.advice}）`);
    en.push(`- ⚠️ ${iss.evidence} (${iss.advice})`);
  }
  return { en: en.join('\n'), zh: zh.join('\n') };
}
