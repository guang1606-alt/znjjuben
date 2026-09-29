import { isSceneHeaderLine } from './script-scenes';
/**
 * 路况掐点 / 交通阀门检测（v2.124 块132，创作能力类）
 * ------------------------------------------------------------------
 * 病象：城市交通成了编剧的水龙头——追凶需要慢，路口就堵死半小时；
 *   逃命需要快，一路绿灯畅行无阻；需要错过，出租车抬脚就走；需要
 *   赶上，正好有空车驶过：
 *     △他跳上车去追。
 *     △前面高架堵车，纹丝不动。
 *     △He chased after them.
 *     △Every light was green all the way.
 * 一次堵车是城市日常，次次精准就是路况被剧情拨动：交通要有来路
 * （早高峰/事故/暴雨）、要有替代方案（绕路/地铁/步行）、要有真实
 * 后果（迟到/错过/扑空）——道路不是给主角开的自动门。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - always-late：管"每次都晚一步"（主角视角的结果复用——到了才
 *    发现人走了），本引擎管"路况被拨动"（环境视角的原因复用——
 *    堵车/绿灯本身是剧情拨的），前者管迟到结果，本引擎管道路原
 *    因，本块让位 alwaysLate 入池（地理时机镜像兄弟）；
 *  - pathetic-fallacy：管"天气随情绪"（雨雪雷雾的环境阀门），本
 *    引擎管"路况随剧情"（堵畅封行的地理阀门）——前者管天象，本
 *    引擎管路况，同属环境配合剧情家族；
 *  - comm-fail-crutch：管通讯失灵掐断呼救（打不通/没信号），本
 *    引擎管交通失灵掐断追赶（堵死/拦不到车）——设备域与道路域
 *    不相交；
 *  - evidence-blank：管取证载体恰好失灵（监控坏了），本引擎管道
 *    路恰好堵畅——取证设备与市政道路域不相交；
 *  - convenient-encounter：管"转角偶遇"（人物相遇的时空巧合），
 *    本引擎管"道路配合"（行程进度的时空巧合）——前者管遇见谁，
 *    本引擎管路上顺不顺；
 *  - walk-in-timing：管"说曹操曹操到"（人物登场时机白给），本
 *    引擎管"车辆道路时机白给"——前者管人到，本引擎管路通。
 *
 * "环境阀门"家族第二员（patheticFallacy 天气掐点 → trafficOnCue
 * 路况掐点——两维互补覆盖环境被剧情拨动的密度病）。
 *
 * 判定（镜像 results-on-cue 单型双锚）：
 *  - STAKE 利害锚（追赶/逃亡/送医/赶飞机火车/赶时间/拦车打车 +
 *    chase/escape/catch the flight/get to the hospital/hail a
 *    cab…）与 TRAFFIC 路况锚（堵车/一路红灯/一路绿灯/封路/交通
 *    管制/打不到车/空车刚开走/错过末班车 + traffic jam/stuck in
 *    traffic/every light red/green lights all the way/roads
 *    closed/no cabs/just left…）±2行窗口共现 → 构成一次"路况
 *    掐点"事件；双条件缺一不可——纯利害无路况放行（赶去机场是
 *    正常戏），纯路况无利害放行（高架大堵车只是城市背景）；
 *  - 裸"红灯/绿灯"不收入（误报面太大），只收"一路红灯/连吃红灯
 *    /一路绿灯"等复合形式；裸"刚走"不收，限定主语"车/出租车/
 *    班车刚开走"（防"他刚走"误中）；
 *  - rescue：①来路锚（车祸/事故/施工/修路/暴雨/大雪/早高峰/晚
 *    高峰/警车开道/护送 + accident/construction/rush hour/storm
 *    /police escort）——路况有因果不是剧本拨动；②替代方案锚
 *    （绕路/改道/抄近道/坐地铁/骑车/步行 + take a detour/another
 *    route/subway/on foot）——此路不通另有出路，交通没白给；
 *    ③后果代价锚（迟到了/错过了/没赶上/误了/晚了一步/扑空 +
 *    too late/missed/didn't make it/delayed）——延误造成真实
 *    后果，交通有戏剧功能非纯开关；
 *  - 场景头行不参与任何词表匹配；rescue 三路全窗口扫描（来路/
 *    后果词常出现在事件行自身的舞台提示里，如"早高峰堵在桥上"
 *    "还是晚了一步"，排除锚行会漏检，固化坑⑧）；
 *  - 相邻 ≤2 行的路况表述合并为同一事件（跨场景头不合并）；事件
 *    end 取窗口内最后一个锚行（保证 rescue 扫描覆盖锚行之后）；
 *  - 第 1 次豁免（一次堵车是日常），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TrafficOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有来路/替代方案/后果代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface TrafficOnCueResult {
  score: number;
  /** 路况掐点事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: TrafficOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 利害锚：行程有赌注（追得上/逃得掉/赶得到）的行为信号 */
const STAKE_ZH = /追赶|追上去|追了上去|追了出去|追出去|去追|逃跑|逃走|逃命|逃亡|追捕|追缉|送医|送(?:去)?医院|急救|赶(?:飞机|火车|高铁|航班|大巴|轮船|船|考试|面试|手术|婚礼|开庭)|赶时间|拦车|打车|叫车|追车|飙车|开车追|截住|堵截/;

const STAKE_EN = /\b(?:chase|chasing|chased|on the run|escape|flee(?:ing)?|get to the (?:hospital|airport|station)|catch the (?:flight|train|bus)|make it (?:in time|on time)|in a hurry|rushing|hail (?:a|the) (?:cab|taxi)|call (?:a|the) (?:cab|taxi)|car chase|pursuit)\b/i;

/* 路况锚：道路状态信号（裸红灯/绿灯/刚走不收——防误报，只收复合形式） */
const TRAFFIC_ZH = /堵车|堵死|大堵车|堵得?水泄不通|一路红灯|连吃红灯|全是红灯|一路绿灯|一路畅行|畅行无阻|封路|交通管制|限行|拦不到车|打不到车|叫不到车|没(?:有)?(?:空车|出租车)|(?:车|出租车|大巴|公交|地铁|火车|航班)刚(?:刚)?(?:开走|走了?)/;

const TRAFFIC_EN = /\b(?:traffic jam|stuck in traffic|bumper to bumper|every (?:light|intersection) (?:was |is )?(?:red|green)|red light after red light|green lights? all the way|roads? closed|roadblock|no taxis?|no cabs?|can'?t get a cab|missed the (?:bus|train|flight|subway)|the (?:bus|train|cab|taxi) just left)\b/i;

/* rescue A：来路锚——路况有因果（跳过锚行） */
const CAUSE_ZH = /车祸|事故|施工|修路|暴雨|大雪|大雾|结冰|早高峰|晚高峰|节假日|演唱会散场|警车开道|护送|开道/;

const CAUSE_EN = /\b(?:accident|crash|construction|road work|storm|raining|snow(?:ing)?|icy|rush hour|holiday|protest|marathon|police escort|sirens clearing)\b/i;

/* rescue B：替代方案锚——此路不通另有出路（跳过锚行） */
const ALT_ZH = /绕路|绕行|改道|换条路|换了条路|抄近道|抄小路|走小路|坐地铁|换乘地铁|骑车|骑共享单车|走路去|跑步去/;

const ALT_EN = /\b(?:take (?:a|the) detour|detour|another route|back ?roads?|take the subway|by subway|ride a bike|on foot|cut through)\b/i;

/* rescue C：后果代价锚——延误造成真实后果（跳过锚行） */
const COST_ZH = /迟到了?|错过了?|没赶上|误了|耽误|晚了一步|差一分钟|没追上|扑了个空/;

const COST_EN = /\b(?:too late|missed (?:it|him|her|them|the|my)|didn'?t make it|was (?:too )?late|delayed|lost (?:him|her|them))\b/i;

/**
 * 纯函数：检测"路况被剧情拨动"的交通阀门密度病。
 */
export function trafficOnCue(draft: string): TrafficOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const stakeRe = zh ? STAKE_ZH : STAKE_EN;
  const trafficRe = zh ? TRAFFIC_ZH : TRAFFIC_EN;
  const causeRe = zh ? CAUSE_ZH : CAUSE_EN;
  const altRe = zh ? ALT_ZH : ALT_EN;
  const costRe = zh ? COST_ZH : COST_EN;

  /* pass0：预计算每行的场景 id（用于 pass2 窗口跨场景头排除） */
  const sceneIdOf: number[] = new Array(rawLines.length).fill(0);
  let sceneCounter = 0;
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) sceneCounter += 1;
    sceneIdOf[i] = sceneCounter;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasStake: boolean[] = new Array(rawLines.length).fill(false);
  const hasTraffic: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasStake[i] = stakeRe.test(line);
    hasTraffic[i] = trafficRe.test(line);
  });

  /* pass2：路况行与 ±2 行内的利害锚配对成事件（相邻 ≤2 行路况行合并，窗口不跨场景头） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasTraffic[i]) return;
    const m = raw.match(trafficRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        /* 相邻 ≤2 行的路况表述合并为同一事件（跨场景头不合并）；
           合并时以新路况行延伸 end，只延不缩（固化坑④） */
        last.end = Math.max(last.end, i);
        return;
      }
    }
    const myScene = sceneIdOf[i];
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasStake[j] && sceneIdOf[j] === myScene,
    );
    if (win.length === 0) return; /* 纯路况无利害放行（城市背景板） */
    /* end 取窗口内最后一个锚行：保证 rescue 扫描覆盖锚行之后 */
    events.push({ start: Math.min(i, win[0]), end: Math.max(i, win[win.length - 1]), marker });
  });

  /* pass3：rescue 检测（来路/替代方案/后果代价；全窗口扫描——
     来路与后果词常出现在事件行自身的舞台提示里，如"早高峰堵在
     桥上""还是晚了一步"，排除锚行会漏检 rescue，固化坑⑧） */
  const hits: TrafficOnCueHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次堵车是日常） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = []; /* R1/R2/R3 全部用全窗口扫描 */
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = causeRe.test(win) || altRe.test(win) || costRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"路况掐点"——追凶就堵车、逃命就一路绿灯、要错过出租车抬脚就走，城市交通成了编剧的水龙头，马路不是自动门：堵要有来路（早高峰/事故/暴雨），堵了要有替代（绕路/地铁），延误要有后果（迟到/扑空）'
        : 'traffic-on-cue again - the city jams when the plot needs slow and every light turns green when the hero runs; roads are not automatic doors - a jam needs a cause (rush hour, a crash, a storm), an obstacle needs a workaround (detour, subway), and a delay needs a real consequence (missed, too late)',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues = unrescued.map(
    (h) => zh
      ? `L${h.line} [${h.sceneHeader || '场景' + (h.sceneIndex + 1)}] "${h.snippet}" — 路况掐点：${h.marker}`
      : `L${h.line} [${h.sceneHeader || 'Scene ' + (h.sceneIndex + 1)}] "${h.snippet}" — Traffic-on-cue: ${h.marker}`,
  );
  const advice = zh
    ? [
        '交通不是剧情水龙头：堵与畅要有来路（早高峰/车祸/暴雨/警车开道），或给出替代方案（绕路/地铁/步行），或让延误产生真实后果（迟到/错过/扑空）',
        '同一主角反复"被路况卡住"或"一路绿灯"时，至少一次让交通失手——赶不上就是赶不上，戏从代价里长出来',
      ]
    : [
        'Roads are not plot faucets: give the jam a cause (rush hour, a crash, a storm), offer a workaround (detour, subway, on foot), or let the delay cost something real (missed the flight, lost the suspect)',
        'When traffic keeps cooperating with the protagonist, let it fail at least once - the drama grows out of the cost',
      ];
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
