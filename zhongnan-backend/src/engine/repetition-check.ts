import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 重复感检测器（PRD 2.1.16 短剧新鲜感生死线）
 * ------------------------------------------------------------------
 * AI 生成剧本最常见的顽疾是"原地打转"：
 *  - 同一句式反复出现（"你凭什么..."出现3次）
 *  - 同一情绪beat重复（3次"怒吼"没有升级）
 *  - 同一动作词堆砌（5次"摔东西"）
 *  - 同一场景结构（3个场景都是"开门→吵架→摔门走"）
 *
 * 现有引擎检测"有没有"和"够不够"：
 *  - voice-print 检测角色间声口同质化（不同角色一个味儿）
 *  - dialogue-water 检测水分台词（低价值对白）
 *  - conflict-density 检测冲突升级（强度递增）
 *  - punchline-density 检测金句修辞强度
 *
 * 但都没有检测"是否重复"——同一内容/句式/情绪/动作反复出现。
 * 本引擎专注于重复感检测，补齐"新鲜感"维度。
 *
 * 五类重复检测：
 *  1) 近似重复台词：编辑距离 ≤3 的对白行出现 2+ 次
 *  2) 重复句式模板：相同句式骨架（如"你凭什么..."）出现 3+ 次
 *  3) 重复情绪beat：同一情绪信号词出现 3+ 次且无升级
 *  4) 重复动作词：同一动作动词出现 4+ 次
 *  5) 重复场景开头：多个场景以相同模式开场
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type RcLang = 'zh' | 'en';

export interface RepetitionIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 重复命中 */
export interface RepetitionHit {
  /** 重复类型 */
  type: 'exact_line' | 'pattern' | 'emotion' | 'action' | 'scene_opener';
  typeLabel: string;
  /** 重复的模式/词/句式 */
  pattern: string;
  /** 出现次数 */
  count: number;
  /** 命中的片段列表 */
  snippets: string[];
}

export interface RepetitionResult {
  /** 新鲜度分 0-100（越高越好，100=无重复）
   *  实际存储为 100 - 重复扣分，扣分越多分越低 */
  score: number;
  /** 重复命中列表 */
  hits: RepetitionHit[];
  /** 近似重复台词组数 */
  exactLineGroups: number;
  /** 重复句式模板数 */
  patternCount: number;
  /** 重复情绪beat数 */
  emotionRepeats: number;
  /** 重复动作词数 */
  actionRepeats: number;
  /** 重复场景开头数 */
  sceneOpenerRepeats: number;
  /** 总重复扣分 */
  totalPenalty: number;
  issues: RepetitionIssue[];
}

// —— 对白行识别 ——
const DIALOGUE_RE_ZH = /^([一-龥A-Za-z·]{1,6})(?:（[^）]*）)?[：:]\s*(.+)$/;
const DIALOGUE_RE_EN = /^[A-Z][a-z]{1,15}(?:\s*\([^)]*\))?\s*[:：]\s*(.+)$/;

function isSceneLine(line: string, lang: RcLang): boolean {
  // c213：收口共享切分器（全格式场头 + 剧名页/集标题 + FADE OUT）
  return isSceneOrTitleLine(line, lang);
}

function isActionLine(line: string): boolean {
  return line.trim().startsWith('△');
}

function isDialogueLine(line: string, lang: RcLang): boolean {
  const trimmed = line.trim();
  if (!trimmed || isSceneLine(trimmed, lang) || isActionLine(trimmed)) return false;
  if (lang === 'en') return DIALOGUE_RE_EN.test(trimmed);
  return DIALOGUE_RE_ZH.test(trimmed);
}

function extractDialogueText(line: string, lang: RcLang): string {
  const trimmed = line.trim();
  if (lang === 'en') {
    const m = trimmed.match(DIALOGUE_RE_EN);
    return m ? m[1].trim() : trimmed;
  }
  const m = trimmed.match(DIALOGUE_RE_ZH);
  return m ? m[2].trim() : trimmed;
}

/** 编辑距离（Levenshtein），用于近似重复检测 */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 5) return Math.max(m, n); // 长度差>5直接跳过
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// —— 句式模板提取：取前N个字作为句式骨架 ——
function extractPattern(text: string, lang: RcLang): string {
  // 中文取前4字作为句式骨架；英文取前2-3个词
  if (lang === 'en') {
    const words = text.split(/\s+/).slice(0, 3).join(' ');
    return words.toLowerCase();
  }
  // 中文：取前4字，保留疑问/感叹词
  const prefix = text.slice(0, 4);
  return prefix;
}

// —— 情绪信号词 ——
const EMOTION_SIGNALS_ZH = [
  { word: '怒', label: '怒' },
  { word: '吼', label: '吼' },
  { word: '哭', label: '哭' },
  { word: '笑', label: '笑' },
  { word: '冷', label: '冷' },
  { word: '颤', label: '颤抖' },
  { word: '摔', label: '摔' },
  { word: '跪', label: '跪' },
  { word: '走', label: '走' },
  { word: '跪下', label: '跪下' },
];

const EMOTION_SIGNALS_EN = [
  { word: 'angry', label: 'Anger' },
  { word: 'shout', label: 'Shout' },
  { word: 'cry', label: 'Cry' },
  { word: 'laugh', label: 'Laugh' },
  { word: 'cold', label: 'Cold' },
  { word: 'tremble', label: 'Tremble' },
  { word: 'smash', label: 'Smash' },
  { word: 'kneel', label: 'Kneel' },
  { word: 'leave', label: 'Leave' },
];

// —— 动作词提取（从△动作行中） ——
const ACTION_VERB_RE_ZH = /([摔砸撕踹扇踢打推拽揪扯掀泼甩吼怒笑哭颤跪冲撞撕跑走猛然突然])\S{0,2}/g;
const ACTION_VERB_RE_EN = /\b(smash|kick|slap|punch|push|drag|grab|tear|flip|pour|throw|shout|laugh|cry|tremble|kneel|rush|hit|run|walk|leave)\b/gi;

function extractActionVerbs(line: string, lang: RcLang): string[] {
  const re = lang === 'en' ? ACTION_VERB_RE_EN : ACTION_VERB_RE_ZH;
  const matches = line.match(re);
  if (!matches) return [];
  // 归一化：取动词词根（中文取首字，英文取小写）
  return matches.map((m) => lang === 'en' ? m.toLowerCase().slice(0, 5) : m[0]);
}

/**
 * 主函数：检测重复感
 * @param text 成稿全文
 * @param lang 中英文
 */
export function repetitionCheck(text: string, lang: RcLang = 'zh'): RepetitionResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hits: RepetitionHit[] = [];
  let totalPenalty = 0;

  // —— 提取对白行和动作行 ——
  const dialogueTexts: { text: string; line: string }[] = [];
  const actionLines: string[] = [];
  for (const line of lines) {
    if (isDialogueLine(line, lang)) {
      dialogueTexts.push({ text: extractDialogueText(line, lang), line });
    } else if (isActionLine(line)) {
      actionLines.push(line);
    }
  }

  // —— 1. 近似重复台词检测 ——
  const exactGroups: { pattern: string; snippets: string[]; count: number }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < dialogueTexts.length; i++) {
    if (used.has(i)) continue;
    const group: string[] = [dialogueTexts[i].line];
    for (let j = i + 1; j < dialogueTexts.length; j++) {
      if (used.has(j)) continue;
      const dist = editDistance(dialogueTexts[i].text, dialogueTexts[j].text);
      // 编辑距离 ≤3 且原文长度 ≥4 才算近似重复
      if (dist <= 3 && dialogueTexts[i].text.length >= 4) {
        group.push(dialogueTexts[j].line);
        used.add(j);
      }
    }
    if (group.length >= 2) {
      exactGroups.push({
        pattern: dialogueTexts[i].text.slice(0, 20),
        snippets: group.slice(0, 4),
        count: group.length,
      });
      used.add(i);
    }
  }

  for (const g of exactGroups) {
    const penalty = g.count >= 3 ? 15 : 8;
    totalPenalty += penalty;
    hits.push({
      type: 'exact_line',
      typeLabel: lang === 'en' ? 'Near-duplicate dialogue' : '近似重复台词',
      pattern: g.pattern,
      count: g.count,
      snippets: g.snippets,
    });
  }

  // —— 2. 重复句式模板检测 ——
  const patternMap = new Map<string, string[]>();
  for (const d of dialogueTexts) {
    const pat = extractPattern(d.text, lang);
    if (pat.length < 2) continue;
    if (!patternMap.has(pat)) patternMap.set(pat, []);
    patternMap.get(pat)!.push(d.line.slice(0, 40));
  }

  let patternCount = 0;
  for (const [pat, occurrences] of patternMap) {
    if (occurrences.length >= 3) {
      patternCount++;
      const penalty = occurrences.length >= 4 ? 12 : 8;
      totalPenalty += penalty;
      hits.push({
        type: 'pattern',
        typeLabel: lang === 'en' ? 'Repeated sentence pattern' : '重复句式模板',
        pattern: pat + '...',
        count: occurrences.length,
        snippets: occurrences.slice(0, 4),
      });
    }
  }

  // —— 3. 重复情绪beat检测 ——
  // 情绪词常出现在动作行（"△林晚怒吼"）和对白情绪标签（"林晚（怒）"）中，
  // 必须同时扫描对白行和动作行才能覆盖全场景。
  const emotionSignals = lang === 'en' ? EMOTION_SIGNALS_EN : EMOTION_SIGNALS_ZH;
  const emotionMap = new Map<string, string[]>();
  const emotionSources: { text: string; line: string }[] = [
    ...dialogueTexts,
    ...actionLines.map((line) => ({ text: line, line })),
  ];
  for (const d of emotionSources) {
    const lower = lang === 'en' ? d.text.toLowerCase() : d.text;
    for (const sig of emotionSignals) {
      if (lower.includes(sig.word)) {
        if (!emotionMap.has(sig.label)) emotionMap.set(sig.label, []);
        emotionMap.get(sig.label)!.push(d.line.slice(0, 40));
      }
    }
  }

  let emotionRepeats = 0;
  for (const [label, occurrences] of emotionMap) {
    if (occurrences.length >= 3) {
      emotionRepeats++;
      const penalty = occurrences.length >= 4 ? 10 : 6;
      totalPenalty += penalty;
      hits.push({
        type: 'emotion',
        typeLabel: lang === 'en' ? 'Repeated emotional beat' : '重复情绪beat',
        pattern: label,
        count: occurrences.length,
        snippets: occurrences.slice(0, 4),
      });
    }
  }

  // —— 4. 重复动作词检测 ——
  const actionVerbMap = new Map<string, string[]>();
  for (const line of actionLines) {
    const verbs = extractActionVerbs(line, lang);
    for (const v of verbs) {
      if (!actionVerbMap.has(v)) actionVerbMap.set(v, []);
      actionVerbMap.get(v)!.push(line.slice(0, 40));
    }
  }

  let actionRepeats = 0;
  for (const [verb, occurrences] of actionVerbMap) {
    if (occurrences.length >= 4) {
      actionRepeats++;
      const penalty = occurrences.length >= 5 ? 8 : 5;
      totalPenalty += penalty;
      hits.push({
        type: 'action',
        typeLabel: lang === 'en' ? 'Repeated action verb' : '重复动作词',
        pattern: verb,
        count: occurrences.length,
        snippets: occurrences.slice(0, 4),
      });
    }
  }

  // —— 5. 重复场景开头检测 ——
  const sceneOpeners: string[] = [];
  for (const line of lines) {
    if (isSceneLine(line, lang)) {
      // 取场景标题行 + 下一行前10字作为"场景开头模式"
      const idx = lines.indexOf(line);
      const nextLine = lines[idx + 1] || '';
      const opener = (line.slice(0, 15) + '|' + nextLine.slice(0, 10)).trim();
      sceneOpeners.push(opener);
    }
  }

  const openerMap = new Map<string, number>();
  for (const op of sceneOpeners) {
    openerMap.set(op, (openerMap.get(op) || 0) + 1);
  }

  let sceneOpenerRepeats = 0;
  for (const [opener, count] of openerMap) {
    if (count >= 2) {
      sceneOpenerRepeats++;
      totalPenalty += 5;
      hits.push({
        type: 'scene_opener',
        typeLabel: lang === 'en' ? 'Repeated scene opener' : '重复场景开头',
        pattern: opener,
        count,
        snippets: [],
      });
    }
  }

  // —— 评分：100 - 总扣分，下限0 ——
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  // —— 问题检测 ——
  const issues: RepetitionIssue[] = [];

  // high: 3+ 近似重复台词
  if (exactGroups.some((g) => g.count >= 3)) {
    const g = exactGroups.find((g) => g.count >= 3)!;
    issues.push({
      severity: 'high',
      type: 'exact_repeat_3plus',
      evidence: lang === 'en'
        ? `Near-duplicate line appears ${g.count} times: "${g.pattern}..."`
        : `近似重复台词出现${g.count}次："${g.pattern}…"`,
      advice: lang === 'en'
        ? 'Same dialogue repeated 3+ times feels like AI looping. Rewrite each occurrence with different phrasing or escalate the emotion.'
        : '同一台词重复3次以上是AI打转的标志。每次出现都要换说法或升级情绪。',
    });
  }

  // mid: 重复句式模板 ≥2 组
  if (patternCount >= 2) {
    issues.push({
      severity: 'mid',
      type: 'too_many_patterns',
      evidence: lang === 'en'
        ? `${patternCount} repeated sentence pattern groups found`
        : `发现${patternCount}组重复句式模板`,
      advice: lang === 'en'
        ? 'Vary sentence structures — use questions, declarations, exclamations, and short/long alternation.'
        : '变化句式结构——交替使用疑问/陈述/感叹/长短句。',
    });
  }

  // mid: 重复情绪beat ≥2
  if (emotionRepeats >= 2) {
    issues.push({
      severity: 'mid',
      type: 'too_many_emotion_repeats',
      evidence: lang === 'en'
        ? `${emotionRepeats} emotions repeated 3+ times without escalation`
        : `${emotionRepeats}种情绪重复3次以上无升级`,
      advice: lang === 'en'
        ? 'Same emotional beat repeated without escalation feels flat. Escalate: silent anger → verbal → physical.'
        : '同一情绪beat反复无升级会显平。要递进：沉默→语言→肢体。',
    });
  }

  // mid: 重复动作词 ≥2
  if (actionRepeats >= 2) {
    issues.push({
      severity: 'mid',
      type: 'too_many_action_repeats',
      evidence: lang === 'en'
        ? `${actionRepeats} action verbs repeated 4+ times`
        : `${actionRepeats}个动作词重复4次以上`,
      advice: lang === 'en'
        ? 'Vary action vocabulary — use different verbs for similar actions (smash/slam/hurl/throw).'
        : '丰富动作词汇——同类动作用不同动词（摔/砸/掀/掷/甩）。',
    });
  }

  // low: 重复场景开头
  if (sceneOpenerRepeats >= 2) {
    issues.push({
      severity: 'low',
      type: 'repeated_scene_openers',
      evidence: lang === 'en'
        ? `${sceneOpenerRepeats} scene openers are identical`
        : `${sceneOpenerRepeats}个场景开头模式相同`,
      advice: lang === 'en'
        ? 'Vary scene openings — start with action, dialogue, or environment alternately.'
        : '变化场景开头——交替用动作/对白/环境开场。',
    });
  }

  return {
    score,
    hits: hits.sort((a, b) => b.count - a.count),
    exactLineGroups: exactGroups.length,
    patternCount,
    emotionRepeats,
    actionRepeats,
    sceneOpenerRepeats,
    totalPenalty,
    issues,
  };
}
