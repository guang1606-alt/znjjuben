import { isSceneHeaderLine } from './script-scenes';
/**
 * 失明/复明剧情阀门 / 视觉通道当开关检测（v2.108 块116，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的眼睛当成随取随用的剧情开关，两种形态反复
 *   出现——
 *   A 撞击秒失明型：一场车祸、一耳光、从楼梯上滚下来、一场高烧，三行
 *     之内医生宣布"永久性失明"，眼前一片漆黑；没有眼科检查、没有
 *     视网膜脱落/视神经挫伤这样的器质损伤，失明是制造虐恋、逼男主
 *     赎罪照顾、让坏人当面做坏事的即时枷锁；
 *   B 廉价秒复明型：剧情需要打脸、认亲、大团圆时，角膜捐献者凭空
 *     出现、神医一包偏方、头又撞了一下、哭了一夜，拆开纱布当场看见，
 *     无排异、无视力训练、无光感到轮廓的适应，拆纱布视力直接2.0；
 *     下一集眼睛好使得很——视觉是编剧的电灯开关：需要苦情时一拉
 *     全灭，需要圆满时一拉全亮。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里失明从来不是伤，
 *   是可以一键失明又一键复明的情节扳手，致盲和痊愈双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - faint-on-cue：晕倒阀门，管意识丧失；"眼前一黑"在本引擎只作
 *    WEAK 锚且须眼科语境兜底，普通晕厥不误判；
 *  - wound-on-cue：外伤战力阀门；本引擎专管视觉通道的失与得，
 *    普通车祸/挨打无失明锚放行；
 *  - terminal-diagnosis-on-cue：长期绝症宣判与撤销；本引擎是视觉
 *    器官的急性失能与廉价恢复；
 *  - allergy-on-cue（v2.107）：一顿饭内急性免疫引爆拆除；本引擎
 *    锚点（车祸/角膜/纱布/视网膜）与免疫词表正交；
 *  - amnesia-on-cue/pregnancy-on-cue/wake-on-cue：身体阀门家族
 *    其余成员，机制互不重叠；character-state-ledger 六态（怀孕/
 *    入狱/破产/昏迷/失忆/生死不明）不含失明，跨集记账不进 deai；
 *  - 全库 blind 命中均为 blind spot/盲盒/blindly 比喻义，无检测器
 *    覆盖失明-复明机制；creativity/romance-craft/family-craft 零训诫。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A onset（撞击秒失明）：
 *    HARM 损伤病因锚（车祸/撞头/摔落/殴打眼脸/爆炸灼眼/化学品溅入/
 *    毒气/高烧重病 + car crash/struck her head/fell down stairs/
 *    beaten/explosion burned/chemical burn/high fever…）±2行与
 *    BLIND 失明锚共现；BLIND 分两档——STRONG（双目失明/眼睛再也
 *    看不见/视力丧失/眼前一片漆黑/什么都看不见 + went blind/lost
 *    her sight/permanently blind/world went dark…）自带失明语义
 *    直配；WEAK（看不清/视力模糊/眼前发黑/眼睛缠着纱布 + blurry
 *    vision/eyes bandaged…）必须在事件 ±3 行窗口内另有 EYECTX
 *    眼科语境锚（眼科/角膜/视网膜/视神经/眼底 + ophthalmologist/
 *    cornea/retina/optic nerve/eye specialist…；纱布不算语境），
 *    防普通挨打眼冒金星误判；纯受伤无视盲放行，纯失明陈述无病因
 *    放行（天生盲是人设不是秒失明阀门）；
 *  - 型B cure（廉价秒复明）：
 *    TRIGGER 廉价解除锚（角膜移植/角膜捐献/神医偏方/奇迹/头又被
 *    撞/磕脑袋/大哭一场 + cornea transplant/donor cornea/miracle
 *    cure/famed doctor/herbal remedy/hit her head again…）±2行
 *    与 SIGHT 整体秒复明锚共现；SIGHT 必须是整体恢复（拆开纱布
 *    当场看见/重见光明/视力恢复 + sight returned/vision restored/
 *    could see again…）；无触发物的缓慢好转（两个月一天比一天
 *    清楚）合法放行；
 *  - 相邻 ≤2 行的 HARM/TRIGGER 行各自合并为同一事件（跨场景头
 *    不合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CAUSE 器质损伤真兑付——眼球破裂/视网膜脱落/视神经
 *      挫伤/角膜穿孔/颅内出血压迫视神经，受伤与失明之间有医学
 *      因果；②DIAG 规范就医过程——眼科会诊/眼底造影/CT核磁/
 *      转院/数天后确诊，失明不是现场宣布；③PRICE 永久长期代价
 *      ——终身失明/学盲文/导盲犬手杖/盲校/适应黑暗，阀门这次
 *      没被掰回去；"拆纱布复明"不救 onset（它本身就是型B病象）；
 *    型B：①CPROCESS 术后渐进恢复——抗排异药/视力训练/从光感到
 *      轮廓/数月才看清/拆线适应，复明不是拆纱布即2.0；②PARTIAL
 *      未完全恢复——弱视/散光/畏光/视野缺损/只有光感/可能再恶化，
 *      电灯拉亮但电压不稳；③COST 代价——捐献者去世/等了多年/
 *      角膜库排队/倾家荡产/手术风险签同意书，圆满有价格；
 *  - 第 1 次豁免（一次失明桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface BlindnessOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** onset=撞击秒失明型；cure=廉价秒复明型 */
  kind: 'onset' | 'cure';
  /** 是否有器质损伤/就医过程/永久代价/术后过程/部分恢复/手术代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface BlindnessOnCueResult {
  score: number;
  /** 失明阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: BlindnessOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：HARM 损伤病因锚 ===== */
const HARM_ZH_RE = new RegExp(
  /车祸|被车撞|撞车/.source
  + '|' + /撞(?:到|了|伤)?(?:他的|她的|我)?(?:头|脑袋|头部)|磕(?:到|了|一下)?(?:他的|她的|我)?(?:头|脑袋)|(?:头|脑袋)(?:受|被撞|遭到)[^。！？\n]{0,3}创?/.source
  + '|' + /摔(?:下|倒|落)[^。！？\n]{0,8}(?:楼|地|头)|从[^。！？\n]{0,6}(?:摔|滚)(?:下|倒|落)/.source
  + '|' + /一(?:拳|巴掌)[^。！？\n]{0,4}(?:打|砸|扇|招呼)[^。！？\n]{0,4}(?:眼|脸|头)|打(?:在|中)(?:他的|她的|我)?(?:眼|脸|头)|殴打|被打|被人打/.source
  + '|' + /爆炸[^。！？\n]{0,8}(?:伤|灼|崩)|灼伤(?:了)?(?:双)?眼|化学(?:品|液体|试剂)?[^。！？\n]{0,6}(?:溅|泼|喷|灼)|强光(?:刺|灼)眼|酸液/.source
  + '|' + /毒气|吸入(?:了)?(?:毒气|有毒气体|浓烟)/.source
  + '|' + /高烧|发高(?:烧|热)|一场大病|脑炎|重病(?:一场)?/.source,
);

const HARM_EN_RE = new RegExp(
  /\bcar crash\b|\bcar accident\b|\bhit by a car\b|\btruck hit\b|\bstruck by a vehicle\b/.source
  + '|' + /\bstruck (?:her|his|their|my) head\b|\bhit (?:her|his|their|my) head\b|\bbumped (?:her|his|their) head\b|\bblow to the head\b|\bhead trauma\b|\bhead injury\b/.source
  + '|' + /\bfell down the stairs\b|\bfell (?:and|down)[^.?!\n]{0,18}?(?:struck|hit|bumped) (?:her|his|their) head\b|\bslipped and fell\b|\btumbled down the stairs\b/.source
  + '|' + /\bpunched (?:in|near) the (?:eye|face)\b|\bslapped across the face\b|\bbeaten\b|\bstruck in the face\b|\bhit (?:in|across) the face\b/.source
  + '|' + /\bexplosion\b[^.?!\n]{0,20}?(?:burned|blinded|injured|seared)|\bburned (?:her|his|their) eyes?\b|\bchemical burn\b|\bacid (?:splashed|burned|thrown)\b|\bsearing light\b/.source
  + '|' + /\btoxic fumes\b|\bpoison(?:ous)? gas\b|\binhaled (?:toxic|poisonous) fumes\b/.source
  + '|' + /\bhigh fever\b|\bseverely ill\b|\bbrain fever\b|\bgrave illness\b|\bcame down with a fever\b/i.source,
  'i',
);

/* BLIND 强档：自带失明语义的结果锚（直配） */
const BLIND_STRONG_ZH_RE = /双目失明|双眼失明|两(?:只眼|眼全?瞎)|彻底(?:失)?明|彻底瞎了|(?:眼睛|双眼)(?:彻底|完全|永久)?(?:看不见|看不到|失明)|再也看不见|永远看不见|什么都看不见|眼前一片漆黑|失明了?|视力(?:完全|彻底)?(?:丧失|消失|被毁)|永久(?:性)?(?:失明|视力损伤|眼盲)|被(?:宣布|判)[^。！？\n]{0,6}失明|再也见不到(?:光|光明)|光明(?:彻底)?(?:离|远去)/;

const BLIND_STRONG_EN_RE = /\bwent blind\b|\bwent completely blind\b|\blost (?:her|his|their) sight\b|\blost (?:her|his|their) eyesight\b|\blost (?:her|his|their) vision\b|\bbecame blind\b|\bpermanently blind\b|\btotally blind\b|\bcompletely blind\b|\bcouldn'?t see anything\b|\bcould see nothing\b|\bworld went dark\b|\bsight was gone\b|\bnever see again\b|\brobbed of (?:her|his|their) sight\b|\bblindness was permanent\b|\bleft (?:her|him|them) blind\b|\bgone blind\b|\bvision was gone\b/i;

/* BLIND 弱档：眼伤轻症反应（需 EYECTX 眼科语境兜底，防普通挨打眼冒金星误判） */
const BLIND_WEAK_ZH_RE = /看不清|看东西(?:发)?模糊|视力模糊|视线模糊|眼前(?:一|发)?黑|蒙着(?:纱布|眼罩)|眼睛(?:缠着|包着)(?:纱布|绷带)?|(?:纱布|绷带)(?:缠|包)(?:着|了)?眼|睁不开眼|眼冒金星/;

const BLIND_WEAK_EN_RE = /\bblurr(?:y|ied)\b|\bwent blurry\b|\bcouldn'?t see clearly\b|\beverything went blurry\b|\beyes? (?:were |was )?bandaged\b|\bbandages over (?:her|his|their) eyes\b|\bwrapped in bandages\b|\bdark(?:ness)? at the edges\b|\bcouldn'?t open (?:her|his|their) eyes\b|\bsaw stars\b/i;

/* 眼科语境锚：弱档反应需它兜底（纱布/眼罩不算语境，防普通外伤误判） */
const EYECTX_ZH_RE = /眼科(?:医院|医生|会诊|检查|病房|手术)?|眼角膜|角膜|视网膜|视神经|眼底|眼专科|眼球(?:受伤|破裂)?|视力检查|眼伤|复明|失明/;

const EYECTX_EN_RE = /\bophthalmologist\b|\beye specialist\b|\beye doctor\b|\beye hospital\b|\beye surgery\b|\beye injury\b|\beye exam\b|\bcornea\b|\bretina\b|\boptic nerve\b|\bocular\b|\bblindness\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /角膜移植|眼角膜移植|移植(?:了)?(?:眼角膜|角膜)|(?:眼角膜|角膜)捐献|捐献(?:者)?(?:的)?(?:眼角膜|角膜)|换(?:了)?(?:眼角膜|角膜)/.source
  + '|' + /神医|名医|偏方|特效药|仙草|仙丹|世外高人/.source
  + '|' + /奇(?:迹|迹般)(?:复明|好转|痊愈|治好|康复)?/.source
  + '|' + /(?:头|脑袋)(?:又|再|二次)?(?:被)?(?:撞|磕)(?:了|一下|到)?|撞(?:了)?一下(?:头|脑袋)|磕(?:了)?一下(?:头|脑袋)/.source
  + '|' + /大哭(?:一场|一夜|几天)[^。！？\n]{0,8}(?:看见|复明|好了|能看)/.source,
);

const TRIGGER_EN_RE = new RegExp(
  /\bcornea(?:l)? transplant\b|\bcorneal graft\b|\bdonor cornea\b|\bcornea donor\b|\beye transplant\b|\btransplant(?:ed)? (?:a |the |new )?cornea\b/.source
  + '|' + /\bmiracle (?:cure|surgery|operation|recovery)\b|\bmiraculously cured\b/.source
  + '|' + /\bfamed (?:eye )?doctor\b|\bfamous specialist\b|\bmiracle-?working doctor\b|\bherbal (?:remedy|cure|medicine)\b|\bspecialist from the city\b/.source
  + '|' + /\bhit (?:her|his|their) head again\b|\bstruck (?:her|his|their) head again\b|\bsecond blow to the head\b|\bbumped (?:her|his|their) head again\b|\banother bump on the head\b/.source
  + '|' + /\bcried all night\b[^.?!\n]{0,14}?(?:could see|sight|vision)/i.source,
  'i',
);

/* SIGHT 整体秒复明锚（须与 TRIGGER 配对；渐进好转不收） */
const SIGHT_ZH_RE = new RegExp(
  /(?:拆开|拆下|揭开|摘下|解开|取下)(?:了)?(?:纱布|绷带|眼罩)[^。！？\n]{0,12}(?:看见|看清|重见光明|能看见|复明|恢复|见到)/.source
  + '|' + /重见光明|恢复(?:了)?视力|视力恢复|眼睛复明|复明了|视线恢复|光明(?:重新)?回到|能看见(?:了|东西)?/.source
  + '|' + /(?:立刻|马上|瞬间|当场|一下子|突然|竟然|果然)[^。！？\n]{0,10}(?:能看见|看见了|看清|重见光明|恢复视力|复明)/.source
  + '|' + /(?:能看见|看见了|看清)[^。！？\n]{0,8}(?:立刻|马上|瞬间|当场)/.source,
);

const SIGHT_EN_RE = new RegExp(
  /(?:removed|took off|unwrapped|untied) the bandages[^.?!\n]{0,24}?(?:could see|saw|sight|light flooded|vision)/.source
  + '|' + /\bsight returned\b|\bvision (?:was )?restored\b|\bregained (?:her|his|their) sight\b|\bcould see again\b|\bsaw (?:the )?light again\b|\beyes opened to the light\b/.source
  + '|' + /(?:immediately|instantly|suddenly|right away|at once|miraculously|the moment)[^.?!\n]{0,18}?(?:could see|saw (?:his|her|their) face|sight returned|vision (?:was )?restored)/.source
  + '|' + /(?:could see|saw (?:his|her|their) face)[^.?!\n]{0,12}(?:immediately|instantly|right away)/i.source,
  'i',
);

/* ===== 型A rescue：CAUSE 器质损伤真兑付（致盲有医学因果） ===== */
const CAUSE_ZH_RE = /眼球(?:破裂|撕裂|穿孔|受损)|视网膜(?:脱落|剥离|出血|水肿|震荡|挫伤)|视神经(?:损伤|挫伤|受压|压迫|断裂|萎缩)|角膜(?:穿孔|破裂|损伤|溃疡|擦伤)|颅内[^。！？\n]{0,10}(?:淤血|出血|水肿|肿块)[^。！？\n]{0,8}压迫|玻璃体(?:出血|混浊)|黄斑(?:病变|受损)?|外伤性(?:白内障|青光眼)/;

const CAUSE_EN_RE = /\bruptured eyeball\b|\bretinal detachment\b|\bdetached retina\b|\bretinas? (?:had )?detached\b|\boptic nerve (?:damage|injury|swelling|was crushed)\b|\btorn cornea\b|\bcorneal (?:perforation|ulcer|abrasion)\b|\bbleeding (?:behind|inside) (?:the )?eye\b|\bswelling pressed on the optic nerve\b|\bmacular damage\b|\btraumatic cataract\b/i;

/* 型A rescue：DIAG 规范就医过程（失明不是现场宣布） */
const DIAG_ZH_RE = /眼科(?:医院|会诊|医生|检查|病房)|眼底(?:检查|造影)|裂隙灯|做了?[^。！？\n]{0,10}(?:CT|核磁|检查)|转(?:了)?院|专家会诊|住院检查|检查报告|诊断书|观察了?[^。！？\n]{0,4}天|确诊/;

const DIAG_EN_RE = /\bophthalmologist\b|\beye specialist\b|\beye hospital\b|\beye exam\b|\bCT scan\b|\bMRI\b|\breferred to a specialist\b|\bseries of tests\b|\badmitted for tests\b|\bdiagnosis\b|\bdiagnosed after\b|\beye specialist ran\b/i;

/* 型A rescue：PRICE 永久/长期代价（阀门没被掰回去） */
const PRICE_ZH_RE = /终身失明|终生失明|再也没(?:能)?(?:复明|看见)|没有复明|学(?:习)?盲文|导盲(?:犬|杖)|盲(?:人)?学校|适应(?:了)?黑暗|黑暗(?:中|里)(?:生活|行走)?|接受(?:了)?(?:自己)?(?:终身)?失明|残障(?:证|认定)|靠手摸/;

const PRICE_EN_RE = /\bnever saw again\b|\bnever regained (?:her|his|their) sight\b|\blearned braille\b|\bguide dog\b|\bwhite cane\b|\bschool for the blind\b|\blived in darkness\b|\baccepted (?:her |his |their )?blindness\b|\bstayed blind for life\b|\bpermanent(?:ly)? (?:blind|disabled)\b/i;

/* ===== 型B rescue：CPROCESS 术后渐进恢复（拆纱布不是即2.0） ===== */
const CPROCESS_ZH_RE = /术后[^。！？\n]{0,12}(?:恢复|治疗|观察|训练|护理)|抗排异|防排异|排异(?:反应|药|治疗)|视力训练|视觉训练|康复训练|从光感到|先(?:是)?(?:光感|模糊)|一天比一天(?:清楚|清晰)|(?:几|数)(?:周|个?月)[^。！？\n]{0,8}(?:才|逐渐)(?:看清|恢复|复明)|渐渐(?:看清|恢复|复明)|逐渐(?:看清|恢复|复明)|拆(?:了)?线|眼罩(?:适应|训练)|慢慢(?:练|恢复|看清)/;

const CPROCESS_EN_RE = /\banti-?rejection\b|\brejection meds\b|\bvision therapy\b|\bvisual rehab\b|\blight first, then shapes\b|\bgradually regained\b|\bday by day\b|\bweeks? of (?:recovery|therapy)\b|\bmonths? of (?:recovery|rehab)\b|\bslowly returned\b|\bafter several operations\b|\bby degrees\b|\blittle by little\b|\bstitches? (?:came|removed)\b/i;

/* 型B rescue：PARTIAL 未完全恢复（电灯拉亮但电压不稳） */
const PARTIAL_ZH_RE = /弱视|散光|怕光|畏光|视野(?:缺损|狭窄|变小|受限)|只有光感|仅存光感|没(?:有)?完全恢复|未完全恢复|看不清远处|视力只有|可能(?:再次)?(?:失明|恶化|复发)|还(?:得|要)?戴(?:厚)?眼镜|度数很深/;

const PARTIAL_EN_RE = /\bpartial sight\b|\blimited vision\b|\blight-?sensitive\b|\bsensitive to light\b|\bonly (?:light|shapes|shadows)\b|\bastigmatism\b|\btunnel vision\b|\bfar things? blurry\b|\bcould deteriorate\b|\bmight go blind again\b|\bnever fully recovered\b|\bpartial recovery\b/i;

/* 型B rescue：COST 手术代价（圆满有价格） */
const COST_ZH_RE = /捐献者[^。！？\n]{0,8}(?:去世|死|没了|临终|车祸)|等了?(?:好?几|多|数|\d+)年|角膜库|倾家荡产|手术费|医药费(?:高昂)?|排异风险|手术风险|签(?:了|署)?(?:风险|病危|手术)[^。！？\n]{0,4}同意书|砸锅卖铁|借遍|负债/;

const COST_EN_RE = /\bdonor died\b|\bdonor'?s death\b|\bwaited years\b|\bwaiting list\b|\bcornea bank\b|\bcost a fortune\b|\bmedical bills\b|\brisk of rejection\b|\bsigned the consent\b|\bsurgery could fail\b|\bdrained (?:their|the|her|his) savings\b|\bwaited \d+ years\b/i;

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
 * 纯函数：检测"失明/复明剧情阀门/视觉通道当开关"密度病。
 */
export function blindnessOnCue(draft: string): BlindnessOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const harmRe = zh ? HARM_ZH_RE : HARM_EN_RE;
  const blindStrongRe = zh ? BLIND_STRONG_ZH_RE : BLIND_STRONG_EN_RE;
  const blindWeakRe = zh ? BLIND_WEAK_ZH_RE : BLIND_WEAK_EN_RE;
  const eyeCtxRe = zh ? EYECTX_ZH_RE : EYECTX_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const sightRe = zh ? SIGHT_ZH_RE : SIGHT_EN_RE;
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
  const hasHarm: boolean[] = new Array(rawLines.length).fill(false);
  const hasBlindStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasBlindWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasEyeCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasSight: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasHarm[i] = harmRe.test(line);
    hasBlindStrong[i] = blindStrongRe.test(line);
    hasBlindWeak[i] = blindWeakRe.test(line);
    hasEyeCtx[i] = eyeCtxRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasSight[i] = sightRe.test(line);
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

  /* 型A：HARM 组 ±2 行找 BLIND（强档直配；弱档需 ±3 行 EYECTX） */
  for (const g of groupRows(hasHarm)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let blindLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasBlindStrong[j]) { blindLine = j; strongHit = true; break; }
      if (blindLine < 0 && hasBlindWeak[j]) blindLine = j;
    }
    if (blindLine < 0) continue; /* 车祸挨打但没有失明：普通外伤放行 */
    let ctxOk = strongHit;
    if (!ctxOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, blindLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasEyeCtx[j] || hasBlindStrong[j]) { ctxOk = true; break; }
      }
    }
    if (!ctxOk) continue; /* 无眼科语境：普通挨打眼冒金星/短暂模糊不归本引擎 */

    const harmM = (rawLines[g.start].match(harmRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const blindM = (rawLines[blindLine].match(strongHit ? blindStrongRe : blindWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, blindLine),
      anchorEnd: blindLine,
      kind: 'onset',
      marker: `${harmM}→${blindM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 SIGHT（必须整体秒复明） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let sightLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasSight[j]) { sightLine = j; break; }
    }
    if (sightLine < 0) continue; /* 有移植/神医但没有当场复明：仍在治疗中放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const sightM = (rawLines[sightLine].match(sightRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, sightLine),
      anchorEnd: sightLine,
      kind: 'cure',
      marker: `${trigM}→${sightM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: BlindnessOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次失明桥段是类型刚需） */
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
          ? '又是撞击秒失明——一场车祸、一耳光、从楼梯上滚下来，三行之内医生宣布永久失明、眼前一片漆黑；没有眼科会诊、没有视网膜脱落或视神经挫伤这样的器质损伤，失明是制造虐恋、逼赎罪照顾、让坏人当面做坏事的即时枷锁，"拆纱布复明"救不了这段（它本身就是廉价秒复明的病象）'
          : 'another impact-to-blindness beat - a car crash, one slap, a tumble down the stairs, and within three lines the doctor declares permanent blindness and the world goes black; no ophthalmologist consult, no organic damage like a detached retina or a crushed optic nerve; blindness is an instant padlock used to manufacture suffering, force a guilt-driven bedside vigil and let villains scheme in front of the victim, and "the bandages came off and she could see" does not rescue this beat (that is the cheap-cure disease itself)')
        : (zh
          ? '又是廉价秒复明——角膜捐献者凭空出现、神医一包偏方、头又撞了一下，拆开纱布当场看见，无排异、无视力训练、无光感到轮廓的适应，拆纱布视力直接2.0；下一集眼睛好使得很，视觉是编剧的电灯开关：需要苦情时一拉全灭，需要圆满时一拉全亮'
          : 'another cheap instant-cure beat - a donor cornea appears out of nowhere, a famed doctor hands over an herbal packet, the head gets bumped once more, the bandages come off and she sees instantly; no rejection meds, no vision therapy, no adjustment from light to shapes, eyesight is back to 2.0; next episode those eyes work perfectly - sight is the writer\'s light switch: total darkness when suffering is needed, full brightness when a happy ending is due'),
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
      ? `${hitCount} 处"失明/复明剧情阀门"（撞击秒失明 ${onsetCount} 处、廉价秒复明 ${cureCount} 处，${n} 处未救）——视觉通道成了随取随用的电灯开关：需要苦情时一场车祸三行宣布永久失明，不要眼科检查和器质损伤；需要圆满时角膜移植/神医/再撞一下头，拆纱布当场看见，不要排异和康复。第一次是类型桥段，第三次观众就看穿：这个剧里失明从来不是伤，是可以一键致盲又一键复明的扳手；而每回失明都不给就医过程、每回复明都不留尾巴，致盲和痊愈双双贬值。`
      : `${hitCount} blindness-on-cue beat(s) (${onsetCount} instant blindness, ${cureCount} instant cure; ${n} unrescued) - vision is a light switch: when suffering is needed a car crash turns to permanent blindness in three lines with no eye exam and no organic injury; when relief is needed a transplant, a famed doctor or another bump to the head restores perfect sight the moment the bandages come off, with no rejection and no rehab. Once is genre grammar; by the third, the audience sees blindness is never an injury in this story, only a wrench that blinds and cures on command - and when every blinding skips the medicine and every cure skips the tail, both the loss and the recovery lose their value.`);
    advice.push(zh
      ? '让失明恢复它应有的重量与麻烦。撞击秒失明型：①让器质损伤真兑付——眼球破裂、视网膜脱落、视神经挫伤、角膜穿孔、颅内出血压迫视神经，受伤和失明之间要有医学因果，医生嘴里要有具体的伤而不是一句"永久性失明"；②让就医有过程——眼科会诊、眼底造影、CT核磁、转院、住院检查、数天后才拿到诊断，失明不能在事故现场一句话宣判；③要么让代价真留下——终身失明、学盲文、导盲犬手杖、盲人学校、适应黑暗、接受残障，这次没有拆纱布的反转，苦情戏才值钱；记住"拆纱布复明"不救失明戏，它本身就是秒复明的病象。廉价秒复明型：④让复明有术后过程——抗排异药、视力训练、从光感到轮廓、几个月才渐渐看清、拆线、眼罩适应，拆开纱布不该是2.0出厂设置；⑤给电灯留电压不稳的尾巴——弱视、散光、畏光、视野缺损、只有光感、医生说可能再恶化，下一场戏要有认错人的尴尬和重新认世界的笨拙；⑥如果必须复明，让它带着价格——捐献者临终托愿、等了几年角膜库、手术费倾家荡产、签风险同意书、可能排异失败，重见光明那一刻该有人回不来、有钱还不上。最忌讳一集两回"撞一下头→永久失明→移植角膜→拆纱布当场看见→认亲打脸"。失明若要拉闸，就得真的改变生活；若要合闸，也不能白合闸。'
      : 'Give blindness its real weight and its real hassle. For instant-blindness beats: (1) let the organic injury in - a ruptured eyeball, a detached retina, a crushed optic nerve, a torn cornea, bleeding pressing on the nerve; there must be a medical cause between the impact and the blindness, and the doctor must name an injury instead of just declaring "permanent". (2) Let the medicine take a process - ophthalmologist consults, retinal imaging, CT and MRI, a transfer, admission, a diagnosis days later; blindness cannot be announced in one line at the crash site. (3) Or let the cost remain - blindness for life, braille, a guide dog and a white cane, a school for the blind, learning to live in darkness, accepting the disability; when no bandage-removal reversal arrives, the suffering finally costs something; remember "the bandages came off and she could see" never rescues a blinding beat, because that is the instant-cure disease itself. For cheap-cure beats: (4) give the recovery a surgical process - anti-rejection medication, vision therapy, light first then shapes, months of gradual improvement, stitches, adjusting to an eye patch; removing the bandages must not restore factory-set 20/20 vision. (5) Leave the light switch a faulty tail - amblyopia, astigmatism, light sensitivity, a narrowed field, only light and shadow, a doctor warning it could deteriorate; the next scene needs the embarrassment of recognizing the wrong face and the clumsiness of relearning the world. (6) If sight must return, make it cost something - a donor\'s dying wish, years on a cornea-bank waiting list, bills that bankrupt the family, a signed risk consent, the chance of rejection; at the moment of seeing light again, someone should be gone and some debt still unpaid. The unforgivable pattern is two "bump on the head -> permanent blindness -> cornea transplant -> bandages off, instant sight -> recognition and revenge" loops per episode. If the lights go off, a life must genuinely change; if they come back on, it must not be for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
