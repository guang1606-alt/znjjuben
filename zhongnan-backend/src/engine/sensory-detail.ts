import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * v2.80 感官细节密度（Sensory Detail Density）
 * ------------------------------------------------------------------
 * 创作能力类引擎：AI 剧本通病是"只有画面、没有声音气味触感味道"。
 * 检测**叙述行**（非台词）中五感意象的覆盖度与非视觉感官占比，
 * 定向建议 polisher 补具体的听/触/嗅/味细节，让场景可听可闻可触。
 *
 * 查重分工：
 *  - narrative-craft(filter)：检测并要求**删掉**"看到/听到/感觉到"这类感官滤镜词；
 *  - show-dont-tell：检测情绪直说/抽象形容；
 *  - 本引擎：检测**直接感官意象**（要**加**），统计五感维度覆盖与非视觉密度。
 *    两者一删一加，互不冲突。
 *
 * 检测范围：仅叙述行（舞台说明/动作/场景描写），跳过"角色：台词"行。
 * 评分：
 *  - 覆盖分（60）：命中感官维度数，视觉为基线，重点奖励听/触/嗅/味；
 *  - 非视觉密度分（40）：非视觉感官词数 / 叙述句数，达标满分。
 *
 * 零 LLM、零 IO；中英双语；zh 词表 includes，en 词表 \b 词界；en 层零中文。
 */

export type SenseKind = 'sight' | 'sound' | 'touch' | 'smell' | 'taste';

export interface SensoryResult {
  score: number;
  /** 命中的感官维度 */
  covered: SenseKind[];
  /** 缺失的非视觉感官维度（用于定向补写） */
  missing: SenseKind[];
  counts: Record<SenseKind, number>;
  /** 非视觉感官词总数 */
  nonVisualCount: number;
  narrationSentences: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

// 直接感官意象词（具体可感知），非滤镜词
const SIGHT_ZH = ['光', '影', '红', '蓝', '白', '黑', '亮', '暗', '闪', '刺眼', '斑驳', '轮廓', '色'];
const SIGHT_EN = ['light', 'shadow', 'red', 'blue', 'white', 'black', 'bright', 'dark', 'glow', 'flash', 'dim', 'silhouette', 'color', 'colour'];

const SOUND_ZH = ['响', '声', '轰', '嗡', '咔', '吱', '砰', '哗', '嘶', '啼', '鸣', '叫', '哭', '笑', '喘', '咯吱', '哐', '铛', '叮', '咚', '呜咽', '呼啸'];
const SOUND_EN = ['sound', 'noise', 'ring', 'bang', 'crash', 'creak', 'squeak', 'hum', 'buzz', 'roar', 'whisper', 'sob', 'pant', 'echo', 'thud', 'clang', 'howl', 'rustle'];

const TOUCH_ZH = ['烫', '冰', '冷', '热', '温', '凉', '粗糙', '光滑', '湿', '黏', '硬', '软', '刺', '麻', '疼', '痛', '滚烫', '冰凉', '硌', '痒'];
const TOUCH_EN = ['hot', 'cold', 'warm', 'cool', 'rough', 'smooth', 'wet', 'sticky', 'hard', 'soft', 'sharp', 'numb', 'sore', 'burning', 'freezing', 'damp', 'itch'];

const SMELL_ZH = ['香', '臭', '腥', '气味', '味道', '芬芳', '腐', '焦', '呛', '霉', '腥甜', '幽香', '浓香'];
const SMELL_EN = ['smell', 'scent', 'odor', 'odour', 'fragrance', 'stink', 'reek', 'stench', 'aroma', 'perfume', 'musty', 'pungent'];

const TASTE_ZH = ['甜', '苦', '酸', '辣', '咸', '涩', '腥', '麻', '鲜', '甘', '味蕾', '口苦', '甘甜'];
const TASTE_EN = ['sweet', 'bitter', 'sour', 'spicy', 'salty', 'savory', 'tangy', 'metallic', 'taste', 'flavor', 'flavour'];

const LEX: Record<SenseKind, { zh: string[]; en: string[] }> = {
  sight: { zh: SIGHT_ZH, en: SIGHT_EN },
  sound: { zh: SOUND_ZH, en: SOUND_EN },
  touch: { zh: TOUCH_ZH, en: TOUCH_EN },
  smell: { zh: SMELL_ZH, en: SMELL_EN },
  taste: { zh: TASTE_ZH, en: TASTE_EN },
};

const ALL_KINDS: SenseKind[] = ['sight', 'sound', 'touch', 'smell', 'taste'];
const NON_VISUAL: SenseKind[] = ['sound', 'touch', 'smell', 'taste'];

/** 提取叙述行：跳过场景头与"角色：台词"行，保留动作/环境描写 */
function extractNarration(draft: string): string[] {
  const out: string[] = [];
  for (const raw of draft.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (isSceneHeaderLine(line)) continue; // c213：收口共享切分器
    // 台词行
    if (/^[^\s：:]{1,12}\s*[：:]/.test(line)) continue;
    // 纯舞台提示括号行也算叙述（动作）
    out.push(line.replace(/^[（(\[△\s]+|[）)\]]+$/g, ''));
  }
  return out;
}

function countSense(text: string, kind: SenseKind, isZh: boolean): number {
  const words = isZh ? LEX[kind].zh : LEX[kind].en;
  if (isZh) {
    let n = 0;
    for (const w of words) if (text.includes(w)) n++;
    return n;
  }
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of words) if (new RegExp(`\\b${w}\\b`).test(lower)) n++;
  return n;
}

export function sensoryDetail(draft: string): SensoryResult {
  const emptyCounts: Record<SenseKind, number> = { sight: 0, sound: 0, touch: 0, smell: 0, taste: 0 };
  if (!draft || !draft.trim()) {
    return { score: 100, covered: [], missing: [...NON_VISUAL], counts: emptyCounts, nonVisualCount: 0, narrationSentences: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const narrationLines = extractNarration(draft);
  const narration = narrationLines.join(' ');
  const sentences = narration.split(/[。！？!?；;\n]+/).map((s) => s.trim()).filter((s) => s.length >= 4);
  const sentenceCount = sentences.length || 1;

  const counts: Record<SenseKind, number> = { ...emptyCounts };
  for (const k of ALL_KINDS) counts[k] = countSense(narration, k, isZh);

  const covered = ALL_KINDS.filter((k) => counts[k] > 0);
  const missing = NON_VISUAL.filter((k) => counts[k] === 0);
  const nonVisualCount = NON_VISUAL.reduce((a, k) => a + counts[k], 0);

  // 覆盖分（60）：视觉 12 + 每个非视觉感官 12
  const nonVisualCovered = NON_VISUAL.filter((k) => counts[k] > 0).length;
  const coverageScore = (counts.sight > 0 ? 12 : 0) + nonVisualCovered * 12;
  // 非视觉密度分（40）：期望每 3 句叙述至少 1 个非视觉感官词
  const density = nonVisualCount / sentenceCount;
  const densityScore = Math.min(40, Math.round(density * 120));
  const score = Math.max(0, Math.min(100, coverageScore + densityScore));

  const senseNameZh: Record<SenseKind, string> = { sight: '视觉', sound: '听觉', touch: '触觉', smell: '嗅觉', taste: '味觉' };
  const senseNameEn: Record<SenseKind, string> = { sight: 'sight', sound: 'sound', touch: 'touch', smell: 'smell', taste: 'taste' };

  const issues = missing.map((k) =>
    isZh
      ? `叙述缺少${senseNameZh[k]}细节（全文无直接${senseNameZh[k]}意象）`
      : `Narration lacks ${senseNameEn[k]} detail (no direct ${senseNameEn[k]} imagery)`,
  );

  const advice = isZh
    ? missing.length > 0
      ? `补${missing.map((k) => senseNameZh[k]).join('/')}细节：每个关键场景至少给一个具体可感的非视觉意象（环境声、温度质感、气味、味道），用名词+动词，别用"听到/闻到"滤镜词。`
      : '五感覆盖充分，保持非视觉感官的具体度。'
    : missing.length > 0
      ? `Add ${missing.map((k) => senseNameEn[k]).join('/')} detail: give each key scene at least one concrete non-visual image (ambient sound, texture/temperature, smell, taste) using nouns+verbs, not "heard/smelled" filter words.`
      : 'Five senses well covered; keep the non-visual imagery concrete.';

  return { score, covered, missing, counts, nonVisualCount, narrationSentences: sentences.length, issues, advice };
}

/**
 * 前置教学：buildSensoryDetailDirective(_format='LIVE', lang='zh')
 * ----------------------------------------------------------------
 * 同源铁律：教学函数与检测器 sensoryDetail 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"叙述要可听可闻可触"的检测口径，避免写完被
 *       prePolish sensoryHint 与 craft/deai 复评打回。
 */
export function buildSensoryDetailDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Sensory Detail Pre-Writing Briefing (same source as sensoryDetail: five senses + coverage 60 + non-visual density 40)】',
      '- Scan scope: narration lines only. Skip scene headers and dialogue lines ("speaker 1-12 chars + colon"); bracketed action lines count as narration after stripping leading ( [ △ and trailing ) ].',
      '- Five sense dimensions and example imagery:',
      '  sight: light/shadow/glow/flash/silhouette/color.',
      '  sound: creak/thud/hum/rustle/bang/whisper/howl.',
      '  touch: hot/cold/rough/smooth/sticky/burning/freezing/itch.',
      '  smell: smell/scent/stench/musty/pungent/aroma.',
      '  taste: sweet/bitter/sour/spicy/salty/metallic/savory.',
      '- Counting rule: each distinct lexicon word counts once per dimension, not per occurrence.',
      '- Sentence split: narration split on 。！？!?；; and newlines; keep trimmed segments of length >= 4; sentence count 0 counts as 1.',
      '- Coverage score (60): sight hit = 12, plus 12 for each non-visual dimension hit (sound/touch/smell/taste).',
      '- Non-visual density score (40): min(40, round(nonVisualCount / sentenceCount x 120)) — one non-visual word every 3 sentences already maxes it.',
      '- Final score = clamp(coverage + density, 0, 100); empty draft = 100.',
      '- Division of labor: narrative-craft removes filter words (saw/heard/felt); this engine ADDS direct imagery. show-dont-tell handles stated emotion.',
      '- Pipeline consumption: prePolish injects a sensory enrichment hint when any non-visual dimension is missing; craft/deai rescan the same result.',
      '- Self-check: per key scene - is there an ambient sound, a temperature/texture, a smell or taste? Are they concrete nouns+verbs rather than filter words?',
    ].join('\n');
  }
  return [
    '【感官细节·前置教学（检测同源：sensoryDetail 五感覆盖 60 分 + 非视觉密度 40 分）】',
    '- 检测范围：只扫叙述行。跳过场头与「1-12 字说话人 + 冒号」台词行；括号动作行算叙述，先剥掉行首（(△ 与行尾 )）。',
    '- 五感维度与例词：',
    '  视觉 sight：光/影/红/蓝/亮/暗/闪/刺眼/斑驳/轮廓。',
    '  听觉 sound：响/声/轰/嗡/咔/吱/砰/哗/嘶/呜咽/呼啸。',
    '  触觉 touch：烫/冰/冷/热/凉/粗糙/光滑/湿/黏/硬/软/麻/疼/硌/痒。',
    '  嗅觉 smell：香/臭/腥/气味/味道/焦/呛/霉/腐。',
    '  味觉 taste：甜/苦/酸/辣/咸/涩/鲜/甘/味蕾。',
    '- 计数口径：同一维度内每个词表词只计 1 次（按命中词种数，不按出现次数）。',
    '- 断句口径：叙述按 。！？!?；; 与换行切句，去空白后长度 ≥4 才计入句数；句数为 0 时按 1 计。',
    '- 覆盖分（60）：视觉命中给 12；四个非视觉维度每命中一个再给 12（听/触/嗅/味）。',
    '- 非视觉密度分（40）：min(40, round(非视觉词总数 ÷ 叙述句数 × 120)) —— 平均每 3 句有 1 个非视觉词即满分。',
    '- 总分 = clamp(覆盖分 + 密度分, 0, 100)；空稿满分 100。',
    '- 分工：narrative-craft 要求删「看到/听到/感觉到」滤镜词，本引擎要求加直接意象，一删一加不冲突；show-dont-tell 管情绪直说。',
    '- pipeline 消费：prePolish 在任一非视觉维度缺失时注入感官补写提示；craft/deai 用同一结果复评。',
    '- 成稿自查：每个关键场景 —— 有没有环境声？温度或质感？气味或味道？是不是具体名词+动词而不是滤镜词？',
  ].join('\n');
}
