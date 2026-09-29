/**
 * 场景密度与节奏分析器（PRD 2.1.15 短剧节奏生死线）
 * ------------------------------------------------------------------
 * 短剧留存的头号杀手是节奏拖沓——场景太少则平铺，场景太碎则跳脱，
 * 场景长度不均则忽快忽慢，静态场景则水时长。
 *
 * 现有引擎都是"内容级"检测（对白/爽点/金句/冲突），
 * 本引擎是"结构级"检测——场景的密度、长度、分布、呼吸：
 *  - rhythm.ts 只检测"四节拍弧"（hook/conflict/turn/blank），不切场景
 *  - conflict-density 只检测冲突，不看场景如何排布
 *  - dialogue-water 只检测水分台词，不看场景内部结构
 *
 * 本引擎专注于：
 *  1) 场景数：800-1000 字 LIVE 单集理想 3-5 场，AIGC 4-6 场
 *  2) 场景长度分布：各场长度是否均衡，有无拖沓场或碎片场
 *  3) 每场对白/动作比：是否存在"全台词墙"或"全描述"的场
 *  4) 静态场景：无冲突、无转折、无变化的"水场"
 *  5) 碎片场景：不足 3 行有效内容的"跳场"
 *  6) 拖沓场景：占比超 40% 且冲突密度低的"长场"
 *  7) 跨场情绪推进：各场情绪是否有变化，避免"同一情绪重复"
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

import { isSceneHeaderLine } from './script-scenes';

export type SdLang = 'zh' | 'en';

export interface SceneIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 单个场景信息 */
export interface SceneInfo {
  /** 场景序号（1-based） */
  index: number;
  /** 场景标题行原文 */
  header: string;
  /** 场景在全文中的起始位置 0-1 */
  position: number;
  /** 场景内有效行数（对白+动作） */
  lineCount: number;
  /** 场景内对白行数 */
  dialogueLines: number;
  /** 场景内动作行数 */
  actionLines: number;
  /** 场景字数（CJK 汉字或英文单词×1.67） */
  wordCount: number;
  /** 场景内冲突信号数（复用冲突检测关键词） */
  conflictSignals: number;
  /** 场景类型：静态/碎片/拖沓/正常 */
  type: 'normal' | 'static' | 'fragment' | 'dragging';
  /** 对白/动作比 0-1（1=全对白，0=全动作） */
  dialogueRatio: number;
}

export interface SceneDensityResult {
  /** 场景密度分 0-100（越高越好） */
  score: number;
  /** 解析出的场景列表 */
  scenes: SceneInfo[];
  /** 场景总数 */
  count: number;
  /** 各场景字数分布 */
  lengthDistribution: number[];
  /** 静态场景数 */
  staticCount: number;
  /** 碎片场景数 */
  fragmentCount: number;
  /** 拖沓场景数 */
  draggingCount: number;
  /** 最长场景占比 0-1 */
  maxSceneRatio: number;
  /** 平均场景字数 */
  avgSceneLength: number;
  /** 场景长度标准差（衡量均衡度） */
  lengthStdDev: number;
  /** 是否有跨场情绪推进 */
  hasEmotionProgression: boolean;
  issues: SceneIssue[];
}

// —— 场景标题识别 ——
// c213：场头判定统一走 engine/script-scenes.ts 单一事实源（四规范场头全集），
// 禁止在本引擎私写场头正则（历史缺陷：漏切「场景1：」编号式 LIVE 场头）。

// —— 对白行识别（复用 punchline-density 的模式） ——
// c213：英文同时认首字母大写（Jane:）、全大写 slug（JANE:）与多词人名（UNCLE TED: / MR SMITH:）
const DIALOGUE_RE_ZH = /^[一-龥A-Za-z·]{1,6}(?:（[^）]*）)?[：:]\s*\S/;
const DIALOGUE_RE_EN = /^[A-Z][A-Za-z]{0,19}(?:[ \t]+[A-Z][A-Za-z]{0,19}){0,2}(?:[ \t]*\([^)]*\))?[ \t]*[:：]\s*\S/;

// —— 动作行识别 ——
const ACTION_PREFIX = /^[△▲*✦]/;
// c213：英文标准剧本格式动作行用整行括号 (He crosses the room.)
const ACTION_PREFIX_EN = /^\([^)]*\)\s*$/;

// —— 冲突信号（复用 conflict-density 的关键词，简化版） ——
const CONFLICT_SIGNALS_ZH = /(吵|骂|怼|反驳|质问|争吵|指责|你凭什么|闭嘴|滚蛋|拦|挡|推|抢|怒|吼|对峙|逼|威胁|跪|求饶|一巴掌|扇|踹|踢|摔|砸|撕|泼|拽|揪|打|杀|死|坠楼|毒|枪|刀|捅|突然|竟然|居然|背叛|出轨|离婚|怀孕|开除|解雇|身份|真相|秘密|欺骗|撒谎|揍|有用(?:么|吗)|有什么用|别问)/;
const CONFLICT_SIGNALS_EN = /\b(argue|yell|scold|retort|shut up|get out|block|push|grab|anger|shout|confront|threaten|warn|kneel|beg|slap|punch|kick|smash|tear|flip|pour|drag|fight|kill|murder|poison|gun|shoot|stab|suddenly|betray|divorce|pregnant|fire|sacked|identity|truth|secret|deceive|lie|do not ask|don't ask|what can (?:a|an|you|i|we)|snatch(?:ed|es|ing)?)\b/i;

// —— 情绪极性词（用于跨场情绪推进检测） ——
const EMOTION_POS_ZH = /(笑|喜|开心|温柔|轻松|得意|释然|甜|暖|爽|赢|翻盘|反击|解气|碾压|赢)/;
const EMOTION_NEG_ZH = /(怒|哭|吼|冷|恨|颤|怕|急|酸|委屈|憋屈|欺负|辱|压迫|陷害|踩|忍|羞辱|逼|绝望|崩)/;
// c213：情绪词必须收屈折形式（smiling/trembling/crying/shouted），\bsmile\b 曾漏掉全部进行时/过去式
const EMOTION_POS_EN = /\b(smil(?:e|es|ed|ing)|happ(?:y|ier|ily)|gentl(?:e|er|y)|relax(?:ed|es|ing)?|smug|sweet(?:er)?|warm(?:ed|er|s|ing)?|win(?:s|ning|ner)?|won|comeuppance|fight(?:ing)? back|cathartic|crush(?:ed|es|ing)?)\b/i;
const EMOTION_NEG_EN = /\b(anger|angr(?:y|ily)|cry(?:ing|ied|ies)?|shout(?:ed|ing|s)?|cold(?:er|ly)?|hat(?:e|ed|ing|es)|trembl(?:e|ed|es|ing)|afraid|anxious|wronged|grievance|bully(?:ing|ed|s)?|humiliat(?:e|ed|es|ing)|oppress(?:ed|es|ing)?|despair(?:ed|ing|s)?|break(?:s|ing|broke)?)\b/i;

function isSceneHeader(line: string, lang: SdLang): boolean {
  return isSceneHeaderLine(line, lang);
}

function isDialogueLine(line: string, lang: SdLang): boolean {
  const trimmed = line.trim();
  if (!trimmed || ACTION_PREFIX.test(trimmed)) return false;
  // c213：英文整行括号是动作行，先排除（避免 (Uncle Ted: ...) 类误入对白）
  if (lang === 'en' && ACTION_PREFIX_EN.test(trimmed)) return false;
  if (lang === 'en') return DIALOGUE_RE_EN.test(trimmed);
  return DIALOGUE_RE_ZH.test(trimmed);
}

function isActionLine(line: string, lang: SdLang): boolean {
  const trimmed = line.trim();
  if (ACTION_PREFIX.test(trimmed)) return true;
  return lang === 'en' && ACTION_PREFIX_EN.test(trimmed);
}

function hasConflict(line: string, lang: SdLang): boolean {
  if (lang === 'en') return CONFLICT_SIGNALS_EN.test(line);
  return CONFLICT_SIGNALS_ZH.test(line);
}

/** 统计场景字数 */
function sceneWordCount(text: string, lang: SdLang): number {
  if (lang === 'en') {
    const m = text.match(/[A-Za-z][A-Za-z'-]*/g);
    return m ? Math.round(m.length * 1.67) : 0;
  }
  const m = text.match(/[一-鿿]/g);
  return m ? m.length : 0;
}

/** 解析场景列表 */
function parseScenes(text: string, lang: SdLang): { header: string; body: string; startIdx: number }[] {
  const lines = text.split('\n');
  const scenes: { header: string; body: string; startIdx: number }[] = [];
  let currentHeader: string | null = null;
  let currentBody: string[] = [];
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSceneHeader(line, lang)) {
      // 保存前一个场景
      if (currentHeader !== null) {
        scenes.push({ header: currentHeader, body: currentBody.join('\n'), startIdx: currentStart });
      }
      currentHeader = line.trim();
      currentBody = [];
      currentStart = i;
    } else {
      currentBody.push(line);
    }
  }
  // 保存最后一个场景
  if (currentHeader !== null) {
    scenes.push({ header: currentHeader, body: currentBody.join('\n'), startIdx: currentStart });
  }

  // 如果没有识别到场景标题，把全文当作一个场景
  if (scenes.length === 0) {
    scenes.push({ header: '', body: text, startIdx: 0 });
  }

  return scenes;
}

/** 检测场景情绪极性：1=正, -1=负, 0=中性 */
function sceneEmotionPolarity(body: string, lang: SdLang): number {
  const posRe = lang === 'en' ? EMOTION_POS_EN : EMOTION_POS_ZH;
  const negRe = lang === 'en' ? EMOTION_NEG_EN : EMOTION_NEG_ZH;
  const pos = (body.match(new RegExp(posRe.source, posRe.flags.includes('g') ? posRe.flags : posRe.flags + 'g')) || []).length;
  const neg = (body.match(new RegExp(negRe.source, negRe.flags.includes('g') ? negRe.flags : negRe.flags + 'g')) || []).length;
  if (pos > neg) return 1;
  if (neg > pos) return -1;
  return 0;
}

/**
 * 主函数：评估场景密度与节奏
 * @param text 成稿全文
 * @param lang 中英文
 */
export function sceneDensityScore(text: string, lang: SdLang = 'zh'): SceneDensityResult {
  const textLen = Math.max(1, text.length);
  const parsed = parseScenes(text, lang);

  const scenes: SceneInfo[] = parsed.map((s, i) => {
    const bodyLines = s.body.split('\n').map((l) => l.trim()).filter(Boolean);
    const dialogueLines = bodyLines.filter((l) => isDialogueLine(l, lang)).length;
    const actionLines = bodyLines.filter((l) => isActionLine(l, lang)).length;
    const lineCount = dialogueLines + actionLines;
    const wc = sceneWordCount(s.body, lang);
    const conflictSignals = bodyLines.filter((l) => hasConflict(l, lang)).length;
    const dialogueRatio = lineCount > 0 ? Number((dialogueLines / lineCount).toFixed(2)) : 0;

    // 场景类型判定（末场是收尾/释然，允许低冲突，不判静态）
    const isLastScene = i === parsed.length - 1;
    let type: SceneInfo['type'] = 'normal';
    const sceneRatio = wc / Math.max(1, sceneWordCount(text, lang));
    if (lineCount < 3 && wc < 50) {
      type = 'fragment';
    } else if (!isLastScene && conflictSignals === 0 && lineCount >= 4) {
      type = 'static';
    } else if (sceneRatio > 0.4 && conflictSignals < 2) {
      type = 'dragging';
    }

    return {
      index: i + 1,
      header: s.header,
      position: Number((s.startIdx / textLen).toFixed(2)),
      lineCount,
      dialogueLines,
      actionLines,
      wordCount: wc,
      conflictSignals,
      type,
      dialogueRatio,
    };
  });

  const count = scenes.length;
  const lengthDistribution = scenes.map((s) => s.wordCount);
  const totalWords = lengthDistribution.reduce((a, b) => a + b, 0);
  const avgSceneLength = count > 0 ? Math.round(totalWords / count) : 0;
  const maxSceneWords = Math.max(0, ...lengthDistribution);
  const maxSceneRatio = totalWords > 0 ? Number((maxSceneWords / totalWords).toFixed(2)) : 0;

  // 标准差（衡量长度均衡度）
  const lengthStdDev = count > 1
    ? Math.round(Math.sqrt(lengthDistribution.reduce((s, l) => s + Math.pow(l - avgSceneLength, 2), 0) / count))
    : 0;

  const staticCount = scenes.filter((s) => s.type === 'static').length;
  const fragmentCount = scenes.filter((s) => s.type === 'fragment').length;
  const draggingCount = scenes.filter((s) => s.type === 'dragging').length;

  // 跨场情绪推进：至少有 2 个不同情绪极性的场景
  const polarities = scenes.map((s) => sceneEmotionPolarity(
    parsed[s.index - 1].body,
    lang,
  ));
  const uniquePolarities = new Set(polarities.filter((p) => p !== 0));
  const hasEmotionProgression = uniquePolarities.size >= 2;

  // —— 评分 ——
  let score = 0;

  // 1. 场景数（25分）：理想 3-5 场
  if (count >= 3 && count <= 5) score += 25;
  else if (count === 2 || count === 6) score += 18;
  else if (count === 1 || count === 7) score += 10;
  else score += 5;

  // 2. 长度均衡度（25分）：标准差越小越均衡（单场景直接0分——无"均衡"可言）
  if (count < 2) {
    score += 0;
  } else {
    const avgLen = avgSceneLength || 1;
    const cv = lengthStdDev / avgLen; // 变异系数
    if (cv <= 0.3) score += 25;
    else if (cv <= 0.5) score += 18;
    else if (cv <= 0.8) score += 10;
    else score += 5;
  }

  // 3. 对白/动作比（20分）：每场对白比 0.3-0.7 为正常
  const balancedScenes = scenes.filter((s) => s.lineCount > 0 && s.dialogueRatio >= 0.3 && s.dialogueRatio <= 0.7).length;
  const balanceRatio = count > 0 ? balancedScenes / count : 0;
  score += Math.round(20 * balanceRatio);

  // 4. 场景质量（15分）：扣减问题场景
  const problemScenes = staticCount + fragmentCount + draggingCount;
  const sceneQualityScore = Math.max(0, 15 - problemScenes * 5);
  score += sceneQualityScore;

  // 5. 跨场情绪推进（15分）
  score += hasEmotionProgression ? 15 : 5;

  score = Math.max(0, Math.min(100, score));

  // —— 问题检测 ——
  const issues: SceneIssue[] = [];

  // 1. 场景数过少
  if (count === 1) {
    issues.push({
      severity: 'high',
      type: 'single_scene',
      evidence: lang === 'en' ? 'Entire episode is one scene — no scene breaks, no rhythm' : '全集成一个场景——无场景切换，无节奏',
      advice: lang === 'en'
        ? 'Split into 3-5 scenes: setup → conflict → turn → cliffhanger, each scene a clear beat'
        : '拆成3-5个场景：开场设疑→冲突升级→转折→钩子，每场一个明确节拍',
    });
  } else if (count === 2) {
    issues.push({
      severity: 'mid',
      type: 'too_few_scenes',
      evidence: lang === 'en' ? `Only ${count} scenes — pacing too flat for short drama` : `仅${count}个场景——短剧节奏太平`,
      advice: lang === 'en'
        ? 'Add 1-2 more scene breaks to create rhythm: location/time/emotion shift'
        : '再加1-2个场景切换制造节奏：地点/时间/情绪转折',
    });
  } else if (count > 7) {
    issues.push({
      severity: 'mid',
      type: 'too_many_scenes',
      evidence: lang === 'en' ? `${count} scenes — too fragmented, each scene too short to land` : `${count}个场景——太碎，每场太短打不出力度`,
      advice: lang === 'en'
        ? 'Merge minor scenes, keep 3-5 core scenes, give each enough space to develop'
        : '合并次要场景，保留3-5个核心场，给每场足够展开空间',
    });
  }

  // 2. 静态场景（无冲突无转折）
  if (staticCount >= 2) {
    issues.push({
      severity: 'high',
      type: 'too_many_static',
      evidence: lang === 'en' ? `${staticCount} static scenes with no conflict/turn — pure filler` : `${staticCount}个静态场景无冲突无转折——纯水时长`,
      advice: lang === 'en'
        ? 'Every scene must have conflict or turning point; cut or rewrite static scenes'
        : '每场必须有冲突或转折点；删掉或重写静态场景',
    });
  } else if (staticCount === 1) {
    issues.push({
      severity: 'mid',
      type: 'has_static',
      evidence: lang === 'en' ? `1 static scene with no conflict — risks viewer skip` : `1个静态场景无冲突——观众易跳过`,
      advice: lang === 'en'
        ? 'Add conflict or emotional shift to this scene'
        : '给该场景加入冲突或情绪转折',
    });
  }

  // 3. 碎片场景
  if (fragmentCount >= 2) {
    issues.push({
      severity: 'mid',
      type: 'too_many_fragments',
      evidence: lang === 'en' ? `${fragmentCount} fragment scenes (<3 lines) — too brief to land` : `${fragmentCount}个碎片场景（不足3行）——太短打不出力度`,
      advice: lang === 'en'
        ? 'Merge fragments or expand them to at least 3-4 effective lines'
        : '合并碎片场景或扩展到至少3-4个有效行',
    });
  }

  // 4. 拖沓场景
  if (draggingCount >= 1) {
    issues.push({
      severity: 'mid',
      type: 'dragging_scene',
      evidence: lang === 'en' ? `${draggingCount} scene(s) over 40% of script with low conflict — pacing drag` : `${draggingCount}个场景占比超40%且冲突低——节奏拖沓`,
      advice: lang === 'en'
        ? 'Split dragging scenes or add conflict to break monotony'
        : '拆分拖沓场景或加入冲突打破单调',
    });
  }

  // 5. 长度极度不均
  if (maxSceneRatio > 0.6) {
    issues.push({
      severity: 'mid',
      type: 'length_imbalance',
      evidence: lang === 'en' ? `Longest scene takes ${Math.round(maxSceneRatio * 100)}% of script — extreme imbalance` : `最长场景占全文${Math.round(maxSceneRatio * 100)}%——极度不均`,
      advice: lang === 'en'
        ? 'Split the mega-scene or merge smaller scenes to balance'
        : '拆分超长场景或合并小场景以平衡',
    });
  }

  // 6. 无跨场情绪推进
  if (!hasEmotionProgression && count >= 3) {
    issues.push({
      severity: 'mid',
      type: 'no_emotion_progression',
      evidence: lang === 'en' ? 'All scenes share same emotional tone — no progression' : '所有场景情绪同一基调——无推进',
      advice: lang === 'en'
        ? 'Vary emotional tone across scenes: suppress→burst→release, or angst→payoff'
        : '各场情绪要有变化：憋屈→爆发→释放，或委屈→反击→爽感',
    });
  }

  // 7. 全台词墙
  const wallScenes = scenes.filter((s) => s.lineCount > 0 && s.dialogueRatio > 0.85);
  if (wallScenes.length >= 2) {
    issues.push({
      severity: 'low',
      type: 'dialogue_wall',
      evidence: lang === 'en' ? `${wallScenes.length} scenes are >85% dialogue — no breathing room` : `${wallScenes.length}个场景对白占比超85%——无呼吸感`,
      advice: lang === 'en'
        ? 'Insert action/expression lines between dialogue to create rhythm'
        : '在对白间插入动作/神态行制造呼吸感',
    });
  }

  return {
    score,
    scenes: scenes.map((s) => ({
      ...s,
      header: s.header.slice(0, 40),
    })),
    count,
    lengthDistribution,
    staticCount,
    fragmentCount,
    draggingCount,
    maxSceneRatio,
    avgSceneLength,
    lengthStdDev,
    hasEmotionProgression,
    issues,
  };
}
