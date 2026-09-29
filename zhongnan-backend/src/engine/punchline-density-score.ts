import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 金句密度检测器（PRD 2.1.14 短剧传播力生死线）
 * ------------------------------------------------------------------
 * 短剧区别于其他内容形式的核心传播力：金句。
 * 金句不够 → 用户记不住 → 不分享 → 不传播 → 不爆。
 * 金句不"金" → 只是狠话，没有修辞张力 → 截图不下来 → 不传播。
 *
 * 现有引擎关注"内容"维度：
 *  - cool-moment-score 检测"爽点"（情节层面的爽感）
 *  - conflict-density-check 检测"冲突"（情节层面的对抗）
 *  - dialogue-water-check 检测"水分台词"（信息密度）
 *  - voice-print 检测"对白同质化"（角色独特度）
 *
 * 但都没有检测"金句"——台词本身的修辞张力和传播力：
 *  - 有些爽点不是金句（如肢体动作，不是台词）
 *  - 有些冲突不是金句（如打斗描述）
 *  - 有些台词有信息无金句（推进剧情但平淡无奇）
 *
 * 本引擎专注于台词本身的修辞强度和传播力评估。
 *
 * 八种金句类型（按强度从高到低）：
 *  1) reversal     反转点睛：意料之外的结尾点睛，颠覆认知
 *  2) declarative  强势宣言：身份/立场宣告，气场全开
 *  3) contrast     对比反差：前后对比，反差出金句
 *  4) resolution   决心表态：坚定决心，不屈意志
 *  5) threat        威胁压制：压迫感强烈的威胁
 *  6) question      灵魂拷问：直击灵魂的质问
 *  7) parallel      排比强化：三个以上并列，递进强化
 *  8) metaphor      比喻生动：具象化比喻让抽象变具体
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type PdLang = 'zh' | 'en';

export interface PunchlineIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 金句类型 */
export type PunchlineType =
  | 'reversal'      // 反转点睛：意料之外的结尾点睛
  | 'declarative'  // 强势宣言：身份/立场宣告
  | 'contrast'     // 对比反差：前后对比反差
  | 'resolution'   // 决心表态：坚定决心
  | 'threat'       // 威胁压制：压迫感威胁
  | 'question'     // 灵魂拷问：直击灵魂的质问
  | 'parallel'     // 排比强化：并列递进
  | 'metaphor'     // 比喻生动：具象化比喻
  | 'weak';        // 弱金句：有修辞意图但张力不足

export interface PunchlineHit {
  /** 金句类型 */
  type: PunchlineType;
  typeLabel: string;
  /** 金句原文片段 */
  snippet: string;
  /** 说话角色（如能识别） */
  speaker?: string;
  /** 位置 0-1（在全文中的相对位置） */
  position: number;
  /** 强度 0-100 */
  strength: number;
  /** 命中的修辞手法 */
  device: string;
}

export interface PunchlineDensityResult {
  /** 金句密度分 0-100（越高越好） */
  score: number;
  /** 命中的金句列表 */
  hits: PunchlineHit[];
  /** 金句总数 */
  count: number;
  /** 金句类型多样性（不重复的类型数） */
  variety: number;
  /** 三段分布：开头/中段/结尾各有几个金句 */
  distribution: { head: number; mid: number; tail: number };
  /** 平均强度 0-100 */
  avgStrength: number;
  /** 是否有"金句高潮"（结尾段有强度≥80的金句） */
  hasClimaxPunch: boolean;
  issues: PunchlineIssue[];
}

// —— 中文金句信号模式（按强度从高到低） ——
// 反转点睛（强度 95）：意料之外的结尾，颠覆认知
const SIGNALS_REVERSAL_ZH: { re: RegExp; device: string }[] = [
  { re: /(本(来|以)为|本以为|原以为|本想|本该)[^。！？]{0,30}(却|哪|谁|不|反|岂)[^。！？]{0,30}[。！？]/, device: '反转点睛-本以为却' },
  { re: /[^\n]{0,20}[。！？]\s*[不没]\s*[，,]\s*[^。！？\n]{5,40}[。！？]/, device: '反转点睛-否定转折' },
  { re: /(等等|不对|不、不是|错了|搞错了|不是这样的)[,，]?[^。！？\n]{3,40}[。！？]/, device: '反转点睛-自我否定' },
  { re: /(谁知|岂料|怎料|哪知|岂知|偏偏|殊不知|想不到|没想到|谁知道)[^。！？\n]{5,50}[。！？]/, device: '反转点睛-谁知' },
];

// 强势宣言（强度 90）：身份/立场宣告，气场全开
const SIGNALS_DECLARATIVE_ZH: { re: RegExp; device: string }[] = [
  { re: /(从今天起|从现在起|从今往后|从现在开始)[^。！？\n]{3,50}[。！？]/, device: '强势宣言-从今天起' },
  { re: /(我(才是|就是|本是|本就是|才是)|这(才|就)是)[^。！？\n]{5,40}[。！？]/, device: '强势宣言-我才是' },
  { re: /(听好了|记住|给我听好|记住我|你记住|都给我)[^。！？\n]{3,40}[。！？]/, device: '强势宣言-听好了' },
  { re: /(我(宣布|决定|命令|警告|奉劝)[^。！？\n]{3,40})[。！？]/, device: '强势宣言-宣告' },
  { re: /(轮不到|用不着|不需要|不劳|不需要你)[^。！？\n]{3,40}[。！？]/, device: '强势宣言-轮不到' },
];

// 对比反差（强度 85）：前后对比，反差出金句
const SIGNALS_CONTRAST_ZH: { re: RegExp; device: string }[] = [
  { re: /(昨天|昨日|前天|刚才|之前|从前|曾经|原本)[^。！？\n]{3,30}(今天|今日|现在|此刻|马上|转头|一转眼)[^。！？\n]{3,30}[。！？]/, device: '对比反差-时间反差' },
  { re: /(你以为|你以为呢|你以为这样|你(以为|觉得)[^。！？\n]{3,20}(其实|实际上|事实上|真相|事实上)[^。！？\n]{3,30})[。！？]/, device: '对比反差-你以为其实' },
  { re: /(别人|世人|他们|大家|所有人都|谁都)[^。！？\n]{3,20}(我|我偏|我偏不|我绝不|我不会)[^。！？\n]{3,30}[。！？]/, device: '对比反差-众我对比' },
  { re: /(表面|看上去|看起来|外面|明面上)[^。！？\n]{3,20}(实际|其实|内里|背地|暗地)[^。！？\n]{3,30}[。！？]/, device: '对比反差-表里对比' },
];

// 决心表态（强度 80）：坚定决心，不屈意志
const SIGNALS_RESOLUTION_ZH: { re: RegExp; device: string }[] = [
  { re: /(我偏要|偏要|偏不|就是不|我绝不|绝不|誓不|宁死不|宁可不|就算.*也要|哪怕.*也要|纵然.*也要)[^。！？\n]{3,40}[。！？]/, device: '决心表态-偏要绝不' },
  { re: /(我一定要|我非.*不可|一定要|非要.*不可|势要|势必将|必将|必将)[^。！？\n]{3,40}[。！？]/, device: '决心表态-必定' },
  { re: /(就算|哪怕|纵然|纵使|即使|即便)[^。！？\n]{3,20}(也|还|都|我)[^。！？\n]{3,30}[。！？]/, device: '决心表态-就算也要' },
];

// 威胁压制（强度 75）：压迫感强烈的威胁
const SIGNALS_THREAT_ZH: { re: RegExp; device: string }[] = [
  { re: /(你给我|给我)[^。！？\n]{1,10}(着|等|看|小心|注意)[^。！？\n]{0,30}[。！？]/, device: '威胁-你给我' },
  { re: /(迟早|早晚|总有一天|终有一日|迟早会|迟早要)[^。！？\n]{3,40}[。！？]/, device: '威胁-迟早' },
  { re: /(别忘了|记住|你最好|你最好别|你最好记住|别怪我|别怪)[^。！？\n]{3,40}[。！？]/, device: '威胁-别忘了' },
  { re: /(我会让你|我要让你|我会让你后悔|让你付出|让你生不如死|让你知道)[^。！？\n]{3,40}[。！？]/, device: '威胁-我会让你' },
  { re: /(你完了|你死定了|你死期到了|你活不过|你走不出|你别想)[^。！？\n]{0,30}[。！？]/, device: '威胁-你完了' },
];

// 灵魂拷问（强度 70）：直击灵魂的质问
const SIGNALS_QUESTION_ZH: { re: RegExp; device: string }[] = [
  { re: /(凭什么|凭什麽|凭什)[^。！？\n]{3,40}[。！？]/, device: '灵魂拷问-凭什么' },
  { re: /(难道|难道说|莫非|岂非|难道就)[^。！？\n]{3,40}[。！？?]/, device: '灵魂拷问-难道' },
  { re: /(又怎样|又如何|又能怎样|又算什么|又算得了什么)[。！？]/, device: '灵魂拷问-又怎样' },
  { re: /(你真的|你确信|你确定|你舍得|你忍心|你下得了手|你做得出)[^。！？\n]{3,40}[。！？?]/, device: '灵魂拷问-你真的' },
  { re: /(何必|何苦|何须|何不|何妨)[^。！？\n]{3,40}[。！？?]/, device: '灵魂拷问-何必' },
];

// 排比强化（强度 65）：三个以上并列，递进强化
const SIGNALS_PARALLEL_ZH: { re: RegExp; device: string }[] = [
  { re: /(我(不光|不仅|不止)[^。！？\n]{3,20}(还|更|也)[^。！？\n]{3,20}(更|还|也)[^。！？\n]{3,40})[。！？]/, device: '排比-我不光还更' },
  { re: /((既|一边|一面)[^。！？\n]{3,20}(又|一边|一面)[^。！？\n]{3,20}(还|一边|一面)[^。！？\n]{3,40})[。！？]/, device: '排比-既又还' },
  { re: /(没有[^。！？\n]{2,15}没有[^。！？\n]{2,15}(没有|就)[^。！？\n]{3,40})[。！？]/, device: '排比-没有没有' },
];

// 比喻生动（强度 60）：具象化比喻让抽象变具体
const SIGNALS_METAPHOR_ZH: { re: RegExp; device: string }[] = [
  { re: /(像[^。！？\n]{2,8}一样[^。！？\n]{3,30})[。！？]/, device: '比喻-像一样' },
  { re: /(如同[^。！？\n]{2,15})[。！？]/, device: '比喻-如同' },
  { re: /(就是[^。！？\n]{2,10}的[^。！？\n]{2,15})[。！？]/, device: '比喻-就是的' },
  { re: /(仿佛[^。！？\n]{2,15})[。！？]/, device: '比喻-仿佛' },
  { re: /(堪比[^。！？\n]{2,15})[。！？]/, device: '比喻-堪比' },
];

// 弱金句（强度 35）：有修辞意图但张力不足
const SIGNALS_WEAK_ZH: { re: RegExp; device: string }[] = [
  { re: /(走着瞧|你给我等着|骑驴看唱本|走着看|以后再说|以后你会知道|你会后悔的)[。！？]/, device: '弱金句-走着瞧' },
  { re: /(做梦|休想|想得美|不可能|你想|你想都别想)[。！？]/, device: '弱金句-做梦' },
  { re: /(我警告你|我提醒你|我劝你|奉劝你)[^。！？\n]{3,30}[。！？]/, device: '弱金句-我警告你' },
];

// —— 英文金句信号模式 ——
const SIGNALS_REVERSAL_EN: { re: RegExp; device: string }[] = [
  { re: /\b(I? ?thought|you? ?thought|we all thought|was supposed to)[^.!?\n]{0,40}(but|yet|instead|turns out|only to)[^.!?\n]{3,50}[.!?]/i, device: 'Reversal-thought-but' },
  { re: /\b(wait|no,? that|hold on|wrong|that's not)[,!]?[^.!?\n]{3,50}[.!?]/i, device: 'Reversal-self-correction' },
  { re: /\b(little did (I|we|they|he|she) know|who knew|who would have thought|who'd have guessed|but then|just then)[^.!?\n]{3,50}[.!?]/i, device: 'Reversal-who knew' },
];

const SIGNALS_DECLARATIVE_EN: { re: RegExp; device: string }[] = [
  { re: /\b(from today on|from now on|from this day forward|starting today)[^.!?\n]{3,50}[.!?]/i, device: 'Declarative-from today' },
  { re: /\b(I am (the|your|his|her)|this is (the|my|our)|I'm the (one|boss|king))[^.!?\n]{3,40}[.!?]/i, device: 'Declarative-I am the' },
  { re: /\b(listen up|hear me|mark my words|remember this|note this|watch this)[^.!?\n]{3,40}[.!?]/i, device: 'Declarative-listen up' },
  { re: /\b(I declare|I decide|I order|I warn|I advise you)[^.!?\n]{3,40}[.!?]/i, device: 'Declarative-I declare' },
  { re: /\b(it's not your place|not your call|not for you to|no need for you)[^.!?\n]{3,40}[.!?]/i, device: 'Declarative-not your place' },
];

const SIGNALS_CONTRAST_EN: { re: RegExp; device: string }[] = [
  { re: /\b(yesterday|just now|before|once|used to)[^.!?\n]{3,30}(today|now|right now|this moment)[^.!?\n]{3,30}[.!?]/i, device: 'Contrast-time' },
  { re: /\b(you think|you thought|you believe)[^.!?\n]{3,20}(actually|in fact|truth is|the truth|in reality)[^.!?\n]{3,30}[.!?]/i, device: 'Contrast-you think-actually' },
  { re: /\b(everyone (else|thinks)|they all|the world|people)[^.!?\n]{3,20}(I|I will|I won't|I don't)[^.!?\n]{3,30}[.!?]/i, device: 'Contrast-them-me' },
  { re: /\b(on the surface|looks like|seems|appears)[^.!?\n]{3,20}(but|actually|in truth|underneath|behind)[^.!?\n]{3,30}[.!?]/i, device: 'Contrast-surface-truth' },
];

const SIGNALS_RESOLUTION_EN: { re: RegExp; device: string }[] = [
  { re: /\b(I will (not|never)|I refuse|I won't|I'll never|I'd rather die than)[^.!?\n]{3,40}[.!?]/i, device: 'Resolution-I will never' },
  { re: /\b(I will (definitely|surely|certainly)|I must|I have to|I'll make sure)[^.!?\n]{3,40}[.!?]/i, device: 'Resolution-I will' },
  { re: /\b(even if|even though|no matter what|regardless of)[^.!?\n]{3,20}(I|I'll|I will|I won't)[^.!?\n]{3,30}[.!?]/i, device: 'Resolution-even if' },
];

const SIGNALS_THREAT_EN: { re: RegExp; device: string }[] = [
  { re: /\b(just you wait|you wait|wait and see|watch your back)[^.!?\n]{0,30}[.!?]/i, device: 'Threat-just you wait' },
  { re: /\b(sooner or later|eventually|one day|mark my words)[^.!?\n]{3,40}[.!?]/i, device: 'Threat-sooner or later' },
  { re: /\b(don't forget|you'd better|better remember|don't blame me)[^.!?\n]{3,40}[.!?]/i, device: "Threat-don't forget" },
  { re: /\b(I'll make you|I will make you|you'll pay|you'll regret|I'll let you)[^.!?\n]{3,40}[.!?]/i, device: "Threat-I'll make you" },
  { re: /\b(you're done|you're dead|you're finished|you're (a )?dead (man|person))[^.!?\n]{0,30}[.!?]/i, device: "Threat-you're done" },
];

const SIGNALS_QUESTION_EN: { re: RegExp; device: string }[] = [
  { re: /\b(why should I|who says|says who|on whose authority)[^.!?\n]{3,40}[.!?]/i, device: 'Question-why should I' },
  { re: /\b(could it be|is it possible|don't tell me|you don't mean)[^.!?\n]{3,40}[.!?]/i, device: 'Question-could it be' },
  { re: /\b(so what|who cares|what of it|what does it matter)[.!?]/i, device: 'Question-so what' },
  { re: /\b(are you sure|do you really|can you really|how could you|how dare you)[^.!?\n]{3,40}[.!?]/i, device: 'Question-are you sure' },
  { re: /\b(why bother|what's the point|what for|what good is it)[^.!?\n]{3,40}[.!?]/i, device: 'Question-why bother' },
];

const SIGNALS_PARALLEL_EN: { re: RegExp; device: string }[] = [
  { re: /\b(I (will|'ll) [a-z]+[^.!?\n]{3,20}I (will|'ll) [a-z]+[^.!?\n]{3,20}(I will|I'll|and)[^.!?\n]{3,40})[.!?]/i, device: 'Parallel-I will' },
  { re: /\b(both [a-z]+[^.!?\n]{3,15}and [a-z]+[^.!?\n]{3,15}(and|plus)[^.!?\n]{3,40})[.!?]/i, device: 'Parallel-both and' },
  { re: /\b(no [a-z]+[^.!?\n]{2,15}no [a-z]+[^.!?\n]{2,15}(no|nothing)[^.!?\n]{3,40})[.!?]/i, device: 'Parallel-no no' },
];

const SIGNALS_METAPHOR_EN: { re: RegExp; device: string }[] = [
  { re: /\b(like [a-z]+[^.!?\n]{2,15})[^.!?\n]{3,30}[.!?]/i, device: 'Metaphor-like' },
  { re: /\b(as [a-z]+ as)[^.!?\n]{3,30}[.!?]/i, device: 'Metaphor-as as' },
  { re: /\b(is [a-z]+[^.!?\n]{2,10})[^.!?\n]{3,30}[.!?]/i, device: 'Metaphor-is' },
  { re: /\b(as if|as though)[^.!?\n]{3,30}[.!?]/i, device: 'Metaphor-as if' },
];

const SIGNALS_WEAK_EN: { re: RegExp; device: string }[] = [
  { re: /\b(just you wait|we'll see|wait and see|you'll see|time will tell)[.!?]/i, device: "Weak-we'll see" },
  { re: /\b(in your dreams|keep dreaming|no way|not a chance|forget it|fat chance)[.!?]/i, device: 'Weak-in your dreams' },
  { re: /\b(I warn you|I advise you|let me warn you)[^.!?\n]{3,30}[.!?]/i, device: 'Weak-I warn you' },
];

// 各类型强度配置
const TYPE_STRENGTH_ZH: Record<PunchlineType, number> = {
  reversal: 95,
  declarative: 90,
  contrast: 85,
  resolution: 80,
  threat: 75,
  question: 70,
  parallel: 65,
  metaphor: 60,
  weak: 35,
};

const TYPE_LABEL_ZH: Record<PunchlineType, string> = {
  reversal: '反转点睛',
  declarative: '强势宣言',
  contrast: '对比反差',
  resolution: '决心表态',
  threat: '威胁压制',
  question: '灵魂拷问',
  parallel: '排比强化',
  metaphor: '比喻生动',
  weak: '弱金句',
};

const TYPE_LABEL_EN: Record<PunchlineType, string> = {
  reversal: 'Reversal',
  declarative: 'Declarative',
  contrast: 'Contrast',
  resolution: 'Resolution',
  threat: 'Threat',
  question: 'Question',
  parallel: 'Parallel',
  metaphor: 'Metaphor',
  weak: 'Weak',
};

// 中文对白行识别：角色名（情绪）：台词
const DIALOGUE_RE_ZH = /^([一-龥A-Za-z·]{1,6})(?:（[^）]*）)?[：:]\s*(.+)$/;
// 英文对白行识别：Name (emotion): line / Name: line
const DIALOGUE_RE_EN = /^[A-Z][a-z]{1,15}(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/;

function isSceneLine(line: string, lang: PdLang): boolean {
  // c213：收口共享切分器（全格式场头 + 剧名页/集标题 + FADE OUT）
  return isSceneOrTitleLine(line, lang);
}

function isActionLine(line: string): boolean {
  return line.trim().startsWith('△');
}

function extractDialogues(text: string, lang: PdLang): { speaker: string; line: string; rawLine: string; idx: number }[] {
  const lines = text.split('\n');
  const out: { speaker: string; line: string; rawLine: string; idx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || isSceneLine(trimmed, lang) || isActionLine(trimmed)) continue;
    if (lang === 'zh') {
      const m = DIALOGUE_RE_ZH.exec(trimmed);
      if (m) {
        out.push({ speaker: m[1], line: m[2], rawLine: trimmed, idx: i });
      }
    } else {
      const m = DIALOGUE_RE_EN.exec(trimmed);
      if (m) {
        // 提取说话人（第一个词）
        const speakerMatch = /^[A-Z][a-z]+/.exec(trimmed);
        out.push({ speaker: speakerMatch ? speakerMatch[0] : '', line: m[1], rawLine: trimmed, idx: i });
      }
    }
  }
  return out;
}

/**
 * 主函数：评估金句密度
 * @param text 成稿全文
 * @param lang 中英文
 */
export function punchlineDensityScore(text: string, lang: PdLang = 'zh'): PunchlineDensityResult {
  const textLen = Math.max(1, text.length);

  // 抽取对白行（只在对白里检测金句，排除场景/动作行）
  const dialogues = extractDialogues(text, lang);

  const hits: PunchlineHit[] = [];

  // 各类型信号库
  const signalsByType: { type: PunchlineType; patterns: { re: RegExp; device: string }[] }[] = lang === 'en'
    ? [
        { type: 'reversal', patterns: SIGNALS_REVERSAL_EN },
        { type: 'declarative', patterns: SIGNALS_DECLARATIVE_EN },
        { type: 'contrast', patterns: SIGNALS_CONTRAST_EN },
        { type: 'resolution', patterns: SIGNALS_RESOLUTION_EN },
        { type: 'threat', patterns: SIGNALS_THREAT_EN },
        { type: 'question', patterns: SIGNALS_QUESTION_EN },
        { type: 'parallel', patterns: SIGNALS_PARALLEL_EN },
        { type: 'metaphor', patterns: SIGNALS_METAPHOR_EN },
        { type: 'weak', patterns: SIGNALS_WEAK_EN },
      ]
    : [
        { type: 'reversal', patterns: SIGNALS_REVERSAL_ZH },
        { type: 'declarative', patterns: SIGNALS_DECLARATIVE_ZH },
        { type: 'contrast', patterns: SIGNALS_CONTRAST_ZH },
        { type: 'resolution', patterns: SIGNALS_RESOLUTION_ZH },
        { type: 'threat', patterns: SIGNALS_THREAT_ZH },
        { type: 'question', patterns: SIGNALS_QUESTION_ZH },
        { type: 'parallel', patterns: SIGNALS_PARALLEL_ZH },
        { type: 'metaphor', patterns: SIGNALS_METAPHOR_ZH },
        { type: 'weak', patterns: SIGNALS_WEAK_ZH },
      ];

  // 遍历每个对白行，匹配各类型金句
  for (const d of dialogues) {
    const lineText = d.line;
    // 在该对白中的相对位置（基于行号）
    const posInText = Number((d.idx / Math.max(1, text.split('\n').length)).toFixed(2));

    // 对每个类型，找到第一个匹配的pattern
    for (const sigGroup of signalsByType) {
      let matched = false;
      for (const pat of sigGroup.patterns) {
        const re = new RegExp(pat.re.source, pat.re.flags.includes('i') ? pat.re.flags : pat.re.flags + 'i');
        const m = re.exec(lineText);
        if (m) {
          // 弱金句只有在没有其他类型金句时才计入
          if (sigGroup.type === 'weak') {
            // 检查该对白是否已被其他类型命中
            const alreadyHit = hits.find((h) => h.speaker === d.speaker && Math.abs(h.position - posInText) < 0.01 && h.type !== 'weak');
            if (alreadyHit) {
              matched = true; // 跳过，不再匹配
              break;
            }
          }

          const snippet = lineText.length > 60 ? lineText.slice(0, 60) + '…' : lineText;
          hits.push({
            type: sigGroup.type,
            typeLabel: lang === 'en' ? TYPE_LABEL_EN[sigGroup.type] : TYPE_LABEL_ZH[sigGroup.type],
            snippet,
            speaker: d.speaker || undefined,
            position: posInText,
            strength: TYPE_STRENGTH_ZH[sigGroup.type],
            device: pat.device,
          });
          matched = true;
          break; // 同一类型只取第一个匹配
        }
      }
      // 如果已匹配到强金句类型，跳过弱金句检测
      if (matched && sigGroup.type !== 'weak') {
        // 继续检测其他类型（同一对白可能命中多种类型，取最强的）
      }
    }
  }

  // 同一对白行可能命中多个类型，去重保留最强的
  const deduped: PunchlineHit[] = [];
  for (const h of hits) {
    const existing = deduped.find((d) => Math.abs(d.position - h.position) < 0.005 && d.speaker === h.speaker);
    if (existing) {
      if (h.strength > existing.strength) {
        Object.assign(existing, h);
      }
    } else {
      deduped.push({ ...h });
    }
  }

  // 按位置排序
  deduped.sort((a, b) => a.position - b.position);

  // 三段分布：0-0.33 开头，0.33-0.66 中段，0.66-1.0 结尾
  const distribution = { head: 0, mid: 0, tail: 0 };
  for (const h of deduped) {
    if (h.position < 0.33) distribution.head++;
    else if (h.position < 0.66) distribution.mid++;
    else distribution.tail++;
  }

  // 多样性：不重复的金句类型数
  const variety = new Set(deduped.map((h) => h.type)).size;

  // 平均强度
  const avgStrength = deduped.length > 0
    ? Math.round(deduped.reduce((s, h) => s + h.strength, 0) / deduped.length)
    : 0;

  // 是否有金句高潮（结尾段有强度≥80的金句）
  const hasClimaxPunch = deduped.some((h) => h.position >= 0.66 && h.strength >= 80);

  const issues: PunchlineIssue[] = [];
  const count = deduped.length;

  // 1. 数量评估：短剧每集至少2个金句
  if (count === 0) {
    issues.push({
      severity: 'high',
      type: 'no_punchline',
      evidence: lang === 'en' ? 'No punchline detected in the entire script' : '全文未检测到任何金句',
      advice: lang === 'en'
        ? 'Short drama MUST have at least 2 punchlines per episode — without quotable lines, scenes feel forgettable and won\'t be shared'
        : '短剧每集必须有至少2个金句——没有金句的剧本记不住、传不出去、爆不了',
    });
  } else if (count < 2) {
    issues.push({
      severity: 'high',
      type: 'low_density',
      evidence: lang === 'en' ? `Only ${count} punchline(s) — short drama needs at least 2 per episode` : `仅${count}个金句——短剧每集至少2个`,
      advice: lang === 'en'
        ? `Add ${2 - count} more punchline(s) — use reversal, declarative, or contrast rhetorical devices`
        : `再加${2 - count}个金句——用反转/宣言/对比等修辞手法`,
    });
  } else if (count < 3) {
    // 3个以上为优秀，2个为及格
    issues.push({
      severity: 'mid',
      type: 'insufficient_density',
      evidence: lang === 'en' ? `Only ${count} punchlines — 3+ is recommended for strong shareability` : `仅${count}个金句——3个以上更利于传播`,
      advice: lang === 'en'
        ? 'Add one more punchline in a key scene to boost shareability'
        : '在关键场景再加1个金句提升传播力',
    });
  }

  // 2. 强度评估：最高金句强度应≥80
  const maxStrength = deduped.length > 0 ? Math.max(...deduped.map((h) => h.strength)) : 0;
  if (count >= 2 && maxStrength < 80) {
    issues.push({
      severity: 'mid',
      type: 'weak_punchline',
      evidence: lang === 'en'
        ? `Max punchline strength is only ${maxStrength} — viewers won't remember weak lines`
        : `最高金句强度仅${maxStrength}——弱金句观众记不住`,
      advice: lang === 'en'
        ? 'Use stronger rhetorical devices — reversal endings or declarative identity claims hit hardest'
        : '用更强修辞——反转点睛或强势宣言的张力最强',
    });
  }

  // 3. 分布评估：金句不能全集中在一处
  const emptySegments = (distribution.head === 0 ? 1 : 0) + (distribution.mid === 0 ? 1 : 0) + (distribution.tail === 0 ? 1 : 0);
  if (count >= 2 && emptySegments >= 2) {
    issues.push({
      severity: 'mid',
      type: 'uneven_distribution',
      evidence: lang === 'en'
        ? `Distribution: head ${distribution.head}, mid ${distribution.mid}, tail ${distribution.tail} — too concentrated`
        : `分布：开头${distribution.head}、中段${distribution.mid}、结尾${distribution.tail}——过于集中`,
      advice: lang === 'en'
        ? 'Spread punchlines — opening hook + mid climax + closing zinger is the ideal rhythm'
        : '金句要均匀分布——开头钩子+中段高潮+结尾点睛是理想节奏',
    });
  }

  // 4. 多样性：不能全是同一种修辞
  if (count >= 3 && variety === 1) {
    issues.push({
      severity: 'low',
      type: 'monotone',
      evidence: lang === 'en'
        ? `All ${count} punchlines use the same device (${deduped[0].device}) — feels repetitive`
        : `${count}个金句全是${deduped[0].device}——单一修辞容易疲劳`,
      advice: lang === 'en'
        ? 'Mix rhetorical devices — reversal + contrast + declarative hits different emotional notes'
        : '混合修辞手法——反转+对比+宣言击中不同情绪点',
    });
  }

  // 5. 结尾高潮：结尾段应有强金句（留存+传播的关键）
  if (count >= 2 && !hasClimaxPunch) {
    issues.push({
      severity: 'mid',
      type: 'no_climax_punch',
      evidence: lang === 'en'
        ? 'No strong punchline (≥80) in the closing segment — viewers leave without a memorable zinger'
        : '结尾段没有强度≥80的金句——观众走时没有记住的点睛之笔',
      advice: lang === 'en'
        ? 'Drop a reversal or declarative punchline in the last scene — the zinger lives in the closing beat'
        : '在最后一场放一个反转/宣言金句——点睛之笔要落在结尾节拍',
    });
  }

  // 6. 弱金句过多
  const weakCount = deduped.filter((h) => h.type === 'weak').length;
  if (count >= 2 && weakCount / count > 0.5) {
    issues.push({
      severity: 'low',
      type: 'too_many_weak',
      evidence: lang === 'en'
        ? `${weakCount}/${count} punchlines are weak (e.g. "just you wait") — they don\'t cut deep enough`
        : `${weakCount}/${count}个是弱金句（如"走着瞧"）——张力不够`,
      advice: lang === 'en'
        ? 'Replace weak threats with concrete reversals or declarative claims'
        : '把"走着瞧"这种弱金句替换为具体的反转或宣言',
    });
  }

  // 综合得分
  let score = 0;
  // 数量分（0-35分）：每集2个金句及格，3个及以上满分
  const countScore = Math.min(35, count * 12);
  score += countScore;
  // 强度分（0-25分）：最高强度越高分越高
  if (count > 0) {
    score += Math.round((maxStrength / 95) * 25);
  }
  // 分布分（0-15分）：三段都有金句满分，少1段扣5分
  const filledSegments = 3 - emptySegments;
  score += filledSegments * 5;
  // 多样性分（0-10分）：每种类型2分，上限10分
  score += Math.min(10, variety * 2);
  // 结尾高潮分（0-15分）
  if (hasClimaxPunch) score += 15;

  // high 级问题各扣 10，mid 扣 5，low 扣 2
  for (const issue of issues) {
    if (issue.severity === 'high') score -= 10;
    else if (issue.severity === 'mid') score -= 5;
    else score -= 2;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    hits: deduped,
    count,
    variety,
    distribution,
    avgStrength,
    hasClimaxPunch,
    issues,
  };
}
