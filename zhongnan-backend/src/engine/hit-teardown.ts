/**
 * hit-teardown.ts —— 拆爆款工作台引擎
 *
 * 来源方法论（2026-08-31 两条一线视频）：
 *  - 《你不写主角就没有未来》：写爆款靠的不是灵感，是“看100个故事、拆100个、改50次”的积累与复盘；
 *    人物给了生命，就要给一个“配得上颠沛一生”的结局（结局兑付、弧光闭环）。
 *  - 《第一集为什么让主角倒霉》：故事从问题开始而非人物介绍；第一集任务是让观众站到主角这边。
 *
 * 本引擎把“拆解—复盘—吸收—再创作”产品化：
 *  文本 → ①为什么好/为什么爆 ②可取技法 ③分类多标签(供勾选) ④差异化改编方向 ⑤选定后生成改编大纲。
 *  底层复用 hit-reverse.analyzeHit（同一套爆款结构分析），不重复造轮子；只做“赏析层 + 再创作引导层”。
 *  铁律：只复用底层创作方法论，绝不复制原表达（改编大纲强制换人设/背景/关系并附隔离说明）。
 */

import { analyzeHit, Episode, reuseBrief, MethodSkeleton } from './hit-reverse';
import { firstAppearanceCheck } from './writers-room';
import { rhythmScan } from './rhythm';

export type TeardownSource = 'text' | 'drama_url' | 'video_url';

export type TeardownLang = 'zh' | 'en';
export interface TeardownTag { category: string; label: string }
export interface Technique { point: string; why: string; reuse: string }
export interface BoomReason { dim: string; conclusion: string }

export interface TeardownReport {
  wordCount: number;
  episodeCount: number;
  boomReasons: BoomReason[];
  opening: { inTrouble: boolean; sympathyLevers: string[]; score: number; advice: string };
  ending: { payoffSignals: string[]; hardshipHits: number; closed: boolean; advice: string };
  techniques: Technique[];
  tagPool: TeardownTag[];
  hookType: string;
  personaContrast: string;
  coolDensity: number;
  tensionCurve: number[];
  absorbIntoSkill: string[]; // 提炼后用于丰富自身技能库的“抽象方法论知识点”（不含原句）
  lang: TeardownLang;
  source?: { type: TeardownSource; url?: string };
}

const SYMPATHY_RULES: { lever: string; leverEn: string; words: string[]; wordsEn: string[] }[] = [
  { lever: '被误会/冤枉', leverEn: 'Misunderstood / framed', words: ['误会', '冤枉', '背锅', '替罪', '不清白'], wordsEn: ['misunderstood', 'wrongly accused', 'framed', 'scapegoat', 'blamed for'] },
  { lever: '被背叛/辜负', leverEn: 'Betrayed / let down', words: ['背叛', '出轨', '出卖', '辜负', '算计', '陷害'], wordsEn: ['betray', 'cheated', 'set up', 'stabbed in the back', 'framed'] },
  { lever: '善良却受欺', leverEn: 'Kind yet bullied', words: ['好心', '忍让', '伺候', '付出', '省吃俭用', '替他还'], wordsEn: ['kind-hearted', 'endured', 'sacrificed', 'slaved away', 'paid his debt'] },
  { lever: '被逼到退无可退', leverEn: 'Cornered with no way out', words: ['赶走', '逼', '走投无路', '绝境', '离婚', '退婚', '开除', '赶尽杀绝'], wordsEn: ['kicked out', 'cornered', 'nowhere to go', 'divorce', 'called off', 'fired', 'no escape'] },
  { lever: '被身处弱势/不公', leverEn: 'Underdog / injustice', words: ['穷人', '底层', '寄人篱下', '后妈', '养女', '赘婿', '保姆', '保洁'], wordsEn: ['poor', 'bottom of society', 'live under someone else roof', 'stepmother', 'adopted daughter', 'live-in son-in-law', 'maid', 'cleaner'] },
];
const PAYOFF_WORDS = ['清算', '真相大白', '团圆', '和解', '释然', '成长', '离开', '夺回', '正名', '平反', '圆满', '放手', '救赎', '站到最后', '笑到最后'];
const PAYOFF_WORDS_EN = ['reckoning', 'truth revealed', 'reunion', 'reconcile', 'at peace', 'growth', 'walk away', 'take back', 'cleared name', 'vindicated', 'happy ending', 'let go', 'redemption', 'last one standing'];
const HARDSHIP_WORDS = ['委屈', '辱', '欺负', '苦', '难', '痛', '背叛', '失去', '跌', '摔', '熬', '忍', '伤'];
const HARDSHIP_WORDS_EN = ['grievance', 'humiliat', 'bully', 'bitter', 'hardship', 'pain', 'betray', 'lost', 'fall', 'endured', 'held back', 'wound'];

function splitEpisodes(raw: string): Episode[] {
  // 兼容“第X集/EP x/###”切分；切不出来就整体当一集
  const parts = raw.split(/(?:^|\n)\s*(?:第\s*\d+\s*集|EP\s*\d+|#{1,3}\s*[^\n]*)[^\n]*\n/gi).filter((s) => s.trim().length > 30);
  const arr = parts.length ? parts : [raw];
  return arr.slice(0, 120).map((t, i) => ({ title: `EP${i + 1}`, text: t }));
}

/** 开场共情/站队：第一集是否先让主角陷入麻烦、观众为何会站到 TA 这边 */
export function openingSympathy(firstEpisode: string, lang: TeardownLang = 'zh') {
  const en = lang === 'en';
  const fa = firstAppearanceCheck(firstEpisode.slice(0, 400));
  const probe = en ? firstEpisode.toLowerCase() : firstEpisode;
  const sympathyLevers: string[] = [];
  for (const r of SYMPATHY_RULES) if ((en ? r.wordsEn : r.words).some((w) => probe.includes(en ? w.toLowerCase() : w))) sympathyLevers.push(en ? r.leverEn : r.lever);
  const inTrouble = fa.trouble || sympathyLevers.length > 0;
  const score = Math.min(100, (inTrouble ? 45 : 0) + sympathyLevers.length * 15 + (fa.oppressor ? 10 : 0) + (fa.counterPlan ? 10 : 0));
  const advice = !inTrouble
    ? (en
      ? 'Do not open with a character bio — force the lead into an unavoidable problem first, and give the audience a reason to side with them (misunderstood / betrayed / kind yet bullied / cornered)'
      : '开场别先做人物介绍，先把主角逼进一个无法逃避的麻烦，并给一个让观众站队的理由（被误会/被背叛/善良受欺/退无可退）')
    : sympathyLevers.length === 0
      ? (en
        ? 'The lead faces trouble, but the reason to side with them is weak — add one concrete detail of being wronged or treated unfairly'
        : '主角虽遇麻烦，但“观众为何站 TA”不够强，补一个具体的受委屈/被不公对待的细节')
      : (en ? 'Opens with the problem and a clear reason to side with the lead — keep it' : '开场即问题、站队理由清晰，保持');
  return { inTrouble, sympathyLevers, score, advice };
}

/** 结局兑付：人物一路颠沛，结局是否给了配得上经历的兑付与弧光闭环 */
export function endingPayoff(fullText: string, lang: TeardownLang = 'zh') {
  const en = lang === 'en';
  const probe = en ? fullText.toLowerCase() : fullText;
  const tail = en ? probe.slice(-1600) : fullText.slice(-1200);
  const payoffWords = en ? PAYOFF_WORDS_EN.map((w) => w.toLowerCase()) : PAYOFF_WORDS;
  const hardshipWords = en ? HARDSHIP_WORDS_EN.map((w) => w.toLowerCase()) : HARDSHIP_WORDS;
  const payoffSignals = payoffWords.filter((w) => tail.includes(w));
  const hardshipHits = hardshipWords.reduce((n, w) => n + (probe.split(w).length - 1), 0);
  const closed = payoffSignals.length >= 1;
  const advice = !closed
    ? (en
      ? 'Much hardship was set up but the ending lacks payoff (reckoning / cleared name / reconciliation / growth / peace). Give the lead an ending worthy of the journey so the arc closes'
      : '前文铺垫了大量苦难，结尾却缺少兑付（清算/正名/和解/成长/释然）。给主角一个配得上颠沛经历的结局，弧光才闭环')
    : (en ? 'The ending has payoff signals — make sure key supporting characters each land, avoiding tool-character disappearances' : '结尾有兑付信号，注意主要配角也要有各自落点，避免工具人式消失');
  return { payoffSignals, hardshipHits, closed, advice };
}

const CATEGORY_BY_KEYWORD: [string[], TeardownTag['category']][] = [
  ((): [string[], TeardownTag['category']] => [['重生', '穿越', '穿书', '系统', '金手指', '赘婿', '战神', '甜宠', '虐恋', '悬疑', '复仇', '逆袭', '豪门', '年代', '玄幻', '校园', '职场'], '题材'])(),
  ((): [string[], TeardownTag['category']] => [['隐藏身份', '扫地出门', '车祸', '病危', '绑架', '秘密', '真相', '遗嘱', '合同', '退婚', '羞辱'], '钩子'])(),
  ((): [string[], TeardownTag['category']] => [['真假千金', '弃少', '替身', '大佬', '扮猪吃虎', '反差', '女强人', '霸总'], '人设'])(),
  ((): [string[], TeardownTag['category']] => [['打脸', '爽', '虐', '燃', '治愈', '解气', '憋屈', '高光'], '情绪'])(),
  ((): [string[], TeardownTag['category']] => [['快节奏', '强反转', '多反转', '高密度', '慢热'], '节奏'])(),
  ((): [string[], TeardownTag['category']] => [['饭桌', '菜市场', '婚礼', '病房', '电梯', '家族', '职场', '校园', '乡村'], '场景'])(),
];

const CAT_ZH = ['题材', '钩子', '人设', '情绪', '节奏', '场景'];
const CAT_EN = ['Genre', 'Hook', 'Persona', 'Emotion', 'Rhythm', 'Scene'];
const CATEGORY_BY_KEYWORD_EN: [string[], number][] = [
  [['reborn', 'rebirth', 'transmigration', 'system', 'hidden heir', 'sweet romance', 'angst', 'mystery', 'revenge', 'underdog', 'wealthy family', 'campus', 'office'], 0],
  [['hidden identity', 'car crash', 'dying', 'kidnap', 'secret', 'truth', 'will', 'contract', 'called off', 'humiliat'], 1],
  [['switched daughter', 'stand-in', 'tycoon', 'hiding strength', 'contrast', 'strong woman', 'ceo'], 2],
  [['comeuppance', 'satisfying', 'angst', 'healing', 'cathartic', 'highlight'], 3],
  [['fast pace', 'big twist', 'dense', 'slow burn'], 4],
  [['dinner table', 'wedding', 'hospital', 'elevator', 'family', 'office', 'campus', 'village'], 5],
];
function buildTagPool(rawTags: string[], text: string, lang: TeardownLang = 'zh'): TeardownTag[] {
  const en = lang === 'en';
  const cats = en ? CAT_EN : CAT_ZH;
  const pool = new Map<string, TeardownTag>();
  const put = (label: string, ci: number) => { if (label && !pool.has(label)) pool.set(label, { category: cats[ci], label }); };
  rawTags.forEach((t) => put(t, 1));
  if (en) {
    const low = text.toLowerCase();
    for (const [words, ci] of CATEGORY_BY_KEYWORD_EN) words.forEach((w) => { if (low.includes(w)) put(w, ci); });
  } else {
    for (const [words, cat] of CATEGORY_BY_KEYWORD) { const ci = CAT_ZH.indexOf(cat); words.forEach((w) => { if (text.includes(w)) put(w, ci); }); }
  }
  // 兜底：至少给出可用标签，避免空池让用户无从选起
  if (pool.size < 4) {
    const fb = en ? ['Underdog rise', 'Hard conflict', 'Identity contrast', 'Cathartic', 'Fast pace'] : ['逆袭', '强冲突', '身份反差', '解气', '快节奏'];
    fb.forEach((t, i) => put(t, i));
  }
  return Array.from(pool.values()).slice(0, 24);
}

/** 拆解一部爆款：为什么好/为什么爆 + 可取技法 + 标签池 + 可吸收技能点 */
export function teardown(raw: string, source?: { type: TeardownSource; url?: string }, lang: TeardownLang = 'zh'): TeardownReport {
  const en = lang === 'en';
  const text = String(raw || '');
  const eps = splitEpisodes(text);
  const hit = analyzeHit(eps, lang);
  const opening = openingSympathy(eps[0]?.text || '', lang);
  const ending = endingPayoff(text, lang);
  const rhythm = rhythmScan(text);

  const boomReasons: BoomReason[] = en ? [
    { dim: 'Opening hook', conclusion: `Opening type "${hit.hookType}"${hit.hookEvidence.length ? ', evidence: ' + hit.hookEvidence.join(', ') : ', situational opening'}; the lead is thrown into a problem in episode 1 rather than introduced via a bio` },
    { dim: 'Persona contrast', conclusion: hit.personaContrast },
    { dim: 'Payoff density', conclusion: `${hit.coolPoints.total} payoffs across the script, ${hit.coolPoints.densityPer100} per 100 chars — ${hit.coolPoints.densityPer100 >= 1 ? 'dense, frequent payoff' : 'restrained, held by emotion and suspense'}` },
    { dim: 'Audience alignment', conclusion: opening.inTrouble ? `The opening uses "${opening.sympathyLevers.join(', ') || 'lead in trouble first'}" to make viewers side with the lead fast (alignment ${opening.score})` : 'Weak audience alignment in the opening' },
    { dim: 'Tension curve', conclusion: `Peak tension ${Math.max(0, ...hit.tensionCurve)}, rhythm score ${rhythm.score}; ${rhythm.arc.turn ? 'clear turning point' : 'turning point is weak'}` },
    { dim: 'Ending payoff', conclusion: ending.closed ? `The ending shows "${ending.payoffSignals.join(', ')}" — hardship is answered` : 'Weak ending payoff' },
  ] : [
    { dim: '开场钩子', conclusion: `开场类型「${hit.hookType}」，${hit.hookEvidence.length ? '证据词：' + hit.hookEvidence.join('、') : '以情境切入'}；第一集就让主角陷入问题而非做人物介绍` },
    { dim: '人设反差', conclusion: hit.personaContrast },
    { dim: '爽点密度', conclusion: `全本爽点${hit.coolPoints.total}个，每百字${hit.coolPoints.densityPer100}个，${hit.coolPoints.densityPer100 >= 1 ? '密度高、兑付频繁' : '密度偏克制，靠情绪与悬念留人'}` },
    { dim: '观众站队', conclusion: opening.inTrouble ? `开场用「${opening.sympathyLevers.join('、') || '主角先遇麻烦'}」让观众迅速站到主角一边（站队分${opening.score}）` : '开场站队不足' },
    { dim: '节奏曲线', conclusion: `张力曲线峰值${Math.max(0, ...hit.tensionCurve)}，节奏分${rhythm.score}；${rhythm.arc.turn ? '有明确转折' : '转折偏弱'}` },
    { dim: '结局兑付', conclusion: ending.closed ? `结尾出现「${ending.payoffSignals.join('、')}」等兑付，苦难被回应` : '结尾兑付偏弱' },
  ];

  const techniques: Technique[] = en ? [
    { point: 'Start the story with a problem', why: 'Viewers stay for "what does she do next", not a resume', reuse: 'Drop an unavoidable problem within the first 30 seconds' },
    { point: `Use "${hit.hookType}" to grab`, why: 'This hook type fits the genre and builds suspense/conflict at once', reuse: 'Swap in your own character and place a same-function hook at the same spot (never copy the line)' },
    { point: 'Persona contrast drives sustained payoff', why: hit.personaContrast, reuse: 'Build a gap between surface position and hidden card, reveal layer by layer and pay off each time' },
    { point: 'Control payoff intervals', why: `This work's payoff gaps ${JSON.stringify(hit.coolPoints.episodeGaps)} avoid long waits`, reuse: 'Use a build-release rhythm; at least one small payoff every 1-2 episodes' },
    { point: 'Make the audience side with the lead', why: 'Wronged first, then the counter-strike gives vicarious release', reuse: 'Add one concrete "treated unfairly" detail before the counter' },
    { point: 'An ending worthy of the hardship', why: 'A closed character arc leaves aftertaste and word of mouth', reuse: 'End with reckoning/cleared name/reconciliation/growth; give supporting characters their own landing' },
  ] : [
    { point: '故事从问题开始', why: '观众追的是“接下来他怎么办”，不是人物简历', reuse: '开场30秒内压上一个无法逃避的麻烦' },
    { point: `用「${hit.hookType}」抓人`, why: '该钩子类型与题材匹配，开场即建立悬念/冲突', reuse: '换成你的人物后，在同位置放同功能钩子（不抄原句）' },
    { point: '人设反差驱动持续爽感', why: hit.personaContrast, reuse: '设计“表层身份/处境 ↔ 隐藏底牌”的落差，逐层揭开并每次兑付' },
    { point: '控制爽点间隔', why: `本剧爽点间隔${JSON.stringify(hit.coolPoints.episodeGaps)}，避免观众久等`, reuse: '按“蓄压—释放”节奏排布，每1-2集至少一次小兑付' },
    { point: '让观众站队', why: '先受委屈/被误解，反击时观众才有代偿快感', reuse: '反击前先给一个具体的“被不公对待”细节' },
    { point: '结局配得上颠沛', why: '人物弧光闭环才有回味与口碑', reuse: '结尾清算/正名/和解/成长，主要配角各有落点' },
  ];

  const absorbIntoSkill = en ? [
    `Opening hook pattern: ${hit.hookType} (abstract structure, reusable, no original wording)`,
    `Persona contrast model: ${hit.personaContrast}`,
    `Payoff layout, relative rhythm ${JSON.stringify(hit.skeleton.coolRhythm)}`,
    `Opening alignment technique: ${opening.sympathyLevers.join(', ') || 'trouble first'}`,
    'Ending payoff check: hardship density must match ending payoff',
  ] : [
    `开场钩子范式：${hit.hookType}（抽象结构，可复用、不含原表达）`,
    `人设反差模型：${hit.personaContrast}`,
    `爽点排布：相对节奏 ${JSON.stringify(hit.skeleton.coolRhythm)}`,
    `开场站队技法：${opening.sympathyLevers.join('、') || '先陷麻烦'}`,
    '结局兑付检查：苦难密度需与结尾兑付相匹配',
  ];

  return {
    wordCount: text.replace(/\s/g, '').length,
    episodeCount: eps.length,
    boomReasons, opening, ending, techniques,
    tagPool: buildTagPool(hit.tags, text, lang),
    hookType: hit.hookType, personaContrast: hit.personaContrast,
    coolDensity: hit.coolPoints.densityPer100, tensionCurve: hit.tensionCurve,
    absorbIntoSkill, lang, source,
  };
}

/* ---------------- 改编方向与大纲（再创作引导） ---------------- */

export interface AdaptDirection { id: string; name: string; change: string; logline: string; isolation: string }
/** 三个差异化改编方向：换人设/换背景世界/换视角关系，确保只借逻辑不抄表达 */
export function adaptDirections(report: TeardownReport, lang: TeardownLang = report.lang || 'zh'): AdaptDirection[] {
  const en = lang === 'en';
  return en ? [
    { id: 'swap_persona', name: 'Swap persona · same logic', change: 'Keep the underlying conflict function; replace the lead’s job, identity, personality and desire', logline: 'Replace the lead with a stronger-contrast new identity and tell a fresh story inside a similar pressure-counter structure', isolation: 'Reuse only the functional beats pressure→build→counter→payoff; people, lines and plot are all rewritten' },
    { id: 'swap_world', name: 'Swap world · cross track', change: 'Move the story to a different era/industry/region/medium (live-action → AI-realistic / motion-comic)', logline: 'Keep the same emotional core but place it in a brand-new world and use new settings for freshness', isolation: 'The structural method transfers; world, scenes and details are original' },
    { id: 'flip_view', name: 'Flip viewpoint · tell it in reverse', change: 'Narrate from the rival/supporting/bystander viewpoint, or invert the moral stance', logline: 'Retell through the eyes of the opposing side; viewers get a brand-new information gap and stance', isolation: 'Viewpoint and stance are original, clearly distinguishable from the source' },
  ] : [
    { id: 'swap_persona', name: '换人设·同逻辑', change: '保留底层冲突功能，替换主角职业、身份、性格与欲望', logline: '把原主角换成一个反差更强的新身份，在相似的“受压—反击”结构里讲全新故事', isolation: '只复用“受压→蓄压→反击→兑付”的功能节拍，人物、台词、情节全部重写' },
    { id: 'swap_world', name: '换背景·跨赛道', change: '把故事迁移到不同时代/行业/地域/载体（真人→AI仿真人/漫剧）', logline: '同一情绪内核，放进一个全新的世界设定，用新场景制造新鲜感', isolation: '结构方法论可迁移，世界观、场景、细节均为原创' },
    { id: 'flip_view', name: '换视角·反着讲', change: '改由对手/配角/旁观者视角叙事，或把善恶立场反转', logline: '从原故事对立面的眼睛重讲一遍，观众获得全新信息差与立场', isolation: '视角与立场原创，与原作形成明显可区分的表达' },
  ];
}

export interface AdaptOutline {
  logline: string;
  pickedTags: string[];
  direction: string;
  characters: { name: string; role: string; want: string; secret: string }[];
  mainline: string;
  arc: { stage: string; goal: string }[];
  openingHook: string;
  endingPayoff: string;
  isolationNote: string;
}

/** 用户勾选标签 + 选定方向后，生成改编大纲骨架（不侵权；供“确认后进入改编创作”） */
export function buildAdaptOutline(report: TeardownReport, picked: string[], directionId: string, lang: TeardownLang = report.lang || 'zh'): AdaptOutline {
  const en = lang === 'en';
  const dirs = adaptDirections(report, lang);
  const dir = dirs.find((d) => d.id === directionId) ?? dirs[0];
  const tags = (picked || []).filter(Boolean).slice(0, 12);
  const skeleton: MethodSkeleton = {
    hookType: report.hookType, episodeBeats: [], coolRhythm: [], reversalAtEpisode: [], personaContrast: report.personaContrast,
  };
  const brief = reuseBrief(skeleton, en ? {
    persona: 'A brand-new lead (identity/job/personality reshaped by the chosen tags)',
    setting: 'Brand-new scenes and era', world: 'An original world with no overlapping character/place names or lines',
  } : {
    persona: '全新主角（身份/职业/性格由所选标签重塑）',
    setting: '全新场景与时代背景', world: '原创世界观，与原作无人物/地名/台词重叠',
  }, lang);
  return en ? {
    logline: `[${dir.name}] Around "${tags.slice(0, 4).join(' · ') || 'underdog rise'}": ${dir.logline}`,
    pickedTags: tags,
    direction: dir.name,
    characters: [
      { name: 'Lead (to be named)', role: 'Primary protagonist', want: 'An active goal made clear from the opening', secret: 'A hidden card revealed layer by layer, each time paying off emotionally' },
      { name: 'Main antagonist (to be named)', role: 'Source of pressure', want: 'Directly opposed to the lead; clearly antagonistic yet with understandable motive', secret: 'A hidden tie to the lead for the mid-story reversal' },
      { name: 'Key supporting role (to be named)', role: 'Ally / mirror', want: 'An independent goal, never a tool character', secret: 'Their own small arc and ending landing' },
    ],
    mainline: 'The lead is cornered at the opening and states an active goal → pressure builds in layers along the chosen tags with small payoffs → a major mid-story reversal rewrites relationships → a final reckoning completes the growth arc.',
    arc: [
      { stage: 'Setup (1-20%)', goal: 'Open with the problem, establish persona contrast and active goal, plant the core hidden card' },
      { stage: 'Rising (20-50%)', goal: 'Escalate pressure, dense small payoffs, unfold the relationship web' },
      { stage: 'Turn (50-80%)', goal: 'A perception-shattering reversal; the lead hits rock bottom then fights back' },
      { stage: 'Resolution (80-100%)', goal: 'Concentrated reckoning/cleared name; lead and key supporters each earn a worthy ending' },
    ],
    openingHook: `Keep the function of the "${report.hookType}" opening hook but present it with brand-new people and scenes; open with the lead in trouble and a reason to side with them`,
    endingPayoff: 'The ending pays off every major hardship and planted thread, closes the lead arc, and avoids a rushed finale or tool-character disappearances',
    isolationNote: `${brief.isolationNote}; ${dir.isolation}`,
  } : {
    logline: `【${dir.name}】围绕「${tags.slice(0, 4).join('·') || '逆袭'}」，${dir.logline}`,
    pickedTags: tags,
    direction: dir.name,
    characters: [
      { name: '主角(待命名)', role: '第一主角', want: '开场即明确的主动目标', secret: '一张随剧情逐层揭开、每次都带来情绪兑付的底牌' },
      { name: '主要对抗者(待命名)', role: '施压方', want: '与主角目标直接对立，坏得明确、动机可理解', secret: '与主角隐藏关系，用于中段反转' },
      { name: '关键配角(待命名)', role: '盟友/镜像', want: '独立目标，不做工具人', secret: '自己的小弧线与结局落点' },
    ],
    mainline: '主角开场被逼入麻烦并亮出主动目标 → 沿所选标签逐层蓄压、小步兑付 → 中段一次大反转改写关系 → 终局集中清算并完成成长弧光。',
    arc: [
      { stage: '起(1-20%)', goal: '开场即问题、立人设反差与主动目标，埋核心底牌' },
      { stage: '承(20-50%)', goal: '压力升级、小爽点密集兑付，关系网铺开' },
      { stage: '转(50-80%)', goal: '一次颠覆认知的大反转，主角跌入最低谷后主动反击' },
      { stage: '合(80-100%)', goal: '集中清算/正名，主角与主要配角各得配得上经历的结局' },
    ],
    openingHook: `沿用「${report.hookType}」开场钩子的功能，但用全新人物与场景呈现；开场让主角先遇麻烦并给观众站队理由`,
    endingPayoff: '结尾兑付前文所有主要苦难与伏笔，主角弧光闭环，避免烂尾与工具人消失',
    isolationNote: `${brief.isolationNote}；${dir.isolation}`,
  };
}
