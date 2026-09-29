import { isSceneHeaderLine } from './script-scenes';
/**
 * 失声/复声剧情阀门 / 言语通道当开关检测（v2.110 块118，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的嗓子当成随取随用的剧情开关，两种形态反复
 *   出现——
 *   A 惊吓秒失声型：一夜家破人亡、目睹灭门、被灌一碗哑药、一场高烧、
 *     被掐过一次脖子，三行之内她"一个字都说不出来""再也没有开过
 *     口"；没有喉镜、没有声带麻痹或喉返神经损伤这样的器质诊断，
 *     失声是制造虐恋、苦情、身世悬念的即时枷锁——全家被害她偏说不
 *     出凶手，观众替她着急；
 *   B 廉价秒复声型：剧情需要认亲、喊冤、大团圆时，神医一根金针扎
 *     哑穴、孩子在火场哭喊一声"娘"、情急之下她猛地喊出"住手"，
 *     没有言语治疗、没有从气声到短句的康复、没有复声带回的创伤，
 *     金口一开字正腔圆；下一集她比谁都能说——嗓子是编剧的电灯
 *     开关：需要苦情时一拉全灭，需要圆满时一拉全亮。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里失声从来不是伤，
 *   是可以一键失声又一键复声的情节扳手，失声和复声双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - blindness-on-cue：视觉通道失与得；本引擎专管言语通道，眼与嗓
 *    两套词表正交；
 *  - wake-on-cue：昏迷苏醒阀门；"醒后失语"只是其渐变恢复的 rescue
 *    词——撞头→昏迷→醒来失语归 wake，本引擎遇昏迷/植物人窗口
 *    主动让路；
 *  - truth-serum/soft-interrogation/child-blurt/deathbed-confession：
 *    "免费真心话"家族，管"说什么"（内容被化学/权威/年幼/死亡免费
 *    拆封）；本引擎管"能不能说"（言语能力本身被开关）；
 *  - emotional-aftermath-check：其 CARRY 词表含"失声痛哭/泣不成声"，
 *    那是哭到出不了声的情绪节拍；本引擎弱档锚在 ±1 行遇哭泣/激动
 *    语境主动放行（感动得说不出话不是失声病）；
 *  - emotion-vent-cliche："喊哑嗓子/嘶吼到沙哑"是物理嘶哑，本引擎
 *    对嘶哑行整体豁免；
 *  - poison-on-cue：急性中毒夺命/秒解毒；"灌哑药/被毒哑"不夺命只
 *    夺声，属慢性遗留言语失能，归本引擎；
 *  - amnesia-on-cue：记忆通道，词表硬隔离（失忆≠失声）；
 *  - location-ledger STRANDED 词表的"瘫痪/动弹不得"是被困状态记账，
 *    与本引擎无关；全库 mute 命中均为 muted 静音比喻/武器哑火，
 *    无检测器覆盖失声-复声机制。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A onset（惊吓秒失声）：
 *    CAUSE 病因锚（惊吓/目睹凶案灭门/噩耗/大火 + 一场大病高烧烧坏
 *    嗓子 + 被毒哑灌哑药/勒掐脖子/撞伤喉咙 + 那天晚上以后/一夜
 *    之间 + shock/witnessed the murder/high fever/drugged mute/
 *    strangled/after that night…）±2行与 MUTE 失声锚共现；MUTE
 *    分两档——STRONG（哑了/失声/成了哑巴/一个字都说不出/再也没
 *    开口/嗓子彻底坏了 + went mute/lost her voice/struck mute/
 *    could no longer speak/never spoke again…）自带失声语义直配；
 *    WEAK（张了张嘴没声音/喉咙像被掐住/声音卡在嗓子里/说不出话
 *    + opened her mouth but no sound came/voice wouldn't come/
 *    throat closed up…）必须在事件 ±3 行窗口内另有 SPEECHCTX
 *    言语失能语境锚（失声/失语/声带/嗓音尽失/不能说话 + aphonia/
 *    vocal cords/lost her voice/unable to speak…），且弱档行 ±1
 *    行不得有哭泣/激动/愤怒/大笑等情绪语境，防"感动得说不出话"
 *    误判；嘶哑行（喊哑/沙哑/hoarse）整体豁免；纯受惊无失声放行，
 *    天生哑是人设不是秒失声阀门；
 *  - 型B cure（廉价秒复声）：
 *    TRIGGER 廉价解除锚（神医美名针灸金针扎哑穴/偏方灵药/奇迹 +
 *    情急之下/看到孩子出事/孩子哭喊爹娘/大哭一场 + famed doctor/
 *    acupuncture/miracle cure/in desperation/seeing her child in
 *    danger/cried all night…）±2行与 VOICE 整体秒复声锚共现；
 *    VOICE 必须是开口能力整体回归（声音回来了/能说话了/第一次
 *    终于开口/瞬间猛地喊出声 + voice returned/spoke for the first
 *    time/regained her voice/suddenly cried out…）；无触发物的
 *    缓慢好转（数月言语治疗后才渐渐发声）合法放行；
 *  - 相邻 ≤2 行的 CAUSE/TRIGGER 行各自合并为同一事件（跨场景头
 *    不合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CAUSE 器质/心理机制真兑付——功能性（癔症性）失声、
 *      转换障碍、声带麻痹/小结/水肿、喉返神经损伤、喉头水肿骨折、
 *      咽喉撕裂，打击与失声之间有医学因果；②DIAG 规范就医过程
 *      ——耳鼻喉科、喉镜、心理科精神科、言语治疗师介入、确诊为，
 *      失声不是现场宣布；③PRICE 永久长期代价——再也没开口、只能
 *      写字/手语交流、嗓音没回来、接受失声，阀门这次没被掰回去；
 *      "金针扎一下开口"不救 onset（它本身就是型B病象）；
 *    型B：①CPROCESS 康复渐进过程——言语治疗/嗓音训练、数月针灸
 *      理疗、心理创伤干预、从气声到短句渐渐开口，复声不是一针
 *      即字正腔圆；②PARTIAL 未完全恢复——只能耳语/气声、声音
 *      嘶哑、说久了喉咙疼、时好时坏、容易复发，电灯拉亮但电压
 *      不稳；③COST 代价——针灸数月/经年求治、倾家荡产、神医有
 *      条件、复声伴随创伤记忆真相一齐回来，开口有价格；
 *  - 第 1 次豁免（一次失声桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface MuteOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** onset=惊吓秒失声型；cure=廉价秒复声型 */
  kind: 'onset' | 'cure';
  /** 是否有医学机制/就医过程/永久代价/康复过程/部分恢复/求治代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface MuteOnCueResult {
  score: number;
  /** 失声阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: MuteOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：CAUSE 失声病因锚 ===== */
const CAUSE_ZH_RE = new RegExp(
  /吓(?:得|坏了|呆了|了一跳|傻了)|受(?:了)?(?:巨大)?惊吓|惊惧|惊骇/.source
  + '|' + /(?:亲眼|目睹)?[^。！？\n]{0,8}(?:灭门(?:惨案|之祸)?|满门(?:被)?抄斩|凶案(?:现场|一幕)?|杀人(?:现场|一幕)?)|目睹(?:了)?[^。！？\n]{0,10}(?:惨死|遇害|被害|被杀|被斩)|亲眼(?:看见|见着)[^。！？\n]{0,10}(?:死|杀|遇害|被害)/.source
  + '|' + /噩耗|(?:那场|一场)大火|火灾(?:中|里)?/.source
  + '|' + /一场大病|大病一场|高烧(?:不退)?|发高(?:烧|热)|重病(?:一场)?|烧坏(?:了)?(?:她的|他的|我的)?(?:嗓子|喉咙|声带)/.source
  + '|' + /(?:被|给|遭)(?:毒|药)哑|灌(?:了|她|他|我)?(?:一碗|一碗药)?哑药|哑药|毒坏(?:了)?(?:她的|他的|我的)?(?:嗓子|喉咙|声带)/.source
  + '|' + /(?:被)?(?:勒|掐)(?:住|伤|断|破)(?:了)?(?:她的|他的|我的)?(?:脖子|喉咙|嗓子)|(?:掐|勒)(?:她|他|我)?(?:的)?脖子|(?:撞|磕|顶)(?:伤|到|中)(?:了)?(?:她的|他的|我的)?(?:喉咙|嗓子)|割(?:伤|破)(?:了)?(?:她的|他的|我的)?(?:喉咙|嗓子)/.source
  + '|' + /那天晚上以后|从那(?:天|夜)(?:以后|起|开始)|一夜之间/,
);

const CAUSE_EN_RE = new RegExp(
  /\bshocked\b|\bfrightened\b|\bterrified\b|\bthe shock\b|\bin terror\b/.source
  + '|' + /\bwitnessed (?:the murder|the killing|a murder|a massacre|the slaughter|her family (?:being )?(?:killed|slaughtered|executed))\b|\bsaw (?:him|her|them) (?:killed|slaughtered|murdered|beheaded)\b/.source
  + '|' + /\bterrible news\b|\bthe devastating news\b|\bthe fire (?:took|killed|destroyed)\b|\bafter the fire\b|\bfollowing the fire\b/.source
  + '|' + /\bhigh fever\b|\bgrave illness\b|\bseverely ill\b|\bbrain fever\b|\bfever (?:burned|ruined|destroyed) (?:her|his) throat\b/.source
  + '|' + /\bdrugged (?:into silence|her mute|him mute|mute)\b|\bpoisoned (?:her mute|him mute|into silence|her voice|his voice)\b|\bmute-?poison\b|\bforced (?:her|him) to drink (?:the )?mute draught\b/.source
  + '|' + /\bstrangled(?: her| him)?\b|\bhands? around (?:her|his) throat\b|\bhand closed on (?:her|his) throat\b|\bthroat was crushed\b|\bblow to the throat\b|\bhit (?:her|him) in the throat\b|\bstruck (?:her|his) throat\b|\b(?:cut|slit) (?:her|his) throat\b/.source
  + '|' + /\bafter that night\b|\bfrom that night on\b|\bovernight\b|\bsince that night\b/,
  'i',
);

/* MUTE 强档：自带失声语义的结果锚（直配；"失声痛哭"豁免） */
const MUTE_STRONG_ZH_RE = /再也(?:说不|发不)(?:出)?(?:话|声音|声|一个字)|哑了|失声(?!痛哭)|成了?(?:个)?哑巴|变成哑巴|不会说话了|一个字(?:都|也)(?:说不出|发不出)|再也没(?:有)?(?:开口|说过话|出过声)|永远(?:性|久)?(?:失声|失语|哑巴)|永久(?:性)?(?:失声|失语)|说不出任何(?:话|声音)|发不出任何(?:一点)?声音|(?:嗓子|喉咙|嗓音)(?:彻底|完全|全)?(?:坏了|毁了|废了)|失音了?|哑了?嗓子/;

const MUTE_STRONG_EN_RE = /\bwent mute\b|\bbecame mute\b|\bstruck dumb\b|\bstruck mute\b|\bpermanently mute\b|\bmute forever\b|\blost (?:her|his|their) voice\b|\bvoice was gone\b|\brobbed of (?:her|his) voice\b|\brendered voiceless\b|\bcould no longer speak\b|\bcould not speak at all\b|\bcouldn'?t speak a word\b|\bnot a single word would come\b|\bnever spoke again\b|\bnever said another word\b|\blost the power of speech\b|\bunable to utter(?: even)? a sound\b|\bno sound would come\b|\bher speaking days were over\b/i;

/* MUTE 弱档：受惊后的口语卡壳反应（需 SPEECHCTX 言语失能语境兜底 + 无哭泣情绪语境） */
const MUTE_WEAK_ZH_RE = /张了?张(?:嘴|口|嘴唇)[^。！？\n]{0,10}(?:没(?:有|能)?(?:声|音|说)|发不出|说不出)|嘴(?:巴)?张(?:着|了张)[^。！？\n]{0,8}(?:没(?:有|能)?(?:声|音)|发不出|说不出)|喉咙(?:像)?(?:被|给)?(?:堵|掐|哽|卡)(?:住|得)[^。！？\n]{0,6}|(?:嗓子|喉咙)(?:发紧|堵得慌|哽住)|声音(?:像)?(?:卡|堵)(?:在|住)(?:了)?(?:喉咙|嗓子)|发不出(?:一点|一丝|任何)?(?:声|声音)|嘴唇(?:动了|哆嗦|颤|嗫嚅)[^。！？\n]{0,8}(?:没(?:有|能)?(?:声|音)|发不出|说不出)|说不出话/;

const MUTE_WEAK_EN_RE = /\bopened (?:her|his|their) mouth,? but no (?:sound|word) came\b|\bno sound came (?:out|forth)\b|\bvoice wouldn'?t come\b|\bwords wouldn'?t come\b|\bthroat (?:closed|tightened) up\b|\bthroat felt (?:blocked|sealed|sewn shut)\b|\bvoice (?:got |was )?caught in (?:her|his) throat\b|\bfound (?:herself|himself) unable to speak\b|\bunable to find (?:her|his) voice\b|\bcould only mouth (?:the )?words\b|\bmouthed silently\b|\blips moved but\b/i;

/* 言语失能语境锚：弱档反应需它兜底（须指向"能力丧失"，不收语塞义的 speechless） */
const SPEECHCTX_ZH_RE = /失声(?!痛哭)|失语|哑(?:巴|穴|药)|嗓音(?:尽失|全失|没了|消失)|嗓子(?:坏了|毁了|受伤)|喉咙(?:坏了|毁了|受伤|骨折)|声带(?:受损|麻痹|瘫痪|水肿|小结|息肉)?|喉返神经|不能说话|无法说话|说不了话|发不出声(?:音)?|没有(?:了)?声音|再没开口|言语(?:功能)?(?:丧失|障碍)|失音|变哑/;

const SPEECHCTX_EN_RE = /\bvoiceless(?:ness)?\b|\bmutism\b|\baphonia\b|\bvocally paralyzed\b|\bvocal cords?\b|\blaryngeal\b|\bthroat injury\b|\bvoice loss\b|\blost (?:her|his) voice\b|\bunable to speak\b|\bcould not speak\b|\bcouldn'?t speak\b|\bno sound came\b|\bpower of speech\b|\bstruck mute\b/i;

/* 情绪性语塞豁免：弱档行 ±1 行出现哭/激动/愤怒/大笑等，"说不出话"是情绪不是失声病 */
const CRY_ZH_RE = /哭|泣|泪|哽咽|嚎啕|抽泣|啜泣|激动|感动|难过|伤心|委屈|大?笑(?:着|出|声)?|开心|气(?:得|坏)|愤怒/;

const CRY_EN_RE = /\bcry(?:ing|ied)?\b|\btear(?:s|ful)?\b|\bsob(?:bing|bed)?\b|\bchoked up\b|\bemotional\b|\bmoved\b|\btouched\b|\blaugh(?:ed|ing|ter)?\b|\boverjoyed\b|\bjoy\b|\bang(?:er|ry)\b|\bfurious\b/i;

/* 物理嘶哑豁免：喊哑/唱哑/沙哑/hoarse 是用嗓过度或伤病尾音，整行不作失声锚 */
const HOARSE_ZH_RE = /(?:喊|吼|叫|唱|哭)[^。！？\n]{0,8}哑|(?:嗓子|喉咙|声音|嗓音)[^。！？\n]{0,6}(?:哑|嘶哑|沙哑)|(?:沙|嘶)哑(?:了|的|地)?/;

const HOARSE_EN_RE = /\bhoarse\b|\bhusky voice\b|\braw throat\b|\bvoice cracked\b|\b(?:shouted|yelled|screamed|cried|sang) (?:herself|himself) hoarse\b|\bragged until (?:he|she) was hoarse\b/i;

/* 昏迷苏醒让路：撞头→昏迷→醒来失语归 wake-on-cue，事件窗口内有昏迷锚则跳过 */
const WAKEGUARD_ZH_RE = /昏迷|植物人|不省人事|昏睡(?:了)?(?:好?几|数|\d+)(?:天|日)|从昏迷中(?:醒|苏醒)/;

const WAKEGUARD_EN_RE = /\bcoma\b|\bcomatose\b|\bunconscious for\b|\bwoke from (?:the|a) coma\b|\blay unconscious\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /神医|名医|世外高人|活神仙|国手/.source
  + '|' + /针灸(?:大师|神医|高手)?|金针(?:扎|刺)?|扎(?:了)?(?:一根|几针)?金针|(?:金)?针(?:扎|刺)(?:在|向|了)?(?:她|他)?(?:的)?(?:喉咙|脖子|哑穴|穴位)|哑穴|银针/.source
  + '|' + /偏方|特效药|仙丹|灵药|神药|奇药|灵丹(?:妙药)?/.source
  + '|' + /奇(?:迹|迹般)(?:康复|痊愈|治好|恢复|开口)?/.source
  + '|' + /情急(?:之?下)?|一急(?:之?下)?|心(?:头|里)一急|猛地一急|情急生智/.source
  + '|' + /看到?[^。！？\n]{0,10}(?:孩子|女儿|儿子)?[^。！？\n]{0,8}(?:出事|危险|摔倒|坠楼|坠崖|被车|被打|落水|着火|被抢)|(?:孩子|女儿|儿子)[^。！？\n]{0,12}(?:哭(?:喊|着)?|叫(?:喊)?|喊|扑)[^。！？\n]{0,4}(?:妈|娘|爹)/.source
  + '|' + /大哭(?:一场|一夜|几天)/,
);

const TRIGGER_EN_RE = new RegExp(
  /\b(?:renowned|famed|famous|miracle-?working|legendary) doctor\b|\bmaster (?:of|healer of) acupuncture\b|\bmiracle healer\b/.source
  + '|' + /\bacupuncture\b|\bacupuncture needles?\b|\bneedle(?:s)? (?:in|into|at) (?:her|his) (?:throat|neck)|golden needle\b|\bsilver needle\b|\bthe mute point\b/.source
  + '|' + /\bherbal (?:remedy|cure|medicine|pill|elixir)\b|\bmiracle (?:cure|drug|medicine|pill)\b|\bmagic pill\b|\belixir\b/.source
  + '|' + /\bmiraculously(?: cured| healed| recovered)?\b/.source
  + '|' + /\bin (?:a moment of |sheer )?desperation\b|\bin a panic\b|\bdesperate, (?:she|he) (?:screamed|shouted|cried)\b/.source
  + '|' + /\bseeing (?:her|his) (?:child|daughter|son|baby) in danger\b|\b(?:child|daughter|son|baby) (?:was )?(?:about to fall|falling|in danger|hit by|drowning|trapped in the fire)\b|\b(?:child|daughter|son) cried out[^.?!\n]{0,16}?(?:mom|mama|mommy|mother)\b/.source
  + '|' + /\bcried all night\b|\bweeks of tears\b/,
  'i',
);

/* VOICE 整体秒复声锚（须与 TRIGGER 配对；渐进好转不收） */
const VOICE_ZH_RE = new RegExp(
  /(?:声音|嗓音|嗓子)(?:回来|回来了|恢复|恢复了)|恢复(?:了)?(?:说话|声音|嗓音|言语)|又能说话|能说话了|可以说话了|重新说话/.source
  + '|' + /(?:第一次|终于|重新|再度|竟又|竟能)[^。！？\n]{0,4}(?:开口|出声|说话|喊|叫)/.source
  + '|' + /(?:猛地|突然|忽然|骤然|一下子|当场|立刻|马上|竟然|居然|脱口而?出|情不自禁)[^。！？\n]{0,8}(?:喊(?:出|了)?(?:声|一声)?|叫(?:出|了)?(?:声|一声)?|开口|出声|嘶吼?)/.source
  + '|' + /(?:开口|张嘴)[^。！？\n]{0,4}(?:喊道|叫道|喊出|说出了)/,
);

const VOICE_EN_RE = new RegExp(
  /\b(?:her|his|their) voice returned\b|\bvoice came back\b|\bregained (?:her|his|their) voice\b|\bcould speak again\b|\bpower of speech returned\b|\bvoice was restored\b/.source
  + '|' + /\bspoke for the first time\b|\bfirst word in\b|\bfirst spoke\b|\bfound (?:her|his) voice again\b|\bfinally (?:spoke|opened (?:her|his) mouth|found (?:her|his) voice|said|called out)\b|\bfinally,? (?:she|he|they) (?:spoke|said|called out|cried out)\b/.source
  + '|' + /(?:suddenly|instantly|at once|right away|miraculously|the moment|desperately|instinctively|against her will)[^.?!\n]{0,22}?(?:cried out|called out|shouted|spoke|her voice burst|her voice came)/.source
  + '|' + /\bblurted out\b[^.?!\n]{0,12}?(?:first time|for the first time)/i,
  'i',
);

/* ===== 型A rescue：CAUSE 器质/心理机制真兑付（失声有医学因果） ===== */
const R_CAUSE_ZH_RE = /功能性(?:失声|失语)|癔症(?:性)?(?:失声|失语|缄默)|转换(?:性)?(?:障碍|癔症)[^。！？\n]{0,8}(?:失声|失语|缄默)|心因性(?:失声|失语|缄默)|声带(?:麻痹|瘫痪|受损|损伤|水肿|充血|小结|息肉|撕裂)|喉返神经(?:损伤|受伤|麻痹|受压)|喉头(?:水肿|骨折|损伤)|咽喉(?:撕裂|损伤|外伤|黏膜)|喉部(?:软骨)?(?:骨折|挫伤)|器质(?:性)?(?:损伤|病变|病因)/;

const R_CAUSE_EN_RE = /\bfunctional aphonia\b|\bhysterical (?:mutism|aphonia)\b|\bconversion (?:disorder|aphonia|mutism)\b|\bpsychogenic (?:aphonia|mutism)\b|\bdissociative (?:mutism|symptoms)\b|\bvocal cord (?:palsy|paralysis|damage|injury|nodules|polyps|edema|hemorrhage|tear)\b|\brecurrent laryngeal nerve (?:damage|injury|palsy)\b|\blaryngeal edema\b|\bcollapsed larynx\b|\bthroat injury\b|\blaryngeal fracture\b|\btorn throat lining\b|\borganic cause\b/i;

/* 型A rescue：DIAG 规范就医过程（失声不是现场宣布） */
const R_DIAG_ZH_RE = /耳鼻喉(?:科|医院|医生|专科)|喉镜(?:检查)?|耳鼻喉会诊|心理(?:科|医生|咨询|干预)|精神(?:科|卫生中心)|言语(?:治疗师|康复师|矫治)|做了?[^。！？\n]{0,8}(?:喉镜|检查)|住院(?:观察|检查)|检查报告|诊断书|确诊(?:为|是)|观察了?[^。！？\n]{0,4}天/;

const R_DIAG_EN_RE = /\bENT\b|\bent specialist\b|\bENT doctor\b|\bENT consult\b|\blaryngoscopy\b|\bpsychiatrist\b|\bpsychologist\b|\bpsychiatric (?:ward|evaluat\w+)\b|\bspeech therapist\b|\bspeech-?language pathologist\b|\bslp\b|\bdiagnosed with\b|\badmitted for (?:observation|tests)\b|\bseries of (?:throat )?exams\b/i;

/* 型A rescue：PRICE 永久/长期代价（阀门没被掰回去；只收真实生活代价/适应方式，
   裸的"再也没开口/终身失声/永久性失声"只是复述失声结果，与 MUTE_STRONG 重叠，不得自救） */
const R_PRICE_ZH_RE = /只能(?:靠)?(?:写字|纸笔|手语|打字|手写板)(?:交流|沟通)?|学(?:习)?(?:了)?手语|用(?:手势|写字板|本子|纸笔)(?:交流|沟通)?|嗓音(?:再也|始终)没(?:有)?(?:回来|恢复)|接受(?:了)?(?:自己)?(?:终身)?失声|(?:靠|拿)(?:纸笔|本子)说话/;

const R_PRICE_EN_RE = /\bcommunicated (?:by|through) (?:writing|notes)\b|\bwrote notes instead\b|\bnotepad (?:to communicate|in hand)\b|\bsign language\b|\blearned (?:to )?sign\b|\baccepted (?:her|his|the) muteness\b|\bvoice never returned\b|\bgestured instead of speaking\b/i;

/* ===== 型B rescue：CPROCESS 康复渐进过程（一针下去不该字正腔圆） ===== */
const R_CPROCESS_ZH_RE = /言语(?:治疗|康复|训练|矫治)|嗓音(?:训练|治疗)|发声(?:训练|练习)|言语功能训练|(?:心理|创伤)(?:治疗|干预|辅导)|针灸(?:治|扎|调理)(?:了|持续)?(?:好?几|数|\d+)(?:个?月|周|年)|(?:好?几|数|\d+)(?:个?月|周|年)[^。！？\n]{0,8}(?:才|渐渐|逐渐|慢慢)(?:开口|说话|出声|恢复|发声)|(?:先|起初)(?:是|只能)[^。！？\n]{0,6}(?:气声|耳语|单音)|渐渐(?:能|会|敢)(?:开口|说话|出声)|慢慢(?:练|恢复|发声)|一天比一天(?:好|清楚|大声)|先(?:是)?(?:气声|耳语|单音)/;

const R_CPROCESS_EN_RE = /\bspeech therapy\b|\bspeech-?language therapy\b|\bvoice therapy\b|\bvocal (?:rehab|exercises|training)\b|\bspeech-?language pathologist\b|\btrauma therapy\b|\bpsychological (?:treatment|therapy)\b|\bmonths? of (?:therapy|treatment|acupuncture|rehab)\b|\bweeks? of (?:therapy|treatment|acupuncture)\b|\byears? of (?:treatment|acupuncture)\b|\bgradually regained (?:her|his) voice\b|\bslowly recovered (?:her|his) voice\b|\bstarted with (?:a whisper|single sounds)\b|\bday by day (?:her|his) voice\b|\blittle by little\b/i;

/* 型B rescue：PARTIAL 未完全恢复（电灯拉亮但电压不稳） */
const R_PARTIAL_ZH_RE = /只能(?:发出)?(?:气声|耳语|嘶哑的?声音)|只能耳语|声音(?:还是|依旧|仍然)(?:嘶哑|沙哑|发紧)|(?:说|讲)(?:话)?久了?(?:嗓子|喉咙)(?:就|会|疼|痛|发紧)|时好时坏|断断续续|说(?:不|没)?两句(?:就|便)|容易(?:再次)?失声|可能(?:再次|还会)(?:失声|复发|哑)|没(?:有)?完全(?:恢复|好)|音量(?:很小|低)|要靠很近才听得见/;

const R_PARTIAL_EN_RE = /\bonly a whisper\b|\bbarely a whisper\b|\bhoarse\b|\bhoarseness\b|\bstrained voice\b|\bthroat hurt when she spoke\b|\bcomes and goes\b|\bintermittent(?:ly)?\b|\bcouldn'?t speak for long\b|\bmight lose her voice again\b|\bnever fully recovered\b|\bpartial recovery\b|\bvoice faded\b|\bso quiet they had to lean in\b/i;

/* 型B rescue：COST 求治代价（开口有价格） */
const R_COST_ZH_RE = /针灸(?:扎|花|治)(?:了|持续)?(?:好?几|数|\d+)(?:个?月|年)|(?:好?几|数|\d+)(?:个?月|年)[^。！？\n]{0,6}(?:针灸|求医|治疗)|(?:神医|名医)[^。！？\n]{0,12}(?:代价|条件|规矩|不收留|难请|不肯治)|倾家荡产|医药费(?:高昂)?|砸锅卖铁|借遍|负债|(?:复声|开口|说话|声音回来)[^。！？\n]{0,14}(?:伴随|带着|换来|勾起)[^。！？\n]{0,14}(?:剧痛|创伤|记忆|真相|往事)|(?:记忆|往事|创伤)(?:全|一起|一齐)?回来/;

const R_COST_EN_RE = /\bmonths? of acupuncture\b|\byears? of (?:acupuncture|seeking treatment|treatment)\b|\bcost a fortune\b|\bmedical bills\b|\bdrained (?:their|the|her|his) savings\b|\bprice of the cure\b|\bdoctor (?:refused|set a price|was hard to find|would only treat her if)\b|\bvoice came back with (?:the trauma|the memories|the truth)\b|\bmemories flooded back (?:when|as) she spoke\b|\bpainful to speak\b|\btrauma returned with her voice\b/i;

const PAIR_PAD = 2;
const CONTEXT_PAD = 3;
const RESCUE_PAD = 2;

interface Ev {
  start: number;
  end: number;
  anchorEnd: number;
  kind: 'onset' | 'cure';
  marker: string;
}

/**
 * 纯函数：检测"失声/复声剧情阀门/言语通道当开关"密度病。
 */
export function muteOnCue(draft: string): MuteOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const causeRe = zh ? CAUSE_ZH_RE : CAUSE_EN_RE;
  const muteStrongRe = zh ? MUTE_STRONG_ZH_RE : MUTE_STRONG_EN_RE;
  const muteWeakRe = zh ? MUTE_WEAK_ZH_RE : MUTE_WEAK_EN_RE;
  const speechCtxRe = zh ? SPEECHCTX_ZH_RE : SPEECHCTX_EN_RE;
  const cryRe = zh ? CRY_ZH_RE : CRY_EN_RE;
  const hoarseRe = zh ? HOARSE_ZH_RE : HOARSE_EN_RE;
  const wakeGuardRe = zh ? WAKEGUARD_ZH_RE : WAKEGUARD_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const voiceRe = zh ? VOICE_ZH_RE : VOICE_EN_RE;
  const rCauseRe = zh ? R_CAUSE_ZH_RE : R_CAUSE_EN_RE;
  const rDiagRe = zh ? R_DIAG_ZH_RE : R_DIAG_EN_RE;
  const rPriceRe = zh ? R_PRICE_ZH_RE : R_PRICE_EN_RE;
  const rCprocessRe = zh ? R_CPROCESS_ZH_RE : R_CPROCESS_EN_RE;
  const rPartialRe = zh ? R_PARTIAL_ZH_RE : R_PARTIAL_EN_RE;
  const rCostRe = zh ? R_COST_ZH_RE : R_COST_EN_RE;

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

  /* pass1：逐行标记（场景头行不参与匹配；嘶哑行豁免失声锚） */
  const hasCause: boolean[] = new Array(rawLines.length).fill(false);
  const hasMuteStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasMuteWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasSpeechCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasVoice: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasCause[i] = causeRe.test(line);
    const hoarse = hoarseRe.test(line); /* 喊哑/沙哑：物理嘶哑不作失声锚 */
    hasMuteStrong[i] = !hoarse && muteStrongRe.test(line);
    hasMuteWeak[i] = !hoarse && muteWeakRe.test(line);
    hasSpeechCtx[i] = speechCtxRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasVoice[i] = voiceRe.test(line);
  });

  /** 锚行成组：相邻 ≤2 行合并，跨场景头不合并（between 切片） */
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

  /** ±1 行情绪语塞检查（哭泣/激动/愤怒/大笑同行近邻——弱档失声锚放行） */
  const emotionalNearby = (muteLine: number, baseScene: number): boolean => {
    const lo = Math.max(0, muteLine - 1);
    const hi = Math.min(rawLines.length - 1, muteLine + 1);
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== baseScene) continue;
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (cryRe.test(rawLines[j])) return true;
    }
    return false;
  };

  /** 昏迷苏醒让路（事件窗口内有昏迷/植物人锚——撞头醒来失语归 wake-on-cue） */
  const comaInWindow = (start: number, end: number, baseScene: number): boolean => {
    const lo = Math.max(0, start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, end + RESCUE_PAD);
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== baseScene) continue;
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (wakeGuardRe.test(rawLines[j])) return true;
    }
    return false;
  };

  const events: Ev[] = [];

  /* 型A：CAUSE 组 ±2 行找 MUTE（强档直配；弱档需 ±3 行 SPEECHCTX 且无情绪语境） */
  for (const g of groupRows(hasCause)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let muteLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasMuteStrong[j]) { muteLine = j; strongHit = true; break; }
      if (muteLine < 0 && hasMuteWeak[j]) muteLine = j;
    }
    if (muteLine < 0) continue; /* 受惊受害但没有失声：普通创伤反应放行 */
    if (comaInWindow(Math.min(g.start, muteLine), Math.max(g.end, muteLine), sceneOf[g.start])) continue;
    let ctxOk = strongHit;
    if (!ctxOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, muteLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasSpeechCtx[j] || hasMuteStrong[j]) { ctxOk = true; break; }
      }
    }
    if (!ctxOk) continue; /* 无言语失能语境：一时语塞/哽咽不归本引擎 */
    if (!strongHit && emotionalNearby(muteLine, sceneOf[g.start])) continue; /* 哭/激动到说不出话：情绪节拍放行 */

    const causeM = (rawLines[g.start].match(causeRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const muteM = (rawLines[muteLine].match(strongHit ? muteStrongRe : muteWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, muteLine),
      anchorEnd: muteLine,
      kind: 'onset',
      marker: `${causeM}→${muteM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 VOICE（必须整体秒复声） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let voiceLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasVoice[j]) { voiceLine = j; break; }
    }
    if (voiceLine < 0) continue; /* 有求医/情急但没有当场复声：仍在治疗中放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const voiceM = (rawLines[voiceLine].match(voiceRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, voiceLine),
      anchorEnd: voiceLine,
      kind: 'cure',
      marker: `${trigM}→${voiceM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: MuteOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次失声桥段是类型刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = ev.kind === 'onset'
      ? (rCauseRe.test(win) || rDiagRe.test(win) || rPriceRe.test(win))
      : (rCprocessRe.test(win) || rPartialRe.test(win) || rCostRe.test(win));
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      kind: ev.kind,
      rescued,
      reason: ev.kind === 'onset'
        ? (zh
          ? '又是惊吓秒失声——一夜家破人亡、目睹灭门、一碗哑药、一场高烧、被掐一次脖子，三行之内她一个字都说不出来、再也没有开口；没有喉镜、没有声带麻痹或癔症性失声这样的诊断，失声是制造苦情、扣押真相、逼人照顾的即时枷锁，"金针扎一下开口"救不了这段（它本身就是廉价秒复声的病象）'
          : 'another shock-to-muteness beat - a family slaughtered overnight, a bowl of mute-draught, a high fever, one hand on her throat, and within three lines she cannot utter a single word and never speaks again; no laryngoscopy, no diagnosis of vocal-cord palsy or hysterical aphonia; muteness is an instant padlock used to manufacture suffering, impound the truth and force a bedside vigil, and "one golden needle and she spoke" does not rescue this beat (that is the cheap-cure disease itself)')
        : (zh
          ? '又是廉价秒复声——神医一根金针扎向哑穴、偏方灵药、孩子火场哭喊一声娘、情急之下她猛地喊出住手，没有言语治疗、没有从气声到短句的康复、没有复声带回的创伤，金口一开字正腔圆；下一集她比谁都能说，嗓子是编剧的电灯开关：需要苦情时一拉全灭，需要圆满时一拉全亮'
          : 'another cheap instant-cure beat - a famed doctor drives a golden needle into the mute point, a miracle herbal pill, a child cries "Mama" in the fire, and in desperation she suddenly shouts - no speech therapy, no recovery from whisper to sentence, no trauma carried back with the voice; the first words out are perfectly clear, and next episode she talks more than anyone; the voice is the writer\'s light switch: total silence when suffering is needed, full volume when a happy ending is due'),
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    const onsetCount = events.filter((e) => e.kind === 'onset').length;
    const cureCount = events.filter((e) => e.kind === 'cure').length;
    issues.push(zh
      ? `${hitCount} 处"失声/复声剧情阀门"（惊吓秒失声 ${onsetCount} 处、廉价秒复声 ${cureCount} 处，${n} 处未救）——言语通道成了随取随用的电灯开关：需要苦情时一场惊吓三行内再也开不了口，不要喉镜和器质/心理诊断；需要圆满时神医金针/孩子哭喊/情急一喊当场复声，不要言语治疗和康复。第一次是类型桥段，第三次观众就看穿：这个剧里失声从来不是伤，是可以一键失声又一键复声的扳手；而每回失声都不给就医过程、每回复声都不留尾巴，失声和复声双双贬值。`
      : `${hitCount} mute-on-cue beat(s) (${onsetCount} instant muteness, ${cureCount} instant cure; ${n} unrescued) - the voice is a light switch: when suffering is needed a night of terror or one hand on the throat means she never speaks again in three lines, with no laryngoscopy and no organic or psychiatric diagnosis; when relief is needed a famed doctor's needle, a child's cry or a desperate shout restores flawless speech instantly, with no speech therapy and no rehab. Once is genre grammar; by the third, the audience sees muteness is never an injury in this story, only a wrench that silences and restores on command - and when every muting skips the medicine and every cure skips the tail, both the silence and the recovery lose their value.`);
    advice.push(zh
      ? '让失声恢复它应有的重量与麻烦。惊吓秒失声型：①让机制真兑付——功能性/癔症性失声、转换障碍、声带麻痹或小结水肿、喉返神经损伤、喉头水肿、咽喉撕裂，打击和失声之间要有医学因果，医生嘴里要有具体的诊断而不是一句"再也说不出话"；②让就医有过程——耳鼻喉科、喉镜检查、心理科精神科介入、言语治疗师评估、住院观察、数天后才确诊，失声不能在凶案现场一句话宣判；③要么让代价真留下——终身再没开口、只能靠纸笔和手语交流、学手语、嗓音始终没回来、接受失声，这次没有金针反转，苦情戏才值钱；记住"扎一针开口"不救失声戏，它本身就是秒复声的病象。廉价秒复声型：④让复声有康复过程——言语治疗、嗓音训练、数月针灸理疗、心理创伤干预、先是气声和单字、渐渐才连成句子，一针下去不该是字正腔圆出厂设置；⑤给电灯留电压不稳的尾巴——只能耳语气声、声音依旧沙哑、说久了喉咙疼、时好时坏、容易再次失声，下一场戏要有话说半句就咳、要凑很近才听得见的笨拙；⑥如果必须复声，让它带着价格——经年累月求医针灸、倾家荡产的医药费、神医的条件与拒绝、更狠的是开口那一刻被掐灭多年的创伤记忆真相一齐涌回来，重获声音不该是免费的圆满。最忌讳一集两回"惊吓一场→再也不会说话→神医扎针→孩子一哭当场喊娘→认亲打脸"。嗓子若要拉闸，就得真的改变生活；若要合闸，也不能白合闸。'
      : 'Give the lost voice its real weight and its real hassle. For instant-muteness beats: (1) let the mechanism in - functional or hysterical aphonia, conversion disorder, vocal-cord palsy/nodules/edema, a damaged recurrent laryngeal nerve, laryngeal swelling, a torn throat lining; there must be a medical cause between the blow and the silence, and the doctor must name a diagnosis instead of just declaring "she will never speak again". (2) Let the medicine take a process - ENT consults, a laryngoscopy, a psychiatrist or psychologist, a speech-language evaluation, admission and observation, a diagnosis days later; muteness cannot be announced in one line at the murder scene. (3) Or let the cost remain - she never speaks again, she communicates only by notes and sign language, she learns to sign, the voice never returns, she accepts the silence; when no golden-needle reversal arrives, the suffering finally costs something; remember "one needle and she spoke" never rescues a muting beat, because that is the instant-cure disease itself. For cheap-cure beats: (4) give the recovery a rehab process - speech therapy, voice training, months of acupuncture, trauma treatment, first only a whisper and single syllables, then gradually full sentences; a needle must not restore factory-set diction. (5) Leave the light switch a faulty tail - only a whisper, a voice still hoarse, a throat that aches after two sentences, good days and bad days, the risk of losing the voice again; the next scene needs a sentence cut off by coughing and listeners leaning in. (6) If the voice must return, make it cost something - years of doctors and acupuncture, bills that bankrupt the family, the healer\'s price or refusal, and hardest of all, the moment she speaks the trauma, memories and truth she was silenced by come flooding back; regaining a voice must not be a free happy ending. The unforgivable pattern is two "one night of terror -> never speaks again -> famed doctor\'s needle -> child cries, she instantly calls out -> recognition and revenge" loops per episode. If the voice goes off, a life must genuinely change; if it comes back on, it must not be for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
