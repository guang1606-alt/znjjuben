import { isSceneHeaderLine } from './script-scenes';
/**
 * 绝症剧情阀门 / 死亡判决书当开关检测（v2.106 块114，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的生死期限当成随取随用的剧情开关。两种形态
 *   反复出现——
 *   A 宣判秒翻转型：医生神色凝重递出诊断书，"癌症晚期，只剩三个月"，
 *     一纸判决当天全家态度、情侣关系、仇人恩怨全部翻转；没有复查、
 *     没有第二意见、没有活检会诊，病人活蹦乱跳，只在需要煽情时
 *     咳两口血；绝症是逼和解、逼告白、逼原谅的万能倒计时；
 *   B 误诊秒痊愈型：大团圆期限一到，报告拿错了/误诊了/国外新药/
 *     奇迹出现/配型突然成功，癌细胞当场消失，没有漫长治疗、没有
 *     移植排异、没有经济代价，死亡通知书是编剧的暂停键与撤回键：
 *     需要悲剧时下发，需要圆满时收回。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里死亡从来不是死亡，
 *   是可以撤销的情节扳手，绝症和痊愈双双贬值。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - deathbed-confession：垂死现场（生命最后时刻）的信息倾倒/全招，
 *    管"临终报信"，不管长期绝症的宣判与撤销机制；
 *  - emotional-aftermath-check（v2.x）：确诊/丧亲后下一场情绪必须有
 *    余波，管情绪连续性，不检测绝症宣告本身的密度与成本；
 *  - faint-on-cue/wake-on-cue/wound-on-cue/pregnancy-on-cue/
 *    amnesia-on-cue：身体阀门家族前五员（晕倒→病床→伤势→妊娠→
 *    记忆），本引擎是第六员——死亡判决书通道，专管"期限宣判/撤销"；
 *  - romance-craft/family-craft 仅原则训诫"绝症是廉价虐/狗血"，
 *    creativity.ts 仅一条 amnesia_cancer 套路回避建议，无检测。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A verdict（绝症宣判）：
 *    DIAG 诊断宣告锚（医生宣布/诊断书/化验单/确诊/肿瘤科…）
 *    ±2行与 FATAL 死刑结果锚共现；FATAL 分两档——STRONG（绝症/
 *    癌症晚期/只剩N个月/时日无多/terminal/only months to live…）
 *    自带死刑语义直配；WEAK（病情不乐观/长了个瘤/检查结果不好/
 *    test results not good/a growth…）必须在事件 ±3 行窗口内另有
 *    MED_CONTEXT 医学语境锚（医生/医院/肿瘤科/活检/CT/oncologist…），
 *    防"工作情况不乐观""长了个记性"日常误判；
 *    纯生病住院无死刑结果锚放行（普通病不归本引擎）；
 *  - 型B reprieve（廉价秒解除）：
 *    TRIGGER 廉价解除锚（误诊/拿错报告/国外新药/奇迹/配型成功/
 *    偏方 + misdiagnosis/wrong results/miracle cure/new drug/
 *    bone marrow match…）±2行与 HEALED 整体痊愈锚（痊愈/康复/
 *    治好了/癌细胞消失 + fully recovered/cancer-free/cured…）共现；
 *    无触发物的缓慢好转（一年休养慢慢好起来）是合法恢复不成立；
 *  - 相邻 ≤2 行的 DIAG/TRIGGER 行各自合并为同一事件（跨场景头不
 *    合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①SECOND 复查兑付——复查/第二家医院/活检病理/会诊/
 *      第二意见，死刑不是一家医院一张纸；②PROCESS 治疗过程——
 *      化疗/靶向/放疗/手术/疗程，绝症被规范治疗而不是只用来倒计时；
 *      ③PRICE 代价真兑付——恶化、转移、脱发、衰竭、立遗嘱、
 *      临终关怀、真的死去，阀门这次真掐断了；"保持乐观可能有转机"
 *      的预后安慰不救（非复查非治疗非兑付）；
 *    型B：①PROCESS 漫长救治——数月化疗/骨髓移植/术后康复/长期
 *      随访，痊愈不是被误诊一键撤回；②PARTIAL 未全愈——带瘤生存/
 *      仍需复查/随时复发/维持治疗，撤回键留着尾巴；③COST 代价——
 *      倾家荡产花光积蓄/试药副作用/捐献者代价，圆满有刺痛价格；
 *  - 第 1 次豁免（一次绝症桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TerminalDiagnosisOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** verdict=绝症宣判型；reprieve=廉价秒解除型 */
  kind: 'verdict' | 'reprieve';
  /** 是否有复查/治疗/代价兑付/漫长救治/未痊愈（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface TerminalDiagnosisOnCueResult {
  score: number;
  /** 绝症阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: TerminalDiagnosisOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：DIAG 诊断宣告锚 ===== */
const DIAG_ZH_RE = new RegExp(
  /医(?:生|嘱|院)[^。！？\n]{0,12}?(?:说|宣布|宣告|告诉|通知|下(?:了)?(?:判决|诊断)|判定|确诊)|主治(?:医)?师?[^。！？\n]{0,8}?(?:说|宣布|告诉)/.source
  + '|' + /诊断(?:书|结果|证明|报告)|化验(?:单|结果|报告)|病理(?:报告|分析)|检查(?:结果|报告)|体检报告|病危通知(?:书)?|死亡通知/.source
  + '|' + /确诊|查(?:出|到)(?:了)?(?:她|他|我|自己)?(?:身?上)?(?:的)?|被(?:确诊|查出)|肿瘤科/.source,
);

const DIAG_EN_RE = new RegExp(
  /\b(?:doctor|oncologist|physician|specialist)\b[^.?!\n]{0,24}?(?:said|told|announced|confirmed|gave|delivered|diagnosed|informed)/.source
  + '|' + /\bdiagnos(?:is|ed|tic)\b|\bmedical\s+report\b|\btest\s+results\b|\blab\s+results?\b|\bblood\s+(?:test|work)\b|\bpathology\s+report\b|\bCT\s+scan\b|\bMRI\s+scan\b|\bthe\s+scan\s+showed\b|\bbiopsy\b/.source
  + '|' + /\b(?:terminal|advanced|stage)\s+diagnosis\b|\bgiven\s+(?:him|her)\s+(?:\d+|three|six|months)\b/.source,
  'i',
);

/* FATAL 强档：自带死刑语义的结果锚（病名/期限直配） */
const FATAL_STRONG_ZH_RE = /绝症|癌症?晚期|晚期(?:癌症?|肿瘤|肺癌|胃癌|肝癌|肠癌|乳腺癌|胰腺癌?|骨癌|脑癌|淋巴)|白血病|淋巴癌|淋巴瘤|尿毒症|渐冻(?:人)?症|胰腺(?:癌|肿瘤)|恶性肿瘤|恶性(?:黑色(?:素)?瘤)?|胶质母细胞瘤|只剩(?:下|了)?[\d一二三四五六七八九十两半]+(?:个)?(?:月|周|天|年)(?:寿命|时间|日子|活头|光景)?|活不过(?:今年|年底|冬天|[\d一二三四五六七八九十两半]+(?:个)?(?:月|年))|时日无多|时日不多|命不久矣|来日无多|余日无多|(?:下|收到|接到)(?:了)?死亡通知书|判(?:了|下)?死刑|治愈率?几乎为零|没(?:几天|几个月)(?:好活|活头|日子)了?|晚期肿瘤/;

const FATAL_STRONG_EN_RE = /\bterminal(?:ly\s+ill)?\b|\bterminal\s+(?:cancer|illness|diagnosis|patient|disease)\b|\badvanced\s+(?:cancer|tumor|tumour|carcinoma|disease)\b|\bstage\s+(?:four|4|iii|iv)\s+(?:cancer|tumor|tumour)?\b|\bleukemia\b|\blymphoma\b|\bpancreatic\s+cancer\b|\bmalignant\s+(?:tumor|tumour|growth|melanoma)\b|\bglioblastoma\b|\bonly\s+(?:has\s+|got\s+)?(?:\d+|a\s+few|several|three|six)\s+(?:months|weeks|years)(?:\s+to\s+live)?\b|\bmonths\s+to\s+live\b|\bnot\s+long\s+to\s+live\b|\bgiven\s+(?:him|her)\s+(?:\d+|three|six)\s+months\b|\bincurable\b|\bdeath\s+sentence\b|\bbarely\s+(?:any\s+)?chance\s+of\s+(?:survival|recovery)\b/i;

/* FATAL 弱档：口语化坏消息（需 MED_CONTEXT 兜底，防日常"情况不乐观"） */
const FATAL_WEAK_ZH_RE = /(?:病|身体)(?:情|况)?(?:不太|不|很)(?:乐观|好|妙)|病(?:得|的)(?:很|不轻|严重|厉害)|长(?:了|着)(?:一?个|颗)(?:瘤|肿块|东西|包)|身体里(?:长了|有个)(?:瘤|肿块|东西)|情况(?:不|不太)(?:好|乐观)|检查(?:结果)?(?:有问题|不乐观|是坏消息)|(?:是|得(?:了|上))(?:很|非常|十分)?严重的病|时日可能不多|恐怕(?:撑|活)不了?多久/;

const FATAL_WEAK_EN_RE = /\btest\s+results?\s+(?:were|are)?\s*(?:not|bad|serious)/i;
const FATAL_WEAK_EN_RE2 = /\bnot\s+looking\s+good\b|\bdoesn(?:'t| not)\s+look\s+good\b|\bnot\s+optimistic\b|\ba\s+(?:growth|mass|lump)\b|\bsomething\s+(?:on|in)\s+(?:the\s+)?(?:scan|lung|breast)\b|\bvery\s+sick\b|\bserious\s+(?:illness|condition|disease)\b|\bcondition\s+(?:is|was)\s+(?:serious|critical|grave)\b|\bin\s+(?:the\s+)?hospital\b[^.?!\n]{0,10}?(?:serious|grave|worse)|\bgrave\s+prognosis\b|\bmay\s+not\s+have\s+long\b/i;

/* 医学语境锚：弱档坏消息需它兜底（工作不乐观≠被判死刑） */
const MED_CONTEXT_ZH_RE = /医(?:生|院|嘱)|肿瘤科|化疗|放疗|病房|住院|会诊|CT|核磁|活检|穿刺|病理|化验|主治|急诊|护士|病床|手术/;

const MED_CONTEXT_EN_RE = /\bdoctor\b|\bhospital\b|\boncolog(?:ist|y)\b|\bchemo(?:therapy)?\b|\bward\b|\bbiopsy\b|\bscan\b|\bCT\b|\bMRI\b|\btest\s+results?\b|\bblood\s+work\b|\bsurgeon\b|\bnurse\b|\bmedical\b/i;

/* ===== 型B：TRIGGER 廉价解除锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /误诊|(?:报告|单子|化验单|检查)(?:拿|搞|弄)错了?|检查错了?|查错了?|(?:原来|竟然|居然)(?:是)?误诊|医院搞错/.source
  + '|' + /(?:国外|进口|新出)(?:的)?(?:特效)?(?:新药|特效药|疗法|靶向药)|新药(?:上市|临床试验)|特效(?:药|疗法)|奇迹(?:般)?(?:出现|发生)?|医学奇迹/.source
  + '|' + /配型(?:突然)?成功|骨髓(?:捐献|配型)(?:者)?(?:突然)?(?:出现|找到了)?|找到(?:了)?捐献者|临床试验药|试(?:用)?(?:新)?药|偏方(?:治好了)?/.source,
);

const TRIGGER_EN_RE = new RegExp(
  /\bmisdiagnos(?:is|ed|e?d)?\b|\bwrong\s+(?:results?|report|test|diagnosis|chart)\b|\bmixed\s+up\s+the\s+(?:results?|reports?|tests?)\b|\bthey(?:\s+had)?\s+(?:gotten|made)\s+it\s+wrong\b|\blab\s+error\b/.source
  + '|' + /\bnew\s+(?:drug|treatment|medicine|therapy)\b|\bmiracle\s+(?:cure|drug|recovery)?\b|\bexperimental\s+(?:drug|treatment|therapy)\b|\bforeign\s+(?:drug|treatment)\b|\bcure-all\b|\bwonder\s+drug\b/.source
  + '|' + /\bmatch(?:ed)?\s+(?:for|bone\s+marrow)\b|\bbone\s+marrow\s+(?:donor|match)\b|\bspontaneous\s+remission\b|\bclinical\s+trial\b|\bdonor\s+(?:was|had)\s+been\s+found\b/.source,
  'i',
);

/* HEALED 整体痊愈锚（须与 TRIGGER 配对；无触发的缓慢好转不收） */
const HEALED_ZH_RE = /痊愈了?|完全康复|彻底治好|全治好了?|(?:癌症?|肿瘤|病|白血病)(?:全|都|彻底)?好了?|没事了|癌细胞(?:全)?(?:消失|没了|清零)|肿瘤消失|健健康康|完全好(?:了|透)?|(?:恢复|变回)(?:得)?健健康康|跟正常人一样/;

const HEALED_EN_RE = /\bfully\s+recovered\b|\bcomplete\s+recovery\b|\bcompletely\s+cured\b|\bcancer-free\b|\btumou?r(?:\s+was)?\s+gone\b|\bin\s+(?:full|complete)\s+remission\b|\bhealthy\s+again\b|\bmade\s+a\s+full\s+recovery\b|\ball\s+better\b|\bclean\s+bill\s+of\s+health\b|\bcancer(?:\s+was)?\s+gone\b|\bno\s+trace\s+of\s+(?:the\s+)?cancer\b/i;

/* ===== 型A rescue：SECOND 复查/第二诊断（死刑不是一张纸） ===== */
const SECOND_ZH_RE = /复查|复诊|第二(?:家|轮|次)(?:医院|意见|检查)?|(?:多家|两家|三家)医院|会(?:诊|诊结果)|穿刺(?:活检)?|活检|病理(?:报告|确认|分析)|再查(?:一|了)?遍|换(?:家|了家)?医院|转院(?:检查)?|重新(?:检查|化验|拍片)|专家(?:会诊|确认)/;

const SECOND_EN_RE = /\bsecond\s+opinion\b|\bre-?tested\b|\banother\s+hospital\b|\bbiopsy\b|\bpathology(?:\s+report)?\b|\bfurther\s+tests\b|\brepeated\s+the\s+(?:scan|test)\b|\btransferred\s+to\s+(?:another\s+)?(?:hospital|clinic)\b|\btwo\s+hospitals\b|\bspecialist\s+panel\b|\bre-ran\s+the\s+tests\b|\bnew\s+biopsy\b/i;

/* 型A rescue：PROCESS 治疗过程（绝症被规范治疗，不是只用来倒计时） */
const PROCESS_ZH_RE = /化疗(?:了|进行)?(?:\d+|好几|几个|多个)?(?:个)?疗程?|靶向(?:药|治疗)|放疗|放射治疗|手术(?:切除|治疗)?|抗癌治疗|抗肿瘤治疗|介入治疗|免疫治疗|保守治疗|住院治疗|(?:开始|接受|进行|安排)(?:了)?(?:化疗|治疗|放疗|手术|靶向|介入)|抗肿瘤药|抗癌药/;

const PROCESS_EN_RE = /\bchemotherapy\b|\bchemo\b|\btargeted\s+therapy\b|\bradiation(?:\s+therapy)?\b|\bunderwent\s+(?:chemo|surgery|treatment|radiation)\b|\btreatment\s+(?:plan|sessions?)\b|\brounds?\s+of\s+chemo\b|\bimmunotherapy\b|\bcancer\s+treatment\b|\bsurgery\s+to\s+remove\b|\bstarted\s+(?:chemo|treatment|radiation)\b|\bpost-?op\b/i;

/* 型A rescue：PRICE 代价真兑付（阀门这次真掐断；"保持乐观可能有转机"不救） */
const PRICE_ZH_RE = /(?:病情)?恶化|癌(?:细胞)?(?:扩散|转移|扩散转移)|转移到|扩散到|脱发|掉(?:光)?头发|瘦得(?:脱形|不成人样)|衰竭|奄奄一息|病危|立遗嘱|写遗嘱|临终关怀|保守治疗到最后|咳血|呕血|卧床不起|弥留|咽气|(?:死|去世|离世|走了|没了)|葬礼|后事|止疼针|吗啡|止痛药|最后(?:的)?日子|生命(?:的)?最后/;

const PRICE_EN_RE = /\bmetastasized\b|\bspread\s+to\b|\bworsened\b|\bdeteriorated\b|\bhair\s+(?:loss|fell\s+out)\b|\bhospice\b|\bpalliative\s+care\b|\blost\s+(?:so\s+much\s+)?weight\b|\bbedridden\b|\bdied\b|\bpassed\s+away\b|\bterminal\s+decline\b|\bmorphine\b|\bfuneral\b|\bcoughed\s+up\s+blood\b|\bher\s+final\s+days\b|\bhis\s+final\s+days\b|\blast\s+days\b|\bunconscious\s+in\s+bed\b/i;

/* ===== 型B rescue：RPROCESS 漫长救治（痊愈不是被误诊一键撤回） ===== */
const RPROCESS_ZH_RE = /治疗了?(?:\d+|[一二三四五六七八九十两半]+)(?:个)?(?:月|年)|化疗(?:了|进行)?(?:\d+|好几|几个|多个)(?:个)?疗程|骨髓移植|移植手术|术后(?:休养|恢复|康复)|长期(?:复查|随访|治疗|服药)|抗癌(?:\d+|[一二三四五六七八九十两]+)年|(?:数月|半年|一年|几年|好几个月)[^。！？\n]{0,8}(?:治疗|康复|化疗|手术|休养)|康复(?:训练|中心|治疗)|(?:终于|最终)[^。！？\n]{0,10}(?:化疗|手术|移植)[^。！？\n]{0,10}(?:成功|康复)/;

const RPROCESS_EN_RE = /\bmonths?\s+of\s+(?:treatment|chemo|chemotherapy|rehab)\b|\bbone\s+marrow\s+transplant\b|\bafter\s+(?:surgery|the\s+operation)\s+and\s+(?:rehab|recovery|months)\b|\byears?\s+of\s+(?:treatment|checkups|chemotherapy)\b|\blong\s+treatment\b|\brounds?\s+of\s+chemo\b|\brehab(?:ilitation)?\s+(?:program|therapy)\b|\b(?:six|three|several|eight)\s+months\s+of\b|\bpost-?surgery\s+recovery\b|\bthe\s+treatment\s+took\s+(?:months|years)\b/i;

/* 型B rescue：PARTIAL 未痊愈（撤回键留着尾巴） */
const PARTIAL_ZH_RE = /带瘤生存|仍需(?:定期)?(?:复查|检查|随访)|随时(?:都)?(?:可能)?复发|维持(?:性)?治疗|临床治愈|还在观察(?:期)?|没(?:有)?完全(?:好|康复|痊愈)|(?:病情|指标)(?:暂时)?(?:得到?)?控制住(?:了)?|保守治疗中|靠药物维持|(?:暂时|眼下)(?:没事|稳住)/;

const PARTIAL_EN_RE = /\bliving\s+with\s+(?:the\s+)?cancer\b|\bstill\s+in\s+(?:remission|treatment)\b|\bregular\s+(?:checkups|scans|monitoring)\b|\bcould\s+still\s+recur\b|\bmaintenance\s+therapy\b|\bnot\s+(?:fully|completely)\s+cured\b|\bfor\s+now\b[^.?!\n]{0,12}?(?:remission|stable|control)|\bkeeping\s+it\s+(?:under\s+control|at\s+bay)\b|\bstable\s+for\s+now\b|\bremission(?:\s+but)?\s+[^.?!\n]{0,14}?checkups/i;

/* 型B rescue：COST 代价（圆满有刺痛价格） */
const COST_ZH_RE = /倾家荡产|花光(?:了)?(?:积蓄|家产|家里(?:所有|全部)?(?:的)?钱)|卖(?:了)?(?:房|房子|车)|债台高筑|人财两空|副作用(?:很|巨|特别)?大|试药(?:的)?(?:风险|代价)|捐献(?:骨髓|者)?(?:的)?代价|身体(?:彻底)?垮了?|折寿|欠(?:了|下)?(?:一屁股|巨额|大量)?(?:医药费|债|外债)|(?:募捐|筹款|水滴筹|轻松筹)|医药费(?:天价|高昂)|(?:全家|一家人)的(?:积蓄|钱)(?:都|全)花光/;

const COST_EN_RE = /\bbankrupt(?:ed|cy)?\b|\bruined\s+(?:him|her|them)?\s*financially\b|\blost\s+everything\b|\bsevere\s+side\s+effects\b|\bdonor(?:\s+risk)?\b|\bclinical\s+trial(?:\s+risks?)?\b|\bcost\s+a\s+fortune\b|\bsavings(?:\s+were)?\s+gone\b|\bmedical\s+bills\b|\bfundraiser\b|\bcrowdfunding\b|\bdrained\s+(?:their|the\s+family's)?\s*savings\b|\bgave\s+up\s+everything\b|\bsold\s+the\s+(?:house|apartment|car)\b|\bdebt\b/i;

const PAIR_PAD = 2;
const CONTEXT_PAD = 3;
const RESCUE_PAD = 2;

interface Ev {
  start: number;
  end: number;
  anchorEnd: number;
  kind: 'verdict' | 'reprieve';
  marker: string;
}

/**
 * 纯函数：检测"绝症剧情阀门/死亡判决书当开关"密度病。
 */
export function terminalDiagnosisOnCue(draft: string): TerminalDiagnosisOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const diagRe = zh ? DIAG_ZH_RE : DIAG_EN_RE;
  const fatalStrongRe = zh ? FATAL_STRONG_ZH_RE : FATAL_STRONG_EN_RE;
  const fatalWeakRe = zh ? FATAL_WEAK_ZH_RE : FATAL_WEAK_EN_RE;
  const fatalWeakRe2 = zh ? FATAL_WEAK_ZH_RE : FATAL_WEAK_EN_RE2;
  const medContextRe = zh ? MED_CONTEXT_ZH_RE : MED_CONTEXT_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const healedRe = zh ? HEALED_ZH_RE : HEALED_EN_RE;
  const secondRe = zh ? SECOND_ZH_RE : SECOND_EN_RE;
  const processRe = zh ? PROCESS_ZH_RE : PROCESS_EN_RE;
  const priceRe = zh ? PRICE_ZH_RE : PRICE_EN_RE;
  const rprocessRe = zh ? RPROCESS_ZH_RE : RPROCESS_EN_RE;
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
  const hasDiag: boolean[] = new Array(rawLines.length).fill(false);
  const hasFatalStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasFatalWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasMedCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasHealed: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasDiag[i] = diagRe.test(line);
    hasFatalStrong[i] = fatalStrongRe.test(line);
    hasFatalWeak[i] = fatalWeakRe.test(line) || (!zh && fatalWeakRe2.test(line));
    hasMedCtx[i] = medContextRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasHealed[i] = healedRe.test(line);
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

  /* 型A：DIAG 组 ±2 行找 FATAL（强档直配；弱档需 ±3 行 MED_CONTEXT） */
  for (const g of groupRows(hasDiag)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let fatalLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasFatalStrong[j]) { fatalLine = j; strongHit = true; break; }
      if (fatalLine < 0 && hasFatalWeak[j]) fatalLine = j;
    }
    if (fatalLine < 0) continue; /* 看病检查但没有死刑结果：普通就医放行 */
    let medOk = strongHit;
    if (!medOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, fatalLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasMedCtx[j] || hasFatalStrong[j]) { medOk = true; break; }
      }
    }
    if (!medOk) continue; /* 无医学语境：日常"情况不乐观""长了个记性"不归本引擎 */

    const diagM = (rawLines[g.start].match(diagRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const fatalM = (rawLines[fatalLine].match(strongHit ? fatalStrongRe : (zh ? fatalWeakRe : fatalWeakRe2))?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, fatalLine),
      anchorEnd: fatalLine,
      kind: 'verdict',
      marker: `${diagM}→${fatalM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 HEALED（必须整体痊愈） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let healLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasHealed[j]) { healLine = j; break; }
    }
    if (healLine < 0) continue; /* 有解除触发物但没有整体痊愈：换药/试药仍在治放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const healM = (rawLines[healLine].match(healedRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, healLine),
      anchorEnd: healLine,
      kind: 'reprieve',
      marker: `${trigM}→${healM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: TerminalDiagnosisOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次绝症桥段是类型刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = ev.kind === 'verdict'
      ? (secondRe.test(win) || processRe.test(win) || priceRe.test(win))
      : (rprocessRe.test(win) || partialRe.test(win) || costRe.test(win));
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      kind: ev.kind,
      rescued,
      reason: ev.kind === 'verdict'
        ? (zh
          ? '又是一纸判决——诊断书一递"癌症晚期只剩三个月"，全家态度、情侣关系、仇人恩怨当天全部翻转；没有复查、没有第二意见、没有活检会诊，病人活蹦乱跳只在需要煽情时咳血，绝症是逼和解逼告白逼原谅的万能倒计时'
          : 'another instant terminal verdict - the report comes out "advanced cancer, three months to live" and every relationship flips that same day; no re-test, no second opinion, no biopsy, the patient stays perfectly healthy except for coughing on cue, the diagnosis is a countdown used to force reconciliation, confession and forgiveness')
        : (zh
          ? '又是秒撤回——报告拿错了/误诊了/国外新药/奇迹出现/配型突然成功，癌细胞当场消失；没有漫长治疗、没有移植排异、没有经济代价，死亡通知书是编剧的撤回键：需要悲剧时下发，需要圆满时收回'
          : 'another instant reprieve - the chart was wrong, a misdiagnosis, a foreign wonder drug, a miracle, a donor appears out of nowhere, and the cancer vanishes on the spot; no long treatment, no transplant rejection, no financial cost, the death sentence is an undo button pressed whenever a happy ending is due'),
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    const verdictCount = events.filter((e) => e.kind === 'verdict').length;
    const reprieveCount = events.filter((e) => e.kind === 'reprieve').length;
    issues.push(zh
      ? `${hitCount} 处"绝症剧情阀门"（宣判秒翻转 ${verdictCount} 处、误诊秒痊愈 ${reprieveCount} 处，${n} 处未救）——生死期限成了随取随用的剧情开关：需要悲剧时医生递出"只剩三个月"，关系当天翻转；需要圆满时报告拿错、新药显灵，死亡当场撤销。第一次是类型桥段，第三次观众就看穿：这个剧里死亡从来不是死亡，是可以撤回的情节扳手；而每回宣判都没有复查治疗、每回痊愈都一键清零，绝症和痊愈双双贬值。`
      : `${hitCount} terminal-diagnosis-on-cue beat(s) (${verdictCount} instant verdict, ${reprieveCount} instant reprieve; ${n} unrescued) - the death sentence is a plot switch: when tragedy is needed the doctor hands down "three months to live" and every relationship flips that day; when a happy ending is needed the chart was wrong or a wonder drug works and death is revoked on the spot. Once is genre grammar; by the third, the audience sees death is never death in this story, only a reversible wrench - and when every verdict skips re-tests and treatment and every recovery is a one-click reset, both the illness and the cure lose their value.`);
    advice.push(zh
      ? '让生死恢复它本来的重量。宣判秒翻转型：①让复查兑付——复查、第二家医院、活检病理、专家会诊、第二意见，死刑不该是一家医院一张纸当天下的；②让治疗进场——化疗、靶向、放疗、手术、一个个疗程，绝症被规范处理而不是只当倒计时的背景音，病人也不能活蹦乱跳只在煽情时咳血；③要么让代价真兑付——病情恶化、癌细胞转移、脱发衰竭、立遗嘱、临终关怀，甚至真的死去，阀门这次真掐断才有重量；"保持乐观可能有转机"的空话不救场。误诊秒痊愈型：④让痊愈有漫长救治——数月化疗、骨髓移植、术后康复、长期随访，命是一点点抢回来的不是报告拿错一键撤回的；⑤允许未痊愈的结局——带瘤生存、仍需复查、随时可能复发、维持治疗，撤回键要留着尾巴；⑥如果必须圆满，让它带着价格——倾家荡产花光积蓄、试药的巨大副作用、捐献者的代价，团圆是全家拿命和钱换来的。最忌讳一集两回"医生摇头只剩三个月→全家和解"和"误诊/新药→癌细胞消失→大团圆"。死亡若要被宣判，就得真的压下来；若要被撤回，也不能白撤回。'
      : 'Give life and death their real weight. For instant-verdict beats: (1) let re-testing in - a re-run, a second hospital, a biopsy with pathology, a specialist panel, a second opinion; a death sentence should not be one paper from one hospital in one afternoon. (2) Let treatment in - chemotherapy, targeted therapy, radiation, surgery, session after session; the illness is treated, not just used as countdown background music, and the patient cannot stay perfectly healthy except when the scene calls for coughing blood. (3) Or let the price be paid in full - deterioration, metastasis, hair loss, organ failure, a will, hospice, even an actual death; the valve only carries weight when it really shuts. Empty comfort like "stay positive, there might still be hope" does not rescue it. For instant-reprieve beats: (4) give recovery a long fight - months of chemo, a bone marrow transplant, post-surgical rehab, years of follow-up; a life is won back inch by inch, not restored because a chart got swapped. (5) Allow endings that are not fully cured - living with the tumor, regular scans, recurrence risk, maintenance therapy; the undo button must keep a tail. (6) If it must end well, make it cost something - bankruptcy, life savings gone, brutal trial-drug side effects, the donor\'s price; the reunion is bought with money and years of the family\'s life. The unforgivable pattern is two "doctor shakes his head, three months to live -> family reconciles" and "misdiagnosis/wonder drug -> cancer gone -> reunion" loops per episode. If death is pronounced, it must actually press down; if it is revoked, it must not be revoked for free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
