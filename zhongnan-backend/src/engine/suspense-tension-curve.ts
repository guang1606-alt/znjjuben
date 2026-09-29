/**
 * 悬念张力曲线检测器（PRD 2.1.21 短剧悬念生死线）
 * ------------------------------------------------------------------
 * 短剧的另一个致命伤是"无悬念推进"——场景有冲突、有信息，
 * 但没有让观众"想知道接下来发生什么"的张力。
 *
 * 现有引擎覆盖：
 *  - emotion-wave.ts: 事前规划的节拍情绪曲线（生成期），不检测成稿
 *  - cliffhanger-score.ts: 检测集尾钩子（结尾悬念），不看全剧张力
 *  - information-density-score.ts: 检测信息推进量（剧情层面），不看悬念张力
 *  - twist-density-score.ts: 检测反转数量（剧情层面），不看悬念张力
 *
 * 本引擎专注于：
 *  1) 单场悬念张力计算：问号/未知揭示/威胁暗示/时间压力/反转预告/神秘描述
 *  2) 张力曲线形态：上升-高潮-回落 vs 直线 vs 跳跃式
 *  3) 连续平铺：连续多场张力无起伏（"温水戏"）
 *  4) 张力极值缺失：无高潮、无低谷
 *  5) 张力跳转：张力极性突变无过渡
 *  6) 开场悬念：前 1-2 场必须有强悬念
 *  7) 收尾悬念：末场必须有强悬念或反转
 *  8) 悬念密度：悬念信号总数
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

import { isSceneHeaderLine } from './script-scenes';

export type StcLang = 'zh' | 'en';

export interface SuspenseIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 单场张力点 */
export interface TensionPoint {
  /** 场景序号（1-based） */
  sceneIndex: number;
  /** 场景标题 */
  header: string;
  /** 张力值 0-100 */
  tension: number;
  /** 悬念信号数 */
  signalCount: number;
  /** 场景在全文中的相对位置 0-1 */
  position: number;
  /** 场景字数 */
  wordCount: number;
  /** 命中的悬念类型 */
  hitTypes: string[];
}

export interface SuspenseTensionResult {
  /** 悬念张力分 0-100（越高越好） */
  score: number;
  /** 场景总数 */
  totalScenes: number;
  /** 悬念信号总数 */
  totalSignals: number;
  /** 平均每场悬念信号数 */
  avgSignalsPerScene: number;
  /** 张力曲线 */
  curve: TensionPoint[];
  /** 平均张力 */
  avgTension: number;
  /** 最高张力 */
  maxTension: number;
  /** 最低张力 */
  minTension: number;
  /** 张力极差 */
  tensionRange: number;
  /** 高潮场景序号 */
  climaxSceneIndex: number;
  /** 谷底场景序号 */
  valleySceneIndex: number;
  /** 是否有连续平铺（连续 3+ 场张力差 <10） */
  hasFlatStretch: boolean;
  /** 连续平铺起点（无则 -1） */
  flatStretchStart: number;
  /** 开场是否有强悬念（前 1-2 场张力 ≥40） */
  hasStrongOpening: boolean;
  /** 收尾是否有强悬念（末场张力 ≥50） */
  hasStrongEnding: boolean;
  /** 曲线形态：rising/falling/wave/flat/jumpy */
  curveShape: 'rising' | 'falling' | 'wave' | 'flat' | 'jumpy';
  issues: SuspenseIssue[];
}

// —— 场景切分 ——
// c213：场头判定统一走 engine/script-scenes.ts 单一事实源（历史缺陷：漏切
// AIGC「内景/外景」与英文 INT./EXT.，与 information-density 同款分裂）。
function isSceneHeader(line: string, lang: StcLang): boolean {
  return isSceneHeaderLine(line, lang);
}

function sceneWordCount(text: string, lang: StcLang): number {
  if (lang === 'en') {
    const m = text.match(/[A-Za-z][A-Za-z'-]*/g);
    return m ? Math.round(m.length * 1.67) : 0;
  }
  const m = text.match(/[一-鿿]/g);
  return m ? m.length : 0;
}

function parseScenes(text: string, lang: StcLang): { header: string; body: string }[] {
  const lines = text.split('\n');
  const scenes: { header: string; body: string }[] = [];
  let currentHeader: string | null = null;
  let currentBody: string[] = [];
  for (const line of lines) {
    if (isSceneHeader(line, lang)) {
      if (currentHeader !== null) {
        scenes.push({ header: currentHeader, body: currentBody.join('\n') });
      }
      currentHeader = line.trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeader !== null) {
    scenes.push({ header: currentHeader, body: currentBody.join('\n') });
  }
  if (scenes.length === 0) {
    scenes.push({ header: '', body: text });
  }
  return scenes;
}

// —— 悬念信号识别（六类） ——
const SUSPENSE_PATTERNS_ZH: { type: string; label: string; re: RegExp; weight: number }[] = [
  // 问号悬念（仅匹配 WH 疑问词+问号，避免"中午吃什么？"误判）
  { type: 'question', label: '问号悬念', re: /(为什么|到底|究竟|怎么会|怎么可能|是谁|是什么|在哪里|怎么办|难道)[^。]*[？?]/, weight: 10 },
  // 未知揭示
  { type: 'unknown', label: '未知揭示', re: /真相|秘密|隐藏|幕后|原来(如此)?|其实|究竟|暗中/, weight: 10 },
  // 威胁暗示
  { type: 'threat', label: '威胁暗示', re: /危险|威胁|陷阱|阴谋|暗藏|诡(异|秘)|不(简单|寻常|对劲)|有(古怪|问题)|不对(劲|头)/, weight: 8 },
  // 时间压力
  { type: 'time_pressure', label: '时间压力', re: /必须|赶紧|来不及|只有|倒计时|最后(的)?机会|马上(就|要)|立刻/, weight: 7 },
  // 反转预告
  { type: 'reversal_foreshadow', label: '反转预告', re: /然而|但是|可是|没想到|谁知|不料|岂料|偏偏/, weight: 9 },
  // 神秘描述
  { type: 'mystery', label: '神秘描述', re: /神秘|奇怪|诡异|不可思议|无法解释|匪夷所思|离奇|邪门/, weight: 6 },
];

const SUSPENSE_PATTERNS_EN: { type: string; label: string; re: RegExp; weight: number }[] = [
  { type: 'question', label: 'Question', re: /\b(why|who|what|where|when|how|how come)\b[^.]*\?/i, weight: 10 },
  { type: 'unknown', label: 'Unknown reveal', re: /\btruth\b|\bsecret\b|\bhidden\b|\bbehind\b|\bactually\b|\bturns out\b|\bthe real\b/i, weight: 10 },
  { type: 'threat', label: 'Threat hint', re: /\bdanger\b|\bthreat\b|\btrap\b|\bconspiracy\b|\bnot right\b|\bsomething wrong\b|\bsinister\b/i, weight: 8 },
  { type: 'time_pressure', label: 'Time pressure', re: /\bmust\b|\bhurry\b|\bno time\b|\bcountdown\b|\bdeadline\b|\bimmediately\b/i, weight: 7 },
  { type: 'reversal_foreshadow', label: 'Reversal foreshadow', re: /\bhowever\b|\byet\b|\bunexpectedly\b|\bnever thought\b|\bwho knew\b|\bturns out\b/i, weight: 9 },
  { type: 'mystery', label: 'Mystery', re: /\bmysterious\b|\bstrange\b|\beerie\b|\binexplicable\b|\bweird\b|\bbizarre\b/i, weight: 6 },
];

function detectSceneSuspense(body: string, lang: StcLang): { count: number; hitTypes: string[]; totalWeight: number } {
  const patterns = lang === 'en' ? SUSPENSE_PATTERNS_EN : SUSPENSE_PATTERNS_ZH;
  let count = 0;
  let totalWeight = 0;
  const hitTypes = new Set<string>();
  for (const p of patterns) {
    const matches = body.match(new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g')) || [];
    if (matches.length > 0) {
      count += matches.length;
      totalWeight += matches.length * p.weight;
      hitTypes.add(p.type);
    }
  }
  return { count, hitTypes: [...hitTypes], totalWeight };
}

/** 计算单场张力值 0-100
 *  组合三维度：数量(40) + 密度(40) + 多样性(20)
 *  避免单条信号就把短场景饱和到 100
 */
function calcTension(wordCount: number, suspense: { count: number; totalWeight: number; hitTypes: string[] }): number {
  if (wordCount === 0) return 0;
  // 数量分：1 个=5 分，10 个封顶 40 分
  const countScore = Math.min(40, suspense.count * 5);
  // 密度分：信号总权重 / 字数 × 1000，封顶 40 分
  const density = (suspense.totalWeight / wordCount) * 1000;
  const densityScore = Math.min(40, Math.round(density * 2));
  // 多样性分：每命中一类加 4 分，6 类封顶 24 分
  const varietyScore = Math.min(24, suspense.hitTypes.length * 4);
  return Math.max(0, Math.min(100, countScore + densityScore + varietyScore));
}

/** 检测连续平铺 */
function detectFlatStretch(curve: TensionPoint[]): { hasFlat: boolean; start: number } {
  if (curve.length < 3) return { hasFlat: false, start: -1 };
  for (let i = 0; i <= curve.length - 3; i++) {
    const slice = curve.slice(i, i + 3);
    const max = Math.max(...slice.map((p) => p.tension));
    const min = Math.min(...slice.map((p) => p.tension));
    if (max - min < 10) {
      return { hasFlat: true, start: slice[0].sceneIndex };
    }
  }
  return { hasFlat: false, start: -1 };
}

/** 检测曲线形态 */
function detectCurveShape(curve: TensionPoint[]): 'rising' | 'falling' | 'wave' | 'flat' | 'jumpy' {
  if (curve.length < 3) return 'flat';
  const tensions = curve.map((p) => p.tension);
  const range = Math.max(...tensions) - Math.min(...tensions);
  if (range < 15) return 'flat';
  // 检测跳跃：方向反转且单步差值 >40
  let jumpCount = 0;
  let prevDiff = 0;
  for (let i = 1; i < tensions.length; i++) {
    const diff = tensions[i] - tensions[i - 1];
    if (Math.abs(diff) > 40 && Math.sign(diff) !== Math.sign(prevDiff) && prevDiff !== 0) {
      jumpCount++;
    }
    if (diff !== 0) prevDiff = diff;
  }
  if (jumpCount >= 1) return 'jumpy';
  // 上升 vs 下降
  const first = tensions[0];
  const last = tensions[tensions.length - 1];
  const mid = tensions[Math.floor(tensions.length / 2)];
  if (last > first + 10 && mid >= first) return 'rising';
  if (last < first - 10 && mid <= first) return 'falling';
  // 检测波浪：至少有一个上升后下降
  let hasRise = false;
  let hasFall = false;
  for (let i = 1; i < tensions.length; i++) {
    if (tensions[i] > tensions[i - 1] + 5) hasRise = true;
    if (tensions[i] < tensions[i - 1] - 5) hasFall = true;
  }
  if (hasRise && hasFall) return 'wave';
  return 'flat';
}

/**
 * 主函数：评估悬念张力曲线
 * @param text 成稿全文
 * @param lang 中英文
 */
export function suspenseTensionCurve(text: string, lang: StcLang = 'zh'): SuspenseTensionResult {
  const parsed = parseScenes(text, lang);
  const total = parsed.length;
  const textLen = Math.max(1, text.length);

  const curve: TensionPoint[] = parsed.map((s, i) => {
    const wc = sceneWordCount(s.body, lang);
    const suspense = detectSceneSuspense(s.body, lang);
    const tension = calcTension(wc, suspense);
    return {
      sceneIndex: i + 1,
      header: s.header,
      tension,
      signalCount: suspense.count,
      position: Number((i / Math.max(1, total - 1)).toFixed(2)),
      wordCount: wc,
      hitTypes: suspense.hitTypes,
    };
  });

  const totalSignals = curve.reduce((s, p) => s + p.signalCount, 0);
  const avgSignalsPerScene = total > 0 ? Number((totalSignals / total).toFixed(2)) : 0;
  const tensions = curve.map((p) => p.tension);
  const avgTension = tensions.length > 0 ? Math.round(tensions.reduce((a, b) => a + b, 0) / tensions.length) : 0;
  const maxTension = tensions.length > 0 ? Math.max(...tensions) : 0;
  const minTension = tensions.length > 0 ? Math.min(...tensions) : 0;
  const tensionRange = maxTension - minTension;
  const climaxSceneIndex = curve.length > 0 ? (curve.findIndex((p) => p.tension === maxTension) + 1) : 0;
  const valleySceneIndex = curve.length > 0 ? (curve.findIndex((p) => p.tension === minTension) + 1) : 0;

  const flat = detectFlatStretch(curve);
  const hasFlatStretch = flat.hasFlat;
  const flatStretchStart = flat.start;

  // 开场悬念：前 1-2 场张力 ≥40
  const firstTwoScenes = curve.slice(0, Math.min(2, curve.length));
  const hasStrongOpening = firstTwoScenes.some((p) => p.tension >= 40);

  // 收尾悬念：末场张力 ≥50
  const lastScene = curve.length > 0 ? curve[curve.length - 1] : null;
  const hasStrongEnding = lastScene ? lastScene.tension >= 50 : false;

  const curveShape = detectCurveShape(curve);

  const issues: SuspenseIssue[] = [];
  let penalty = 0;

  // 1. 整体悬念信号过少
  if (total >= 3 && totalSignals < total) {
    issues.push({
      severity: 'mid',
      type: 'low_total_signals',
      evidence: lang === 'en'
        ? `Only ${totalSignals} suspense signals across ${total} scenes (avg ${avgSignalsPerScene}/scene)`
        : `全剧仅 ${totalSignals} 个悬念信号，分摊到 ${total} 场（均 ${avgSignalsPerScene}/场）`,
      advice: lang === 'en'
        ? 'Add suspense per scene: questions, unknown reveals, threats, time pressure, mystery'
        : '每场加悬念：问号、未知揭示、威胁暗示、时间压力、神秘描述',
    });
    penalty += 8;
  }

  // 2. 连续平铺（连续 3+ 场张力差 <10）
  if (hasFlatStretch) {
    issues.push({
      severity: 'high',
      type: 'flat_stretch',
      evidence: lang === 'en'
        ? `Scenes ${flatStretchStart}-${flatStretchStart + 2}+ have flat tension (Δ<10)`
        : `场景 ${flatStretchStart}-${flatStretchStart + 2}+ 张力平铺（差值<10）`,
      advice: lang === 'en'
        ? 'Add tension spikes: threat/time pressure/reversal foreshadow to break flat stretch'
        : '加入张力尖峰：威胁/时间压力/反转预告打破平铺',
    });
    penalty += 15;
  }

  // 3. 开场无强悬念
  if (total >= 2 && !hasStrongOpening) {
    issues.push({
      severity: 'high',
      type: 'weak_opening',
      evidence: lang === 'en'
        ? `Opening scenes tension max ${Math.max(...firstTwoScenes.map((p) => p.tension), 0)} (need ≥40)`
        : `开场张力最高 ${Math.max(...firstTwoScenes.map((p) => p.tension), 0)}（需 ≥40）`,
      advice: lang === 'en'
        ? 'Open with strong suspense: question, threat, mystery, or time pressure in scene 1-2'
        : '开场即强悬念：前 1-2 场加入问号/威胁/神秘/时间压力',
    });
    penalty += 12;
  }

  // 4. 收尾无强悬念
  if (total >= 2 && !hasStrongEnding) {
    issues.push({
      severity: 'high',
      type: 'weak_ending',
      evidence: lang === 'en'
        ? `Last scene tension ${lastScene?.tension ?? 0} (need ≥50)`
        : `末场张力 ${lastScene?.tension ?? 0}（需 ≥50）`,
      advice: lang === 'en'
        ? 'End with strong suspense: cliffhanger, threat, or unresolved question'
        : '结尾强悬念：钩子/威胁/未解之问',
    });
    penalty += 12;
  }

  // 5. 曲线形态差
  if (curveShape === 'flat' && total >= 3) {
    issues.push({
      severity: 'high',
      type: 'flat_curve',
      evidence: lang === 'en'
        ? `Tension curve is flat (range ${tensionRange})`
        : `张力曲线平铺（极差 ${tensionRange}）`,
      advice: lang === 'en'
        ? 'Build rising tension: low→mid→high across scenes, with mid-scene peak'
        : '构建上升张力：低→中→高，可在中段设高潮',
    });
    penalty += 15;
  }
  if (curveShape === 'jumpy' && total >= 3) {
    issues.push({
      severity: 'mid',
      type: 'jumpy_curve',
      evidence: lang === 'en'
        ? `Tension curve is jumpy (large sudden shifts)`
        : `张力曲线跳跃（突变过大）`,
      advice: lang === 'en'
        ? 'Smooth tension transitions: add bridging suspense between high/low scenes'
        : '平滑张力过渡：在高/低场景间加过渡悬念',
    });
    penalty += 5;
  }
  if (curveShape === 'falling' && total >= 3) {
    issues.push({
      severity: 'mid',
      type: 'falling_curve',
      evidence: lang === 'en'
        ? `Tension curve falls from ${tensions[0]} to ${tensions[tensions.length - 1]}`
        : `张力曲线下降：从 ${tensions[0]} 降至 ${tensions[tensions.length - 1]}`,
      advice: lang === 'en'
        ? 'Tension should rise toward climax; move low-tension scenes earlier'
        : '张力应向高潮上升；把低张力场景前置',
    });
    penalty += 8;
  }

  // 6. 张力极差过小（无高潮无低谷）
  if (total >= 3 && tensionRange < 20) {
    issues.push({
      severity: 'mid',
      type: 'low_range',
      evidence: lang === 'en'
        ? `Tension range only ${tensionRange} (need ≥20)`
        : `张力极差仅 ${tensionRange}（需 ≥20）`,
      advice: lang === 'en'
        ? 'Vary tension across scenes: low setup → high climax → release'
        : '各场张力要有起伏：低铺垫→高高潮→释放',
    });
    penalty += 8;
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {
    score,
    totalScenes: total,
    totalSignals,
    avgSignalsPerScene,
    curve,
    avgTension,
    maxTension,
    minTension,
    tensionRange,
    climaxSceneIndex,
    valleySceneIndex,
    hasFlatStretch,
    flatStretchStart,
    hasStrongOpening,
    hasStrongEnding,
    curveShape,
    issues,
  };
}
