/**
 * 对手/反派质量检测器（PRD 2.1.26 反派压迫感过硬线）
 * ------------------------------------------------------------------
 * 短剧的爽感公式是"压迫越狠，翻盘越爽"。反派写崩的六种死法：
 *  1) 反派缺席：全片没有具体施压者，冲突无对象（high）
 *  2) 反派太蠢：只会咆哮打人，不设局不收买，主角赢得毫无含金量
 *  3) 反派无脑：为了坏而坏，没有一句动机交代（观众不知道他图什么）
 *  4) 反派不登场：只在转述/电话里施压，从不与主角正面对撞（压力不落地）
 *  5) 反派没筹码：没有权势/证据/关系，威胁是空话（弱威胁）
 *  6) 反派纸片化：从头到尾单一坏笑，没有扭曲逻辑或人性缝隙（低层次提示）
 *
 * 与现有引擎的分工：
 *  - conflict-density-check: 检测"冲突数量"（量）
 *  - character-logic: 检测"人物言行一致"（一致性）
 *  - protagonist-goal-check: 检测"主角能动性"（主角侧）
 *  - antagonist-quality-check (本引擎): 检测"对手的智商/动机/筹码/正面压迫"（反派侧）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
export type AqLang = 'zh' | 'en';

export interface AntagonistIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'absent_antagonist'    // 反派缺席
    | 'stupid_antagonist'    // 反派不设局（纸老虎）
    | 'motiveless_villain'   // 反派无动机
    | 'offstage_villain'     // 反派不正面登场
    | 'weak_threat'          // 反派无筹码
    | 'flat_villain';        // 反派纸片化
  evidence: string;
  advice: string;
}

export interface AntagonistQualityResult {
  /** 反派质量分 0-100（越高反派越有压迫感） */
  score: number;
  /** 施压动作数（威胁/暴力/羞辱） */
  pressureCount: number;
  /** 智商布局数（设局/收买/预料/伪造） */
  competenceCount: number;
  /** 动机信号数（为了/因为/利益/仇恨） */
  motiveCount: number;
  /** 筹码信号数（权势/证据/关系/资本） */
  leverageCount: number;
  /** 层次信号数（扭曲逻辑/人性缝隙） */
  layerCount: number;
  /** 正面对抗信号数（当面甩/揪/逼近/拦/对峙） */
  confrontationCount: number;
  hasDirectConfrontation: boolean;
  issues: AntagonistIssue[];
}

// —— 中文信号库 ——
// 施压：明确的攻击/威胁/羞辱动作（剔除中性的"抢/夺"，避免主角反杀动作误判）
const PRESSURE_ZH = /(威胁|恐吓|威逼|逼迫|逼(?:债|婚|签|迁|我|他|她|你)|扇(?:了|过|在)?|一巴掌|耳光|打(?:翻|倒|在|脸)|踢(?:翻|开|向)|踹|跪下|给我跪|开除|解雇|赶走|赶出去|扔(?:出|在|到)|摔(?:在|碎|门)|撕(?:碎|毁|了)|冷笑(?:着|道|说)?|下令|命令(?:道|说)?|施压|废物|穷鬼|贱人|蠢货|白痴|滚出去|羞辱|当众(?:羞辱|奚落)|咄咄逼人|掐住|摁住|揪住衣领|一笔勾销|勾销(?:这笔)?(?:债|债务)|工资先还债|先还债|还不清|还不起|医药费|手术费|停药|停水(?:停电|停药)?|签了它|给我签|按(?:了)?手印|净身出户|限你(?:\d+|[一二三四五六七八九十]+|明天|今晚|今天|这周|本周)?[天日]?[内之]?(?:答复|搬走|还钱|签字|腾房|走人)?|最后期限|最后通牒|抵押物?|保证人|不签就|不还钱就|欠条|高利贷)/g;
// 智商：反派在"布局"而非只在"发火"
const COMPETENCE_ZH = /(设局|布局|布下|布控|早就(?:安排|料到|布好|买通)|料到|将计就计|陷害|圈套|陷阱|埋伏|收买|买通|策反|转移(?:资产|账本|证据)?|伪造|篡改|栽赃|嫁祸|幕后(?:黑手|主使|操盘)?|一步步|棋先一着|先下手|反将一军|调包|做局|留了后手|安插|空壳(?:公司)?|代签|冒签|(?:保证人|担保人?).{0,8}(?:已经|已|提前|预先).{0,3}签)/g;
// 动机：反派图什么（含弱动机信号"为了/因为"，宁可漏判不误判）
const MOTIVE_ZH = /(因为|由于|为了|为的是|就是要|凭什么|我要(?:夺|抢|得到|上位|报仇|吞)|我就是(?:要|想)|利益|金钱|钱和权|权力|权势欲|地位|仇恨|记恨|怀恨|恨(?:他|她|你|透)?|嫉妒|妒忌|眼红|看上|贪图|吞并|吞掉|当年(?:你|他|她).{0,12}(?:害|对不起|毁|抢)|报仇|复仇|咽不下这口气)/g;
// 筹码：反派凭什么压得住主角
const LEVERAGE_ZH = /(权势|保镖|保安|打手|合同|协议|把柄|证据|黑料|丑闻|资金|资本|投资方|关系网|关系户|职位|董事长|总裁|总经理|老板|律师|法务|后台|靠山|保护伞|股权|股份|公章|账本|监控录像|录音)/g;
// 层次：反派的扭曲逻辑或一闪而过的人味
const LAYER_ZH = /(我也?曾?经|我当年|要怪就怪|怪就怪|这个世界|世界就是|规矩(?:就)?是|弱肉强食|适者生存|身不由己|人在江湖|红了眼眶?|顿了顿|语气一滞|面具.{0,4}瞬间|也曾|都是被逼的|我最初|曾几何时|眼神闪过|犹豫了一?秒|笑(?:容|脸上的笑)?(?:僵|凝)住?|扯(?:了扯|了下|下)?袖口|袖口.{0,4}(?:往下|扯)|脸色(?:一)?变)/g;
// 正面对抗：反派与主角同场直接碰撞
const CONFRONTATION_ZH = /(对峙|当面|甩(?:在|给|到)|摔(?:在|到)|揪住|掐住|按在|摁在|逼近|堵(?:在|到|门)|拦住|挡在|迎(?:面|上)|对视|一拍桌子|猛拍桌子|指着(?:他|她|我|你)的?鼻子|面对面|四目相对|面前|推(?:到|向|过).{0,6}(?:合同|文件|协议|纸)|拍(?:在|向).{0,4}桌)/g;

// —— 英文信号库 ——
const PRESSURE_EN = /(threatened?|threat|blackmail|slapped|grabbed(?: me| her| him| his| her collar)?|shoved|seized|sneered|ordered|you('re| are) fired|fired (?:me|him|her)|kicked|humiliat(?:ed|ing)|trash|you (?:fool|idiot|trash|nothing)|get out|throw(?:n)? (?:you|him|her|them| me) out|clenched (?:his|her) fist|pointed (?:a|the) (?:gun|knife)|tore up|destroyed|sign (?:it|the|here|now|by)|medical bills|debt (?:is )?(?:wiped|canceled|forgiven|not wiped)|wiped clean|by tomorrow|collateral|guarantor|deadline|ultimatum|pay up|settle the debt|default on|or i (?:keep|stop|call))/gi;
const COMPETENCE_EN = /(set (?:me|him|her|it) up|set a trap|planned (?:it|this|everything)|planned ahead|anticipated|one step ahead|framed|bribed|bought off|ambushed|forged|tampered|planted evidence|falsified|mastermind|behind (?:it|this|all)|pulled the strings|orchestrated|had a backup|mole inside|infiltrated|shell compan|siphon(?:ed|ing|s)?|funnel(?:ed|ing|s)?|embezzl|guarantor line|already on the guarantor|forged (?:signature|name))/gi;
const MOTIVE_EN = /(because|since|in order to|i want|i need|i deserve|i crave|for (?:the )?(?:money|power|revenge)|revenge|jealous|env(y|ied)|greed|profit|fortune|status|the throne|he (?:ruined|betrayed|took from) me|years ago|payback|owed to me)/gi;
const LEVERAGE_EN = /(lawyers?|bodyguards?|guards?|contract|leverage|evidence|blackmail material|money|funds|capital|investors?|connections?|boss|ceo|chairman|president|51 percent|majority stake|shares|equity|backing|protection|surveillance|footage|recording|the ledger)/gi;
const LAYER_EN = /(i used to|i was once|once i|blame the world|the world is|the rules (?:are|is)|the weak|survival of the fittest|no choice (?:of|but) my own|i,? too,? (?:was|once)|paused (?:for )?a moment|hesitated for a second|something flickered|in the beginning|i started out|freezes?|froze|tugging (?:his|her) cuff|falter(?:ed|s)?)/gi;
const CONFRONTATION_EN = /(face to face|face-to-face|confronted|confrontation|slammed|grabbed|shoved(?: me| him| her)? against|pinned|cornered|blocked (?:my|his|her|their) way|stepped close|got in (?:my|his|her) face|met (?:his|her) eyes|stood toe to toe|slides? (?:over|across|the|a|him|her).{0,35}(?:contract|agreement|file|papers?|desk)|across the desk|reaches? for (?:the )?(?:contract|agreement|file))/gi;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function countMatches(text: string, re: RegExp): number {
  let n = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    n++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return n;
}

/**
 * 对手/反派质量检测
 * @param text 剧本正文
 * @param lang 语言
 */
export function antagonistQualityCheck(text: string, lang: AqLang): AntagonistQualityResult {
  if (!text || text.trim().length < 20) {
    return {
      score: 100,
      pressureCount: 0,
      competenceCount: 0,
      motiveCount: 0,
      leverageCount: 0,
      layerCount: 0,
      confrontationCount: 0,
      hasDirectConfrontation: false,
      issues: [],
    };
  }

  const issues: AntagonistIssue[] = [];
  const isZh = lang === 'zh';

  const pressureCount = countMatches(text, isZh ? PRESSURE_ZH : PRESSURE_EN);
  const competenceCount = countMatches(text, isZh ? COMPETENCE_ZH : COMPETENCE_EN);
  const motiveCount = countMatches(text, isZh ? MOTIVE_ZH : MOTIVE_EN);
  const leverageCount = countMatches(text, isZh ? LEVERAGE_ZH : LEVERAGE_EN);
  const layerCount = countMatches(text, isZh ? LAYER_ZH : LAYER_EN);
  const confrontationCount = countMatches(text, isZh ? CONFRONTATION_ZH : CONFRONTATION_EN);
  const hasDirectConfrontation = confrontationCount >= 1;

  let penalty = 0;

  // 1) 反派缺席：没有任何具体施压动作——短剧必须有可指认的压迫来源
  if (pressureCount === 0) {
    penalty += 30;
    issues.push({
      severity: 'high',
      type: 'absent_antagonist',
      evidence: isZh ? '全片 0 处反派施压信号（威胁/逼迫/羞辱/暴力）' : 'Zero antagonist pressure signals (threats/coercion/humiliation/violence)',
      advice: isZh
        ? '给主角立一个"看得见、听得着、下得去手"的具体对手：让他在第一场就当面施压（甩合同、下死线、当众羞辱）。短剧的冲突必须有人格化的承受对象，观众才恨得起来、盼着翻盘。'
        : 'Give the protagonist a concrete oppressor who is seen, heard, and ruthless: pressure delivered face-to-face in the first scene (a contract slammed down, a deadline, public humiliation). Short-drama conflict needs a personified target the audience can hate and crave to see fall.',
    });
  }

  // 2) 纸老虎：有足够施压但零布局——反派只是咆哮的工具人
  if (pressureCount >= 3 && competenceCount === 0) {
    penalty += 15;
    issues.push({
      severity: 'mid',
      type: 'stupid_antagonist',
      evidence: isZh ? `${pressureCount} 处施压动作，0 处布局/预谋（设局/收买/伪造）` : `${pressureCount} pressure moves, 0 strategic moves (plots/bribery/forgery)`,
      advice: isZh
        ? '反派只会发火动手，观众会觉得主角赢了也不光彩。给他加一次"聪明的狠"：提前买通关键人物、伪造证据、将计就计设反杀圈套。反派越精明，主角的翻盘越爽。'
        : 'The villain only yells and lashes out, so beating him feels cheap. Give him one smart, cruel move: bribe a key person in advance, plant forged evidence, or turn the protagonist\'s plan into a trap. The smarter the villain, the sweeter the comeback.',
    });
  }

  // 3) 反派无动机：施压 ≥4 却没有一句图什么
  if (pressureCount >= 4 && motiveCount === 0) {
    penalty += 12;
    issues.push({
      severity: 'mid',
      type: 'motiveless_villain',
      evidence: isZh ? `${pressureCount} 处施压，0 处动机交代` : `${pressureCount} pressure moves, 0 motivation cues`,
      advice: isZh
        ? '反派为了坏而坏。补一句他自己的逻辑（"当年你爸夺走我的一切""我要的是整块市场"），哪怕是歪理。有动机的反派才有信念感，对手戏才不是干架而是两种意志对撞。'
        : 'The villain is evil for evil\'s sake. Add one line of his own logic ("Your father took everything from me years ago" / "I want the entire market"), even warped logic. A motivated antagonist has conviction, turning the clash into a collision of wills, not a brawl.',
    });
  }

  // 4) 反派不登场：施压只存在于转述/电话，从不当面对撞
  if (pressureCount >= 3 && !hasDirectConfrontation) {
    penalty += 12;
    issues.push({
      severity: 'mid',
      type: 'offstage_villain',
      evidence: isZh ? `${pressureCount} 处施压，但反派与主角 0 次正面对抗（转述/电话施压）` : `${pressureCount} pressure moves, but 0 direct on-screen confrontations`,
      advice: isZh
        ? '反派一直活在别人的转述和电话里，压力落不了地。安排一场正面戏：反派与主角同框，逼近、对视、拍桌子、当面下最后通牒。短剧观众要看的是"两个人在一个房间里互相施压"。'
        : 'The villain exists only in hearsay and phone calls, so the pressure never lands. Write a face-to-face scene: same room, closing distance, eye contact, a slammed table, an ultimatum delivered in person. Short-drama audiences crave two people pressuring each other in one room.',
    });
  }

  // 5) 弱威胁：有施压却没有筹码——威胁全是空话
  if (pressureCount >= 3 && leverageCount === 0) {
    penalty += 8;
    issues.push({
      severity: 'low',
      type: 'weak_threat',
      evidence: isZh ? `${pressureCount} 处威胁，0 个筹码（权势/合同/证据/关系/资本）` : `${pressureCount} threats, 0 sources of leverage`,
      advice: isZh
        ? '反派的威胁没有兑现能力。把筹码摆到台面上：一份能毁了主角的合同、一段监控、一个掌权的职位、一笔能撤的投资。先证明他"真能做到"，威胁才让人揪心。'
        : 'The villain cannot back his threats. Put leverage on the table: a contract that can ruin the protagonist, surveillance footage, a position of power, funding he can pull. Prove he can actually do it before the threat bites.',
    });
  }

  // 6) 纸片反派：大量施压却零层次——坏得毫无缝隙
  if (pressureCount >= 4 && layerCount === 0) {
    penalty += 6;
    issues.push({
      severity: 'low',
      type: 'flat_villain',
      evidence: isZh ? `${pressureCount} 处施压，0 处扭曲逻辑或人性缝隙` : `${pressureCount} pressure moves, 0 twisted-logic or humanizing beats`,
      advice: isZh
        ? '反派从头到尾只有坏笑，立不住也记不住。给半秒缝隙：一句"这个世界的规矩就是弱肉强食"的歪理、一个听到旧事后的停顿、一闪而过的红眼。缝隙不是洗白，而是让他成为"人"。'
        : 'The villain does nothing but sneer, so he never lands or lingers. Give a half-second crack: a warped maxim about the world, a pause when an old wound is mentioned, a flicker in his eyes. This is not redemption — it makes him human, which makes him scary.',
    });
  }

  const score = clamp(100 - penalty, 0, 100);

  return {
    score,
    pressureCount,
    competenceCount,
    motiveCount,
    leverageCount,
    layerCount,
    confrontationCount,
    hasDirectConfrontation,
    issues,
  };
}
