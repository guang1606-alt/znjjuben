import { isSceneHeaderLine } from './script-scenes';
/**
 * 瘫痪/秒愈剧情阀门 / 肢体移动通道当开关检测（v2.112 块120，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的双腿当成随取随用的剧情开关，两种形态反复
 *   出现——
 *   A 事故秒瘫型：脚手架上摔下来、一场车祸、一根钢梁砸在后腰、矿井
 *     塌方、子弹打中脊梁，三行之内他"下半身没了知觉""双腿瘫痪、
 *     这辈子再也站不起来"；没有脊髓损伤、没有椎体骨折、没有核磁
 *     共振和神经外科会诊，瘫痪是制造苦情、困住证人、扣押主角行动
 *     能力的即时枷锁——真相就在三楼他偏上不去，观众替他着急；
 *   B 廉价秒愈型：坐了三年轮椅的人，剧情需要追凶、救人、大团圆时，
 *     神医一根银针沿脊柱扎下、正骨师咔嚓一声把腰一扳、灵药膏药
 *     下肚、活佛发功摸了一下、情急之下孩子坠楼他猛地从轮椅上站
 *     起来就追；没有康复训练、没有先动脚趾再学站的过程、没有拄拐
 *     踉跄的尾巴、没有复健带回的价格，下一集他翻墙跳崖样样来——
 *     腿是编剧的电灯开关：需要苦情时一拉全灭，需要圆满时一拉全亮。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里瘫痪从来不是伤，
 *   是可以一键瘫痪又一键站起的情节扳手，瘫痪和痊愈双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - wound-on-cue：单场"带伤超负荷行动"（伤势未愈+超荷行动，代价
 *    阀门，其 ACTION 锚已含"从轮椅上站起来"但须配 INJURY 伤情锚
 *    如打着石膏/还在输液）；本引擎管"持续肢体功能丧失的宣判与
 *    解除"——慢性截瘫状态当开关，两套锚正交（石膏/输液 vs 截瘫/
 *    多年轮椅）；
 *  - wound-recovery-ledger：跨集伤势恢复连续性穿帮（全库无瘫痪/
 *    轮椅/脊髓词表），本引擎管单集内瘫痪宣判与秒愈时机密度病；
 *  - faint-on-cue：短暂晕倒掐断信息流（信息阀门），本引擎管持续
 *    移动能力失与得；
 *  - wake-on-cue：昏迷苏醒阀门；遇昏迷/植物人窗口本引擎让路；
 *  - amnesia-on-cue：撞头→失忆归 amnesia，坠/砸→瘫归本引擎；
 *  - terminal-diagnosis-on-cue：绝症死亡倒计时（会死的病），瘫痪
 *    不死人只夺行走，词表互不重叠；
 *  - blindness/mute/deaf-on-cue：视/言/听通道，本引擎是肢体移动
 *    通道，感官三件套之外补身体阀门家族第十二员；
 *  - poison-on-cue 的 PRICE 词表里有 permanent paralyzed（毒理后遗
 *    症代价），不调用本引擎；
 *  - location-ledger STRANDED 的"瘫痪/paralyzed/bedridden"是被困
 *    状态记账，与本引擎无关。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A onset（事故秒瘫）：
 *    CAUSE 病因锚（高处坠落/车祸/重物砸背砸腰/脊柱脊梁直接受伤/
 *    枪中脊梁/后腰被踢踹 + fell from the scaffolding/car crash/
 *    beam crushed his spine/broke his back/gunshot to the spine/
 *    after the accident…）±2行与 PARA 瘫痪锚共现；PARA 分两档——
 *    STRONG（瘫痪了/下半身瘫痪/高位截瘫/半身不遂/双腿没了知觉/
 *    再也站不起来/终身轮椅 + was paralyzed/paralyzed from the
 *    waist down/paraplegic/lost the use of his legs/could never
 *    walk again/confined to a wheelchair…）自带瘫痪语义直配；
 *    WEAK（腿麻/腿没知觉/两腿发软/腿不听使唤/针扎不知疼 + legs
 *    numb/couldn't feel his legs/legs wouldn't move/pins and
 *    needles…）必须在事件 ±3 行窗口内另有 MOBCTX 移动器官损伤
 *    语境锚（瘫痪/截瘫/轮椅/脊椎/脊柱/脊髓/腰椎/神经压迫/骨科/
 *    神经内外科 + paralysis/spinal cord/fractured vertebra/nerve
 *    damage/neurologist…），裸腿麻（吓软了/蹲麻了）是真实短暂
 *    反应不归本引擎；FEIGN 装瘫/装瘸/碰瓷骗保是意志不是失能，
 *    整体跳过；WAKEGUARD 昏迷/植物人窗口让路 wake-on-cue；
 *  - 型B cure（廉价秒愈）：
 *    TRIGGER 廉价解除锚（神医美名老中医/银针金针沿脊柱扎/正骨推拿
 *    咔嚓一扳/偏方灵药膏药/奇迹发功/后腰再拍一掌/情急孩子出事 +
 *    famed doctor/acupuncture needles along the spine/chiropractor
 *    snapped his back/herbal elixir/miracle/in desperation…）±2行
 *    与 MOBILE 整体秒行动锚共现（扔下轮椅/重新能走路/猛地从轮椅
 *    站起来就追/脚趾突然能动 + abandoned the wheelchair/could walk
 *    again/suddenly stood up and walked/regained the use of his
 *    legs…）；MOBILE 不自带瘫痪语义（健康人也会站起来），故事件
 *    ±3 行窗口内必须另有 STATE 长期瘫痪状态锚（坐了X年轮椅/瘫痪
 *    多年/卧床不起/医生断言一辈子站不起来 + wheelchair for years/
 *    paralyzed for months/doctor said he would never walk…）或
 *    PARA_STRONG 锚，否则健康人受惊站起放行；
 *    银针脊柱、康复训练、钢钉手术是真医疗，但"扎一针扔下轮椅就
 *    跑"才是病，调机式的数月康复在 rescue 里；无触发物的缓慢好转
 *    合法放行；
 *  - 相邻 ≤2 行的 CAUSE/TRIGGER 行各自合并为同一事件（跨场景头
 *    不合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CAUSE 器质机制真兑付——脊髓损伤/脊柱骨折/椎体压缩性
 *      爆裂骨折/腰椎颈椎滑脱错位/神经压迫断裂/椎间盘突出/横断性
 *      脊髓炎/中风偏瘫/减压钢钉固定，打击与瘫痪之间有医学因果；
 *      ②DIAG 规范就医过程——核磁共振/MRI/CT/X光、神经外科、骨科、
 *      脊柱科、康复科、肌电图、会诊、确诊，瘫痪不是现场宣布；
 *      ③PRICE 永久长期代价——只能靠轮椅拐杖出行、家里改坡道、
 *      褥疮压疮、导尿失禁、靠人喂饭擦洗、学会操控轮椅、接受轮椅、
 *      残疾证，阀门这次没被掰回去；裸的"终身瘫痪/再也站不起来"
 *      只是复述结果与 PARA_STRONG 重叠，不得自救；"扎一针站起来"
 *      不救 onset（它本身就是型B病象）；
 *    型B：①CPROCESS 康复渐进过程——康复训练、物理治疗理疗、数月
 *      数年康复中心、先学会翻身坐起/先能动大脚趾、站平衡与步态
 *      训练、支具矫形器、一天比一天有力气，站起不该是当场满血；
 *      ②PARTIAL 未完全恢复——拄拐/助行器/支具、只能站几分钟、
 *      走两步就喘、一条腿还拖着、跛行踉跄、时好时坏、还得回轮椅，
 *      电灯拉亮但电压不稳；③COST 代价——经年求医、倾家荡产、
 *      进口钢钉、天价手术与康复中心、手术风险同意书、神医的条件，
 *      重新走路有价格；
 *  - 第 1 次豁免（一次瘫痪桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface ParalysisOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** onset=事故秒瘫型；cure=廉价秒愈型 */
  kind: 'onset' | 'cure';
  /** 是否有医学机制/就医过程/永久代价/康复过程/部分恢复/求治代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface ParalysisOnCueResult {
  score: number;
  /** 瘫痪阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: ParalysisOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：CAUSE 瘫痪病因锚 ===== */
const CAUSE_ZH_RE = new RegExp(
  /从(?:脚手架|楼顶|屋顶|房顶|高楼|山崖|悬崖|树上|马背|马背?上|梯子|二楼|三楼|高台|塔吊|高处|楼上)[^。！？\n]{0,8}(?:摔|坠|跌|落)|(?:脚手架|高楼|悬崖|梯子|马|高台)[^。！？\n]{0,4}(?:上摔|坠落|跌下)/.source
  + '|' + /一(?:场)?(?:严重|重大)?(?:车祸|交通事故)|(?:轿车|卡车|货车|汽车|摩托|面包车|公车)[^。！？\n]{0,6}(?:撞飞|撞到|撞上|撞倒|碾压|拖行)|被(?:轿车|卡车|货车|汽车|摩托|车)(?:撞|撞飞|撞倒|碾压)/.source
  + '|' + /(?:钢梁|钢筋|房梁|木头|石板|石头|水泥板|大树|墙体|土方|矿顶|塌方的)[^。！？\n]{0,8}(?:砸|压|撞|拍|落|塌)(?:在|到|中|向|方)?(?:她|他|我)?(?:的)?(?:后背|背|后腰|腰|脊梁|脊柱|脊椎)|(?:后背|后腰|腰|脊梁|脊柱)(?:被|给|遭)(?:重|猛)?(?:砸|压|撞|拍)/.source
  + '|' + /脊(?:柱|椎)(?:骨)?(?:摔|被砸|被撞|受压|断|折|裂|错位|受伤|损伤)|脊梁(?:骨)?(?:被|给|摔|砸|撞|打)?(?:断|折|裂|打断)|脊椎(?:骨)?(?:断|折|裂|错位)|腰椎(?:摔|被砸|撞|压)?(?:断|折|裂|错位|骨折|滑脱)|后腰(?:被|给|遭)(?:踢|踹|撞|顶)[^。！？\n]{0,4}|后背(?:被|给|遭)(?:猛|重)(?:撞|砸|顶)/.source
  + '|' + /一?枪(?:打|击)(?:在|中)(?:了)?(?:她|他|我)?(?:的)?(?:脊梁|脊柱|脊椎|后腰|后背)|子弹(?:打穿|击中|打中|穿过)(?:了)?(?:她|他|我)?(?:的)?(?:脊梁|脊柱|脊椎)|刀(?:刺|扎|捅)(?:在|中)(?:了)?(?:她|他|我)?(?:的)?(?:脊梁|脊柱|后腰)/.source
  + '|' + /那(?:场|次)?(?:车祸|事故)(?:以后|之后|起)|从(?:摔|被砸|出事|中枪)(?:那)?(?:天|以后|之后|起)|出事(?:以后|之后)/.source,
);

const CAUSE_EN_RE = new RegExp(
  /\bfell (?:from|off) (?:the )?(?:scaffold|scaffolding|roof|rooftop|building|cliff|horse|ladder|tree|second floor|third floor|platform|crane)\b|\bplummeted from\b|\bfall from (?:a |the )?height\b/.source
  + '|' + /\bcar (?:crash|accident)\b|\btruck (?:hit|struck|slammed into) (?:him|her)\b|\b(?:was|got) hit by a (?:car|truck|bus|van|motorcycle|vehicle)\b|\bmotorcycle crash\b|\bstruck by a vehicle\b|\bdragged by the (?:car|truck)\b/.source
  + '|' + /\b(?:steel )?beam[^.?!\n]{0,14}?(?:struck|crashed down on|landed on|pinned|hit) (?:his|her) (?:back|spine|lower back)\b|\b(?:timber|rock|slab of concrete|concrete slab|tree|wall|rubble)[^.?!\n]{0,14}?(?:fell on|pinned|crushed|struck|landed on) (?:him|her|his|her back|his|her spine)\b|\bcave-?in\b|\bmine collapsed\b|\bcrushed (?:his|her) (?:spine|back|lower back)\b/.source
  + '|' + /\bbroke (?:his|her) back\b|\bfractured (?:his|her) spine\b|\bsevered (?:his|her) spinal cord\b|\b(?:his|her) spine (?:was )?(?:broken|fractured|snapped|crushed|injured)\b|\bkicked (?:him|her) in the lower back\b|\blower back took the blow\b|\bstabbed (?:him|her) in the spine\b/.source
  + '|' + /\bgunshot (?:to|wound to) the spine\b|\bbullet (?:lodged in|hit|struck|pierced) (?:his|her) spine\b|\bshot in the back\b/.source
  + '|' + /\bafter the (?:accident|crash|fall|operation)\b|\bfrom that day on\b|\bever since the (?:accident|crash|fall)\b|\bonce he came to after\b/.source,
  'i',
);

/* PARA 强档：自带瘫痪语义的结果锚（直配；"吓得腿软/蹲麻了"不收） */
const PARA_STRONG_ZH_RE = /瘫痪了|瘫痪在床|下身瘫痪|下半身瘫痪|下肢瘫痪|双腿(?:都|全)?(?:瘫痪|废了|没了知觉|失去知觉|不能动)|两条腿(?:都)?(?:瘫痪|没了知觉|失去知觉|不能动|不听使唤)|高位截瘫|截瘫|半身不遂|半边(?:身子|身体)(?:瘫|不能动|没知觉)|成了?(?:个)?瘫子|终身(?:瘫痪|坐轮椅|与轮椅为伴)|永远(?:性)?(?:瘫痪|站不起来|不能走路|走不了路)|永久(?:性)?(?:瘫痪|不能走路)|再也(?:站不起来|不能走路|走不了路|无法行走|下不了床)|(?:这|下半)辈子(?:都|只能)?(?:在轮椅上|坐轮椅|卧床|站不起来)|下半身(?:彻底|完全)?(?:没了|失去)?知觉|(?:下半身|下身)(?:完全|彻底)?(?:不能动|动不了|没知觉|失去知觉)|两条腿(?:再也|都)不(?:听使唤|属于她|属于他)|(?:双|两)?腿(?:彻底|完全|全)?(?:废了|瘫痪)|丧失(?:了)?(?:行走|走路|站立)能力/;

const PARA_STRONG_EN_RE = /\bwas paralyzed\b|\bbecame paralyzed\b|\bparalyzed from the waist down\b|\bparalyzed (?:him|her) (?:from|permanently)\b|\bparaplegic\b|\bquadriplegic\b|\btetraplegic\b|\bparaplegia\b|\bhemipleg(?:ia|ic)\b|\blost the use of (?:his|her) legs\b|\blost (?:his|her) ability to walk\b|\bcould never walk again\b|\bwould never walk again\b|\bnever walked again\b|\bunable to walk\b|\bconfined to a wheelchair\b|\bwheelchair-?bound\b|\bpermanently paralyzed\b|\blower (?:body|half) was paralyzed\b|\b(?:his|her) legs were (?:completely )?paralyzed\b|\bparalysis (?:of|in) (?:his|her) legs\b|\b(?:his|her) walking days were over\b/i;

/* PARA 弱档：伤后的腿感异常（需 MOBCTX 移动器官损伤语境兜底；吓软/蹲麻是真实短暂反应） */
const PARA_WEAK_ZH_RE = /(?:双|两|两条)?腿(?:没|没有)(?:了)?知觉|(?:双|两)?腿(?:发?麻|麻了|木木的|使不上劲|不听使唤|动不了|抬不起来|发软|一软)|下(?:半身|身)(?:发?麻|木木的|没知觉|使不上劲|不听使唤)|腿(?:像|仿佛)(?:灌了?铅|不是自己的|断了)|针扎(?:在)?(?:腿|脚|脚趾)[^。！？\n]{0,4}(?:都|也)?不(?:觉得|知道)疼|掐(?:了)?(?:腿|脚)[^。！？\n]{0,4}(?:都|也)?没(?:有)?反应|动(?:一?动)?(?:脚趾|脚|腿)[^。！？\n]{0,2}(?:都|也)?(?:动不了|没反应|不听使唤)|脚趾(?:没|不能)(?:反应|动)/;

const PARA_WEAK_EN_RE = /\bcouldn'?t feel (?:his|her) legs\b|\bcould not feel (?:his|her) legs\b|\bno feeling in (?:his|her) legs\b|\bno sensation in (?:his|her) legs\b|\blegs? (?:were|felt|went) numb\b|\bnumbness in (?:his|her) legs\b|\blegs? wouldn'?t move\b|\blegs? refused to move\b|\bcouldn'?t move (?:his|her) legs\b|\bpins and needles\b|\blegs? felt (?:like lead|heavy|dead|foreign|not (?:his|her) own)\b|\btoes? wouldn'?t respond\b|\b(?:he|she) couldn'?t wiggle (?:his|her) toes\b|\blegs? gave out beneath\b/i;

/* 移动器官损伤语境锚：弱档反应需它兜底（须指向"移动能力丧失/脊柱神经损伤"，不收裸腿麻） */
const MOBCTX_ZH_RE = /瘫痪|截瘫|半身不遂|轮椅|脊椎|脊柱|脊髓|脊梁(?:骨)?|腰椎|颈椎|椎体|椎骨|脊柱神经|神经(?:压迫|受压|损伤|断裂)|下(?:半)?身(?:瘫|不能动)|腿(?:神经|骨折)|骨盆(?:骨折|碎裂)|骨科|神经(?:内|外)科|脊柱(?:外)?科|康复(?:科|医学科)|医生(?:说|诊断|断言)[^。！？\n]{0,12}(?:瘫|站不起来|不能走|走不了)/;

const MOBCTX_EN_RE = /\bparalys[iz]\w*|\bparaplegi\w*|\bquadriplegi\w*|\bwheelchair\b|\bspinal cord\b|\bspine injury\b|\bspinal injury\b|\bfractured vertebra\w*\b|\bbroken (?:back|spine)\b|\bnerve damage\b|\bherniated disc\b|\blower[ -]?back injury\b|\bpelvis shattered\b|\bneurologist\b|\bneurosurgeon\b|\borthopedic\b|\bspine specialist\b/i;

/* 装瘫/装瘸/碰瓷豁免：是意志不是失能 */
const FEIGN_ZH_RE = /装瘫|装瘸|装(?:了|作)?(?:个)?(?:瘫子|瘸子|残废)|假装(?:瘫痪|瘸|不能走|站不起来|腿不行)|装作(?:瘫痪|瘸|不能走|腿不行)|假(?:的)?瘫痪|赖在轮椅上(?:不起来|装|不肯下)|碰瓷|骗(?:赔偿|保险金|保险)|诈伤/;

const FEIGN_EN_RE = /\bfaked (?:the )?paralysis\b|\bfeigned paralysis\b|\bpretended (?:he|she) couldn'?t walk\b|\bpretending to be paralyzed\b|\bmalinger(?:ing|ed)?\b|\bfaking it for (?:the |an )?(?:insurance|compensation)\b|\bfake(?:d)? (?:wheelchair|injury)\b|\binsurance fraud\b/i;

/* 昏迷苏醒让路：事故→昏迷→醒来不能动归 wake-on-cue，事件窗口内有昏迷锚则跳过 */
const WAKEGUARD_ZH_RE = /昏迷|植物人|不省人事|昏睡(?:了)?(?:好?几|数|\d+)(?:天|日)|从昏迷中(?:醒|苏醒)/;

const WAKEGUARD_EN_RE = /\bcoma\b|\bcomatose\b|\bunconscious for\b|\bwoke from (?:the|a) coma\b|\blay unconscious\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /神医|名医|世外高人|活神仙|国手|老中医|活佛|大师|圣手/.source
  + '|' + /银针|金针|针灸(?:大师|神医|高手|师)?|(?:金|银)?针(?:扎|刺|捻|入)(?:在|向|沿|顺|了)?(?:她|他)?(?:的)?(?:脊柱|脊椎|腰椎|脊梁|后背|腰眼|命门)|沿(?:着)?(?:脊柱|脊梁|后背)[^。！？\n]{0,6}(?:扎针|行针|下针|针灸)/.source
  + '|' + /正骨(?:师|大夫|高手)?|推拿(?:师|大师)?|按摩(?:师|高手)?|(?:正骨|推拿|按摩)[^。！？\n]{0,6}(?:咔嚓|一扳|猛(?:地)?一?扳|咔哒)|咔嚓(?:一?声)?[^。！？\n]{0,4}(?:把|将)?(?:脊梁|腰椎|脊椎|后背|腰)(?:掰|推|拧|扳|顶)|(?:猛|用力)(?:地)?(?:一?[扳推拧顶])[^。！？\n]{0,4}(?:脊梁|腰|背|脊椎)/.source
  + '|' + /偏方|特效药|仙丹|灵药|神药|奇药|灵丹(?:妙药)?|膏药|药酒|通脉(?:丹|散|膏)/.source
  + '|' + /奇(?:迹|迹般)(?:康复|痊愈|治好|恢复|站起|走路)?|气(?:功|场)|发功|(?:大师|活佛|高人)[^。！？\n]{0,8}(?:摸|拍|按|点)(?:了)?(?:下|一下)?(?:她|他)?(?:的)?(?:脊梁|背|腰)/.source
  + '|' + /(?:在|朝|冲|照)(?:她|他)?(?:的)?(?:后背|脊梁|后腰|腰)[^。！？\n]{0,2}(?:拍|砸|捶|撞|击)了?一?(?:掌|巴掌|下)?|后背(?:又)?(?:被|给)?(?:撞|砸|捶)(?:了)?一?下|后腰(?:又)?(?:被|给)?顶了?一?下/.source
  + '|' + /情急(?:之?下)?|一急(?:之?下)?|眼看(?:孩子|女儿|儿子|孙子|孙女)[^。！？\n]{0,10}(?:危险|出事|被|坠|摔|落水)/.source,
);

const TRIGGER_EN_RE = new RegExp(
  /\b(?:renowned|famed|famous|miracle-?working|legendary) doctor\b|\bmiracle healer\b|\bmaster (?:of|healer of) acupuncture\b|\bvenerable herbalist\b|\bholy man\b|\bmiracle worker\b/.source
  + '|' + /\bacupuncture needles? (?:in|along|into|down) (?:his|her) spine\b|\bneedled (?:along|down) (?:the )?spine\b|\bgolden needle\b|\bsilver needle\b|\bneedles? along the spine\b|\bacupuncture master\b/.source
  + '|' + /\bbonesetter\b|\bchiropractor\b|\b(?:spine|back) (?:was )?(?:snapped|cracked|adjusted|twisted) back into place\b|\bsnapped (?:his|her) (?:spine|back) into place\b|\bcracked (?:his|her) spine\b|\bone sharp twist (?:of|to) (?:his|her) back\b|\bcracked (?:his|her) lower back\b/.source
  + '|' + /\bherbal (?:remedy|cure|medicine|elixir|plaster|tincture|wine)\b|\bmiracle (?:cure|drug|medicine|plaster|liniment)\b|\bmagic liniment\b|\belixir\b|\bmedicated plaster\b/.source
  + '|' + /\bmiraculously(?: cured| healed| recovered| stood| walked)?\b|\blaid hands on\b|\bqigong\b|\bspiritual healer\b/.source
  + '|' + /\b(?:slapped|hit|struck|pounded|smacked) (?:him|her) (?:on|in) the (?:lower )?back\b|\bhit (?:his|her) back again\b|\bblow to the spine\b/.source
  + '|' + /\bin (?:a moment of |sheer )?desperation\b|\bin a panic\b|\bseeing (?:his|her) (?:child|daughter|son) in danger\b|\bas the child (?:fell|slipped)\b/.source,
  'i',
);

/* STATE 长期瘫痪状态锚：型B 前提（"站起来"不自带瘫痪语义，健康人也会站） */
const STATE_ZH_RE = new RegExp(
  /(?:坐|推|摇|困|瘫)(?:了|着|在)?(?:好?几|数|多|[一二两三四五六七八九十百零\d]+)(?:个?月|年|载)[^。！？\n]{0,6}轮椅|轮椅(?:上|里)(?:坐|困|熬|瘫)(?:了)?(?:好?几|数|多|[一二两三四五六七八九十百零\d]+)(?:个?月|年)/.source
  + '|' + /(?:瘫痪|截瘫|半身不遂|卧床不起)(?:了|在床)?(?:好?几|数|多|[一二两三四五六七八九十百零\d]+)(?:个?月|年|载)|下半身(?:早|已|早就)(?:没了|失去)?知觉/.source
  + '|' + /医生(?:说|断言|宣判|告诉)[^。！？\n]{0,16}(?:一辈子|终生|这辈子|永远|再也)[^。！？\n]{0,8}(?:站不起来|不能走|走不了|下不了床|走路)|被(?:医生)?(?:判了|下了)(?:终身|一辈子)轮椅/.source
  + '|' + /卧床不起|久卧在床|靠轮椅(?:出行|代步)|以轮椅代步|离不开轮椅|轮椅为生/.source,
);

const STATE_EN_RE = new RegExp(
  /\b(?:had been|been) in a wheelchair for\b|\bwheelchair for (?:years|months|over \d+ years|\d+ years)\b/.source
  + '|' + /\bparalyzed for (?:years|months|years now|over a year)\b|\bconfined to a wheelchair\b|\bbedridden for (?:years|months)\b|\bhad not walked in (?:years|months)\b/.source
  + '|' + /\bdoctors? (?:had )?(?:said|told|declared|warned) (?:him|her)[^.?!\n]{0,34}?(?:never walk|would never|couldn'?t walk|could never)\b/.source
  + '|' + /\blifelong wheelchair\b|\bdepended on (?:the )?wheelchair\b|\brelied on crutches for years\b|\bnever walked (?:in years|again)\b/.source,
  'i',
);

/* MOBILE 整体秒行动锚（须与 TRIGGER+STATE 配对；渐进好转、健康人站起不收） */
const MOBILE_ZH_RE = new RegExp(
  /(?:扔|甩|推|掀|丢)(?:开|掉|下)(?:了)?(?:轮椅|拐杖|双拐|拐)|推开(?:了)?轮椅|离开轮椅(?:站|站了?起来)?|(?:从|自)(?:轮椅|病榻|床)(?:上)?(?:猛地|突然|一下子|直接|当场|竟然|居然)?(?:站|跳|撑|跃)(?:了?起来|起身|起)/.source
  + '|' + /(?:重新|又)(?:能|可以)(?:站|站立|走路|行走|站起来|迈开步子)|能走路了|恢复(?:了)?(?:行走|走路|站立|行动)(?:能力)?|双腿(?:又|重新)(?:有了力气|能走|听使唤)|重新(?:站了?起来|站起|迈开|学会走路|迈开步子)|复健?成功站起/.source
  + '|' + /(?:猛地|突然|忽然|一下子|当场|立刻|马上|竟然|居然|奇迹般|鬼使神差)[^。！？\n]{0,10}(?:站了?起来|站起身|站起|能走|迈开|站起来(?:走|追|跑|扑|迈)|从轮椅上)|站了?起来(?:，|,)?[^。！？\n]{0,4}(?:就)?(?:走|迈|追|跑|扑|冲)/.source
  + '|' + /(?:脚趾|脚指头|腿|脚)[^。！？\n]{0,2}(?:猛地|突然|一下子)?(?:动了?一下|有了知觉|有知觉了|能弯曲)/.source,
);

const MOBILE_EN_RE = new RegExp(
  /\b(?:threw|tossed|pushed|abandoned|leapt|jumped|rose|got|stood|sprung) (?:aside|away|from|off|up)[^.?!\n]{0,14}?(?:wheelchair|crutches)\b|\babandoned (?:the|his|her) wheelchair\b|\brose from (?:the )?wheelchair\b|\bstood up from the wheelchair\b|\bsprung from the wheelchair\b/.source
  + '|' + /\b(?:could|was able to) walk again\b|\bwalked again\b|\bregained (?:the )?use of (?:his|her) legs\b|\bfeeling returned to (?:his|her) legs\b|\blegs? (?:worked|moved) again\b|\bfound (?:his|her) legs\b|\bwalking returned\b/.source
  + '|' + /(?:suddenly|miraculously|instantly|at once|immediately|in desperation|all at once)[^.?!\n]{0,24}?(?:stood (?:up )?|rose (?:to (?:his|her) feet)?|walked|took a step|legs? moved|got to (?:his|her) feet)|\bstood (?:up )?and (?:walked|ran|took|limped|chased|rushed)\b/.source
  + '|' + /\b(?:his|her) (?:toe|toes|foot|leg) (?:suddenly )?(?:moved|twitched)\b|\bfirst steps? in (?:years|months)\b|\bwalked across the room\b/.source,
  'i',
);

/* ===== 型A rescue：CAUSE 器质机制真兑付（瘫痪有医学因果） ===== */
const R_CAUSE_ZH_RE = /脊髓(?:损伤|受损|断裂|横断|挫伤|震荡|受压)|脊柱(?:骨折|损伤|错位|滑脱|断裂)|脊(?:椎|柱)(?:骨)?(?:骨折|断裂|错位)|椎(?:体|弓)(?:压缩性)?(?:骨折|爆裂)|腰椎(?:骨折|压缩|滑脱|错位|爆裂|骨折)|颈椎(?:骨折|损伤|滑脱)|(?:脊柱|脊髓)?神经(?:受压|压迫|断裂|损伤|挫伤)|椎间盘(?:突出|脱出|膨出)|横断(?:性)?脊髓炎|高位截瘫|(?:中风|脑卒中|脑溢血|脑出血|脑梗)[^。！？\n]{0,8}(?:偏瘫|半身不遂)|偏瘫|减压(?:手术)?|(?:钢(?:板|钉)|钛钉)固定|脊柱融合(?:术)?|器质(?:性)?(?:损伤|病变|病因)/;

const R_CAUSE_EN_RE = /\bspinal cord (?:injury|damage|severed|transected|contusion|compression)\b|\bsevered spinal cord\b|\bspinal (?:fracture|injury)\b|\bfractured (?:his|her) spine\b|\bvertebral (?:compression )?fracture\b|\bburst fracture\b|\bbroken (?:vertebra|vertebrae)\b|\bherniated disc\b|\bnerve compression\b|\bcompressed (?:spinal )?nerve\b|\bdamaged spinal cord\b|\btransverse myelitis\b|\bstroke[^.?!\n]{0,14}?hemipleg\w*\b|\bhemiplegia\b|\bparaplegia\b|\bdecompression surgery\b|\bspinal fusion\b|\bsteel rods? in (?:his|her) spine\b|\borganic cause\b/i;

/* 型A rescue：DIAG 规范就医过程（瘫痪不是现场宣布） */
const R_DIAG_ZH_RE = /核磁(?:共振)?|MRI|磁共振|CT(?:片|检查|扫描|影像)?|X光|X线|神经(?:内|外)科|骨科|脊柱(?:外)?科|康复(?:科|医学科)|肌电图|体感诱发电位|会诊|确诊(?:为|是)|(?:做|拍)(?:了|过)?[^。！？\n]{0,8}(?:核磁|CT|X光|磁共振|肌电图)|手术(?:室|同意书|减压|固定)|主治医生|检查报告|诊断书|住院(?:观察|检查)|观察了?[^。！？\n]{0,4}天/;

const R_DIAG_EN_RE = /\bMRI\b|\bCT scan\b|\bCAT scan\b|\bX-?ray\b|\bneurologist\b|\bneurosurgeon\b|\borthopedic(?: surgeon)?\b|\bspine specialist\b|\brehab specialist\b|\bEMG\b|\bsomatosensory evoked potential\b|\bconfirmed the (?:spinal|nerve)\b|\bdiagnosed with\b|\bdecompression surgery\b|\bspinal fusion\b|\boperating room\b|\bsurgical consult\b|\badmitted for (?:observation|tests)\b|\bseries of scans\b/i;

/* 型A rescue：PRICE 永久/长期代价（阀门没被掰回去；只收真实生活代价/适应方式与并发症，
   裸的"终身瘫痪/再也站不起来"只是复述瘫痪结果，与 PARA_STRONG 重叠，不得自救） */
const R_PRICE_ZH_RE = /只能(?:靠|用)(?:轮椅|拐杖|助行器)(?:出行|代步|走路|移动)|轮椅(?:代步|进出)|靠轮椅(?:出行|移动)|(?:家|门口|屋里|院子)[^。！？\n]{0,6}(?:坡道|斜坡|改造|改了)|褥疮|压疮|导尿(?:管|袋)?|大小便(?:失禁|不能自理)|接尿|由人(?:喂饭|擦洗|翻身|背着)|(?:妻子|母亲|丈夫|家人)(?:推|搀)着?(?:轮椅)?|学(?:着|会)?(?:坐|操控|摇)(?:轮椅)|接受(?:了)?(?:自己)?(?:一辈子)?(?:坐)?轮椅|残疾(?:证|金|人证)|护工|护理床/;

const R_PRICE_EN_RE = /\bwheelchair ramp\b|\b(?:house|home) modified for (?:the )?wheelchair\b|\bbedsores\b|\bpressure sores\b|\bcatheter(?:ized| bag)?\b|\bincontinent\b|\bincontinence\b|\bneeded (?:help )?(?:to )?(?:bathe|dress|transfer|eat)\b|\bcaregiver\b|\bhome nurse\b|\blearned to (?:navigate|maneuver) (?:the )?wheelchair\b|\baccepted the wheelchair\b|\bdisability pension\b|\bphysical aide\b|\bpushed (?:him|her) in the wheelchair\b/i;

/* ===== 型B rescue：CPROCESS 康复渐进过程（站起不该是当场满血） ===== */
const R_CPROCESS_ZH_RE = /康复训练|康复(?:科|中心|医院|医学科)|物理治疗|理疗|运动疗法|步态训练|康复师|理疗师|复健(?:训练|中心)?|(?:好?几|数|\d+)(?:个?月|年)[^。！？\n]{0,10}(?:康复|训练|理疗|针灸|复健|治疗)|先(?:是|学会)[^。！？\n]{0,10}(?:坐|翻身|动大?脚趾|爬)|从(?:动|活动|晃)脚趾(?:开始|学起)|站(?:平衡)?训练|站立训练|肌力(?:训练)?|平衡训练|支(?:具|架)|矫形器|护腰|一(?:天|点)(?:一?点|天比一天)[^。！？\n]{0,8}(?:站|走|有力气|稳)|渐渐(?:能|会)?(?:站|走|迈步|挪步)|慢慢(?:练|学|站|走|挪)|一天天(?:好起来|有起色)/;

const R_CPROCESS_EN_RE = /\bphysical therapy\b|\bphysiotherapy\b|\brehab(?:ilitation)? (?:center|clinic|program|sessions?)\b|\bPT sessions?\b|\bgait training\b|\boccupational therapy\b|\bphysiotherapist\b|\brehab specialist\b|\bmonths? of (?:rehab|PT|therapy|physical therapy)\b|\byears? of rehab\b|\blearned to sit first\b|\blearned to roll over first\b|\bstarted (?:by )?(?:moving|wiggling) (?:a|his|her) toe\b|\bbalance training\b|\bstanding exercises?\b|\bbuilt up (?:leg )?strength\b|\bleg braces?\b|\borthotic\b|\bback brace\b|\blittle by little\b|\bday by day\b|\bgradually (?:regained|learned|stood)\b|\bone day at a time\b/i;

/* 型B rescue：PARTIAL 未完全恢复（电灯拉亮但电压不稳） */
const R_PARTIAL_ZH_RE = /拄(?:着)?(?:拐|双拐|拐杖)|靠(?:拐杖|双拐|助行器|支具|人搀)|助行器|只能(?:站|走)[^。！？\n]{0,4}(?:几分钟|几步|一小会儿|片刻)|走(?:了)?(?:几|两三)步(?:就|便|也)(?:喘|累|晃|软|撑不住)|一(?:条|只)腿(?:还|依旧)(?:拖|使不上|发软|跛|没力)|踉跄|踉踉跄跄|跛(?:着|着走|脚)|瘸(?:着)?|没(?:有)?完全(?:恢复|好)|时好时坏|腿(?:还是|依旧)(?:软|没劲|使不上劲|发颤)|还(?:得|要|需要)(?:坐|靠|用)(?:轮椅|拐|支具)|站(?:久|一会)儿?就(?:疼|抖|撑不住|冒汗)/;

const R_PARTIAL_EN_RE = /\bon crutches\b|\bwith crutches\b|\bused (?:a|the|his|her) walker\b|\bleg brace\b|\bankle brace\b|\bcould only stand for (?:a )?(?:moment|minute)\b|\btook (?:two|three|a few) (?:shaky |wobbly )?steps?\b|\bdragged one leg\b|\blimp(?:ed|ing)?\b|\bshuffled\b|\bnever fully recovered\b|\bpartial recovery\b|\bstill weak\b|\blegs? still (?:unsteady|shaky|wobbly)\b|\bremained unsteady\b|\bwould (?:still )?need the wheelchair\b|\bgood days and bad\b|\bsupported by (?:his|her) arm\b/i;

/* 型B rescue：COST 求治代价（重新走路有价格） */
const R_COST_ZH_RE = /经年(?:求医|累月|治疗)|(?:好?几|数|\d+)年(?:求医|治疗|康复|针灸|复健)|倾家荡产|砸锅卖铁|借遍|负债|医药费(?:高昂)?|手术费(?:高昂)?|进口(?:钢钉|钢板|器材)|康复(?:中心|医院)(?:的)?(?:费用|天价|昂贵)|手术(?:风险|同意书|并发症)|脊柱手术(?:的)?(?:风险|危险)|钢钉钢板(?:的)?(?:价格|费用)|(?:神医|名医|大师|活佛)[^。！？\n]{0,12}(?:代价|条件|规矩|不收留|难请|不肯治)/;

const R_COST_EN_RE = /\byears? of (?:seeking treatment|treatment|doctors|therapy|rehab)\b|\bcost a fortune\b|\bmedical bills\b|\bdrained (?:their|the|his|her) savings\b|\blife savings\b|\bimported (?:steel )?rods\b|\bexpensive surgery\b|\brehab(?:ilitation)? (?:cost|center cost|was)\b|\bsurgical risks?\b|\brisky surgery\b|\bconsent form\b|\bdoctor (?:refused|set a price|was hard to find|would only treat (?:him|her) if)\b|\bprice of the cure\b/i;

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
 * 纯函数：检测"瘫痪/秒愈剧情阀门/肢体移动通道当开关"密度病。
 */
export function paralysisOnCue(draft: string): ParalysisOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const causeRe = zh ? CAUSE_ZH_RE : CAUSE_EN_RE;
  const paraStrongRe = zh ? PARA_STRONG_ZH_RE : PARA_STRONG_EN_RE;
  const paraWeakRe = zh ? PARA_WEAK_ZH_RE : PARA_WEAK_EN_RE;
  const mobCtxRe = zh ? MOBCTX_ZH_RE : MOBCTX_EN_RE;
  const feignRe = zh ? FEIGN_ZH_RE : FEIGN_EN_RE;
  const wakeGuardRe = zh ? WAKEGUARD_ZH_RE : WAKEGUARD_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const stateRe = zh ? STATE_ZH_RE : STATE_EN_RE;
  const mobileRe = zh ? MOBILE_ZH_RE : MOBILE_EN_RE;
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
  const hasParaStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasParaWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasMobCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasState: boolean[] = new Array(rawLines.length).fill(false);
  const hasMobile: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasCause[i] = causeRe.test(line);
    hasParaStrong[i] = paraStrongRe.test(line);
    hasParaWeak[i] = paraWeakRe.test(line);
    hasMobCtx[i] = mobCtxRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasState[i] = stateRe.test(line);
    hasMobile[i] = mobileRe.test(line);
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

  /** 装瘫/装瘸让路（事件窗口内有装瘫锚——不是失能是演戏） */
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

  /** 昏迷苏醒让路（事件窗口内有昏迷/植物人锚——醒来不能动归 wake-on-cue） */
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

  /* 型A：CAUSE 组 ±2 行找 PARA（强档直配；弱档需 ±3 行 MOBCTX 语境） */
  for (const g of groupRows(hasCause)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let paraLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasParaStrong[j]) { paraLine = j; strongHit = true; break; }
      if (paraLine < 0 && hasParaWeak[j]) paraLine = j;
    }
    if (paraLine < 0) continue; /* 事故受伤但没有瘫痪：普通外伤放行 */
    if (comaInWindow(Math.min(g.start, paraLine), Math.max(g.end, paraLine), sceneOf[g.start])) continue;
    if (feignInWindow(Math.min(g.start, paraLine), Math.max(g.end, paraLine), sceneOf[g.start])) continue;
    let ctxOk = strongHit;
    if (!ctxOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, paraLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasMobCtx[j] || hasParaStrong[j]) { ctxOk = true; break; }
      }
    }
    if (!ctxOk) continue; /* 仅裸腿麻/两腿发软无脊柱损伤语境：惊吓蹲麻短暂反应放行 */

    const causeM = (rawLines[g.start].match(causeRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const paraM = (rawLines[paraLine].match(strongHit ? paraStrongRe : paraWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, paraLine),
      anchorEnd: paraLine,
      kind: 'onset',
      marker: `${causeM}→${paraM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 MOBILE，且 ±3 行窗口内必须有 STATE 长期瘫痪状态（健康人站起放行） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let mobileLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasMobile[j]) { mobileLine = j; break; }
    }
    if (mobileLine < 0) continue; /* 有求医/正骨但没有当场行动：仍在治疗/康复中放行 */
    const evStart = Math.min(g.start, mobileLine);
    const evEnd = Math.max(g.end, mobileLine);
    let stateOk = false;
    const slo = Math.max(0, evStart - CONTEXT_PAD);
    const shi = Math.min(rawLines.length - 1, evEnd + CONTEXT_PAD);
    for (let j = slo; j <= shi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      /* STATE 行不得就是 TRIGGER 行自身（"银针扎脊柱"自带脊柱词，STATE_RE 已隔离裸脊柱，此处双保险跳过 TRIGGER 组行） */
      if (j >= g.start && j <= g.end) continue;
      if (hasState[j] || hasParaStrong[j]) { stateOk = true; break; }
    }
    if (!stateOk) continue; /* 无长期瘫痪前提：健康人被救后站起、扭伤后走动放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const mobileM = (rawLines[mobileLine].match(mobileRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: evStart,
      end: evEnd,
      anchorEnd: mobileLine,
      kind: 'cure',
      marker: `${trigM}→${mobileM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: ParalysisOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次瘫痪桥段是类型刚需） */
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
          ? '又是事故秒瘫痪——脚手架上摔下来、一场车祸、一根钢梁砸在后腰、矿井塌方、子弹打中脊梁，三行之内他下半身没了知觉、双腿瘫痪、这辈子再也站不起来；没有脊髓损伤、没有椎体骨折、没有核磁共振和神经外科会诊，瘫痪是制造苦情、困住证人、扣押行动能力的即时枷锁，"神医扎一针站起来"救不了这段（它本身就是廉价秒愈的病象）'
          : 'another accident-to-paralysis beat - a fall from the scaffolding, a car crash, a steel beam across the lower back, a mine collapse, a bullet in the spine, and within three lines he has no feeling below the waist, both legs are paralyzed and he will never walk again; no spinal cord injury named, no fractured vertebra, no MRI and no neurosurgical consult; paralysis is an instant padlock used to manufacture suffering, trap a witness and impound the hero\'s mobility, and "one silver needle and he stood up" does not rescue this beat (that is the cheap-cure disease itself)')
        : (zh
          ? '又是廉价秒愈——坐了三年轮椅的人，神医一根银针沿脊柱扎下、正骨师咔嚓一声把腰一扳、灵药膏药下肚、活佛发功摸了一下、情急之下孩子坠楼他猛地从轮椅上站起来就追；没有康复训练、没有先动脚趾再学站的过程、没有拄拐踉跄的尾巴、没有复健带回的价格；下一集他翻墙跳崖样样来，腿是编剧的电灯开关：需要苦情时一拉全灭，需要圆满时一拉全亮'
          : 'another cheap instant-cure beat - a man in a wheelchair for three years: a famed doctor drives a silver needle down the spine, a bonesetter snaps his lower back into place with one crack, a herbal plaster goes on, a holy man lays on hands, or in desperation as the child falls he leaps up from the wheelchair and gives chase; no rehab, no period of learning to move a toe before learning to stand, no crutches and no stagger, no price attached to the recovery; next episode he leaps walls and drops from cliffs - the legs are the writer\'s light switch: total immobility when suffering is needed, full function when a happy ending is due'),
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
      ? `${hitCount} 处"瘫痪/秒愈剧情阀门"（事故秒瘫 ${onsetCount} 处、廉价秒愈 ${cureCount} 处，${n} 处未救）——肢体移动通道成了随取随用的电灯开关：需要苦情时一场车祸一根钢梁三行内下半身没了知觉、这辈子再也站不起来，不要脊髓损伤和核磁会诊；需要圆满时银针脊柱/正骨一扳/扔下轮椅当场健步如飞，不要康复训练和尾巴。第一次是类型桥段，第三次观众就看穿：这个剧里瘫痪从来不是伤，是可以一键瘫痪又一键站起的扳手；而每回瘫痪都不给就医过程、每回站起都不留尾巴，瘫痪和痊愈双双贬值。`
      : `${hitCount} paralysis-on-cue beat(s) (${onsetCount} instant paralysis, ${cureCount} instant cure; ${n} unrescued) - mobility is a light switch: when suffering is needed a fall, a car crash or one beam across the back means no feeling below the waist and never walking again in three lines, with no spinal cord injury and no MRI workup; when relief is needed a needle down the spine, one chiropractic crack or the wheelchair tossed aside restores full function instantly, with no rehab and no after-tail. Once is genre grammar; by the third, the audience sees paralysis is never an injury in this story, only a wrench that paralyzes and restores on command - and when every paralyzing skips the medicine and every cure skips the tail, both the wheelchair and the standing lose their value.`);
    advice.push(zh
      ? '让失能恢复它应有的重量与麻烦。事故秒瘫型：①让机制真兑付——脊髓损伤、脊柱骨折、椎体压缩性或爆裂骨折、腰椎颈椎滑脱错位、神经压迫或断裂、椎间盘突出、横断性脊髓炎、中风偏瘫、减压钢钉固定，打击和瘫痪之间要有医学因果，医生嘴里要有具体诊断而不是一句"再也站不起来"；②让就医有过程——核磁共振、CT、X光、神经外科、骨科、脊柱科、康复科、肌电图、会诊、住院观察、数天后才确诊，瘫痪不能在车祸现场一句话宣判；③要么让代价真留下——终身靠轮椅拐杖出行、家里为轮椅改坡道、褥疮压疮、导尿和大小便失禁、靠家人喂饭擦洗翻身、学着自己操控轮椅、接受轮椅、领残疾证，这次没有神医反转，苦情戏才值钱；裸的"一辈子站不起来"只是复述病状不是代价，"扎一针站起来"也不救瘫痪戏，它本身就是秒愈的病象。廉价秒愈型：④让站起有康复过程——康复训练、物理治疗理疗、数月数年康复中心，先学会翻身和坐、先能动大脚趾，再练站平衡、练步态，配支具矫形器，一天比一天有力气，站起不该是当场满血出厂设置；⑤给电灯留电压不稳的尾巴——拄双拐、靠助行器和支具、只能站几分钟、走两三步就喘、一条腿还拖着、跛行踉跄、时好时坏、还得回轮椅，下一场戏要有他扶墙挪步和放下拐杖时手臂上的青筋；⑥如果必须站起来，让它带着价格——经年累月求医、倾家荡产的医药费、进口钢钉和天价手术、天价康复中心、手术风险和同意书、神医的条件与拒绝，重获行走不该是免费的圆满。最忌讳一集两回"一场车祸→下半身瘫痪→神医银针扎脊柱→咔嚓一扳扔下轮椅就追→追上凶手打脸"。腿若要拉闸，就得真的改变生活；若要合闸，也不能白合闸。'
      : 'Give the lost mobility its real weight and its real hassle. For instant-paralysis beats: (1) let the mechanism in - a spinal cord injury, a fractured spine, a vertebral compression or burst fracture, a dislocated lumbar or cervical vertebra, nerve compression or severance, a herniated disc, transverse myelitis, post-stroke hemiplegia, decompression and steel-rod fixation; there must be a medical cause between the blow and the immobility, and the doctor must name a diagnosis instead of just declaring "he will never walk again". (2) Let the medicine take a process - MRI, CT, X-ray, neurosurgery, orthopedics, the spine unit, rehab medicine, an EMG, consults, admission and observation, a diagnosis days later; paralysis cannot be announced in one line at the crash site. (3) Or let the cost remain - lifelong dependence on wheelchair or crutches, ramps built into the house, bedsores and pressure sores, a catheter and incontinence, family members feeding and washing and turning him, learning to navigate the wheelchair, accepting it, disability papers; when no miracle-doctor reversal arrives, the suffering finally costs something; a bare "he will never walk again" is only restating the symptom, not paying a price, and "one needle and he stood" never rescues a paralyzing beat, because that is the instant-cure disease itself. For cheap-cure beats: (4) give the recovery a rehab process - physical therapy, physiotherapy, months or years at a rehab center; first he learns to roll and sit, then a toe moves, then balance work, then gait training, braces and orthotics, strength returning day by day; standing must not be factory-set full function. (5) Leave the light switch a faulty tail - two crutches, a walker or a brace, standing only for a minute, winded after two steps, one leg still dragging, a limp and a stagger, good days and bad days, back into the wheelchair; the next scene needs him edging along a wall and the tendons in his arm when he sets the crutch down. (6) If he must stand, make it cost something - years of doctors, bills that bankrupt the family, imported steel hardware, a fortune for the surgery and the rehab center, surgical risks and consent forms, the healer\'s price or refusal; regaining walking must not be a free happy ending. The unforgivable pattern is two "a car crash -> paralyzed from the waist down -> famed doctor needles the spine -> one crack, wheelchair tossed, he runs -> catches the killer and wins" loops per episode. If the legs go off, a life must genuinely change; if they come back on, it must not be for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
