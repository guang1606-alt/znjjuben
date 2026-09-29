import { isSceneHeaderLine } from './script-scenes';
/**
 * 带伤开挂 / 伤势阀门检测（v2.95 块103，创作能力类）
 * ------------------------------------------------------------------
 * 病象：肋骨断了三根、还在输液的人，剧情需要他追凶时拔掉针头
 *   翻身下床，一口气追出三条街，徒手接白刃——伤势需要好就好、
 *   需要爆发就爆发，绷带成了摆设：
 *     △医生：他肋骨断了三根，还在输液。
 *     小舟：爸，凶手就在城东。
 *     △他拔掉输液管，翻身下床。
 *     △他一口气追出了医院。
 * 一次咬牙硬撑是燃点，第三次观众就看穿：伤势是编剧的开关。
 * 身体的账要当面算——医学许可、当场付费（伤口崩开）、或有人代劳。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - woundRecovery：管跨集伤势恢复连续性穿帮（上集重伤下集痊愈），
 *    本引擎管单集内"带伤超负荷行动"的时机与代价密度病；
 *  - plotArmor：管物理控制下的生死免疫（枪口下不死），本引擎管
 *    伤势战力差被无视（重伤未愈照样全力输出）；
 *  - faintOnCue：管晕倒掐断信息流（信息阀门），本引擎管带伤行动
 *    零代价（代价阀门）——同一身体的两面；
 *  - wakeOnCue：管昏迷苏醒时机（病床阀门），本引擎管伤员行动时机
 *    （伤势阀门）——阀门家族内让位关系。
 *
 * 判定：
 *  - 伤情锚（伤还没好/身负重伤/还在输液/打着石膏/肋骨断了/缝了N针/
 *    刚做完手术/医生不许动 + broken ribs/stitches still in/not fully
 *    healed…）与超荷行动锚（拔掉输液管/翻身下床/一口气追出/徒手接
 *    白刃/咬着牙冲 + ripped out the IV/climbed out of bed/pushed
 *    herself up…）±2 行窗口共现 → 构成一次"带伤开挂"事件；双条件
 *    缺一不可——纯伤情陈述放行（病情交代本身是戏），纯行动无伤情
 *    放行（健康人打架不归本引擎）；
 *  - rescue：①医学许可锚（打了封闭/绷带一缠/医生点头/拆了线 +
 *    painkiller shot/patched up/cleared him）——带着许可上场；
 *    ②代价锚（伤口崩开/缝线撕裂/踉跄跪倒/咳血 + stitches tore/
 *    staggered/nearly passed out）——爆发当场付费；③代劳锚（被拦下/
 *    由兄弟代劳/替他出手 + held him back/in his place）——超级英雄
 *    换了人当；
 *  - rescue 扫描包含伤情行与行动行自身（代价词天然与行动同行——
 *    "咬着牙冲过去，伤口崩开了"），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的超荷行动表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次硬撑是燃点），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface WoundOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有医学许可/代价/代劳锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface WoundOnCueResult {
  score: number;
  /** 带伤开挂事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: WoundOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 伤情锚：当前仍带伤（裸"重伤"不收——"把他重伤"是施害语） */
const INJURY_ZH = /伤(?:口|势)?(?:还没|未)(?:好|愈|合)|伤还没好透|身[受负]重伤|重伤(?:未愈|在身|昏迷|住院)|伤得很重|伤势严重|还在(?:输液|住院|重症|发烧)|打着石膏|肋骨(?:断|裂)了?|缝了[^。！？\n]{0,3}针|刚(?:做|动)(?:完|了)手术|术后第[^。！？\n]{0,3}(?:天|日)|失血过多|下不了床|卧床不起|医生(?:说)?(?:不能|不许|别)(?:动|下床)/;

const INJURY_EN = /\b(?:broken ribs|cracked ribs|stitches (?:are )?still (?:in|fresh)|just out of surgery|still (?:in the hospital|on the IV|on the drip|in the ICU)|not (?:fully )?healed|wound (?:hasn'?t|hadn'?t|still) (?:healed|closed|bleeding)|still bleeding|blood loss|bedridden|too weak to (?:stand|move)|doctor (?:said|told) (?:him|her) not to move)\b/i;

/* 超荷行动锚：带伤者不该完成的动作（咬着牙/硬撑加负向lookbehind防"没硬撑"） */
const ACTION_ZH = /拔掉(?:了)?(?:针头|输液管|氧气管|导管)|翻身(?:跳|下)了?病?床|掀开被子(?:就)?(?:跳|下|冲)|从(?:病床|轮椅|担架)(?:上)?(?:站|跳|冲|挣扎)起来?|一口气(?:跑|冲|追|爬)|追出[^。！？\n]{0,3}(?:条街|公里|里)|以一敌[^。！？\n]{0,2}|徒手(?:接|掰|撕|挡|举)|(?<![没未别不])硬(?:撑|挺)着(?:站|走|冲|追|打|举)|撑着(?:墙|床沿|门框)(?:站|走|挪)|带(?:伤|病)(?:上阵|出战|冲刺|追凶)|捂着伤口[^。！？\n]{0,8}(?:追|跑|冲|扑|打|挡)|咬着牙(?:站|走|冲|追|扑|举|打)|撞开(?:了)?(?:铁门|防盗门|木门)|接了?白刃|扑向[^。！？\n]{0,4}(?:刀|枪|凶手)/;

const ACTION_EN = /\b(?:ripped (?:out )?the (?:IV|needle|tube)|tore (?:off )?the (?:IV|bandage)|climbed out of (?:the )?(?:bed|hospital bed)|jumped out of (?:the )?bed|ran (?:three|four|five|six) blocks|took on (?:three|four|five|six) (?:men|guards|thugs)|bare[- ]?handed|pushed (?:himself|herself) up|forced (?:himself|herself) (?:up|to (?:his|her) feet)|through the pain|biting back the pain|smashed (?:the lock|the door) open|chased (?:him|her|them) on foot)\b/i;

/* rescue A：医学许可锚——带着许可上场 */
const MEDICAL_ZH = /医生(?:说)?(?:可以|同意|批准)(?:出院|下床|活动)|拆了(?:线|石膏)|出院(?:了|第二天)|打了(?:封闭|止痛|强心)针|绷带一缠|简单包扎|恢复(?:得)?(?:快|好)|体质(?:异于常人|远超常人)|吃了(?:止痛药|消炎药)/;

const MEDICAL_EN = /\b(?:doctor (?:cleared|said ok to)|cleared (?:him|her) (?:to|for)|discharged(?: yesterday)?|stitches (?:came out|removed)|cast came off|painkillers? (?:shot|injection)|patched (?:him|her) up|bandaged (?:him|her) up|tough as nails|recovered fast)\b/i;

/* rescue B：代价锚——爆发当场付费（可与行动词同行） */
const COST_ZH = /伤口(?:又|重新)?(?:崩|裂)开(?:了)?|缝线(?:撕裂|崩断)|鲜血(?:瞬间)?(?:浸透|渗出|涌出)|疼得[^。！？\n]{0,6}(?:站不稳|眼前发黑|蹲下去|跪倒)|踉跄了?好几步|差点(?:晕|昏|栽)|旧伤复发|咳出一?口血|捂着(?:腰|肋|肩)滑?(?:坐|倒)(?:下去|在地)/;

const COST_EN = /\b(?:stitches (?:tore|burst|popped)|wound (?:tore open|reopened|burst open)|blood (?:seeped|soaked|spotted) through|nearly (?:passed out|blacked out|collapsed)|staggered (?:back|forward)|coughed up blood|the pain (?:nearly|almost) (?:dropped|brought) (?:him|her) to (?:his|her) knees)\b/i;

/* rescue C：代劳锚——超级英雄换了人当（防"劝不住/拦不住"失败语） */
const RELIEF_ZH = /(?<![不没])被?人?(?:拦|拉|抱|按)(?:住|下)|(?<![不没])劝(?:住|下)|代(?:劳|打|为出战)|替他(?:去|上|打|挡)|由(?:手下|兄弟|别人)代/;

const RELIEF_EN = /\b(?:held (?:him|her) back|pulled (?:him|her) (?:back|away)|went (?:in|instead)|in (?:his|her) (?:place|stead)|took (?:his|her) place|someone else (?:went|fought))\b/i;

/**
 * 纯函数：检测"重伤未愈照样全力输出"式伤势阀门的密度病。
 */
export function woundOnCue(draft: string): WoundOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const injRe = zh ? INJURY_ZH : INJURY_EN;
  const actRe = zh ? ACTION_ZH : ACTION_EN;
  const medRe = zh ? MEDICAL_ZH : MEDICAL_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const relRe = zh ? RELIEF_ZH : RELIEF_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasInjury: boolean[] = new Array(rawLines.length).fill(false);
  const hasAction: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasInjury[i] = injRe.test(line);
    hasAction[i] = actRe.test(line);
  });

  /* pass2：行动行与 ±2 行内的伤情配对成事件（相邻 ≤2 行行动行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasAction[i]) return;
    const m = raw.match(actRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的行动表述合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasInjury[j],
    );
    if (win.length === 0) return; /* 纯行动无伤情放行（健康人打架不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（医学许可/代价/代劳三路；窗口含伤情行与行动行
     自身——代价词天然与行动词同行，仅跳过场景头行） */
  const hits: WoundOnCueHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次硬撑是燃点） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = medRe.test(win) || costRe.test(win) || relRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"带伤开挂"——重伤未愈的人当剧情需要时就能全力输出，伤势成了编剧的开关，绷带成了摆设'
        : 'wound-on-cue again - the walking wounded fight at full strength whenever the plot needs it; the injury is a switch and the bandage is set dressing',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"带伤开挂"式伤势阀门（${n} 处未救）——重伤未愈的人当剧情需要时就能追凶搏斗，一次是燃点，第三次观众就看穿伤势是编剧的开关。`
      : `${hitCount} wound-on-cue beats (${n} unrescued) - the badly injured fight at full strength whenever the plot needs it. Once is gritty; by the third, the injury is a switch the writer flips.`);
    advice.push(zh
      ? '身体的账要当面算清，不在伤重不重，而在爆发这一下付没付利息。给每次"带伤上阵"补一道门槛：要么有医学许可（打了封闭针、绷带一缠、医生终于点头——带着许可上场，硬撑才立得住）、要么当场付费（冲出去三步，伤口崩开、缝线撕裂、踉跄跪倒——爆发立刻还债，观众才信这是真疼）、要么有人代劳（兄弟按住他：我去——超级英雄换了人当，伤情反而更重）、要么干脆写"起不来"（挣扎三次没站起来，只能眼睁睁看着——不是每次咬牙都配换来奇迹）。更高级的写法是让伤情变成策略：他知道跑不过，就把自己当诱饵——重伤不是被跳过的障碍，是被利用的牌。如果剧情必须一次爆发，把它留给唯一一次，并让这次爆发的代价在下一场继续讨——伤口感染、落下病根，身体记得每一次透支。'
      : 'The body keeps honest books - what matters is not how bad the wound is, but whether the surge pays interest on the spot. Toll every walking-wounded charge: medical clearance (a painkiller shot, fresh bandages, the doctor finally nodding - cleared means the grit reads true), a price paid mid-action (three steps out and the stitches tear, he staggers to a knee - the surge repays immediately and the audience believes the pain), someone stepping in (she presses him back down: I go - swap the hero, and the injury gets heavier), or write the failure (three tries and he cannot stand; he watches through the window - not every gritted tooth earns a miracle). Better still, turn the wound into strategy: he knows he cannot outrun them, so he makes himself the bait - the injury is not an obstacle to skip but a card to play. If the plot needs one true surge, save it for the single moment - and let the debt carry into the next scene: the wound infects, the rib never sets right. The body remembers every overdraft.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
