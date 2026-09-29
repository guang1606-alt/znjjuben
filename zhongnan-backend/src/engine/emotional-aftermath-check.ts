/**
 * v2.145 情绪余波连续性检测（PRD 2.1.42——重大情绪事件必须付得起情绪代价）
 * ------------------------------------------------------------------
 * 竖屏短剧为了赶节奏，最常见的情绪硬伤：
 *  - 上一场刚目睹母亲断气/自己被当众捉奸/确诊绝症，下一场主角就和闺蜜逛街喝奶茶有说有笑，
 *    中间没有一个红眼眶、失神、强撑的过渡节拍（情绪秒清零，观众觉得角色没心没肺）；
 *  - 至亲死亡演完了，后文该角色再出场零悲伤反应，连葬礼/摸遗物都没有（丧亲无消化）；
 *  - 角色崩溃痛哭/寻死觅活，旁人一句"别哭了都会过去的"，三行之内立刻"露出了笑容重新振作"，
 *    心理创伤被一句鸡汤秒治愈。
 * 本引擎专管**单稿内"强情绪事件 → 余波节拍"的局部连续性**，行级触发，不需要 cast，无题材门控
 * （创伤指纹为全题材通用强事件，无相关信号即满分放行；装死/演戏/梦境事件豁免）。
 *
 * 分工（近邻引擎边界）：
 *  - arc-tracker：跨集主导情绪态（calm→despair，需 cast/prevArc，集粒度，不管单场内事件余波）
 *  - continuity-supervision(v2.139)：镜头间物理状态（伤势/束缚/手机/道具），明确不管情绪
 *  - emotion-wave / emotion-craft：情绪曲线密度与分布的统计式评分（不管事件-反应配对）
 *  - memory-fakeout(v2.144)：梦/幻觉结构公平（本引擎对梦中事件直接豁免，不重复判）
 *  - relationship-progression：关系推进价格（本引擎只判情绪余波，不判关系进度）
 *
 * 三类问题：
 *  1) instant_reset      创伤事件后 10 行窗口内（可跨场）出现强积极日常信号，
 *                                   且中间零余波信号、零时间流逝标记 → 1 次 mid，第 2 次 high
 *  2) unprocessed_loss   丧亡类事件（死别/葬礼）之后全文再无任何悲伤/悼念节拍，
 *                                   且后文≥8 行、无时间流逝交代 → mid，全文 1 条
 *  3) quick_comfort      崩溃痛哭/寻死后 4 行内出现劝慰套话，劝慰后 3 行内立刻振作笑，
 *                                   中间无余波节拍 → 1 次 low，第 2 次起 mid（push 上限 2）
 *
 * 正信号：griefCarry（创伤后先出现余波节拍再恢复）+2/次 cap4；timeHeal（明确时间流逝后恢复）+1 cap2；
 *         healthyComfort（劝慰后有余波或 6 行以上才恢复）+1/次 cap2。
 */

import { isSceneHeaderLine } from './script-scenes';

export type EaLang = 'zh' | 'en';

export interface EmotionalAftermathIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'instant_reset' | 'unprocessed_loss' | 'quick_comfort';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface EmotionalAftermathSceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface EmotionalAftermathResult {
  score: number;
  sceneCount: number;
  signalCount: number;
  issueCount: number;
  /** 创伤事件行数（死亡/暴力/丧失/确诊等，装死演戏不计） */
  traumaCount: number;
  /** 其中丧亡类事件行数 */
  lossCount: number;
  /** 崩溃/痛哭/寻死行数 */
  breakdownCount: number;
  /** 强积极日常信号行数（笑/玩笑/约会/美食/购物等，已排除恶意笑与苦笑） */
  resetCount: number;
  /** 劝慰套话行数 */
  comfortCount: number;
  /** 秒振作行数 */
  recoverCount: number;
  /** 余波/悲伤节拍行数（红眼/哽咽/失神/葬礼/摸遗物等） */
  carryCount: number;
  /** 情绪秒清零次数（=问题①实际发生数，非 push 数） */
  instantResetCount: number;
  /** 丧亲无消化条数（0 或 1） */
  unprocessedLossCount: number;
  /** 鸡汤秒治愈次数（=问题③实际发生数） */
  quickComfortCount: number;
  /** 创伤后有余波节拍的次数（正信号） */
  griefCarryCount: number;
  /** 时间流逝后恢复的次数（正信号） */
  timeHealCount: number;
  /** 健康劝慰次数（正信号） */
  healthyComfortCount: number;
  scenes: EmotionalAftermathSceneReport[];
  issues: EmotionalAftermathIssue[];
}

// c213：场头判定统一走 engine/script-scenes.ts 单一事实源（历史缺陷：本引擎
// HEADER_ZH 漏 AIGC「内景/外景」、HEADER_EN 要求数字漏 INT./EXT.，规范稿被切成单场）。

/**
 * 创伤事件指纹（全题材通用强事件）。
 * 顺序：长串/带字事件在前，裸字（死/分手）在后。
 */
const TRAUMA_ZH = /(?:当(?:着|众|他的|她的|我的)?(?:面)?|眼睁?睁(?:地|看着)?|亲(?:眼|耳)?)?(?:死(?:了|亡|去|在|不瞑目)|咽气|断气|毙命|没了呼吸|停止(?:了)?呼吸|气绝|去世|离世|身亡|丧命|自杀|跳楼(?:身亡)?|坠亡|咽(?:了)?气|咽下最后一口气)|尸体|冰冷(?:的)?(?:身体|手|脸庞)|(?:鲜)?血(?:染|溅|泊|流了一地|模糊|糊了|涌)|中(?:枪|刀|弹)|(?:被|挨|遭)(?:捅|刺|砍|劈|射|枪|群殴|打)(?:了|中|向|进|穿)?|车(?:祸|猛地撞|直直撞)|撞(?:飞|倒在地)|坠(?:楼|崖)|(?:狠狠?)?(?:扇|甩|抡|打)(?:了)?(?:她|他|我)?一?巴掌|拳打脚踢|打(?:得)?(?:头破血流|鼻青脸肿|半死)|(?:强奸|强暴|侵犯|非礼)|破产|公司(?:没了|垮了|倒闭)|身败名裂|扫地出门|赶(?:她|他|我)?出(?:家门|公司)|断绝(?:关系|父女|母女|亲缘)|(?:确诊|查出)(?:了)?(?:癌症|绝症|癌)|癌(?:症)?(?:晚期)?|绝症|流产|孩子没(?:了|保住)|(?:绑|捆)(?:架|了|在)?|撕票|捉奸在床|(?:当场)?撞(?:破|见)(?:奸|出轨)|背叛|出轨|离婚|分手(?:吧)/;
/** 丧亡子集（用于 unprocessed_loss） */
const LOSS_ZH = /死(?:了|亡|去|在|不瞑目)|咽(?:了)?气|咽下最后一口气|断气|毙命|没了呼吸|停止(?:了)?呼吸|气绝|去世|离世|身亡|丧命|自杀|跳楼(?:身亡)?|坠亡|尸体|葬礼|灵堂|守灵|遗(?:物|照|像)|殡仪馆|墓碑|上坟|车祸(?:身亡|死亡)/;
/** 装死/演戏/梦境/恶作剧：事件是假的，豁免 */
const FAKE_ZH = /装死|假死|诈死|(?:假)?装(?:死|哭|晕|受伤)|演(?:戏|给|了|一下)?|排练|排演|恶作剧|玩笑(?:而已)?|打赌|游戏(?:而已)?|做(?:个|场)戏|道具(?:刀|枪|血)|血浆|梦(?:里|中|醒)|一场梦|拍戏|剧本(?:里|中)|逗(?:你|她|他|我)玩|吓唬(?:你|她|他|我)/;
/** 余波/悲伤节拍（出现即说明情绪有被承接；含葬礼仪式类） */
const CARRY_ZH = /红(?:了|着|通通)?(?:的)?(?:眼|眼眶|眼圈)|眼眶(?:泛|通|发)?红|眼(?:圈)?(?:通红|红肿|发红|是红的|红红的)|哽咽|喉头(?:一|发)紧|鼻子一酸|泪(?:水|眼|光|痕|无声|珠)|哭(?:红|肿)|泪眼|抹(?:了抹|着|拭)?(?:泪|眼)|擦(?:干|去|了|拭)?(?:泪|眼)|拭泪|强忍|忍住(?:了)?(?:泪|眼泪|哭声|悲痛|悲伤|情绪)|压(?:下|住)(?:泪|眼泪|悲|悲痛|情绪|哽咽)|咽(?:回|下)(?:泪|眼泪|哽咽)|失神|呆滞|发呆|怔(?:怔|在|住)|恍惚|心有余悸|惴惴不安|沉默(?:良久|了很久|不语)|长?叹(?:了)?(?:口)?气|深吸(?:了)?一口气|疲惫|憔悴|失魂落魄|行尸走肉|失眠|噩(?:梦|夜惊醒)|摸(?:着|出|了摸)?(?:照片|遗物|玉佩|婚戒|墓碑|旧物)|攥(?:紧|着)(?:照片|遗物|衣角)|(?:声音|嗓子|喉咙)(?:沙哑|嘶哑|哽咽)|沙哑|嘶?哑(?:着)?(?:嗓子|声音)?|欲言又止|强(?:忍|撑|作坚强|打精神)|勉强(?:挤出|扯出|牵动|笑)|苦笑|含泪(?:笑)?|干了那杯|借酒(?:浇|消)愁|一醉|没有(?:胃口|心情|食欲)|食不下咽|泪流满面|失声痛哭|泣不成声|嚎啕(?:大哭)?|呜呜(?:地)?哭|抽泣|啜泣|葬礼|灵堂|守灵|遗(?:物|照|像)|殡仪馆|墓碑|上坟|悼念|默哀|守孝|丧服|黑纱/;
/** 强积极日常信号（真正的情绪恢复）；恶意笑与苦中作笑在判定时另做排除 */
const RESET_ZH = /(?:哈)?哈(?:哈)?(?:大)?笑|笑(?:出|得|了|眯|弯)|噗嗤(?:一)?笑|咯咯(?:地)?笑|开(?:玩)?笑|打趣|调侃|做鬼脸|吐舌头|嬉(?:戏|闹|笑)|撒娇|嘟(?:着)?嘴|挽(?:着|紧)?(?:他|她)?(?:的)?手臂|亲(?:吻|了一下|在额头)|甜蜜|心动(?:了)?|约会|逛街|购物|买(?:买)?(?:衣服|包|鞋)?|好看的衣服|美食|好吃|大吃(?:一顿)?|奶茶|火锅|零食|开心|高兴|兴奋|雀跃|哼(?:着)?(?:小)?歌|蹦(?:蹦)?跳(?:跳)?|欢呼|心情(?:大好|不错)|满(?:心)?欢喜/;
/** 恶意/攻击性的"笑"：冲突中反派得意是正常反应，不算情绪清零 */
const MALICIOUS_JOY_ZH = /冷笑|嘲笑|讥笑|狞笑|狂笑|得意(?:地)?(?:笑)?|讥讽|嗤笑|耻笑|怪笑|阴笑|奸笑|皮笑肉不笑|幸灾乐祸|大仇得报|解气/;
/** 苦中作笑/含泪笑：本身是余波，不算恢复 */
const SAD_SMILE_ZH = /苦笑|勉强(?:地)?(?:笑|挤出笑|扯出笑)|强(?:作)?(?:欢)?笑|含泪(?:的)?笑|笑中带泪|干笑|讪笑|惨(?:然)?笑|笑比哭还难看/;
/** 崩溃/痛哭/寻死（quick_comfort 起点） */
const BREAKDOWN_ZH = /崩溃|放声大哭|嚎啕大哭|泣不成声|哭(?:得)?(?:撕心裂肺|昏天黑地|喘不过气|死去活来)|泪崩|泪如雨下|哇哇(?:地)?哭|抱头痛哭|瘫(?:软|倒)(?:在(?:地|地上))?|双腿?一软|双膝(?:一软)?跪地|歇斯底里|情绪失控|不想活了|寻死(?:觅活)?|活不下去|尖叫(?:着)?(?:痛哭|哭)/;
/** 劝慰套话（一句鸡汤） */
const COMFORT_ZH = /别(?:哭|难过|伤心|这样|激动)了?|都会(?:过去|好起来)的|一切都会好|有我在|我陪着你|没事的?|坚强(?:一点|一些|些)|人总要往前看|节哀(?:顺变)?|看开点|时间会(?:冲淡|治愈)|我会一直在|还有我(?:呢)?|别想太多|会好(?:起来)?的|我的?(?:肩膀|怀里)|靠(?:在)?(?:我)?这(?:里|会儿)/;
/** 秒振作（quick_comfort 终点） */
const RECOVER_ZH = /露(?:出)?(?:了)?(?:笑|笑容|微笑)|笑了|想(?:通|明白)了|重新振作|振作(?:起来)?|站(?:了)?起来|眼神(?:重新)?坚定|重燃|焕(?:然一新|发光)|有了(?:力气|底气)|擦干眼泪(?:站起|笑|重新)?|点了点头(?:笑)?|豁然开朗|雨过天晴|深吸一口气(?:站|重新)|重新(?:站起|抬起头)|抬起头(?:笑)?/;
/** 时间流逝：时间足够久之后恢复是合法的 */
const TIME_HEAL_ZH = /三天后|几(?:天|日)后|数(?:日|天)后|一周后|几周后|数周后|[一二三四五六七八九十两\d]+个?月后|数月后|半年后|一年后|多年后|日子一天天|时间(?:一天天)?(?:过去|流逝)|久而久之|渐渐(?:地)?(?:走出来|平复|释怀|放下)?|慢慢(?:地)?(?:走出来|平复|释怀)?|随着时间|过了(?:些|好一)?阵(?:子)?|后来的(?:日子|很多天)/;

const TRAUMA_EN = /\b(?:died|was dead|slumped (?:lifeless|motionless)|killed (?:right )?in front of|passed away|lost (?:his|her|their) (?:life|baby)|stopped breathing|(?:gasped|drew) (?:his|her) last breath|stabbed|shot|gunned down|blood (?:pooled|splattered|soaked|gushed)|car (?:crash|accident)|hit by a (?:car|truck)|plunged (?:off|from) (?:the )?(?:roof|cliff|building)|(?:slapped|struck) (?:her|him) across the face|beaten (?:bloody|unconscious|senseless)|assaulted|raped|went bankrupt|company (?:went under|collapsed)|ruined (?:overnight|publicly)|kicked (?:her|him) out|disowned|diagnosed with (?:terminal )?cancer|terminal (?:illness|cancer)|miscarried|lost the baby|kidnapped|taken hostage|caught (?:her|him) cheating|betrayed (?:by|her|him)|divorce papers (?:arrived|were signed)|broke up with (?:her|him))\b/i;
const LOSS_EN = /\b(?:died|was dead|passed away|killed (?:right )?in front of|lost (?:his|her|their) life|slumped lifeless|stopped breathing|(?:gasped|drew) (?:his|her) last breath|suicide|killed (?:herself|himself)|jumped to (?:her|his) death|funeral|casket|coffin|memorial service|body lay (?:cold|lifeless)|headstone|gravestone|graveside|burial|wake service)\b/i;
const FAKE_EN = /\bfaked? (?:his|her|their|its)? ?(?:own )?death|pretend(?:ed|ing)? (?:to )?(?:die|be dead|cry|faint|injured)|fake blood|prop (?:knife|gun|blood)|prank|practical joke|rehears(?:al|ed|ing)|just a dream|in (?:the )?dream|acting (?:class|exercise)|a game (?:of )?|bet|kidding|joking(?: around)?\b/i;
const CARRY_EN = /\b(?:red-rimmed|(?:eyes|eye) (?:red|swollen|puffy|puffed)|red and swollen|choked (?:up|back tears|on (?:her|his) words)|voice (?:cracked|broke|hoarse|thick|trembled)|hoarse(?:ly)?|tears (?:welled|streamed|stung|burned|rolled|fell)|wiped (?:her|his|the)? ?tears|wiped (?:her|his) eyes|blinked back (?:tears|the tears)|fought back tears|swallowed (?:back )?the lump|lump in (?:her|his) throat|stared blankly|blank (?:stare|gaze)|dazed|numb(?:ly|ness)?|frozen in place|stunned|grief-stricken|anguish(?:ed)?|heartbroken|shattered|sighed (?:heavily|deeply)|drew a shaky breath|shaky breath|exhausted|haggard|insomnia|couldn'?t sleep|nightmares|clutched (?:the photo|his|her|the keepsake|the wedding ring|the old toy)|touched the (?:headstone|gravestone|photo)|keepsake|forced (?:a |herself to )?smile|bitter smile|smiled through tears|tearful(?:ly)?|lost (?:her|his) appetite|didn'?t eat|heavy-hearted|sobbing|sobbed|weeping|wept|cried (?:herself|himself) to sleep|broke down (?:crying|in tears)|wailed|mourning|in mourning|funeral|memorial service|graveside|burial|wake|vigil|black armband|widow'?s weeds)\b/i;
const RESET_EN = /\b(?:burst out laughing|laughed out loud|laughed aloud|giggled|chuckled|snorted with laughter|joked|teased|made a face|stuck (?:out )?(?:her|his) tongue|pouted playfully|snuggled (?:up)?|kissed (?:him|her) on the cheek|sweet moment|date night|shopping (?:spree|mall)|went shopping|bought (?:a new|herself)|delicious|yummy|hot pot|bubble tea|happy|joyful|excited|cheerful|giddy|humming (?:a )?(?:little )?tune|skipped (?:along)?|cheered|in great spirits|lighthearted)\b/i;
const MALICIOUS_JOY_EN = /\bsneered|smirked|mocked|gloat(?:ed|ing)?|laughed (?:cruelly|coldly|in mockery|with contempt|mockingly|hysterically|wildly)|cold laugh|mocking laugh|schadenfreude|vindictive(?:ly)?\b/i;
const SAD_SMILE_EN = /\bbitter(?:ly)? (?:smile|laugh)|forced (?:a |herself to )?(?:smile|laugh)|tearful smile|smiled through (?:her|his) tears|watery smile|wry smile|pained smile\b/i;
const BREAKDOWN_EN = /\bbroke down (?:crying|in tears|sobbing)|burst into (?:a flood of )?tears|sobbed uncontrollably|wailed|hysterical|hysterics|couldn'?t stop crying|cried (?:her|his) eyes out|screamed through tears|collapsed (?:sobbing|in tears|to the floor)|(?:her|his) legs gave out|didn'?t want to (?:go on )?live|wanted to die|cried hysterically\b/i;
const COMFORT_EN = /\b(?:please )?(?:do not|don'?t) cry|it'?s going to be okay|everything will be (?:okay|fine)|I'?m here|I'?m right here|I'?ll stay with you|be strong|stay strong|you have to move on|my condolences|take care of yourself|time heals|I'?m not going anywhere|you still have me|don'?t think about it|lean on me|my shoulder\b/i;
const RECOVER_EN = /\b(?:smiled|a smile (?:appeared|returned|broke)|laughed|realized (?:she|he) had to move on|pulled (?:herself|himself) together|got (?:back )?up|stood (?:back )?up|eyes (?:grew )?firm(?: with resolve)?|found (?:her|his) strength|wiped (?:her|his) tears and smiled|nodded and smiled|felt better already|light returned to (?:her|his) eyes|chin (?:up|lifted)|took a steadying breath)\b/i;
const TIME_HEAL_EN = /\b(?:three|a few|several) days later|a week later|weeks later|months later|a year later|years later|as time (?:passed|went by)|in time|gradually (?:healed|recovered|moved on)|eventually healed|life moved on|with (?:time|each passing day)\b/i;

interface LineRow {
  line: number;
  scene: number;
  text: string;
}

interface Hit {
  line: number;
  scene: number;
  text: string;
}

export function emotionalAftermathCheck(text: string, lang: EaLang = 'zh'): EmotionalAftermathResult {
  const isZh = lang === 'zh';
  const TRAUMA = isZh ? TRAUMA_ZH : TRAUMA_EN;
  const LOSS = isZh ? LOSS_ZH : LOSS_EN;
  const FAKE = isZh ? FAKE_ZH : FAKE_EN;
  const CARRY = isZh ? CARRY_ZH : CARRY_EN;
  const RESET = isZh ? RESET_ZH : RESET_EN;
  const MALICIOUS_JOY = isZh ? MALICIOUS_JOY_ZH : MALICIOUS_JOY_EN;
  const SAD_SMILE = isZh ? SAD_SMILE_ZH : SAD_SMILE_EN;
  const BREAKDOWN = isZh ? BREAKDOWN_ZH : BREAKDOWN_EN;
  const COMFORT = isZh ? COMFORT_ZH : COMFORT_EN;
  const RECOVER = isZh ? RECOVER_ZH : RECOVER_EN;
  const TIME_HEAL = isZh ? TIME_HEAL_ZH : TIME_HEAL_EN;

  const clean = (text ?? '').replace(/\r\n?/g, '\n');
  if (!clean.trim() || clean.trim().length < 20) {
    return {
      score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
      traumaCount: 0, lossCount: 0, breakdownCount: 0, resetCount: 0,
      comfortCount: 0, recoverCount: 0, carryCount: 0,
      instantResetCount: 0, unprocessedLossCount: 0, quickComfortCount: 0,
      griefCarryCount: 0, timeHealCount: 0, healthyComfortCount: 0,
      scenes: [], issues: [],
    };
  }

  // ---------- 切场 ----------
  const rawLines = clean.split('\n');
  const scenes: EmotionalAftermathSceneReport[] = [];
  const all: LineRow[] = [];
  let curScene = 0;
  let curHeader = '';
  const ensureScene = (header: string) => {
    curScene += 1;
    curHeader = header.trim().slice(0, 24) || `S${curScene}`;
    scenes.push({ index: curScene, header: curHeader, flagCount: 0 });
  };
  let headerSeen = false;
  rawLines.forEach((raw) => {
    const t = raw.trim();
    if (isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      ensureScene(t);
      headerSeen = true;
      return;
    }
    if (!headerSeen && all.length === 0) {
      ensureScene(isZh ? '开场' : 'Opening');
      headerSeen = true;
    }
    if (t) all.push({ line: all.length + 1, scene: curScene, text: t });
  });
  if (scenes.length === 0) ensureScene(isZh ? '开场' : 'Opening');

  /** 跨场全局行窗口（情绪余波可以跨到下一场） */
  const linesBetween = (from: number, to: number) =>
    all.filter((r) => r.line >= from && r.line <= to);

  // ---------- 行级判定 ----------
  /** 强积极日常：命中 RESET 且不是恶意笑/苦笑 */
  const isResetLine = (t: string) =>
    RESET.test(t) && !MALICIOUS_JOY.test(t) && !SAD_SMILE.test(t);

  const traumaHits: Hit[] = [];
  const lossHits: Hit[] = [];
  const breakdownHits: Hit[] = [];
  const resetHits: Hit[] = [];
  const comfortHits: Hit[] = [];
  const recoverHits: Hit[] = [];
  const carryHits: Hit[] = [];
  let signalCount = 0;
  const mark = (arr: Hit[], r: { line: number; scene: number; text: string }) => {
    if (!arr.some((h) => h.line === r.line)) {
      arr.push({ line: r.line, scene: r.scene, text: r.text });
      signalCount += 1;
    }
  };
  all.forEach((r) => {
    if (BREAKDOWN.test(r.text)) mark(breakdownHits, r);
    if (isResetLine(r.text)) mark(resetHits, r);
    if (COMFORT.test(r.text)) mark(comfortHits, r);
    if (RECOVER.test(r.text)) mark(recoverHits, r);
    if (CARRY.test(r.text)) mark(carryHits, r);
  });

  // 创伤事件聚类：行距 ≤2 的相邻行（事件行+反应行复述"死去"）合并为同一锚点；
  // 装死/演戏/梦境标记出现在锚点行 ±1 行内则整个事件豁免（"装死"常写在前一行）。
  interface TraumaAnchor extends Hit { isLoss: boolean }
  const anchors: TraumaAnchor[] = [];
  all.filter((r) => TRAUMA.test(r.text)).forEach((r) => {
    const last = anchors[anchors.length - 1];
    if (last && r.scene === last.scene && r.line - last.line <= 2) {
      if (LOSS.test(r.text)) last.isLoss = true;
      return;
    }
    anchors.push({ line: r.line, scene: r.scene, text: r.text, isLoss: LOSS.test(r.text) });
  });
  const isFakeAround = (line: number) =>
    linesBetween(line - 1, line + 1).some((q) => FAKE.test(q.text));
  anchors.filter((a) => !isFakeAround(a.line)).forEach((a) => {
    mark(traumaHits, a);
    if (a.isLoss) mark(lossHits, a);
  });

  const issues: EmotionalAftermathIssue[] = [];
  const ev = (r: { text: string }, scene: number) =>
    isZh ? `第${scene}场：${r.text.slice(0, 34)}` : `Scene ${scene}: ${r.text.slice(0, 60)}`;

  const adviceMap = {
    reset: {
      zh: '情绪秒清零：刚经历死亡/暴力/背叛/确诊等重大打击，角色紧接着就有说有笑、逛街调情，中间没有一个红眼眶、失神、强撑的过渡节拍。补一个克制的余波动作（红着眼眶继续办事/沉默良久/挤出一个苦笑），或给出明确的时间流逝。',
      en: 'Instant emotional reset: right after a devastating event (death/violence/betrayal/diagnosis) the character is laughing, flirting or shopping with no emotional carry. Add a restrained aftermath beat (red-rimmed eyes, a long silence, a forced bitter smile), or mark a clear time jump.',
    },
    loss: {
      zh: '丧亲无消化：至亲死亡演完之后，角色再出场没有任何悲伤反应，没有葬礼、遗物、失眠或失神。死亡必须留下痕迹——后文补一个悼念节拍（摸遗物/避开称谓/夜里惊醒），哪怕只有半行。',
      en: 'Unprocessed loss: after a loved one dies, the surviving characters show zero grief later on—no funeral, keepsake, insomnia or daze. Death must leave a trace: add a mourning beat later (touching a keepsake, flinching at the name, waking from a nightmare), even half a line.',
    },
    comfort: {
      zh: '鸡汤秒治愈：崩溃痛哭/寻死之后，旁人一句"别哭了都会过去的"，角色三行之内立刻露出笑容重新振作，心理创伤恢复得太廉价。让劝慰被顶回来、让角色哭完一场，恢复至少隔一场或靠她自己想通。',
      en: 'One-line cure: after a breakdown, a single "don\'t cry, everything will be fine" makes the character smile and recover within lines. Let the comfort be rejected at first, let the grief run its course, and delay recovery or make it self-earned.',
    },
  };

  // ---------- ① 情绪秒清零（跨场全局窗口，可跨场） ----------
  let instantResetCount = 0;
  let griefCarryCount = 0;
  let timeHealCount = 0;
  traumaHits.forEach((h) => {
    const win = linesBetween(h.line + 1, h.line + 10);
    const firstReset = win.find((r) => isResetLine(r.text));
    if (!firstReset) return;
    const beforeReset = win.filter((r) => r.line < firstReset.line);
    // 时间标记/悲伤痕迹与"笑"写在同一行（"三个月后，她淡淡笑了笑"）也算合法承接
    const hadTimeHeal = beforeReset.some((r) => TIME_HEAL.test(r.text)) || TIME_HEAL.test(firstReset.text);
    const hadCarry = beforeReset.some((r) => CARRY.test(r.text)) || CARRY.test(firstReset.text);
    if (hadTimeHeal) {
      timeHealCount += 1;
      return;
    }
    if (hadCarry) {
      griefCarryCount += 1;
      return;
    }
    instantResetCount += 1;
    if (instantResetCount <= 2) {
      issues.push({
        severity: instantResetCount >= 2 ? 'high' : 'mid',
        type: 'instant_reset',
        evidence: ev(firstReset, firstReset.scene),
        advice: isZh ? adviceMap.reset.zh : adviceMap.reset.en,
        scene: firstReset.scene,
        key: `reset_s${firstReset.scene}_${firstReset.line}`,
      });
    }
  });
  // 事件窗口外、但后文出现的时间流逝恢复也计正信号（每条时间标记计一次，避免重复刷分）
  if (timeHealCount === 0 && traumaHits.length > 0) {
    const firstTrauma = traumaHits[0].line;
    if (all.some((r) => r.line > firstTrauma && TIME_HEAL.test(r.text))) timeHealCount = 1;
  }

  // ---------- ② 丧亡无消化（全文 1 条） ----------
  let unprocessedLossCount = 0;
  /** 该丧亡事件后文是否完全没有悲伤/悼念/时间标记 */
  const isUnprocessedLoss = (h: Hit) => {
    const after = all.filter((r) => r.line > h.line);
    if (after.length < 8) return false; // 事件贴结尾，故事没继续，不苛求余波
    return !after.some((r) => CARRY.test(r.text)) && !after.some((r) => TIME_HEAL.test(r.text));
  };
  if (lossHits.length > 0) {
    const at = lossHits.find((h) => isUnprocessedLoss(h));
    if (at) {
      unprocessedLossCount = 1;
      issues.push({
        severity: 'mid',
        type: 'unprocessed_loss',
        evidence: ev(at, at.scene),
        advice: isZh ? adviceMap.loss.zh : adviceMap.loss.en,
        scene: at.scene,
        key: 'unprocessed_loss',
      });
    }
  }

  // ---------- ③ 鸡汤秒治愈 ----------
  let quickComfortCount = 0;
  let healthyComfortCount = 0;
  let lastBreakdownLine = -99;
  let lastBreakdownScene = -1;
  breakdownHits.forEach((b) => {
    if (b.scene === lastBreakdownScene && b.line - lastBreakdownLine <= 3) return; // 同一场连续崩溃行只算一次
    lastBreakdownLine = b.line;
    lastBreakdownScene = b.scene;
    const comfortWin = linesBetween(b.line + 1, b.line + 4);
    const comfortLine = comfortWin.find((r) => COMFORT.test(r.text) && !BREAKDOWN.test(r.text));
    if (!comfortLine) return;
    const recoverWin = linesBetween(comfortLine.line + 1, comfortLine.line + 3);
    const recoverLine = recoverWin.find((r) => RECOVER.test(r.text) && !COMFORT.test(r.text));
    if (!recoverLine) return;
    const middle = linesBetween(b.line + 1, recoverLine.line - 1);
    const hadCarry = middle.some((r) => CARRY.test(r.text));
    if (hadCarry || recoverLine.line - b.line > 6) {
      healthyComfortCount += 1;
      return;
    }
    quickComfortCount += 1;
    if (quickComfortCount <= 2) {
      issues.push({
        severity: quickComfortCount >= 2 ? 'mid' : 'low',
        type: 'quick_comfort',
        evidence: ev(recoverLine, recoverLine.scene),
        advice: isZh ? adviceMap.comfort.zh : adviceMap.comfort.en,
        scene: recoverLine.scene,
        key: `comfort_s${recoverLine.scene}_${recoverLine.line}`,
      });
    }
  });

  // ---------- 场景旗标 ----------
  issues.forEach((it) => {
    const sc = scenes.find((s) => s.index === it.scene);
    if (sc) sc.flagCount += 1;
  });

  // ---------- 排序：high → mid → low，再按场 ----------
  const sevRank = { high: 0, mid: 1, low: 2 };
  issues.sort((a, b) =>
    (sevRank[a.severity] - sevRank[b.severity]) || a.scene - b.scene || a.key.localeCompare(b.key));

  // ---------- 评分 ----------
  let penalty = 0;
  if (instantResetCount > 0) penalty += Math.min(12 + (instantResetCount - 1) * 10, 22);
  if (unprocessedLossCount > 0) penalty += 14;
  if (quickComfortCount > 0) penalty += quickComfortCount >= 2 ? 14 : 6;

  let bonus = 0;
  bonus += Math.min(griefCarryCount * 2, 4);
  bonus += Math.min(timeHealCount, 2);
  bonus += Math.min(healthyComfortCount, 2);

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty + bonus)));

  return {
    score,
    sceneCount: scenes.length,
    signalCount,
    issueCount: issues.length,
    traumaCount: traumaHits.length,
    lossCount: lossHits.length,
    breakdownCount: breakdownHits.length,
    resetCount: resetHits.length,
    comfortCount: comfortHits.length,
    recoverCount: recoverHits.length,
    carryCount: carryHits.length,
    instantResetCount,
    unprocessedLossCount,
    quickComfortCount,
    griefCarryCount,
    timeHealCount,
    healthyComfortCount,
    scenes,
    issues,
  };
}
