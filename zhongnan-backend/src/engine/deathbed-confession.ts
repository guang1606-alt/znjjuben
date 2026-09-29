import { isSceneHeaderLine } from './script-scenes';
/**
 * 临终全招 / 死亡直给检测（v2.102 块110，创作能力类）
 * ------------------------------------------------------------------
 * 病象：悬疑/伦理/复仇戏的情感最高点，本该是真相最昂贵的时刻——
 *   知情人守了一辈子的秘密，要靠主角用几十集去挖。AI 却把死亡
 *   写成真相快递柜：老人倒在血泊里、气若游丝，主角一握住他的
 *   手，垂死之人立刻口齿清晰地报出真凶全名、作案动机、证据埋在
 *   哪棵树下、当年还有谁在场，一口气五样货，说完手一松、心电图
 *   拉直——死无对证，也无需再查。临终者不怕、不躲、不犹豫、不
 *   留半截，死亡不但没有让真相变贵，反而成了免费兑付的窗口。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - witness-gratuity：管自由身知情人当面倾倒情报套餐，且把
 *    "我快不行了"当作开口动机（motive）直接豁免——本引擎恰好
 *    管这个豁免区：垂死不是免费许可证，咽气窗口内的套餐一样是
 *    编剧借嘴。两者镜像互补，同构于 soft-interrogation 补
 *    villain-overconfession 审讯放行区的关系；
 *  - drunk-truth：酒精解锁真话；child-blurt：年幼解锁真话；
 *    soft-interrogation：权威/暴力解锁真话；本引擎：死亡解锁
 *    真话——"免费真心话"家族第四员（酒精→年幼→权威→死亡）；
 *  - villain-overconfession：反派占上风时炫耀式泄露，本引擎管
 *    绝对弱势者在最后时刻的直给；
 *  - cheap-forgiveness / supporting-arc：管临终情感和解与态度
 *    突变（"其实我一直把你当亲儿子"），本引擎管实质情报兑付
 *    （凶手/同伙/证据/旧案）；
 *  - character-presence：管死后本人再开口的在场穿帮，本引擎管
 *    死前话太多、太全、太利落的密度病；
 *  - emotional-aftermath：管重大事件的情绪余波，本引擎管情报
 *    兑付节奏。
 *  范围纪律：只收"现场垂死窗口 + 说完即死"；活人转述"我妈临终
 *  前告诉我……"（死亡发生在过去、无现场封口锚）第一版不收。
 *
 * 判定：
 *  - DYING 垂死语境：场景头强锚（"内景 ICU重症监护室 夜"/
 *    INTENSIVE CARE/DEATHBED/HOSPICE，本引擎特例——场景头只
 *    锚定语境，不参与情报/死亡匹配）或同场景 ±3 行内有垂死
 *    叙述锚（血泊/气若游丝/奄奄一息/只剩几分钟/快不行了/瞳孔
 *    散了/医生摇头准备后事 + pool of blood/only minutes to
 *    live/life slipping away/flatlining…）；
 *  - PAYLOAD 实质情报五族：deed 指认罪行 / accomplice 同伙 /
 *    evidence 证据位置 / location 藏匿地点 / oldcase 旧案；
 *    纯情感遗言（"照顾好妹妹""我不怪你"）放行；
 *  - DEATH 说完即死：情报行之后 0..6 行（同场景）出现死亡锚
 *    （咽气/手一松/头一歪/心电图拉直/永远闭上眼 + flatlined/
 *    took his last breath/went still/pronounced dead…）——死亡
 *    封口让遗言无法对质、无法追问，是本病的结构核心；受伤但
 *    救活、垂死却没死，均不成立事件；
 *  - 相邻 ≤2 行的情报行合并为同一事件（跨场景头不合并）；
 *  - rescue（窗口 start−2…deathLine+2，含事件自身，仅跳过
 *    场景头）：
 *    ①FRAGMENT 残缺谜——名字只说一半、话没说完声音就断了，
 *    遗言给线索不给答案，主角得自己拼；
 *    ②COST 求证代价——半本账本/缺页的信/密码只给一半/"剩下
 *    的你要自己去查"，遗言不能直接定罪，消费情报还要付调查；
 *    ③WAIT 守口挣扎——秘密守了三十年、答应过死人带进棺材、
 *    问过多少次都不肯说，到最后才松口，有过程就不是"秒"给；
 *  - 第 1 次豁免（一次临终坦白是类型片刚需），第 2 次起每次
 *    1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DeathbedConfessionHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有残缺/求证代价/守口挣扎（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface DeathbedConfessionResult {
  score: number;
  /** 临终全招事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: DeathbedConfessionHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 场景头中的垂死强语境（本引擎特例：场景头只锚定语境，不参与情报/死亡匹配；普通病房/医院不收） */
const DYING_HEADER_ZH = /临终|弥留|重症监护|ICU|抢救室|特护病房|临终关怀/;
const DYING_HEADER_EN = /\b(?:ICU|INTENSIVE\s+CARE(?:\s+UNIT)?|DEATHBED|HOSPICE|EMERGENCY\s+RESUSCITATION|CRITICAL\s+CARE)\b/;

/* 垂死叙述锚 */
const DYING_ZH =
  /弥留(?:之际|时分|中)?|临终(?:前|时|之际)?|临死(?:前|时)|咽气前|断气前|奄奄一息|气若游丝|油尽灯枯|回光返照/.source
  + '|' + /生命(?:的)?最后(?:时刻|时间|一段|几分钟|几小时|几天)|最后(?:一|这)?(?:点|些)?(?:时间|力气|时刻)|剩下?没(?:几|多少|多长时间)(?:个)?(?:钟头|小时|天|分钟|秒)?了?|时间不多了|时日无多|时日不多|快不行了|撑不住了|撑不过(?:今晚|今天|今夜|这一关)|挺不过(?:今晚|今天|这一关)/.source
  + '|' + /血泊(?:里|中)?|(?:血|伤口)(?:一直)?(?:止|堵)不住|浑身是血|大口(?:地)?喘(?:着粗气|气)?|喘着粗气|出气多进气少|呼吸(?:越来越|微弱)|瞳孔(?:已经|开始)?散(?:了|大)?|瞳孔失焦|脸白得像纸/.source
  + '|' + /医生(?:摇了摇头|摇头|叹了口气)[^。！？\n]{0,12}(?:准备|后事|尽力|没救|不行了|病危)|准备(?:后事|寿衣)|病危通知|危险期|伤(?:得|势)(?:太|很)重[^。！？\n]{0,8}(?:救|不行|准备)/.source;

const DYING_ZH_RE = new RegExp(DYING_ZH);

/* 垂死词误中排除：物件（车/手机/机器）"快不行了/撑不住"不是人垂死 */
const DYING_EXCLUDE_ZH =
  new RegExp(/(?:汽车|轿车|卡车|摩托车|自行车|手机|电话|电脑|机器|发动机|引擎|电机|船|飞机|电梯|空调)/.source
    + '[^。！？\n]{0,10}(?:快不行|撑不住|时间不多|没(?:几|多少)个?(?:钟头|小时|天|分钟))'
    + '|' + /(?:快不行|撑不住)/.source + '[^。！？\n]{0,10}(?:汽车|轿车|卡车|手机|电脑|机器|发动机|引擎|电梯|空调)/');

const DYING_EN =
  /\bdying(?!\s+to\s+(?:know|hear|see|tell|find|ask|learn))\b|\bon\s+(?:his|her|the)\s+deathbed\b|\blife\s+(?:was\s+)?slipping\s+away\b|\bfinal\s+moments?\b|\blast\s+moments?\b|\bat\s+death'?s\s+door\b/.source
  + '|' + /\bonly\s+(?:minutes|hours|days|moments)\s+to\s+live\b|\bdidn'?t\s+have\s+(?:long|much\s+time|much\s+longer)\b|\bnot\s+much\s+time\s+left\b|\bfading\s+fast\b|\brunning\s+out\s+of\s+time\b/.source
  + '|' + /\bpool\s+of\s+(?:his\s+|her\s+)?blood\b|\bcouldn'?t\s+stop\s+the\s+bleeding\b|\bgasping\s+for\s+(?:air|breath)\b|\blabored\s+breathing\b|\bbreathing\s+shallow\b|\bunresponsive\b|\bcomatose\b|\bflatlin(?:ing|ed)\b|\bvitals?\s+dropping\b|\bhospice\b/.source
  + '|' + /\bthe\s+doctor\s+(?:shook\s+his\s+head|said\s+there\s+was\s+nothing|told\s+them\s+to\s+say\s+goodbye)\b|\bsay\s+(?:your|his|her)\s+goodbyes?\b|\bcritical\s+condition\b|\bbarely\s+hanging\s+on\b/.source;

const DYING_EN_RE = new RegExp(DYING_EN, 'i');

/* 实质情报 payload 五族：罪行指认/同伙/证据位置/藏匿地点/旧案（纯情感遗言不收） */
const PAYLOAD_ZH =
  /(?:凶手|真凶|杀(?:你|他|她|爹|爸|妈|父亲|母亲|哥|姐|夫|妻|子|女)[^。！？\n]{0,4}的人|幕后(?:主使|黑手|的人)|主谋)(?:就|是|叫|姓)[^。！？\n]{0,14}|是[^。！？\n]{1,10}(?:害死|杀(?:了|死|害)?|做掉(?:了)?|灭口(?:了)?|指使(?:的)?|买凶|换药(?:的)?|纵火|放(?:的)?火|推下(?:去|楼)?(?:的)?|掉包|栽赃(?:的)?|嫁祸(?:的)?|逼死|挪用|卷走)/.source
  + '|' + /人是我杀的|是我(?:干|做|杀|害|放火|换的药|推下去的|害死的|掉的包)|我(?:杀|害|做掉|灭口|放火|换药|掉包|栽赃|嫁祸)(?:了|死)?/.source
  + '|' + /同伙(?:是|叫|还有)[^。！？\n]{0,10}|帮凶(?:是|叫)?|同谋(?:是|叫)?|内鬼(?:是|叫)?|接应(?:他)?(?:的人)?(?:是|叫)|(?:指使|命令|买通|收买|胁迫)我(?:们)?(?:的人)?(?:是|叫)[^。！？\n]{0,8}|还有(?:一个|个)(?:人|同伙|帮手|内鬼)|跟(?:他|她)(?:一伙|接应|联手)的是/.source
  + '|' + /(?:账本|账簿|账册|录音(?:笔|带|文件)?|录像|监控|视频|U盘|硬盘|日记|遗嘱|合同|亲子鉴定|DNA报告?|书信|密信|股权转让|收据|银行流水|通话记录|证据|换药记录)[^。！？\n]{0,10}(?:藏|放|锁|埋|塞|压)(?:在|到|进|于)[^。！？\n]{0,14}/.source
  + '|' + /(?:人质|孩子|女儿|儿子|钱|赃款|货款|现金|尸体|货|毒品|毒品)(?:被)?(?:藏|关|扣|埋|放)(?:在|到)[^。！？\n]{0,14}/.source
  + '|' + /[一二两三四五六七八九十\d]+年前(?:那)?(?:桩|起)?[^。！？\n]{0,6}(?:火|命案|案子|绑架|抢劫|车祸|纵火)(?:也是我|是我(?:干|做|策划|放)的?)?|当年(?:的)?[^。！？\n]{0,8}(?:也是我(?:干|做)的?|我也有份)/.source;

const PAYLOAD_ZH_RE = new RegExp(PAYLOAD_ZH);

const PAYLOAD_EN =
  /\b(?:the\s+)?(?:killer|murderer|man\s+who\s+killed(?:\s+him|\s+her)?|person\s+who\s+did\s+it|one\s+behind\s+it\s+all)\s+(?:is|was)\s+[A-Z][\w'’-]*|\bthe\s+(?:killer|murderer)\s+(?:is|was)\s*(?:\.\.\.|…)/.source
  + '|' + /\bit\s+was\s+[A-Z][\w'’-]+\s+(?:who\s+)?(?:killed|murdered|poisoned|pushed|framed|set\s+fire|switched|ordered)\b|\bi\s+killed\b|\bi\s+was\s+the\s+one\s+who\b|\bthat\s+was\s+me\s+too\b/.source
  + '|' + /\bmy\s+(?:accomplice|partner(?:\s+in\s+crime)?|boss|contact)\s+(?:is|was)\b|\bthe\s+inside\s+(?:man|job)\s+(?:is|was)\b|\b(?:he|she|they)\s+(?:ordered|made|forced|paid|threatened)\s+me\s+to\b|\bthere\s+was\s+(?:another\s+guy|someone\s+else|two\s+of\s+us)\b/.source
  + '|' + /\b(?:the\s+)?(?:ledger|recording|tape|footage|diary|will|contract|letter|paternity\s+report|DNA\s+report|evidence|usb\s+drive|hard\s+drive|medical\s+records)\s+(?:is|was)\s+(?:hidden|buried|locked|kept|stashed|taped)\s+(?:at|in|under|inside|behind)\b/.source
  + '|' + /\b(?:the\s+)?(?:money|drugs|body|cash|stash|girl|kid|hostage)\s+(?:is|was|are)\s+(?:hidden|held|buried|kept|locked)\s+(?:at|in|under)\b|\bwe\s+(?:hid|buried|stashed)\s+(?:it\s+)?(?:at|in|under)\b/.source
  + '|' + /\b\d+\s+years?\s+ago\s+i\s+(?:also\s+)?(?:killed|did|burned|set)\b|\bi\s+also\s+(?:killed|did|burned|took)\s+(?:the|that|him|her)\b/.source;

const PAYLOAD_EN_RE = new RegExp(PAYLOAD_EN, 'i');

/* 说完即死锚（死亡封口） */
const DEATH_ZH =
  /咽(?:了)?气|断(?:了)?气|停止(?:了)?(?:呼吸|心跳)|没(?:了)?(?:气息|呼吸|心跳)|气息全无|呼吸停了?|心跳停了?/.source
  + '|' + /心电图(?:拉直|成(?:了)?一条直线|发出长鸣)|监护仪(?:长鸣|拉直|一条直线)|(?:长鸣|滴——[^。！？\n]{0,4}(?:响|不停))/.source
  + '|' + /手(?:一松|垂(?:下|落|了下去))|头(?:一歪|垂(?:了)?下去)|永远(?:地)?(?:闭上|离开|走了|睡去)|眼睛闭(?:上|紧)[^。！？\n]{0,8}(?:再没|没再|手垂|头歪)|再没(?:睁开|醒来|醒过)|彻底没了|没了声息|离世|长辞|溘然长逝|溘然长?逝|溘逝|停止了心跳/.source;

const DEATH_ZH_RE = new RegExp(DEATH_ZH);

const DEATH_EN =
  /\bflatlined\b|\bflatline[ds]?\b|\btook\s+(?:his|her)\s+last\s+breath\b|\bbreathed\s+(?:his|her)\s+last\b|\bstopped\s+breathing\b|\bno\s+pulse\b/.source
  + '|' + /\bwent\s+(?:completely\s+)?still\b|\bgrew\s+still\b|\bhand\s+(?:dropped|fell\s+(?:limp|away))\b|\bhead\s+(?:lolled|dropped\s+to\s+(?:one\s+side|the\s+side))\b/.source
  + '|' + /\beyes\s+(?:closed|fell\s+shut)\s+for\s+good\b|\bnever\s+opened\s+(?:his|her)\s+eyes\s+again\b|\bmonitor\s+(?:went\s+flat|emitted\s+one\s+long\s+tone|held\s+a\s+single\s+tone)\b/.source
  + '|' + /\b(?:he|she)\s+was\s+gone\b|\bpronounced\s+(?:dead|him\s+dead|her\s+dead)\b|\blife\s+left\s+(?:his|her)\s+body\b|\bbreathed\s+no\s+more\b/.source;

const DEATH_EN_RE = new RegExp(DEATH_EN, 'i');

/* rescue A：残缺谜——遗言给半截，真相要主角自己拼 */
const FRAGMENT_ZH =
  /没(?:能|来得及|有)?(?:把话)?说完|话没说完|没(?:来得及)?(?:说完|讲完|告诉你)(?:就|便)?|没说完(?:就|便)|声音(?:越来越小|弱(?:了)?下去|断了|细如蚊蚋|渐渐低)/.source
  + '|' + /(?:名字|那个名字)(?:只|就|光)(?:说了?|吐出|蹦出)(?:一半|一个字|半截|两个字)|只(?:说|吐|蹦)出?[^。！？\n]{0,4}(?:半|一个字|两个字)|(?:话音|声音|气)(?:卡|哽|断)(?:在|了)|嘴唇(?:动了动|翕动)[^。！？\n]{0,6}(?:没|再无)声(?:音|息)/.source
  + '|' + /(?:凶手|真凶|杀[^。！？\n]{0,4}的人|幕后[^。！？\n]{0,4})(?:就|是|叫)[^。！？\n]{0,4}(?:…{2,}|\.{3,})\s*$|(?:是|叫)[^。！？\n]{0,2}(?:…{2,}|\.{3,})\s*$/;

const FRAGMENT_ZH_RE = new RegExp(FRAGMENT_ZH, 'm');

const FRAGMENT_EN =
  /\b(?:never\s+finished|didn'?t\s+finish|couldn'?t\s+(?:finish|get\s+the\s+words?\s+out)|voice\s+(?:trailed\s+off|faded(?:\s+away)?|weakened|broke|thinned)|the\s+name\s+died\s+on\s+(?:his|her)\s+lips|only\s+(?:managed\s+to\s+say|got\s+out)|mouthed\s+silently|lips\s+moved(?:\s+but)?\s+no\s+words?\s+came)\b/.source
  + '|' + /(?:killer|murderer|man\s+who|name)\s+(?:is|was)\s*[A-Za-z]*\.{3,}\s*$/;

const FRAGMENT_EN_RE = new RegExp(FRAGMENT_EN, 'im');

/* rescue B：求证代价——线索不全，消费情报还要付调查 */
const COST_ZH =
  /半(?:张|块|本|枚|页|份|截|句)|残(?:缺|页|的|本|卷)|缺(?:了)?(?:一)?(?:页|半|位|块|角)|撕(?:掉|去|了)?一?半/.source
  + '|' + /(?:密码|暗号|数字)(?:只|就)(?:说|给)?(?:一半|前几位|前\d+位)|你(?:要|得|自己)(?:亲自)?去?(?:查|找|核实|核对|证实|对质)|信(?:不|不过)?[^。！？\n]{0,8}(?:可以去查|去核实|去对)/.source
  + '|' + /剩下的?[^。！？\n]{0,6}你(?:自己)?(?:去)?(?:查|找|核实|证实)|我(?:只|就)(?:知道|查到|弄到)(?:这么多|这些)|证据不在我(?:这|手)(?:里|上)|真假你(?:自己)?(?:去)?(?:辨|查|核)/.source;

const COST_ZH_RE = new RegExp(COST_ZH);

const COST_EN =
  /\b(?:half\s+(?:of\s+)?(?:the\s+)?(?:ledger|page|letter|map|recording|evidence|truth)|torn\s+(?:page|half|photo)|missing\s+(?:page|half|piece|digits|part))\b/.source
  + '|' + /\b(?:only\s+half\s+the\s+(?:code|combination)|you('?ll| have to)\s+(?:find|verify|check|confirm|dig)\s+(?:it|that|the\s+rest)\s+yourself|verify\s+it\s+yourself|that'?s\s+all\s+i\s+know|the\s+rest\s+is\s+(?:up\s+to\s+you|yours\s+to\s+find)|i\s+don'?t\s+have\s+(?:the\s+)?(?:evidence|proof|rest))\b/.source;

const COST_EN_RE = new RegExp(COST_EN, 'i');

/* rescue C：守口挣扎——秘密扛了很多年，最后一刻才松口（有过程就不是"秒"给） */
const WAIT_ZH =
  /守(?:了|着这个秘密)[^。！？\n]{0,8}(?:年|载)|瞒(?:了|着)[^。！？\n]{0,8}年|藏(?:了|在心里)[^。！？\n]{0,8}年/.source
  + '|' + /答应过[^。！？\n]{0,10}(?:不说|保密|守口如瓶|带进棺材)|带(?:进|入)棺材|我发过誓[^。！？\n]{0,8}(?:不说|保密)/.source
  + '|' + /犹豫(?:了很久|再三|许久)|你问(?:过)?(?:我)?[^。！？\n]{0,4}次[^。！？\n]{0,8}(?:都|一直)(?:没|不肯|不敢)说|到今天才(?:敢|肯)说|一直(?:没|不敢)(?:说|开口)|本(?:来|想)(?:不想|不该)说|追问(?:了)?(?:我)?(?:好)?多次/.source;

const WAIT_ZH_RE = new RegExp(WAIT_ZH);

const WAIT_EN =
  /\bkept\s+it\s+(?:for|inside\s+for)\s+\d+\s+years?\b|\bfor\s+\d+\s+years?\s+i\s+(?:said|told)\s+nothing\b|\bhidden\s+it\s+for\s+\d+\s+years?\b/.source
  + '|' + /\bpromised\s+(?:i|him|her|never)\s+to\s+tell\b|\btake\s+it\s+to\s+(?:my|the)\s+grave\b|\bi\s+swore\s+i'?d\s+never\s+tell\b|\brefused\s+for\s+years\b/.source
  + '|' + /\byou\s+asked\s+me\s+(?:so\s+many\s+times|a\s+hundred\s+times)\b|\bheld\s+it\s+in\s+until\s+now\b|\bnever\s+wanted\s+to\s+tell\b|\bi\s+hesitated\s+for\s+(?:so\s+long|years)\b/.source;

const WAIT_EN_RE = new RegExp(WAIT_EN, 'i');

const DYING_WINDOW = 3;
const DEATH_LOOKAHEAD = 6;
const RESCUE_PAD = 2;

/**
 * 纯函数：检测"临终全招/死亡直给"密度病。
 */
export function deathbedConfession(draft: string): DeathbedConfessionResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const dyingHeaderRe = zh ? DYING_HEADER_ZH : DYING_HEADER_EN;
  const dyingRe = zh ? DYING_ZH_RE : DYING_EN_RE;
  const payloadRe = zh ? PAYLOAD_ZH_RE : PAYLOAD_EN_RE;
  const deathRe = zh ? DEATH_ZH_RE : DEATH_EN_RE;
  const fragmentRe = zh ? FRAGMENT_ZH_RE : FRAGMENT_EN_RE;
  const costRe = zh ? COST_ZH_RE : COST_EN_RE;
  const waitRe = zh ? WAIT_ZH_RE : WAIT_EN_RE;

  /* 场景映射（场景头只锚定语境，不参与词表匹配） */
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  const sceneDying: boolean[] = [];
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
      sceneDying[sceneIdx] = dyingHeaderRe.test(line);
    }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasDying: boolean[] = new Array(rawLines.length).fill(false);
  const hasPayload: boolean[] = new Array(rawLines.length).fill(false);
  const hasDeath: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasPayload[i] = payloadRe.test(line);
    hasDeath[i] = deathRe.test(line);
    if (zh) {
      hasDying[i] = dyingRe.test(line) && !DYING_EXCLUDE_ZH.test(line);
    } else {
      hasDying[i] = dyingRe.test(line);
    }
  });

  /* 有效垂死语境：本场景头强锚，或同场景 ±3 行内有垂死叙述锚（不跨场景头） */
  const dyingActive: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    if (sceneDying[sceneOf[i]]) { dyingActive[i] = true; return; }
    for (let d = 0; d <= DYING_WINDOW; d += 1) {
      for (const j of [i - d, i + d]) {
        if (j < 0 || j >= rawLines.length) continue;
        if (sceneOf[j] !== sceneOf[i]) continue;
        if (hasDying[j]) { dyingActive[i] = true; return; }
      }
    }
  });

  /* pass2：情报行成组（相邻 ≤2 行合并、跨场景头不合并），须垂死语境 + 0..6 行内死亡封口 */
  interface Ev { start: number; end: number; anchorEnd: number; marker: string; }
  const groups: { start: number; end: number }[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasPayload[i]) return;
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

  const events: Ev[] = [];
  for (const g of groups) {
    /* 组内任一行处于有效垂死语境 */
    let contextOk = false;
    for (let j = g.start; j <= g.end; j += 1) {
      if (dyingActive[j]) { contextOk = true; break; }
    }
    if (!contextOk) continue;
    /* 情报之后 0..6 行（同场景）出现死亡锚：说完即死 */
    let deathLine = -1;
    for (let j = g.end; j <= Math.min(rawLines.length - 1, g.end + DEATH_LOOKAHEAD); j += 1) {
      if (sceneOf[j] !== sceneOf[g.end]) break;
      if (hasDeath[j]) { deathLine = j; break; }
    }
    if (deathLine < 0) continue; /* 垂死但没死（救活/好转）——不成立事件 */

    /* marker：窗口内最近的垂死锚 → 首条情报锚 */
    let dyingM = '';
    for (let d = 0; d <= DYING_WINDOW && !dyingM; d += 1) {
      for (const j of [g.start - d, g.start + d]) {
        if (j < 0 || j >= rawLines.length || sceneOf[j] !== sceneOf[g.start]) continue;
        const m = rawLines[j].match(dyingRe);
        if (m) { dyingM = m[0].replace(/^\s+/, '').slice(0, 14); break; }
      }
    }
    if (!dyingM) dyingM = sceneDying[sceneOf[g.start]] ? '垂死场景' : '垂死';
    const payloadM = (rawLines[g.start].match(payloadRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: deathLine,
      anchorEnd: g.start,
      marker: `${dyingM}→${payloadM}`.slice(0, 28),
    });
  }

  /* pass3：rescue 检测（残缺/求证代价/守口挣扎三路；窗口含事件自身，仅跳过场景头行） */
  const hits: DeathbedConfessionHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次临终坦白是类型片刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = fragmentRe.test(win) || costRe.test(win) || waitRe.test(win);
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是临终全招——垂死之人没有犹豫、不留半截、不谈条件，凶手全名、同伙、证据埋在哪一口气说完，说完手一松心电图拉直，死亡成了编剧的真相快递柜，主角的调查线被一句遗言彻底短路'
        : 'deathbed dump again - with no hesitation, no half-name and no bargain, the dying man hands over the killer, accomplices and where the evidence is buried in one fluent speech, then flatlines on cue; death has become the writer\'s free-truth drop box and the whole investigation is short-circuited by one deathbed speech',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"临终全招"（${n} 处未救）——人一倒在血泊里就口齿清晰，真凶全名、作案动机、证据地点、当年同伙一口气打包，说完准时咽气。第一次是情感高潮，第三次观众就发现：这个剧里谁死谁就是答案投放机，几十集的调查不如在病床前站五分钟。`
      : `${hitCount} deathbed-confession beats (${n} unrescued) - the moment someone lies in a pool of blood they speak in perfect paragraphs, delivering the killer's full name, the motive, the evidence location and the old accomplice in one speech, then die exactly on cue. Once is an emotional peak; by the third, the audience learns that every death is an answer-drop machine and fifty episodes of investigation are worth five minutes at a bedside.`);
    advice.push(zh
      ? '让真相的价格配得上死亡的重量：①遗言给线索不给答案——名字只吐出半个、话说到关键处声音断了、留下一个需要解释的信物（半张照片、一把没有锁的钥匙、一句听不懂的老话），死者把谜交出去，活人还得自己拼；②让情报不可直接消费——证据只是半本账、信缺了一页、密码只给前三位，"剩下的你要自己去查"，遗言把主角送上路而不是替他走到终点，且线索可能误导、需要被验证；③写出守口的惯性——这个秘密他守了三十年、答应过死人带进棺材、你追问过无数次他都摇头，松口本身要有犹豫、有交换（"照顾好我女儿我才说"）、有反复（说了又反悔、只认一半）；④真说全了，就让遗言接受质证——人没死成，后来要面对自己说出的话；或听者拿着遗言去查证时发现死者撒了谎、记混了、故意栽赃，死人也不是编剧的传声筒。最忌讳一集三回"血泊中握住手→流利报全名→手一松"。把唯一一次完整坦白留给全剧终局，且让它付出代价——完整真相的重量，应该压垮拿到它的人。'
      : 'Make the price of truth equal to the weight of the death. (1) Give a clue, not the answer - half a name, a voice that fails at the key word, a token that needs explaining (half a photo, a key with no lock, an old saying nobody understands); the dead hand over the riddle and the living must assemble it. (2) Make the intelligence unspendable - half a ledger, a missing page, only the first digits of the code, "the rest you have to find yourself"; the deathbed sends the protagonist on the road instead of walking it for him, and the lead may mislead and must be verified. (3) Write the inertia of silence - he kept it for thirty years, promised a dead man he would take it to the grave, refused every time you asked; the release itself carries hesitation, a bargain ("take care of my daughter first"), reversals - he recants, admits only half. (4) If he does say everything, put the confession under cross-examination - he survives and must face his own words, or verification shows the dead man lied, misremembered or planted blame; even a corpse is not the writer\'s mouthpiece. The unforgivable pattern is three "grab the hand in the blood -> recite the full name in fluent paragraphs -> hand goes limp" beats. Save the single complete confession for the finale, and make it cost something - a whole truth should break whoever receives it.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
