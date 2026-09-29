import { isSceneHeaderLine } from './script-scenes';
/**
 * 语言秒精通 / 零成本语言习得检测（v2.92 块100，创作能力类）
 * ------------------------------------------------------------------
 * 病象：主角前一场还比手画脚鸡同鸭讲，下一场就能"用流利的法语和
 *   摊主讨价还价"；"初到上海三天"的北方姑娘张口就是地道沪语；
 *   没学过手语的警察隔着玻璃"看懂了"整段对话——语言习得零成本：
 *     △陈锐站在巴黎街头，一句法语都听不懂。
 *     三天后。
 *     陈锐用流利的法语和面包店老板谈笑风生。
 * 语言是全剧最容易被开挂的技能：观众默认"出国自然就会了"，但
 * 流利度有学费、口音和时差——三日速成地道方言，等于告诉观众
 * 这个世界的学习曲线是可以拧着用的。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - instantHack：管键盘开挂（零成本技术突破），本引擎管舌头开挂
 *    （零学习语言拉满）；
 *  - instantMarksman：管扳机开挂（运动技能零训练），本引擎管口语
 *    （习得技能零学费）——同族"零成本获取"第五员；
 *  - instantDeduction：管脑子"看一眼破案"，本引擎管耳朵"听一遍
 *    就会"；
 *  - knowledge-directive / exposition：管知识倾倒与设定讲解，
 *    本引擎只罚"零基础→流利输出"的突变密度病。
 *
 * 判定：
 *  - 语言障碍锚（听不懂/比手画脚/鸡同鸭讲/语言不通 + can't
 *    understand a word/language barrier/broken English…）与流利
 *    输出锚（一口流利/用方言交谈/当翻译 + speaks fluent/no
 *    accent/translates for…）同句或 ±2 行窗口共现 → 构成一次
 *    "语言秒精通"事件；双条件缺一不可——纯障碍表述放行（困境
 *    本身是戏），纯流利人设传说放行（留学生身份一句带过）；
 *  - rescue：①来路锚（留学生/外语系/在国外住了十年/母亲是法国人
 *    + studied abroad/language major/grew up bilingual…）——语言
 *    有来路，背景让流利合法；②学习过程锚（跟着电视学/背了三个月
 *    单词/练发音 + practiced for months/took classes…）——有过程
 *    有学费，速成才可信；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过障碍行与流利行
 *    自身；
 *  - 相邻 ≤2 行的流利表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次时间跨度较大的自学属于类型惯例），第 2 次起
 *    每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantLanguageHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有来路锚/学习过程锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantLanguageResult {
  score: number;
  /** 语言秒精通事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantLanguageHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 语言障碍锚：零基础状态（初接触/听不懂/比划） */
const BARRIER_ZH = /听不懂|一句都没?听懂|语言不通|无法交流|鸡同鸭讲|比手画脚|连比带划|手脚比划|口音浓重|蹩脚的|一句外语都不会|从没学过|不(?:会|懂)(?:外语|法语|英语|日语|韩语|德语|西班牙语|当地话|方言|粤语|闽南语|手语)/;

const BARRIER_EN = /\b(?:can'?t understand (?:a word|anything|it)|doesn'?t understand (?:a word|anything)|language barrier|no idea what (?:he|she|they)'?re saying|never learned|doesn'?t speak|can'?t speak (?:the|a word of)|gestures wildly|pantomimes|resorts to (?:charades|gestures)|broken (?:english|chinese|mandarin|spanish|french|japanese|local dialect)|thick accent)\b/i;

/* 流利输出锚：零过渡的完美输出 */
const FLUENT_ZH = /一口(?:流利|地道|标准|纯正)|流利的(?:法语|英语|日语|韩语|德语|西班牙语|中文|普通话|方言|粤语|闽南语|当地话|手语)|(?:用|改用|换用)(?:流利的|地道的|标准的|纯正的)?(?:法语|英语|日语|韩语|德语|西班牙语|中文|普通话|方言|粤语|闽南语|当地话|手语)[^。！？\n]{0,8}(?:交谈|对话|交流|聊天|谈判|讨价还价|骂|喊|解释|安慰|审问|问路|点菜|砍价)|当(?:场)?(?:做起了)?翻译|给[^。！？\n]{0,8}(?:当翻译|做翻译|翻译)|毫无障碍|对答如流|无师自通|张口就是(?:地道的?)?(?:沪语|粤语|闽南语|方言|法语|英语|日语)/;

const FLUENT_EN = /\b(?:speaks? (?:fluent|perfect|near-native|flawless)|speaks? (?:it|the language) (?:fluently|perfectly)|fluently|without (?:an|any|a trace of) accent|no accent at all|perfect (?:mandarin|english|french|spanish|japanese|italian|german|local dialect)|translates? (?:for|everything)|interprets? (?:for|effortlessly)|converses? (?:fluently|effortlessly|with the locals)|bargains? (?:fluently|in fluent)|no trouble (?:understanding|following) (?:a word|anything)|switches? to (?:fluent|perfect)|picks? up (?:the language|the dialect) (?:in days|overnight|in a week))\b/i;

/* rescue A：来路锚——语言有背景，流利合法 */
const BACKGROUND_ZH = /留学生|外语(?:系|专业|学院)|翻译(?:官|专业)|中文系|华裔|混血|侨(?:胞|眷)|在[^。！？\n]{0,8}(?:住|生活|待|工作|留学|教书|打工)[^。！？\n]{0,3}了?[^。！？\n]{0,4}年|外(?:公|婆|爷爷|奶奶|姥姥|姥爷|爸|妈|母亲|父亲)(?:是|来自)|从小(?:在国外|跟着)[^。！？\n]{0,6}(?:长大|生活)|母语|native speaker/;

const BACKGROUND_EN = /\b(?:studied abroad|exchange student|language (?:major|student|school)|international student|fluent in .{0,20}(?:from|since)|grew up (?:bilingual|in (?:paris|tokyo|london|shanghai|madrid|berlin|rome))|mother is|father is|his (?:mother|father) (?:is|was) (?:french|chinese|japanese|spanish|german|italian)|her (?:mother|father) (?:is|was) (?:french|chinese|japanese|spanish|german|italian)|native speaker|lived (?:there|abroad) for (?:years|a decade|ten years)|spent (?:years|five years|ten years) (?:in|abroad))\b/i;

/* rescue B：学习过程锚——有学费有过程，速成可信 */
const PROCESS_ZH = /学(?:了|过)(?:三个月|半年|一年|几年|很久|一阵)|(?:苦|恶)补|跟着(?:手机|电视|录像|录音|软件|老师)[^。！？\n]{0,6}学|背(?:了)?(?:单词|词典|词典)|练(?:口语|发音|听力)|夜校|报了班|上(?:了)?课|请了(?:个)?老师|字典不离手/;

const PROCESS_EN = /\b(?:practiced for (?:months|weeks|years)|took (?:classes|lessons|a course)|studied (?:the language|french|english|spanish|japanese|chinese|mandarin)|language tapes|phrasebook|night classes|hired a tutor|learning (?:the language|it) (?:for months|slowly)|still learning|accent still (?:there|slips)|getting (?:better|the hang of it))\b/i;

/**
 * 纯函数：检测"三天速成地道方言"式语言秒精通的密度病。
 */
export function instantLanguage(draft: string): InstantLanguageResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const barrierRe = zh ? BARRIER_ZH : BARRIER_EN;
  const fluentRe = zh ? FLUENT_ZH : FLUENT_EN;
  const bgRe = zh ? BACKGROUND_ZH : BACKGROUND_EN;
  const procRe = zh ? PROCESS_ZH : PROCESS_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasBarrier: boolean[] = new Array(rawLines.length).fill(false);
  const hasFluent: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasBarrier[i] = barrierRe.test(line);
    hasFluent[i] = fluentRe.test(line);
  });

  /* pass2：流利行与 ±2 行内的语言障碍配对成事件（相邻 ≤2 行流利行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasFluent[i]) return;
    const m = raw.match(fluentRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的流利表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasBarrier[j],
    );
    if (win.length === 0) return; /* 纯流利人设/无障碍突变放行 */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（来路锚/学习过程锚；跳过障碍行与流利行自身） */
  const hits: InstantLanguageHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次时间跨度较大的自学是惯例） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasBarrier[j] || hasFluent[j]) continue; /* 障碍行与流利行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = bgRe.test(win) || procRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"语言秒精通"——零学费零口音，从听不懂到流利谈判只隔三行，等于告诉观众学习曲线可以拧着用'
        : 'instant language again - zero tuition, zero accent, from lost to fluent in three lines',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"语言秒精通"式习得开挂（${n} 处未救）——零基础到流利输出零成本，一次是时间跨度，第三次观众就看穿这门语言是剧情白送的。`
      : `${hitCount} instant-language beats (${n} unrescued) - language mastery with zero tuition. Once reads as a time skip; by the third, every tongue in the story is free.`);
    advice.push(zh
      ? '语言的张力来自学费、口音和时差，不在流利的听话程度。给每次流利补一道门槛：要么有来路（留学生、外语系、在国外住了十年、母亲是本地人——背景一句就合法，还能埋关系戏）、要么有过程（跟着电视字幕学、背了三个月单词、至今还带口音——学得狼狈才可信）、要么有代价（会说了，但口音暴露了外来者身份，被摊主宰了一刀——语言既是钥匙也是破绽）、要么留在障碍里（听不懂本身就是戏：误传话、错听关键信息、只能靠眼神和手势推进的段落往往比流利对话更好看）。更高级的写法是"半瓶水"：能点菜、能砍价，但一谈正事就卡壳，需要当地朋友救场——语言的坡度就是关系的坡度。如果剧情必须一次流利输出，把它留给唯一一次，并让观众记得他之前摔过的跟头。'
      : 'Language gets its tension from tuition, accents and time - not from how obedient the fluency is. Give every fluent beat a toll: a source (exchange student, language major, a decade abroad, a local parent - one line legitimizes it and seeds backstory), a process (learning from subtitled TV, three months of flashcards, an accent that still slips - clumsy learning reads true), a price (he can order coffee now, but the accent marks him as an outsider and the vendor pads the bill - the language is both key and tell), or stay in the barrier (not understanding IS the drama: mistranslated messages, missed key words, passages carried by eye contact and gesture often play better than fluent talk). Better still, write the half-empty bottle: enough to order and haggle, but business talk stalls until a local friend steps in - the slope of the language is the slope of the relationship. If the story needs one fluent moment, save it for that single scene and let the audience remember every face-plant before it.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
