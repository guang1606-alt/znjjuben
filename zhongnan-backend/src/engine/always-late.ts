import { isSceneHeaderLine } from './script-scenes';
/**
 * 每次都晚一步检测（v2.86 块95，创作能力类）
 * ------------------------------------------------------------------
 * 病象：她赶到病房，医生说她十分钟前刚被接走；他冲到车站，火车
 * 三十秒前开走；要见的关键人物永远恰好人去楼空。一次是命运感，
 * 第二次观众就开始盘算"你怎么不打电话确认/提前一天到"。编剧把
 * "错过"当万能剧情阀门，靠人物永远慢一步扣押关键会面、拖延关键
 * 信息：
 *   △她赶到病房时，人已经走了。
 *   "十分钟前刚被接走。"护士头也不抬地说。
 *   He raced to the platform — the train had just left.
 * 一次错过是命运；每场都错过，就是作者在拿人物跑龙套——信息该给
 * 不给、会面该成不成，全靠编剧按住秒表。错过必须付出真代价（因为
 * 晚一步，证据被销毁/人没救回来），或者立即被行动接住（追出去/
 * 留话/打电话确认），不能干站着叹气进下一场。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - walkInTiming：镜像引擎——管"刚被谈起就登场"（太巧的到位），
 *    本引擎管"抵达就刚走"（太巧的错过），正反两面；
 *  - causalLogic：管显式巧合词密度统计（恰好/碰巧/撞见/coincidence），
 *    本引擎管结构性"抵达×错过"共现事件，"晚了一步/刚走"不是巧合词；
 *  - confrontationDodge：管对话被外部信号掐断（敲门/电话响），本
 *    引擎管空间上的错过；
 *  - commFailCrutch / faintOnCue：通讯失灵/晕倒掐断信息，同属剧情
 *    阀门家族，本引擎收"地理时机"阀门；
 *  - locationLedger：管跨集地点滞留状态连续性，本引擎管同稿创作
 *    套路密度；
 *  - delayedReveal：主动不敢开容器，本引擎是被动错过。
 *
 * 判定：
 *  - 抵达锚（赶到/冲进/闯进/追到/推门而入…）与错过信号（刚走/
 *    刚被接走/已经走了/晚了一步/白跑一趟/扑了个空/车刚开走…）
 *    同句或 ±2 行窗口共现 = 一次事件；纯抵达无错过信号放行，
 *    纯叙述"他早走了"无抵达动作放行；
 *  - 意图豁免：本想赶到/正要赶过去（还没到）不算抵达；
 *  - 相邻 ≤2 行错过表述合并为同一事件（"人已经走了"+"白跑一趟"）；
 *    跨场景头重置，各自算一次；
 *  - 第 1 次豁免（一次晚一步是命运感/合法悬念），第 2 次起每次
 *    1 hit；
 *  - rescue（事件 ±2 行内出现）：留话通道（留了字条/留言/托人
 *    转告/left a note/asked the nurse to tell）或追赶通道（追了
 *    出去/追到码头/赶上了/打电话确认/called ahead/chased after）
 *    ——错过立即被行动接住，不是干叹气；
 *  - 计分：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface AlwaysLateHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（错过后被留话/追赶等行动接住） */
  rescued: boolean;
  reason: string;
}

export interface AlwaysLateResult {
  score: number;
  /** 错过事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: AlwaysLateHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 抵达锚：必须是已完成抵达的动作，不是意图 */
const ARRIVE_ZH = /赶到|赶到时|赶过去时|冲到|冲进|闯进|追到|追至|推门(?:而入|进去)|一脚踹开|扑到|赶到现场|赶到医院|赶到车站|赶到码头|赶到机场|赶到公司|赶到门口/;

const ARRIVE_EN = /\b(?:rushed|hurried|raced|dashed|sprinted|ran|drove|flew) (?:to|into|over|there|down(?:stairs)?|to the)|arrived (?:at|in)|got (?:there|to the)|reached (?:the)|pushed open (?:the|her|his)|burst (?:into|through)|showed up (?:at|to)|made it (?:to|there|back)\b/i;

/* 错过信号：人/车/会面已经不在 */
const GONE_ZH = /刚(?:走|离开|出门|被(?:接走|带走|转移))|早(?:就)?走了|已经(?:走了|离开了|不在)|人已经不在|不在了|晚了一步|迟了一步|来迟一步|来晚了|来晚一步|刚好错过|正好错过|错过了|扑了个空|白跑一趟|人去楼空|车刚(?:开走|驶离)|刚开走|已经开走|火车.{0,4}(?:开走|走了)|航班.{0,4}(?:起飞|走了)|[0-9一二两三四十几]+(?:分钟|小时)前.{0,6}(?:走|离开|被接走)/;

const GONE_EN = /\b(?:just (?:left|missed|gone|walked out|stepped out|took off|pulled away|drove off|departed)|a (?:moment|step|minute|second|day) too late|missed (?:him|her|them|it|the train|the bus|the flight|the boat)|already (?:left|gone)|no longer (?:there|here)|(?:wasn'?t|was not) (?:there|here) anymore|barely missed|narrowly missed|empty (?:room|bed|office|ward|house)|left (?:ten|twenty|a few|several|half an hour|minutes?|hours?) (?:ago|earlier)|just departed)\b/i;

/* 意图豁免：还没到，不算抵达 */
const INTENT_ZH = /本(?:想|来想|打算)|正(?:要|准备)(?:赶|冲|去)|打算(?:赶|去|冲)|准备(?:赶|去|冲)/;

const INTENT_EN = /\b(?:was (?:going|about) to (?:go|rush|head|catch)|meant to (?:go|arrive|catch)|planned to (?:go|catch|arrive))\b/i;

/* 救援：错过立即被行动接住 */
const RESCUE_ZH = /留了?(?:张|个|一)?(?:字条|纸条|口信|言)|留言|托人(?:转告|带话|捎话)|转告|留话|发(?:了)?(?:短信|微信|消息)|打电话(?:确认|问|通知|过去)|追了?(?:出|上|去)|追到|赶上了|拦下|叫住|提前(?:一天|一晚|两小时|到)/;

const RESCUE_EN = /\b(?:left (?:a|her|his|the) (?:note|message|letter|voicemail)|sent word|asked (?:someone|the desk|the nurse|the guard) to (?:tell|pass|let)|sent (?:a|her|his|the) (?:text|message)|called (?:ahead|him|her|back|to confirm)|phoned (?:ahead|him|her)|chased (?:after|him|her|them)|ran after|caught (?:up with|him|her|the train)|stopped (?:him|her)|called the (?:hospital|office|station))\b/i;

/**
 * 纯函数：检测"赶到就刚走"式错过当剧情阀门的套路。
 */
export function alwaysLate(draft: string): AlwaysLateResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const arriveRe = zh ? ARRIVE_ZH : ARRIVE_EN;
  const goneRe = zh ? GONE_ZH : GONE_EN;
  const intentRe = zh ? INTENT_ZH : INTENT_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: AlwaysLateHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevEventLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevEventLine = -10; return; }

    const goneM = line.match(goneRe);
    /* 事件锚是错过信号；纯抵达行（无错过）不进事件流 */
    if (!goneM) return;
    const arriveSelf = arriveRe.test(line);
    /* 意图句豁免：本想赶到/正要赶过去，还没到 */
    if (intentRe.test(line)) return;

    /* 相邻 2 行错过表述 = 同一事件（"人已经走了"+"白跑一趟"），不重复计 */
    if (i - prevEventLine <= 2) { prevEventLine = i; return; }
    prevEventLine = i;

    /* 语境检查：错过需本行有抵达动作，或 ±2 行窗口内有抵达（窗口剔除场景头行） */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      const l = (rawLines[j] ?? '').trim();
      if (l && !isSceneHeaderLine(l)) winLines.push(l);
    }
    const win = winLines.join('\n');
    if (!arriveSelf && !arriveRe.test(win)) return;

    hitCount += 1;
    if (hitCount >= 2) {
      hits.push({
        line: i + 1,
        sceneIndex: Math.max(0, sceneIdx),
        sceneHeader: header,
        snippet: line.slice(0, 30),
        marker: (goneM[0] ?? '').slice(0, 28),
        rescued: rescueRe.test(win),
        reason: zh
          ? '抵达即错过——关键人物永远恰好人去楼空，编剧按住秒表白嫖拖延'
          : 'arrival always misses by a breath — the writer keeps stalling via convenient near-misses',
      });
    }
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"赶到就刚走"式错过当剧情阀门（${n} 处未救）——关键人物永远恰好人去楼空，一次是命运感，第二次观众就开始盘算你怎么不打电话确认。`
      : `${hitCount} just-missed beats (${n} unrescued) — every arrival lands moments after the person left, the train pulled away, the bed is empty. Once is fate; twice, the audience asks why nobody ever calls ahead.`);
    advice.push(zh
      ? '错过不许当万能剧情阀门——赶到医院人刚走、冲到站台车刚开、要见的人永远前脚走后脚到，观众看穿这是作者按住秒表拖戏。要么给错过真代价：因为晚一步，证据被销毁、人没救回来、孩子被转走——错过必须改变故事走向；要么立即用行动接住：追出去、留字条、托护士转告、打电话确认航班——人物在追赶，不是干叹气。真要保留"晚一步"，就提前立规则（他根本不知道她今天转院），别等剧情要用时就"恰好错过"。'
      : 'Near-miss is not a plot valve — she reaches the ward as the bed is being stripped, he sprints to the platform as the train pulls out, the person they need left minutes ago, every single time. The audience sees the writer holding the stopwatch. Either make the miss cost something real: because he was late, the evidence was destroyed, the patient slipped away, the child was moved — the miss must change the story. Or catch it with action: chase out, leave a note, have the nurse pass word, call ahead to confirm — the character is running, not sighing. If a miss must stand, set the rule up front — he never knew she was transferred today — never "conveniently" just too late when the plot needs it.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
