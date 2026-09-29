/**
 * 场景标题规范检测器（PRD 2.1.22 短剧格式生死线）
 * ------------------------------------------------------------------
 * 短剧制作（尤其 AIGC 批量制作）的常见痛点：
 *  1) 场景标题格式混乱：同一剧本混用「场景1」「第一场」「【场景1】」多种格式
 *  2) 场景编号不连续：跳号、重号、乱序，导致后期制作与镜头管理混乱
 *  3) 场景标题重复：完全相同的标题（含地点+时间）出现多次
 *  4) 地点信息缺失：只写「内景」「外景」不写具体地点
 *  5) 时间标注缺失：未标注日/夜/晨/晚
 *  6) 场景标题过长：标题应简洁（≤30字），过长说明混入了描述
 *  7) 场景标题过短：仅「场景」二字无编号无地点
 *  8) 格式不一致：前半用 LIVE 格式，后半用 AIGC 格式
 *
 * 现有引擎覆盖：
 *  - script-format.ts: 只检测"是否有场景信息"，不检查规范
 *  - scene-density-score.ts: 检测场景密度/长度/对白比，不检查标题规范
 *  - information-density-score.ts: 检测信息推进，不检查标题规范
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

export type ShcLang = 'zh' | 'en';

export interface SceneHeaderIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 单个场景标题信息 */
export interface SceneHeaderInfo {
  /** 行号（0-based） */
  lineIndex: number;
  /** 原文行 */
  raw: string;
  /** 提取的场景编号（无则 -1） */
  number: number;
  /** 提取的地点（无则空字符串） */
  location: string;
  /** 提取的时间标注（无则空字符串） */
  timeOfDay: string;
  /** 识别的格式：live_cn / aigc_cn / bare_cn（内景/外景 开头，AIGC 通用，无编号要求）/ en / unknown */
  format: 'live_cn' | 'aigc_cn' | 'bare_cn' | 'en' | 'unknown';
  /** 标题长度（字符数） */
  length: number;
  /** 是否合规 */
  valid: boolean;
  /** 该标题的不合规原因（多个用分号分隔） */
  reasons: string;
}

export interface SceneHeaderResult {
  /** 场景标题规范分 0-100（越高越好） */
  score: number;
  /** 场景标题总数 */
  totalHeaders: number;
  /** 解析出的标题列表 */
  headers: SceneHeaderInfo[];
  /** 主导格式（出现次数最多的格式） */
  dominantFormat: 'live_cn' | 'aigc_cn' | 'bare_cn' | 'en' | 'unknown';
  /** 格式不一致的标题数 */
  inconsistentFormatCount: number;
  /** 编号缺失的标题数 */
  missingNumberCount: number;
  /** 编号不连续的标题数 */
  discontinuousCount: number;
  /** 地点缺失的标题数 */
  missingLocationCount: number;
  /** 时间标注缺失的标题数 */
  missingTimeCount: number;
  /** 标题过长的标题数 */
  tooLongCount: number;
  /** 重复标题对数 */
  duplicatePairCount: number;
  /** 编号是否连续 */
  hasContinuousNumbering: boolean;
  /** 是否所有标题格式一致 */
  hasConsistentFormat: boolean;
  issues: SceneHeaderIssue[];
}

// —— 场景标题识别正则（综合所有引擎的识别模式） ——
// 中文 LIVE 格式：场景 1：地点·时间 / 场景1：地点 / 第一场：地点·时间 / 场景一：地点
const SCENE_HEADER_LIVE_CN = /^(场景|第\s*[一二三四五六七八九十百千\d]+\s*场)\s*\d*\s*[:：]\s*\S/;
// 中文 AIGC 格式：【场景1】【第一场】
const SCENE_HEADER_AIGC_CN = /^【\s*(场景|第\s*[一二三四五六七八九十百千\d]+\s*场)/;
// 英文格式：INT./EXT./FADE IN/CUT TO/SCENE 1
const SCENE_HEADER_EN = /^(INT\.|EXT\.|FADE|CUT TO|SCENE\b|INTERIOR|EXTERIOR)/i;
// 通用的中文场景标识（更宽松，用于识别"内景/外景/场景"开头的场头行）
const SCENE_LIKE_CN = /^(场景|第\s*[一二三四五六七八九十百千\d]+\s*场|内景|外景)/;

/** 时间标注关键词 */
const TIME_OF_DAY_ZH = /(日|夜|晨|晚|黄昏|清晨|深夜|傍晚|拂晓|上午|下午)/;
const TIME_OF_DAY_EN = /\b(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|SUNSET|SUNRISE)\b/i;

/** 内外景标识（用于判断地点信息是否仅含内外景而无具体地点） */
const INDOOR_OUTDOOR_ZH = /^(内景|外景|室内|室外|内外景)$/;
const INDOOR_OUTDOOR_EN = /^(INT\.?|EXT\.?|INTERIOR|EXTERIOR)$/i;

function isSceneHeader(line: string, lang: ShcLang): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (lang === 'en') return SCENE_HEADER_EN.test(trimmed) || /^\[Scene/i.test(trimmed);
  return SCENE_HEADER_LIVE_CN.test(trimmed) || SCENE_HEADER_AIGC_CN.test(trimmed) || SCENE_LIKE_CN.test(trimmed);
}

/** 中文数字转阿拉伯数字 */
function cnToNumber(cn: string): number {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000, '零': 0,
  };
  // 简单转换：仅支持 1-99
  if (/^十$/.test(cn)) return 10;
  if (/^十[一二三四五六七八九]$/.test(cn)) return 10 + map[cn[1]];
  if (/^[一二三四五六七八九]十$/.test(cn)) return map[cn[0]] * 10;
  if (/^[一二三四五六七八九]十[一二三四五六七八九]$/.test(cn)) return map[cn[0]] * 10 + map[cn[2]];
  if (/^[一二三四五六七八九]$/.test(cn)) return map[cn];
  // 阿拉伯数字
  const n = parseInt(cn, 10);
  return isNaN(n) ? -1 : n;
}

/** 从场景标题中提取编号 */
function extractNumber(header: string, lang: ShcLang): number {
  // 匹配 "场景 1" "场景1" "第一场" "【场景1】" "Scene 1" "SCENE 1" "INT." (无编号)
  // 先尝试中文数字
  const cnMatch = header.match(/第\s*([一二三四五六七八九十百千\d]+)\s*场/);
  if (cnMatch) {
    const n = cnToNumber(cnMatch[1]);
    if (n !== -1) return n;
  }
  // 尝试"场景 N"或"场景N"
  const sceneNumMatch = header.match(/场景\s*(\d+)/);
  if (sceneNumMatch) return parseInt(sceneNumMatch[1], 10);
  // 尝试英文 "Scene N" "SCENE N"
  const enMatch = header.match(/Scene\s*(\d+)/i);
  if (enMatch) return parseInt(enMatch[1], 10);
  return -1;
}

/** 从场景标题中提取地点信息 */
function extractLocation(header: string, lang: ShcLang): string {
  // 中文：去掉"场景X："或"场景 X："或"【场景X】"或"第一场："前缀
  let cleaned = header
    .replace(/^【?\s*(?:场景|第\s*[一二三四五六七八九十百千\d]+\s*场)\s*\d*\s*[:：\]】]?/i, '')
    .replace(/^(?:INT\.|EXT\.|FADE(?:\s+IN)?|CUT\s+TO|SCENE\b|INTERIOR|EXTERIOR)\s*[:#]?\s*/i, '')
    .replace(/^[-\s·]+/, '')
    .trim();
  // 去掉时间标注
  const timeRe = lang === 'en' ? TIME_OF_DAY_EN : TIME_OF_DAY_ZH;
  cleaned = cleaned.replace(timeRe, '').replace(/[·\-\|\s]+$/g, '').trim();
  // 去掉末尾的·或-或|
  cleaned = cleaned.replace(/[·\-\|]+$/g, '').trim();
  return cleaned;
}

/** 从场景标题中提取时间标注 */
function extractTimeOfDay(header: string, lang: ShcLang): string {
  const timeRe = lang === 'en' ? TIME_OF_DAY_EN : TIME_OF_DAY_ZH;
  const m = header.match(timeRe);
  return m ? m[0] : '';
}

/** 识别场景标题的格式类型 */
function detectFormat(header: string, lang: ShcLang): 'live_cn' | 'aigc_cn' | 'bare_cn' | 'en' | 'unknown' {
  if (lang === 'en' || SCENE_HEADER_EN.test(header)) return 'en';
  if (SCENE_HEADER_AIGC_CN.test(header)) return 'aigc_cn';
  if (SCENE_HEADER_LIVE_CN.test(header)) return 'live_cn';
  // v2.157 bare_cn：「内景/外景 地点·时间」是 AIGC 制作本通用场头格式（aigc-screenplay SCENE_HEAD_RE 口径），
  // 此前判 unknown 会误伤合规场头（物料 headerRate 对 AIGC 制式恒低）；bare_cn 无编号要求，与 en 同权。
  if (/^(内景|外景|室内|室外)\s*\S/.test(header)) return 'bare_cn';
  return 'unknown';
}

/** 检测"看起来像场景但格式不标准"的行（用于发现遗漏的场景） */
// v2.158 修复死代码：旧实现复用 SCENE_LIKE_CN/EN（与 isSceneHeader 同一信号集），
// isSceneLike ⇒ isSceneHeader 恒真 → non_standard_scene_header 检测从未触发过。
// 新信号：时间词打头或结尾的短行（如「教室 日」「深夜 天台」「ALLEY - NIGHT」）——
// 像场头但缺内外景/编号结构；含冒号视为台词行排除，长度封顶防误伤旁白长句。
const TIME_ZH = '日|夜|晨|晚|清晨|深夜|黄昏|傍晚|拂晓|上午|下午|午夜|凌晨';
const SCENE_LIKE_CN_NEW = [
  new RegExp(`^(?:${TIME_ZH})\\s*[·\\s—\\-]\\s*\\S{1,12}$`),
  new RegExp(`^\\S{1,12}\\s*[·\\s—\\-]\\s*(?:${TIME_ZH})$`),
];
const TIME_EN = 'DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|SUNSET|SUNRISE';
const SCENE_LIKE_EN_NEW = [
  new RegExp(`^(?:${TIME_EN})\\b\\s*[-–—]\\s*\\S{1,20}$`, 'i'),
  new RegExp(`^\\S{1,20}\\s*[-–—]\\s*(?:${TIME_EN})\\b$`, 'i'),
];
function isSceneLike(line: string, lang: ShcLang): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > (lang === 'en' ? 40 : 20)) return false;
  if (/[：:]/.test(trimmed)) return false; // 含冒号按台词/键值行排除
  if (lang === 'en') return !SCENE_HEADER_EN.test(trimmed) && SCENE_LIKE_EN_NEW.some((re) => re.test(trimmed));
  return !SCENE_HEADER_LIVE_CN.test(trimmed) && !SCENE_HEADER_AIGC_CN.test(trimmed) && SCENE_LIKE_CN_NEW.some((re) => re.test(trimmed));
}

function detectLang(text: string): ShcLang {
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  const en = (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
  return en > cjk ? 'en' : 'zh';
}

export function sceneHeaderConvention(text: string, langInput?: ShcLang): SceneHeaderResult {
  const lang: ShcLang = langInput ?? detectLang(text);
  // c213：英文标准场头（INT. OLD APARTMENT HALLWAY - NIGHT）天然比中文长，
  // 阈值语种化：英文 60 字符、中文 30 字；不可用单一 30 误报规范英文场头。
  const MAX_HEADER_LEN = lang === 'en' ? 60 : 30;
  const lines = text.split('\n');
  const headers: SceneHeaderInfo[] = [];

  // 第一遍：扫描所有场景标题行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isSceneHeader(line, lang)) continue;
    const raw = line.trim();
    const format = detectFormat(raw, lang);
    const number = extractNumber(raw, lang);
    const location = extractLocation(raw, lang);
    const timeOfDay = extractTimeOfDay(raw, lang);
    const length = raw.length;

    // 验证合规性（en/bare_cn 格式无编号要求，不因缺编号判违——与 missingNumberCount 口径一致）
    const noNumberRequired = format === 'en' || format === 'bare_cn';
    const reasons: string[] = [];
    if (format === 'unknown') reasons.push('format_unknown');
    if (number === -1 && !noNumberRequired) reasons.push('missing_number');
    if (!location || INDOOR_OUTDOOR_ZH.test(location) || INDOOR_OUTDOOR_EN.test(location)) {
      reasons.push('missing_location');
    }
    if (!timeOfDay) reasons.push('missing_time');
    if (length > MAX_HEADER_LEN) reasons.push('too_long');
    if (length < 4) reasons.push('too_short');

    headers.push({
      lineIndex: i,
      raw,
      number,
      location,
      timeOfDay,
      format,
      length,
      valid: reasons.length === 0,
      reasons: reasons.join(';'),
    });
  }

  // 分析
  const issues: SceneHeaderIssue[] = [];
  const totalHeaders = headers.length;

  // 1. 主导格式统计
  const formatCounts: Record<string, number> = {};
  for (const h of headers) {
    formatCounts[h.format] = (formatCounts[h.format] || 0) + 1;
  }
  let dominantFormat: 'live_cn' | 'aigc_cn' | 'bare_cn' | 'en' | 'unknown' = 'unknown';
  let maxCount = 0;
  for (const [fmt, cnt] of Object.entries(formatCounts)) {
    if (cnt > maxCount) {
      maxCount = cnt;
      dominantFormat = fmt as 'live_cn' | 'aigc_cn' | 'bare_cn' | 'en' | 'unknown';
    }
  }

  // 2. 格式不一致检测
  const inconsistentFormatCount = headers.filter((h) => h.format !== dominantFormat && h.format !== 'unknown').length;
  const hasConsistentFormat = inconsistentFormatCount === 0;
  if (inconsistentFormatCount >= 2) {
    const offenders = headers.filter((h) => h.format !== dominantFormat && h.format !== 'unknown').slice(0, 3);
    issues.push({
      severity: inconsistentFormatCount >= 4 ? 'high' : 'mid',
      type: 'inconsistent_format',
      evidence: lang === 'en'
        ? `${inconsistentFormatCount} headers use non-dominant format (${dominantFormat}): ${offenders.map((o) => `L${o.lineIndex + 1}=${o.format}`).join(', ')}`
        : `${inconsistentFormatCount}个标题使用非主导格式(${dominantFormat})：${offenders.map((o) => `L${o.lineIndex + 1}=${o.format}`).join(', ')}`,
      advice: lang === 'en'
        ? `All scene headers should use the same format. Dominant format: ${dominantFormat}. Fix ${inconsistentFormatCount} inconsistent headers.`
        : `全剧场景标题应统一为同一种格式。当前主导格式：${dominantFormat}，需修正 ${inconsistentFormatCount} 个不一致标题`,
    });
  }

  // 3. 编号缺失检测（英文 INT./EXT. 与中文 bare_cn「内景/外景 地点」格式不要求编号，跳过）
  const missingNumberCount = headers.filter((h) => h.number === -1 && h.format !== 'en' && h.format !== 'bare_cn').length;
  if (missingNumberCount > 0) {
    const offenders = headers.filter((h) => h.number === -1 && h.format !== 'en' && h.format !== 'bare_cn').slice(0, 3);
    issues.push({
      severity: missingNumberCount >= 3 ? 'high' : 'mid',
      type: 'missing_number',
      evidence: lang === 'en'
        ? `${missingNumberCount} headers missing numbers: ${offenders.map((o) => `L${o.lineIndex + 1}="${o.raw.slice(0, 20)}"`).join(', ')}`
        : `${missingNumberCount}个场景标题缺编号：${offenders.map((o) => `L${o.lineIndex + 1}="${o.raw.slice(0, 20)}"`).join(', ')}`,
      advice: lang === 'en'
        ? `Each scene header must have a sequential number (e.g., "Scene 1:", "INT. ..."). ${missingNumberCount} headers missing numbers.`
        : `每个场景标题应有连续编号（如"场景1："、"第一场："）。${missingNumberCount} 个标题缺编号`,
    });
  }

  // 4. 编号连续性检测
  const numberedHeaders = headers.filter((h) => h.number !== -1);
  let discontinuousCount = 0;
  let prevNum = 0;
  const discontinuousGaps: string[] = [];
  for (const h of numberedHeaders) {
    if (h.number !== prevNum + 1 && prevNum > 0) {
      discontinuousCount++;
      discontinuousGaps.push(`L${h.lineIndex + 1}=#${h.number}(应=${prevNum + 1})`);
    }
    prevNum = h.number;
  }
  const hasContinuousNumbering = discontinuousCount === 0;
  if (discontinuousCount >= 1) {
    issues.push({
      severity: discontinuousCount >= 3 ? 'high' : 'mid',
      type: 'discontinuous_numbering',
      evidence: lang === 'en'
        ? `${discontinuousCount} discontinuous numbering: ${discontinuousGaps.slice(0, 4).join(', ')}`
        : `${discontinuousCount}处编号不连续：${discontinuousGaps.slice(0, 4).join(', ')}`,
      advice: lang === 'en'
        ? `Scene numbers must be sequential (1, 2, 3...). Found ${discontinuousCount} gaps.`
        : `场景编号必须连续递增（1, 2, 3...）。发现 ${discontinuousCount} 处跳号或重号`,
    });
  }

  // 5. 地点缺失检测
  const missingLocationCount = headers.filter((h) => !h.location || INDOOR_OUTDOOR_ZH.test(h.location) || INDOOR_OUTDOOR_EN.test(h.location)).length;
  if (missingLocationCount > 0) {
    const offenders = headers.filter((h) => !h.location || INDOOR_OUTDOOR_ZH.test(h.location) || INDOOR_OUTDOOR_EN.test(h.location)).slice(0, 3);
    issues.push({
      severity: missingLocationCount >= 3 ? 'high' : 'mid',
      type: 'missing_location',
      evidence: lang === 'en'
        ? `${missingLocationCount} headers lack specific location: ${offenders.map((o) => `L${o.lineIndex + 1}="${o.raw.slice(0, 25)}"`).join(', ')}`
        : `${missingLocationCount}个标题地点信息不具体：${offenders.map((o) => `L${o.lineIndex + 1}="${o.raw.slice(0, 25)}"`).join(', ')}`,
      advice: lang === 'en'
        ? `Scene headers should specify concrete location (e.g., "INT. BEDROOM - DAY"), not just "INT.". ${missingLocationCount} headers need location detail.`
        : `场景标题应写明具体地点（如"内景·卧室·日"），不能只写"内景"。${missingLocationCount} 个标题需补充地点`,
    });
  }

  // 6. 时间标注缺失检测
  const missingTimeCount = headers.filter((h) => !h.timeOfDay).length;
  if (missingTimeCount > 0) {
    const offenders = headers.filter((h) => !h.timeOfDay).slice(0, 3);
    issues.push({
      severity: missingTimeCount >= 3 ? 'mid' : 'low',
      type: 'missing_time',
      evidence: lang === 'en'
        ? `${missingTimeCount} headers missing time of day: ${offenders.map((o) => `L${o.lineIndex + 1}="${o.raw.slice(0, 25)}"`).join(', ')}`
        : `${missingTimeCount}个标题缺时间标注：${offenders.map((o) => `L${o.lineIndex + 1}="${o.raw.slice(0, 25)}"`).join(', ')}`,
      advice: lang === 'en'
        ? `Scene headers should include time of day (DAY/NIGHT/DAWN/DUSK). ${missingTimeCount} headers missing time annotation.`
        : `场景标题应标注时间（日/夜/晨/晚/黄昏）。${missingTimeCount} 个标题缺时间标注`,
    });
  }

  // 7. 标题过长检测（阈值语种化：英文 60 字符 / 中文 30 字）
  const tooLongCount = headers.filter((h) => h.length > MAX_HEADER_LEN).length;
  if (tooLongCount > 0) {
    const offenders = headers.filter((h) => h.length > MAX_HEADER_LEN).slice(0, 2);
    issues.push({
      severity: tooLongCount >= 3 ? 'mid' : 'low',
      type: 'too_long_header',
      evidence: lang === 'en'
        ? `${tooLongCount} headers too long (>${MAX_HEADER_LEN} chars): ${offenders.map((o) => `L${o.lineIndex + 1}(${o.length} chars)`).join(', ')}`
        : `${tooLongCount}个标题过长(>${MAX_HEADER_LEN}字)：${offenders.map((o) => `L${o.lineIndex + 1}(${o.length}字)`).join(', ')}`,
      advice: lang === 'en'
        ? `Scene headers should be concise (≤${MAX_HEADER_LEN} chars). Excessively long headers mix description into the title. ${tooLongCount} headers too long.`
        : `场景标题应简洁（≤${MAX_HEADER_LEN}字）。过长说明混入了场景描述，应拆分。${tooLongCount} 个标题过长`,
    });
  }

  // 8. 标题重复检测（地点+时间组合相同）
  const titleKeyMap: Record<string, number> = {};
  for (const h of headers) {
    const key = `${h.location}|${h.timeOfDay}`;
    if (!key || key === '|') continue;
    titleKeyMap[key] = (titleKeyMap[key] || 0) + 1;
  }
  const duplicatePairCount = Object.values(titleKeyMap).filter((c) => c > 1).reduce((sum, c) => sum + c - 1, 0);
  if (duplicatePairCount >= 2) {
    const dupTitles = Object.entries(titleKeyMap).filter(([, c]) => c > 1).slice(0, 2);
    issues.push({
      severity: duplicatePairCount >= 4 ? 'mid' : 'low',
      type: 'duplicate_header',
      evidence: lang === 'en'
        ? `${duplicatePairCount} duplicate headers: ${dupTitles.map(([k, c]) => `"${k.split('|')[0]}"x${c}`).join(', ')}`
        : `${duplicatePairCount}对重复标题：${dupTitles.map(([k, c]) => `"${k.split('|')[0]}"×${c}`).join(', ')}`,
      advice: lang === 'en'
        ? `Avoid exact duplicate scene headers (same location + time). ${duplicatePairCount} duplicates found.`
        : `避免完全相同的场景标题（地点+时间相同）。发现 ${duplicatePairCount} 对重复`,
    });
  }

  // 9. 总场景标题数过少检测
  if (totalHeaders === 0) {
    issues.push({
      severity: 'high',
      type: 'no_scene_headers',
      evidence: lang === 'en' ? 'No scene headers detected' : '未识别到任何场景标题',
      advice: lang === 'en'
        ? 'No scene headers detected. A short drama script must have at least 2 scene headers (e.g., "Scene 1: ...", "INT. ...").'
        : '未识别到任何场景标题。短剧剧本至少应有 2 个场景标题（如"场景1："、"内景·卧室·日"）',
    });
  } else if (totalHeaders === 1) {
    issues.push({
      severity: 'mid',
      type: 'only_one_scene',
      evidence: lang === 'en' ? 'Only 1 scene header detected' : '仅有1个场景标题',
      advice: lang === 'en'
        ? 'Only 1 scene header detected. Short dramas typically need 3-5 scenes for LIVE or 4-6 for AIGC.'
        : '仅有 1 个场景标题。短剧通常需要 3-5 场（LIVE）或 4-6 场（AIGC）',
    });
  }

  // 10. 检测"看起来像场景但格式不标准"的行（可能漏标的场景）
  let sceneLikeMissedCount = 0;
  const missedExamples: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isSceneHeader(lines[i], lang)) continue;
    if (isSceneLike(lines[i], lang) && lines[i].trim().length > 2) {
      sceneLikeMissedCount++;
      if (missedExamples.length < 3) {
        missedExamples.push(`L${i + 1}="${lines[i].trim().slice(0, 25)}"`);
      }
    }
  }
  if (sceneLikeMissedCount >= 2) {
    issues.push({
      severity: 'mid',
      type: 'non_standard_scene_header',
      evidence: lang === 'en'
        ? `${sceneLikeMissedCount} lines look like scene headers but non-standard format: ${missedExamples.join(', ')}`
        : `${sceneLikeMissedCount}行疑似场景标题但格式不标准：${missedExamples.join(', ')}`,
      advice: lang === 'en'
        ? `Found ${sceneLikeMissedCount} lines that look like scene headers but lack INT./EXT. structure. Promote each into a proper header (e.g., "INT. CLASSROOM - DAY") or merge into the surrounding scene; unmarked scenes break the production sheets.`
        : `发现 ${sceneLikeMissedCount} 行疑似场景标题但缺内外景结构。请补全为规范场头（中文如"场景3：教室·日"或"内景 教室·日"，英文如"INT. CLASSROOM - DAY"），或并入相邻场景——漏标场景会导致制作物料漏统计`,
    });
  }

  // —— 评分 ——
  let score = 100;
  // high 级问题扣分
  const highIssues = issues.filter((i) => i.severity === 'high');
  const midIssues = issues.filter((i) => i.severity === 'mid');
  const lowIssues = issues.filter((i) => i.severity === 'low');
  // no_scene_headers 是最严重的问题，直接扣 60 分
  const noHeaderIssue = highIssues.find((i) => i.type === 'no_scene_headers');
  if (noHeaderIssue) {
    score -= 60;
  } else {
    score -= highIssues.length * 18;
  }
  score -= midIssues.length * 8;
  score -= lowIssues.length * 3;
  // 按比例扣分（如果标题总数>0）
  if (totalHeaders > 0) {
    score -= Math.round((missingNumberCount / totalHeaders) * 10);
    score -= Math.round((inconsistentFormatCount / totalHeaders) * 10);
    score -= Math.round((missingLocationCount / totalHeaders) * 8);
    score -= Math.round((missingTimeCount / totalHeaders) * 4);
    score -= Math.round((discontinuousCount / totalHeaders) * 10);
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    totalHeaders,
    headers,
    dominantFormat,
    inconsistentFormatCount,
    missingNumberCount,
    discontinuousCount,
    missingLocationCount,
    missingTimeCount,
    tooLongCount,
    duplicatePairCount,
    hasContinuousNumbering,
    hasConsistentFormat,
    issues,
  };
}

// ==================== v2.157 场头前置教学（一次写对，省 QC retry token） ====================
// v2.125 场头规范引擎只做"生成后纠偏"（QC 重试注入 advice），三岗位初始指令此前无场头格式教学，
// 属"先错再纠"：每次 retry 都要白付一轮 token。本指令把 convention 的判分口径反向前置，
// 在生成前教会模型"什么场头能通过检测"。与 sceneHeaderConvention 同文件维护 = 教学与检测同源。
// 注意：LIVE 教「场景N：地点·时间」（live_cn 口径，带编号过 missing_number）；AIGC 教「内景/外景 地点·时间」
// （aigc-screenplay 的 SCENE_HEAD_RE 口径，改「场景N：」会导致 AIGC 五维检测 sceneCount=0）；en 教 INT./EXT.。

import type { ScriptMode } from './script-format';

export function buildSceneHeaderDirective(mode: ScriptMode = 'LIVE', lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    const live = mode === 'LIVE';
    return `[SCENE HEADER · HARD RULE] Every scene must open with a one-line header: ${live ? 'SCENE N: Location - TIME' : 'INT./EXT. Location - TIME'}. ${live ? 'N is a continuous number (SCENE 1, SCENE 2...). ' : ''}Rules: (1) the header is one line only — no action or description inside it; (2) location must be specific (never a bare INT./EXT.); (3) time of day is mandatory (DAY/NIGHT/DAWN/DUSK...) — missing time breaks the production sheets; (4) under the header come action and dialogue lines, with a blank line between scene blocks; (5) use the same header format throughout the script — never switch styles midway.`;
  }
  if (mode === 'AIGC') {
    return `【场头格式·硬约束】每个场景必须以一行场头开头，格式严格为「内景/外景 地点·时间」（如「内景 老宅厨房·日」）：①场头独占一行，只写内外景+地点+时间，不混入动作或描述；②地点必须具体（不得只写「内景」），时间标注必填（日/夜/晨/晚/黄昏等，用·与地点分隔）——缺时间会导致制作物料的场景排期失效；③场头之下为正文（△动作与台词），场与场之间以场头行切分；④全剧所有场头统一同一种格式，不得中途更换。`;
  }
  return `【场头格式·硬约束】每个场景必须以一行场头开头，格式严格为「场景N：地点·时间」（如「场景1：老宅厨房·日」）：①N为连续编号（场景1、场景2……），不跳号不重号；②场头独占一行，只写编号+地点+时间，不混入动作或描述；③地点必须具体（不得只写「内景」），时间标注必填（日/夜/晨/晚/黄昏等，用·与地点分隔）——缺时间会导致制作物料的场景排期失效；④场头之下依次为△动作行与台词行，场块之间空一行；⑤全剧所有场头统一同一种格式，不得中途更换。`;
}
