import { isSceneHeaderLine } from './script-scenes';
/**
 * 妊娠剧情阀门 / 肚子当开关检测（v2.104 块112，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把孕妇的身体当成随取随用的剧情开关。两种形态反复
 *   出现——
 *   A 撞击见红型：争吵中一把推开、滚下楼梯、车祸、肚子挨拳，下一拍
 *     她捂住小腹、腿间见血、"孩子保不住了"，满屋人的态度瞬间翻转，
 *     下跪的下跪、和解的和解；危机从来不真兑付，卧床一集又活蹦
 *     乱跳，肚子是关系的遥控器；
 *   B 干呕确诊型：她恶心干呕、冲进卫生间、突然想吃酸的，旁边人一句
 *     "你该不会是……"，验孕棒/两道杠/医生当场宣布，从症状到确诊
 *     零等待零化验成本，怀孕只是推动逼婚、继承、挽留、复仇的道具。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里孩子从来不是生命，
 *   是情节的扳手。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - character-state-ledger：跨集"怀孕"大状态连续性（有/无、穿帮），
 *    不检测单集"事故见红/干呕确诊"的触发密度；
 *  - faint-on-cue：晕倒掐断信息流（阀门家族·生理）；wake-on-cue：
 *    昏迷随叫随醒；wound-on-cue：带伤开挂行动；本引擎专管妊娠身体
 *    事件当关系/冲突开关——"身体阀门"家族新员，生殖身体通道；
 *  - tear-bait：泪点情绪开关；cheap-forgiveness：见红后对方秒原谅
 *    归该引擎管"原谅的廉价"，本引擎管"身体事故的触发密度"，可同时
 *    命中各扣各的；
 *  - creativity.ts 仅一条"离婚当天发现怀孕"的套路回避建议，无检测。
 *
 * 判定（双型事件，各自三锚/双锚）：
 *  - 型A shock（撞击见红）：
 *    SHOCK 物理碰撞锚（推搡倒地/摔楼梯/车祸/腹部受击…）±2行与
 *    FETAL 妊娠危机锚共现；FETAL 分两档——STRONG（见红/动胎气/
 *    保胎/胎心弱/孩子保不住…）自带妊娠语义；WEAK（捂肚子/流血/
 *    送医…）必须在事件 ±3 行窗口内另有 PREG_CONTEXT 既存孕妇锚
 *    （怀孕/身孕/肚子里的孩子/胎儿/pregnant…），防普通车祸受伤
 *    误判；
 *  - 型B diagnosis（干呕确诊）：
 *    NAUSEA 孕反锚（恶心/干呕/孕吐/嗜酸/闻腥味 + nausea/morning
 *    sickness/threw up…）±2行与 PREG_TEST 确诊锚（验孕棒/两道杠/
 *    怀孕了/血HCG/怀孕N周 + pregnancy test/two lines/you're
 *    pregnant/eight weeks pregnant…）共现；纯呕吐无确诊放行（食物
 *    中毒/晕车），纯怀孕陈述无孕反放行（日常产检）；
 *  - 相邻 ≤2 行的 SHOCK/NAUSEA 行各自合并为同一事件（跨场景头不
 *    合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CARE 真实医疗过程——黄体酮/保胎针/卧床医嘱/留院观察/
 *      胎心恢复有力/孩子保住了，危机被规范处理；②LOSS 危机真实
 *      兑付——最终没了/自然流产/清宫/失去孩子（"可能保不住"的
 *      危机宣告不算），阀门这次真掐断了；
 *    型B：①PROCESS 诊断有过程——复查/第二次测/抽血验HCG/等结果/
 *      隔天B超确认/换牌子再测，确诊不白给；②KNOWN 既存孕妇的
 *      日常反应（怀孕以来/孕期/怀孕N周一直吐）；③FALSE 乌龙——
 *      过期试纸/假阳性/空欢喜/复查没怀；
 *  - 第 1 次豁免（一次妊娠桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface PregnancyOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** shock=撞击见红型；diagnosis=干呕确诊型 */
  kind: 'shock' | 'diagnosis';
  /** 是否有真实医疗/危机兑付/诊断过程/乌龙（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface PregnancyOnCueResult {
  score: number;
  /** 妊娠阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: PregnancyOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：SHOCK 物理碰撞锚 ===== */
const SHOCK_ZH_RE = new RegExp(
  /(?:一把|猛地|狠狠|用力|伸手)?(?:推|搡)[^。！？\n]{0,10}?(?:摔|倒|跌|滚|踉跄|下楼梯|在地上|撞(?:在|到|上))/.source
  + '|' + /被(?:他|她|对方|人)?(?:一把|猛地|狠狠|用力)?(?:推|搡)(?:了)?[^。！？\n]{0,8}?(?:倒|开|出去|地上|楼梯|撞)/.source
  + '|' + /摔(?:倒|下楼梯|在地上|了一跤)|滚下?楼梯|跌(?:下|倒在)楼梯?|失足(?:摔|滚|跌)|踩空|脚下一滑/.source
  + '|' + /被车撞|车祸|车子?(?:猛地)?撞上?她?|车(?:把|将)她?撞/.source
  + '|' + /(?:肚子|小腹|腹部)[^。！？\n]{0,4}(?:撞|磕|顶|硌|挨)(?:在|到|上)?|(?:一拳|一脚)[^。！？\n]{0,4}(?:打|踢|踹|砸)(?:在|中)?(?:她)?(?:肚子|小腹|腹部)|(?:打|揍|踢|踹)(?:了|中)?(?:她的)?(?:肚子|小腹|腹部)/.source,
);

const SHOCK_EN_RE = new RegExp(
  /\b(?:shoved|pushed|thrust)\s+(?:her|his)\s+(?:down|away|backward|back|off|to the floor|down the stairs|against)\b/.source
  + '|' + /\b(?:she|he)\s+(?:was|got)\s+(?:shoved|pushed)\b[^.?!\n]{0,20}?(?:down|stairs|floor|backward|fell)\b/.source
  + '|' + /\bfell\s+(?:down\s+the\s+stairs|backward|to\s+the\s+floor|hard|on\s+her\s+back)\b|\btripped\s+(?:and\s+fell|on\s+the)\b|\brolled\s+down\s+the\s+stairs\b|\bstumbled\s+and\s+fell\b|\blost\s+her\s+footing\b/.source
  + '|' + /\b(?:car|vehicle|truck)\s+(?:hit|struck)\s+(?:her|him)\b|\bcar\s+accident\b|\bhit\s+by\s+a\s+car\b/.source
  + '|' + /\b(?:punched|kicked|struck|hit|slammed)\s+(?:her\s+)?(?:stomach|belly|abdomen|midsection)\b|\b(?:stomach|belly)\s+(?:slammed|crashed|hit)\s+(?:into|against|on)\b|\belbowed\s+in\s+the\s+(?:stomach|belly)\b/.source,
  'i',
);

/* FETAL 强档：自带妊娠语义的危机锚（见红/胎气/保胎/胎心/孩子保不住） */
const FETAL_STRONG_ZH_RE = /见红|动了胎气|胎气不稳|先兆(?:性)?流产|流产迹象|胎动不安|胎心(?:弱|微弱|不稳|没了|消失|停了|异常)|保胎|胎死腹中|孩子(?:保不住|要没了|会不会有事|差点没了|可能没了)|肚子里的?孩子[^。！？\n]{0,6}(?:有事|要没|危险)|小腹(?:坠痛|坠胀|一阵绞痛)|腹中(?:一阵)?绞痛/;

const FETAL_STRONG_EN_RE = /\b(?:vaginal\s+)?bleeding\b|\bspotting\b|\bsomething\s+(?:is|was)\s+wrong\s+with\s+the\s+baby\b|\bmight\s+lose\s+the\s+baby\b|\bfetal\s+heartbeat\s+(?:faded|weakened|grew\s+faint|stopped|was\s+unstable)\b|\bthreatened\s+miscarriage\b|\bcramping\s+(?:and\s+bleeding|in\s+her\s+pelvis)\b|\bpelvic\s+cramps\b|\bbaby\s+in\s+distress\b/i;

/* FETAL 弱档：需 PREG_CONTEXT 既存孕妇锚兜底（防普通受伤误判） */
const FETAL_WEAK_ZH_RE = /捂(?:着|住)?(?:肚子|小腹|腹部)|(?:下身|腿间)(?:一阵|一股)?(?:热|暖流|流血|出血|发凉)|鲜血(?:从腿间|染红|渗出|顺着腿|浸透)|流(?:了|出)?血|出(?:了)?血|(?:肚子|小腹)(?:一阵)?(?:剧痛|绞痛|疼|痛|发紧)|(?:送|去|到)(?:医院|急诊|产科)|脸色(?:煞白|发白)[^。！？\n]{0,6}(?:蹲|捂|扶)/;

const FETAL_WEAK_EN_RE = /\bclutch(?:ing|ed)\s+(?:her\s+)?(?:stomach|belly|abdomen|midsection)\b|\b(?:warm|hot)\s+trickle\s+(?:between|down)\s+her\s+legs\b|\bblood\s+(?:between|soaked|ran down|on)\b|\bstarted\s+(?:to\s+)?bleed\b|\b(?:sharp\s+)?(?:stomach|abdominal|pelvic)\s+(?:pain|cramps?)\b|\brushed?\s+to\s+the\s+(?:ER|hospital|emergency\s+room)\b|\bface\s+went\s+(?:white|pale)\b[^.?!\n]{0,20}?(?:stomach|belly|legs)/i;

/* 既存孕妇锚：弱档危机词需它兜底（事故前已交代怀孕状态） */
const PREG_CONTEXT_ZH_RE = /怀孕|身孕|孕妇|妊娠|胎(?:儿|心|气|动)|肚子里(?:的)?(?:孩子|宝宝|骨肉|小生命)|腹中(?:的)?(?:孩子|胎儿|骨肉|小生命)?|产检|孕检|产科|验孕棒|两道杠|两条杠|双杠|有了(?:他的|她的)?(?:孩子|骨肉|身孕)|怀(?:了|上|着)(?:他的|她的)?(?:孩子|骨肉|宝宝)?/;

const PREG_CONTEXT_EN_RE = /\bpregnant\b|\bpregnancy\b|\bexpecting\b|\bmaternity\b|\bprenatal\b|\bOB-?GYN\b|\bthe\s+baby\b|\bher\s+(?:swollen\s+)?belly\b|\bunborn\s+child\b|\bf(?:e|œ)tus\b|\bfetal\b|\btwo\s+(?:pink\s+)?lines\b|\bpregnancy\s+test\b|\bwith\s+child\b/i;

/* ===== 型B：NAUSEA 孕反锚 ===== */
const NAUSEA_ZH_RE = new RegExp(
  /(?:一阵|突然|又是)?恶心(?:感|反胃|想吐)?|干呕|想吐|呕吐|犯恶心|胃里(?:一阵)?(?:翻腾?|反酸|不舒服)|孕吐|嗜酸(?:辣)?|想吃酸的?|闻到(?:油|肉|鱼|油烟)腥味?|嘴里发苦|(?:毫无|突然没了|一点没)胃口/.source
  + '|' + /捂(?:着|住)?嘴(?:冲|跑|奔|扑)(?:进|向|去)?(?:卫?生?间|洗手间|厕所|洗手台)?|冲(?:进|向)(?:卫?生?间|洗手间|厕所)[^。！？\n]{0,6}(?:吐|呕)/.source,
);

const NAUSEA_EN_RE = new RegExp(
  /\bnause(?:a|ous|ated)\b|\bfelt\s+sick\s+to\s+her\s+stomach\b|\bmorning\s+sickness\b|\bthrew\s+up\b|\bvomited\b|\bgagged\b|\bacid\s+reflux\b|\blost\s+her\s+appetite\b/.source
  + '|' + /\bran\s+to\s+the\s+(?:bathroom|restroom|toilet)\s+to\s+throw\s+up\b|\bspit\s+into\s+the\s+sink\b|\bcraved\s+(?:sour\s+food|pickles|lemons)\b|\bthe\s+smell\s+of\s+(?:grease|meat|fish)\s+(?:made\s+her|turned\s+her\s+stomach)\b/.source,
  'i',
);

/* PREG_TEST 确诊锚：症状之后被证实怀孕 */
const PREG_TEST_ZH_RE = /验孕棒|早孕试纸|验孕纸|两道杠|两条杠|双杠|怀孕了|怀(?:上|了)孕|有了身孕|有(?:了)?(?:他的|她的)?(?:孩子|骨肉|身孕)|血\s?HCG|HCG(?:化验|检查|血检)?|化验单(?:显示|写明|说)[^。！？\n]{0,8}(?:怀|孕|阳)|确诊(?:怀孕|妊娠)|医(?:生)?[^。！？\n]{0,8}(?:怀(?:了|上|是)|有(?:了)?身孕|怀孕)|(?:怀|妊娠)[^。！？\n]{0,4}(?:\d+|[一二三四五六七八九十])[周个多]月?|妊娠反应|腹中胎儿|产检报告?/;

const PREG_TEST_EN_RE = /\bpregnancy\s+test\b|\btwo\s+(?:pink\s+)?lines\b|\btest\s+came\s+back\s+positive\b|\bpositive\s+pregnancy\s+test\b|\byou(?:'re| are)\s+pregnant\b|\bshe\s+was\s+pregnant\b|\bshe's\s+pregnant\b|\bexpecting\s+(?:a\s+|her\s+)?baby\b|\bblood\s+test\s+(?:confirmed|came\s+back\s+positive)\b|\bOB-?GYN\s+confirmed\b|\bprenatal\s+(?:visit|checkup|appointment)\b|\b\d+\s+weeks\s+pregnant\b/i;

/* ===== 型A rescue：CARE 真实医疗过程 ===== */
const CARE_ZH_RE = /(?:打了?|注射了?)?黄体酮(?:针|保胎)?|保胎针|保胎药|保胎治疗|卧床(?:静养|休息|保胎)|留院观察|住院(?:观察|保胎)|胎心(?:恢复|回归|变|转为)?(?:正常|有力|平稳|稳)|孩子保住了|胎动(?:恢复|正常)|医(?:生|嘱)[^。！？\n]{0,12}(?:卧床|静养|休息|少动)|遵医嘱/;

const CARE_EN_RE = /\bprogesterone(?:\s+shots?)?\b|\bprescribed\s+bed\s+rest\b|\bdoctor\s+ordered(?:\s+her)?\s+bed\s+rest\b|\bkept\s+the\s+baby\b|\bfetal\s+heartbeat\s+was\s+(?:strong|steady|normal)\b|\bmonitored\s+(?:her\s+)?overnight\b|\bhospitali[sz]ed\s+for\s+observation\b|\bthe\s+pregnancy\s+held\b|\bsaved\s+the\s+baby\b|\bbed\s+rest\s+for\s+two\s+weeks\b/i;

/* 型A rescue：LOSS 危机真实兑付（完成态；"可能保不住"的危机宣告不收） */
const LOSS_ZH_RE = /孩子(?:最终|还是|已经)?(?:没了|没保住|保不住了|走了)|已经流产|自然流产|小产了?|清宫(?:手术)?|胎死腹中|失去了?(?:这个|她的)?孩子|没能留住(?:这个)?孩子|胎(?:儿)?没(?:能)?保住/;

const LOSS_EN_RE = /\blost\s+the\s+baby\b|\bmiscarried\b|\bthe\s+baby\s+didn't\s+make\s+it\b|\bhad\s+a\s+D&?C\b|\bthe\s+baby\s+was\s+gone\b|\bcouldn't\s+keep\s+the\s+baby\b|\bgrieved\s+the\s+loss\b|\bpregnancy\s+ended\s+in\s+miscarriage\b/i;

/* ===== 型B rescue：PROCESS 诊断有过程 ===== */
const PROCESS_ZH_RE = /复查|第二次(?:验|测|化验|检查|试)|再(?:验|测)一次|等(?:了)?[^。！？\n]{0,4}(?:化验|结果|报告|消息)|抽血(?:化验)?(?:HCG|血HCG)?|过了(?:一周|几天|数日|两周)[^。！？\n]{0,8}(?:确诊|复查|证实|告诉)|隔天(?:又)?(?:测|验|去医院)|B超(?:确认|证实|显示)|换了?(?:个|家)(?:牌子|医院|试纸)(?:再|重新)?(?:测|验|检查)|(?:医院|医生)[^。！？\n]{0,8}(?:化验|抽血|检查)/;

const PROCESS_EN_RE = /\bsecond\s+(?:test|opinion)\b|\bretested\b|\bre[- ]?tested\b|\bblood\s+test\s+to\s+confirm\b|\bwaiting\s+for\s+the\s+(?:lab\s+)?results\b|\bconfirmed\s+(?:a\s+week|days|two\s+days)\s+later\b|\bultrasound\s+confirmed\b|\bfollow-?up\s+(?:test|appointment)\b|\banother\s+brand\s+to\s+be\s+sure\b|\btook\s+a\s+blood\s+test\b/i;

/* 型B rescue：KNOWN 既存孕妇的日常孕反（怀孕早已确立） */
const KNOWN_ZH_RE = /怀孕(?:以来|已经)[^。！？\n]{0,10}(?:吐|恶心|孕反|反应|不适)|孕(?:期|妇)[^。！？\n]{0,10}(?:吐|恶心|孕反|反应|不适)|怀[一二三四五六七八九十\d]+[周个]月?[^。！？\n]{0,10}(?:一直|还是|又|总|天天|开始)(?:吐|恶心)?|怀(?:了|上)[一二三四五六七八九十\d]+[周个]月/;

const KNOWN_EN_RE = /\bmorning\s+sickness\s+(?:throughout|during)\s+her\s+pregnancy\b|\bsince\s+(?:she\s+got|becoming)\s+pregnant\b|\bpregnant\s+for\s+\d+\s+weeks\b[^.?!\n]{0,24}?(?:nause|threw\s+up|sick|vomit)|\b(?:during|in)\s+her\s+(?:first|second|third)\s+trimester\b|\bher\s+pregnancy\s+nausea\b/i;

/* 型B rescue：FALSE 乌龙（假阳性/复查没怀） */
const FALSE_ZH_RE = /试纸(?:过期|失效|坏了)|验孕棒(?:过期|坏了|失效)|诈胡|假阳性|乌龙(?:一场)?|(?:根本|其实|并没有|原来没|没有)怀孕|空欢喜|没怀(?:上)?/;

const FALSE_EN_RE = /\bexpired\s+(?:test|kit)\b|\bfalse\s+positive\b|\bit\s+was\s+a\s+mistake\b|\bnot\s+pregnant\s+after\s+all\b|\bnegative\s+on\s+the\s+second\s+test\b|\bfalse\s+alarm\b|\bkit\s+was\s+defective\b/i;

const PAIR_PAD = 2;
const CONTEXT_PAD = 3;
const RESCUE_PAD = 2;

interface Ev {
  start: number;
  end: number;
  anchorEnd: number;
  kind: 'shock' | 'diagnosis';
  marker: string;
}

/**
 * 纯函数：检测"妊娠剧情阀门/肚子当开关"密度病。
 */
export function pregnancyOnCue(draft: string): PregnancyOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const shockRe = zh ? SHOCK_ZH_RE : SHOCK_EN_RE;
  const fetalStrongRe = zh ? FETAL_STRONG_ZH_RE : FETAL_STRONG_EN_RE;
  const fetalWeakRe = zh ? FETAL_WEAK_ZH_RE : FETAL_WEAK_EN_RE;
  const pregContextRe = zh ? PREG_CONTEXT_ZH_RE : PREG_CONTEXT_EN_RE;
  const nauseaRe = zh ? NAUSEA_ZH_RE : NAUSEA_EN_RE;
  const pregTestRe = zh ? PREG_TEST_ZH_RE : PREG_TEST_EN_RE;
  const careRe = zh ? CARE_ZH_RE : CARE_EN_RE;
  const lossRe = zh ? LOSS_ZH_RE : LOSS_EN_RE;
  const processRe = zh ? PROCESS_ZH_RE : PROCESS_EN_RE;
  const knownRe = zh ? KNOWN_ZH_RE : KNOWN_EN_RE;
  const falseRe = zh ? FALSE_ZH_RE : FALSE_EN_RE;

  /* 场景映射（场景头不参与词表匹配） */
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
    }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasShock: boolean[] = new Array(rawLines.length).fill(false);
  const hasFetalStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasFetalWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasPregCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasNausea: boolean[] = new Array(rawLines.length).fill(false);
  const hasPregTest: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasShock[i] = shockRe.test(line);
    hasFetalStrong[i] = fetalStrongRe.test(line);
    hasFetalWeak[i] = fetalWeakRe.test(line);
    hasPregCtx[i] = pregContextRe.test(line);
    hasNausea[i] = nauseaRe.test(line);
    hasPregTest[i] = pregTestRe.test(line);
  });

  /** 触发行成组：相邻 ≤2 行合并，跨场景头不合并（between 切片） */
  const groupRows = (flags: boolean[]): { start: number; end: number }[] => {
    const groups: { start: number; end: number }[] = [];
    rawLines.forEach((raw, i) => {
      if (!flags[i]) return;
      const last = groups[groups.length - 1];
      if (last && i - last.end <= 2) {
        const between = rawLines.slice(last.end + 1, i);
        if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
          last.end = i;
          return;
        }
      }
      groups.push({ start: i, end: i });
    });
    return groups;
  };

  const events: Ev[] = [];

  /* 型A：SHOCK 组 ±2 行找 FETAL（强档直配；弱档需 ±3 行 PREG_CONTEXT） */
  for (const g of groupRows(hasShock)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let fetalLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasFetalStrong[j]) { fetalLine = j; strongHit = true; break; }
      if (fetalLine < 0 && hasFetalWeak[j]) fetalLine = j;
    }
    if (fetalLine < 0) continue; /* 碰撞后无妊娠危机：普通冲突/动作戏放行 */
    let pregOk = strongHit;
    if (!pregOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, g.end + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasPregCtx[j] || hasFetalStrong[j]) { pregOk = true; break; }
      }
    }
    if (!pregOk) continue; /* 无既存孕妇锚：普通人撞车受伤，不归本引擎 */

    const shockM = (rawLines[g.start].match(shockRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const fetalM = (rawLines[fetalLine].match(strongHit ? fetalStrongRe : fetalWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, fetalLine),
      anchorEnd: fetalLine,
      kind: 'shock',
      marker: `${shockM}→${fetalM}`.slice(0, 28),
    });
  }

  /* 型B：NAUSEA 组 ±2 行找 PREG_TEST */
  for (const g of groupRows(hasNausea)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let testLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasPregTest[j]) { testLine = j; break; }
    }
    if (testLine < 0) continue; /* 呕吐但没确诊：食物中毒/晕车/普通胃病放行 */

    const nauseaM = (rawLines[g.start].match(nauseaRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const testM = (rawLines[testLine].match(pregTestRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, testLine),
      anchorEnd: testLine,
      kind: 'diagnosis',
      marker: `${nauseaM}→${testM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: PregnancyOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次妊娠桥段是类型刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = ev.kind === 'shock'
      ? (careRe.test(win) || lossRe.test(win))
      : (processRe.test(win) || knownRe.test(win) || falseRe.test(win));
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      kind: ev.kind,
      rescued,
      reason: ev.kind === 'shock'
        ? (zh
          ? '又是一推就见红——推搡、摔楼梯、车祸精准落在孕妇身上，下一秒捂肚子、见血、孩子保不住，满屋关系当场翻转；身体事故成了关系遥控器，危机却从不真兑付，卧床一集又活蹦乱跳'
          : 'another shove-and-bleed beat - the push, fall or car crash lands on the pregnant woman on cue, hand to belly, blood, "we might lose the baby", and every relationship in the room flips on the spot; the body is a remote control for relationships while the crisis never actually cashes out')
        : (zh
          ? '又是干呕就确诊——恶心干呕、想吃酸的，下一拍验孕棒两道杠/医生当场宣布，症状到确诊零等待零化验，怀孕只是逼婚、继承、挽留、复仇的道具扳手'
          : 'another nausea-to-diagnosis beat - she gags, craves something sour, and the next beat is two pink lines or the doctor announcing it on the spot; zero waiting and zero lab work between symptom and diagnosis, pregnancy reduced to a wrench for marriage, inheritance and revenge plots'),
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    const shockCount = events.filter((e) => e.kind === 'shock').length;
    const diagCount = events.filter((e) => e.kind === 'diagnosis').length;
    issues.push(zh
      ? `${hitCount} 处"妊娠剧情阀门"（撞击见红 ${shockCount} 处、干呕确诊 ${diagCount} 处，${n} 处未救）——孕妇的身体成了随取随用的剧情开关：一推就见红、一吐就两道杠，下跪、和解、逼婚、夺产全靠肚子扳道岔。第一次是类型桥段，第三次观众就发现：这个剧里孩子从来不是一条命，是情节的扳手；而且每回"差点保不住"最后都保得住，惊吓也跟着贬值。`
      : `${hitCount} pregnancy-on-cue beat(s) (${shockCount} shove-and-bleed, ${diagCount} nausea-to-diagnosis; ${n} unrescued) - the pregnant body is a plot switch flipped whenever the scene needs one: one shove means blood, one gag means two pink lines, and kneeling, reconciliation, forced marriage and inheritance fights all get rerouted through the belly. Once is genre grammar; by the third, the audience sees the baby is never a life in this story, only a wrench - and when "we almost lost it" always ends well, even the scare loses its value.`);
    advice.push(zh
      ? '让妊娠恢复它本来的重量。撞击见红型：①让医疗真实进场——急诊、胎心监测、黄体酮、卧床医嘱、留院观察，医生给出的是概率而不是咒语，家属在走廊里等的是检查结果；②要么让危机真兑付——自然流产、清宫、失去孩子并给足哀悼，身体付出代价，人物关系被永久改写，阀门不能每回都只响不掐；③更高级的做法是让撞击与怀孕脱钩——争吵推搡不该自动通往下腹见血，真正的危险可以来自既往病史、疲劳、医疗意外，而不是反派的手。干呕确诊型：④让诊断有过程——初筛可疑、抽血验HCG、隔几天复查、B超确认周数，从"可能"到"确定"留出等待、忐忑和误判的空间；⑤既存孕妇的孕吐是生活不是转折，别让每一次恶心都承担剧情宣告；⑥慎用乌龙但可以用——过期试纸、假阳性、空欢喜，让"以为有了"本身成为一场短戏。最忌讳一集两回"推倒→捂肚→保不住→和好"和"干呕→两道杠→摊牌"。孩子若要出现，就让它改变所有人的处境，而不是只改变一集的节奏。'
      : 'Give pregnancy its real weight. For shove-and-bleed beats: (1) let real medicine in - the ER, fetal monitoring, progesterone, ordered bed rest, overnight observation; the doctor speaks in probabilities, not spells, and the family waits in the corridor for actual results. (2) Or let the crisis cash out for real - miscarriage, a D&C, grief, a cost paid in the body and a relationship permanently changed; a valve that only hisses and never shuts is no valve at all. (3) Better still, decouple the collision from the pregnancy - a shove in an argument should not auto-route to blood between the legs; let the danger come from medical history, exhaustion, a clinical accident, not the villain\'s hand. For nausea-to-diagnosis beats: (4) give diagnosis a process - a tentative first test, an HCG blood draw, a repeat days later, an ultrasound dating the pregnancy; leave room between "maybe" and "certain" for waiting, dread and error. (5) Morning sickness for an established pregnancy is daily life, not a plot announcement; not every gag should carry story weight. (6) The false alarm is allowed when used well - an expired kit, a false positive, the breath let out, a small scene built around "we thought". The unforgivable pattern is two "shove -> belly -> might lose it -> reconcile" and "gag -> two lines -> showdown" loops per episode. If a baby enters the story, let it change everyone\'s circumstances - not merely one episode\'s rhythm.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
