import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 集尾钩子效力评分器（PRD 2.1.10 短剧留存生死线）
 * ------------------------------------------------------------------
 * 短剧的生死线：集尾钩子够不够硬，直接决定用户是否付费追下一集。
 * 管线已有 epHook 规划集尾钩子类型，rhythm.ts 只检测"有没有"留白信号，
 * 但不评估钩子"够不够硬"、类型对不对、紧迫感强不强。
 *
 * 本引擎从成稿尾部提取最后几行，做五维评估：
 *  1) 存在性：结尾是否有钩子信号（反转/悬念/危机/揭秘/情感/动作收束）
 *  2) 类型分类：识别钩子类型（反转钩>危机钩>揭秘钩>悬念钩>情感钩>动作钩>弱钩）
 *  3) 强度：钩子是否足够强烈（问句<留白<揭秘<反转<危机）
 *  4) 紧迫感：是否制造"必须看下一集"的冲动（不可预测性+情绪强度）
 *  5) 规划对齐：与 outline.cliffhanger 规划是否一致（如果传入了 planned）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type CshLang = 'zh' | 'en';

export interface CliffhangerIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export type CliffhangerType =
  | 'reversal'      // 反转钩：没想到/原来/谁知
  | 'crisis'        // 危机钩：突发危险（枪/摔/撞/被揭穿）
  | 'reveal'        // 揭秘钩：身份/真相揭晓
  | 'mystery'       // 悬念钩：到底/究竟/谁
  | 'emotional'     // 情感钩：情绪爆发戛然而止
  | 'action_cut'    // 动作钩：动作突然收束
  | 'weak'          // 弱钩：只有问号或省略号
  | 'none';         // 无钩子

export interface CliffhangerScoreResult {
  /** 钩子效力 0-100（越高越好） */
  score: number;
  /** 识别到的钩子类型 */
  type: CliffhangerType;
  /** 钩子类型中文名（供前端显示） */
  typeLabel: string;
  /** 结尾文本片段（最后约200字） */
  endingSnippet: string;
  issues: CliffhangerIssue[];
  /** 与规划是否对齐（未传 planned 时为 null） */
  planAlignment: boolean | null;
}

// —— 中文钩子信号模式（按强度从高到低排列） ——
const SIGNALS_ZH: { type: CliffhangerType; label: string; re: RegExp; strength: number }[] = [
  { type: 'reversal', label: '反转钩', re: /(没想到|谁知[道了]?|原来[你是他她]|岂料|话音刚落|下一秒|就在此时|突然|猛地|猛然|竟然|居然|倒吸)/, strength: 95 },
  { type: 'crisis', label: '危机钩', re: /(枪口|刀刃|悬崖|坠落|撞[向上去]|被[发现揭穿抓撞]|拦住|堵住|冲过来|扑过来|逼[到向]|无路可退|走投无路|倒下|鲜血|血迹|昏[过去倒]|心跳停止|报[警火]|警笛|爆炸|火光)/, strength: 92 },
  { type: 'reveal', label: '揭秘钩', re: /(原来[你是他她它]|身份|真相|秘密|揭[开穿]|面具|脱下|摘下|你[就是竟]?是|你就是那个|签名|证据|照片|录像|监控)/, strength: 85 },
  { type: 'mystery', label: '悬念钩', re: /(到底[是是谁]|究竟[是是谁]|为什么|怎么会|什么意思|谁[在是发的]|哪[里个来]的|怎么回事|什么人)/, strength: 75 },
  { type: 'emotional', label: '情感钩', re: /(泪[水流]|哭|哽咽|颤抖|瘫[坐在倒]|沉默|愣|僵|心[如碎]|崩溃|绝望|苦笑|深吸|闭[上过]眼)/, strength: 70 },
  { type: 'action_cut', label: '动作钩', re: /(猛地|一把|转身|冲[向出过]|跑|追|摔|砸|撕|扯|揪|拍|踹|踢|夺|拦)/, strength: 65 },
  { type: 'weak', label: '弱钩', re: /[？?…]|省略号|未完|待续|本集完/, strength: 30 },
];

// —— 英文钩子信号模式 ——
const SIGNALS_EN: { type: CliffhangerType; label: string; re: RegExp; strength: number }[] = [
  { type: 'reversal', label: 'Reversal', re: /\b(unexpectedly|suddenly|but then|little did|to (?:his|her) surprise|turned out|in fact|actually|no one knew|the truth was)\b/i, strength: 95 },
  { type: 'crisis', label: 'Crisis', re: /\b(gun|knife|cliff|fall|crash|caught|discovered|cornered|no way out|blood|collapse|ambulance|explosion|fire|siren|police)\b/i, strength: 92 },
  { type: 'reveal', label: 'Reveal', re: /\b(you are|you're the|identity|truth|secret|revealed|mask|took off|evidence|photo|video|surveillance|footage)\b/i, strength: 85 },
  { type: 'mystery', label: 'Mystery', re: /\b(who|what|why|how come|where|which one|whose)\b.*\?/i, strength: 75 },
  { type: 'emotional', label: 'Emotional', re: /\b(tears?|cry|sob|trembl|collaps|silent|frozen|stiff|heartbrok|devastat|despair|bitter smile|closed (?:his|her) eyes)\b/i, strength: 70 },
  { type: 'action_cut', label: 'Action Cut', re: /\b(slammed|grabbed|turned|dashed|rushed|chased|threw|smashed|ripped|kicked|blocked|snatched)\b/i, strength: 65 },
  { type: 'weak', label: 'Weak', re: /\?|\.\.\.|to be continued|end of episode/i, strength: 30 },
];

// —— 弱钩子信号（仅问号/省略号，无实质内容） ——
const WEAK_ONLY_ZH = /^[？?…\s]+$/;
const WEAK_ONLY_EN = /^\?*\s*$/;

// —— c209 末拍泄气：末拍落在总结/平收句上，前面钩子再硬观众那口气也被放掉 ——
const DEFLATE_ZH = /(?:一切(?:都|已然|已经)?(?:结束|归于平静|尘埃落定|过去了|落幕|收场)|尘埃落定|画上了?句号|(?:故事|事情|大戏|闹剧|这一切)(?:到此)?(?:结束|终结|落幕|收场)|从此[^。！？\n]{0,12}(?:过上|过着|幸福)|幸福地(?:生活|在一起)|(?:日子|生活|夜)(?:又|重新|逐渐|渐渐)?(?:恢复|回到|回归)(?:了)?(?:平静|往常|正轨|宁静)|归于平静|一切如常|风平浪静)/;
const DEFLATE_EN = /\b(?:everything was (?:finally )?over|it was all over|it was over|(?:story|night|episode) was over|(?:drew|came) to an? (?:close|end)|lived happily ever after|(?:life|everything) (?:went|returned|got) back to normal|(?:finally )?at peace|faded? (?:to|into) black)\b/i;

// —— c209 梦境作废：末拍揭示全集"只是一场梦"，钩子作废（最高级作弊，重罚） ——
const DREAM_ZH = /(?:原来|发现|发现自己|才知道|才发现|才明白|不过是|只是|竟是|竟然是)[^，。！？\n]{0,8}(?:一|这)(?:场|个)?梦(?:而已)?[。！!…？?]*$|(?:一|这)(?:场|个)?梦而已|梦醒了/;
const DREAM_EN = /\b(?:it was|it had all been|everything was|everything had been|turned out to be)(?:\s+all)?(?:\s+(?:just|only))?\s+a dream\b|\bwoke (?:up|him|her)[^.\n]{0,60}\ba dream\b|\bonly a dream\b/i;

/**
 * 主函数：评估成稿集尾钩子效力
 * @param text 成稿全文
 * @param lang 中英文
 * @param planned 规划的钩子描述（来自 outline.cliffhanger），可选
 */
export function cliffhangerScore(text: string, lang: CshLang = 'zh', planned?: string | null): CliffhangerScoreResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  // 取最后约200字（c213：跳过非正文行——共享切分器全格式场头 + 剧名页/集标题/FADE OUT）
  const body = lines.filter((l) => !isSceneOrTitleLine(l, lang));
  const endingLines = body.slice(-5);
  const endingSnippet = endingLines.join('\n').slice(-220);

  const signals = lang === 'en' ? SIGNALS_EN : SIGNALS_ZH;
  let detectedType: CliffhangerType = 'none';
  let detectedLabel = lang === 'en' ? 'None' : '无钩子';
  let maxStrength = 0;
  let matchedEvidence = '';

  // 按强度从高到低匹配，取命中的最高强度类型
  for (const sig of signals) {
    const m = endingSnippet.match(sig.re);
    if (m) {
      if (sig.strength > maxStrength) {
        maxStrength = sig.strength;
        detectedType = sig.type;
        detectedLabel = sig.label;
        matchedEvidence = m[0];
      }
      // 不 break——高强度的类型后面可能还有匹配，取最高
    }
  }

  // 弱钩子特判：如果只有 ? 或 … 没有其他信号，明确判定为弱钩
  if (detectedType === 'none' || (detectedType === 'weak' && WEAK_ONLY_ZH.test(endingSnippet.slice(-20)))) {
    if (/[？?…]/.test(endingSnippet)) {
      detectedType = 'weak';
      detectedLabel = lang === 'en' ? 'Weak' : '弱钩';
      maxStrength = 30;
      matchedEvidence = '?';
    }
  }

  const issues: CliffhangerIssue[] = [];

  // 1. 存在性
  if (detectedType === 'none') {
    issues.push({
      severity: 'high',
      type: 'no_cliffhanger',
      evidence: lang === 'en' ? `Ending has no hook signal (no reversal/crisis/reveal/mystery)` : `结尾无钩子信号（无反转/危机/揭秘/悬念）`,
      advice: lang === 'en'
        ? 'The episode must end on a hook — pick one: a reversal twist, a crisis moment, a secret reveal, or a burning question. Never end on a flat resolution'
        : '本集必须以钩子收尾——选一个：反转、危机、揭秘、或悬念。绝不能平收',
    });
  }

  // 2. 弱钩判定（只有问号/省略号，无实质内容）
  if (detectedType === 'weak' && maxStrength <= 30) {
    issues.push({
      severity: 'high',
      type: 'weak_cliffhanger',
      evidence: lang === 'en' ? `Ending only has a weak signal ("${matchedEvidence}"), no substantive hook content` : `结尾只有弱信号（"${matchedEvidence}"），无实质钩子内容`,
      advice: lang === 'en'
        ? 'A lone "?" or "..." is not a cliffhanger — escalate to a reversal ("unexpectedly...") or crisis (a gun, a fall, a confession) to make viewers MUST watch next'
        : '单个问号/省略号不是钩子——升级为反转（"没想到……"）或危机（枪/坠落/被揭穿），让用户必须追下一集',
    });
  }

  // 3. 强度评估（情感钩和动作钩属于 mid 级提醒）
  if (detectedType === 'emotional' || detectedType === 'action_cut') {
    issues.push({
      severity: 'mid',
      type: 'medium_hook',
      evidence: lang === 'en' ? `Ending hook is ${detectedLabel} — decent but not gripping enough` : `集尾钩子为${detectedLabel}——有钩但不够抓人`,
      advice: lang === 'en'
        ? `${detectedLabel} works but consider escalating to a reversal or reveal for stronger retention — emotional/action hooks are softer`
        : `${detectedLabel}可以，但考虑升级为反转或揭秘钩——情感/动作钩偏软，留存力不够强`,
    });
  }

  // 4. 规划对齐检查
  let planAlignment: boolean | null = null;
  if (planned && planned.length > 5) {
    // 提取规划中的关键词（人名、动作、情绪），检查结尾是否包含
    const planKeywords = planned.split(/[，。,.？?！!：:；;\s]+/).filter((w) => w.length >= 2).slice(0, 5);
    const endingLower = endingSnippet;
    const hits = planKeywords.filter((kw) => {
      if (lang === 'en') {
        return endingLower.toLowerCase().includes(kw.toLowerCase());
      }
      return endingLower.includes(kw);
    });
    planAlignment = hits.length >= 1;
    if (!planAlignment) {
      issues.push({
        severity: 'mid',
        type: 'plan_misaligned',
        evidence: lang === 'en'
          ? `Planned cliffhanger was "${planned.slice(0, 50)}" but ending doesn't contain planned keywords`
          : `规划钩子为"${planned.slice(0, 50)}"但结尾未包含规划关键词`,
        advice: lang === 'en'
          ? 'The ending diverges from the planned cliffhanger — either adjust the ending to match the plan, or update the plan'
          : '结尾偏离了规划钩子——要么调整结尾回归规划，要么更新规划',
      });
    }
  }

  // 5. 紧迫感：结尾是否有强情绪词或突发信号
  const urgencyWords = lang === 'en'
    ? /\b(suddenly|right now|immediately|no time|must|before it|or else|only chance|last chance|one way|do it now)\b/i
    : /(突然|立刻|马上|来不及|只剩|最后一次|唯一机会|不然|否则|赶紧)/;
  const hasUrgency = urgencyWords.test(endingSnippet);
  if (detectedType !== 'none' && detectedType !== 'weak' && !hasUrgency && maxStrength < 90) {
    issues.push({
      severity: 'low',
      type: 'low_urgency',
      evidence: lang === 'en' ? 'Ending hook lacks urgency words' : '结尾钩子缺少紧迫感词',
      advice: lang === 'en'
        ? 'Add urgency ("suddenly / right now / last chance") to make the hook feel time-critical'
        : '加入紧迫感（"突然/立刻/最后一次"）让钩子有"现在必须知道"的紧迫',
    });
  }

  // 6. c209 末拍质量：只看最后一拍正文行（跳过场景标题）
  const lastBodyLine = body.length > 0 ? body[body.length - 1] : '';
  let dreamNullified = false;
  let hookDeflated = false;
  if (lastBodyLine) {
    if ((lang === 'en' ? DREAM_EN : DREAM_ZH).test(lastBodyLine)) {
      // 梦境作废：无论前面信号多强，钩子事实上不成立
      dreamNullified = true;
      issues.push({
        severity: 'high',
        type: 'dream_nullification',
        evidence: lastBodyLine.slice(-40),
        advice: lang === 'en'
          ? '"It was all a dream" voids the cliffhanger — viewers feel cheated. Let the twist be real and end on a new consequence instead'
          : '"一场梦"让钩子作废，观众有被骗感。让反转真实发生，落在一个新后果上收尾',
      });
    } else if (maxStrength >= 75 && (lang === 'en' ? DEFLATE_EN : DEFLATE_ZH).test(lastBodyLine)) {
      // 末拍泄气：已识别实质钩（≥75），但最后一拍落在平收/总结句
      hookDeflated = true;
      issues.push({
        severity: 'mid',
        type: 'hook_deflated',
        evidence: lastBodyLine.slice(-40),
        advice: lang === 'en'
          ? 'The last beat resolves the tension you just built — cut the wrap-up line and end on the hook itself'
          : '最后一拍把刚立起来的张力放掉了——删掉总结/平收句，让镜头直接切在钩子上',
      });
    }
  }

  // 综合得分
  let score = maxStrength;
  // high 级问题各扣 15，mid 扣 5，low 扣 2
  for (const issue of issues) {
    if (issue.severity === 'high') score -= 15;
    else if (issue.severity === 'mid') score -= 5;
    else score -= 2;
  }
  // c209 结构性封顶：梦境作废钩子不成立（≤40）；末拍泄气不让强钩仍拿高分（封顶=原强度−20）
  if (dreamNullified) score = Math.min(score, 40);
  else if (hookDeflated) score = Math.min(score, Math.max(0, maxStrength - 20));
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, type: detectedType, typeLabel: detectedLabel, endingSnippet, issues, planAlignment };
}

// —— c209 落库统一形态：批量生成落库 / SSE done / 付费 /fix 重算三处共用 ——
// qcReport 是随 Script 永久存储的 JSON，片段与问题文本必须有界，防止膨胀拖慢列表加载。

export interface CliffhangerDigest {
  score: number;
  type: CliffhangerType;
  typeLabel: string;
  endingSnippet: string;
  issues: CliffhangerIssue[];
  planAlignment: boolean | null;
}

const DIGEST_SNIPPET_MAX = 100;
const DIGEST_ISSUES_MAX = 4;
const DIGEST_EVIDENCE_MAX = 120;
const DIGEST_ADVICE_MAX = 160;

/** 按正文是否含汉字探测语言（Project 模型无 lang 字段，/fix 无语言入参时用） */
export function detectCliffhangerLang(text: string): CshLang {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

/** 引擎结果 → 落库摘要（片段≤100，问题≤4条且证据/建议截断） */
export function cliffhangerDigest(res: CliffhangerScoreResult): CliffhangerDigest {
  return {
    score: res.score,
    type: res.type,
    typeLabel: res.typeLabel,
    endingSnippet: res.endingSnippet.slice(-DIGEST_SNIPPET_MAX),
    issues: res.issues.slice(0, DIGEST_ISSUES_MAX).map((i) => ({
      severity: i.severity,
      type: i.type,
      evidence: i.evidence.slice(0, DIGEST_EVIDENCE_MAX),
      advice: i.advice.slice(0, DIGEST_ADVICE_MAX),
    })),
    planAlignment: res.planAlignment,
  };
}

/** 正文 → 落库摘要（自动语言探测；可显式传 lang/planned） */
export function scoreCliffhangerForStorage(
  text: string,
  opts: { lang?: CshLang; planned?: string | null } = {},
): CliffhangerDigest {
  const lang = opts.lang ?? detectCliffhangerLang(text);
  return cliffhangerDigest(cliffhangerScore(text, lang, opts.planned ?? null));
}
