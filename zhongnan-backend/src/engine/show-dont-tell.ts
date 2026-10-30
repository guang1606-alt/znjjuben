import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * "展示而非叙述"引擎（PRD 2.1.9 影视编剧第一法则）
 * ------------------------------------------------------------------
 * 影视剧本和小说最大的区别：影视用画面讲故事，不用叙述者说。
 * AI 生成剧本时最常犯的错就是"小说腔"——直接告诉观众角色什么情绪、
 * 用总结代替现场、用抽象形容代替具体动作。
 *
 * 本引擎检测五类违反"Show Don't Tell"的写法：
 *  1) 直接说情绪：他很生气 / she felt angry（应改为"他猛地把杯子摔在地上"）
 *  2) 总结代替场景：他们聊了很久 / they talked for a while（应展开为实际对话）
 *  3) 长叙述无动作：连续多行纯叙述，没有 △ 动作行（小说化写法）
 *  4) 抽象形容：美丽的 / mysterious（应用具体视觉细节替代）
 *  5) 内心独白：他想到了 / she remembered（应外化为动作或对白）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：
 * 中英双语：中文层为单一事实源，英文层零中文。
 */

export type SdtLang = 'zh' | 'en';

export interface SdtIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export interface ShowDontTellResult {
  /** 展示度 0-100（越高越好，100=完全用画面讲故事） */
  score: number;
  issues: SdtIssue[];
  /** 直接说情绪命中 */
  tellEmotionHits: { pattern: string; snippet: string }[];
  /** 总结代替场景命中 */
  summaryHits: { pattern: string; snippet: string }[];
  /** 抽象形容命中 */
  abstractAdjHits: { pattern: string; snippet: string }[];
  /** 内心独白命中 */
  innerMonologueHits: { pattern: string; snippet: string }[];
  /** 连续叙述无动作的最长块行数 */
  longestProseBlock: number;
}

// —— 中文"直接说情绪"模式 ——
const TELL_EMOTION_ZH: { pattern: string; re: RegExp }[] = [
  { pattern: '感到很+情绪', re: /感到[很十分非常]?[生开难过伤纠心痛怒悲急紧慌怕惊讶愁闷恼烦]/g },
  { pattern: '心里很+情绪', re: /心里[很十分非常]?[高开难痛纠生怒悲急紧慌怕惊讶愁闷恼烦乐兴]/g },
  { pattern: '十分/非常+情绪', re: /[十非][分常][紧生怒悲急慌怕惊讶愁闷恼烦痛开乐兴高兴]/g },
  { pattern: '内心+情绪词', re: /内心[十非分常]?[纠痛挣扎慌怕紧愁闷恼烦]/g },
  { pattern: '情绪动词直述', re: /[他她它][^，。]{0,4}(生气|伤心|高兴|难过|害怕|紧张|焦虑|兴奋|激动|失望|绝望|崩溃)/g },
  { pattern: '情绪形容词+地', re: /(生气地|伤心地|高兴地|难过了|害怕地|紧张地|兴奋地|激动地|失望地|绝望地)/g },
];

// —— 英文"直接说情绪"模式 ——
const TELL_EMOTION_EN: { pattern: string; re: RegExp }[] = [
  { pattern: 'felt + emotion', re: /\bfelt\s+(?:very\s+|so\s+|really\s+)?(angry|sad|happy|scared|nervous|anxious|excited|disappointed|devastated|furious|terrified|heartbroken|overwhelmed)\b/gi },
  { pattern: 'was/were + emotion', re: /\b(?:was|were|seemed|appeared)\s+(?:very\s+|so\s+|quite\s+)?(angry|sad|happy|scared|nervous|anxious|excited|disappointed|devastated|furious|terrified|heartbroken)\b/gi },
  { pattern: 'with + emotion noun', re: /\bwith\s+(?:anger|sadness|fear|joy|excitement|disappointment|frustration|despair|rage|terror|grief|anxiety)\b/gi },
  { pattern: 'feeling + emotion', re: /\bfeeling\s+(?:very\s+|so\s+)?(angry|sad|happy|scared|nervous|anxious|excited|upset|confused|frustrated)\b/gi },
];

// —— 中文"总结代替场景"模式 ——
const SUMMARY_ZH: { pattern: string; re: RegExp }[] = [
  { pattern: '他们聊了很久', re: /(聊了[许很半一多]?[久番阵场段]|[谈经]?过[一了]番[对谈聊争]|[谈经]?过[一了]阵[对谈聊争]|商量了[许很半一多]?[久番阵场段])/g },
  { pattern: '时间流逝', re: /(时间[过流][去逝飞快了得快如梭]|就这样过[去了]|不知不觉[天地已又]|几[天小时分周月]后|随后几[天周月小时分]|几天之后)/g },
  { pattern: '经过一番', re: /(经过[一一]?番[争辩讨论挣扎纠结]|经过[一良]?阵[沉默思考]|在一番[争讨辩]之后)/g },
  { pattern: '如此这般', re: /(如此[这那]般|就这样[一船]?[算结]了|最终他们[决达商达成])/g },
];

// —— 英文"总结代替场景"模式 ——
const SUMMARY_EN: { pattern: string; re: RegExp }[] = [
  { pattern: 'they talked for a while', re: /\b(?:they|we)\s+(?:talked|spoke|argued|discussed)\s+for\s+(?:a\s+)?(?:while|long\s+time|some\s+time|bit)\b/gi },
  { pattern: 'time passed', re: /\b(?:time\s+passed|hours\s+went\s+by|days\s+went\s+by|after\s+a\s+while|after\s+some\s+time|meanwhile|later\s+that\s+(?:day|night|week))\b/gi },
  { pattern: 'after a discussion', re: /\b(?:after\s+(?:a\s+)?(?:long\s+|brief\s+|heated\s+)?(?:discussion|argument|debate|conversation))\b/gi },
  { pattern: 'in the end they', re: /\b(?:eventually|in\s+the\s+end|ultimately)\s+(?:they|he|she|we)\s+(?:decided|agreed|concluded|realized)\b/gi },
];

// —— 中文抽象形容 ——
const ABSTRACT_ADJ_ZH: string[] = ['美丽的', '漂亮的', '帅气的', '英俊的', '神秘的', '迷人的', '优雅的', '高贵的', '可爱的', '性感的', '冷酷的', '温柔的', '霸道的', '强大的', '弱小的', '聪明的', '愚蠢的', '善良的', '邪恶的', '高大的', '矮小的'];

// —— 英文抽象形容 ——
const ABSTRACT_ADJ_EN: string[] = ['beautiful', 'gorgeous', 'handsome', 'mysterious', 'charming', 'elegant', 'noble', 'cute', 'sexy', 'cold', 'gentle', 'domineering', 'powerful', 'weak', 'smart', 'stupid', 'kind', 'evil', 'tall', 'short'];

// —— 中文内心独白 ——
const INNER_MONO_ZH: { pattern: string; re: RegExp }[] = [
  { pattern: '他想到了', re: /[他她][^，。]{0,3}(想到了|想起了|回忆起|脑海中浮现|脑海里出现|不禁想起|脑中闪过)/g },
  { pattern: '他心想', re: /[他她][^，。]{0,3}(心想|暗想|心道|心想道|心中[暗嘀咕]|内心[想道嘀咕]|心里[想道嘀咕])/g },
  { pattern: '他记得', re: /[他她][^，。]{0,3}(记得|还记得|依然记得|清晰记得|清楚地记得)/g },
];

// —— 英文内心独白 ——
const INNER_MONO_EN: { pattern: string; re: RegExp }[] = [
  { pattern: 'he thought', re: /\b(?:he|she|they)\s+(?:thought|remembered|recalled|wondered|reflected|pondered)\b/gi },
  { pattern: 'he knew', re: /\b(?:he|she)\s+(?:knew|realized|understood|recognized)\s+(?:that|how|why)\b/gi },
  { pattern: 'memory of', re: /\b(?:memory\s+of|flashback\s+to|he\s+remembered|she\s+remembered)\b/gi },
  { pattern: 'in his mind', re: /\b(?:in\s+(?:his|her|their)\s+(?:mind|heart|thoughts)|deep\s+in\s+(?:his|her)\s+(?:mind|heart))\b/gi },
];

/**
 * 提取匹配片段的上下文（前后各10字）
 */
function snippet(text: string, index: number, matchLen: number, lang: SdtLang): string {
  const ctx = lang === 'en' ? 15 : 10;
  const start = Math.max(0, index - ctx);
  const end = Math.min(text.length, index + matchLen + ctx);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}

/**
 * 主函数：扫描成稿中的"叙述代替展示"问题
 */
export function showDontTellScan(text: string, lang: SdtLang = 'zh'): ShowDontTellResult {
  const issues: SdtIssue[] = [];
  const tellEmotionHits: { pattern: string; snippet: string }[] = [];
  const summaryHits: { pattern: string; snippet: string }[] = [];
  const abstractAdjHits: { pattern: string; snippet: string }[] = [];
  const innerMonologueHits: { pattern: string; snippet: string }[] = [];

  // 1. 直接说情绪
  const tellEmotionPatterns = lang === 'en' ? TELL_EMOTION_EN : TELL_EMOTION_ZH;
  for (const { pattern, re } of tellEmotionPatterns) {
    const reCopy = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = reCopy.exec(text)) !== null) {
      tellEmotionHits.push({ pattern, snippet: snippet(text, m.index, m[0].length, lang) });
    }
  }
  if (tellEmotionHits.length >= 3) {
    issues.push({
      severity: 'high',
      type: 'tell_emotion',
      evidence: `${tellEmotionHits.length}处直接说情绪：${tellEmotionHits.slice(0, 3).map((h) => h.snippet).join('；')}`,
      advice: lang === 'en'
        ? `Stop naming emotions (${tellEmotionHits.length} hits) — show them through action: "she slammed the cup" not "she was angry". Replace every "felt X" with a visible behavior`
        : `不要直接报情绪名（${tellEmotionHits.length}处）——用动作展示：写"她把杯子摔在地上"而不是"她很生气"。把每处"感到X"改成可见的行为`,
    });
  } else if (tellEmotionHits.length >= 1) {
    issues.push({
      severity: 'mid',
      type: 'tell_emotion',
      evidence: `${tellEmotionHits.length}处直接说情绪：${tellEmotionHits.slice(0, 2).map((h) => h.snippet).join('；')}`,
      advice: lang === 'en'
        ? `Some emotions told not shown — convert "felt X" to visible actions/expressions`
        : `有${tellEmotionHits.length}处情绪直说——改成可见动作或表情`,
    });
  }

  // 2. 总结代替场景
  const summaryPatterns = lang === 'en' ? SUMMARY_EN : SUMMARY_ZH;
  for (const { pattern, re } of summaryPatterns) {
    const reCopy = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = reCopy.exec(text)) !== null) {
      summaryHits.push({ pattern, snippet: snippet(text, m.index, m[0].length, lang) });
    }
  }
  if (summaryHits.length >= 2) {
    issues.push({
      severity: 'high',
      type: 'summary_not_scene',
      evidence: `${summaryHits.length}处总结代替场景：${summaryHits.slice(0, 3).map((h) => h.snippet).join('；')}`,
      advice: lang === 'en'
        ? `Summarizing instead of showing (${summaryHits.length} hits) — dramatize these moments as actual scenes with dialogue and action, don't skip`
        : `用总结跳过了${summaryHits.length}处关键戏——把这些"他们聊了很久"展开成实际对话与动作，不要跳过`,
    });
  } else if (summaryHits.length === 1) {
    issues.push({
      severity: 'mid',
      type: 'summary_not_scene',
      evidence: `1处总结：${summaryHits[0].snippet}`,
      advice: lang === 'en'
        ? `One summary skips a scene — consider dramatizing it instead`
        : `有1处总结跳过了戏——考虑展开成实际场景`,
    });
  }

  // 3. 抽象形容
  const adjList = lang === 'en' ? ABSTRACT_ADJ_EN : ABSTRACT_ADJ_ZH;
  for (const adj of adjList) {
    let idx = 0;
    while ((idx = text.indexOf(adj, idx)) !== -1) {
      abstractAdjHits.push({ pattern: adj, snippet: snippet(text, idx, adj.length, lang) });
      idx += adj.length;
    }
  }
  if (abstractAdjHits.length >= 4) {
    issues.push({
      severity: 'mid',
      type: 'abstract_adj',
      evidence: `${abstractAdjHits.length}处抽象形容：${abstractAdjHits.slice(0, 3).map((h) => h.pattern).join('、')}`,
      advice: lang === 'en'
        ? `Too many abstract adjectives (${abstractAdjHits.length}) — replace "beautiful" with one concrete visual detail (e.g. "hair like ink, skin like porcelain")`
        : `抽象形容词过多（${abstractAdjHits.length}处）——把"美丽的"换成一个具体视觉细节（如"发如泼墨，肤如凝脂"）`,
    });
  }

  // 4. 内心独白
  const innerMonoPatterns = lang === 'en' ? INNER_MONO_EN : INNER_MONO_ZH;
  for (const { pattern, re } of innerMonoPatterns) {
    const reCopy = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = reCopy.exec(text)) !== null) {
      innerMonologueHits.push({ pattern, snippet: snippet(text, m.index, m[0].length, lang) });
    }
  }
  if (innerMonologueHits.length >= 2) {
    issues.push({
      severity: 'mid',
      type: 'inner_monologue',
      evidence: `${innerMonologueHits.length}处内心独白：${innerMonologueHits.slice(0, 2).map((h) => h.snippet).join('；')}`,
      advice: lang === 'en'
        ? `Inner monologue overused (${innerMonologueHits.length}) — externalize thoughts into action or dialogue; film can't show what's inside a character's head`
        : `内心独白过多（${innerMonologueHits.length}处）——把内心活动外化为动作或对白，影视看不到角色脑子里想什么`,
    });
  }

  // 5. 长叙述无动作：检测连续多行纯叙述（非 △ 行、非对白行、非场景标题行）
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let longestProseBlock = 0;
  let currentBlock = 0;
  for (const line of lines) {
    const isAction = line.startsWith('△');
    const isDialogue = /^[一-龥A-Za-z·]{1,6}(?:（[^）]*）)?[：:]/.test(line);
    const isSceneTitle = isSceneHeaderLine(line); // c213：收口共享切分器（旧内联正则漏 场N：/室内/转场口）
    if (!isAction && !isDialogue && !isSceneTitle) {
      currentBlock++;
      longestProseBlock = Math.max(longestProseBlock, currentBlock);
    } else {
      currentBlock = 0;
    }
  }
  if (longestProseBlock >= 4) {
    issues.push({
      severity: 'high',
      type: 'long_prose_no_action',
      evidence: `连续${longestProseBlock}行纯叙述无动作行/对白行`,
      advice: lang === 'en'
        ? `Novelistic prose block (${longestProseBlock} consecutive narration lines) — break it up with △ action lines and dialogue; screenplay is not prose`
        : `小说式连续叙述（${longestProseBlock}行无动作无对白）——用△动作行和对白打断叙述墙，剧本不是小说`,
    });
  } else if (longestProseBlock === 3) {
    issues.push({
      severity: 'mid',
      type: 'long_prose_no_action',
      evidence: `连续3行纯叙述`,
      advice: lang === 'en'
        ? `Three consecutive narration lines — insert an action or dialogue beat`
        : `连续3行纯叙述——插入一个动作或对白节拍`,
    });
  }

  // 得分：100 - high*18 - mid*6 - low*2，下限 0
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const midCount = issues.filter((i) => i.severity === 'mid').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;
  const score = Math.max(0, Math.min(100, 100 - highCount * 18 - midCount * 6 - lowCount * 2));

  return { score, issues, tellEmotionHits, summaryHits, abstractAdjHits, innerMonologueHits, longestProseBlock };
}

/**
 * v2.359 前置教学：把上面五类检测口径反向前置成「写之前就教」的指令。
 * 与 showDontTellScan 同文件 = 同源（v2.157 铁律：教学与检测同源，改口径不漂移）。
 * 制式分叉：LIVE 教 △ 动作行；AIGC 正文是流畅自然段（不加 △），内心只走（内心：…）。
 * en 层零中文。
 */
export function buildShowDontTellDirective(mode: 'LIVE' | 'AIGC' = 'LIVE', lang: SdtLang = 'zh'): string {
  if (lang === 'en') {
    return `[PRE-WRITING RULE · Show, don't tell — the first law of screenwriting] A screenplay shows; it never narrates. This list mirrors the five-class showDontTellScan checks (format dimension, 20% weight), so write it right the first time:
1) Never name an emotion in narration ("he felt angry", "she was nervous", "with anger", "angrily") — convert it to visible action, physiology or expression (the cup hits the floor, knuckles go white, breath shortens, he turns and walks out).
2) Never summarize a scene ("they talked for a while", "time passed", "after a long discussion", "eventually they agreed") — stage the negotiation or confrontation as actual dialogue and action; never skip it.
3) No abstract adjectives ("beautiful", "handsome", "mysterious", "gentle", "cold", "domineering") — replace each with one concrete visual detail (hair like spilled ink, a frayed cuff, shoes that never carry dust).
4) No inner-monologue narration ("he thought", "she remembered", "he knew that", "in his mind") — externalize into action, props or dialogue; the camera cannot film the inside of a head.
5) No prose walls: every action gets its own △ line, and never run more than 3 consecutive lines without △ action or dialogue.
Exception: the emotion/action cue inside a dialogue line "NAME (emotion): line" is a performance note for the actor — keep it. What is banned is narrating emotions in the prose body.
AIGC mode: the body stays flowing prose without △ markers; inner voice only as the (inner: …) parenthetical, never as "he thought" narration; every paragraph must land on a filmable image, an audible cue or a concrete action.`;
  }
  if (mode === 'AIGC') {
    return `【前置教学·展示而非叙述（影视编剧第一法则·AIGC 流畅制作本）】剧本只展示、不叙述；本清单与 showDontTellScan 五类检测同源（format 维度占 20% 权重），先写对再谈润色：
① 禁止叙述句直报情绪：不写「他感到很生气」「心里很慌」「十分紧张」「内心挣扎」「生气地摔门」里的情绪名——改成可见动作、生理反应或表情（杯子砸在地上、指节发白、呼吸变急、转身就走）。
② 禁止总结代替场景：不写「他们聊了很久」「时间过得飞快」「经过一番争吵」「就这样定了」——把关键谈判/摊牌展开成实际对话与动作，绝不跳过。
③ 禁止抽象形容：不写「美丽的」「帅气的」「神秘的」「温柔的」「霸道的」——换成一个具体视觉细节（发如泼墨、袖口磨得起毛、皮鞋从不沾灰）。
④ 禁止内心独白叙述：不写「他想到了」「她记得」「他心想」「脑海里浮现」——内心活动只用自然括号（内心：…）承载，或外化为动作、道具、台词；影视拍不到角色脑子里。
⑤ 禁止纯叙述墙：AIGC 正文是流畅自然段（不加 △），但严禁连续堆叠心理/环境叙述——每段必须落到可拍摄画面、可听声音或具体动作，一段只承载一层信息。
例外：台词行「角色名（情绪/动作）：台词」里的情绪/动作括号是给演员的表演提示，允许保留；被禁的只是叙述句里直报情绪。`;
  }
  return `【前置教学·展示而非叙述（影视编剧第一法则）】剧本只展示、不叙述；本清单与 showDontTellScan 五类检测同源（format 维度占 20% 权重），先写对再谈润色：
① 禁止叙述句直报情绪：不写「他感到很生气」「心里很慌」「十分紧张」「内心挣扎」「生气地摔门」里的情绪名——改成可见动作、生理反应或表情（杯子砸在地上、指节发白、呼吸变急、转身就走）。
② 禁止总结代替场景：不写「他们聊了很久」「时间过得飞快」「经过一番争吵」「就这样定了」——把关键谈判/摊牌展开成实际对话与动作，绝不跳过。
③ 禁止抽象形容：不写「美丽的」「帅气的」「神秘的」「温柔的」「霸道的」——换成一个具体视觉细节（发如泼墨、袖口磨得起毛、皮鞋从不沾灰）。
④ 禁止内心独白叙述：不写「他想到了」「她记得」「他心想」「脑海里浮现」——外化为动作、道具或台词；影视拍不到角色脑子里。
⑤ 禁止纯叙述墙：每个动作独占 △ 行，△ 动作行与台词行交替推进，不得连续 3 行以上无 △ 无对白的纯叙述。
例外：台词行「角色名（情绪/动作）：台词」里的情绪/动作括号是给演员的表演提示，允许保留；被禁的只是叙述句里直报情绪。`;
}

// —— c211 落库统一形态（批量生成 / SSE / /fix 重算三处共用，禁止手写分叉）——
// 本引擎是 issues 形态（无顶层 hits），v2.150 的 buildQcEngineDigest 按 hits 硬过滤，
// 导致它只在 SSE 流里出现、从不落库，刷新后质检面板永久失明。
export const SDT_DIGEST_ISSUES_CAP = 6;
export const SDT_TYPE_MAX = 40;
export const SDT_EVIDENCE_MAX = 180;
export const SDT_ADVICE_MAX = 200;

export interface SdtDigestIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

export interface ShowDontTellDigest {
  score: number;
  issues: SdtDigestIssue[];
  /** 四类原始命中计数（evidence 不落库，卡片副标题只需要数量） */
  counts: { tellEmotion: number; summary: number; abstractAdj: number; innerMonologue: number };
  longestProseBlock: number;
}

/** 按正文是否含汉字探测语言（Project 模型无 lang 字段，/fix 无语言入参时用） */
export function detectSdtLang(text: string): SdtLang {
  return /[\u4e00-\u9fff]/.test(text || '') ? 'zh' : 'en';
}

const sdtClip = (s: unknown, max: number): string => String(s ?? '').slice(0, max);

/**
 * 落库摘要：issue 只四字段并截断，四类命中只留计数；null 入参显式抛错，不静默伪造。
 * 健康稿（issues 为空）同样落库——质检卡靠它做"影视化达标集"计数。
 */
export function showDontTellDigest(res: ShowDontTellResult | null | undefined): ShowDontTellDigest {
  if (!res || typeof res !== 'object') {
    throw new Error('showDontTellDigest: result required');
  }
  return {
    score: typeof res.score === 'number' ? res.score : 100,
    issues: (res.issues ?? []).slice(0, SDT_DIGEST_ISSUES_CAP).map((i) => ({
      severity: i.severity === 'high' || i.severity === 'low' ? i.severity : 'mid',
      type: sdtClip(i.type, SDT_TYPE_MAX),
      evidence: sdtClip(i.evidence, SDT_EVIDENCE_MAX),
      advice: sdtClip(i.advice, SDT_ADVICE_MAX),
    })),
    counts: {
      tellEmotion: Array.isArray(res.tellEmotionHits) ? res.tellEmotionHits.length : 0,
      summary: Array.isArray(res.summaryHits) ? res.summaryHits.length : 0,
      abstractAdj: Array.isArray(res.abstractAdjHits) ? res.abstractAdjHits.length : 0,
      innerMonologue: Array.isArray(res.innerMonologueHits) ? res.innerMonologueHits.length : 0,
    },
    longestProseBlock: typeof res.longestProseBlock === 'number' ? res.longestProseBlock : 0,
  };
}

/** 正文 → 落库摘要（自动语言探测；可显式传 lang） */
export function showDontTellForStorage(text: string, lang?: SdtLang): ShowDontTellDigest {
  return showDontTellDigest(showDontTellScan(text, lang ?? detectSdtLang(text)));
}
