/**
 * v2.80 时间线跨集账本（Timeline Ledger）
 * ------------------------------------------------------------------
 * 缺口：timeline-consistency-check 管单集时钟（集内倒计时反转/昼夜打架/
 * 跳时偷懒），但"跨集时间推进"无人管——
 *   1) 时序倒流：前集"三日后大婚"，本集开场却"翌日清晨"——集与集之间
 *      时间只会往前走，锚点倒退=观众读成穿帮（真闪回需显式标识）；
 *   2) 时间感悬置：连续几集没有任何时间锚（翌日/三日后/当晚），
 *      观众不知道过了多久，追更的钟摆感就散了。
 *
 * 记账模型（与反派威胁同构，纯确定性）：
 *   每集摘要 { ep, mark(时间锚短语), spanDays(归一化推进天数, null=本集无锚) }
 *   时间锚提取：切句→闪回句豁免（回忆/当年/多年前…）→取首个时间表达
 *   （固定词翌日/当晚/与此同时 + 数字跨度"三天后/半月后"），跨度归一化成天。
 *   按集升序过账：
 *     无锚              → drought + 1（时间感悬置）+ 断链（prevSpan 归 null：
 *                          隔了无锚集，时间连续性已不可比，不再判倒流）；
 *     承接锚（当晚/当天）→ 时钟原地重计：drought 清零，prevSpan 归 0
 *                          （"三日后→当晚→翌日"不构成倒流）；
 *     前进锚且 < prevSpan（prevSpan ≥ 2）→ 时序倒流（事件型硬伤，报最后一处）。
 *   drought ≥2 → mid；≥3 → high。倒流即 high。
 * 输出：时序结果 + 架构师"跨集时序校准/补时间锚"指令（与反派威胁注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * mark 为时间短语按原样透传（zh ≤24 字 / en ≤40 字）。
 */

export type TlLang = 'zh' | 'en';

export interface TimelineRow {
  /** 集号 */
  ep: number;
  /** 时间锚短语（''=本集无时间锚） */
  mark: string;
  /** 归一化推进天数（0=承接/同日；null=无锚） */
  spanDays: number | null;
}

export interface TimelineLedgerIssue {
  severity: 'mid' | 'high';
  type: 'timeline_backwards' | 'timeline_drought';
  evidence: string;
  advice: string;
}

export interface TimelineLedgerResult {
  /** 连续无时间锚的集数 */
  droughtRun: number;
  /** 最近一处时序倒流（null=无） */
  backwards: { ep: number; mark: string; prevMark: string; prevSpan: number; span: number } | null;
  /** none / mid / high（倒流=high 总压干旱） */
  level: 'none' | 'mid' | 'high';
  /** 最近一次时间锚短语（供指令引用） */
  line: string;
  issues: TimelineLedgerIssue[];
}

/** 时间悬置阈值：≥2 报 mid，≥3 升 high */
export const TIMELINE_DROUGHT_MID = 2;
export const TIMELINE_DROUGHT_HIGH = 3;

/** zh 锚短语截断 */
const MARK_MAX_ZH = 24;
/** en 锚短语截断 */
const MARK_MAX_EN = 40;
/** 数字跨度正则最短触发文本（防空白误判） */
const MIN_TEXT = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

// —— 闪回豁免：含豁免词的句子不作为时间锚来源（回忆/往事的时间一律不算推进）——
const FLASHBACK_ZH = /(回忆|闪回|当年|往事|记忆|脑海里|多年前|十几年|几十年|那年|那时候|小时候|曾经|旧事|往日|从前)/;
const FLASHBACK_EN = /(flashback|in the past|years ago|back then|as a child|childhood|memory of|remember when|used to)/i;

// —— 固定时间词：span=推进天数；carry=承接锚（时钟原地，不更新 prevSpan）——
const FIXED_ZH: { w: string; span: number; carry: boolean }[] = [
  { w: '翌日', span: 1, carry: false }, { w: '次日', span: 1, carry: false },
  { w: '第二天', span: 1, carry: false }, { w: '第二日', span: 1, carry: false },
  { w: '隔日', span: 1, carry: false }, { w: '隔天', span: 1, carry: false },
  { w: '明日', span: 1, carry: false }, { w: '明早', span: 1, carry: false }, { w: '明晨', span: 1, carry: false },
  { w: '当天', span: 0, carry: true }, { w: '当日', span: 0, carry: true },
  { w: '当晚', span: 0, carry: true }, { w: '今夜', span: 0, carry: true }, { w: '今晚', span: 0, carry: true },
  { w: '此刻', span: 0, carry: true }, { w: '此时', span: 0, carry: true }, { w: '与此同时', span: 0, carry: true },
  { w: '同一时间', span: 0, carry: true }, { w: '当下', span: 0, carry: true },
  { w: '清晨', span: 0, carry: true }, { w: '正午', span: 0, carry: true }, { w: '傍晚', span: 0, carry: true },
  { w: '黄昏', span: 0, carry: true }, { w: '入夜', span: 0, carry: true }, { w: '深夜', span: 0, carry: true },
  { w: '凌晨', span: 0, carry: true }, { w: '午夜', span: 0, carry: true }, { w: '上午', span: 0, carry: true }, { w: '下午', span: 0, carry: true },
];
const FIXED_EN: { w: string; span: number; carry: boolean }[] = [
  { w: 'the next day', span: 1, carry: false }, { w: 'next morning', span: 1, carry: false },
  { w: 'the following day', span: 1, carry: false }, { w: 'the following morning', span: 1, carry: false },
  { w: 'next week', span: 7, carry: false }, { w: 'next month', span: 30, carry: false },
  { w: 'that same day', span: 0, carry: true }, { w: 'that same night', span: 0, carry: true },
  { w: 'that night', span: 0, carry: true }, { w: 'that evening', span: 0, carry: true },
  { w: 'meanwhile', span: 0, carry: true }, { w: 'tonight', span: 0, carry: true },
  { w: 'at dawn', span: 0, carry: true }, { w: 'at noon', span: 0, carry: true }, { w: 'at dusk', span: 0, carry: true },
];

// 数字跨度："三天后/三日内/半个月之后"（排除"第X天"序数与"X年前"回溯；后缀之?后/以后并入锚短语）
const NUM_SPAN_ZH = /(?<![第])([0-9一二两三四五六七八九十百零半几]+)\s*(?:个)?(刻钟|时辰|小时|钟头|天|日|夜|晚|宿|周|星期|礼拜|月|年)(?!之?前)(?:之?后|以后)?/g;
// en 数字跨度："three days later / a few days from now"
const NUM_SPAN_EN = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a few|several)\s+(day|week|month|year|hour|night)s?\s+(?:later|from now)\b/gi;
// en "half a month later"
const HALF_SPAN_EN = /\bhalf\s+(?:a\s+)?(day|week|month|year|hour|night)\b/gi;

/** 承接词表：mark 命中即判承接锚（ledger 由 mark 推导，无需落库） */
const CARRY_ZH = ['当天', '当日', '当晚', '今夜', '今晚', '此刻', '此时', '与此同时', '同一时间', '当下', '清晨', '正午', '傍晚', '黄昏', '入夜', '深夜', '凌晨', '午夜', '上午', '下午'];
const CARRY_EN = ['that same day', 'that same night', 'that night', 'that evening', 'meanwhile', 'tonight', 'at dawn', 'at noon', 'at dusk'];

/** 中文数字 → 数值（支持到百位；'几'=3、'半'=0.5 由调用方处理；失败 NaN） */
export function parseZhNum(s: string): number {
  if (/^[0-9]+$/.test(s)) return parseInt(s, 10);
  if (s === '几') return 3;
  if (s === '半') return 0.5;
  const digit: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const bai = s.indexOf('百');
  if (bai >= 0) {
    const hundreds = digit[s[bai - 1]] ?? 1;
    const rest = s.slice(bai + 1);
    return hundreds * 100 + (rest ? parseZhNum(rest) : 0);
  }
  const shi = s.indexOf('十');
  if (shi >= 0) {
    const tens = shi > 0 ? (digit[s[shi - 1]] ?? 1) : 1;
    const rest = s.slice(shi + 1);
    return tens * 10 + (rest ? (digit[rest[0]] ?? 0) : 0);
  }
  if (s.length === 1 && s in digit) return digit[s];
  return NaN;
}

/** 单位 → 天（时辰/小时/刻钟不足一天归 0；月=30；年=365） */
function unitToDays(unit: string, n: number): number {
  if (unit === '刻钟' || unit === '时辰' || unit === '小时' || unit === '钟头') return 0;
  if (unit === 'hour') return 0;
  if (unit === '天' || unit === '日' || unit === '夜' || unit === '晚' || unit === '宿' || unit === 'day' || unit === 'night') return n;
  if (unit === '周' || unit === '星期' || unit === '礼拜' || unit === 'week') return n * 7;
  if (unit === '月' || unit === 'month') return n * 30;
  if (unit === '年' || unit === 'year') return n * 365;
  return NaN;
}

/**
 * 时间锚提取：切句→闪回句豁免→收集固定词与数字跨度命中→按位置取首个。
 * @returns mark=锚短语；spanDays=推进天数（0=承接/同日）；null=无锚。空文本安全。
 */
export function deriveTimelineMark(text: string): { mark: string; spanDays: number | null; carry: boolean } {
  if (!text || text.trim().length < MIN_TEXT) return { mark: '', spanDays: null, carry: false };
  const zh = isZhText(text);
  // 先剥引号再切句：中文引语多以 ！？收尾，引号不剥会被切分符拦腰截断
  const clean = text.replace(/["'“”‘’「」『』《》]/g, '');
  const sentences = clean.split(zh ? /[。！？；!?;\n\r]+/ : /[.!?;\n\r]+/).map((s) => s.trim()).filter(Boolean);
  for (const sent of sentences) {
    if ((zh ? FLASHBACK_ZH : FLASHBACK_EN).test(sent)) continue; // 闪回句的时间不算推进
    const hay = zh ? sent : sent.toLowerCase();
    type Hit = { index: number; mark: string; span: number; carry: boolean };
    const hits: Hit[] = [];
    const fixed = zh ? FIXED_ZH : FIXED_EN;
    for (const f of fixed) {
      const i = hay.indexOf(f.w);
      if (i >= 0) hits.push({ index: i, mark: f.w, span: f.span, carry: f.carry });
    }
    if (zh) {
      NUM_SPAN_ZH.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = NUM_SPAN_ZH.exec(sent)) !== null) {
        const n = parseZhNum(m[1]);
        const days = unitToDays(m[2], n);
        if (Number.isFinite(days)) hits.push({ index: m.index, mark: m[0], span: days, carry: false });
      }
    } else {
      const numWord: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, 'a few': 3, several: 3 };
      NUM_SPAN_EN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = NUM_SPAN_EN.exec(hay)) !== null) {
        const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : numWord[m[1]] ?? NaN;
        const days = unitToDays(m[2], n);
        if (Number.isFinite(days)) hits.push({ index: m.index, mark: m[0], span: days, carry: false });
      }
      HALF_SPAN_EN.lastIndex = 0;
      while ((m = HALF_SPAN_EN.exec(hay)) !== null) {
        const days = unitToDays(m[1], 0.5);
        if (Number.isFinite(days)) hits.push({ index: m.index, mark: m[0], span: days, carry: false });
      }
    }
    if (hits.length) {
      hits.sort((a, b) => a.index - b.index);
      const hit = hits[0];
      const markMax = zh ? MARK_MAX_ZH : MARK_MAX_EN;
      return { mark: hit.mark.slice(0, markMax), spanDays: hit.span, carry: hit.carry };
    }
  }
  return { mark: '', spanDays: null, carry: false };
}

/** 落库摘要 → TimelineRow（规范化容错：ep 非法丢弃、mark 截断、spanDays 非有限数字归 null） */
export function normalizeTimelineRow(raw: unknown): TimelineRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const mark = typeof r.mark === 'string' ? r.mark.slice(0, MARK_MAX_ZH * 2) : '';
  const span = Number(r.spanDays);
  return { ep, mark, spanDays: Number.isFinite(span) ? span : null };
}

/**
 * 时间线跨集记账：按集升序，无锚干旱+1 / 承接锚时钟原地 / 前进锚倒退=倒流。
 * @param rows    前集时间锚摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function timelineLedger(rows: TimelineRow[], curEpNo: number): TimelineLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizeTimelineRow)
    .filter((r): r is TimelineRow => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  let droughtRun = 0;
  let prevSpan: number | null = null;
  let prevMark = '';
  let backwards: TimelineLedgerResult['backwards'] = null;
  for (const r of sorted) {
    if (r.spanDays === null || !r.mark) {
      droughtRun += 1; // 时间感悬置：连续无锚
      prevSpan = null; // 断链：隔了无锚集，时间连续性已不可比，不判倒流
      continue;
    }
    const carry = CARRY_ZH.some((w) => r.mark.includes(w)) || CARRY_EN.some((w) => r.mark.toLowerCase().includes(w));
    if (!carry && prevSpan !== null && prevSpan >= 2 && r.spanDays < prevSpan) {
      // 时序倒流：跨集锚点倒退且非承接（报最后一处）
      backwards = { ep: r.ep, mark: r.mark, prevMark, prevSpan, span: r.spanDays };
    }
    // 前进锚更新累计跨度；承接锚时钟原地 → 归 0 重计（"三日后→当晚→翌日"不构成倒流）
    prevSpan = carry ? 0 : r.spanDays;
    prevMark = r.mark;
    droughtRun = 0;
  }
  const droughtLevel: 'none' | 'mid' | 'high' = droughtRun >= TIMELINE_DROUGHT_HIGH ? 'high' : droughtRun >= TIMELINE_DROUGHT_MID ? 'mid' : 'none';
  const issues: TimelineLedgerIssue[] = [];
  if (backwards) {
    issues.push({
      severity: 'high',
      type: 'timeline_backwards',
      evidence: `第 ${backwards.ep} 集时间锚「${backwards.mark}」（推进 ${backwards.span} 天）早于前一锚「${backwards.prevMark}」（${backwards.prevSpan} 天）`,
      advice: '跨集时间只会往前走：本集开场锚点必须晚于前集锚点，或直接用承接锚（当晚/当天/与此同时）；若中间跳时用"X日后"明确推进，真闪回必须加回忆标识（闪回/回忆字幕）',
    });
  }
  if (droughtLevel !== 'none') {
    issues.push({
      severity: droughtLevel,
      type: 'timeline_drought',
      evidence: `已连续 ${droughtRun} 集无任何时间锚（上次锚「${prevMark.slice(0, 12)}」）`,
      advice: '时间感悬置：观众不知道过了多久，追更的钟摆感会散——本集开场或转场处补一个时间锚（翌日/三日后/当晚），让时钟继续走',
    });
  }
  const level: 'none' | 'mid' | 'high' = backwards ? 'high' : droughtLevel;
  return { droughtRun, backwards, level, line: prevMark, issues };
}

/**
 * 时间线调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 倒流优先于干旱输出单块；无病/无输入返回空串。
 */
export function timelineDirective(rows: TimelineRow[]): { zh: string; en: string } {
  const r = timelineLedger(rows, Number.MAX_SAFE_INTEGER);
  if (r.level === 'none') return { zh: '', en: '' };
  const isBackwards = r.issues.some((i) => i.type === 'timeline_backwards');
  const build = (isEn: boolean): string => {
    const lines = isBackwards
      ? isEn ? ['[Timeline — recalibrate this episode]'] : ['【跨集时序·本集校准】']
      : isEn ? ['[Timeline — drop a time anchor]'] : ['【跨集时序·补时间锚】'];
    lines.push(isBackwards
      ? isEn
        ? `  - Episode anchor "${r.backwards!.mark}" moves BACKWARD against the previous anchor "${r.backwards!.prevMark}" (${r.backwards!.prevSpan} days → ${r.backwards!.span} days) — time only moves forward across episodes: open this episode after the previous anchor, or use a carry-over anchor (that night / that same day); if it is a true flashback, label it explicitly (flashback caption).`
        : `  - 第 ${r.backwards!.ep} 集锚「${r.backwards!.mark}」倒退于前锚「${r.backwards!.prevMark}」（${r.backwards!.prevSpan} 天→${r.backwards!.span} 天）——跨集时间只会往前走：本集开场锚点必须晚于前集锚点，或用承接锚（当晚/当天/与此同时）；真闪回必须加回忆标识（闪回/回忆字幕）。`
      : isEn
        ? `  - ${r.droughtRun} episodes in a row without any time anchor — the audience loses track of how long has passed. Open or transition this episode with one explicit anchor (the next day / three days later / that night) to keep the clock ticking.`
        : `  - 已连续 ${r.droughtRun} 集无任何时间锚——观众不知道过了多久，追更的钟摆感会散：本集开场或转场处补一个明确时间锚（翌日/三日后/当晚），让时钟继续走。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
