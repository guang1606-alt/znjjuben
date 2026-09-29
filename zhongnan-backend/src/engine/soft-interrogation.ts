import { isSceneHeaderLine } from './script-scenes';
/**
 * 审讯秒招 / 权威暴力解锁真话检测（v2.101 块109，创作能力类）
 * ------------------------------------------------------------------
 * 病象：审讯戏里，嫌疑人本该是整场博弈最难啃的那块骨头——他有
 *   求生本能、有抵赖动机、有退路算计。AI 写的审讯却像编剧开了
 *   提款机：警察一拍桌子、吼一句"说不说"，嫌疑人立刻崩溃，同伙
 *   是谁、人质关在哪、赃款埋在何处、下一步计划，一五一十全部
 *   吐出来。没有证据上桌、没有交易、没有沉默、没有时间消耗。
 *   spy-craft 早已立规"审讯是双向信息博弈，禁止一上来就竹筒倒
 *   豆子"，investigation-craft 立规"审讯靠证据与心理博弈突破，
 *   不拍逼供"，本引擎就是这两条规矩的检测器。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - villain-overconfession：管反派占上风时的"主动炫耀式"泄露，
 *    且明确把警察/审讯/法庭语境作为 legal rescue 放行——本引擎
 *    恰好管这个放行区：被关押、被讯问的弱势方在高压下"秒供"。
 *    两者镜像互补（审讯室外的不打自招 vs 审讯室内的一拍全招），
 *    同构于 evidence-blank ↔ records-on-demand 的镜像关系；
 *  - drunk-truth：灌醉解锁真话（酒精当钥匙）；
 *  - child-blurt：年幼解锁真话（孩童当广播）；
 *  - 本引擎：权威/暴力解锁真话（审讯当提款机）——"免费真心话"
 *    家族第三员；
 *  - witness-gratuity：证人主动带证据上门（自由身、主动给），
 *    本引擎是被控制方、被高压挤出来的供词；
 *  - plot-armor：管主角光环/反派降智的宏观判定，本引擎只管
 *    "压力与供词之间零博弈"这一具体密度病。
 *
 * 判定：
 *  - CUSTODY 关押/审讯语境：场景头锚定（"内景 审讯室 夜"/
 *    INTERROGATION ROOM，本引擎特例——场景头不参与压力/供词
 *    匹配，但参与语境锚定）或同场景 ±6 行内有羁押叙述锚
 *    （审讯桌/手铐/看守所/录口供/对面坐着刑警 + interrogation
 *    room/cuffed/holding cell/precinct…）；
 *  - PRESSURE 压力锚（猛拍桌/揪住/逼近/吼/揍/用刑 + 空口施压
 *    "说不说/最后一次机会/我们都掌握了/坦白从宽" + slammed the
 *    table/got in his face/Talk!/last chance/we know everything）
 *    与 SPILL 秒供（全招了/一五一十/扛不住/我全说 + I'll talk/
 *    confessed everything/broke）±2 行共现，且吐出实质情报
 *    payload（同伙/地点/计划/旧案四族，允许落在吐词 ±1 行）；
 *  - 三条件缺一不可：纯认罪无 payload 放行（"我招了，我是初犯"
 *    不含可消费情报），无关押语境放行（夫妻拍桌吵架不归本引擎），
 *    只有语境没有压力与供词放行（正规程序的平静讯问）；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    ①EVIDENCE 证据博弈（监控/流水/DNA/录音甩上桌，用具体事实
 *    挤口供，认一件挤一件）②DEAL 交易（减刑/污点证人/戴罪立功/
 *    交换家人 + immunity/plea deal/cooperate，供词是算计后的
 *    筹码）③RESIST 拉锯消耗（沉默/要律师/否认/反将/数小时/换三
 *    拨人/持续用刑见血后才开口——有过程就不是"秒"招；靠打的口
 *    供另有程序合规维度管，本引擎只判定"秒"不成立）；
 *  - 相邻 ≤2 行的压力表述合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次快节奏突破可容忍），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface SoftInterrogationHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有证据博弈/交易/拉锯（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface SoftInterrogationResult {
  score: number;
  /** 秒招事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: SoftInterrogationHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 场景头中的羁押语境（本引擎特例：场景头只参与语境锚定，不参与压力/供词匹配） */
const CUSTODY_HEADER_ZH = /审讯室|讯问室|审问室|审讯|讯问|审问|盘问室|看守所|拘留室|羁押|探视室/;
const CUSTODY_HEADER_EN = /\b(?:INTERROGATION|INTERVIEW\s+ROOM|HOLDING\s+CELL|LOCKUP|ONE-WAY\s+MIRROR|PRECINCT\s+INTERVIEW)\b/;

/* 羁押/审讯语境叙述锚 */
const CUSTODY_ZH =
  /审讯室|审问室|讯问室|审讯桌|审讯椅|审讯灯|开始审讯|正在审讯|提审|讯问|盘问|单向玻璃|录口供|做笔录|铁椅子/.source
  + '|' + /手铐|铐在|铐着|被铐|双手?被铐|戴着手铐/.source
  + '|' + /看守所|拘留室|拘押|羁押|关押|拘留所|审讯室门外/.source
  + '|' + /被(?:押|带|请|拽)到?(?:警局|警察局|派出所|公安局|审讯室|讯问室|刑警队)/.source
  + '|' + /对面(?:坐|是|的是)[^。！？\n]{0,8}(?:警察|警官|民警|刑警|探长|检察官|预审)/.source;

const CUSTODY_ZH_RE = new RegExp(CUSTODY_ZH);

const CUSTODY_EN =
  /\binterrogation(?:\s+room)?\b|\binterview\s+room\b|\bholding\s+cell\b|\blockup\b|\bone-way\s+mirror\b|\binterrogation\s+(?:lamp|light|table)\b|\bbooking\s+room\b/.source
  + '|' + /\bhandcuff(?:ed)?\b|\bcuffed(?:\s+to)?\b|\bin\s+custody\b|\bunder\s+arrest\b|\bmiranda\b/.source
  + '|' + /\bat\s+the\s+(?:precinct|station)\b|\bdown(?:town)?\s+at\s+(?:the\s+)?(?:precinct|station)\b/.source
  + '|' + /\b(?:detective|officer|cop|prosecutor)[^.\n]{0,30}?across\s+the\s+(?:metal\s+)?(?:table|desk)\b/.source;

const CUSTODY_EN_RE = new RegExp(CUSTODY_EN, 'i');

/* 压力锚：肢体声势 / 空口施压 */
const PRESSURE_ZH =
  /猛拍(?:桌子|桌面)?|一拍桌|桌子一拍|一掌拍在|拍(?:着|响|了一下)?桌子|桌(?:面|子)被拍/.source
  + '|' + /一把(?:抓|揪住?)|揪住(?:衣领|领子)?|拽(?:起|着)(?:衣领|领子)?|顶(?:在|到)(?:墙|桌子|桌沿)|按(?:在|到)(?:桌|墙)|逼(?:到|近)(?:脸|身前|面前)?|俯[身首](?:逼|靠|压)|脸几乎贴/.source
  + '|' + /大吼|怒吼|咆哮|厉声(?:问|道|说|喝)|吼(?:道|问|出声)|猛地站(?:起|直)/.source
  + '|' + /一拳|一巴掌|扇了?|耳光|揍(?:了)?|踹翻|踢开椅子|动刑|用刑|刑讯|拷打|电击(?:棒)?|水刑/.source
  + '|' + /(?:到(?:底|是))?(?:说不说|招不招|交代不交代|说不说实话)|你到底(?:说|招|交代)|老实(?:点|交代)/.source
  + '|' + /再给你(?:一|最后)?次机会|最后(?:一)?次机会|我再问你最后(?:一|遍)|别给脸不要脸|敬酒不吃|坦白从宽|抗拒从严|争取宽大/.source
  + '|' + /我们(?:已经|都)(?:掌握|知道|查清|查明)|警方(?:已经|都)掌握/.source;

const PRESSURE_ZH_RE = new RegExp(PRESSURE_ZH);

const PRESSURE_EN =
  /\bslammed\s+(?:his|her|the)\s+(?:fist|hand)\s+(?:on|down\s+on)\s+the\s+(?:table|desk)\b|\bbanged\s+(?:on\s+)?the\s+table\b|\blunged\s+(?:across|forward)\b|\bfist\s+(?:hit|crashed)\s+the\s+table\b/.source
  + '|' + /\bgrabbed\s+(?:him|her)\s+by\b|\bgot\s+in\s+(?:his|her)\s+face\b|\bleaned\s+(?:right\s+)?in(?:to)?\b|\bshoved\s+(?:him|her)\s+(?:against|into|at)\b|\bpinned\s+(?:him|her)\s+(?:to|against)\b/.source
  + '|' + /\byelled\b|\bshouted\b|\broared\b|\bsnarled\b|\bslapped\s+(?:him|her)\b|\bbackhanded\b|\bpunched\b|\bkicked\s+the\s+chair\b/.source
  + '|' + /\btortur\w*\b|\bbeating\b|\bbeat\s+(?:him|her)\b|\btaser\b/.source
  + '|' + /\btalk!?\b|\bstart\s+talking\b|\bspit\s+it\s+out\b|\bdon'?t\s+make\s+me\s+ask\s+again\b|\bi'?m\s+not\s+asking\s+again\b/.source
  + '|' + /\blast\s+chance\b|\bone\s+last\s+chance\b|\bwe\s+know\s+(?:everything|all\s+of\s+it)\b|\bwe\s+already\s+know\b|\bconfess\s+(?:now|right\s+now)\b|\byou\s+might\s+as\s+well\s+talk\b|\bmake\s+this\s+easy\s+on\s+yourself\b/.source;

const PRESSURE_EN_RE = new RegExp(PRESSURE_EN, 'i');

/* 吐词：秒招的姿态（还需配实质 payload 才成立） */
const SPILLWORD_ZH =
  /全招了?|都招了|全交代了?|全说了|全(?:都)?(?:招|说|交代)了?|一五一十|竹筒倒豆子|和盘托出|全(?:都)?抖(?:落|出)|扛不住了?|顶不住了?|崩(?:溃)?了|心理防线崩|软了下来|我全(?:说|招|交代)|我说，?(?:我)?(?:全)?说|我招(?:了|，|,)|我交代(?:，|,|了)|(?:终于|立马|立刻|马上)(?:松口|开口)/;

const SPILLWORD_ZH_RE = new RegExp(SPILLWORD_ZH);

const SPILLWORD_EN =
  /\bconfessed(?:\s+everything| to\s+everything|\s+all)?\b|\bmade\s+a\s+full\s+confession\b|\btold\s+(?:them|him|her)\s+everything\b|\bgave\s+(?:them|him|her)\s+(?:everything|it\s+all|the\s+whole\s+story)\b/.source
  + '|' + /\bi'?ll\s+talk\b|\bi'?ll\s+tell\s+you\s+everything\b|\bfine[,.]?\s*i'?ll\s+talk\b|\bstarted\s+talking\b|\bspilled\b|\bbroke\s+down\b|\bbroke\s+(?:immediately|right\s+away|in\s+seconds|at\s+once|instantly)\b|\bgave\s+up\s+(?:his|her)\s+(?:boss|partner|accomplice|contact)\b|\bnamed\s+(?:his|her)\s+(?:contact|boss|accomplice|partner)\b/.source;

const SPILLWORD_EN_RE = new RegExp(SPILLWORD_EN, 'i');

/* 实质情报 payload 四族：同伙/地点/计划/旧案（纯"是我干的"短认不含可消费情报，放行） */
const PAYLOAD_ZH =
  /是(?:他|她)[^。！？\n]{0,14}(?:让|叫|指使|逼|威胁|命令)我(?:干|做|杀|绑|运)|同伙(?:是|叫)[^。！？\n]{0,10}|上线是[^。！？\n]{0,8}|主谋是|幕后(?:主使|黑手)是|帮凶是|(?:内鬼|接应的人)是|跟我(?:一伙|接应|联手)的?是/.source
  + '|' + /人(?:质)?(?:被)?(?:藏|关|扣)在[^。！？\n]{0,12}|藏(?:在|到)[^。！？\n]{0,12}(?:钱|货|尸|账|毒品)|(?:钱|赃款|货款)(?:藏|放|转)(?:在|到)[^。！？\n]{0,10}|尸体(?:埋|藏)在[^。！？\n]{0,10}|(?:毒品|货|账本|账册)(?:在|藏在)[^。！？\n]{0,10}|把(?:钱|货|人质|孩子)(?:藏|放|关)在[^。！？\n]{0,10}/.source
  + '|' + /我们(?:本来|还|原)?(?:计划|打算|准备)[^。！？\n]{0,16}|原计划是[^。！？\n]{0,12}|下一步(?:是|要|准备)[^。！？\n]{0,12}|约(?:好|了)在[^。！？\n]{0,10}(?:见面|交货|动手)|后天(?:要|准备|去)[^。！？\n]{0,10}/.source
  + '|' + /[一二两三四五六七八九十\d]+年前[^。！？\n]{0,10}(?:火|人|案|事)|那(?:天晚|晚)?(?:上)?[^。！？\n]{0,4}是我(?:干|做|杀)的|之前(?:那|几)(?:起|桩|单)?[^。！？\n]{0,4}(?:案|事|人)[^。！？\n]{0,6}也是我/.source;

const PAYLOAD_ZH_RE = new RegExp(PAYLOAD_ZH);

const PAYLOAD_EN =
  /\b(?:he|she|they)\s+(?:made|forced|ordered|told)\s+me\s+(?:do|kill|kidnap|move)\s+it\b|\b(?:he|she|they)\s+(?:made|forced|ordered)\s+me\b|\bmy\s+(?:accomplice|partner(?:\s+in\s+crime)?|boss|contact)\s+(?:is|was)\b|\bthe\s+inside\s+(?:man|job)\s+(?:is|was)\b|\bi\s+was\s+working\s+(?:with|for)\b|\bhis\s+name\s+(?:is|was)\b|\bthere\s+was\s+(?:another\s+guy|two\s+of\s+us|three\s+of\s+us)\b/.source
  + '|' + /\b(?:she|the\s+girl|the\s+kid|he|they)(?:'?s| is|'?re| are)\s+(?:being\s+)?(?:hidden|held|tied\s+up|locked|buried|kept)\s+(?:at|in|under|inside)\b|\b(?:the\s+)?(?:money|drugs|body|cash|stash|ledger)\s+(?:is|was|are)\s+(?:hidden|buried|stashed|locked|kept)\s+(?:at|in|under)\b|\bwe\s+(?:hid|buried|stashed)\s+(?:it\s+)?(?:at|in|under)\b/.source
  + '|' + /\bwe\s+were\s+going\s+to\b|\bthe\s+plan\s+was\s+to\b|\bwe\s+planned\s+to\b|\b(?:we|they)('?d| would)\s+(?:hit|deliver|meet|move|kill)\b|\bsupposed\s+to\s+(?:meet|deliver|move)\b|\bnext\s+(?:we|they|he|she)\s+would\b|\bthe\s+drop\s+was\s+(?:at|in)\b/.source
  + '|' + /\b\d+\s+years?\s+ago\s+i\b|\bi\s+also\s+(?:killed|did|burned|took)\s+(?:the|that|him|her)\b|\bthat\s+was\s+me\s+too\b/.source;

const PAYLOAD_EN_RE = new RegExp(PAYLOAD_EN, 'i');

/* rescue A：证据博弈——具体物证/事实上桌，供认是被挤出来的（动词在前时必须带证据名词，防"一掌拍在桌面上"这类声势动作误中） */
const EVIDENCE_ZH =
  /(?:把|将)?[^。！？\n]{0,12}?(?:监控|录像|录音|照片|流水|鉴定|视频|合同|指纹|DNA|证据|报告|档案|文件|笔录|账本)[^。！？\n]{0,6}?(?:摆|甩|摔|放|推|扔|拍)(?:在|到)[^。！？\n]{0,6}?(?:桌|面前|眼前)|(?:监控|录像|录音|照片|流水|鉴定|视频|合同|指纹|DNA|证据|报告)[^。！？\n]{0,8}(?:摆在|甩在|放在|推到|拍到了|录到了|证明|显示)/.source
  + '|' + /证据确凿|铁证如山|拍到(?:了)?你(?:了|们|们了)?|你的指纹|DNA比对/.source;

const EVIDENCE_ZH_RE = new RegExp(EVIDENCE_ZH);

const EVIDENCE_EN =
  /\bslid\s+the\s+(?:footage|photos?|records?|file|DNA|report|tape|images?)\s+across\b|\bthrew\s+(?:the\s+)?(?:photos?|file|records)\s+(?:down\s+|on\s+the\s+table)\b|\btossed\s+(?:the\s+)?(?:photos?|file)\s+(?:down|on)\b/.source
  + '|' + /\bhere\s+you\s+are\s+on\s+camera\b|\bthe\s+(?:DNA|footage|CCTV|recording|bank\s+records|phone\s+records|fingerprints)\s+(?:proves?|shows?|places?|puts?)\b|\bwe\s+have\s+(?:the\s+)?(?:footage|DNA|recording|your\s+fingerprints|bank\s+records)\b|\byour\s+fingerprints\s+were\b/.source;

const EVIDENCE_EN_RE = new RegExp(EVIDENCE_EN, 'i');

/* rescue B：交易——供词是算计后的筹码 */
const DEAL_ZH =
  /减刑|立功(?:认定|表现)?|污点证人|自首(?:情节)?|宽大处理|取保候审|戴罪立功|(?:做|谈)(?:个|一笔)?交易|条件是|谈条件|我的条件|只要(?:我|你们)(?:说|招|指证|配合)/.source
  + '|' + /放了?我?(?:妈|母亲|女儿|儿子|家人|孩子|老婆|妻子)|保(?:他|她|我)(?:家人|孩子|女儿|老婆)?(?:没事|出来|一条命)|不(?:为难|牵连)(?:我)?(?:家人|孩子)/.source;

const DEAL_ZH_RE = new RegExp(DEAL_ZH);

const DEAL_EN =
  /\b(?:make|cut|offer|strike)\s+a\s+deal\b|\bimmunity\b|\ble(?:sser|ast)\s+charge\b|\bplea\s+(?:deal|bargain)\b|\bwitness\s+protection\b|\breduce[ds]?\s+(?:my|the)\s+charges\b|\bif\s+i\s+testify\b/.source
  + '|' + /\bcooperate\s+(?:in\s+exchange|with)\b|\bin\s+exchange\s+for\b|\blet\s+(?:my|his|her)\s+(?:family|wife|daughter|son|kid)\s+go\b|\bmy\s+terms\b|\bprotect\s+my\s+family\b|\byears?\s+off\s+(?:my\s+)?sentence\b/.source;

const DEAL_EN_RE = new RegExp(DEAL_EN, 'i');

/* rescue C：拉锯消耗——沉默/律师/否认/反将/时间消耗/持续用刑后才招（有过程就不是"秒"） */
const RESIST_ZH =
  /沉默|不说话|一声不吭|闭口不言|闭紧(?:了)?嘴|死咬(?:着)?(?:牙|不|没)|抵赖|否认|矢口否认|冷笑(?:着)?(?:说|道)?|你们(?:没有|拿不出)(?:证据|实证)|证据呢|空口无凭/.source
  + '|' + /要(?:找|见|请|等)(?:我)?律师|律师(?:来|到)(?:之前|以前)我(?:什么都)?(?:不说|不签|不讲)|保持沉默|零口供|我有权(?:保持)?沉默/.source
  + '|' + /审(?:了|到)?[^。！？\n]{0,5}(?:小时|个?钟头|天|夜|深夜|天亮)|僵持|拉锯|磨了[^。！？\n]{0,5}(?:小时|钟头)|换了?[^。！？\n]{0,3}拨(?:人|警察|审讯)?|第[二三四五六七八九十\d]+(?:轮|次|拨)|连审|审到(?:深夜|天亮)|整夜/.source
  + '|' + /打了?(?:一|好几|整|大)[^。！？\n]{0,3}(?:顿|夜|个小时|通)|见(?:了)?血|打(?:得)?(?:昏死|奄奄|半死)|昏死过?去|泼(?:凉)?水(?:浇醒|泼醒)|奄奄一息|被抬回(?:牢|号子)/.source;

const RESIST_ZH_RE = new RegExp(RESIST_ZH);

const RESIST_EN =
  /\b(?:stayed|remained|kept)\s+silent\b|\bwouldn'?t\s+talk\b|\bclamped\s+(?:his|her)\s+(?:mouth|jaws?)\b|\bsaid\s+nothing\b|\bdenied\s+(?:it|everything)\b|\bno\s+comment\b|\byou\s+have\s+no\s+evidence\b|\bcountered\b|\bheld\s+out\b|\blaughed\s+it\s+off\b/.source
  + '|' + /\basked\s+for\s+(?:a\s+|his\s+|her\s+)?lawyer\b|\bwant(?:s|ed)?\s+(?:a\s+|his\s+|her\s+)?lawyer\b|\b(?:until|before)\s+(?:my|his|her)\s+lawyer\b|\bright\s+to\s+remain\s+silent\b|\bcounsel\s+present\b/.source
  + '|' + /\b\d+\s+hours?\s+(?:into|of)\s+(?:the\s+)?interrogation\b|\bhours?\s+(?:went|dragged|passed)\s+by\b|\bthird\s+round\b|\b(?:a\s+)?(?:second|third|fourth)\s+detective\b|\binterrogation\s+(?:lasted|went\s+on)\b|\ball\s+night\s+interrogation\b/.source
  + '|' + /\b(?:bloody|battered|bruised)\b|\bunconscious\b|\bwoke\s+him\s+(?:up\s+)?with\b|\bafter\s+(?:the\s+)?beating\b|\bbroke\s+only\s+after\b|\bbeat(?:en|ing)?\s+him\s+for\s+hours\b/.source;

const RESIST_EN_RE = new RegExp(RESIST_EN, 'i');


/**
 * 纯函数：检测"审讯秒招/权威暴力解锁真话"密度病。
 */
export function softInterrogation(draft: string): SoftInterrogationResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const custodyRe = zh ? CUSTODY_ZH_RE : CUSTODY_EN_RE;
  const custodyHeaderRe = zh ? CUSTODY_HEADER_ZH : CUSTODY_HEADER_EN;
  const pressureRe = zh ? PRESSURE_ZH_RE : PRESSURE_EN_RE;
  const spillRe = zh ? SPILLWORD_ZH_RE : SPILLWORD_EN_RE;
  const payloadRe = zh ? PAYLOAD_ZH_RE : PAYLOAD_EN_RE;
  const evidenceRe = zh ? EVIDENCE_ZH_RE : EVIDENCE_EN_RE;
  const dealRe = zh ? DEAL_ZH_RE : DEAL_EN_RE;
  const resistRe = zh ? RESIST_ZH_RE : RESIST_EN_RE;

  /* 场景映射（场景头只锚定语境，不参与词表匹配） */
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('').fill('');
  const sceneCustody: boolean[] = [];
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
      sceneCustody[sceneIdx] = custodyHeaderRe.test(line);
    }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasCustody: boolean[] = new Array(rawLines.length).fill(false);
  const hasPressure: boolean[] = new Array(rawLines.length).fill(false);
  const hasSpillWord: boolean[] = new Array(rawLines.length).fill(false);
  const hasPayload: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasCustody[i] = custodyRe.test(line);
    hasPressure[i] = pressureRe.test(line);
    hasSpillWord[i] = spillRe.test(line);
    hasPayload[i] = payloadRe.test(line);
  });

  /* 有效语境：本场景头锚定，或同场景 ±6 行内有羁押叙述锚（不跨场景头） */
  const custodyActive: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    if (sceneCustody[sceneOf[i]]) { custodyActive[i] = true; return; }
    for (let d = 0; d <= 6; d += 1) {
      for (const j of [i - d, i + d]) {
        if (j < 0 || j >= rawLines.length) continue;
        if (sceneOf[j] !== sceneOf[i]) continue;
        if (hasCustody[j]) { custodyActive[i] = true; return; }
      }
    }
  });

  /* pass2：压力行成组（相邻 ≤2 行合并、跨场景头不合并），与 ±2 行内的秒供+实质 payload 配对 */
  interface Ev { start: number; end: number; anchorEnd: number; marker: string; }
  const groups: { start: number; end: number; marker: string }[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasPressure[i]) return;
    const m = raw.match(pressureRe);
    const marker = (m?.[0] ?? '').replace(/^\s+/, '').slice(0, 16);
    const last = groups[groups.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i;
        return;
      }
    }
    groups.push({ start: i, end: i, marker });
  });

  const events: Ev[] = [];
  for (const g of groups) {
    const lo = Math.max(0, g.start - 2);
    const hi = Math.min(rawLines.length - 1, g.end + 2);
    let spillLine = -1;
    let payloadLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasPayload[j] && payloadLine < 0) payloadLine = j;
      if (hasSpillWord[j] && spillLine < 0) spillLine = j;
    }
    /* 实质情报四族必须落在吐词行 ±1，或存在直接供词句本身 */
    let anchorEnd = -1;
    if (hasPayload[spillLine]) {
      anchorEnd = spillLine; /* 吐词与 payload 同行（"我全招了，同伙是刀哥"） */
    } else if (spillLine >= 0) {
      for (let d = 1; d <= 1; d += 1) {
        for (const j of [spillLine - d, spillLine + d]) {
          if (j >= 0 && j < rawLines.length && hasPayload[j]) { payloadLine = j; anchorEnd = spillLine; }
        }
      }
    }
    if (anchorEnd < 0 && payloadLine >= 0) {
      for (let j = lo; j <= hi; j += 1) {
        if (hasPayload[j]) { anchorEnd = j; break; } /* 直接供词句（"是他逼我干的"）即供词 */
      }
    }
    if (anchorEnd < 0) continue; /* 纯认罪无实质 payload 放行 */
    /* 三锚齐备：压力组/供词行任一处于有效关押语境 */
    let custodyOk = false;
    for (let j = lo; j <= hi; j += 1) {
      if (custodyActive[j]) { custodyOk = true; break; }
    }
    if (!custodyOk) continue; /* 无关押/审讯语境放行（夫妻拍桌吵架不归本引擎） */
    const evEnd = Math.max(g.end, payloadLine >= 0 ? payloadLine : anchorEnd);
    const spillM = rawLines[anchorEnd].match(spillRe) ?? rawLines[anchorEnd].match(payloadRe);
    const markerEnd = (spillM?.[0] ?? '').replace(/^\s+/, '').slice(0, 16);
    events.push({
      start: Math.min(g.start, anchorEnd),
      end: evEnd,
      anchorEnd,
      marker: `${g.marker}→${markerEnd}`.slice(0, 28),
    });
  }

  /* pass3：rescue 检测（证据博弈/交易/拉锯三路；窗口含事件自身 ±2 行，仅跳过场景头行） */
  const hits: SoftInterrogationHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次快节奏突破可容忍） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = evidenceRe.test(win) || dealRe.test(win) || resistRe.test(win);
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是审讯秒招——没有证据上桌、没有交易、没有沉默拉锯，拍一下桌子吼一句"说不说"，嫌疑人立刻把同伙、人质地点、计划和盘托出，审讯室成了编剧的真话提款机'
        : 'soft interrogation again - with no evidence on the table, no deal and no resistance, one table-slam and a "talk!" gets the suspect to hand over accomplices, locations and the whole plan; the interrogation room is the writer\'s free-truth ATM',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"审讯秒招"（${n} 处未救）——一拍桌子、一句"最后一次机会"，嫌疑人立刻崩溃全招，同伙地点计划免费打包送出。第一次是快节奏，第三次审讯戏就成了真话提款机，警察的智斗和嫌疑人的求生本能同时失踪。`
      : `${hitCount} soft-interrogation beats (${n} unrescued) - one table-slam and a "last chance", and the suspect breaks at once, handing over accomplices, locations and plans for free. Once is pace; by the third, the interrogation is an ATM and both the detective work and the suspect's survival instinct have vanished.`);
    advice.push(zh
      ? '让审讯回到双向棋局，真话要一口一口挣出来：①先写明审方的三张牌——已经掌握什么、正在诈什么、其实不知道什么，嫌疑人据此决定哪句认、哪句反咬，每一轮问答只让一方的认知更新一点；②突破靠证据落地，不靠嗓门——把监控、流水、DNA、录音摆上桌，用一个他没料到的细节（那天的雨、一通电话的时间差、一个只有真凶知道的称呼）打破平衡，他认一件，再挤一件，且绝不主动交代"下一步"；③写出抵抗和消耗——他沉默、要律师、倒打一耙、只认轻罪、把罪名推给死人，审讯持续几小时、换了三拨人、僵到天亮，开口是被一点一点撬开的，不是被吓塌的；④真要开口，让供词成为筹码——减刑、污点证人、戴罪立功、保护家人，他先算计过得失才说，说也可能留一手、掺半句假话，等着审方去核实。最忌讳一集三次"拍桌→崩溃→全招"。把唯一一次痛快认罪留给证据确凿、退无可退的终局——那是压垮骆驼的最后一根稻草，不是随插随吐的提款机。'
      : 'Make the interrogation a two-way chess game; every fact must be earned one bite at a time. (1) Deal the interrogator three hands first - what they actually know, what they are bluffing, what they do not know - and let the suspect choose what to admit and what to throw back; each exchange updates only one side\'s knowledge. (2) Break him with evidence, not volume - slide the footage, bank records, DNA or recording onto the table, then use one detail he did not expect (that night\'s rain, a phone-call time gap, a name only the killer knows) to shift the balance; he admits one thing, they squeeze the next, and he never volunteers the next move. (3) Write resistance and cost - silence, a lawyer demanded, counter-accusations, admitting only the light charge, blaming a dead man; hours pass, three detectives rotate, the stalemate runs till dawn; the words are pried loose, not frightened out. (4) If he talks, make the confession a chip - a reduced charge, witness protection, leniency for protecting family; he does the math first, holds something back, mixes in a half-lie the detectives must verify. The unforgivable pattern is three "slam the table -> break -> confess everything" beats in one episode. Save the single clean confession for the endgame, cornered by hard evidence - the last straw, not an ATM.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
