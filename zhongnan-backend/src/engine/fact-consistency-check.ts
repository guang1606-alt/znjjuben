/**
 * v2.351 数值/事实穿帮检测引擎（Fact Consistency Check）
 * ------------------------------------------------------------------
 * 盲区坐实：continuity-supervision 只管「物理状态穿帮」（死了又活/伤了又好），
 * 不管「数值口径穿帮」——「借50万后文变500万」「25岁变30岁」这类同主体同属性
 * 数值前后矛盾，观众一秒出戏，真人/AIGC 双制式通用，且全引擎零覆盖。
 *
 * 分工边界（先证伪再坐实，避免与邻居重复定罪）：
 *  - timeline-ledger：跨集时间线（时刻/日期顺序），故本引擎不收「点」、跳过日历年(19xx/20xx+年)；
 *  - continuity-supervision：物理状态（生死/伤势），不管数值；
 *  - script-format：字数带闸门，不管语义；
 *  - 本引擎：同槽（名词片段 + 量词类）出现 ≥2 个不同归一值 → high fact_number_conflict。
 *
 * 控误报闸门：场标行剔除 / 第X序数跳过 / 裸数字无名词槽不参与比对 / 方位短语（桌上/箱子里）不作槽。
 * 纯确定性、零 LLM、零 IO；中英双语，en 层系统文案零中文。
 */

export type FactLang = 'zh' | 'en';
type UnitClass = 'amount' | 'age' | 'duration' | 'people' | 'count';

export interface FactIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'fact_number_conflict';
  evidence: string;
  advice: string;
}

export interface FactResult {
  score: number;
  /** 输入有效（非空、≥20字正文）才检测；空稿/畸形输入 checked=false 满分放行 */
  checked: boolean;
  /** 数值槽位数（名词片段+量词类 分组数） */
  slotCount: number;
  /** 冲突对数（同槽内 distinct 值两两成对，去重） */
  conflictCount: number;
  issues: FactIssue[];
}

interface Mention {
  cls: UnitClass;
  fragment: string;
  value: number;
  display: string;
  lineNo: number;
  lineText: string;
}

interface Group {
  key: string;
  cls: UnitClass;
  mentions: Mention[];
}

const HEADER_RES: RegExp[] = [
  /^\s*第\s*[0-9一二三四五六七八九十百零]+\s*[集场幕]/,
  /^\s*(内景|外景|室内|室外|INT\.?|EXT\.)/i,
  /^\s*EPISODE\b/i,
];

const NUM_SRC = '\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|[零一二三四五六七八九两十百千万]+';

const CN_DIGIT: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 两: 2,
};

/** 中文数字 parser：五十万=500000、三万五=35000、一百二=120、十八=18、十二万五=125000 */
function parseCnNumber(tok: string): number {
  let total = 0;
  let section = 0;
  let number = 0;
  let lastUnit = 1;
  for (const ch of tok) {
    if (ch in CN_DIGIT) {
      number = CN_DIGIT[ch];
      continue;
    }
    if (ch === '十' || ch === '百' || ch === '千') {
      const unit = ch === '十' ? 10 : ch === '百' ? 100 : 1000;
      if (number === 0) number = 1;
      section += number * unit;
      number = 0;
      lastUnit = unit;
      continue;
    }
    if (ch === '万') {
      total += (section + number) * 10000;
      section = 0;
      number = 0;
      lastUnit = 10000;
      continue;
    }
  }
  let rest = number;
  if (rest > 0 && lastUnit >= 10) rest = number * (lastUnit / 10);
  return total + section + rest;
}

interface Quant {
  text: string;
  cls: UnitClass;
  scale: number;
  en?: boolean;
}

/** 量词表（有序，最长优先）；不收「点」（时刻归 timeline-ledger） */
const QUANTS: Quant[] = [
  { text: '个月', cls: 'duration', scale: 1 },
  { text: 'years old', cls: 'age', scale: 1, en: true },
  { text: 'thousand', cls: 'amount', scale: 1000, en: true },
  { text: 'million', cls: 'amount', scale: 1000000, en: true },
  { text: 'hundred', cls: 'amount', scale: 100, en: true },
  { text: 'dollars', cls: 'amount', scale: 1, en: true },
  { text: 'dollar', cls: 'amount', scale: 1, en: true },
  { text: 'bucks', cls: 'amount', scale: 1, en: true },
  { text: 'buck', cls: 'amount', scale: 1, en: true },
  { text: 'years', cls: 'duration', scale: 1, en: true },
  { text: 'months', cls: 'duration', scale: 1, en: true },
  { text: 'days', cls: 'duration', scale: 1, en: true },
  { text: 'times', cls: 'count', scale: 1, en: true },
  { text: 'people', cls: 'people', scale: 1, en: true },
  { text: 'floors', cls: 'count', scale: 1, en: true },
  { text: '万', cls: 'amount', scale: 10000 },
  { text: '千', cls: 'amount', scale: 1000 },
  { text: '百', cls: 'amount', scale: 100 },
  { text: '块', cls: 'amount', scale: 1 },
  { text: '元', cls: 'amount', scale: 1 },
  { text: '岁', cls: 'age', scale: 1 },
  { text: '年', cls: 'duration', scale: 1 },
  { text: '天', cls: 'duration', scale: 1 },
  { text: '次', cls: 'count', scale: 1 },
  { text: '人', cls: 'people', scale: 1 },
  { text: '个', cls: 'count', scale: 1 },
  { text: '名', cls: 'people', scale: 1 },
  { text: '位', cls: 'people', scale: 1 },
  { text: '层', cls: 'count', scale: 1 },
  { text: '辆', cls: 'count', scale: 1 },
  { text: '套', cls: 'count', scale: 1 },
  { text: '件', cls: 'count', scale: 1 },
  { text: 'k', cls: 'amount', scale: 1000, en: true },
];

function matchQuantifier(line: string, pos: number): { q: Quant; end: number } | null {
  for (const q of QUANTS) {
    if (q.en) {
      let end = -1;
      if (line.slice(pos, pos + q.text.length).toLowerCase() === q.text) {
        end = pos + q.text.length;
      } else if (line[pos] === ' ' && line.slice(pos + 1, pos + 1 + q.text.length).toLowerCase() === q.text) {
        end = pos + 1 + q.text.length;
      }
      if (end < 0) continue;
      const next = line[end];
      if (next && /[A-Za-z]/.test(next)) continue; // 词边界：后非字母
      return { q, end };
    }
    if (line.startsWith(q.text, pos)) return { q, end: pos + q.text.length };
  }
  return null;
}

const ZH_TAIL_STOP = new Set(
  '了要是花借欠给赔值约共仅还出拿付交在涨到跌剩差够的和跟与并或又也就才被把让使令不摆装放有存着'.split(''),
);
const ZH_HEAD_STOP = new Set(['这', '那', '某', '每', '本']);
const ZH_FB_HEAD = new Set(['的', '了', '是', '对']);
/** 方位/介词结尾的片段是位置或动宾短语不是主体（桌上摆着50万/两人并肩走在江边），不作槽 */
const ZH_LOC_END = new Set(['上', '下', '里', '内', '中', '旁', '边', '间', '在']);

function zhFragment(line: string, numStart: number, quantEnd: number): string | null {
  const before = line.slice(0, numStart);
  const runM = before.match(/[一-龥]+$/);
  if (runM) {
    let frag = runM[0].slice(-6);
    while (frag.length > 0 && ZH_TAIL_STOP.has(frag[frag.length - 1])) frag = frag.slice(0, -1);
    while (frag.length > 0 && ZH_HEAD_STOP.has(frag[0])) frag = frag.slice(1);
    if (frag.length >= 2 && !ZH_LOC_END.has(frag[frag.length - 1])) return frag;
  }
  const after = line.slice(quantEnd);
  const fbM = after.match(/^[一-龥]{1,4}/);
  if (fbM) {
    let frag = fbM[0];
    while (frag.length > 0 && ZH_FB_HEAD.has(frag[0])) frag = frag.slice(1);
    if (frag.length >= 2 && !ZH_LOC_END.has(frag[frag.length - 1])) return frag;
  }
  return null;
}

const EN_TAIL_STOP = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had',
  'cost', 'costs', 'paid', 'pay', 'pays', 'gave', 'give', 'gives',
  'spent', 'spend', 'spends', 'owe', 'owes', 'borrowed', 'borrow', 'borrows',
  'worth', 'about', 'around', 'nearly', 'almost', 'only', 'just',
  'of', 'for', 'with', 'to', 'in', 'on', 'at', 'and', 'or', 'but', 'so',
  'said', 'says', 'told', 'asked', 'need', 'needs', 'want', 'wants',
  'take', 'takes', 'took', 'got', 'get', 'gets',
]);
const EN_HEAD_STOP = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
]);

function enFragment(line: string, numStart: number, quantEnd: number): string | null {
  const before = line.slice(0, numStart);
  const words = before.match(/[A-Za-z']+/g);
  if (words && words.length) {
    let ws = words.slice(-4).map((w) => w.toLowerCase());
    while (ws.length && EN_TAIL_STOP.has(ws[ws.length - 1])) ws.pop();
    while (ws.length && EN_HEAD_STOP.has(ws[0])) ws.shift();
    ws = ws.slice(-2);
    if (ws.length) return ws.join(' ');
  }
  const after = line.slice(quantEnd);
  const aw = after.match(/[A-Za-z']+/g);
  if (aw && aw.length) {
    const ws = aw.slice(0, 2).map((w) => w.toLowerCase());
    while (ws.length && EN_HEAD_STOP.has(ws[0])) ws.shift();
    if (ws.length) return ws.join(' ');
  }
  return null;
}

/** 槽片段兼容：相等或互为前后缀（短者 zh≥2 字 / en≥1 词），如「母亲」∩「上面写母亲」、「改口费」∩「改口费明明」 */
function fragCompatible(a: string, b: string, en: boolean): boolean {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = short === a ? b : a;
  if (en) {
    const sw = short.split(' ');
    const lw = long.split(' ');
    if (sw.length < 1 || lw.length < 1) return false;
    return lw.slice(-sw.length).join(' ') === short || lw.slice(0, sw.length).join(' ') === short;
  }
  if (short.length < 2) return false;
  return long.endsWith(short) || long.startsWith(short);
}

function trimLine(s: string, en: boolean): string {
  return s.length > 36 ? s.slice(0, 36) + (en ? '...' : '…') : s;
}

export function factConsistencyCheck(
  text: string | null | undefined,
  lang: FactLang = 'zh',
): FactResult {
  const isZh = lang === 'zh';
  const base: FactResult = { score: 100, checked: false, slotCount: 0, conflictCount: 0, issues: [] };
  const body = (text ?? '').replace(/\r\n?/g, '\n');
  if (body.trim().length < 20) return base;

  const mentions: Mention[] = [];
  const lines = body.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (HEADER_RES.some((re) => re.test(line))) continue;
    const re = new RegExp(NUM_SRC, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const start = m.index;
      const raw = m[0];
      // 序数豁免：数字直接前「第」
      if (start > 0 && line[start - 1] === '第') continue;
      const isArabic = /^\d/.test(raw);
      const qm = matchQuantifier(line, start + raw.length);
      let value: number;
      let cls: UnitClass | null = null;
      let quantEnd = start + raw.length;
      let quantText = '';
      if (isArabic) {
        value = parseFloat(raw.replace(/,/g, ''));
        if (qm) {
          // 日历年豁免：19xx/20xx + 年（归 timeline-ledger 管）
          if (qm.q.text === '年' && value >= 1900 && value <= 2099) {
            re.lastIndex = qm.end;
            continue;
          }
          cls = qm.q.cls;
          value = value * qm.q.scale;
          quantEnd = qm.end;
          quantText = line.slice(start + raw.length, qm.end);
        } else {
          const prev = start > 0 ? line[start - 1] : '';
          if (prev === '$' || prev === '￥' || prev === '¥') cls = 'amount';
          else continue; // 裸阿拉伯数字不参与
        }
      } else {
        value = parseCnNumber(raw);
        if (value <= 0) continue; // 单「万」等无效
        if (qm) {
          cls = qm.q.cls; // 中文 token 为绝对值，不再乘量词 scale
          quantEnd = qm.end;
          quantText = line.slice(start + raw.length, qm.end);
        } else if (/[万千百]/.test(raw)) {
          cls = 'amount';
        } else {
          continue; // 无量词且不含万千百 → 跳过
        }
      }
      const fragment = isZh
        ? zhFragment(line, start, quantEnd)
        : enFragment(line, start, quantEnd);
      if (!fragment) continue; // 裸数字无名词槽不参与比对
      mentions.push({
        cls,
        fragment,
        value,
        display: raw + quantText,
        lineNo: li + 1,
        lineText: line.trim(),
      });
      if (quantEnd > re.lastIndex) re.lastIndex = quantEnd;
    }
  }

  // 分组：同量词类 + 片段兼容
  const groups: Group[] = [];
  for (const mt of mentions) {
    const g = groups.find((gr) => gr.cls === mt.cls && fragCompatible(gr.key, mt.fragment, !isZh));
    if (!g) {
      groups.push({ key: mt.fragment, cls: mt.cls, mentions: [mt] });
    } else {
      if (mt.fragment.length < g.key.length) g.key = mt.fragment;
      g.mentions.push(mt);
    }
  }

  // 判定：组内 distinct 值（按首现序）两两成对 = 冲突对
  const issues: FactIssue[] = [];
  let pairs = 0;
  for (const g of groups) {
    const seen = new Map<number, Mention>();
    for (const mt of g.mentions) if (!seen.has(mt.value)) seen.set(mt.value, mt);
    const vals = [...seen.values()];
    for (let i = 0; i < vals.length; i++) {
      for (let j = i + 1; j < vals.length; j++) {
        pairs++;
        const a = vals[i];
        const b = vals[j];
        issues.push({
          severity: 'high',
          type: 'fact_number_conflict',
          evidence: isZh
            ? `「${g.key}」数值前后矛盾：第${a.lineNo}行"${trimLine(a.lineText, false)}"写的是${a.display}，第${b.lineNo}行"${trimLine(b.lineText, false)}"却写成${b.display}`
            : `Fact conflict on "${g.key}": line ${a.lineNo} "${trimLine(a.lineText, true)}" states ${a.display}, but line ${b.lineNo} "${trimLine(b.lineText, true)}" says ${b.display}.`,
          advice: isZh
            ? '同一事实的数值必须前后统一：金额、年龄、人数等关键数字全稿只能有一个口径。若系剧情反转或时间推移导致的变化，必须在台词或旁白中明示口径转换，否则观众会一秒出戏。'
            : 'A fact must keep one consistent value across the script: amounts, ages and headcounts may not drift. If the change is an intentional plot twist or time jump, state the new frame explicitly in dialogue or narration, otherwise viewers will be pulled out of the story instantly.',
        });
      }
    }
  }

  return {
    score: Math.max(0, 100 - 22 * pairs),
    checked: true,
    slotCount: groups.length,
    conflictCount: pairs,
    issues,
  };
}
