import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 反转密度检测器（PRD 2.1.18 短剧反转生死线）
 * ------------------------------------------------------------------
 * 短剧的核心驱动力是反转——没有反转的短剧就是死剧。
 *
 * 现有引擎检测邻接但不同的概念：
 *  - conflict-density-check 检测"冲突密度"（人与人对抗，强度等级口角<对峙<肢体<生死）
 *    但冲突不一定是反转（如两人打架，没有方向变化）
 *  - cliffhanger-score 检测"集尾钩子"（结尾悬念），但不扫全剧反转分布
 *  - cool-moment-score 检测"爽点密度"（满足感），但爽点不一定是反转
 *    （如装逼/财富炫耀可能没有方向变化）
 *  - foreshadow-ledger 检测"伏笔是否回收"，但伏笔是埋设、反转是揭晓瞬间的方向变化
 *
 * 反转 = 剧情方向的不可预测变化（惊愕感），与冲突/爽点/伏笔/钩子都不同。
 * 本引擎专注于反转本身的密度、强度、分布和多样性评估。
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
export type TdLang = 'zh' | 'en';

export interface TwistIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 反转类型 */
export type TwistType =
  | 'identity'       // 身份反转：原来他是...
  | 'alignment'      // 立场反转：敌变友、友变敌
  | 'status'         // 状态反转：弱变强、富变穷
  | 'moral'          // 道德反转：好人变坏、坏人变好
  | 'relationship'   // 关系反转：陌生人变亲人、恋人变仇人
  | 'information'     // 信息反转：之前以为真的原来是假的
  | 'fate'           // 命运反转：死里逃生、绝地反击
  | 'minor';         // 小反转：普通剧情转折

export interface TwistHit {
  /** 反转类型 */
  type: TwistType;
  typeLabel: string;
  /** 反转原文片段 */
  snippet: string;
  /** 位置 0-1（在全文中的相对位置） */
  position: number;
  /** 强度数值 0-100 */
  strength: number;
}

export interface TwistDensityResult {
  /** 反转密度分 0-100（越高越好） */
  score: number;
  /** 命中的反转列表 */
  hits: TwistHit[];
  /** 反转总数 */
  count: number;
  /** 最高反转强度 */
  maxStrength: number;
  /** 反转类型多样性（不重复的类型数） */
  variety: number;
  /** 三段分布：开头/中段/结尾各有几个反转 */
  distribution: { head: number; mid: number; tail: number };
  /** 平均反转强度 */
  avgStrength: number;
  /** 弱反转比例（强度<60 的反转占比）0-1 */
  weakRatio: number;
  /** 结尾段是否有强度≥80 的反转（结尾高潮） */
  hasClimaxTwist: boolean;
  /** 反转强度序列（按位置排序的强度值） */
  strengthCurve: number[];
  issues: TwistIssue[];
}

// —— 中文反转信号模式（按强度从高到低） ——
// 强度参考：身份90 / 立场85 / 状态80 / 道德75 / 关系70 / 信息65 / 命运60 / 小反转35
const SIGNALS_ZH: { type: TwistType; label: string; re: RegExp; strength: number }[] = [
  // 身份反转（强度 90）：原来他是/竟然是/其实
  { type: 'identity', label: '身份反转', re: /(原来他[是就]|原来她[是就]|原来你[才就]*是|原来我[才就]*是|竟然是|其实[他她你我是]|其实一直[是就]|真身|真实身份|原来如此.*身份|隐瞒身份|伪装.*身份|假扮|冒充|冒名顶替|狸猫换太子)/, strength: 90 },
  // 立场反转（强度 85）：反水/叛变/倒戈/出卖/背叛
  { type: 'alignment', label: '立场反转', re: /(反水|叛变|倒戈|临阵倒戈|原来是你|你竟然.*出卖|出卖.*[我你他她]|背叛.*[我你他她]|内鬼|奸细|卧底.*暴露|原来.*内鬼|倒打一耙|反咬一口)/, strength: 85 },
  // 状态反转（强度 80）：翻身/逆转/反败为胜/东山再起
  { type: 'status', label: '状态反转', re: /(翻身|逆转|反败为胜|东山再起|卷土重来|跌落神坛|一夜白头|一夜暴富|一夜间|地位.*颠倒|强弱易势|攻守易势|今非昔比|翻身做主|翻身农奴)/, strength: 80 },
  // 道德反转（强度 75）：暴露本性/露出真面目/伪善
  { type: 'moral', label: '道德反转', re: /(暴露.*本性|露出.*真面目|原来.*伪善|装.*好人|伪君子|原来.*是这种.*人|狐狸尾巴|原形毕露|装模作样|虚伪.*面目)/, strength: 75 },
  // 关系反转（强度 70）：原来是亲/原来是父子/血浓于水
  { type: 'relationship', label: '关系反转', re: /(原来是.*亲|原来是.*父子|原来是.*母女|原来是.*兄妹|血浓于水|亲生|骨肉|失散多年|亲[生父母]|亲[哥哥妹妹姐弟]|认祖归宗|血脉|血[亲缘]|同父异母|同母异父)/, strength: 70 },
  // 信息反转（强度 65）：假的/骗人的/真相是/只是个局
  { type: 'information', label: '信息反转', re: /(是假[的的]|骗人|根本不是|根本没|只是一场.*[局梦戏]|只是一场空|都是假的|真相.*是|其实.*真相|原来.*是假|骗局|套路|设局|做局|虚晃一枪|障眼法)/, strength: 65 },
  // 命运反转（强度 60）：死里逃生/绝处逢生/劫后余生
  { type: 'fate', label: '命运反转', re: /(死里逃生|绝处逢生|劫后余生|大难不死|命不该绝|起死回生|奇迹.*生[还存]|咸鱼翻身|绝地反击|置之死地而后生|否极泰来|时来运转)/, strength: 60 },
  // 小反转（强度 35）：突然/没想到/谁知道/出乎意料
  { type: 'minor', label: '小反转', re: /(突然.*[说问叫想]|没想到|谁知道|出乎意料|意想不到|不料|哪知|怎料|谁知.*竟然|突然之间|陡然|蓦地.*变)/, strength: 35 },
];

// —— 英文反转信号模式（按强度从高到低） ——
const SIGNALS_EN: { type: TwistType; label: string; re: RegExp; strength: number }[] = [
  // 身份反转（强度 90）：turns out / actually is / all along
  { type: 'identity', label: 'Identity Twist', re: /\b(turns out|actually is|all along|was secretly|was the real|was the one|true identity|real identity|was posing as|impersonating|undercover|in disguise|all a lie|all a front)\b/i, strength: 90 },
  // 立场反转（强度 85）：switches sides / double agent / betray
  { type: 'alignment', label: 'Alignment Twist', re: /\b(switch[es]* sides|double agent|turncoat|defects?|betrays?|backstabs?|was the traitor|was the mole|was working for|was on their side|double-cross)\b/i, strength: 85 },
  // 状态反转（强度 80）：rises again / falls from grace / turnaround
  { type: 'status', label: 'Status Twist', re: /\b(rises again|falls from grace|comeback|turnaround|tables turn|tables have turned|tide turns|reversal of fortune|overnight|reduced to|stripped of|lost everything|rose from|bottom to top)\b/i, strength: 80 },
  // 道德反转（强度 75）：true colors / true face / was faking
  { type: 'moral', label: 'Moral Twist', re: /\b(true colors|true face|true self|was faking|all an act|was pretending|hypocrite|revealed.*nature|showed.*true|mask slips|facade crumbles)\b/i, strength: 75 },
  // 关系反转（强度 70）：long-lost / biological / blood
  { type: 'relationship', label: 'Relationship Twist', re: /\b(long-lost|biological|blood.*relative|kin|lost sibling|secret child|illegitimate|biological (father|mother|son|daughter|brother|sister)|same (father|mother)|separated at birth)\b/i, strength: 70 },
  // 信息反转（强度 65）：was a lie / was a setup / wasn't real
  { type: 'information', label: 'Information Twist', re: /\b(was a lie|was a setup|wasn't real|was fake|all a lie|all a dream|all a simulation|was an illusion|was a trap|was a scheme|was a con|was staged)\b/i, strength: 65 },
  // 命运反转（强度 60）：narrowly escapes / miraculously / against all odds
  { type: 'fate', label: 'Fate Twist', re: /\b(narrowly escapes|miraculous(ly)?|against all odds|cheated death|near-death|second chance|back from the brink|last-second save|pulled through|survived against)\b/i, strength: 60 },
  // 小反转（强度 35）：suddenly / unexpectedly / out of nowhere
  { type: 'minor', label: 'Minor Twist', re: /\b(suddenly|unexpectedly|out of nowhere|without warning|to everyone's surprise|no one expected|little did|who knew|who would have thought)\b/i, strength: 35 },
];

// —— 反转类型标签（中英双语） ——
const TYPE_LABELS: Record<TwistType, { zh: string; en: string }> = {
  identity: { zh: '身份反转', en: 'Identity Twist' },
  alignment: { zh: '立场反转', en: 'Alignment Twist' },
  status: { zh: '状态反转', en: 'Status Twist' },
  moral: { zh: '道德反转', en: 'Moral Twist' },
  relationship: { zh: '关系反转', en: 'Relationship Twist' },
  information: { zh: '信息反转', en: 'Information Twist' },
  fate: { zh: '命运反转', en: 'Fate Twist' },
  minor: { zh: '小反转', en: 'Minor Twist' },
};

/** 三段位置判定（按相对位置 0-1） */
function segment(pos: number): 'head' | 'mid' | 'tail' {
  if (pos < 0.33) return 'head';
  if (pos < 0.67) return 'mid';
  return 'tail';
}

/**
 * 反转密度检测主函数
 * @param text 剧本正文
 * @param lang 'zh' 或 'en'
 */
export function twistDensityScore(text: string, lang: TdLang): TwistDensityResult {
  const signals = lang === 'en' ? SIGNALS_EN : SIGNALS_ZH;
  const lines = text.split('\n');
  const totalChars = text.length || 1;

  const hits: TwistHit[] = [];
  // 遍历每行，匹配反转信号；同一行多个匹配只取强度最高的（去重）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // c213：跳过非正文行（共享切分器全格式场头 + 剧名页/集标题/FADE OUT）
    if (isSceneOrTitleLine(line, lang)) continue;
    const pos = (text.indexOf(line) + line.length / 2) / totalChars;
    const posClamp = Math.max(0, Math.min(1, pos));
    // 找到本行最强反转
    let bestHit: TwistHit | null = null;
    for (const sig of signals) {
      const m = line.match(sig.re);
      if (m) {
        // 小反转仅在没有任何其他强反转时计入（避免与强反转重复计数）
        if (sig.type === 'minor' && bestHit && bestHit.strength >= 60) continue;
        const snippet = line.slice(Math.max(0, (m.index ?? 0) - 8), Math.min(line.length, (m.index ?? 0) + (m[0].length + 16)));
        if (!bestHit || sig.strength > bestHit.strength) {
          bestHit = {
            type: sig.type,
            typeLabel: TYPE_LABELS[sig.type][lang],
            snippet: snippet.trim(),
            position: posClamp,
            strength: sig.strength,
          };
        }
      }
    }
    if (bestHit) hits.push(bestHit);
  }

  // 按位置排序
  hits.sort((a, b) => a.position - b.position);

  const count = hits.length;
  const maxStrength = count > 0 ? Math.max(...hits.map((h) => h.strength)) : 0;
  const varietySet = new Set(hits.map((h) => h.type));
  const variety = varietySet.size;
  const distribution = { head: 0, mid: 0, tail: 0 };
  for (const h of hits) distribution[segment(h.position)]++;
  const avgStrength = count > 0 ? Math.round(hits.reduce((s, h) => s + h.strength, 0) / count) : 0;
  const weakCount = hits.filter((h) => h.strength < 60).length;
  const weakRatio = count > 0 ? Math.round((weakCount / count) * 100) / 100 : 0;
  const hasClimaxTwist = hits.some((h) => h.position >= 0.7 && h.strength >= 80);
  const strengthCurve = hits.map((h) => h.strength);

  // 评分与问题清单
  let score = 100;
  const issues: TwistIssue[] = [];

  if (count === 0) {
    score -= 60;
    issues.push({
      severity: 'high',
      type: 'no_twist',
      evidence: lang === 'en' ? 'No plot twist detected in the episode' : '全剧本未检测到任何剧情反转',
      advice: lang === 'en'
        ? 'Add at least 2-3 reversals (identity / alignment / status / moral / relationship / information / fate) — short drama dies without twists'
        : '至少安排2-3个反转（身份/立场/状态/道德/关系/信息/命运），短剧没有反转就是死剧',
    });
  } else {
    if (count < 2) {
      score -= 30;
      issues.push({
        severity: 'high',
        type: 'twist_insufficient',
        evidence: lang === 'en' ? `Only ${count} twist detected — below the 2-twist minimum` : `仅检测到${count}个反转，低于2个下限`,
        advice: lang === 'en'
          ? 'Stack 2-3 twists per episode (one in mid-section, one at the ending) — single twist feels flat'
          : '每集至少堆叠2-3个反转（中段一个、结尾一个），单反转显得平淡',
      });
    } else if (count < 3) {
      score -= 15;
      issues.push({
        severity: 'mid',
        type: 'twist_thin',
        evidence: lang === 'en' ? `Only ${count} twists — recommend 3+` : `仅${count}个反转，建议3个以上`,
        advice: lang === 'en'
          ? 'Add one more twist in the opening or mid-section to sustain surprise density'
          : '在开场或中段再加一个反转，提升惊喜密度',
      });
    }

    if (variety < 2 && count >= 2) {
      score -= 15;
      issues.push({
        severity: 'mid',
        type: 'twist_monotone',
        evidence: lang === 'en' ? `All twists are the same type (variety ${variety})` : `所有反转类型单一（多样性${variety}）`,
        advice: lang === 'en'
          ? 'Mix different twist types (e.g. identity + alignment + status) — same-type twists feel repetitive'
          : '混搭不同反转类型（如身份+立场+状态），同类反转显重复',
      });
    }

    // 开头+中段反转数 < 1：反转集中结尾
    if (distribution.head + distribution.mid < 1) {
      score -= 10;
      issues.push({
        severity: 'mid',
        type: 'twist_backloaded',
        evidence: lang === 'en' ? `All twists crammed at the tail (head ${distribution.head} / mid ${distribution.mid})` : `反转全部集中在结尾（开头${distribution.head}/中段${distribution.mid}）`,
        advice: lang === 'en'
          ? 'Plant at least one twist in the opening or mid-section — back-loaded twists lose viewers before the payoff'
          : '在开场或中段埋至少一个反转，全压结尾用户在中段就弃剧',
      });
    }

    // 弱反转比例 > 50%
    if (weakRatio > 0.5) {
      score -= 10;
      issues.push({
        severity: 'low',
        type: 'twist_weak_heavy',
        evidence: lang === 'en' ? `Weak twists (>50% of total, ratio ${weakRatio})` : `弱反转占比过高（${weakRatio}）`,
        advice: lang === 'en'
          ? 'Upgrade weak "suddenly/unexpected" beats into concrete identity / alignment / status twists'
          : '把"突然/没想到"等弱反转升级为具体的身份/立场/状态反转',
      });
    }

    // 无结尾高潮反转
    if (!hasClimaxTwist && count >= 1) {
      score -= 5;
      issues.push({
        severity: 'low',
        type: 'no_climax_twist',
        evidence: lang === 'en' ? 'No strength≥80 twist in the ending (last 30%)' : '结尾段（后30%）无强度≥80的高潮反转',
        advice: lang === 'en'
          ? 'Reserve a major twist for the ending — final-section reversal sustains追更欲'
          : '把最强反转留给结尾，结尾段反转维持追更欲',
      });
    }
  }

  // 分数下限保护
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    hits,
    count,
    maxStrength,
    variety,
    distribution,
    avgStrength,
    weakRatio,
    hasClimaxTwist,
    strengthCurve,
    issues,
  };
}
