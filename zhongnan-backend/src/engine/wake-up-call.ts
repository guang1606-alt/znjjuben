import { isSceneHeaderLine } from './script-scenes';
/**
 * 一句话点醒 / 说教治愈检测（v2.93 块101，创作能力类）
 * ------------------------------------------------------------------
 * 病象：角色攥着心结沉默二十年，别人一句话就"我想通了"——
 *   多年的恨、阴影、执念，被单句台词瞬间治愈，转折零挣扎零过渡：
 *     △她攥着母亲的怀表，这是她二十年解不开的心结。
 *     周砚：你妈要是在，也不想看你这样活着。
 *     她怔住。
 *     她：你说的对……我想通了。
 * 一次点醒是情感高潮，第三次观众开始出戏：心结的重量被台词的
 * 音量碾过去了。创伤的松动需要挣扎、反复、代价和时间——把这些
 * 全部跳过，"想通"就成了编剧的开关。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - stanceFlip：管决定层的立场横跳（上一秒要报仇下一秒放人），
 *    本引擎管认知层的创伤被单句台词治愈——一个罚行为突变，
 *    一个罚心结秒解；
 *  - emotionalAftermath：管大事件后情绪零余波（该哭不哭），
 *    本引擎管余波被台词一笔勾销（一句话就痊愈）；
 *  - cheapForgiveness：管受害者对加害者的原谅账清零，
 *    本引擎管自我心结的解除（没有加害者在场也能发生）；
 *  - moralNarration：管叙述层价值说教，本引擎管台词层说教
 *    治愈——同族让位关系。
 *
 * 判定：
 *  - 心结锚（心结/阴影/执念/放不下/恨了N年/二十年 + never got
 *    over/haunted/hated him for years…）与点醒锚（你说的对/
 *    我想通了/如梦初醒/豁然开朗 + you're right/i see it now/
 *    it all makes sense…）同句或 ±2 行窗口共现 → 构成一次
 *    "一句话点醒"事件；双条件缺一不可——纯心结陈述放行（创伤
 *    展示本身是戏），纯顿悟无长期心结放行（普通感悟）；
 *  - rescue：①挣扎锚（沉默良久/攥紧拳头/泪流满面/僵了很久 +
 *    long silence/fists clenched/tears streamed）——有挣扎过程，
 *    松动才可信；②时间过程锚（想了一整夜/失了眠/后来的日子慢慢
 *    想通/直到那天 + thought about it all night/days later/
 *    it took years）——想通有时间成本；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过心结行与点醒行
 *    自身；
 *  - 相邻 ≤2 行的点醒表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次被点醒是情感高光），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface WakeUpCallHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有挣扎锚/时间过程锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface WakeUpCallResult {
  score: number;
  /** 一句话点醒事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: WakeUpCallHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 心结锚：长期创伤/执念（多年量级才收） */
const KNOT_ZH = /心结|阴影|执念|放不下|耿耿于怀|解不开|过不去|恨了[^。！？\n]{0,3}(?:年|多年)|怨了[^。！？\n]{0,3}(?:年|多年)|[一二三四五六七八九十\d]+年(?:来|的)[^。！？\n]{0,6}(?:恨|怨|阴影|噩梦|心结)|这些年一直[^。！？\n]{0,6}(?:恨|怨|躲|怕|放不下)|一直[^。！？\n]{0,4}(?:不敢|不肯)[^。！？\n]{0,4}(?:原谅|提起|面对)|噩梦[^。！？\n]{0,6}(?:缠|绕)|走不出来/;

const KNOT_EN = /\b(?:never got over|never gotten over|couldn'?t (?:let go|move on|forgive)|carried (?:that|the|her|his) (?:guilt|grudge|hate|anger|grief)|haunted by|bitter for years|hated (?:him|her|them) for (?:years|a decade|ten years|twenty years)|twenty years of (?:anger|hate|silence|grief)|for years (?:she|he) (?:never|hated|refused)|grudge|shadow of|still (?:blames|hates) (?:himself|herself)|years of (?:anger|hate|guilt|silence))\b/i;

/* 点醒锚：单句台词治愈的顿悟宣告 */
const WAKE_ZH = /你说的(?:对|是|没错)|一语(?:惊醒|点醒|道破)|如梦初醒|恍然大悟|豁然开朗|醍醐灌顶|我(?:想通了|想明白了|懂了)|解开了[^。！？\n]{0,4}心结|突然(?:就)?(?:明白了|想通了)|原来(?:是|我一直)|你(?:这么|这样)?一说[^。！？\n]{0,6}(?:懂|明|醒)|被[^。！？\n]{0,4}点醒/;

const WAKE_EN = /\b(?:you'?re right|you are right|i see it now|it all makes sense|it all made sense|why didn'?t i see (?:it|that) before|like a weight lifted|a weight lifted|as if (?:a )?fog (?:lifted|cleared)|the words (?:hit|landed|struck)|she finally (?:let go|understood|saw it)|he finally (?:let go|understood|saw it)|years of (?:anger|hate|guilt) (?:melted|dissolved|crumbled)|i want to (?:live|stop|let go))\b/i;

/* rescue A：挣扎锚——有挣扎过程，松动才可信 */
const STRUGGLE_ZH = /沉默(?:了)?(?:良久|很久|许久)|泪(?:流满面|如雨下)|攥紧(?:了)?拳头|手在抖|来回踱步|僵(?:在原地|了很久)|怔了(?:很久|半晌)|久久(?:没有说话|说不出话)|深吸(?:了)?(?:一|几)口气|眼眶红(?:了)?|声音发(?:抖|颤)/;

const STRUGGLE_EN = /\b(?:long silence|silent for (?:a long time|moments|a while)|hands? (?:shaking|trembling)|fists? (?:clenched|tightened)|(?:clenched|tightened) (?:his|her) fists?|paced back and forth|froze for|stared for (?:a long time|moments)|took a deep breath|tears (?:streamed|fell|welled)|voice (?:shaking|broke))\b/i;

/* rescue B：时间过程锚——想通有时间成本 */
const PROCESS_ZH = /想(?:了)?(?:一夜|一整夜|很多天|很久)|失(?:眠|去了)?了几夜|一夜没睡|翻来覆去|后来的(?:日子|几年)[^。！？\n]{0,6}(?:慢慢|渐渐)|慢慢(?:地)?(?:想通|释怀)|渐渐(?:想通|释怀|明白)|直到那天(?:以后)?|那天夜里[^。！？\n]{0,6}(?:想了|没睡)/;

const PROCESS_EN = /\b(?:thought about it all night|thought about it for (?:days|weeks)|sleepless|couldn'?t sleep|didn'?t sleep that night|days later|months later|years later|slowly (?:came to|let go|accepted|understood)|it took (?:time|years|months|a long time)|gradually (?:came to|let go))\b/i;

/**
 * 纯函数：检测"一句话治好二十年心结"式说教治愈的密度病。
 */
export function wakeUpCall(draft: string): WakeUpCallResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const knotRe = zh ? KNOT_ZH : KNOT_EN;
  const wakeRe = zh ? WAKE_ZH : WAKE_EN;
  const strugRe = zh ? STRUGGLE_ZH : STRUGGLE_EN;
  const procRe = zh ? PROCESS_ZH : PROCESS_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasKnot: boolean[] = new Array(rawLines.length).fill(false);
  const hasWake: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasKnot[i] = knotRe.test(line);
    hasWake[i] = wakeRe.test(line);
  });

  /* pass2：点醒行与 ±2 行内的心结配对成事件（相邻 ≤2 行点醒行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasWake[i]) return;
    const m = raw.match(wakeRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的点醒表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasKnot[j],
    );
    if (win.length === 0) return; /* 纯顿悟感悟/无长期心结放行 */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（挣扎锚/时间过程锚；跳过心结行与点醒行自身） */
  const hits: WakeUpCallHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次被点醒是情感高光） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasKnot[j] || hasWake[j]) continue; /* 心结行与点醒行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = strugRe.test(win) || procRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"一句话点醒"——多年心结被单句台词瞬间治愈，零挣扎零过渡，等于心结的重量被台词音量碾过去了'
        : 'wake-up-call again - a years-long knot dissolved by one line, zero struggle, zero transition',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"一句话点醒"式说教治愈（${n} 处未救）——多年心结被单句台词瞬间解开，一次是高光，第三次观众就看穿"想通"是编剧的开关。`
      : `${hitCount} wake-up-call beats (${n} unrescued) - years-long knots dissolved by single lines. Once is a highlight; by the third, enlightenment is a switch the writer flips.`);
    advice.push(zh
      ? '心结的松动要有重量，不在台词的对不对，而在人物付没付出挣扎。给每次"想通"补一道门槛：要么有挣扎（沉默良久、攥紧拳头、声音发抖——身体先于语言松动，说出来的话才有分量）、要么有时间（一夜没睡、翻来覆去、后来的日子慢慢释怀——想通是过程不是瞬间）、要么有代价（说通了，但她是替母亲活了二十年的人，放下等于承认那二十年白费——顿悟带出新的失去）、要么只松一半（她没说"我想通了"，只是把怀表放进了口袋——松动不必宣告，观众看得懂）。更高级的写法是"点不醒"：朋友说完那句话，她沉默，然后把话原样还给他——你自己放下了吗？被点醒的人反过来质问点醒者，说教的镜子就立起来了。如果剧情必须一次彻悟，把它留给唯一一次，并让那句话付出过代价——是人物先做了什么，台词才压得住秤。'
      : 'A knot loosening needs weight - not whether the line is right, but whether the body paid for it. Give every breakthrough a toll: struggle (a long silence, clenched fists, a shaking voice - the body softens before the words do, and that is what gives the line weight), time (a sleepless night, turning it over for days, letting go slowly in the weeks after - understanding is a process, not an instant), a price (she finally says it - and admits the twenty years living for her mother were spent for nothing; the insight opens a new loss), or half-way (she never says "I see it now" - she just slips the watch into her pocket; the audience reads the loosening without the announcement). Better still, write the failed wake-up: the friend delivers the line, she goes quiet, then hands it back - "and have you let go?" The person who cannot be talked loose turns the mirror on the talker, and the sermon becomes a scene. If the story needs one true breakthrough, save it for that single moment and make the line earn its weight - the character has to do something before the words can carry it.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
