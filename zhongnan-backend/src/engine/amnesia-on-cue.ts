import { isSceneHeaderLine } from './script-scenes';
/**
 * 失忆剧情阀门 / 脑子当开关检测（v2.105 块113，创作能力类）
 * ------------------------------------------------------------------
 * 病象：竖屏短剧把角色的记忆当成随取随用的剧情开关。两种形态反复
 *   出现——
 *   A 撞击秒失忆型：摔下楼梯、车祸、脑袋挨了一棍，醒来她谁都记得，
 *     唯独不记得男主/自己犯下的罪，失忆范围精准服务剧情；没有CT、
 *     没有神经科、没有观察期，磕一下头，过去立刻被格式化，误会、
 *     替身、追妻火葬场想开就开；
 *   B 廉价秒恢复型：剧情需要大团圆时，再撞一下脑袋（二次撞击疗法）、
 *     听到一首老歌、看见一条旧项链、闻到一阵熟悉香味，记忆瞬间全部
 *     涌回，没有治疗、没有康复、没有碎片期，脑子是编剧的暂停键与
 *     快进键：需要误会时失忆，需要和解时恢复。
 *   第一次是类型桥段，第三次观众就看穿：这个剧里记忆从来不是人格，
 *   是情节的扳手。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - memory-ledger（v2.80）：跨集失忆状态连续性（失忆了却记得关键
 *    信息=穿帮），不检测单集"失忆/恢复来得便宜"的触发密度；
 *  - memory-fakeout-check（v2.144）：梦境/幻觉/闪回段落的入梦标记、
 *    收束与信息增量，不管记忆状态切换的机制成本；
 *  - faint-on-cue：晕倒掐断当场信息流（昏过去片段）；wake-on-cue：
 *    昏迷随叫随醒；本引擎专管醒来之后的记忆状态白给——"身体阀门"
 *    家族新员，颅脑通道（晕倒→病床→伤势→妊娠→记忆）；
 *  - creativity.ts 仅一条 amnesia_cancer 套路回避建议，无检测。
 *
 * 判定（双型事件，各自双锚）：
 *  - 型A onset（撞击秒失忆）：
 *    HEAD 头部受创锚（撞头/后脑着地/摔楼梯磕头/车祸头部受创/脑震荡…）
 *    ±2行与 LOST 失忆结果锚共现；LOST 分两档——STRONG（失忆/逆行性
 *    遗忘/选择性失忆/记忆空白/amnesia…）自带失忆语义直配；WEAK
 *    （不记得了/你是谁/认不出/can't remember/who are you…）必须在
 *    事件 ±3 行窗口内另有 MED_CONTEXT 医疗/醒后语境锚（医院/医生/
 *    CT/病房/醒来后/for days…），防"我不记得钥匙放哪"日常遗忘误判；
 *    纯失忆陈述无头部受创锚放行（病变/心理性失忆归 memory-ledger）；
 *  - 型B recall（廉价秒恢复）：
 *    TRIGGER 廉价触发锚（又撞一下头/听到那首歌/看到旧项链/闻到熟悉
 *    香味/熟悉场景/一句话刺激/催眠 + hit her head again/hearing the
 *    song/saw the old necklace/familiar scent/triggered…）±2行与
 *    RESTORED 整体恢复锚（全都想起来/记忆涌回/恢复记忆 + memories
 *    flooded back/remembered everything/it all came back…）共现；
 *    RESTORED 必须是"整体记忆恢复"语义，纯想起一件小事放行（"看到
 *    钥匙想起来放哪"归日常）；无触发物的缓慢好转是合法恢复不成立；
 *  - 相邻 ≤2 行的 HEAD/TRIGGER 行各自合并为同一事件（跨场景头不
 *    合并）；两型事件合并按行排序，统一计数；
 *  - rescue（窗口 start−2…end+2，含事件自身，仅跳过场景头）：
 *    型A：①CARE 真实医学兑付——CT/核磁共振/神经科/脑震荡诊断/
 *      留院观察/医生解释失忆机制，失忆被规范处理；②PERMANENT 持续
 *      代价——最终没恢复/永久性失忆/带着缺失生活，阀门这次真掐断了；
 *      ③PRICE 失忆有代价——失忆期间被人利用冒名骗婚、生活失能、
 *      连亲生孩子都不认，暂停键按下期间剧情照付成本；
 *    型B：①PROCESS 治疗恢复——心理治疗/催眠疗程/数月康复后逐渐
 *      恢复，记忆不是被歌一键读档；②PARTIAL 碎片恢复——只想起一点
 *      片段、仍有空白，恢复不白给；③TRAUMA 恢复伴随代价——头痛
 *      欲裂、崩溃痛哭、涌回的全是创伤画面，圆满记忆有刺痛价格；
 *  - 第 1 次豁免（一次失忆桥段是类型刚需），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface AmnesiaOnCueHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** onset=撞击秒失忆型；recall=廉价秒恢复型 */
  kind: 'onset' | 'recall';
  /** 是否有医学兑付/持续代价/治疗过程/碎片/创伤（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface AmnesiaOnCueResult {
  score: number;
  /** 失忆阀门事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: AmnesiaOnCueHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ===== 型A：HEAD 头部受创锚 ===== */
const HEAD_ZH_RE = new RegExp(
  /(?:后脑|后脑勺|脑袋|头部|额头|太阳穴|头顶)(?:重重地?)?(?:着地|磕(?:在|到|了)?|撞(?:在|到|了|上)?|碰(?:在|到)?|砸(?:在|到|中|了)?|挨(?:了)?(?:一)?(?:棍|拳|下|击))/.source
  + '|' + /(?:头|脑袋|后脑)(?:被|给|挨)(?:人)??(?:打|砸|敲|撞|碰|击)[^。！？\n]{0,6}?(?:一下|一拳|一棍|重击|着地)?/.source
  + '|' + /摔(?:倒|了一跤|下楼梯)?[^。！？\n]{0,8}?(?:头|后脑|脑袋|额头)(?:着地|磕(?:在|到)?|撞(?:在|到)?|碰(?:在|到)?)?/.source
  + '|' + /滚下?楼梯[^。！？\n]{0,8}?(?:头|后脑|脑袋)|跌下楼梯[^。！？\n]{0,8}?(?:头|后脑|脑袋)/.source
  + '|' + /车(?:祸|猛地撞上?)[^。！？\n]{0,10}?(?:头部受创|头撞|撞到了?头|脑袋撞|颅脑)/.source
  + '|' + /头部受创|颅脑损伤|脑震荡|撞击(?:了)?(?:头部|后脑)|一(?:棍|拳|把)[^。！？\n]{0,4}(?:砸|打|敲)(?:在|中|到)?(?:他的|她的)?(?:头|后脑|脑袋|额头)/.source
  + '|' + /(?:撞|磕|碰)(?:到|在)(?:了)?(?:头|后脑|脑袋|额头)(?:上)?/.source,
);

const HEAD_EN_RE = new RegExp(
  /\b(?:hit|struck|banged|cracked|slammed|bumped)\s+(?:her|his)\s+head\b/.source
  + '|' + /\b(?:her|his)\s+head\s+(?:hit|struck|slammed|cracked|banged|bumped)\b/.source
  + '|' + /\bhead\s+(?:hit|struck|slammed|cracked|banged)\s+(?:on|against|the\s+ground|the\s+floor|the\s+windshield)\b/.source
  + '|' + /\b(?:fell|tumbled|crashed)\s+(?:down\s+the\s+stairs)?[^.?!\n]{0,14}?head(?:\s+first)?\s+(?:on|against|into)\b/.source
  + '|' + /\bblow\s+to\s+(?:the\s+)?head\b|\bhead\s+injury\b|\bhead\s+trauma\b|\bconcussion\b|\b(?:traumatic\s+)?brain\s+injury\b|\bskull\s+fracture\b/.source
  + '|' + /\b(?:car|traffic)\s+accident\b[^.?!\n]{0,14}?head/.source,
  'i',
);

/* LOST 强档：自带失忆语义的结果锚（诊断/状态词直配） */
const LOST_STRONG_ZH_RE = /失忆|失去(?:了)?记忆|记忆全无|记忆全失|记忆空白|记忆缺失|记忆断片|逆行性遗忘|顺行性遗忘|脑震荡后?遗忘|选择性(?:失忆|遗忘)|短暂性(?:失忆|记忆障碍|遗忘)|外伤性(?:失忆|遗忘)|心因性(?:失忆|遗忘)|解离性遗忘|得(?:了|上)?失忆症/;

const LOST_STRONG_EN_RE = /\bamnesia\b|\bmemory\s+loss\b|\blost\s+(?:his|her|their)\s+memor(?:y|ies)\b|\bretrograde\s+amnesia\b|\bselective\s+memory\s+loss\b|\bdissociative\s+amnesia\b|\bmemory\s+blank(?:ed)?\b|\bblanked?\s+(?:it\s+)?out\b|\bremembered\s+nothing\b|\bcouldn(?:'t| not)\s+remember\s+anything\b|\bno\s+memories\s+of\b/i;

/* LOST 弱档：口语识认失败（需 MED_CONTEXT 兜底，防日常遗忘） */
const LOST_WEAK_ZH_RE = /不记得了|记不得了|啥都不记得|什么都不记得|什么也?想不起来|一点都?想不起来|想不起(?:来|他|她|以前)|认不出(?:他|她|你|来了)?|不认识(?:他|她|你|了)|你是谁(?:啊|呀)?|连[^。！？\n]{0,8}(?:都|也)?(?:不认得?|认不出|没印象)|忘了(?:他|她|所有|一切|以前|过去)|对(?:他|她|你|过去)(?:一点|完全|全然)?(?:没印象|没记忆)|不记得自己是谁/;

const LOST_WEAK_EN_RE = /\bcan(?:'t|not)\s+remember\b|\bcouldn(?:'t| not)\s+remember\b|\bdoes(?:n't| not)\s+recogn(?:i[sz]|ise)\b|\bdidn(?:'t| not)\s+recogn(?:i[sz]|ise)\b|\bwho\s+are\s+you\b|\bno\s+memory\s+of\b|\bforgot\s+(?:everything|who\s+(?:he|she)\s+was)\b|\bdoesn(?:'t| not)\s+know\s+who\s+(?:he|she|you)\b|\bnot\s+sure\s+who\s+(?:he|she|you)\b/i;

/* 医疗/醒后语境锚：弱档失忆词需它兜底（醒来识认失败≠日常丢钥匙） */
const MED_CONTEXT_ZH_RE = /医(?:生|院|嘱)|急诊|病房|住院|CT(?:检查|片子|扫描|报告)?|核磁共振|\bMRI\b|脑部(?:检查|扫描|CT)|神经(?:内|外)?科|脑震荡|诊断(?:书|结果)?|苏醒|醒来|醒后|睁眼(?:醒来)?|昏迷|病床|这些天|这几天|出事之后|车祸之后|担架|救护车/;

const MED_CONTEXT_EN_RE = /\bdoctor|hospital|ER\b|\bCT\s+scan\b|\bMRI\b|\bbrain\s+scan\b|\bneurolog(?:y|ist)\b|\bdiagnosed\b|\bconcussion\b|\bwoke\s+up\b|\bwhen\s+(?:he|she)\s+woke\b|\bcoma\b|\bunconscious\b|\bfor\s+days\b|\bsince\s+the\s+accident\b|\bhospital\s+bed\b|\bambulance\b|\bstretcher\b/i;

/* ===== 型B：TRIGGER 廉价触发锚 ===== */
const TRIGGER_ZH_RE = new RegExp(
  /又(?:撞|磕|碰)(?:了|到)?(?:一下|一次)?(?:头|脑袋|后脑)|再(?:撞|磕|碰|摔)(?:了|到)?(?:一下|一次)?(?:头|脑袋|后脑)|头(?:又|再次)(?:撞|磕|碰|被打|挨了)/.source
  + '|' + /(?:听到|听见|耳畔响起|店里放着|响着)(?:那首|熟悉的|久违的)?(?:歌|歌声|音乐|旋律|曲子|摇篮曲)|熟悉的?(?:旋律|歌声)(?:响起|传来)/.source
  + '|' + /(?:看到|看见|瞥见|翻出|拿出)(?:那(?:条|根|只|张|件)?|熟悉的)?(?:项链|手链|手镯|照片|旧照片|信物|礼物|旧物|画|裙子|娃娃|戒指|书签)|旧地重游|回到(?:熟悉的)?(?:老屋|旧居|故地)/.source
  + '|' + /(?:闻到|一阵)(?:熟悉的)?(?:香味|味道|花香|香水味|栀子花香|饭菜香)|熟悉的?(?:场景|画面|地方|街道|屋子|背影)/.source
  + '|' + /一句(?:话)?(?:刺激|点醒|提醒|戳中)|被(?:那句话|这番话)(?:刺激|点醒)|(?:接受|做)(?:了)?催眠(?:治疗)?|催眠师?/.source,
);

const TRIGGER_EN_RE = new RegExp(
  /\b(?:hit|bumped|struck|banged)\s+(?:her|his)\s+head\s+again\b|\bsecond\s+blow\s+to\s+(?:the\s+)?head\b|\bhit\s+(?:her|his)\s+head\s+a\s+second\s+time\b/.source
  + '|' + /\b(?:hearing|heard)\s+(?:the\s+)?(?:familiar\s+)?(?:song|melody|tune|lullaby|music)\b|\bthe\s+song\s+(?:came|played)\s+on\b/.source
  + '|' + /\b(?:saw|seeing|spotted|found)\s+(?:the\s+)?(?:old\s+)?(?:necklace|bracelet|photo(?:graph)?|keepsake|ring|doll|dress|bracelet|letter|hairpin)\b/.source
  + '|' + /\bfamiliar\s+(?:scent|smell|perfume|place|scene|street|room|face|surroundings)\b|\bthe\s+scent\s+of\s+(?:gardenias|her\s+perfume)\b/.source
  + '|' + /\b(?:those\s+words|that\s+one\s+sentence)\s+(?:triggered|jolted|snapped)\b|\btriggered\s+(?:the\s+)?memory\b|\bunder\s+hypnosis\b|\bhypnotherap|\btrigger\s+(?:pulled|flipped)\b/.source,
  'i',
);

/* RESTORED 整体恢复锚（纯想起一件小事不收） */
const RESTORED_ZH_RE = /全都想起来了|全部(?:都)?想起来|一切(?:都)?想起来|什么都想起来了|所有(?:的)?(?:事|记忆)(?:都)?想起来|记忆(?:全都|全部|一下子|猛地|骤然|如潮水般)?(?:涌回|涌了回来|回来|恢复)|恢复(?:了)?(?:全部)?记忆|记忆恢复|(?:全|都)记(?:起|得)来了|脑海(?:里|中)(?:全|都|一下子)|过去的(?:一切|记忆)(?:全|都)|前尘往事(?:一齐|一下子)?(?:涌|回)|记起了所有/;

const RESTORED_EN_RE = /\bmemories\s+flooded\s+back\b|\bit\s+all\s+came\s+(?:back|flooding\s+back)\b|\beverything\s+came\s+(?:flooding\s+)?back\b|\bremembered\s+everything\b|\ball\s+(?:his|her)\s+memories\s+(?:came|returned|rushed)\s+back\b|\bmemory\s+returned\b|\bmemories?\s+returned\s+in\s+a\s+rush\b|\bregained\s+(?:his|her)\s+memor(?:y|ies)\b|\bthe\s+whole\s+past\s+rushed\s+back\b|\beverything\s+rushed\s+back\b/i;

/* ===== 型A rescue：CARE 真实医学兑付 ===== */
const CARE_ZH_RE = /CT(?:检查|扫描|片子|报告|显示)?|核磁共振|\bMRI\b|脑部(?:CT|扫描|检查|影像)|神经(?:内|外)?科(?:医生|检查|会诊)?|脑震荡(?:诊断|确诊|报告)?|留院观察|住院观察|住院(?:治疗|检查)|医(?:生|院)[^。！？\n]{0,16}(?:解释|告知|说|诊断|检查|确认)[^。！？\n]{0,16}(?:脑震荡|失忆|记忆|逆行|遗忘|瘀血压迫|脑部)|颅内(?:淤血|出血|水肿)|(?:安排|做了?)(?:脑部|头颅)?CT/;

const CARE_EN_RE = /\bCT\s+scan\b|\bMRI\b|\bbrain\s+scan\b|\bneurolog(?:ist|y)\b|\bdiagnosed\s+with\s+(?:a\s+)?concussion\b|\bdoctor\s+explained\b[^.?!\n]{0,20}?(?:amnesia|memory|concussion|swelling)|\bkept\s+(?:him|her)\s+for\s+observation\b|\bhospitali[sz]ed\s+for\s+observation\b|\bswelling\s+on\s+the\s+brain\b|\bintracranial\s+(?:bleeding|swelling|hematoma)\b|\bmemory\s+clinic\b|\bordered\s+a\s+(?:CT|brain)\s+scan\b/i;

/* 型A rescue：PERMANENT 持续代价（完成态；"可能恢复"的预后安慰不收） */
const PERMANENT_ZH_RE = /(?:再也|最终|一直|始终)没(?:能)?(?:恢复|想起来|找回|记起)|永久(?:性)?(?:失忆|记忆损伤|记忆障碍)|记忆(?:永远|再也没)(?:回来|恢复)|带着(?:失忆|记忆缺失|那段空白)|后(?:半|余)生(?:都|再没)(?:想起|恢复)|失忆终老|那段记忆(?:永远)?(?:成了|是)空白/;

const PERMANENT_EN_RE = /\bnever\s+recovered\s+(?:his|her)\s+memory\b|\bnever\s+came\s+back\b|\bpermanent\s+(?:amnesia|memory\s+loss)\b|\blived\s+(?:out\s+)?(?:his|her)\s+life\s+with\s+(?:the\s+)?gaps\b|\bmemory\s+never\s+returned\b|\bthose\s+memories\s+were\s+gone\s+forever\b|\bfor\s+the\s+rest\s+of\s+(?:his|her)\s+life\b[^.?!\n]{0,16}?(?:remember|memory|forgot)|\bnever\s+remembered\s+again\b/i;

/* 型A rescue：PRICE 失忆有代价（暂停键按下期间剧情照付成本） */
const PRICE_ZH_RE = /被(?:人)?利用(?:她|他)?(?:失忆|记不得|什么都不记得)|冒(?:名|充)(?:顶替)?|骗(?:婚|走|取|签)|(?:生活|日子)(?:不能自理|一团糟|全乱了|彻底毁了)|谁都?不认得?[^。！？\n]{0,10}(?:哭|痛|苦|折磨|无助)|连(?:自己的?)?(?:孩子|女儿|儿子|妈|母亲|丈夫)[^。！？\n]{0,6}(?:都|也)?不认得?|失忆(?:的)?(?:痛苦|折磨|无助)|茫然(?:失措|地站|流落)|流落街头|被赶出|被送进(?:疗养院|精神病院)/;

const PRICE_EN_RE = /\btook\s+advantage\s+of\s+(?:his|her)\s+amnesia\b|\bpretended\s+to\s+be\s+(?:his|her)\b|\bimpostor\b|\bimpersonated\b[^.?!\n]{0,12}?(?:amnesia|memory)|\bcouldn(?:'t| not)\s+function\b[^.?!\n]{0,12}?(?:alone|daily|on\s+her\s+own)|\blife\s+fell\s+apart\b|\bdidn(?:'t| not)\s+recogn(?:i[sz]|ise)\s+(?:his|her)\s+own\s+(?:child|daughter|son|mother|husband)\b|\bsuffered\s+(?:from|through)\s+the\s+memory\s+loss\b|\blost\s+and\s+disoriented\b|\bwandered\s+the\s+streets\b|\bcommitted\s+to\s+(?:a\s+)?(?:facility|institution)\b/i;

/* ===== 型B rescue：PROCESS 治疗恢复 ===== */
const PROCESS_ZH_RE = /心理(?:医生|治疗|咨询|干预)|精神(?:科|科医生|病院)|临床心理|催眠(?:治疗|疗法|疗程)(?:做了|进行了|持续)?|长期(?:治疗|康复|疗养)|(?:连续|持续)?治疗了?[^。！？\n]{0,8}(?:个?月|周|年)|康复(?:训练|治疗|疗程)|经过(?:长期|半年|数月|数周)[^。！？\n]{0,10}(?:治疗|康复|疏导)|(?:几个月|数周|半年|一年)后[^。！？\n]{0,10}(?:慢慢|逐渐|才|开始)?(?:恢复|想起)|慢慢(?:地)?(?:恢复|想起)|逐渐(?:恢复|想起|找回)|一点点(?:恢复|想起|拼回)|在(?:医生|治疗师)[^。！？\n]{0,8}(?:帮助|治疗)下/;

const PROCESS_EN_RE = /\btherapy\s+sessions?\b|\bpsychotherap\w*\b|\bclinical\s+hypnosis\b|\bmonths?\s+of\s+(?:therapy|treatment|rehab(?:ilitation)?)\b|\brehab(?:ilitation)?\s+(?:program|therapy)\b|\bgradually\s+recovered\s+(?:his|her)?\s*memor(?:y|ies)?\b|\bmemories?\s+came\s+back\s+slowly\b|\bover\s+(?:weeks|months)\s+of\b|\btreated\s+by\s+(?:a\s+)?(?:psychiatrist|neurologist|therapist|hypnotherapist)\b|\bslowly\s+regained\b|\bpiece\s+by\s+piece\s+over\b/i;

/* 型B rescue：PARTIAL 碎片恢复（不白给的恢复） */
const PARTIAL_ZH_RE = /只想起(?:一点|一些|片段|碎片|零星)|只记(?:得|起)(?:一点|一些|片段|碎片)|碎片(?:化)?(?:的)?记忆|记忆碎片|断断续续(?:想起|恢复)|还没(?:完全|全)(?:好|恢复|想起)|记忆(?:仍|还)(?:有)?(?:缺失|空白|断层)|缺了一块|只恢复了(?:一点|部分)|模模糊糊(?:想起|记得)/;

const PARTIAL_EN_RE = /\bonly\s+fragments\s+came\s+back\b|\bpartial\s+memor(?:y|ies)\b|\bpieces\s+came\s+back\b|\bstill\s+(?:had\s+)?gaps\b|\bnot\s+everything\s+came\s+back\b|\bbits\s+and\s+pieces\b|\bdidn(?:'t| not)\s+remember\s+it\s+all\b|\bblurry\s+pieces\b|\bonly\s+part\s+of\s+(?:his|her)\s+memory\s+returned\b|\bmemory\s+remained\s+fragmented\b/i;

/* 型B rescue：TRAUMA 恢复伴随代价（记忆圆满有刺痛价格） */
const TRAUMA_ZH_RE = /头痛欲裂|头疼欲裂|抱(?:着)?头(?:痛苦|蜷缩|蹲下|跪倒)|记忆(?:反噬)?[^。！？\n]{0,6}(?:全是|尽是)(?:痛苦|血腥|惨烈)|想起来的全是(?:痛苦|血腥)|崩溃(?:大哭|痛哭|尖叫)|再次(?:受创|经历|陷入)(?:创伤|噩梦)|(?:痛苦|惨烈|血腥)的画面(?:全|都|一齐)?(?:涌|回)|承受不住(?:记忆|真相)|放声痛哭|创伤后?应激|蜷缩(?:发抖|在地)/;

const TRAUMA_EN_RE = /\bagon(?:i|iz)ing\s+headache\b|\bclutched\s+(?:his|her)\s+head\s+in\s+(?:agony|pain)\b|\bremembered\s+(?:only\s+)?the\s+trauma\b|\ball\s+that\s+came\s+back\s+was\s+(?:pain|the\s+nightmare)\b|\bbroke\s+down\b[^.?!\n]{0,16}?(?:remember|memor(?:y|ies)|came\s+back)|\brelived\s+the\s+(?:trauma|nightmare|horror)\b|\boverwhelmed\s+by\s+the\s+memories\b|\bPTSD\b|\bmemories\s+hit\s+(?:him|her)\s+like\s+a\s+(?:truck|blow)\b|\bscreamed\s+as\s+it\s+all\s+came\s+back\b/i;

const PAIR_PAD = 2;
const CONTEXT_PAD = 3;
const RESCUE_PAD = 2;

interface Ev {
  start: number;
  end: number;
  anchorEnd: number;
  kind: 'onset' | 'recall';
  marker: string;
}

/**
 * 纯函数：检测"失忆剧情阀门/脑子当开关"密度病。
 */
export function amnesiaOnCue(draft: string): AmnesiaOnCueResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const headRe = zh ? HEAD_ZH_RE : HEAD_EN_RE;
  const lostStrongRe = zh ? LOST_STRONG_ZH_RE : LOST_STRONG_EN_RE;
  const lostWeakRe = zh ? LOST_WEAK_ZH_RE : LOST_WEAK_EN_RE;
  const medContextRe = zh ? MED_CONTEXT_ZH_RE : MED_CONTEXT_EN_RE;
  const triggerRe = zh ? TRIGGER_ZH_RE : TRIGGER_EN_RE;
  const restoredRe = zh ? RESTORED_ZH_RE : RESTORED_EN_RE;
  const careRe = zh ? CARE_ZH_RE : CARE_EN_RE;
  const permanentRe = zh ? PERMANENT_ZH_RE : PERMANENT_EN_RE;
  const priceRe = zh ? PRICE_ZH_RE : PRICE_EN_RE;
  const processRe = zh ? PROCESS_ZH_RE : PROCESS_EN_RE;
  const partialRe = zh ? PARTIAL_ZH_RE : PARTIAL_EN_RE;
  const traumaRe = zh ? TRAUMA_ZH_RE : TRAUMA_EN_RE;

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
  const hasHead: boolean[] = new Array(rawLines.length).fill(false);
  const hasLostStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasLostWeak: boolean[] = new Array(rawLines.length).fill(false);
  const hasMedCtx: boolean[] = new Array(rawLines.length).fill(false);
  const hasTrigger: boolean[] = new Array(rawLines.length).fill(false);
  const hasRestored: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasHead[i] = headRe.test(line);
    hasLostStrong[i] = lostStrongRe.test(line);
    hasLostWeak[i] = lostWeakRe.test(line);
    hasMedCtx[i] = medContextRe.test(line);
    hasTrigger[i] = triggerRe.test(line);
    hasRestored[i] = restoredRe.test(line);
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

  /* 型A：HEAD 组 ±2 行找 LOST（强档直配；弱档需 ±3 行 MED_CONTEXT） */
  for (const g of groupRows(hasHead)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let lostLine = -1;
    let strongHit = false;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasLostStrong[j]) { lostLine = j; strongHit = true; break; }
      if (lostLine < 0 && hasLostWeak[j]) lostLine = j;
    }
    if (lostLine < 0) continue; /* 撞头后没有失忆结果：普通动作戏/打架放行 */
    let medOk = strongHit;
    if (!medOk) {
      const clo = Math.max(0, g.start - CONTEXT_PAD);
      const chi = Math.min(rawLines.length - 1, lostLine + CONTEXT_PAD);
      for (let j = clo; j <= chi; j += 1) {
        if (sceneOf[j] !== sceneOf[g.start]) continue;
        if (hasMedCtx[j] || hasLostStrong[j]) { medOk = true; break; }
      }
    }
    if (!medOk) continue; /* 无医疗/醒后语境：日常"我不记得钥匙放哪"不归本引擎 */

    const headM = (rawLines[g.start].match(headRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const lostM = (rawLines[lostLine].match(strongHit ? lostStrongRe : lostWeakRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, lostLine),
      anchorEnd: lostLine,
      kind: 'onset',
      marker: `${headM}→${lostM}`.slice(0, 28),
    });
  }

  /* 型B：TRIGGER 组 ±2 行找 RESTORED（必须整体记忆恢复） */
  for (const g of groupRows(hasTrigger)) {
    const lo = Math.max(0, g.start - PAIR_PAD);
    const hi = Math.min(rawLines.length - 1, g.end + PAIR_PAD);
    let restLine = -1;
    for (let j = lo; j <= hi; j += 1) {
      if (sceneOf[j] !== sceneOf[g.start]) continue;
      if (hasRestored[j]) { restLine = j; break; }
    }
    if (restLine < 0) continue; /* 有触发物但没有整体恢复：听歌怀旧/日常想起一件事放行 */

    const trigM = (rawLines[g.start].match(triggerRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 10);
    const restM = (rawLines[restLine].match(restoredRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, 14);
    events.push({
      start: g.start,
      end: Math.max(g.end, restLine),
      anchorEnd: restLine,
      kind: 'recall',
      marker: `${trigM}→${restM}`.slice(0, 28),
    });
  }

  /* 两型事件按锚点行排序，统一计数 */
  events.sort((a, b) => a.anchorEnd - b.anchorEnd);

  /* pass3：rescue 检测（按型分路；窗口含事件自身，仅跳过场景头行） */
  const hits: AmnesiaOnCueHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次失忆桥段是类型刚需） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = ev.kind === 'onset'
      ? (careRe.test(win) || permanentRe.test(win) || priceRe.test(win))
      : (processRe.test(win) || partialRe.test(win) || traumaRe.test(win));
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
          ? '又是一撞就失忆——摔楼梯、车祸、一棍闷头，醒来谁都记得唯独不记得该忘的人，失忆范围精准服务剧情；没有CT、没有神经科、没有观察期，磕一下头过去立刻被格式化，误会、替身、追妻火葬场想开会儿开会儿'
          : 'another bump-on-the-head amnesia beat - stairs, a crash, a blow, and she wakes remembering everyone except exactly the person the plot needs her to forget; no CT, no neurologist, no observation period, one knock formats the past and misunderstanding, identity swaps and groveling arcs switch on whenever convenient')
        : (zh
          ? '又是秒恢复——再撞一下脑袋、听到一首老歌、看见一条旧项链，记忆瞬间全部涌回；没有治疗、没有康复、没有碎片期，脑子是编剧的快进键：需要大团圆时一首歌读档，暂停键按了多久全看剧情还要误会几集'
          : 'another instant-recall beat - a second bump, an old song, a familiar necklace, and every memory floods back at once; no therapy, no rehabilitation, no fragment phase, the mind is a load-game button pressed whenever the reunion is due'),
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    const onsetCount = events.filter((e) => e.kind === 'onset').length;
    const recallCount = events.filter((e) => e.kind === 'recall').length;
    issues.push(zh
      ? `${hitCount} 处"失忆剧情阀门"（撞击秒失忆 ${onsetCount} 处、廉价秒恢复 ${recallCount} 处，${n} 处未救）——记忆成了随取随用的剧情开关：需要误会时撞一下头格式化，需要和解时一首歌读档，失忆范围还总能精准跳过所有人只忘该忘的那一个。第一次是类型桥段，第三次观众就看穿：这个剧里记忆从来不是人格，是情节的扳手；而且每回失忆都毫发无伤、每回恢复都一键圆满，失忆和痊愈双双贬值。`
      : `${hitCount} amnesia-on-cue beat(s) (${onsetCount} bump-to-amnesia, ${recallCount} instant-recall; ${n} unrescued) - memory is a plot switch: one knock formats the past when a misunderstanding is needed, one old song loads the save file when the reunion is due, and the amnesia always spares everyone except the exact person the plot requires forgotten. Once is genre grammar; by the third, the audience sees memory is never identity in this story, only a wrench - and when every memory loss is cost-free and every recovery is one-click, both the loss and the cure lose their value.`);
    advice.push(zh
      ? '让记忆恢复它本来的重量。撞击秒失忆型：①让医学真实进场——急诊、脑部CT、神经科会诊、留院观察，医生用机制解释而不是用失忆许愿，家属等的是检查结论；②要么让失忆真的留下代价——最终没有恢复、永久性的记忆缺失、人物带着空白活下去，阀门这次真掐断了；③更要紧的是让暂停期间照付成本——失忆的人被冒名利用、生活失能、连亲生孩子都不认，失忆不是可以安全停放剧情的停车场；④失忆范围别再精准服务剧情，真的脑损伤是混乱的、丢得没有道理的。廉价秒恢复型：⑤让恢复有治疗过程——心理治疗、催眠疗程、数月康复，记忆一点点拼回来而不是一键读档；⑥允许碎片恢复——先回来气味和画面、名字仍然空白，恢复本身可以写好几场戏；⑦如果必须一次涌回，让它带着价格——头痛欲裂、崩溃痛哭、涌回的全是创伤画面，圆满记忆有刺痛才值钱。最忌讳一集两回"撞头→你是谁→虐恋"和"老歌→全想起来→大团圆"。记忆若要被拿走，就得拿走点什么；若要还回来，也不能白还。'
      : 'Give memory its real weight. For bump-to-amnesia beats: (1) let real medicine in - the ER, a brain scan, a neurology consult, overnight observation; the doctor explains a mechanism instead of granting amnesia by wish, and the family waits for actual findings. (2) Or let the loss leave a real cost - the memory never returns, permanent gaps, a life lived with what is missing; this time the valve really shuts. (3) Most importantly, make the pause itself expensive - the amnesiac is impersonated and exploited, cannot function, does not recognize her own child; amnesia is not a safe parking lot for the plot. (4) Stop tailoring the forgetting to story convenience - real brain injury is messy and erases without logic. For instant-recall beats: (5) give recovery a treatment process - therapy, clinical hypnosis, months of rehabilitation, memory reassembled piece by piece instead of a one-click load. (6) Allow fragmented recovery - a scent and an image return first while names stay blank; the recovery itself can carry scenes. (7) If it must flood back at once, make it cost something - an agonizing headache, a breakdown, nothing but trauma returning; a happy memory earns its sting. The unforgivable pattern is two "bump -> who are you -> angsty romance" and "old song -> everything returns -> reunion" loops per episode. If memory is taken, something must be taken; when it is given back, it must not be free.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
