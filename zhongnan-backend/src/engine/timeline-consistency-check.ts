import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.138 时间线一致性检测器（Timeline Consistency Check）
 *
 * 短剧的时钟不能穿帮：观众对"还剩几天"和"白天黑夜"异常敏感。与既有引擎的分工：
 * - causal-logic-check：因果逻辑（因为所以能不能成立）
 * - scene-header-convention：场景标题格式规不规范
 * - v2.138（本引擎）：时钟本身——倒计时/昼夜/时间跳跃/关系时长
 *
 * 四类判定：
 * 1. countdown_reversal（1 处 mid，≥2 处 high）倒计时反转：
 *    "只剩三天"→（次日）→"只剩五天"。时间只会往前走，剩余只减不增。
 *    按事件名词（婚礼/开庭/手术…）分别计时，跨单位换算到小时（48 小时=2 天），2 小时容差。
 * 2. day_night_mismatch（mid）昼夜打架：
 *    场景标题写"夜"，正文却是"正午阳光刺眼"；或标题"日"正文"凌晨三点月亮"。
 * 3. time_skip_stuffing（≥3 处 low，≥5 处 mid）跳时间偷懒：
 *    整行只有"三天后。"/"（次日）"充当转场 ≥3 次——用字幕跳时间替代写戏。
 * 4. timeline_squash（mid）时长压扁：
 *    同一场戏里"昨天才认识/初次见面"与"结婚三年/认识多年"并存，关系时长自相矛盾。
 *
 * 正信号：场景标题带明确昼夜标注（日/夜/NIGHT）每场 +1（cap3）——可调度性的基本功。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type TcLang = 'zh' | 'en';

export interface TimelineIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'countdown_reversal' | 'day_night_mismatch' | 'time_skip_stuffing' | 'timeline_squash';
  evidence: string;
  advice: string;
}

export interface TimelineSceneReport {
  index: number;
  header: string;
  phase: 'day' | 'night' | null;
  mismatch: boolean;
}

export interface TimelineConsistencyResult {
  score: number;
  sceneCount: number;
  deadlineCount: number;
  skipMarkerCount: number;
  standaloneSkipCount: number;
  reversalCount: number;
  mismatchCount: number;
  squashCount: number;
  anchoredSceneCount: number;
  scenes: TimelineSceneReport[];
  issues: TimelineIssue[];
}

// —— 中文时间词库（只用多字词；裸单字误伤教训）——
// 倒计时：只剩/还有/距离 + 数词 + 单位
const DEADLINE_ZH = /(?:只剩|还剩|剩下|还有|距离|距|离)[^，。；？！\n,;?]{0,8}?([0-9一二两三四五六七八九十半]+)\s*(?:个)?(天|日|小时|钟头|周|星期|个月)(?:[^，。；？！\n,;?]{0,14})?/g;
// 行内时间前进：三天后/两周之后/一个月以后（"第X天"由次日分支处理，lookbehind 防重复计数）
const SKIP_ZH = /(?<![第过])([0-9一二两三四五六七八九十半]+)\s*(?:个)?(天|日|周|个月|年)(?:以后|之后|后)/g;
const SKIP_WORD_ZH = /(?:次日|翌日|第二天(?:早上|清晨|上午|晚上)?|第二日)/g;
// 事件名词（倒计时各自归属，防止"婚礼剩3天"与"开庭剩5天"互相误判）
const EVENT_ZH = /(婚礼|开庭|手术|发布会|考试|竞标|股东大会|年会|订婚宴|签约|首映|葬礼|面试|记者会)/;
// 独立成行的偷懒转场
const STANDALONE_SKIP_ZH = /^[（(【\s\-—–.:：]*(?:次日|翌日|第二天(?:早上|清晨|上午|晚上)?|第二日|[0-9一二两三四五六七八九十半]+\s*(?:个)?(?:天|日|周|个月|年)(?:以后|之后|后)?)[）)】\s。.…，,！!？?\-—–:：]*$/;
// 标题昼夜
const NIGHT_HDR_ZH = /(夜|深夜|凌晨|午夜|半夜|傍晚|黄昏|晚上|晚间)/;
// "日"作为光照标注只认独立 token（"第三日"是日期不算），其余白昼词直接收
const DAY_HDR_ZH = /(晨|清晨|早上|早晨|上午|中午|正午|午后|下午|白天|昼|日景|(?:^|[\s·,，\-—])日(?:景)?(?=$|[\s·,，\-—]))/;
// 正文光影（多字）
const DAY_BODY_ZH = /(阳光(?:明媚|普照|刺眼|灿烂|洒(?:进|在|下))?|太阳(?:高照|晒得|刺眼|当空)|正午(?:的)?(?:烈日|太阳|阳光)|烈日(?:当头|炎炎)|晨光|天亮(?:了)?|大白天|白昼|天光)/g;
const NIGHT_BODY_ZH = /(夜深(?:人静)?|深夜|凌晨(?:[一二三四五六七八九十0-9]+点)?|月亮(?:高悬|当空)?|月光(?:如水|洒(?:在|进|下))?|星空|午夜|半夜(?:三更)?|漆(?:黑|黑一片)|夜里|三更半夜|华灯初上|万家灯火)/g;
// 关系时长压扁
const FRESH_ZH = /(刚认识|第一天认识|昨天才认识|昨天刚认识|初次见面|第一次见面|刚见面|才认识(?:不久)?|素未谋面|素不相识|头回见|第一次见)/g;
const LONG_ZH = /(?:认识|在一起|结婚|嫁给|娶了|相恋|相爱|交往)[^，。；？！\n,;?]{0,6}?(?:[0-9一二两三四五六七八九十]+\s*(?:年|个月)|多年|好几年|十几年|几十年|(?:[0-9一二两三四五六七八九十]+)周年)/g;

// —— 英文时间词库（数词兼容 one…twelve 英文词）——
const NUM_EN = String.raw`(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half)`;
const DEADLINE_EN = new RegExp(String.raw`\b(?:only|just|have|has|got|we'?ve got|we have)\s+(${NUM_EN})\s*(days?|hours?|weeks?|months?)\s*(?:left|remaining|to go)\b`, 'gi');
const SKIP_EN = new RegExp(String.raw`\b(${NUM_EN})\s*(days?|weeks?|months?|years?|hours?)\s*later\b`, 'gi');
const SKIP_WORD_EN = /\bthe (?:next|following) (?:day|morning)\b/gi;
const EVENT_EN = /\b(wedding|trial|hearing|surgery|launch(?: party)?|exam|board meeting|audition|signing|funeral|interview|press conference|deadline)\b/i;
const STANDALONE_SKIP_EN = new RegExp(String.raw`^[(\[]?\s*(?:the (?:next|following) (?:day|morning)|that (?:night|evening)|(?:${NUM_EN})\s*(?:days?|weeks?|months?|years?|hours?)\s*later)[)\].?\s…\-—–]*$`, 'i');
const NIGHT_HDR_EN = /\b(night|evening|dusk|midnight|nighttime|after dark)\b/i;
const DAY_HDR_EN = /\b(day|daytime|morning|noon|afternoon|sunrise|broad daylight)\b/i;
const DAY_BODY_EN = /\b(?:bright (?:morning )?sunlight|sunlight streamed|midday sun|blazing sun|broad daylight|the sun (?:was|shone|hung) high|morning light|broad daylight)\b/gi;
const NIGHT_BODY_EN = /\b(?:moonlight|starry (?:sky|night)|middle of the night|dead of night|past midnight|pitch[- ]black|late at night|the moon (?:hung|was) high|3\s*a\.?m\.?)\b/gi;
const FRESH_EN = /\b(?:just met|first time (?:meeting|we met)|met (?:him|her|them) yesterday|strangers (?:until|before) (?:yesterday|today)|never met before)\b/gi;
const LONG_EN = /\b(?:known (?:him|her|them|each other) for (?:years|\d+\s*(?:years|months))|married for (?:years|\d+\s*years)|together for (?:years|\d+\s*years)|\d+[- ]year(?:s)? (?:of )?(?:marriage|anniversary|relationship))\b/gi;


const clamp = (n: number) => Math.max(0, Math.min(100, n));

function matchAll(text: string, re: RegExp): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** 中文数词 → 数字（支持阿拉伯数字/半/十/二十/二十三，上限 99） */
function cnNum(s: string): number {
  if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
  if (s === '半') return 0.5;
  if (s === '两') return 2;
  const digit: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s === '十') return 10;
  const tenIdx = s.indexOf('十');
  if (tenIdx >= 0) {
    const left = s.slice(0, tenIdx);
    const right = s.slice(tenIdx + 1);
    const tens = left ? digit[left] ?? 1 : 1;
    const ones = right ? digit[right] ?? 0 : 0;
    return tens * 10 + ones;
  }
  return digit[s] ?? NaN;
}

function unitHoursZh(u: string): number {
  if (u === '小时' || u === '钟头') return 1;
  if (u === '周' || u === '星期') return 168;
  if (u === '个月') return 720;
  return 24; // 天/日
}

function unitHoursEn(u: string): number {
  const w = u.toLowerCase();
  if (w.startsWith('hour')) return 1;
  if (w.startsWith('week')) return 168;
  if (w.startsWith('month')) return 720;
  return 24; // day(s)
}

const EN_WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5,
};
function enNum(s: string): number {
  if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
  return EN_WORD_NUM[s.toLowerCase()] ?? NaN;
}

interface SplitScene {
  header: string;
  lines: string[];
}

function splitScenes(text: string, lang: TcLang): SplitScene[] {
  const isHeader = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    return isSceneHeaderLine(t, lang); // c213：收口共享切分器
  };
  const scenes: SplitScene[] = [];
  let cur: SplitScene | null = null;
  for (const raw of text.split('\n')) {
    if (isHeader(raw)) {
      if (cur) scenes.push(cur);
      cur = { header: raw.trim(), lines: [] };
    } else if (cur && raw.trim()) {
      cur.lines.push(raw.trim());
    }
  }
  if (cur) scenes.push(cur);
  return scenes;
}

interface TimeEvent {
  pos: number;
  kind: 'deadline' | 'skip';
  hours: number;
  key: string;
}

/**
 * v2.138 时间线一致性检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function timelineConsistencyCheck(text: string, lang: TcLang = 'zh'): TimelineConsistencyResult {
  const empty: TimelineConsistencyResult = {
    score: 100,
    sceneCount: 0,
    deadlineCount: 0,
    skipMarkerCount: 0,
    standaloneSkipCount: 0,
    reversalCount: 0,
    mismatchCount: 0,
    squashCount: 0,
    anchoredSceneCount: 0,
    scenes: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const rawScenes = splitScenes(text, lang);
  if (rawScenes.length === 0) return empty;

  // 每个事件名词一个倒计时（小时）；未命名事件归 '_'
  const timers = new Map<string, number>();
  const reversals: { key: string; from: number; to: number; scene: number }[] = [];
  let deadlineCount = 0;
  let skipMarkerCount = 0;
  let standaloneSkipCount = 0;

  const sceneReports: TimelineSceneReport[] = [];
  const mismatchScenes: number[] = [];
  const squashScenes: number[] = [];
  let anchoredSceneCount = 0;

  rawScenes.forEach((sc, si) => {
    const sceneIdx = si + 1;
    const body = sc.lines.join('\n');

    // —— 昼夜：先看标题定相位，再看正文光影 ——
    let phase: 'day' | 'night' | null = null;
    if (isZh) {
      if (NIGHT_HDR_ZH.test(sc.header)) phase = 'night';
      else if (DAY_HDR_ZH.test(sc.header)) phase = 'day';
    } else {
      if (NIGHT_HDR_EN.test(sc.header)) phase = 'night';
      else if (DAY_HDR_EN.test(sc.header)) phase = 'day';
    }
    if (phase) anchoredSceneCount++;
    const hasDayLight = isZh ? matchAll(body, DAY_BODY_ZH).length > 0 : matchAll(body, DAY_BODY_EN).length > 0;
    const hasNightLight = isZh ? matchAll(body, NIGHT_BODY_ZH).length > 0 : matchAll(body, NIGHT_BODY_EN).length > 0;
    // 标题夜+正文昼 / 标题昼+正文夜（两者同时出现时以标题矛盾的那侧为准——同场日夜并存也算穿帮）
    const mismatch = phase === 'night' ? hasDayLight : phase === 'day' ? hasNightLight : false;
    if (mismatch) mismatchScenes.push(sceneIdx);

    // —— 关系时长压扁：FRESH 与 LONG 同场共存 ——
    const freshHit = isZh ? matchAll(body, FRESH_ZH).length > 0 : matchAll(body, FRESH_EN).length > 0;
    const longHit = isZh ? matchAll(body, LONG_ZH).length > 0 : matchAll(body, LONG_EN).length > 0;
    if (freshHit && longHit) squashScenes.push(sceneIdx);

    sceneReports.push({ index: sceneIdx, header: sc.header, phase, mismatch });

    // —— 逐行收集时间事件（deadline / skip），按在行内的位置排序 ——
    for (const line of sc.lines) {
      const events: TimeEvent[] = [];

      // 独立成行的偷懒转场（同时也是一次 skip）
      const isStandalone = isZh ? STANDALONE_SKIP_ZH.test(line) : STANDALONE_SKIP_EN.test(line);
      if (isStandalone) standaloneSkipCount++;

      if (isZh) {
        for (const m of matchAll(line, DEADLINE_ZH)) {
          const n = cnNum(m[1]);
          if (Number.isNaN(n)) continue;
          // 事件名词可能在触发词前（"婚礼只剩三天"）也可能在后（"只剩三天就开庭"），前后 14/10 字窗口都找
          const win = line.slice(Math.max(0, m.index - 10), m.index + m[0].length + 14);
          const ev = EVENT_ZH.exec(win);
          events.push({ pos: m.index, kind: 'deadline', hours: n * unitHoursZh(m[2]), key: ev ? ev[1] : '_' });
        }
        for (const m of matchAll(line, SKIP_ZH)) {
          const n = cnNum(m[1]);
          if (Number.isNaN(n)) continue;
          events.push({ pos: m.index, kind: 'skip', hours: n * unitHoursZh(m[2]), key: '' });
        }
        for (const m of matchAll(line, SKIP_WORD_ZH)) {
          events.push({ pos: m.index, kind: 'skip', hours: 24, key: '' });
        }
      } else {
        for (const m of matchAll(line, DEADLINE_EN)) {
          const n = enNum(m[1]);
          if (Number.isNaN(n)) continue;
          const win = line.slice(Math.max(0, m.index - 12), m.index + m[0].length + 20);
          const ev = EVENT_EN.exec(win);
          events.push({ pos: m.index, kind: 'deadline', hours: n * unitHoursEn(m[2]), key: ev ? ev[1].toLowerCase() : '_' });
        }
        for (const m of matchAll(line, SKIP_EN)) {
          const n = enNum(m[1]);
          if (Number.isNaN(n)) continue;
          events.push({ pos: m.index, kind: 'skip', hours: n * unitHoursEn(m[2]), key: '' });
        }
        for (const m of matchAll(line, SKIP_WORD_EN)) {
          events.push({ pos: m.index, kind: 'skip', hours: 24, key: '' });
        }
      }

      events.sort((a, b) => a.pos - b.pos);
      for (const e of events) {
        if (e.kind === 'skip') {
          skipMarkerCount++;
          // 时间前进：所有倒计时同步扣减
          for (const [k, v] of timers) timers.set(k, v - e.hours);
        } else {
          deadlineCount++;
          // 后续台词常省略事件名词（"还有五天"）：全片只有一个倒计时在跑时，无名倒计时归并到它
          let key = e.key;
          if (key === '_' && timers.size === 1) key = [...timers.keys()][0];
          const prev = timers.get(key);
          // 剩余时间只减不增（2 小时容差，吸收"两天/48小时"换算误差）
          if (prev !== undefined && e.hours > prev + 2) {
            reversals.push({ key, from: prev, to: e.hours, scene: sceneIdx });
          }
          timers.set(key, e.hours);
        }
      }
    }
  });

  // —— 组装 issues 与分数 ——
  const issues: TimelineIssue[] = [];
  let penalty = 0;

  if (reversals.length) {
    penalty += Math.min(10 + (reversals.length - 1) * 8, 22);
    const detail = reversals
      .map((r) => (isZh
        ? (r.key === '_' ? `第${r.scene}场：剩余从 ${Math.round((r.from + 2) / 24)} 天变成 ${Math.round(r.to / 24)} 天`
          : `第${r.scene}场「${r.key}」：剩余从 ${Math.round((r.from + 2) / 24)} 天变成 ${Math.round(r.to / 24)} 天`)
        : `Scene ${r.scene} (${r.key === '_' ? 'deadline' : r.key}): ${Math.round((r.from + 2) / 24)}d left became ${Math.round(r.to / 24)}d`))
      .join('；');
    issues.push({
      severity: reversals.length >= 2 ? 'high' : 'mid',
      type: 'countdown_reversal',
      evidence: isZh
        ? `倒计时越等越多——${detail}。时间只会往前走，"只剩几天"只能减不能加`
        : `Countdown runs backward — ${detail}. Time only moves forward; "days left" can never increase`,
      advice: isZh
        ? '排一条时间轴：把每场的日期/钟点写在标题旁，倒计时数字逐场核对。时间跳了几天，所有倒计时同步减几天；两个不同事件（婚礼/开庭）各自计时，别共用一个"还剩几天"。'
        : 'Keep a time ledger: put date/clock beside each scene header and reconcile every countdown per event (wedding vs. trial are separate timers); every time skip subtracts from every active timer.',
    });
  }

  if (mismatchScenes.length) {
    penalty += Math.min(6 * mismatchScenes.length, 14);
    issues.push({
      severity: 'mid',
      type: 'day_night_mismatch',
      evidence: isZh
        ? `第 ${mismatchScenes.join('、')} 场的标题昼夜与正文光影打架（标题写夜却出太阳/标题写日却是深夜月亮）——美术、灯光、演员状态全跟着错`
        : `Scenes ${mismatchScenes.join(', ')}: header time-of-day contradicts the light in the body (NIGHT header with sunlight / DAY header with moonlight)`,
      advice: isZh
        ? '标题的日/夜必须与正文统一：改标题相位，或把光影描写换成与时段一致的（深夜就写灯光/路灯/手机屏幕光，别写阳光）。同场跨日夜转换时，在中间明确加一场或加"直到深夜"的转场提示。'
        : 'Align header phase with body light: change the header or rewrite the light cues (lamplight/phone-glow at night, never sunlight). If a scene crosses day into night, split it or insert an explicit transition beat.',
    });
  }

  if (standaloneSkipCount >= 3) {
    penalty += Math.min(2 * standaloneSkipCount, 8);
    issues.push({
      severity: standaloneSkipCount >= 5 ? 'mid' : 'low',
      type: 'time_skip_stuffing',
      evidence: isZh
        ? `全片 ${standaloneSkipCount} 处整行只有"三天后/次日"充当转场——用字幕跳时间替代写戏，观众看到的是提纲不是剧`
        : `${standaloneSkipCount} standalone "X days later" lines used as transitions — a timeline outline instead of drama`,
      advice: isZh
        ? '时间跳跃也要带戏：把"三天后"换成一个具体动作开场（她在收拾行李/他盯着手机上的未接来电），让观众一眼看出过了多久、这段时间改变了什么。必须用字幕跳时，一行内也要带新状态。'
        : 'Make time skips dramatic: replace the bare caption with a concrete changed-state action (packing bags, missed calls on the phone) that shows elapsed time and what it changed. If a caption is unavoidable, attach a new state on the same beat.',
    });
  }

  if (squashScenes.length) {
    penalty += Math.min(8 * squashScenes.length, 12);
    issues.push({
      severity: 'mid',
      type: 'timeline_squash',
      evidence: isZh
        ? `第 ${squashScenes.join('、')} 场同时存在"刚认识/初次见面"与"结婚多年/认识好几年"——关系时长自相矛盾`
        : `Scene(s) ${squashScenes.join(', ')}: "just met/first time" coexists with "married for years/known each other for years"`,
      advice: isZh
        ? '统一关系时钟：这对人到底认识多久？刚认识就撤掉"多年/周年"类说法；要写旧关系就别再写"初次见面"。想表现"明明认识很久却像第一次认识"，也要用明确台词点破，不能让两个时间口径并列。'
        : 'Unify the relationship clock: if they just met, remove every "years/anniversary" reference; if they go way back, drop the "first meeting" beat. If the irony is intentional, a line must explicitly say so — the two timeframes cannot sit unmarked.',
    });
  }

  const bonus = Math.min(anchoredSceneCount, 3);
  issues.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));

  return {
    score: clamp(100 - penalty + bonus),
    sceneCount: sceneReports.length,
    deadlineCount,
    skipMarkerCount,
    standaloneSkipCount,
    reversalCount: reversals.length,
    mismatchCount: mismatchScenes.length,
    squashCount: squashScenes.length,
    anchoredSceneCount,
    scenes: sceneReports,
    issues,
  };
}
