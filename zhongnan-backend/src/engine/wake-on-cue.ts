import { isSceneHeaderLine } from './script-scenes';
/**
 * 呼唤即醒 / 病床阀门检测（v2.94 块102，创作能力类）
 * ------------------------------------------------------------------
 * 病象：昏迷/植物人/沉睡多年的人，剧情需要她开口时就恰好醒来——
 *   医生说这辈子醒不了了，主角床边喊一声，手指动了、眼角流泪、
 *   当场睁眼对话。昏迷成了作者锁信息的保险柜，唤醒成了随取随用
 *   的钥匙：
 *     △医生：她昏迷三年了，醒不了了。
 *     小舟：妈，哥回来了，你睁眼看看。
 *     △她的手指动了。
 *     她：……小舟？
 * 一次呼唤即醒是奇迹高光，第三次观众就看穿：真苏醒有医学过程
 * 和渐变——脑电波先恢复、手指先动、睁眼后失语、认不出人。把这
 * 些全部跳过，"醒来"就成了编剧的开关。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - faintOnCue：管晕倒时点（正要说出主谋就眼前一黑——信息流被
 *    掐断），本引擎管苏醒时点（昏迷锁住的信息随唤醒免费解锁）——
 *    同一身体的两侧，镜像引擎；
 *  - woundRecovery / continuity：管跨集伤势恢复连续性穿帮（上集
 *    重伤下集痊愈），本引擎管单集内唤醒时机与过程的密度病；
 *  - commFailCrutch / alwaysLate：阀门家族的通讯位/地理位，本引擎
 *    管病床位——身体成了作者的暂停键与保险柜；
 *  - delayedReveal：主动不敢开的信息容器（角色选择），昏迷是被
 *    动的锁（作者的选择）；
 *  - wakeUpCall：认知层心结被单句台词治愈，本引擎生理层昏迷被
 *    一声呼唤解锁——同族让位关系。
 *
 * 判定：
 *  - 昏迷锚（昏迷N年/植物人/沉睡/一直没醒/醒不了 + in a coma for
 *    years/vegetative state/never woke up…）与唤醒锚（醒了/睁眼/
 *    手指动了/眼角流泪 + woke up/opened her eyes/fingers twitched…）
 *    同句或 ±2 行窗口共现 → 构成一次"呼唤即醒"事件；双条件缺一
 *    不可——纯昏迷陈述放行（病情交代本身是戏），纯苏醒无长期
 *    昏迷放行（普通睡醒/短暂晕厥，晕倒域归 faintOnCue）；
 *  - rescue：①医学过程锚（脑电波好转/做了手术/撤了镇静剂/会诊/
 *    康复训练 + brain activity/surgery/signs of recovery）——苏醒
 *    走在医学允许的路上；②渐变锚（三天后才睁眼/手指先动了/缓缓
 *    转醒/醒后失语认不出人 + days later/slowly opened/couldn't
 *    speak at first）——意识回归是过程不是开关；③守候锚（守了
 *    三年/天天念给他听/日复一日 + kept vigil/read to him every
 *    night）——唤醒不是巧合，是长期投入的回报；
 *  - 与 wakeUpCall 不同：rescue 扫描包含 WAKE 行自身（渐变词天然
 *    与唤醒词同行——"三天后她才缓缓睁开眼睛"）与 COMA 行（守候
 *    词可落在昏迷陈述行），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的唤醒表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次奇迹是情感高光），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface WakeOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有医学过程锚/渐变锚/守候锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface WakeOnCueResult {
  score: number;
  /** 呼唤即醒事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: WakeOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 昏迷锚：长期昏迷/植物人/沉睡（多年量级才收，裸"昏迷了"短暂晕厥不收） */
const COMA_ZH = /昏迷[^。！？\n]{0,4}(?:年|个多月|个月|多日|半年)|昏迷不醒|长期昏迷|深度昏迷|重度昏迷|植物人|沉睡(?:着|了)(?:之中|中)?|昏睡(?:了|着|不醒)|不省人事|一直(?:没|未)(?:醒|睁眼)|始终(?:没|未)(?:醒|睁眼)|醒不了/;

const COMA_EN = /\b(?:in a coma for (?:years|months|three years|two years)|been in a (?:deep )?coma|vegetative state|deep coma|never (?:woke|wakes|wake) up|unresponsive for (?:years|months)|asleep for (?:years|a decade)|slept for (?:years|a decade)|won'?t ever wake up|never going to wake up|still hasn'?t woken)\b/i;

/* 唤醒锚：苏醒/唤醒事件（负向断言防"没醒过来/别惊醒他/你睁眼看看"误中） */
const WAKE_ZH = /(?<![快叫喊吵催拍摇促推捅弄惊])醒了(?:过来)?|苏醒了|悠悠转醒|(?<![未没不])转醒|睁(?:开|了)(?:了)?(?:眼睛|双眼|眼)|有了(?:知觉|反应)|手指(?:头)?(?:轻轻)?动了|眼(?:皮|睑)颤(?:动了|了)|眼角(?:流下)?了?(?:一|两)?行?泪/;

const WAKE_EN = /\b(?:(?<!never )(?<!not )woke up|finally awoke|awoke|opened (?:his|her|their) eyes|regained consciousness|began to respond|fingers (?:twitched|moved)|eyelids (?:fluttered|trembled)|a tear (?:slid|rolled) down (?:her|his) (?:cheek|face))\b/i;

/* rescue A：医学过程锚——苏醒走在医学允许的路上 */
const MEDICAL_ZH = /脑电波|脑部(?:活动|扫描|手术)|开颅|做了手术|动了手术|撤了(?:镇静剂|呼吸机|维生)|停了(?:镇静剂|呼吸机)|苏醒迹象|恢复迹象|生命体征|会诊|高压氧|康复(?:治疗|训练|师)|造影/;

const MEDICAL_EN = /\b(?:brain (?:activity|scan|surgery)|surgery|out of (?:the )?coma|brought (?:him|her) out|signs? of (?:recovery|brain activity)|life support|rehabilitation|physical therapy|pulled (?:him|her) (?:through|back)|the swelling went down|came off (?:the )?ventilator)\b/i;

/* rescue B：渐变锚——意识回归是过程不是开关（可与唤醒词同行） */
const GRADUAL_ZH = /三天后|一周后|半个月后|一个月后|过了(?:三天|一周|半个月|一个月)|先(?:动了|有了反应)|缓缓(?:睁开|转醒|苏醒)|慢慢(?:睁开|转醒|苏醒)|眼皮(?:先)?颤(?:动|了)?|认不出(?:人|任何人|家里)|失语|记不得(?:人|发生了什么)|醒了(?:以后|之后)(?:很久|半天)才/;

const GRADUAL_EN = /\b(?:three days later|a week later|days later|weeks later|fingers moved first|first her fingers|first his fingers|slowly opened|didn'?t recognize (?:anyone|us|them)|couldn'?t speak (?:for|at first)|took (?:days|weeks) (?:to|before))\b/i;

/* rescue C：守候锚——唤醒是长期投入的回报，不是巧合 */
const VIGIL_ZH = /守了[^。！？\n]{0,3}(?:年|个月|多日)|守在床边[^。！？\n]{0,4}(?:年|个月|多日)|天天(?:在床边|念|陪|说)|日复一日|每晚(?:都)?(?:念|读|说)|每年生日/;

const VIGIL_EN = /\b(?:kept vigil|by (?:her|his) side (?:every|for)|read to (?:him|her) every night|every day (?:she|he) (?:read|talked|sat)|talked to (?:him|her) every day|for (?:three|ten) years she (?:sat|kept))\b/i;

/**
 * 纯函数：检测"一声呼唤唤醒多年昏迷"式病床阀门的密度病。
 */
export function wakeOnCue(draft: string): WakeOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const comaRe = zh ? COMA_ZH : COMA_EN;
  const wakeRe = zh ? WAKE_ZH : WAKE_EN;
  const medRe = zh ? MEDICAL_ZH : MEDICAL_EN;
  const gradRe = zh ? GRADUAL_ZH : GRADUAL_EN;
  const vigRe = zh ? VIGIL_ZH : VIGIL_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasComa: boolean[] = new Array(rawLines.length).fill(false);
  const hasWake: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasComa[i] = comaRe.test(line);
    hasWake[i] = wakeRe.test(line);
  });

  /* pass2：唤醒行与 ±2 行内的昏迷配对成事件（相邻 ≤2 行唤醒行合并） */
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
        last.end = i; /* 相邻 ≤2 行的唤醒表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasComa[j],
    );
    if (win.length === 0) return; /* 纯苏醒无长期昏迷放行（普通睡醒/短暂晕厥） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（医学/渐变/守候三路；窗口含 COMA/WAKE 行自身，
     仅跳过场景头——渐变词天然与唤醒词同行，守候词可落在昏迷陈述行） */
  const hits: WakeOnCueHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次奇迹是情感高光） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = medRe.test(win) || gradRe.test(win) || vigRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"呼唤即醒"——多年昏迷听见呼唤就睁眼，昏迷成了作者锁信息的保险柜，唤醒成了随取随用的钥匙'
        : 'wake-on-cue again - years of coma end on a single call; the bed is a vault and the voice is a master key',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"呼唤即醒"式病床阀门（${n} 处未救）——昏迷多年的人听见呼唤就醒，一次是奇迹，第三次观众就看穿昏迷是编剧锁信息的保险柜。`
      : `${hitCount} wake-on-cue beats (${n} unrescued) - years of coma end on a single call. Once is a miracle; by the third, the coma is a vault the writer opens at will.`);
    advice.push(zh
      ? '苏醒要有重量，不在呼唤声大不大，而在医学和时间为这一刻付过什么。给每次"睁眼"补一道门槛：要么有医学过程（脑电波先好转、撤了镇静剂、会诊后出现苏醒迹象——奇迹要走在医学允许的路上）、要么有渐变（手指先动了、眼皮颤了三天、睁眼后失语、认不出床边的人——意识回归是过程不是开关）、要么有时间成本（守了三年，天天念给他听——唤醒不是巧合，是长期投入的回报）、要么有代价（她醒了，可女儿已经长大不认得她，仇人已经老死，她只是从一场昏迷搬进另一场失去）。更高级的写法是"没醒"：主角说完那句话，监护仪照旧滴滴作响——不是每次呼唤都配得到回应，医生的摇头比奇迹更重。如果剧情必须一次奇迹，把它留给唯一一次，并让醒来本身制造新的两难——她醒来第一句话，就把主人公推回更难的处境。'
      : 'A waking has weight only if medicine and time paid for it. Toll every awakening: a medical path (brain activity returns, sedatives weaned off, the team finally sees signs - miracles must walk roads medicine allows), a gradient (fingers first, then eyelids, then days of aphasia and faces she cannot place - consciousness returns as a process, not a switch), time paid (three years at the bedside, reading to him every night - the response is earned, not convenient), or a price (she wakes to a daughter who no longer knows her, a world that moved on - waking opens a new loss). Better still, write the waking that never comes: the line is said, the monitor keeps beeping - not every call deserves an answer, and the doctor shaking his head weighs more than a miracle. If the plot needs one true miracle, save it for the single moment - and let the waking cut deeper: her first sentence pushes the hero into a harder place than her sleep did.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
