import { isSceneHeaderLine } from './script-scenes';
/**
 * 疲劳透支开挂 / 精力阀门检测（v2.113 块121，创作能力类）
 * ------------------------------------------------------------------
 * 病象：三天三夜没合眼的人，剧情需要他破案时神采奕奕走进会议室，
 *   中气十足地审了一夜嫌犯；水米未进两天的人，徒手爬上六楼救人，
 *   打斗虎虎生风面不改色——透支需要扛就扛得住、需要爆发就爆发，
 *   疲劳成了台词里的一句背景交代：
 *     △小舟：我已经三天三夜没合眼了。
 *     △他灌下半杯浓茶，转身走进会议室。
 *     △他中气十足地审了嫌犯一夜，声音丝毫不哑。
 * 一次强打精神是燃点，第三次观众就看穿：精力是编剧的开关。
 * 透支的账要当面算——有补给来源、当场付费（眼前发黑）、或有人接力。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - woundOnCue：管外伤域（肋骨断裂/输液/石膏未愈照样全力输出），
 *    本引擎管体能域（睡眠/进食/体力透支被无视）——锚不共现不双报；
 *  - faintOnCue：管晕倒掐断信息流（信息阀门：正要说就眼前一黑），
 *    本引擎管"该倒不倒"（体能阀门：声明透支后照常输出）；
 *  - wakeOnCue：管昏迷苏醒时机（病床阀门），本引擎管清醒状态下的
 *    透支无视（精力阀门）——阀门家族内让位关系；
 *  - paralysisOnCue：管肢体移动通道（瘫痪秒愈），本引擎管精力消耗
 *    通道——同一身体阀门家族的第十二/十三员；
 *  - deadlineStretch：管赶时间竞速的节奏拉伸（连夜赶路当张力），
 *    本引擎管透支与行动的物理矛盾（透支声明×超荷行动共现才判）；
 *  - instantHack：COST 词表里的"通宵"是破防成本锚，不判透支病。
 *
 * 判定（镜像 wound-on-cue 单型双锚）：
 *  - 透支锚（三天三夜没合眼/水米未进/熬了几个通宵/体力透支/筋疲力尽
 *    + hasn't slept in three days/no food or water/running on fumes…）
 *    与超荷行动锚（一口气爬上N层/神采奕奕/中气十足/健步如飞/照常办案
 *    + sprinted up the stairs/fresh as a daisy/voice booming…）±2 行
 *    窗口共现 → 构成一次"透支开挂"事件；双条件缺一不可——纯透支
 *    陈述放行（交代言本身是戏），纯行动无透支放行（健康人行动不归
 *    本引擎）；
 *  - 透支锚必须带数量/程度限定（N天没睡/水米未进/体力见底），裸
 *    "累/有点困"不收——日常疲惫是常态不是病；
 *  - rescue：①补给锚（灌了咖啡/功能饮料/葡萄糖/提神药 + energy
 *    drink/caffeine pills/glucose shot）——透支有来源；②代价锚
 *    （眼前一黑/差点栽倒/手抖握不稳/话没说完就睡着 + nearly passed
 *    out/vision blurring/hands shaking）——输出当场付费；③接力锚
 *    （换人顶上/轮流开车/由兄弟接手 + took over/switched drivers/
 *    in shifts）——超荷行动换了人扛；
 *  - rescue 扫描包含透支行与行动行自身（代价词天然与行动同行——
 *    "冲上顶楼，眼前一黑扶住了墙"），仅跳过场景头行；
 *  - 场景头行不参与任何词表匹配；
 *  - 相邻 ≤2 行的超荷行动表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次强撑是燃点），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FatigueOverdriveHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有补给/代价/接力锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface FatigueOverdriveResult {
  score: number;
  /** 透支开挂事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: FatigueOverdriveHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/* 透支锚：必须带数量/程度限定（裸"累"不收）；
   数量词一律带中文数字类（家族规则：JS \d 不认中文数字） */
const NUM_ZH = '[一二两三四五六七八九十百零\\d]+';

const STRAIN_ZH = new RegExp(
  `(?:` +
  /* N天(三夜)没合眼/睡/吃/喝/进（数量前缀必选，防裸"没睡"误收；
     "喝/吃"须带宾语，防"没喝酒/没吃早饭前"拒绝语境误配） */
  `(?:(?:${NUM_ZH}天)(?:${NUM_ZH})?(?:夜)?|(?:${NUM_ZH})(?:夜)?|(?:一夜|整夜|彻夜|通宵))(?:都)?(?:没|未)(?:合过眼|合眼|闭眼|睡过觉|睡觉|睡|吃过东西|吃东西|吃过饭|吃饭|喝过水|喝水|喝一口|喝一滴|进过食|进食|进水米)` +
  `|${NUM_ZH}天${NUM_ZH}夜` +
  `|(?:一夜|整夜|彻夜|通宵)(?:都)?(?:没|未)(?:合眼|睡|眠)` +
  /* 水米未进类 */
  `|水米(?:未|不)进|滴水(?:未|不)进|粒米(?:未|不)进|滴米未沾` +
  /* 熬了 N 个通宵（须带数量或"熬"，裸"通宵"是赶路词归 deadlineStretch） */
  `|(?:熬|连熬|赶|连赶)了?${NUM_ZH}个?(?:通宵|大夜)|(?:好几个|好些个?|连着?)${NUM_ZH}?(?:个)?(?:通宵|大夜)` +
  /* 体力透支类 */
  `|体力(?:早就|都)?(?:见底|透支|到(?:了)?极限|快见底)|精力(?:早就|都)?(?:耗尽|见底|透支)` +
  `|筋疲力(?:尽|竭)|精疲力(?:尽|竭)|强弩之末|身心俱疲|力竭` +
  /* 累到具体失能 */
  `|累得[^。！？\\n]{0,6}(?:眼[前皮](?:发黑|冒金星)|站都站不稳|快(?:撑|站)不住)|撑不住了?|快顶不住了` +
  `)`,
);

const STRAIN_EN = new RegExp(
  `\\b(?:` +
  `(?:(?:have|has|had)(?:n'?t| not)) (?:slept|eaten|drunk) (?:for|in) (?:two|three|four|five|six|seven|several|countless) (?:days|nights)` +
  `|no (?:sleep|food|water) (?:for|in) (?:two|three|four|five|six|several) (?:days|nights|hours)` +
  `|without (?:sleep|food|water) (?:for|in) (?:two|three|four|five|six|several) (?:days|nights)` +
  `|(?:two|three|four|five|several) days? without (?:sleep|food|water|rest)` +
  `|(?:three|two|four|five) days? (?:and|plus) (?:three|two|four|five) nights` +
  `|no food or water` +
  `|pulled (?:three|four|five|several|countless) all[- ]?nighters?` +
  `|running on (?:empty|fumes|no sleep|adrenaline)` +
  `|dead on (?:her|his|your) feet` +
  `|at the end of (?:her|his) rope` +
  `|strength (?:giving out|nearly gone)|energy (?:is )?(?:gone|depleted)` +
  `|completely spent|utterly drained` +
  `)\\b`,
  'i',
);

/* 超荷行动锚：透支者不该完成的输出（状态展示+行动力双路） */
const OVERDRIVE_ZH = new RegExp(
  `(?:` +
  `一口气(?:爬|冲|跑|追|游|奔|干)[^。！？\\n]{0,8}` +
  `|健步如飞|神采奕奕|精神抖擞|中气十足|声如洪钟|面不改色|虎虎生风` +
  `|打得[^。！？\\n]{0,8}(?:虎虎生风|毫不费力|行云流水)` +
  `|照常(?:办案|工作|开车|审讯|出诊|上班|营业)` +
  `|连开[^。！？\\n]{0,4}(?:小时|个?钟头|车)|连审[^。！？\\n]{0,4}(?:小时|个?钟头|一夜)` +
  `|游了?[^。！？\\n]{0,6}(?:来回|个来回)|爬上[^。！？\\n]{0,8}(?:楼|层|山顶|塔顶)` +
  `|徒手攀|动作(?:依然|还是)?(?:利落|迅猛|不减当年)` +
  `|声音(?:依然|还是)?(?:不哑|丝毫不哑|洪亮)` +
  `)`,
);

const OVERDRIVE_EN = new RegExp(
  `\\b(?:` +
  `sprinted up (?:the|those) stairs` +
  `|climbed (?:the|another) (?:six|seven|eight|nine|ten|dozen) flights?` +
  `|went straight (?:back )?(?:to work|into (?:the meeting|action|interrogation))` +
  `|fresh as a daisy|bright[- ]eyed and bushy[- ]tailed|full of energy` +
  `|as sharp as ever|razor[- ]sharp` +
  `|voice (?:still )?booming` +
  `|did(?:n'?t| not) break a sweat|without breaking a sweat` +
  `|fought like (?:new|she was fresh|he was fresh)` +
  `|kept (?:driving|working|going) (?:all night|through the night|for hours)` +
  `|swam (?:another )?(?:ten|twenty|thirty|fifty) laps` +
  `)\\b`,
  'i',
);

/* rescue A：补给锚——透支有来源 */
const SUPPLY_ZH = /灌?(?:下|了)?[^。！？\n]{0,4}(?:咖啡|浓茶)|功能饮料|能量饮料|能量胶|葡萄糖|提神(?:的)?药|兴奋剂|嗑了[^。！？\n]{0,4}药|嚼了[^。！？\n]{0,4}槟榔|掐了(?:把)?人中|冷水(?:泼|浇)|冲了(?:个)?冷水澡|喝了[^。！？\n]{0,4}(?:提神|醒神)/;

const SUPPLY_EN = /\b(?:energy drink|strong coffee|espresso|caffeine pills?|glucose (?:shot|drip)|stimulants?|popped (?:pills|amphetamines)|splashed (?:water|cold water)|cold shower|sugar packet|ate something|grabbed a bite)\b/i;

/* rescue B：代价锚——输出当场付费（可与行动词同行） */
const COST_ZH = /眼前一黑|眼前发黑|差点(?:栽|摔|晕)|话没说完就睡着|说着说着(?:就)?睡着|手抖得?[^。！？\n]{0,4}(?:握|端|拿)|握不稳方向盘|踉跄了?好几步|腿一软|脚下一?虚|一头栽|晕倒在|困得[^。！？\n]{0,4}(?:睁不开眼|头点地)|扶住[^。！？\n]{0,4}(?:墙|桌|门框)才站稳/;

const COST_EN = /\b(?:nearly (?:passed out|blacked out|collapsed)|vision (?:blurring|went dark|tunneled)|hands? (?:shaking|trembling)|could barely (?:grip|keep (?:her|his) eyes open)|swayed (?:on (?:her|his) feet)|collapsed (?:into|onto|against)|fell asleep (?:mid|standing|at the wheel)|head nodding|stumbled|grabbed the (?:wall|doorframe) to steady)\b/i;

/* rescue C：接力锚——超荷行动换了人扛（防"劝不住"失败语） */
const RELIEF_ZH = /换(?:人|我|他|她)(?:来)?(?:顶上|接力|开|接手)|替(?:我|他|她|你)(?:开|接手|顶)|轮(?:流)?(?:开|值|守|班)|由[^。！？\n]{0,4}接手|交给[^。！？\n]{0,6}(?:接力|轮换|接手)|有人(?:替|换)/;

const RELIEF_EN = /\b(?:took over|tagged (?:in|himself|herself in)|relieved (?:him|her|the wheel)|switched drivers|in shifts|rotating shifts|took the wheel|someone else drove)\b/i;

/**
 * 纯函数：检测"透支照常全力输出"式精力阀门的密度病。
 */
export function fatigueOverdrive(draft: string): FatigueOverdriveResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const strainRe = zh ? STRAIN_ZH : STRAIN_EN;
  const driveRe = zh ? OVERDRIVE_ZH : OVERDRIVE_EN;
  const supplyRe = zh ? SUPPLY_ZH : SUPPLY_EN;
  const costRe = zh ? COST_ZH : COST_EN;
  const reliefRe = zh ? RELIEF_ZH : RELIEF_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasStrain: boolean[] = new Array(rawLines.length).fill(false);
  const hasDrive: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasStrain[i] = strainRe.test(line);
    hasDrive[i] = driveRe.test(line);
  });

  /* pass2：行动行与 ±2 行内的透支配对成事件（相邻 ≤2 行行动行合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasDrive[i]) return;
    const m = raw.match(driveRe);
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
      (j) => j >= 0 && j < rawLines.length && hasStrain[j],
    );
    if (win.length === 0) return; /* 纯行动无透支放行（健康人行动不归本引擎） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（补给/代价/接力三路；窗口含透支行与行动行
     自身——代价词天然与行动词同行，仅跳过场景头行） */
  const hits: FatigueOverdriveHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次强撑是燃点） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = supplyRe.test(win) || costRe.test(win) || reliefRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: snippet(rawLines[ev.end].trim()),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"透支开挂"——三天没睡水米未进的人当剧情需要时就能全力输出，精力成了编剧的开关，疲劳成了背景交代'
        : 'fatigue-overdrive again - the sleep-deprived, unfed character performs at full strength whenever the plot needs it; exhaustion is a switch and the strain was just dialogue',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"透支开挂"式精力阀门（${n} 处未救）——三天没睡水米未进的人当剧情需要时就能追凶审讯打斗，一次是燃点，第三次观众就看穿精力是编剧的开关。`
      : `${hitCount} fatigue-overdrive beats (${n} unrescued) - the three-days-no-sleep character works at full strength whenever the plot needs it. Once is gritty; by the third, exhaustion is a switch the writer flips.`);
    advice.push(zh
      ? '透支的账要当面算清，不在熬了多久，而在输出这一下付没付利息。给每次"透支上阵"补一道门槛：要么有补给来源（灌下三杯浓茶、嗑了提神药、葡萄糖吊着——透支有来路，硬扛才立得住）、要么当场付费（冲上顶楼就眼前一黑、话没说完就睡着、手抖得握不稳方向盘——输出立刻还债，观众才信这是真困）、要么有人接力（她接过方向盘：剩下我来——超荷行动换了人扛，透支反而更真实）、要么干脆写"扛不住"（第三次眼皮打架，终于靠墙睡着——不是每次强撑都配换来奇迹）。更高级的写法是让透支变成策略：他知道只剩三小时清醒，就把最难的判断放在第一小时——透支不是被跳过的障碍，是要精打细算的余额。如果剧情必须一次爆发，把它留给唯一一次，并让代价在下一场继续讨——大病一场、记忆断片，身体记得每一次透支。'
      : 'Exhaustion keeps honest books - what matters is not how long the streak was, but whether the output pays interest on the spot. Toll every sleepless charge: a supply line (three cups of strong tea, caffeine pills, a glucose drip - strain with a source reads true), a price paid mid-action (top of the stairs and her vision tunnels, mid-sentence he falls asleep, hands too shaky to grip the wheel - the output repays immediately and the audience believes the tiredness), someone taking the shift (she takes the wheel: rest, I drive - swap the body, and the exhaustion gets heavier), or write the failure (third time his eyelids win; he slides down the wall asleep - not every second wind earns a miracle). Better still, turn the deficit into strategy: he knows he has three clear hours left, so he spends the sharpest one on the hardest call - fatigue is not an obstacle to skip but a balance to budget. If the plot needs one true surge, save it for the single moment - and let the debt carry into the next scene: the crash, the lost day, the fever. The body remembers every overdraft.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
