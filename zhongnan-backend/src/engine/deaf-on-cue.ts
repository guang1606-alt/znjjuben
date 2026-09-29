import { isSceneHeaderLine } from './script-scenes';
/**
 * 耳聋/复聪剧情阀门 / 听觉通道当开关检测（v2.111 块119，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的耳朵当成随取随用的剧情开关，两种形态反复
 *   出现——
 *   A 爆震秒耳聋型：火场里一次爆炸、战场上炮弹在耳边炸响、猎枪走火、
 *     一记耳光扇在头上、一场高烧、几针链霉素，三行之内她"什么都听
 *     不见了""再也听不到任何声音"；没有鼓膜穿孔、没有耳蜗毛细胞
 *     损伤、没有听神经诊断，耳聋是制造苦情、阻隔求救、扣押真相的
 *     即时枷锁——门外真凶自报家门她偏听不见，观众替她着急；
 *   B 廉价秒复聪型：剧情需要认亲、喊冤、大团圆时，神医一根银针扎
 *     向耳穴、偏方灵药、在脑后拍一巴掌、头再撞一下、人工耳蜗刚开
 *     机，她当场听见每一个字甚至音乐；没有听力测试、没有语训调机、
 *     没有耳蜗只给电声的适应期，复聪是出厂设置级别的字正腔圆；下
 *     一集她隔八丈远都能听见悄悄话——耳朵是编剧的电灯开关：需要
 *     苦情时一拉全灭，需要圆满时一拉全亮。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里耳聋从来不是伤，
 *   是可以一键耳聋又一键复聪的情节扳手，耳聋和复聪双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - blindness-on-cue：视觉通道失与得（v2.108，已退出 deai 加权，
 *    检测器保留）；本引擎专管听觉通道，眼与耳两套词表正交；
 *  - mute-on-cue：言语通道失与得（v2.110）；"聋哑/deaf-mute"是
 *    固定同族（通信通道的收发两端），但本引擎管"能不能听见"，
 *    mute 管"能不能说出"，词表硬隔离；
 *  - amnesia-on-cue：记忆通道；撞头→失忆归 amnesia，撞头→耳聋
 *    归本引擎，失忆/失聪词表互不重叠；
 *  - wake-on-cue：昏迷苏醒阀门；撞头→昏迷→醒来听不见归 wake，
 *    本引擎遇昏迷/植物人窗口主动让路；
 *  - comm-fail-crutch：通讯渠道故障（没信号/占线/电话听不清）；
 *    弱档锚（听不清/嗡嗡）在 ±1 行电话语境下整体放行；
 *  - emotion-vent-cliche："audience is deaf to it"是比喻义，与
 *    本引擎无关；全库 deaf 命中均为比喻，无检测器覆盖耳聋-复聪
 *    机制；
 *  - poison-on-cue：急性中毒夺命/秒解毒；"链霉素/庆大霉素致聋"
 *    不夺命只夺听，属慢性遗留听觉失能，归本引擎；
 *  - location-ledger STRANDED 的"paralyzed"是被困状态记账，与本
 *    引擎无关。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A onset（爆震秒耳聋）：
 *    CAUSE 病因锚（爆炸/炮弹耳边炸响/猎枪走火/一声巨响/耳光扇头/
 *    摔撞头部/高烧/耳毒性药物/灌药毁耳/那天晚上以后 + explosion/
 *    blast/gun went off next to her ear/slapped across the ear/
 *    blow to the head/high fever/ototoxic drugs/after that night…）
 *    ±2行与 DEAF 耳聋锚共现；DEAF 分两档——STRONG（聋了/失聪/
 *    双耳失聪/成了聋子/再也听不见/听力全失 + went deaf/lost her
 *    hearing/could no longer hear/stone-deaf…）自带耳聋语义直配；
 *    WEAK（听不清/耳朵嗡嗡/耳鸣/像塞了棉花/声音隔一层 + ringing
 *    in her ears/muffled/cotton in her ears…）必须在事件 ±3 行
 *    窗口内另有 HEARCTX 听力损伤语境锚（耳聋/失聪/听力下降/耳膜
 *    穿孔/耳蜗/听神经 + deafness/hearing loss/perforated eardrum/
 *    cochlea/auditory nerve…），裸耳鸣（爆后嗡嗡三天）是真实短
 *    暂症状不归本引擎；弱档行 ±1 行有电话/手机/信号语境归
 *    comm-fail-crutch；FEIGN 装聋/充耳不闻/听不进去/装作没听见
 *    是选择性不听，整体跳过；
 *  - 型B cure（廉价秒复聪）：
 *    TRIGGER 廉价解除锚（神医美名针灸银针扎耳穴/偏方灵药/奇迹 +
 *    脑后拍一巴掌/头又撞一下 + 人工耳蜗开机激活 + 情急 + famed
 *    doctor/acupuncture behind the ear/herbal elixir/cochlear
 *    implant activated/hit her head again…）±2行与 HEAR 整体秒
 *    复聪锚共现；HEAR 必须是听力整体回归（听力回来/恢复听力/
 *    重新听见/第一次听见/当场听见 + hearing returned/could hear
 *    again/heard for the first time/suddenly she could hear…）；
 *    人工耳蜗是真医疗器械，但"开机当场字正腔圆听见妈妈"才是病，
 *    调机/语训/电声适应在 rescue 里；无触发物的缓慢好转合法放行；
 *  - 相邻 ≤2 行的 CAUSE/TRIGGER 行各自合并为同一事件（跨场景头
 *    不合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CAUSE 器质机制真兑付——鼓膜/耳膜穿孔破裂、听骨链断
 *      裂、耳蜗毛细胞受损坏死、听神经损伤、爆震性/噪声性耳聋、
 *      耳毒性药物（链霉素/庆大霉素）、突发性感音神经性耳聋、颞
 *      骨骨折，打击与耳聋之间有医学因果；②DIAG 规范就医过程——
 *      耳鼻喉科、听力测试、纯音测听、声导抗、脑干诱发电位、听
 *      力师评估、确诊，耳聋不是现场宣布；③PRICE 永久长期代价——
 *      只能靠手语/唇语/写字交流、聋校、助听器也没用、接受失聪，
 *      阀门这次没被掰回去；"扎一针听见"不救 onset（它本身就是
 *      型B病象）；
 *    型B：①CPROCESS 康复渐进过程——听力训练、听觉口语法、语训、
 *      耳蜗多次调机、数月康复、先是电流嗡嗡声再学着分辨人声，开
 *      机不该是当场 hi-fi；②PARTIAL 未完全恢复——只听得见巨响、
 *      依旧耳鸣、嘈杂环境听不清、要凑近喊才行、时好时坏、可能
 *      彻底失聪、耳蜗只给电子声，电灯拉亮但电压不稳；③COST 代
 *      价——经年求医、倾家荡产、耳蜗天价、手术风险、神医有条
 *      件，复聪有价格；
 *  - 第 1 次豁免（一次耳聋桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DeafOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** onset=爆震秒耳聋型；cure=廉价秒复聪型 */
  kind: 'onset' | 'cure';
  /** 是否有医学机制/就医过程/永久代价/康复过程/部分恢复/求治代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface DeafOnCueResult {
  score: number;
  /** 耳聋阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: DeafOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：CAUSE 耳聋病因锚 ===== */
const CAUSE_ZH_RE = new RegExp(
  /爆炸|炸药|雷管|炸(?:药|点|开|响)|煤气(?:罐|罐爆炸|爆炸)?|炮(?:弹|火|声)|地雷|手雷|枪响(?:在|贴着)?(?:她|他|我)?(?:的)?耳边?|(?:耳边?|耳旁|耳根)[^。！？\n]{0,6}(?:炸响|爆炸|枪响|响起)|烟花(?:在)?(?:耳边?)?炸|一(?:声|阵)(?:巨响|爆响|轰鸣)|震耳欲聋/.source
  + '|' + /一(?:记|巴)耳光|耳光(?:扇|打|抽)(?:在|向|到)?(?:她|他|我)?(?:的)?(?:耳边?|脸上?)|(?:扇|抽)(?:了)?(?:她|他|我)?(?:一巴?掌|一耳光)/.source
  + '|' + /摔(?:下?楼|倒|落)[^。！？\n]{0,6}(?:撞|磕|碰)(?:到|伤|在)?(?:了)?(?:她|他|我)?(?:的)?(?:脑)?头|(?:撞|磕|碰)(?:到|伤|在)(?:了)?(?:她|他|我)?(?:的)?(?:脑)?头|头部(?:受|遭)(?:了)?(?:剧烈|严重)?(?:撞击|外伤)|头(?:被)?(?:猛|重)(?:撞|击|砸)/.source
  + '|' + /一场大病|大病一场|高烧(?:不退)?|发高(?:烧|热)|重病(?:一场)?|烧坏(?:了)?(?:她的|他的|我的)?耳朵/.source
  + '|' + /耳毒(?:性)?(?:药物|抗生素|反应)?|链霉素|庆大霉素|卡那霉素|新霉素|(?:被|给|遭)(?:灌|下|打)[^。！？\n]{0,8}(?:毁|坏)(?:了)?(?:她的|他的|我的)?耳朵|(?:药|毒)(?:坏|毁)(?:了)?(?:她的|他的|我的)?耳朵/.source
  + '|' + /那天晚上以后|从那(?:天|夜)(?:以后|起|开始)|一夜之间/.source,
);

const CAUSE_EN_RE = new RegExp(
  /\bexplosion\b|\bthe blast\b|\bbomb (?:went off|exploded|detonated)\b|\bdynamite\b|\bgas (?:tank )?explosion\b|\b(?:artillery )?shell(?: exploded)?\b|\bland ?mine\b|\bgrenade\b|\bfireworks? (?:went off|exploded) next to (?:her|his) ear\b|\bgun(?:shot)? went off (?:right )?next to (?:her|his) ear\b|\bfired (?:a shot )?next to (?:her|his) ear\b|\bdeafening (?:blast|noise|roar|explosion|bang|boom)\b|\b(?:loud|piercing) (?:blast|bang|boom|noise|explosion)\b/.source
  + '|' + /\b(?:slapped|smacked|struck) (?:her|him) (?:across |on |over )?(?:the )?(?:ear|side of the head|face|head)\b|\b(?:hard|heavy) slap (?:on|across) (?:her|his) ear\b/.source
  + '|' + /\bblow to the (?:side of the )?head\b|\bblow to (?:her|his) (?:left|right )?ear\b|\b(?:hit|struck|banged|knocked) (?:her|his) head\b|\bfell and hit (?:her|his) head\b|\bfell down (?:the )?stairs[^.?!\n]{0,20}?head\b|\bhead (?:injury|trauma|wound)\b|\bsevere head trauma\b/.source
  + '|' + /\bhigh fever\b|\bgrave illness\b|\bseverely ill\b|\bbrain fever\b|\bfever (?:burned|ruined|destroyed) (?:her|his) ear/.source
  + '|' + /\bototoxic (?:drugs?|antibiotics?|reaction)?\b|\bstreptomycin\b|\bgentamicin\b|\bkanamycin\b|\bneomycin\b|\bdrugs? (?:that |which )?destroyed (?:her|his) hearing\b|\bpoisoned (?:her|his) ears?\b/.source
  + '|' + /\bafter that night\b|\bfrom that night on\b|\bovernight\b|\bsince that night\b/.source,
  'i',
);

/* DEAF 强档：自带耳聋语义的结果锚（直配；"震耳欲聋/装聋"不收） */
const DEAF_STRONG_ZH_RE = /聋了|耳聋了|双耳?失聪|左耳|右耳|失聪|成了?(?:个)?聋子|变成聋子|再也听不见|什么都听不见|一点(?:儿|点)?都听不见|完全听不见|永远(?:性|久)?(?:耳聋|失聪|聋了|听不见)|永久(?:性)?(?:耳聋|失聪|听不见)|听力(?:全失|尽失|完全?丧失|彻底没了)|耳朵(?:彻底|完全|全)?(?:聋了|废了)|再也没(?:有)?听到过?(?:任何|一点)?(?:声音|动静)|听不见任何(?:声音|动静)|世界(?:对她|对他)?(?:突然)?(?:安静|寂静)下来[^。！？\n]{0,8}(?:聋|听不见)?/;

const DEAF_STRONG_EN_RE = /\bwent deaf\b|\bbecame deaf\b|\bwas deafened\b|\bturned deaf\b|\bpermanently deaf\b|\bdeaf forever\b|\bstone-?deaf\b|\bdeaf in both ears\b|\blost (?:her|his|their) hearing\b|\bhearing was gone\b|\brobbed of (?:her|his) hearing\b|\bcould no longer hear\b|\bcould not hear (?:a|any|at all)\b|\bcouldn'?t hear (?:a|any|at all)\b|\bnever heard (?:anything|a sound|again)\b|\bheard nothing (?:ever )?again\b|\btotal hearing loss\b|\bcomplete hearing loss\b|\blost (?:her|his) sense of hearing\b|\b(?:her|his) hearing days were over\b/i;

/* DEAF 弱档：爆震后的听感异常（需 HEARCTX 听力损伤语境兜底；裸耳鸣是真实短暂症状） */
const DEAF_WEAK_ZH_RE = /听不(?:太|甚)?(?:清|清楚|真切)|听(?:起|着)(?:模模糊糊|朦朦胧胧|很模糊|发闷)|耳朵(?:里)?嗡嗡(?:作响|直响|响)?|耳中?嗡鸣|耳鸣(?:不止|不断|了好|连连)?|耳朵(?:像|仿佛)(?:被|给)?塞了?(?:一团|团)?棉花|像(?:是)?塞了?(?:一团|团)?棉花|耳朵发闷|声音(?:像|仿佛)(?:隔|蒙)了一层|听起来(?:很)?远|什么声音都(?:模模糊糊|远远的|发闷)|听(?:什么|人声)都(?:像)?隔了?层/;

const DEAF_WEAK_EN_RE = /\b(?:her|his) ears? (?:were|started|began) ringing\b|\bringing in (?:her|his) ears\b|\bears? rang\b|\btinnitus\b|\b(?:everything|all the voices|the voices) sounded muffled\b|\bmuffled hearing\b|\bcouldn'?t hear clearly\b|\bcould barely hear\b|\bheard (?:everything )?as if underwater\b|\bsounded distant\b|\bvoices? seemed far away\b|\b(?:her|his) ears? felt (?:stuffed|blocked|plugged)\b|\b(?:like|as if there was) cotton in (?:her|his) ears\b|\bears? were plugged\b/i;

/* 听力损伤语境锚：弱档反应需它兜底（须指向"听力丧失/耳器官损伤"，不收裸耳鸣与 deafening 比喻） */
const HEARCTX_ZH_RE = /耳聋|失聪|听不见|听不到|听不清(?:任何|别人)?(?:话|声音)|听力(?:下降|丧失|受损|损伤|减退|全失|障碍|出现问题)|耳膜(?:穿孔|破裂|破了|损伤)|鼓膜(?:穿孔|破裂|损伤)?|耳蜗(?:受损|损伤|坏死)?|听(?:觉|力)神经(?:受损|损伤)?|听觉(?:丧失|障碍)|爆震性(?:耳聋|聋)|噪声性(?:耳聋|听力损失)|感音神经性|耳内(?:出血|损伤)|中耳(?:积血|损伤)/;

const HEARCTX_EN_RE = /\bdeaf(?:ness)?\b|\bhard of hearing\b|\bhearing loss\b|\blost (?:her|his) hearing\b|\bcould not hear\b|\bcouldn'?t hear\b|\bunable to hear\b|\beardrum(?: (?:rupture|perforation|damage))?\b|\btympanic membrane\b|\bperforated\b|\bruptured eardrum\b|\bcochlea\b|\bauditory nerve\b|\bacoustic trauma\b|\bear damage\b|\bdamaged hearing\b|\bimpaired hearing\b|\bsensorineural\b/i;

/* 装聋/选择性不听豁免：装聋作哑、装作没听见、听不进去、充耳不闻——是意志不是失聪 */
const FEIGN_ZH_RE = /装聋(?:作哑|卖傻)?|假(?:装|意)(?:没|听不见|听不到)|装作(?:没听见|听不见|听不到)|假装(?:没听见|听不见|听不到)|充耳不闻|置若罔闻|当(?:作|成|没)(?:没)?听见|选择性(?:失聪|耳聋|听不见|失听)|听不(?:进|下去)(?:去|任何|劝)?|故(?:意|作)不听|压根(?:儿)?不想听/;

const FEIGN_EN_RE = /\bpretended not to hear\b|\bfeigned deafness\b|\bpretended to be deaf\b|\bturned a deaf ear\b|\bselective hearing\b|\btuned (?:him|her|them) out\b|\bdeliberately ignored\b|\bchose not to listen\b|\bignored (?:him|her|them)\b|\bwouldn'?t listen\b|\brefused to listen\b/i;

/* 通讯故障让路：电话/手机/信号不好导致的"听不清"归 comm-fail-crutch，仅弱档让路 */
const PHONE_ZH_RE = /电话|手机|听筒|信号|耳机|那头|听筒里|通话|来电|铃声|话筒/;

const PHONE_EN_RE = /\b(?:over|on) the phone\b|\bphone call\b|\bcell(?: ?phone)?\b|\bmobile\b|\bbad line\b|\bbad reception\b|\bweak signal\b|\bdropped call\b|\bheadset\b|\b(?:ear|head)phones?\b|\bhandset\b|\bcaller\b|\bover the line\b/i;

/* 昏迷苏醒让路：撞头→昏迷→醒来听不见归 wake-on-cue，事件窗口内有昏迷锚则跳过 */
const WAKEGUARD_ZH_RE = /昏迷|植物人|不省人事|昏睡(?:了)?(?:好?几|数|\d+)(?:天|日)|从昏迷中(?:醒|苏醒)/;

const WAKEGUARD_EN_RE = /\bcoma\b|\bcomatose\b|\bunconscious for\b|\bwoke from (?:the|a) coma\b|\blay unconscious\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /神医|名医|世外高人|活神仙|国手/.source
  + '|' + /针灸(?:大师|神医|高手)?|金针|银针|(?:金|银)?针(?:扎|刺|捻)(?:在|向|了)?(?:她|他)?(?:的)?(?:耳|耳穴|耳后|耳部|听宫)|耳穴|扎(?:了)?(?:她|他)?(?:的)?耳?朵?[^。！？\n]{0,4}针|针灸(?:在|扎)(?:耳|听宫)/.source
  + '|' + /偏方|特效药|仙丹|灵药|神药|奇药|灵丹(?:妙药)?|通耳(?:丹|散|药)|滴耳(?:神)?药/.source
  + '|' + /奇(?:迹|迹般)(?:康复|痊愈|治好|恢复|复聪|听见)?/.source
  + '|' + /(?:在|朝|冲)(?:她|他)?(?:的)?(?:脑|后脑勺|头|脑门上?)[^。！？\n]{0,2}(?:拍|敲|打|击|抽)了?一?(?:掌|巴掌|下)?|一(?:掌|巴掌)拍(?:在|向)?(?:脑|头|后脑勺)|头又?(?:被)?(?:撞|磕|碰)了?(?:一?下)?|脑袋(?:又)?(?:撞|磕)(?:到|在)|(?:拍|敲)(?:了)?下?(?:她|他)?(?:的)?脑袋/.source
  + '|' + /人工耳蜗(?:植入|手术|开机|激活)?|耳蜗(?:开机|激活|通电|通了|装上|植入(?:手术)?)|戴上?(?:耳蜗|助听器)[^。！？\n]{0,4}(?:开机|当场|瞬间|立刻)/.source
  + '|' + /情急(?:之?下)?|一急(?:之?下)?|心(?:头|里)一急/.source,
);

const TRIGGER_EN_RE = new RegExp(
  /\b(?:renowned|famed|famous|miracle-?working|legendary) doctor\b|\bmiracle healer\b|\bmaster (?:of|healer of) acupuncture\b/.source
  + '|' + /\bacupuncture\b|\bacupuncture needles?\b|\bneedle(?:s)? (?:in|into|at|behind) (?:her|his) ear\b|\bgolden needle\b|\bsilver needle\b|\bthe ear point\b|\bneedled (?:the )?acoustic point\b/.source
  + '|' + /\bherbal (?:remedy|cure|medicine|pill|elixir|drops?)\b|\bmiracle (?:cure|drug|medicine|pill|ear drops)\b|\bmagic pill\b|\belixir\b|\bear drops\b/.source
  + '|' + /\bmiraculously(?: cured| healed| recovered| regained)?\b/.source
  + '|' + /\b(?:smacked|slapped|tapped|rapped|struck) (?:her|him) (?:on|at|in) the (?:back of the )?(?:head|skull)\b|\bhit (?:her|his) head again\b|\bbanged (?:her|his) head (?:again|once more)\b|\bknocked (?:her|his) skull\b/.source
  + '|' + /\bcochlear implant(?:\s+(?:was\s+)?(?:activated|switched on|turned on|powered on))?\b|\bimplant (?:was )?(?:activated|switched on|turned on|powered on)\b|\bwhen the implant went live\b|\bfitting (?:of|for) (?:the )?cochlear implant\b/.source
  + '|' + /\bin (?:a moment of |sheer )?desperation\b|\bin a panic\b/.source,
  'i',
);

/* HEAR 整体秒复聪锚（须与 TRIGGER 配对；渐进好转不收） */
const HEAR_ZH_RE = new RegExp(
  /(?:听力|听觉)(?:回来|回来了|恢复|恢复了|复原)|恢复(?:了)?(?:听力|听觉)|又能听见|能听见了|可以听见了|重新听见|耳朵能听见(?:了)?|复聪/.source
  + '|' + /(?:第一次|终于|重新|再度)[^。！？\n]{0,6}(?:听见|听到|听清)/.source
  + '|' + /(?:猛地|突然|忽然|骤然|一下子|当场|立刻|马上|竟然|居然|瞬间|刹那)[^。！？\n]{0,10}(?:听见|听到|听清|能听)/.source
  + '|' + /世界(?:重新)?(?:有了|响起)[^。！？\n]{0,4}(?:声音|声响)|声音(?:猛地|一下子|突然)(?:回来|涌进|冲进)/.source,
);

const HEAR_EN_RE = new RegExp(
  /\b(?:her|his|their) hearing returned\b|\bhearing came back\b|\bregained (?:her|his|their) hearing\b|\bcould hear again\b|\bhearing was restored\b|\bsense of hearing returned\b/.source
  + '|' + /\bheard for the first time\b|\bfirst time (?:she|he|they) heard\b|\bcould hear for the first time\b|\bfinally (?:she|he|they) (?:could )?hear\b|\bfound (?:her|his) hearing again\b/.source
  + '|' + /(?:suddenly|instantly|at once|right away|immediately|miraculously|the moment (?:it|the implant) (?:went live|was activated)|in desperation)[^.?!\n]{0,26}?(?:could hear|heard|hearing came|sounds? (?:came|rushed|flooded) in|the world had sound)/.source
  + '|' + /\bthe world had sound again\b|\bsound rushed (?:back )?in\b/.source,
  'i',
);

/* ===== 型A rescue：CAUSE 器质机制真兑付（耳聋有医学因果） ===== */
const R_CAUSE_ZH_RE = /鼓膜(?:穿孔|破裂|损伤)|耳膜(?:穿孔|破裂|破了|损伤)|听(?:小|骨)骨(?:链)?(?:断裂|骨折|错位|损伤)|耳蜗(?:毛细胞)?(?:受损|损伤|坏死|挫伤)|毛细胞(?:受损|损伤|坏死|脱落)|听(?:觉|力)神经(?:受损|损伤|断裂|受压|挫伤)|爆震性(?:耳聋|聋|听力损伤)|噪声性(?:耳聋|听力损失|听力损伤)|耳毒性(?:药物|抗生素|反应)|链霉素|庆大霉素|卡那霉素|新霉素|突发(?:性)?(?:感音神经性)?(?:耳聋|聋)|感音神经性(?:耳聋|听力损失|聋)|颞骨骨折|内耳(?:震荡|损伤|出血)|中耳(?:积血|骨折)|器质(?:性)?(?:损伤|病变|病因)/;

const R_CAUSE_EN_RE = /\bperforated eardrum\b|\bruptured (?:eardrum|tympanic membrane)\b|\btympanic membrane (?:perforation|rupture)\b|\beardrum (?:perforation|rupture|tear)\b|\bossicular chain (?:fracture|disruption|damage)\b|\bbroken ossicles\b|\bdisplaced ossicles\b|\bcochlear hair-?cell? (?:damage|loss|destruction|death)\b|\bdamaged hair cells\b|\bdestroyed hair cells\b|\bauditory nerve (?:damage|injury|trauma)\b|\bacoustic trauma\b|\bnoise-?induced hearing loss\b|\bototoxic(?:ity)?\b|\bstreptomycin\b|\bgentamicin\b|\bkanamycin\b|\bsudden sensorineural hearing loss\b|\bsensorineural hearing loss\b|\btemporal bone fracture\b|\binner-?ear (?:damage|injury|concussion|bleeding)\b|\borganic cause\b/i;

/* 型A rescue：DIAG 规范就医过程（耳聋不是现场宣布） */
const R_DIAG_ZH_RE = /耳鼻喉(?:科|医院|医生|专科)|耳科|听力(?:测试|检查|筛查|评估|师)|纯音测听|声导抗|声阻抗|脑干诱发电位|听性脑干反应|ABR|耳(?:镜|内镜)检查|听力图|做了?[^。！？\n]{0,8}(?:测听|听力检查|耳镜)|住院(?:观察|检查)|检查报告|诊断书|确诊(?:为|是)|观察了?[^。！？\n]{0,4}天/;

const R_DIAG_EN_RE = /\bENT\b|\bent specialist\b|\bENT doctor\b|\bENT consult\b|\baudiologist\b|\baudiology\b|\baudiometry\b|\bpure-?tone (?:test|audiometry)\b|\btympanometry\b|\bauditory brainstem response\b|\bABR test\b|\bhearing (?:test|evaluation|exam|assessment)\b|\botoscopy\b|\bdiagnosed with\b|\badmitted for (?:observation|tests)\b|\bseries of ear exams\b/i;

/* 型A rescue：PRICE 永久/长期代价（阀门没被掰回去；只收真实生活代价/适应方式，
   裸的"再也听不见/终身失聪"只是复述耳聋结果，与 DEAF_STRONG 重叠，不得自救） */
const R_PRICE_ZH_RE = /只能(?:靠)?(?:手语|唇语|读唇|写字|纸笔|纸条)(?:交流|沟通)?|学(?:习|会)?(?:了)?手语|学(?:会)?(?:了)?(?:读)?唇语|用(?:手势|纸条|纸笔)(?:交流|沟通)?|聋(?:人学校|校)|进(?:了)?聋校|助听器(?:也|都)(?:没用|不管用|无济于事)|配了?助听器(?:也|都)?(?:听不清|没用)|接受(?:了)?(?:自己)?(?:终身)?(?:耳聋|失聪)/;

const R_PRICE_EN_RE = /\bcommunicated (?:by|through) (?:sign|writing|notes|lip-?reading)\b|\bwrote notes instead\b|\bsign language\b|\blearned (?:to )?sign\b|\blip-?read\b|\blip-?reading\b|\bread (?:her|his) lips\b|\bdeaf school\b|\bschool for the deaf\b|\bhearing aids? (?:did not|couldn'?t|never) helped\b|\beven hearing aids? could not help\b|\bhearing aids? were useless\b|\baccepted (?:her|his|the) deafness\b|\bgestured to communicate\b/i;

/* ===== 型B rescue：CPROCESS 康复渐进过程（开机不该是当场 hi-fi） ===== */
const R_CPROCESS_ZH_RE = /听力(?:训练|康复|矫治)|听觉(?:口语法|训练|康复)|言语(?:康复|治疗|训练)|语训(?:班|课)?|耳蜗调机|(?:好?几|数|\d+)次调机|调了?(?:好?几|数|\d+)次机|(?:好?几|数|\d+)(?:个?月|年)[^。！？\n]{0,10}(?:康复|训练|语训|调机|针灸|治疗)|针灸(?:治|调理)(?:了|持续)?(?:好?几|数|\d+)(?:个?月|周|年)|(?:先|起初)(?:是|只能)[^。！？\n]{0,10}(?:嗡嗡|电流声|滴滴|杂音|噪音)|学(?:着|会)?[^。！？\n]{0,6}分辨(?:声音|人声|动静)|从(?:分辨|识别)声音(?:开始|学起)|一天比一天(?:听得清|清楚)|渐渐(?:能|会|敢)?(?:分辨|听见|听清)|慢慢(?:练|学|康复)|先(?:是)?(?:嗡嗡|电流声|听不清)/;

const R_CPROCESS_EN_RE = /\bauditory verbal therapy\b|\baural rehab(?:ilitation)?\b|\bauditory training\b|\bspeech therapy (?:after|post|following) (?:the )?implant\b|\bcochlear implant mapping\b|\bmapping sessions?\b|\bimplant fittings?\b|\b(?:re)?tuning sessions?\b|\bmonths? of (?:aural )?(?:rehab|therapy|training)\b|\byears? of (?:aural )?(?:rehab|therapy|training)\b|\bmonths? of acupuncture\b|\b(?:sounded|was) (?:robotic|metallic|electronic|distorted|tinny) at first\b|\blearned to interpret (?:the )?sounds\b|\blearning to (?:interpret|decode) sound\b|\bstarted with (?:electronic |mere )?(?:beeps|buzzing|static|noise)\b|\bgradually learned to hear\b|\bday by day (?:the sounds )?grew clearer\b|\blittle by little\b/i;

/* 型B rescue：PARTIAL 未完全恢复（电灯拉亮但电压不稳） */
const R_PARTIAL_ZH_RE = /只(?:能|听得见)(?:巨大的?响声|巨响|贴着?耳朵(?:喊|说))|要(?:凑|贴)(?:很)?近(?:耳朵)?(?:大声)?(?:喊|说)才听得见|依旧(?:耳鸣|嗡嗡)|耳鸣(?:依旧|没好|还在)|嘈杂(?:环境|的地方)?听不清|人多(?:的地方|嘈杂)?听不清|时好时坏|断断续续|没(?:有)?完全(?:恢复|好)|可能(?:彻底|完全)?(?:聋|失聪|失去听力)|靠助听器(?:才行|辅助)?|耳蜗(?:给|带来)(?:的)?只(?:是|有)电(?:子)?声|声音(?:还是|依旧)(?:模糊|发闷|失真)/;

const R_PARTIAL_EN_RE = /\bonly (?:heard|hear|could hear) loud sounds\b|\bhad to shout in (?:her|his) ear\b|\b(?:only|just) by leaning in close\b|\bring(?:ing)? in (?:her|his) ears (?:persisted|remained|stayed)\b|\btinnitus (?:persisted|remained|stayed)\b|\bhard to hear in crowds?\b|\bmuffled in noisy rooms\b|\bcomes and goes\b|\bintermittent(?:ly)?\b|\bnever fully recovered\b|\bpartial recovery\b|\bmight (?:go completely deaf|lose (?:her|his) hearing entirely)\b|\bwith (?:a )?hearing aid\b|\bimplant gave only an electronic signal\b|\bsounded (?:robotic|distorted|tinny)\b|\bvoice(?:s)? stayed muffled\b/i;

/* 型B rescue：COST 求治代价（复聪有价格） */
const R_COST_ZH_RE = /经年(?:求医|治疗|累月)|(?:好?几|数|\d+)年(?:求医|治疗|针灸|调理)|倾家荡产|砸锅卖铁|借遍|负债|医药费(?:高昂)?|人工耳蜗(?:天价|昂贵|几十万|花光|要几十万)|耳蜗(?:的)?(?:价格|费用)(?:高昂)?|手术(?:风险|同意书|并发症)|开颅(?:手术)?|(?:耳)?蜗手术(?:的)?(?:风险|危险)|(?:神医|名医)[^。！？\n]{0,12}(?:代价|条件|规矩|不收留|难请|不肯治)/;

const R_COST_EN_RE = /\byears? of (?:acupuncture|seeking treatment|treatment|doctors)\b|\bcost a fortune\b|\bmedical bills\b|\bdrained (?:their|the|her|his) savings\b|\bprice of the cure\b|\bdoctor (?:refused|set a price|was hard to find|would only treat (?:her|him) if)\b|\bimplant (?:cost|was|came at)[^.?!\n]{0,30}?(?:fortune|expensive|life savings|pricey)\b|\bexpensive (?:cochlear )?implant\b|\bsurgical risks?\b|\brisky surgery\b|\bconsent form\b|\blife savings\b/i;

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
 * 纯函数：检测"耳聋/复聪剧情阀门/听觉通道当开关"密度病。
 */
export function deafOnCue(draft: string): DeafOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const causeRe = zh ? CAUSE_ZH_RE : CAUSE_EN_RE;
  const deafStrongRe = zh ? DEAF_STRONG_ZH_RE : DEAF_STRONG_EN_RE;
  const deafWeakRe = zh ? DEAF_WEAK_ZH_RE : DEAF_WEAK_EN_RE;
  const hearCtxRe = zh ? HEARCTX_ZH_RE : HEARCTX_EN_RE;
  const feignRe = zh ? FEIGN_ZH_RE : FEIGN_EN_RE;
  const phoneRe = zh ? PHONE_ZH_RE : PHONE_EN_RE;
  const wakeGuardRe = zh ? WAKEGUARD_ZH_RE : WAKEGUARD_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const hearRe = zh ? HEAR_ZH_RE : HEAR_EN_RE;
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

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasCause: boolean[] = new Array(rawLines.length).fill(false);
  const hasDeafStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasDeafWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasHearCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasHear: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasCause[i] = causeRe.test(line);
    hasDeafStrong[i] = deafStrongRe.test(line);
    hasDeafWeak[i] = deafWeakRe.test(line);
    hasHearCtx[i] = hearCtxRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasHear[i] = hearRe.test(line);
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

  /** ±1 行电话语境检查（弱档听不清在打电话——通讯故障让路 comm-fail-crutch） */
  const phoneNearby = (weakLine: number, baseScene: number): boolean => {
    const lo = Math.max(0, weakLine - 1);
    const hi = Math.min(rawLines.length - 1, weakLine + 1);
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== baseScene) continue;
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (phoneRe.test(rawLines[j])) return true;
    }
    return false;
  };

  /** 装聋/选择性不听让路（事件窗口内有装聋锚——不是失聪是不想听） */
  const feignInWindow = (start: number, end: number, baseScene: number): boolean => {
    const lo = Math.max(0, start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, end + RESCUE_PAD);
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== baseScene) continue;
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (feignRe.test(rawLines[j])) return true;
    }
    return false;
  };

  /** 昏迷苏醒让路（事件窗口内有昏迷/植物人锚——撞头醒来听不见归 wake-on-cue） */
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

  /* 型A：CAUSE 组 ±2 行找 DEAF（强档直配；弱档需 ±3 行 HEARCTX 且无电话语境） */
  for (const g of groupRows(hasCause)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let deafLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasDeafStrong[j]) { deafLine = j; strongHit = true; break; }
      if (deafLine < 0 && hasDeafWeak[j]) deafLine = j;
    }
    if (deafLine < 0) continue; /* 受惊受伤但没有耳聋：普通创伤反应放行 */
    if (comaInWindow(Math.min(g.start, deafLine), Math.max(g.end, deafLine), sceneOf[g.start])) continue;
    if (feignInWindow(Math.min(g.start, deafLine), Math.max(g.end, deafLine), sceneOf[g.start])) continue;
    let ctxOk = strongHit;
    if (!ctxOk) {
      if (phoneNearby(deafLine, sceneOf[g.start])) continue; /* 电话里听不清：通讯故障放行 */
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, deafLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasHearCtx[j] || hasDeafStrong[j]) { ctxOk = true; break; }
      }
    }
    if (!ctxOk) continue; /* 仅裸耳鸣/听感发闷无听力损伤语境：爆震后短暂症状放行 */

    const causeM = (rawLines[g.start].match(causeRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const deafM = (rawLines[deafLine].match(strongHit ? deafStrongRe : deafWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, deafLine),
      anchorEnd: deafLine,
      kind: 'onset',
      marker: `${causeM}→${deafM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 HEAR（必须整体秒复聪） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let hearLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasHear[j]) { hearLine = j; break; }
    }
    if (hearLine < 0) continue; /* 有求医/植入但没有当场复聪：仍在治疗/康复中放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const hearM = (rawLines[hearLine].match(hearRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, hearLine),
      anchorEnd: hearLine,
      kind: 'cure',
      marker: `${trigM}→${hearM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: DeafOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次耳聋桥段是类型刚需） */
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
          ? '又是爆震秒耳聋——一次爆炸、耳边一声枪响、一记耳光、一场高烧、几针消炎药，三行之内她什么都听不见、再也听不到任何声音；没有鼓膜穿孔、没有耳蜗毛细胞损伤、没有耳鼻喉科和听力测试，耳聋是制造苦情、阻隔求救、扣押真相的即时枷锁，"银针扎一下听见"救不了这段（它本身就是廉价秒复聪的病象）'
          : 'another blast-to-deafness beat - an explosion, a gunshot next to the ear, one slap across the side of the head, a high fever, a course of antibiotics, and within three lines she hears nothing at all and never hears again; no ruptured eardrum, no damaged cochlear hair cells, no ENT consult and no hearing test; deafness is an instant padlock used to manufacture suffering, block a cry for help and impound the truth, and "one silver needle and she could hear" does not rescue this beat (that is the cheap-cure disease itself)')
        : (zh
          ? '又是廉价秒复聪——神医一根银针扎向耳穴、偏方滴耳灵药、脑后拍一巴掌、头再撞一下、人工耳蜗刚开机她当场听清每一个字，没有听力训练、没有耳蜗调机、没有从电流嗡嗡到分辨人声的适应、没有复聪带回的价格；下一集她隔八丈远都听得见悄悄话，耳朵是编剧的电灯开关：需要苦情时一拉全灭，需要圆满时一拉全亮'
          : 'another cheap instant-cure beat - a famed doctor drives a silver needle behind the ear, a herbal ear-drops miracle, a slap to the back of the head, another knock to the skull, or a cochlear implant switched on, and instantly she hears every word clearly; no auditory training, no implant mapping, no period of electronic buzzing before she can decode a human voice, no price attached to the recovery; next episode she catches a whisper across the room - hearing is the writer\'s light switch: total silence when suffering is needed, hi-fi restoration when a happy ending is due'),
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
      ? `${hitCount} 处"耳聋/复聪剧情阀门"（爆震秒耳聋 ${onsetCount} 处、廉价秒复聪 ${cureCount} 处，${n} 处未救）——听觉通道成了随取随用的电灯开关：需要苦情时一场爆炸一记耳光三行内再也听不见，不要鼓膜穿孔和听力诊断；需要圆满时银针耳穴/脑后一掌/耳蜗开机当场听清，不要调机和语训。第一次是类型桥段，第三次观众就看穿：这个剧里耳聋从来不是伤，是可以一键耳聋又一键复聪的扳手；而每回耳聋都不给就医过程、每回复聪都不留尾巴，耳聋和复聪双双贬值。`
      : `${hitCount} deaf-on-cue beat(s) (${onsetCount} instant deafness, ${cureCount} instant cure; ${n} unrescued) - hearing is a light switch: when suffering is needed an explosion, a gunshot by the ear or one slap across the head means she hears nothing in three lines, with no ruptured eardrum and no audiology workup; when relief is needed a silver needle, a knock to the skull or a cochlear implant switched on restores perfect hearing instantly, with no mapping and no auditory verbal therapy. Once is genre grammar; by the third, the audience sees deafness is never an injury in this story, only a wrench that deafens and restores on command - and when every deafening skips the medicine and every cure skips the tail, both the silence and the recovery lose their value.`);
    advice.push(zh
      ? '让失聪恢复它应有的重量与麻烦。爆震秒耳聋型：①让机制真兑付——鼓膜穿孔破裂、听骨链断裂、耳蜗毛细胞受损坏死、听神经损伤、爆震性或噪声性耳聋、耳毒性药物（链霉素、庆大霉素）致聋、突发性感音神经性耳聋、颞骨骨折，打击和耳聋之间要有医学因果，医生嘴里要有具体诊断而不是一句"再也听不见了"；②让就医有过程——耳鼻喉科、听力测试、纯音测听、声导抗、脑干诱发电位、听力师评估、住院观察、数天后才确诊，耳聋不能在爆炸现场一句话宣判；③要么让代价真留下——终身失聪、只能靠手语唇语和纸条交流、进聋校、助听器也没用、接受失聪，这次没有银针反转，苦情戏才值钱；记住"扎一针听见"不救耳聋戏，它本身就是秒复聪的病象。廉价秒复聪型：④让复聪有康复过程——听力训练、听觉口语法、语训、人工耳蜗要多次调机，开机后先是电流声嗡嗡、再一点点学着分辨人声，数月数年才听清，开机不该是当场 hi-fi 出厂设置；⑤给电灯留电压不稳的尾巴——只听得见巨响、要贴耳朵喊才行、依旧耳鸣、人多嘈杂就听不清、时好时坏、还可能彻底失聪，耳蜗给的永远只是电子声不是肉耳，下一场戏要有"你大点声"和侧过左耳的笨拙；⑥如果必须复聪，让它带着价格——经年累月求医、倾家荡产的医药费、几十万元的人工耳蜗、手术风险和同意书、神医的条件与拒绝，重获听力不该是免费的圆满。最忌讳一集两回"一声爆炸→什么都听不见→神医扎耳穴→脑后一拍当场听见娘→认亲打脸"。耳朵若要拉闸，就得真的改变生活；若要合闸，也不能白合闸。'
      : 'Give the lost hearing its real weight and its real hassle. For instant-deafness beats: (1) let the mechanism in - a perforated or ruptured eardrum, a fractured ossicular chain, damaged or destroyed cochlear hair cells, an injured auditory nerve, acoustic trauma or noise-induced hearing loss, ototoxic antibiotics such as streptomycin or gentamicin, sudden sensorineural hearing loss, a temporal bone fracture; there must be a medical cause between the blow and the silence, and the doctor must name a diagnosis instead of just declaring "she can never hear again". (2) Let the medicine take a process - ENT consults, a hearing test, pure-tone audiometry, tympanometry, an auditory brainstem response, an audiologist, admission and observation, a diagnosis days later; deafness cannot be announced in one line at the explosion site. (3) Or let the cost remain - lifelong deafness, communication only through sign language, lip-reading and notes, a deaf school, hearing aids that do not help, accepting the deafness; when no silver-needle reversal arrives, the suffering finally costs something; remember "one needle and she could hear" never rescues a deafening beat, because that is the instant-cure disease itself. For cheap-cure beats: (4) give the recovery a rehab process - auditory training, auditory verbal therapy, repeated cochlear implant mapping sessions; after switch-on the world arrives first as electronic buzzing, then she slowly learns to decode a human voice, and clear hearing takes months or years; activation must not be factory-set hi-fi. (5) Leave the light switch a faulty tail - she hears only loud sounds, people must shout into her ear, the ringing persists, crowds and noisy rooms defeat her, good days and bad days, hearing might be lost entirely, and an implant forever gives an electronic signal, not a living ear; the next scene needs a "speak up" and her turning the good ear toward you. (6) If hearing must return, make it cost something - years of doctors, bills that bankrupt the family, an implant priced at a fortune, surgical risks and consent forms, the healer\'s price or refusal; regaining hearing must not be a free happy ending. The unforgivable pattern is two "one explosion -> hears nothing -> famed doctor needles the ear -> a slap to the skull, she instantly hears Mama -> recognition and revenge" loops per episode. If the ears go off, a life must genuinely change; if they come back on, it must not be for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
