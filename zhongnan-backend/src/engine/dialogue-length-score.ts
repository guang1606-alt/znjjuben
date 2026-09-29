/**
 * 对白长度与速度感检测器（PRD 2.1.17 短剧节奏生死线）
 * ------------------------------------------------------------------
 * 短剧的节奏生死线——每秒屏幕时间极其宝贵，长台词直接拖慢节奏导致用户弃剧。
 *
 * 短剧对白要求：短促、有力、交锋感强。
 *  - 理想单条对白 ≤15 字（短剧标配，观众3秒读完）
 *  - 可接受 16-25 字（中等长度，信息量适中）
 *  - 偏长 26-40 字（需要拆分，否则拖节奏）
 *  - 超长 >40 字（短剧致命伤，观众弃剧）
 *
 * 现有引擎覆盖：
 *  - dialogue-water-check.ts: 检测台词"有没有用"（功能层面），不看长度
 *  - voice-print.ts: 检测台词"像不像同一人说"（声线层面），不看长度
 *  - rhythm.ts: 检测动作行/对白行比例（结构层面），不看单条长度
 *  - scene-density-score.ts: 检测场景结构，不看场景内对白长度
 *
 * 本引擎专注于：
 *  1) 单条对白长度分布：短(≤15字)/中(16-25字)/长(26-40字)/超长(>40字)
 *  2) 台词墙检测：单条>60字的对白（短剧致命伤，必须拆分）
 *  3) 独白戏检测：单角色连续说话超过3条（缺乏交锋感）
 *  4) 对白节奏感：长短交替（避免全短无信息或全长无节奏）
 *  5) 平均对白长度：越短越快（理想≤20字）
 *  6) 超长对白占比：>40字对白占总体比例（应<15%）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type DlLang = 'zh' | 'en';

export interface DialogueLengthIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 单条对白信息 */
export interface DialogueLineInfo {
  /** 角色名 */
  character: string;
  /** 对白原文 */
  line: string;
  /** 对白内容（去掉角色名和冒号） */
  text: string;
  /** 字数（CJK 汉字数 或 英文单词×1.67） */
  wordCount: number;
  /** 长度分类 */
  category: 'short' | 'medium' | 'long' | 'extra_long' | 'wall';
  /** 在全文中的行号 */
  lineIndex: number;
  /** 在全文中的相对位置 0-1 */
  position: number;
}

export interface MonologueHit {
  /** 角色名 */
  character: string;
  /** 连续对白条数 */
  consecutiveCount: number;
  /** 累计字数 */
  totalWords: number;
  /** 起始行号 */
  startLineIndex: number;
  /** 对白片段 */
  snippet: string;
}

export interface DialogueLengthResult {
  /** 对白长度与速度感分 0-100（越高越好） */
  score: number;
  /** 对白总条数 */
  totalLines: number;
  /** 长度分布 */
  distribution: {
    short: number;     // ≤15字
    medium: number;    // 16-25字
    long: number;      // 26-40字
    extra_long: number; // 41-60字
    wall: number;      // >60字（台词墙）
  };
  /** 各长度占比 0-1 */
  ratios: {
    short: number;
    medium: number;
    long: number;
    extra_long: number;
    wall: number;
  };
  /** 平均对白字数 */
  avgLength: number;
  /** 最长对白字数 */
  maxLength: number;
  /** 最长对白原文 */
  maxLine: string;
  /** 超长对白（>40字）总数 */
  overLongCount: number;
  /** 超长对白占比 0-1 */
  overLongRatio: number;
  /** 台词墙（>60字）列表 */
  wallHits: DialogueLineInfo[];
  /** 超长对白（41-60字）列表 */
  overLongHits: DialogueLineInfo[];
  /** 独白戏列表 */
  monologueHits: MonologueHit[];
  /** 是否有长短交替节奏 */
  hasRhythm: boolean;
  /** 所有对白行详情 */
  lines: DialogueLineInfo[];
  issues: DialogueLengthIssue[];
}

// —— 对白行识别（复用 scene-density 的模式） ——
const DIALOGUE_RE_ZH = /^[一-龥A-Za-z·]{1,6}(?:（[^）]*）)?[：:]\s*\S/;
const DIALOGUE_RE_EN = /^[A-Z][a-z]{1,15}(?:\s*\([^)]*\))?\s*[:：]\s*\S/;

// —— 动作行识别（排除） ——
const ACTION_PREFIX = /^[△▲*✦]/;

// —— 长度阈值（按 CJK 汉字数；英文用 wordCount×1.67 等效换算） ——
const LEN_SHORT = 15;       // ≤15字：短促有力
const LEN_MEDIUM = 25;      // 16-25字：中等
const LEN_LONG = 40;        // 26-40字：偏长
const LEN_EXTRA_LONG = 60;  // 41-60字：超长
// >60字：台词墙（致命伤）

/** 判断是否为对白行 */
function isDialogueLine(line: string, lang: DlLang): boolean {
  const trimmed = line.trim();
  if (!trimmed || ACTION_PREFIX.test(trimmed)) return false;
  if (lang === 'en') return DIALOGUE_RE_EN.test(trimmed);
  return DIALOGUE_RE_ZH.test(trimmed);
}

/** 提取角色名 */
function extractCharacter(line: string, lang: DlLang): string {
  const trimmed = line.trim();
  if (lang === 'en') {
    const m = trimmed.match(/^([A-Z][a-z]{1,15})/);
    return m ? m[1] : '';
  }
  const m = trimmed.match(/^([一-龥A-Za-z·]{1,6})/);
  return m ? m[1] : '';
}

/** 提取对白内容（去掉角色名和冒号） */
function extractDialogueText(line: string): string {
  const trimmed = line.trim();
  const idx = trimmed.search(/[：:]\s*/);
  if (idx === -1) return trimmed;
  return trimmed.slice(idx).replace(/^[：:]\s*/, '');
}

/** 统计字数（CJK 汉字数 或 英文单词×1.67） */
function countWords(text: string, lang: DlLang): number {
  if (lang === 'en') {
    const m = text.match(/[A-Za-z][A-Za-z'-]*/g);
    return m ? Math.round(m.length * 1.67) : 0;
  }
  const m = text.match(/[一-鿿]/g);
  return m ? m.length : 0;
}

/** 分类对白长度 */
function categorize(wordCount: number): DialogueLineInfo['category'] {
  if (wordCount > LEN_EXTRA_LONG) return 'wall';
  if (wordCount > LEN_LONG) return 'extra_long';
  if (wordCount > LEN_MEDIUM) return 'long';
  if (wordCount > LEN_SHORT) return 'medium';
  return 'short';
}

/** 解析全文对白行 */
function parseDialogueLines(text: string, lang: DlLang): DialogueLineInfo[] {
  const lines = text.split('\n');
  const result: DialogueLineInfo[] = [];
  const totalLines = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isDialogueLine(line, lang)) continue;

    const character = extractCharacter(line, lang);
    const dialogueText = extractDialogueText(line);
    const wordCount = countWords(dialogueText, lang);
    const category = categorize(wordCount);

    result.push({
      character,
      line: line.trim(),
      text: dialogueText,
      wordCount,
      category,
      lineIndex: i,
      position: totalLines > 1 ? i / (totalLines - 1) : 0,
    });
  }

  return result;
}

/** 检测独白戏（单角色连续说话超过3条） */
function detectMonologues(dialogueLines: DialogueLineInfo[]): MonologueHit[] {
  const hits: MonologueHit[] = [];
  if (dialogueLines.length === 0) return hits;

  let currentChar = dialogueLines[0].character;
  let currentStart = 0;
  let currentCount = 1;
  let currentWords = dialogueLines[0].wordCount;
  let currentLines = [dialogueLines[0]];

  for (let i = 1; i < dialogueLines.length; i++) {
    const dl = dialogueLines[i];
    if (dl.character === currentChar) {
      currentCount++;
      currentWords += dl.wordCount;
      currentLines.push(dl);
    } else {
      // 连续超过3条 或 累计超过80字
      if (currentCount >= 3 || currentWords >= 80) {
        hits.push({
          character: currentChar,
          consecutiveCount: currentCount,
          totalWords: currentWords,
          startLineIndex: dialogueLines[currentStart].lineIndex,
          snippet: currentLines.map((l) => l.line).join(' / '),
        });
      }
      currentChar = dl.character;
      currentStart = i;
      currentCount = 1;
      currentWords = dl.wordCount;
      currentLines = [dl];
    }
  }

  // 检查最后一段
  if (currentCount >= 3 || currentWords >= 80) {
    hits.push({
      character: currentChar,
      consecutiveCount: currentCount,
      totalWords: currentWords,
      startLineIndex: dialogueLines[currentStart].lineIndex,
      snippet: currentLines.map((l) => l.line).join(' / '),
    });
  }

  return hits;
}

/** 检测对白节奏感（长度有变化、不单调） */
function detectRhythm(dialogueLines: DialogueLineInfo[]): boolean {
  if (dialogueLines.length < 4) return true; // 对白太少不检测

  // 计算相邻对白的长度差
  const diffs: number[] = [];
  for (let i = 1; i < dialogueLines.length; i++) {
    diffs.push(Math.abs(dialogueLines[i].wordCount - dialogueLines[i - 1].wordCount));
  }

  // 平均长度差：如果≥3说明有长短交替；如果<3说明长度太均匀（无节奏）
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);

  // 检查是否全短句（>80%短句）
  const shortCount = dialogueLines.filter((d) => d.wordCount <= LEN_SHORT).length;
  const totalCount = dialogueLines.length;
  const allShort = shortCount / totalCount > 0.8;

  // 检查是否全长句（>60%长句，缺乏短句交锋）
  const longCount = dialogueLines.filter((d) => d.wordCount > LEN_MEDIUM).length;
  const allLong = longCount / totalCount > 0.6;

  // 全短句是好节奏（短剧理想状态），不算无节奏
  // 只有"全长句"或"长度过于均匀(avgDiff<3且有中长句)"才算无节奏
  return (avgDiff >= 3 || allShort) && !allLong;
}

// —— 问题建议模板 ——
const ADVICE_ZH = {
  wall: '台词墙（>60字）严重拖慢节奏，必须拆分：把长独白拆成2-3条短对白，中间插入对方反应或动作行',
  extra_long: '超长对白（41-60字）拖慢节奏，建议拆分：将长句拆成2条短对白，或把部分信息转为动作/神态描写',
  long: '偏长对白（26-40字）偏多，短剧理想单条≤15字，建议精简台词，保留核心信息',
  monologue: '独白戏（单角色连续3条+）缺乏交锋感，短剧要求快节奏对话，建议插入对方反应/打断/动作',
  no_rhythm: '对白长度过于均匀，缺乏长短交替节奏感，建议混合使用短句（≤15字）和中句（16-25字）制造节奏',
  avg_too_long: '平均对白长度偏长（>20字），短剧要求短促有力，建议精简台词，删减修饰语',
  overlong_ratio: '超长对白（>40字）占比过高，短剧超长对白应<15%，建议拆分或精简',
  too_few: '对白条数过少，短剧单集应有充分对话交锋，建议增加角色互动',
};

const ADVICE_EN = {
  wall: 'Dialogue wall (>60 chars) severely slows pacing. Must split: break long monologue into 2-3 short lines with reactions or action lines in between',
  extra_long: 'Extra-long dialogue (41-60 chars) slows pacing. Suggest splitting into 2 shorter lines or converting some info to action/gesture description',
  long: 'Too many long dialogues (26-40 chars). Short drama ideal is ≤15 chars per line. Suggest trimming dialogue, keeping only core info',
  monologue: 'Monologue scene (3+ consecutive lines by same character) lacks exchange. Short drama needs fast-paced dialogue. Suggest inserting reactions/interruptions/actions',
  no_rhythm: 'Dialogue lengths too uniform, lacking short-long alternation rhythm. Suggest mixing short (≤15) and medium (16-25) lines for rhythm',
  avg_too_long: 'Average dialogue length too long (>20 chars). Short drama needs punchy lines. Suggest trimming modifiers and filler',
  overlong_ratio: 'Over-long dialogue (>40 chars) ratio too high. Should be <15% in short drama. Suggest splitting or trimming',
  too_few: 'Too few dialogue lines. Single episode should have sufficient exchange. Suggest adding character interactions',
};

export function dialogueLengthScore(text: string, lang: DlLang = 'zh'): DialogueLengthResult {
  const adviceMap = lang === 'en' ? ADVICE_EN : ADVICE_ZH;
  const issues: DialogueLengthIssue[] = [];

  // 解析所有对白行
  const dialogueLines = parseDialogueLines(text, lang);
  const totalLines = dialogueLines.length;

  // 长度分布
  const distribution = {
    short: 0,
    medium: 0,
    long: 0,
    extra_long: 0,
    wall: 0,
  };

  let totalWords = 0;
  let maxLength = 0;
  let maxLine = '';

  const wallHits: DialogueLineInfo[] = [];
  const overLongHits: DialogueLineInfo[] = [];

  for (const dl of dialogueLines) {
    distribution[dl.category]++;
    totalWords += dl.wordCount;

    if (dl.wordCount > maxLength) {
      maxLength = dl.wordCount;
      maxLine = dl.line;
    }

    if (dl.category === 'wall') {
      wallHits.push(dl);
    } else if (dl.category === 'extra_long') {
      overLongHits.push(dl);
    }
  }

  const ratios = {
    short: totalLines > 0 ? distribution.short / totalLines : 0,
    medium: totalLines > 0 ? distribution.medium / totalLines : 0,
    long: totalLines > 0 ? distribution.long / totalLines : 0,
    extra_long: totalLines > 0 ? distribution.extra_long / totalLines : 0,
    wall: totalLines > 0 ? distribution.wall / totalLines : 0,
  };

  const avgLength = totalLines > 0 ? Math.round((totalWords / totalLines) * 10) / 10 : 0;
  const overLongCount = distribution.extra_long + distribution.wall;
  const overLongRatio = totalLines > 0 ? overLongCount / totalLines : 0;

  // 独白戏检测
  const monologueHits = detectMonologues(dialogueLines);

  // 节奏感检测
  const hasRhythm = detectRhythm(dialogueLines);

  // —— 生成问题列表 ——

  // 台词墙（high 级）
  if (wallHits.length > 0) {
    const worst = wallHits[0];
    issues.push({
      severity: 'high',
      type: 'dialogue_wall',
      evidence: `${wallHits.length}条台词墙(>60字)，最长${worst.wordCount}字："${worst.text.slice(0, 30)}..."`,
      advice: adviceMap.wall,
    });
  }

  // 超长对白占比过高（high 级）
  if (totalLines >= 5 && overLongRatio > 0.3) {
    issues.push({
      severity: 'high',
      type: 'overlong_ratio_high',
      evidence: `超长对白(>40字)占比${(overLongRatio * 100).toFixed(0)}%（${overLongCount}/${totalLines}条），应<15%`,
      advice: adviceMap.overlong_ratio,
    });
  } else if (totalLines >= 5 && overLongRatio > 0.15) {
    issues.push({
      severity: 'mid',
      type: 'overlong_ratio_mid',
      evidence: `超长对白(>40字)占比${(overLongRatio * 100).toFixed(0)}%（${overLongCount}/${totalLines}条），偏高`,
      advice: adviceMap.overlong_ratio,
    });
  }

  // 独白戏（high 级：3条+连续 或 累计>80字）
  const seriousMonologues = monologueHits.filter((m) => m.consecutiveCount >= 4 || m.totalWords >= 100);
  if (seriousMonologues.length > 0) {
    const worst = seriousMonologues[0];
    issues.push({
      severity: 'high',
      type: 'monologue_serious',
      evidence: `${seriousMonologues.length}处严重独白戏，最长${worst.consecutiveCount}条连续/${worst.totalWords}字（${worst.character}）`,
      advice: adviceMap.monologue,
    });
  } else if (monologueHits.length > 0) {
    const worst = monologueHits[0];
    issues.push({
      severity: 'mid',
      type: 'monologue_mild',
      evidence: `${monologueHits.length}处独白戏，${worst.consecutiveCount}条连续/${worst.totalWords}字（${worst.character}）`,
      advice: adviceMap.monologue,
    });
  }

  // 平均长度过长（mid 级）
  if (totalLines >= 5 && avgLength > 25) {
    issues.push({
      severity: 'mid',
      type: 'avg_too_long',
      evidence: `平均对白长度${avgLength}字，短剧理想≤20字`,
      advice: adviceMap.avg_too_long,
    });
  } else if (totalLines >= 5 && avgLength > 20) {
    issues.push({
      severity: 'low',
      type: 'avg_slightly_long',
      evidence: `平均对白长度${avgLength}字，略高于理想值20字`,
      advice: adviceMap.avg_too_long,
    });
  }

  // 无节奏感（mid 级）
  if (totalLines >= 4 && !hasRhythm) {
    issues.push({
      severity: 'mid',
      type: 'no_rhythm',
      evidence: '对白长度过于均匀，缺乏长短交替节奏感',
      advice: adviceMap.no_rhythm,
    });
  }

  // 对白条数过少（low 级）
  if (totalLines > 0 && totalLines < 4) {
    issues.push({
      severity: 'low',
      type: 'too_few_dialogues',
      evidence: `仅${totalLines}条对白，短剧单集应有充分对话交锋`,
      advice: adviceMap.too_few,
    });
  }

  // —— 计算得分 ——
  // 基础分 100，按问题严重程度扣分
  let score = 100;

  // 台词墙：每条扣8分
  score -= wallHits.length * 8;

  // 超长对白：每条扣3分
  score -= overLongHits.length * 3;

  // 平均长度：>25扣10分，>20扣5分
  if (avgLength > 25) score -= 10;
  else if (avgLength > 20) score -= 5;

  // 超长占比：>30%扣15分，>15%扣8分
  if (overLongRatio > 0.3) score -= 15;
  else if (overLongRatio > 0.15) score -= 8;

  // 独白戏：每处严重独白扣8分，每处轻度独白扣4分
  score -= seriousMonologues.length * 8;
  score -= (monologueHits.length - seriousMonologues.length) * 4;

  // 无节奏感：扣8分
  if (!hasRhythm && totalLines >= 4) score -= 8;

  // 对白过少：扣5分
  if (totalLines > 0 && totalLines < 4) score -= 5;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    totalLines,
    distribution,
    ratios,
    avgLength,
    maxLength,
    maxLine,
    overLongCount,
    overLongRatio,
    wallHits,
    overLongHits,
    monologueHits,
    hasRhythm,
    lines: dialogueLines,
    issues,
  };
}
