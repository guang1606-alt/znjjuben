import { isSceneHeaderLine } from './script-scenes';
/**
 * 中毒秒解毒 / 毒物当编剧开关检测（v2.109 块117，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把毒物当成随取随用的剧情开关，两种形态反复出现——
 *   A 接触秒中毒型：一杯毒酒、一盏毒茶、被毒蛇咬一口、毒针轻轻一扎，
 *     三行之内七窍流血、口吐白沫、奄奄一息，大夫摇头开始准备后事；
 *     没有毒理化验、没有催吐洗胃、没有血清透析，中毒是制造生离死别、
 *     逼男主表态、让反派摊牌的即时病危通知书；
 *   B 廉价秒解毒型：剧情需要圆满时，一颗解药、神医一丸丹药、运功
 *     逼毒、嘴吸毒血，当场活蹦乱跳跟没事人一样，无疗程、无观察、
 *     无余毒后遗症，下一场戏该报仇报仇该圆房圆房；
 *     毒物是编剧的电灯开关：需要虐心时一拉全灭，需要圆满时一拉全亮。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里中毒从来不是病，
 *   是可以一键毒倒又一键救活的情节扳手，毒发和解毒双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - poison-ledger：跨集生理中毒状态连续性账本（poisoned/cured/
 *    healthy 三态矛盾穿帮，人名确定性提取，不进 deai）；本引擎管
 *    单集"接触秒中毒、解药秒痊愈"密度病——同 memory-ledger 与
 *    amnesia-on-cue 的分工模式，不双计；
 *  - truth-serum：药物绕意志取真话（吐真剂/蒙汗药/硫喷妥钠）；本
 *    引擎管毒物绕生理夺命与廉价活命，化学开关镜像兄弟，词表硬
 *    隔离（本引擎锚毒酒/砒霜/蛇咬/解药，不含吐真/招供词族）；
 *  - allergy-on-cue：一顿饭内急性免疫引爆拆除；本引擎锚外物投毒/
 *    服毒/蛇咬/毒针，与免疫词表正交；
 *  - terminal-diagnosis-on-cue：长期绝症宣判与撤销；本引擎是急性
 *    毒发危象与廉价解毒；
 *  - wound-on-cue：外伤战力阀门；本引擎专管毒理危象，普通挨打
 *    断腿放行；
 *  - faint-on-cue：晕倒阀门管意识丧失；本引擎"昏迷不醒"只作
 *    STRONG 危象锚且必须有中毒病因配对，普通晕倒不误判；
 *  - 身体阀门家族第九员（晕倒→病床→伤势→妊娠→颅脑记忆→绝症→
 *    急性免疫→视觉→中毒）；creativity/宫斗/宅斗/悬疑技能零训诫。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A onset（接触秒中毒）：
 *    INGEST 中毒病因锚 ±2行与 CRISIS 危象锚共现。INGEST 两源——
 *    SPEC 毒物明锚（酒里下毒/喝下毒酒毒茶/被投毒/服毒/砒霜/鹤顶红/
 *    农药/毒针毒簪/毒蛇咬伤/吸入毒气/中毒毒发状态 + poisoned wine/
 *    spiked drink/was poisoned/arsenic/cyanide/snakebite/venom…）
 *    自带毒物语义；GENERIC 泛饮误食锚（喝了一杯酒/吃了东西/服了药
 *    + drank the wine/took the medicine/ate the soup…）只是吃喝
 *    动作，不自带毒物语义。CRISIS 分两档——STRONG（七窍流血/口吐
 *    白沫/毒发身亡/奄奄一息/昏迷抽搐/大夫摇头准备后事 + foaming at
 *    the mouth/convulsions/lay dying/comatose/doctor gave up…）自带
 *    危象语义：SPEC 病因直配，GENERIC 病因必须在事件 ±3 行窗口内
 *    另有 TOXCTX 毒理语境锚（中毒/剧毒/毒发/毒素/蛇毒/砒霜 + poison/
 *    toxin/venom/arsenic/toxicology…；解药/药丸不算语境，它们是
 *    型B的解除锚）；WEAK（腹痛/呕吐/脸色发青/头晕/冷汗 + stomach
 *    pain/vomited/lips turning pale/cold sweat…）无论病因来源都
 *    必须有 TOXCTX 兜底，防醉酒呕吐/吃坏肚子/普通挨打误判；
 *    纯吃喝无危象放行，纯危象无毒因放行，纯中毒陈述无危象放行；
 *  - 型B cure（廉价秒解毒）：
 *    TRIGGER 廉价解除锚（解药/解毒丹/神医一丸药/运功逼毒/以毒攻毒/
 *    嘴吸毒血/偏方催吐 + antidote/antivenom/magic pill/famed doctor's
 *    elixir/sucked the venom out/forced the poison out…）±2行与
 *    FINE 整体秒愈锚共现；FINE 必须是瞬时整体恢复（当场没事/立刻
 *    痊愈/活蹦乱跳/毒全解了 + instantly fine/good as new/back on her
 *    feet/poison completely gone…，须瞬时修饰）；无触发物的缓慢
 *    好转（调养两个月慢慢恢复）合法放行；
 *  - 相邻 ≤2 行的 INGEST/TRIGGER 行各自合并为同一事件（跨场景头
 *    不合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CAUSE 毒理真兑付——毒理化验/鉴定出具体毒素/剂量/毒素
 *      侵入肝肾神经/呼吸衰竭机理，中毒与危象之间有医学因果；
 *      ②DIAG 规范就医过程——催吐洗胃/活性炭/血液灌流透析/抗毒
 *      血清/ICU抢救数小时/留院观察，危象不是现场宣判；③PRICE
 *      长期或永久代价——真的死去/再没醒来/后遗症/神经肝肾损伤/
 *      长期调养/终身服药，阀门这次没被掰回去；"一颗解药就好"
 *      不救 onset（它本身就是型B病象）；
 *    型B：①CPROCESS 救治过程——洗胃/透析/数日昏迷/血清注射后
 *      观察/反复清血/数月恢复，解毒不是一颗药丸即出厂设置；
 *      ②PARTIAL 未完全恢复——余毒未清/体弱/后遗症/可能复发/
 *      还要喝几个月药，电灯拉亮但电压不稳；③COST 代价——解药
 *      世上只有一颗/难寻/以命换药/制药者牺牲/倾家荡产/解药本身
 *      有毒副作用，圆满有价格；
 *  - 第 1 次豁免（一次中毒桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface PoisonOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** onset=接触秒中毒型；cure=廉价秒解毒型 */
  kind: 'onset' | 'cure';
  /** 是否有毒理兑付/规范就医/代价/救治过程/部分恢复/解药代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface PoisonOnCueResult {
  score: number;
  /** 中毒阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: PoisonOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：INGEST-SPEC 毒物明锚（自带毒物语义，STRONG 直配） ===== */
const INGEST_SPEC_ZH_RE = new RegExp(
  /(?:酒|茶|汤|水|羹|奶|粥|咖啡|糕点?|点心|饭菜|食物|药膳|杯子?|碗)[^。！？\n]{0,4}(?:被)?(?:下|投|放|掺|兑|混)(?:了|入|进)?毒/.source
  + '|' + /(?:下|投|放|掺|兑)了?毒|被(?:人)?(?:下|投|放)了?毒|遭人投毒|暗中投毒/.source
  + '|' + /(?:喝|饮|吃|尝|服|吞|抿)[^。！？\n]{0,8}(?:毒酒|毒茶|毒汤|毒羹|毒药|毒丸|毒丹|毒散|毒粥|毒奶|砒霜|鹤顶红|鸩酒?|鸩毒|农药|老鼠药|鼠药|毒蘑菇|断肠草|曼陀罗|夹竹桃)/.source
  + '|' + /服毒(?:自尽|自杀|身亡|而死|而亡)?|吞金(?:自尽|自杀)?|吞(?:下|服|了)[^。！？\n]{0,6}(?:毒药|砒霜|农药|安眠药|鼠药)|整瓶安眠药|一把安眠药/.source
  + '|' + /(?:毒针|毒簪|毒簪子|毒匕(?:首)?|毒刀|毒剑|毒镖|毒刺|毒指甲)[^。！？\n]{0,8}(?:刺|扎|划|划伤|擦伤|捅|抹|挑)/.source
  + '|' + /(?:被|遭|让|给)[^。！？\n]{0,8}(?:毒针|毒簪|毒蛇|毒蜘蛛|毒蝎)[^。！？\n]{0,8}(?:咬|刺|扎|伤|蛰|螫)/.source
  + '|' + /(?:毒蛇|蝮蛇|眼镜蛇|银环蛇|蛇|毒蜘蛛|蝎子)[^。！？\n]{0,4}(?:咬(?:伤|了|中)?|蛰(?:伤|了)?|螫(?:伤|了)?)/.source
  + '|' + /蛇毒(?:发作|攻心|入体|蔓延)?|吸入(?:了)?(?:毒气|毒烟|毒粉|毒雾)|(?:沾|碰|染)(?:上|到)?了?(?:毒液|毒粉|剧毒)/.source
  + '|' + /中毒(?:了|很深|不浅|身亡|倒地|危殆|发作)?|毒气攻心|毒性(?:发作|蔓延|攻心)|毒发(?:身亡|毙命|危殆|了)?|毒药(?:发作|攻心)?/.source,
);

const INGEST_SPEC_EN_RE = new RegExp(
  /\b(?:wine|tea|soup|broth|water|milk|medicine|food|cake|pastry|dumplings?|goblet|cup|bowl)\b[^.?!\n]{0,12}?\b(?:was|had been|were)?\s*(?:spiked|poisoned|laced)(?:\s+with)?\b/.source
  + '|' + /\bspiked (?:his|her|their|the)? ?(?:drink|wine|tea|water|soup|broth|goblet|cup|medicine)\b/.source
  + '|' + /\b(?:was|were|got|had been|had) poison(?:ed|ing)\b|\bpoison(?:er|ing) (?:him|her|them)\b|\blaced with poison\b/.source
  + '|' + /\b(?:drank|swallowed|took|ate|ingested|sipped)\b[^.?!\n]{0,18}?\b(?:poison(?:ed|ous)? (?:wine|tea|soup|broth|medicine|food|water|draught|potion)|arsenic|cyanide|strychnine|hemlock|nightshade|pesticide|rat poison|toxic mushroom)\b/.source
  + '|' + /\btook poison\b|\bswallowed poison\b|\bdrank poison\b|\bpoison(?:ed|ing) herself\b|\bsuicide by poison\b/.source
  + '|' + /\b(?:sleeping-?pill|barbiturate|sleeping tablet) overdose\b|\boverdosed on sleeping pills\b|\bwhole bottle of sleeping pills\b/.source
  + '|' + /\b(?:poisoned|envenomed|venom-?tipped) (?:needle|dart|blade|dagger|hairpin|arrow|pin|stab)\b/.source
  + '|' + /\b(?:was|got|been) bitten by (?:a )?(?:poisonous |venomous )?(?:snake|viper|serpent|spider|scorpion)\b|\bsnake ?bite\b|\bvenom(?:ous)? (?:snake|bite|wound)\b|\bsnake venom\b|\bviper(?:\x27s)? (?:fangs|bite)\b/.source
  + '|' + /\binhaled (?:poison(?:ous)? (?:gas|fumes|powder|mist)|toxic fumes|venom)\b|\bpoison(?:ous)? gas\b|\btouched the venom\b|\bvenom on (?:the )?(?:blade|dart|needle)\b/.source
  + '|' + /\bacute poisoning\b|\b(?:the )?poison(?:ing)? (?:took effect|worked|spread|set in|killed her|killed him)\b|\bvenom spread\b|\btoxic(?:ity|osis) (?:set in|took hold)\b/.source,
  'i',
);

/* INGEST-GENERIC 泛饮误食锚（不自带毒物语义；配 WEAK 或 STRONG 均须 TOXCTX 兜底） */
const INGEST_GENERIC_ZH_RE = new RegExp(
  /(?:喝|饮|干了?|抿了?|尝了?)[^。！？\n]{0,10}(?:酒|茶|汤|药|水|羹|奶|咖啡|粥)/.source
  + '|' + /(?:吃|吞|服)[^。！？\n]{0,10}(?:东西|饭|点心|糕点?|药|粥|水果|蘑菇|肉|汤)/.source
  + '|' + /(?:干|饮尽|喝下|喝完)(?:了)?(?:那|这)?(?:一)?(?:杯|碗|盏)|端起[^。！？\n]{0,6}(?:喝|饮)/.source,
);

const INGEST_GENERIC_EN_RE = new RegExp(
  /\bdrank (?:down )?(?:the|a|an|his|her|their|some|that) (?:wine|tea|soup|broth|medicine|water|milk|potion|draught|cup|bowl|goblet)\b/.source
  + '|' + /\btook (?:the|a|an|his|her|their) (?:medicine|pills?|potion|tablet)\b|\bswallowed the (?:pills?|medicine|tablet)\b/.source
  + '|' + /\bate (?:the|some|a|an|his|her|their) (?:soup|food|cake|pastry|dumplings?|meal|mushrooms?|stew)\b/.source
  + '|' + /\bemptied (?:the|his|her|their) (?:glass|cup|goblet|bowl)\b|\bdrained the cup\b/.source,
  'i',
);

/* CRISIS 强档：自带危象语义的结果锚（SPEC 病因直配；GENERIC 病因须毒理语境兜底） */
const CRISIS_STRONG_ZH_RE = /七窍流血|七孔流血|七窍(?:渗|流)血|口吐白沫|嘴(?:角|里)(?:淌|溢|流|渗)(?:黑血|鲜血|血沫)?|(?:吐|呕|咳)(?:出)?(?:一?口)?(?:黑血|鲜血|血沫)|全身(?:发)?乌黑|脸色(?:乌|铁)青|嘴唇(?:乌|发乌|青紫)|指甲(?:发)?黑|毒发身亡|毒发毙命|中毒身亡|中毒而(?:死|亡)|当场毙命|当场死亡|气绝身亡|一命呜呼|浑身抽搐|全身抽搐|抽搐不止|不断抽搐|满地打滚|奄奄一息|只剩(?:下)?(?:半|一)口气|命悬一线|命在旦夕|命若游丝|停止(?:了)?呼吸|没了呼吸|呼吸(?:停止|微弱)|深度昏迷|昏迷不醒|不省人事|昏死过去|大夫摇头|医生摇头|郎中摇头|准备(?:后事|棺材)|无力回天|回天乏术|回天无力|群医束手/;

const CRISIS_STRONG_EN_RE = /\bfoaming at the mouth\b|\bfoamed at the mouth\b|\bfroth(?:ed|y) at the lips\b|\bbleeding from (?:the eyes|the ears|every orifice|her eyes|his eyes)\b|\bblack blood\b|\bblackened lips\b|\blips turned (?:black|blue|purple)\b|\bfingernails? turned black\b|\bconvuls(?:ed|ions|ing)\b|\bseized with convulsions\b|\bdied on the spot\b|\bdied instantly\b|\bdropped dead\b|\blay dying\b|\bcollapsed dying\b|\bwrithing on the floor\b|\blife hung by a thread\b|\bon her last breath\b|\bon his last breath\b|\bgasping (?:for breath|her last)\b|\bstopped breathing\b|\bwasn'?t breathing\b|\bunconscious\b|\bunresponsive\b|\bdeep coma\b|\bcomatose\b|\bdoctor said nothing could be done\b|\bdoctors shook their heads\b|\bgiven up for dead\b|\bdeath rattle\b|\bbeyond saving\b|\bno hope of saving\b/i;

/* CRISIS 弱档：轻症中毒反应（无论病因来源，均须 TOXCTX 毒理语境兜底） */
const CRISIS_WEAK_ZH_RE = /腹痛(?:如绞|难忍|绞痛)?|肚子(?:疼|痛|绞痛)|胃里(?:翻江倒海|一阵?翻腾|难受)|恶心(?:想吐)?|想(?:要)?吐|干呕|呕吐|吐了?(?:一地|起来)?|一阵?呕吐|脸色(?:发)?(?:青|白|苍白|煞白)|嘴唇(?:发)?(?:白)|没了?血色|头晕(?:目眩|眼花)?|头昏|眼前(?:发)?晕|天旋地转|浑身(?:发)?冷|冷汗|直冒冷汗|四肢(?:无力|发麻|发软)|手脚(?:发)?(?:麻|软)|身子一软|两腿?发软/;

const CRISIS_WEAK_EN_RE = /\bstomach (?:pain|cramps?|ache|pains)\b|\b(?:violent |severe )?cramps?\b|\bnause(?:a|ous|ated)\b|\bvomit(?:ed|ing)?\b|\bthrew up\b|\bgagged\b|\bretched\b|\bdizzy\b|\blight-?headed\b|\bthe room spun\b|\blips? (?:went|turned) (?:pale|white)\b|\bface went (?:pale|white|ashen)\b|\bashen face\b|\bcold sweat\b|\bbroke into a cold sweat\b|\bweak in the knees?\b|\blimbs? went weak\b|\bnumb(?:ness)? in (?:her|his) limbs\b|\bchills?\b/i;

/* 毒理语境锚：弱档反应 / 泛饮误食的强档反应需它兜底（解药/药丸不算语境，那是型B解除锚） */
const TOXCTX_ZH_RE = /中毒|剧毒|毒药|毒物|毒发|毒性|毒素|毒气|毒液|毒烟|毒粉|毒理|蛇毒|蝎毒|鸩(?:毒|酒)?|砒霜|鹤顶红|农药|鼠药|服毒|投毒|下毒|掺毒|毒酒|毒茶|毒汤|乌头碱|有机磷/;

const TOXCTX_EN_RE = /\bpoison(?:ed|ing|ous|er)?\b|\bpoisoning\b|\btoxin\b|\bvenom(?:ous)?\b|\barsenic\b|\bcyanide\b|\bstrychnine\b|\bhemlock\b|\bnightshade\b|\bpesticide\b|\btoxicolog(?:y|ical|ist)\b|\btoxicity\b|\bneurotoxin\b|\benvenom(?:ed|ation)?\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /解药|解毒(?:丹|药|丸|散|汤|珠|片)|百?解丹?|避毒丹/.source
  + '|' + /神(?:医|药)[^。！？\n]{0,10}(?:药丸?|丹药?|方子|一(?:颗|粒|丸))|(?:一颗|一粒|一丸)(?:药丸?|神丹|仙丹|丹药)|仙丹(?:妙药)?|妙药|丹药|金丹/.source
  + '|' + /运功(?:逼|逼出|化)(?:毒|毒气|毒素|毒血)?|真气[^。！？\n]{0,6}(?:逼|化|解)毒|逼出(?:了)?(?:毒|毒气|毒素|毒血)|内力[^。！？\n]{0,6}逼毒/.source
  + '|' + /以毒攻毒|(?:嘴|口)[^。！？\n]{0,4}(?:吸|吮)(?:出)?(?:毒血|蛇毒|毒液|伤口(?:里)?的?毒)?|(?:粪水|污秽|偏方)[^。！？\n]{0,8}(?:催吐|灌下)|灌(?:了)?粪水|放(?:毒)?血逼毒|糯米解毒|雄黄酒(?:逼|解)毒/.source,
);

const TRIGGER_EN_RE = new RegExp(
  /\bantidote\b|\banti-?venom(?:in)?\b|\bcounter-?poison\b|\bpoison cure\b/.source
  + '|' + /\bmagic pill\b|\bcure-?all\b|\bmiracle pill\b|\belixir\b|\b(?:famed|miracle-?working|legendary) doctor'?s? (?:pill|medicine|elixir|pellet)\b|\bherbal (?:remedy|cure|antidote|pellet)\b|\bdivine pill\b/.source
  + '|' + /\bforced the poison out\b|\bpushed the toxin out\b|\bexpelled the poison\b|\bcirculated (?:his|her) inner (?:energy|chi)[^.?!\n]{0,16}?expel/.source
  + '|' + /\bsucked the venom out\b|\bsucked out the poison\b|\bfight(?:ing)? poison with poison\b|\bforced (?:him|her|them) to vomit\b|\bfoul-?tasting emetic\b|\bhome remedy\b|\bcured by a hair of the dog\b/.source,
  'i',
);

/* FINE 整体秒愈锚（须与 TRIGGER 配对，且带瞬时/整体语义；渐进好转不收） */
const FINE_ZH_RE = new RegExp(
  /(?:立刻|马上|瞬间|一刹那?|眨眼间|顷刻间|一转眼|当场|一下子|果然)[^。！？\n]{0,12}(?:没事|好了|痊愈|康复|活蹦乱跳|坐了?起来|站了?起来|毒(?:全|都)?解了|毒素全消|生龙活虎|恢复如初)/.source
  + '|' + /(?:毒|毒素|毒气|余毒|毒性)[^。！？\n]{0,8}(?:全解|尽消|全消|尽除|拔除|化解|解了?)/.source
  + '|' + /(?:没事了?|活蹦乱跳|跟没事人一样|生龙活虎|完好如初|恢复如初|痊愈了?|康复了?)[^。！？\n]{0,10}(?:立刻|马上|当场|瞬间|一转眼|眨眼)/.source
  + '|' + /(?:吐|咳)(?:出)?(?:一?口)?黑?血[^。！？\n]{0,10}(?:立刻|马上|当场)?(?:没事|好了|痊愈|坐起来|站起来)/.source,
);

const FINE_EN_RE = new RegExp(
  /\b(?:immediately|instantly|at once|right away|in seconds|moments later|within moments|the moment)\b[^.?!\n]{0,26}?\b(?:fine|good as new|back on (?:her|his|their) feet|fully recovered|completely recovered|poison (?:was )?gone|toxin (?:was )?gone|recovered completely|sat (?:her|him) up|stood up|none the worse)\b/.source
  + '|' + /\bpoison was completely gone\b|\btoxin had vanished\b|\bfull recovery in (?:seconds|moments)\b|\bback to normal instantly\b|\bcured on the spot\b|\bhealed at once\b/.source
  + '|' + /\b(?:fine|good as new|back on (?:her|his|their) feet|fully recovered)\b[^.?!\n]{0,14}\b(?:immediately|instantly|at once|right away)\b/.source
  + '|' + /\bcoughed up (?:the |black )?blood[^.?!\n]{0,18}?(?:fine|recovered|good as new|back on her feet)\b/i.source,
  'i',
);

/* ===== 型A rescue：CAUSE 毒理真兑付（中毒与危象之间有医学因果；不含毒物名本身，防病因行自救） ===== */
const CAUSE_ZH_RE = /毒?物?化?验|化验(?:结果|报告|科)?|毒?物?鉴定|鉴定(?:结果|报告)?|检测(?:结果|报告)?|毒理(?:学)?(?:分析|报告|检验)?|验(?:出|毒|尸)|乌头碱|有机磷|番木鳖碱|马钱子碱|剂量不足以致命|(?:致命|致死)剂量|剂量(?:很大|超标|过大)|毒素(?:侵|入|扩散|蔓延|攻)[^。！？\n]{0,10}(?:肝|肾|心|肺|神经|血液|五脏)|(?:肝|肾|心|肺)[^。！？\n]{0,8}(?:衰竭|损伤|坏死)|呼吸(?:肌)?(?:麻痹|衰竭)|神经性?毒素|神经(?:系统)?(?:受损|麻痹)|血液(?:里)?的?毒素|毒理(?:反应|作用|机制)/;

const CAUSE_EN_RE = /\btoxicology (?:report|test|lab|screen|panel)\b|\btox screen\b|\blab (?:results?|tests?|confirmed)\b|\btests? confirmed\b|\bautopsy (?:report|findings)?\b|\baconitine\b|\borganophosphate\b|\bthallium\b|\b(?:lethal|fatal|toxic|massive|heavy) dose\b|\bthe toxin (?:had )?(?:attacked|spread to|shut down|reached) (?:the )?(?:liver|kidneys?|heart|lungs?|nerves?|bloodstream)\b|\b(?:liver|kidney|cardiac|respiratory) failure\b|\brespiratory paralysis\b|\bnerve agent\b|\bneurotoxin\b|\bnecro(?:sis|tic) tissue\b|\bmechanism of the poison\b/i;

/* 型A rescue：DIAG 规范就医过程（危象不是现场宣判） */
const DIAG_ZH_RE = /催吐|洗胃|灌肠|活性炭|血液(?:灌流|净化|透析|滤过)|血滤|透析|换血(?:疗法)?|抗(?:毒|蛇毒)血清|血清(?:注射|针剂|疗法)?|打(?:了)?血清|ICU|重症监护|抢救(?:了)?[^。！？\n]{0,8}(?:小时|天|夜|番)|连夜抢救|紧急抢救|输液|挂(?:着)?点滴|留(?:院|医)观察|呼吸机|洗胃机|急诊(?:科|室|抢救)/;

const DIAG_EN_RE = /\binduced vomiting\b|\bstomach pumped\b|\bgastric lavage\b|\bactivated charcoal\b|\b(?:hemo)?dialysis\b|\bblood wash\b|\bcharcoal treatment\b|\bantivenom(?:in)?\b|\banti-?venom serum\b|\bserum injection\b|\bICU\b|\bintensive care\b|\b(?:hours|all night) of resuscitation\b|\bresuscitated for hours\b|\bIV drip\b|\bkept (?:in hospital )?under observation\b|\bventilator\b|\blife support\b|\bemergency room\b/i;

/* 型A rescue：PRICE 长期/永久代价（阀门没被掰回去；不含"身亡"类当场危象词，防危象行自救） */
const PRICE_ZH_RE = /后遗症|神经损伤|神经(?:系统)?(?:受损|麻痹)|肝肾(?:功能)?(?:损伤|衰竭)|器官(?:损伤|衰竭|坏死)|长期调养|调养(?:了)?(?:数|几|\d+)(?:个?月|年)|(?:卧病|卧床|昏迷)(?:了)?(?:数|几|\d+)(?:个?月|年)|(?:真的|就这么)?(?:死了|去世|离世|没了)|不治(?:身亡|而死|而亡)|再没(?:能)?(?:醒来|下床|睁开眼)|没有再醒来|终身(?:残疾|服药|瘫痪)|终身不愈|瘫痪(?:在床)?|落下(?:了)?残疾|身体(?:彻底)?垮了|(?:葬礼|丧事|灵堂)/;

const PRICE_EN_RE = /\blast(?:ing)? damage\b|\bnerve damage\b|\bl(?:iver|ung) damage\b|\bkidney damage\b|\borgan failure\b|\bmonths? of recuperation\b|\bnever recovered\b|\bnever woke up\b|\b(?:she|he|they) died (?:days|weeks|months) later\b|\bshe died\b|\bhe died\b|\bnothing more could be done\b|\blasted (?:for|over) (?:months|years)\b|\bpermanent(?:ly)? (?:disabled|paralyzed|weakened)\b|\blifelong medication\b|\bfuneral\b|\bmemorial service\b|\bbedridden for months\b/i;

/* ===== 型B rescue：CPROCESS 救治过程（解毒不是一颗药丸即出厂设置） ===== */
const CPROCESS_ZH_RE = /洗胃|透析|血液(?:灌流|净化|滤过)|昏迷(?:了)?(?:数|几|三|两|多|\d+)(?:天|日)|留(?:院|医)观察(?:了)?(?:数|几|三|两|多|\d+)?(?:天|日)?|观察(?:了)?(?:数|几|三|两|多|\d+)(?:天|日)|(?:数|几|三|两|多|\d+)(?:个?月|天)[^。！？\n]{0,10}(?:恢复|调养|康复|才(?:好|下床|痊愈))|恢复期|持续(?:输液|治疗)|(?:三|两|几|多)次[^。！？\n]{0,8}(?:清血|换血|施针|解毒|救治)|反复(?:救治|抢救|治疗)|住院(?:治疗|调养)[^。！？\n]{0,6}(?:数|几|三|两|多|\d+)?(?:天|日|个?月)?|休养(?:了)?(?:数|几|三|两|多|\d+)(?:个?月|天|日)|休养(?:了)?一(?:阵|段)(?:子|时间)?/;

const CPROCESS_EN_RE = /\bstomach pumped\b|\bdialysis\b|\bblood (?:wash|transfusion)\b|\bdays? in a coma\b|\bkept under observation for days\b|\bmonths? of recovery\b|\blong recuperation\b|\brepeated treatments\b|\brounds of treatment\b|\bslow recovery\b|\bgradually recovered\b|\bseveral (?:days|weeks) of\b|\bIV drips for days\b|\bhospitalized for (?:days|weeks)\b|\bone treatment after another\b/i;

/* 型B rescue：PARTIAL 未完全恢复（电灯拉亮但电压不稳） */
const PARTIAL_ZH_RE = /余毒(?:未清|未尽|未除)|余毒|毒气(?:未净)?|毒素(?:残留|未清)|毒(?:没|未)清干净|毒(?:可能)?会?反复|体弱(?:气虚)?|身子(?:还|依旧)(?:虚|虚弱)|后遗症|可能(?:复发|再犯|反复发作)|还(?:得|要)喝(?:三|几|\d+)(?:个?月)?(?:药|汤药)|脸色(?:依旧|仍然|还)(?:苍白|发白|不好)|没(?:有)?(?:完全|彻底)(?:好|恢复|痊愈|解毒)|走路(?:还)?打晃|元气(?:大伤|未复)/;

const PARTIAL_EN_RE = /\btraces of (?:the )?poison remained\b|\bresidual toxin\b|\bpoison hadn'?t fully cleared\b|\bremained frail\b|\bstill weak\b|\baftereffects?\b|\bcould relapse\b|\bmight (?:flare up again|return)\b|\bmonths more (?:of )?medicine\b|\bnever fully recovered\b|\bnot quite (?:back to normal|herself|himself)\b|\bpale for weeks\b|\bher constitution never fully came back\b/i;

/* 型B rescue：COST 解药代价（圆满有价格） */
const COST_ZH_RE = /解药(?:难寻|难求|来之不易)?|世上(?:只|仅)(?:有)?(?:一|1)(?:颗|粒|丸|枚)|(?:只|仅)(?:有)?(?:一|1)(?:颗|粒|丸|枚)解药|以命换药|拿命换(?:药|解药)?|炼药(?:者|人)[^。！？\n]{0,10}(?:死|牺牲|没了|圆寂)|(?:牺牲|没了|死了|折损)[^。！？\n]{0,12}(?:才)?换?来?[^。！？\n]{0,6}(?:解药|丹药|药)|倾家荡产|砸锅卖铁|毒副作用|解药(?:本身)?(?:有)?(?:毒|副作用)|拿解药的人[^。！？\n]{0,10}(?:没回来|死了|回不来)|等(?:了)?(?:三|几|\d+|好多)年|踏遍[^。！？\n]{0,10}才(?:找|求)到|千里迢迢[^。！？\n]{0,8}求药/;

const COST_EN_RE = /\bonly one antidote (?:in existence|left)\b|\bantidote was (?:nearly )?impossible to find\b|\bimpossible to find\b|\bsearched for years\b|\bquest for the antidote\b|\btraded (?:his|her|their) life\b|\bgave (?:his|her|their) life\b|\bthe (?:pill|elixir|antidote) maker died\b|\bcost a fortune\b|\bdrained (?:their|the|her|his) savings\b|\bside effects\b|\bantidote itself was poison\b|\bwhoever fetched it never returned\b|\btraveled a thousand miles\b/i;

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
 * 纯函数：检测"中毒秒解毒/毒物当编剧开关"密度病。
 */
export function poisonOnCue(draft: string): PoisonOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const ingestSpecRe = zh ? INGEST_SPEC_ZH_RE : INGEST_SPEC_EN_RE;
  const ingestGenericRe = zh ? INGEST_GENERIC_ZH_RE : INGEST_GENERIC_EN_RE;
  const crisisStrongRe = zh ? CRISIS_STRONG_ZH_RE : CRISIS_STRONG_EN_RE;
  const crisisWeakRe = zh ? CRISIS_WEAK_ZH_RE : CRISIS_WEAK_EN_RE;
  const toxCtxRe = zh ? TOXCTX_ZH_RE : TOXCTX_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const fineRe = zh ? FINE_ZH_RE : FINE_EN_RE;
  const causeRe = zh ? CAUSE_ZH_RE : CAUSE_EN_RE;
  const diagRe = zh ? DIAG_ZH_RE : DIAG_EN_RE;
  const priceRe = zh ? PRICE_ZH_RE : PRICE_EN_RE;
  const cprocessRe = zh ? CPROCESS_ZH_RE : CPROCESS_EN_RE;
  const partialRe = zh ? PARTIAL_ZH_RE : PARTIAL_EN_RE;
  const costRe = zh ? COST_ZH_RE : COST_EN_RE;

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
  const hasIngestSpec: boolean[] = new Array(rawLines.length).fill(false);
  const hasIngestGeneric: boolean[] = new Array(rawLines.length).fill(false);
  const hasCrisisStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasCrisisWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasToxCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasFine: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasIngestSpec[i] = ingestSpecRe.test(line);
    hasIngestGeneric[i] = ingestGenericRe.test(line);
    hasCrisisStrong[i] = crisisStrongRe.test(line);
    hasCrisisWeak[i] = crisisWeakRe.test(line);
    hasToxCtx[i] = toxCtxRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasFine[i] = fineRe.test(line);
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

  const events: Ev[] = [];

  /* 型A：INGEST 组（SPEC∪GENERIC）±2 行找 CRISIS（SPEC+STRONG 直配；其余须 ±3 行 TOXCTX） */
  const hasIngest: boolean[] = rawLines.map((_, i) => hasIngestSpec[i] || hasIngestGeneric[i]);
  for (const g of groupRows(hasIngest)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let crisisLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasCrisisStrong[j]) { crisisLine = j; strongHit = true; break; }
      if (crisisLine < 0 && hasCrisisWeak[j]) crisisLine = j;
    }
    if (crisisLine < 0) continue; /* 喝了酒吃了东西但没有危象：普通饮食放行 */

    /* 该组是否自带毒物明锚 */
    let specific = false;
    for (let j = g.start; j <= g.end; j += 1) {
      if (hasIngestSpec[j]) { specific = true; break; }
    }

    let ctxOk = strongHit && specific;
    if (!ctxOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, crisisLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasToxCtx[j]) { ctxOk = true; break; }
      }
    }
    if (!ctxOk) continue; /* 无毒理语境：醉酒呕吐/吃坏肚子/普通挨打危象不归本引擎 */

    const ingestLine = (() => {
      for (let j = g.start; j <= g.end; j += 1) if (hasIngest[j]) return j;
      return g.start;
    })();
    const ingestM = (rawLines[ingestLine].match(hasIngestSpec[ingestLine] ? ingestSpecRe : ingestGenericRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const crisisM = (rawLines[crisisLine].match(strongHit ? crisisStrongRe : crisisWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, crisisLine),
      anchorEnd: crisisLine,
      kind: 'onset',
      marker: `${ingestM}→${crisisM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 FINE（必须瞬时整体秒愈） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let fineLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasFine[j]) { fineLine = j; break; }
    }
    if (fineLine < 0) continue; /* 有解药/神医但没有当场痊愈：仍在治疗中放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const fineM = (rawLines[fineLine].match(fineRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, fineLine),
      anchorEnd: fineLine,
      kind: 'cure',
      marker: `${trigM}→${fineM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: PoisonOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次中毒桥段是类型刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = ev.kind === 'onset'
      ? (causeRe.test(win) || diagRe.test(win) || priceRe.test(win))
      : (cprocessRe.test(win) || partialRe.test(win) || costRe.test(win));
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
          ? '又是接触秒中毒——一杯毒酒、一盏毒茶、被毒蛇咬一口、毒针轻轻一扎，三行之内七窍流血、口吐白沫、奄奄一息，大夫摇头开始准备后事；没有毒理化验、没有催吐洗胃、没有血清透析，中毒是制造生离死别、逼男主表态、让反派摊牌的即时病危通知书，"一颗解药就好"救不了这段（它本身就是廉价秒解毒的病象）'
          : 'another contact-to-death\u2019s-door beat - one cup of poisoned wine, a bowl of spiked soup, a single snakebite or a light prick from a poisoned pin, and within three lines blood seeps from every orifice, foam fills the mouth, the victim is on her last breath and the doctor is already buying a coffin; no toxicology screen, no induced vomiting or stomach pump, no antivenom or dialysis; poisoning is an instant death notice used to stage a farewell, force a declaration of love or make the villain show his hand, and "one antidote pill fixed it" does not rescue this beat (that is the cheap-cure disease itself)')
        : (zh
          ? '又是廉价秒解毒——一颗解药、神医一丸丹药、运功逼毒、嘴吸毒血，当场活蹦乱跳跟没事人一样，无疗程、无观察、无余毒后遗症；下一场戏该报仇报仇该圆房圆房，毒物是编剧的电灯开关：需要虐心时一拉全灭，需要圆满时一拉全亮'
          : 'another cheap instant-detox beat - one antidote pill, a pellet from a famed doctor, poison forced out by inner energy, venom sucked from a wound, and the victim is instantly back on her feet, good as new; no treatment course, no observation, no residual toxin or aftereffects; by the next scene revenge and romance proceed on schedule - poison is the writer\'s light switch: total catastrophe when anguish is needed, full brightness when a happy ending is due'),
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
      ? `${hitCount} 处"中毒秒解毒剧情阀门"（接触秒中毒 ${onsetCount} 处、廉价秒解毒 ${cureCount} 处，${n} 处未救）——毒物成了随取随用的电灯开关：需要虐心时一杯毒酒三行七窍流血、大夫准备后事，不要毒理化验和洗胃血清；需要圆满时一颗解药、神医一丸药、运功逼毒，当场活蹦乱跳，不要疗程和余毒。第一次是类型桥段，第三次观众就看穿：这个剧里中毒从来不是病，是可以一键毒倒又一键救活的扳手；而每回毒发都不给救治过程、每回解毒都不留尾巴，夺命和活命双双贬值。`
      : `${hitCount} poison-on-cue beat(s) (${onsetCount} instant poisoning, ${cureCount} instant cure; ${n} unrescued) - poison is a light switch: when anguish is needed a cup of spiked wine turns to bleeding orifices and a coffin being measured in three lines, with no toxicology, no stomach pump and no serum; when relief is needed an antidote pill, a famed doctor's pellet or poison forced out by inner energy restores the victim good as new on the spot, with no treatment course and no residual toxin. Once is genre grammar; by the third, the audience sees poisoning is never an illness in this story, only a wrench that kills and cures on command - and when every crisis skips the medicine and every cure skips the tail, both the danger and the rescue lose their value.`);
    advice.push(zh
      ? '让中毒恢复它应有的重量与麻烦。接触秒中毒型：①让毒理真兑付——毒理化验、鉴定出具体毒素（乌头碱、有机磷、砒霜剂量）、毒素侵入肝肾神经、呼吸肌麻痹，中毒和危象之间要有医学因果，大夫嘴里要有毒素名字和发作机理而不是摇头准备后事；②让就医有过程——催吐、洗胃、活性炭、血液灌流透析、抗毒血清、ICU抢救数小时、留院观察、呼吸机输液，病危不能在毒发现场一句话宣判；③要么让代价真留下——人真的没救回来、再没醒来、后遗神经痛、肝肾损伤、卧床数月、终身服药，这次没有解药反转，生离死别才值钱；记住"一颗解药就好"不救中毒戏，它本身就是秒解毒的病象。廉价秒解毒型：④让解毒有救治过程——洗胃、透析、血清注射后留观数日、反复清血、几天昏迷、几个月恢复期，一颗药丸不该是出厂重置键；⑤给电灯留电压不稳的尾巴——余毒未清、体弱气虚、后遗症、医生说可能复发、还要喝三个月汤药，下一场戏要有握杯手抖、走两步就喘的破绽；⑥如果必须解毒，让它带着价格——解药世上只有一颗、难寻难求、以命换药、炼药者圆寂、拿药的人没回来、倾家荡产、解药本身有毒副作用，毒解那一刻该有人回不来、有钱还不上。最忌讳一集两回"喝口毒酒→七窍流血→一颗解药→当场活蹦乱跳→认亲打脸"。毒物若要拉闸，就得真的夺命或改变身体；若要合闸，也不能白合闸。'
      : 'Give poisoning its real weight and its real hassle. For instant-poisoning beats: (1) let the toxicology in - a lab screen, a named toxin with a dose (aconitine, organophosphate, arsenic), the toxin attacking liver, kidneys or nerves, respiratory paralysis; there must be a medical cause between contact and crisis, and the doctor must name the substance and its mechanism instead of shaking his head and measuring a coffin. (2) Let the medicine take a process - induced vomiting, a stomach pump, activated charcoal, hemoperfusion and dialysis, antivenom serum, hours of ICU resuscitation, observation under a ventilator and IV drips; a death sentence cannot be delivered in one line at the poisoning scene. (3) Or let the cost remain - the patient truly dies, never wakes up, keeps nerve pain or damaged organs, stays bedridden for months or takes medicine for life; when no antidote reversal arrives, the farewell finally costs something; remember "one antidote pill fixed it" never rescues a poisoning beat, because that is the instant-cure disease itself. For cheap-cure beats: (4) give the detox a treatment process - a stomach pump, dialysis, days of observation after the serum, repeated blood washes, days in a coma, months of recovery; one pellet must not be a factory reset. (5) Leave the light switch a faulty tail - traces of poison left behind, frailty, aftereffects, a relapse the doctor warns about, three more months of bitter tonics; the next scene needs a shaking hand around a teacup and breathlessness after two steps. (6) If the poison must be cured, make it cost something - the only antidote in existence, a quest that takes years, a life traded for the pill, the elixir maker who did not survive, the messenger who never returned, bills that bankrupt the family, side effects baked into the cure; at the moment the toxin clears, someone should be gone and some debt still unpaid. The unforgivable pattern is two "sip of poisoned wine -> bleeding orifices -> one antidote pill -> back on her feet -> recognition and revenge" loops per episode. If poison throws the switch, a life must genuinely end or a body genuinely change; if the lights come back on, it must not be for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
