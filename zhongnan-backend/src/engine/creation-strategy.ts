/**
 * 创作策略层（v2.28）——把 v2.27「钩子策略」的用户选项/系统默认范式举一反三：
 *   A) 节奏曲线策略 PACE：场景长短、冲突密度、转折频率、留白比例
 *   B) 台词风格策略 DIALOGUE：口语化档位 + 句长/语气词/潜台词/网感
 * 与既有模块关系（不重复造轮子）：
 *   - 节奏：rhythm.ts 是“事后体检”，本模块是“事前给架构师/撰写师的执行指令”；
 *   - 台词：dialogue.ts 的 ColloquialLevel 是口语档位，本模块把它包装成用户看得懂的命名策略并补充句长/潜台词要求。
 * 纯函数、双语、确定性；用户显式选择 > 系统按题材推荐 > 标准默认。
 */
import type { ColloquialLevel } from './dialogue';

export type StrategyLang = 'zh' | 'en';

// ============================ A) 节奏曲线策略 ============================
export type PaceStrategyId = 'standard' | 'fastcut' | 'suspense_burn' | 'emotional_wave' | 'cinematic';
export const PACE_IDS: PaceStrategyId[] = ['standard', 'fastcut', 'suspense_burn', 'emotional_wave', 'cinematic'];
export interface PaceStrategy {
  id: PaceStrategyId;
  name: string; nameEn: string;
  tagline: string; taglineEn: string;
  fit: string; fitEn: string;
  scenesPerEp: [number, number]; // 建议每集场景数区间
  conflictPerScene: string;      // 冲突密度（给模型的执行描述）
  turnCadence: string; turnCadenceEn: string;
  blankRatio: string; blankRatioEn: string;
  directiveZh: string; directiveEn: string;
  kw: string[];
}
export const PACE_STRATEGIES: PaceStrategy[] = [
  {
    id: 'standard', name: '标准张弛流', nameEn: 'Standard ebb & flow',
    tagline: '冲突与留白均衡，一集一个完整小起伏，最通用', taglineEn: 'Balanced conflict and breathing room, one small arc per episode — the universal default',
    fit: '绝大多数题材、新用户、平台常规节奏', fitEn: 'Most genres; new users; standard pacing',
    scenesPerEp: [3, 5],
    conflictPerScene: '每 1-2 场一个小对抗，单集 2-3 个冲突点',
    turnCadenceEn: 'one small turn around the mid-late episode, one end hook',
    turnCadence: '中后段一个小转折，集尾一个卡点',
    blankRatioEn: 'about 20% breathing beats (action/atmosphere lines between dialogue)',
    blankRatio: '约两成呼吸节拍（台词之间穿插动作/氛围行）',
    directiveZh: '节奏采用标准张弛：每场有明确目标与一次小对抗，中后段一个转折，集尾卡点；动作行约占两成，避免台词墙也避免流水账。',
    directiveEn: 'Use standard ebb-and-flow pacing: each scene has a clear goal and one small clash, one turn mid-late, an end hook; keep about 20% action/atmosphere beats—no dialogue walls, no flat chronicle.',
    kw: [],
  },
  {
    id: 'fastcut', name: '快剪强冲流', nameEn: 'Fast-cut high-impact',
    tagline: '短场景、快切换、冲突连环，最大化爽感与完播', taglineEn: 'Short scenes, rapid cuts, chained conflict — maximize payoff and completion',
    fit: '逆袭打脸、战神赘婿、复仇爽剧、动作、下沉市场', fitEn: 'Comeuppance, war-god/son-in-law, revenge, action, mass market',
    scenesPerEp: [5, 8],
    conflictPerScene: '几乎每场都有对抗或新信息，冲突不断升级',
    turnCadence: '每 1-2 场一个小反转，集尾强卡点', turnCadenceEn: 'a mini-twist every 1-2 scenes, a hard end cliffhanger',
    blankRatio: '留白极少（≤一成），用动作短句推进', blankRatioEn: 'very little breathing (≤10%), advance through short action beats',
    directiveZh: '节奏快剪强冲：场景短、切换快，几乎每场都抛对抗或新信息并逐级升级，每1-2场一个小反转，集尾强卡点；少铺垫、少环境描写，冲突先行、背景后补。',
    directiveEn: 'Use fast-cut high-impact pacing: short, rapidly switching scenes, a clash or new piece of info in nearly every scene escalating in steps, a mini-twist every 1-2 scenes and a hard cliffhanger; minimal setup and environment description—conflict first, background later.',
    kw: ['快剪', '强冲', '爽剧', '逆袭', '打脸', '战神', '赘婿', '复仇', '动作', '下沉', 'fast', 'fastcut', 'binge', 'revenge', 'action', 'comeuppance', 'paced'],
  },
  {
    id: 'suspense_burn', name: '悬念递进流', nameEn: 'Suspense escalation',
    tagline: '信息逐场释放、压力层层加码，勾着观众找答案', taglineEn: 'Dole out information scene by scene, layer pressure, pull toward the answer',
    fit: '悬疑、刑侦法医、谍战、推理罪案、科幻解谜', fitEn: 'Mystery, procedural, spy, detective, sci-fi puzzle',
    scenesPerEp: [4, 6],
    conflictPerScene: '每场推进一条线索同时制造一个新疑问',
    turnCadence: '中段一次误导性转折，集尾揭秘将揭未揭', turnCadenceEn: 'a misleading turn mid-episode, a reveal-cut at the end',
    blankRatio: '用氛围行加压（约两成），安静处反而更紧张', blankRatioEn: 'use ~20% atmosphere beats to pressurize—silence feels tenser',
    directiveZh: '节奏采用悬念递进：每场推进一条线索、同时抛出一个新疑问，信息只给七分给三分；中段安排一次误导性转折，集尾停在真相将揭未揭；用光影/声音的氛围行加压，不靠吵闹靠“想知道”。',
    directiveEn: 'Use suspense-escalation pacing: every scene advances one clue while opening a new question, reveal seven-tenths and withhold three-tenths; place one misleading turn mid-episode and cut at an almost-reveal; pressurize with light/sound atmosphere beats—drive by curiosity, not noise.',
    kw: ['悬疑', '刑侦', '法医', '谍战', '推理', '罪案', '破案', '解谜', '烧脑', 'mystery', 'crime', 'spy', 'detective', 'thriller', 'procedural', 'investigation', 'suspense', 'noir'],
  },
  {
    id: 'emotional_wave', name: '情绪波浪流', nameEn: 'Emotional wave',
    tagline: '情绪有起有伏、先压后放，给共情与泪点留沉淀', taglineEn: 'Emotions rise and fall, press then release; leave room for empathy and tears to land',
    fit: '都市情感、甜宠虐恋、家庭年代、萌宝银发、女性群像、治愈', fitEn: 'Urban romance, sweet/angst, family, kids & elders, women’s ensemble, healing',
    scenesPerEp: [3, 5],
    conflictPerScene: '冲突多为关系与观念碰撞，给情绪反应留镜头',
    turnCadence: '情绪先压后放，集尾停在情绪峰值或和解瞬间', turnCadenceEn: 'press then release emotion; end on an emotional peak or a reconciliation beat',
    blankRatio: '留白充足（约三成）：沉默、小动作、生活流', blankRatioEn: 'ample breathing (~30%): silence, small gestures, slice-of-life',
    directiveZh: '节奏采用情绪波浪：冲突以关系和观念碰撞为主，不赶；情绪先压住再释放，一场激烈冲突后给一个生活流小动作或沉默让情绪沉淀；集尾停在情绪峰值或和解瞬间，约三成留白。',
    directiveEn: 'Use emotional-wave pacing: conflicts are mainly relationship and value clashes, never rushed; press emotion then release it, and after a heated clash give a small everyday gesture or silence so the feeling lands; end on an emotional peak or reconciliation, with about 30% breathing room.',
    kw: ['情感', '甜宠', '虐恋', '家庭', '亲情', '萌宝', '银发', '女性群像', '治愈', '婚恋', '温暖', 'romance', 'sweet', 'angst', 'family', 'healing', 'sisterhood', 'ensemble', 'melodrama', 'tender'],
  },
  {
    id: 'cinematic', name: '电影慢板流', nameEn: 'Cinematic slow-burn',
    tagline: '长场景、氛围铺陈、克制卡点，靠质感与余味留人', taglineEn: 'Longer scenes, atmospheric buildup, restrained hooks—retain through texture and aftertaste',
    fit: '精品短剧、电影感、文艺现实、品牌定制、获奖向', fitEn: 'Premium, cinematic, arthouse realism, brand/award-oriented',
    scenesPerEp: [2, 4],
    conflictPerScene: '冲突内化、克制，靠处境与选择而非吵闹',
    turnCadence: '转折偏晚且克制，集尾余味式留白', turnCadenceEn: 'turns come later and restrained; end on an aftertaste-style open beat',
    blankRatio: '留白最多（约四成）：环境、光影、停顿参与叙事', blankRatioEn: 'most breathing (~40%): setting, light and pauses carry story',
    directiveZh: '节奏采用电影慢板：场景偏长，冲突内化为处境与两难，靠表演与氛围而非争吵；转折偏晚且克制，不硬卡点，集尾用余味式留白；约四成笔墨给环境、光影与停顿，让它们参与叙事。',
    directiveEn: 'Use cinematic slow-burn pacing: longer scenes, conflict internalized into situation and dilemma, carried by performance and atmosphere rather than arguing; turns arrive late and restrained, avoid forced cliffhangers, end on an aftertaste open beat; spend about 40% on setting, light and pauses that tell the story.',
    kw: ['精品', '电影感', '文艺', '慢板', '慢热', '现实向', '获奖', '品牌定制', 'cinematic', 'premium', 'arthouse', 'slow burn', 'slow-burn', 'literary', 'auteur'],
  },
];
const PACE_BY_ID = new Map(PACE_STRATEGIES.map((s) => [s.id, s]));

// ============================ B) 台词风格策略 ============================
export type DialogueStrategyId = 'natural' | 'street' | 'sharp' | 'elegant' | 'youthful';
export const DIALOGUE_IDS: DialogueStrategyId[] = ['natural', 'street', 'sharp', 'elegant', 'youthful'];
export interface DialogueStrategy {
  id: DialogueStrategyId;
  name: string; nameEn: string;
  tagline: string; taglineEn: string;
  fit: string; fitEn: string;
  colloquial: ColloquialLevel;
  sentence: string; sentenceEn: string;
  directiveZh: string; directiveEn: string;
  kw: string[];
}
export const DIALOGUE_STRATEGIES: DialogueStrategy[] = [
  {
    id: 'natural', name: '自然口语', nameEn: 'Natural spoken',
    tagline: '像真人说话，允许断句和口头语，通用默认', taglineEn: 'Real human speech with broken sentences and fillers — the universal default',
    fit: '绝大多数题材', fitEn: 'Most genres',
    colloquial: 'mid',
    sentence: '短句为主，偶有停顿、省略主语', sentenceEn: 'mostly short sentences, occasional pauses and dropped subjects',
    directiveZh: '台词走自然口语：能念出口、像真人说的，允许断句、省略主语和少量口头语；禁止工整对仗、书面连接词与说教总结。',
    directiveEn: 'Write natural spoken dialogue: speakable and human, allowing broken sentences, dropped subjects and a few fillers; forbid neat parallelism, written connectives and preachy summary lines.',
    kw: [],
  },
  {
    id: 'street', name: '市井烟火', nameEn: 'Street & grassroots',
    tagline: '高度口语、带生活糙感与地方味，接地气', taglineEn: 'Highly colloquial, rough-edged everyday texture with local flavor',
    fit: '现实题材、下沉、乡村乡土、市井、年代', fitEn: 'Realism, mass market, rural, street-level, period everyday',
    colloquial: 'high',
    sentence: '短、碎、直，语气词与俚语点缀（不生造方言）', sentenceEn: 'short, fragmented, direct, with particles/slang used sparingly (never invent dialect)',
    directiveZh: '台词走市井烟火：高度口语，短碎直，带生活糙感；可少量点染查证过的地方语气词/俚语，但不堆砌、不生造方言、不拿口音取乐；避免任何文绉绉表达。',
    directiveEn: 'Write street-level grassroots dialogue: highly colloquial, short, fragmented and direct with rough everyday texture; a few verified local particles/slang are allowed, never piled up, never invented, and accent is never a joke; remove any bookish phrasing.',
    kw: ['市井', '烟火', '乡土', '乡村', '农村', '接地气', '下沉', '年代', '方言', '草根', 'street', 'grassroots', 'rural', 'village', 'working class', 'colloquial', 'down to earth'],
  },
  {
    id: 'sharp', name: '锋利机锋', nameEn: 'Sharp & subtext',
    tagline: '短兵相接、话里有话，一句顶一句', taglineEn: 'Verbal fencing with subtext, every line landing',
    fit: '商战、权谋、谍战、悬疑、职场博弈、大女主', fitEn: 'Business war, court intrigue, spy, mystery, workplace duel, strong female lead',
    colloquial: 'low',
    sentence: '句子短而准，潜台词丰富，少废话', sentenceEn: 'short precise lines rich in subtext, zero fluff',
    directiveZh: '台词走锋利机锋：人物短兵相接，话里有话、绵里藏针，用潜台词和信息差制造张力；每句都推进利益或关系，删掉一切废话，但仍要能念出口、不写书面论文。',
    directiveEn: 'Write sharp, subtext-driven dialogue: characters fence verbally, lines carry hidden meaning and veiled pressure, tension comes from subtext and information gaps; every line advances interest or relationship with no fluff, yet stays speakable rather than essay-like.',
    kw: ['商战', '权谋', '谍战', '悬疑', '职场博弈', '机锋', '对峙', '大女主', '宫斗', 'intrigue', 'sharp', 'subtext', 'business war', 'court', 'spy', 'verbal duel', 'witty'],
  },
  {
    id: 'elegant', name: '克制规整', nameEn: 'Restrained & polished',
    tagline: '措辞讲究、相对规整，适配古装与精英场域', taglineEn: 'Refined, relatively formal wording for period and elite settings',
    fit: '古装权谋、历史、精英职场、精品文艺', fitEn: 'Period/historical, elite professional, premium arthouse',
    colloquial: 'low',
    sentence: '句式完整、措辞讲究，但不堆砌辞藻、不现代词汇穿越', sentenceEn: 'complete, well-crafted sentences without florid padding or anachronistic modern words',
    directiveZh: '台词走克制规整：措辞讲究、句式相对完整，符合古装/精英场域的身份与时代；但不堆砌辞藻、不掉书袋、不出现现代网络词穿越，情绪仍要真实可感。',
    directiveEn: 'Write restrained, polished dialogue: refined wording and relatively complete sentences fitting a period or elite setting and the speaker’s status; avoid florid padding, pedantry and anachronistic internet slang, while keeping emotion real and felt.',
    kw: ['古装', '历史', '权谋古装', '精英', '贵族', '民国', '文雅', '古风', 'period', 'historical', 'elegant', 'formal', 'aristocrat', 'refined', 'costume drama'],
  },
  {
    id: 'youthful', name: '网感年轻', nameEn: 'Internet-native youth',
    tagline: '轻快有梗、吐槽感强，贴合年轻观众语感', taglineEn: 'Light, meme-aware, roasty, tuned to young audiences',
    fit: '校园、青春、都市轻喜、甜宠、二次元向', fitEn: 'Campus, youth, urban light comedy, sweet romance, anime-gen adjacent',
    colloquial: 'high',
    sentence: '轻快短促、内心吐槽多，热梗点到为止不过期', sentenceEn: 'light and snappy with inner roast; memes used lightly and kept fresh',
    directiveZh: '台词走网感年轻：轻快短促、有当代年轻人的吐槽与自嘲，可少量用当下通行热梗但点到为止、不堆砌、不用已过时的梗；人物依旧逻辑自洽，不为玩梗牺牲剧情。',
    directiveEn: 'Write internet-native youth dialogue: light, snappy, with contemporary roast and self-deprecation; a few currently common memes are fine, used lightly—never piled up or dated; characters stay consistent and plot is never sacrificed for a meme.',
    kw: ['校园', '青春', '年轻', '网感', '轻喜', '甜宠', '二次元', '吐槽', '梗', 'youth', 'campus', 'teen', 'young adult', 'meme', 'gen z', 'internet', 'light comedy'],
  },
];
const DIALOGUE_BY_ID = new Map(DIALOGUE_STRATEGIES.map((s) => [s.id, s]));

// ============================ C) 情绪/爽点曲线策略（v2.29，第四套策略层） ============================
// 风味 id 全部取自 beat-system 的合法集合 PAYOFF/REVERSAL/EMOTION_FLAVORS，绝不发明
export type EmotionStrategyId = 'balanced' | 'payoff_dense' | 'angst_tug' | 'sweet_heal' | 'twist_puzzle';
export const EMOTION_IDS: EmotionStrategyId[] = ['balanced', 'payoff_dense', 'angst_tug', 'sweet_heal', 'twist_puzzle'];
export interface EmotionStrategy {
  id: EmotionStrategyId;
  name: string; nameEn: string;
  tagline: string; taglineEn: string;
  fit: string; fitEn: string;
  /** 映射到节拍系统的合法风味集合（balanced 为空=不干预、均衡排布） */
  payoffFlavors: string[]; reversalFlavors: string[]; emotionFlavors: string[];
  directiveZh: string; directiveEn: string;
  kw: string[];
}
export const EMOTION_STRATEGIES: EmotionStrategy[] = [
  {
    id: 'balanced', name: '均衡叙事', nameEn: 'Balanced arc',
    tagline: '爽点、反转、情绪起伏均衡配比，最通用', taglineEn: 'Balanced mix of payoff, reversal and emotion — the universal default',
    fit: '绝大多数题材、新用户', fitEn: 'Most genres; new users',
    payoffFlavors: [], reversalFlavors: [], emotionFlavors: [],
    directiveZh: '情绪曲线走均衡叙事：爽点、反转、情绪释放交替出现、不偏科，单集有一次小满足、集尾留追更张力，避免单一情绪疲劳。',
    directiveEn: 'Use a balanced emotional arc: alternate payoff, reversal and emotional release without over-weighting any one; give one small satisfaction per episode and end with a pull to continue, avoiding single-emotion fatigue.',
    kw: [],
  },
  {
    id: 'payoff_dense', name: '爽感密集', nameEn: 'Dense payoff',
    tagline: '打脸逆袭连环给爽，压缩憋屈、快速兑现', taglineEn: 'Chain face-slaps and comebacks; compress grievance, cash out fast',
    fit: '逆袭打脸、战神赘婿、复仇、男频爽剧、下沉', fitEn: 'Comeuppance, war-god/son-in-law, revenge, male-lead power fantasy, mass market',
    payoffFlavors: ['face_slap', 'comeback', 'status_crush', 'truth_justice'], reversalFlavors: ['identity_shift', 'cognition_overturn'], emotionFlavors: ['hype_burn', 'press_release'],
    directiveZh: '情绪曲线走爽感密集：憋屈铺垫尽量短、每隔一小段就兑现一次打脸/逆袭/身份碾压的爽点并逐级加码，反派被压制要给足反应镜头，让观众持续“解气”。',
    directiveEn: 'Use a dense-payoff arc: keep grievance setup short, cash out a face-slap/comeback/status-crush payoff every short stretch and escalate; give ample reaction beats when the antagonist is crushed so viewers keep feeling vindication.',
    kw: ['爽', '打脸', '逆袭', '复仇', '战神', '赘婿', '男频', '解气', '扮猪吃虎', 'payoff', 'face slap', 'comeback', 'revenge', 'power fantasy', 'wish fulfillment', 'catharsis'],
  },
  {
    id: 'angst_tug', name: '虐心拉扯', nameEn: 'Angst & tug',
    tagline: '误会与遗憾层层加压，释放点克制、催泪', taglineEn: 'Layer misunderstanding and regret, release sparingly — tear-jerking',
    fit: '虐恋、意难平、家庭亲情、女性向情感、悲剧', fitEn: 'Angst romance, unresolved regret, family, female-skewing emotion, tragedy',
    payoffFlavors: ['truth_justice'], reversalFlavors: ['relation_turn', 'truth_cause'], emotionFlavors: ['tear_angst', 'suspense_tug', 'press_release'],
    directiveZh: '情绪曲线走虐心拉扯：用误会、错过、隐忍层层加压，希望与失望反复横跳，情绪释放点克制而精准，把最大的眼泪留给关键集；人物克制表达、靠细节和停顿传递心碎，不喊口号式卖惨。',
    directiveEn: 'Use an angst-and-tug arc: layer misunderstanding, missed timing and restraint, oscillate hope and disappointment, release emotion sparingly and precisely, saving the biggest tear for a key episode; characters express feeling obliquely, heartbreak carried by detail and pause rather than overt misery-selling.',
    kw: ['虐', '虐恋', '意难平', '催泪', 'be', '悲剧', '遗憾', '误会', '亲情虐', 'angst', 'tear', 'tragedy', 'heartbreak', 'melodrama', 'unrequited', 'grief'],
  },
  {
    id: 'sweet_heal', name: '甜暖治愈', nameEn: 'Sweet & healing',
    tagline: '高甜与温柔疗愈为主，冲突轻、暖意足', taglineEn: 'Mostly sweetness and warm healing; light conflict, strong warmth',
    fit: '甜宠、轻喜、治愈、银发萌宝、女性群像、生活流', fitEn: 'Sweet romance, light comedy, healing, elders/kids, women’s ensemble, slice-of-life',
    payoffFlavors: ['sweet_warm'], reversalFlavors: ['relation_turn'], emotionFlavors: ['tender_heal', 'press_release'],
    directiveZh: '情绪曲线走甜暖治愈：以心动、善意、和解与小确幸为主调，冲突轻量且快速化解，每集至少一个被理解/被偏爱/被治愈的暖时刻；不制造狗血误会，靠细节糖和生活温度留人。',
    directiveEn: 'Use a sweet-healing arc: heart-flutter, kindness, reconciliation and small joys dominate; conflicts stay light and resolve quickly, with at least one moment of being understood/favored/healed per episode; avoid melodramatic misunderstanding, retain viewers through detailed sweetness and everyday warmth.',
    kw: ['甜宠', '高甜', '治愈', '温暖', '轻喜', '萌宝', '银发', '双向奔赴', '小确幸', 'sweet', 'healing', 'fluff', 'warm', 'wholesome', 'comfort', 'cozy'],
  },
  {
    id: 'twist_puzzle', name: '反转烧脑', nameEn: 'Twist & puzzle',
    tagline: '信息差与认知反转驱动，结尾必掀桌', taglineEn: 'Driven by information gaps and cognitive reversals, end with an upheaval',
    fit: '悬疑、刑侦、推理、谍战、无限流、高智商博弈', fitEn: 'Mystery, procedural, detective, spy, time-loop, high-IQ duel',
    payoffFlavors: ['truth_justice'], reversalFlavors: ['identity_shift', 'relation_turn', 'truth_cause', 'cognition_overturn'], emotionFlavors: ['suspense_tug', 'hype_burn'],
    directiveZh: '情绪曲线走反转烧脑：以信息差和认知颠覆驱动，每集埋一个可回收的误导、掀一次认知小桌，集尾停在最大疑点；反转必须有前置伏笔、回看成立，不靠角色突然黑化或天降设定。',
    directiveEn: 'Use a twist-puzzle arc: drive by information gaps and cognitive upheaval, plant one recoverable misdirection and overturn one assumption per episode, end on the biggest open question; every reversal needs prior foreshadowing and must hold on rewatch—no sudden villain turns or dropped-in facts.',
    kw: ['反转', '烧脑', '悬疑', '刑侦', '推理', '谍战', '无限流', '高智商', '博弈', '解谜', 'twist', 'puzzle', 'mystery', 'detective', 'mind game', 'unreliable'],
  },
];
const EMOTION_BY_ID = new Map(EMOTION_STRATEGIES.map((s) => [s.id, s]));

// ============================ D) 人物与关系策略（v2.37，第五套策略层） ============================
// 靶向治理 2.1.3「人物工具人化」：把专业编剧立人物/搭关系的方法论封装成用户可选的命名策略卡
export type CharacterStrategyId = 'grounded' | 'contrast' | 'bond_dynamic' | 'ensemble' | 'growth_arc';
export const CHARACTER_IDS: CharacterStrategyId[] = ['grounded', 'contrast', 'bond_dynamic', 'ensemble', 'growth_arc'];
export interface CharacterStrategy {
  id: CharacterStrategyId;
  name: string; nameEn: string;
  tagline: string; taglineEn: string;
  fit: string; fitEn: string;
  /** 主角塑造要点 */
  lead: string; leadEn: string;
  /** 人物关系网要点 */
  relation: string; relationEn: string;
  directiveZh: string; directiveEn: string;
  kw: string[];
}
export const CHARACTER_STRATEGIES: CharacterStrategy[] = [
  {
    id: 'grounded', name: '立体真实', nameEn: 'Grounded & real',
    tagline: '隐性设定托底、行为有动机，配角也有自己的日子，最通用', taglineEn: 'Hidden backstory drives motivated behavior; even minor characters have their own lives — universal default',
    fit: '绝大多数题材、新用户、现实题材', fitEn: 'Most genres; new users; realism',
    lead: '表层目标之下还有一层底层欲望与恐惧，决定带可追溯的前史', leadEn: 'beneath the surface goal lies a deeper want and fear, each decision traceable to backstory',
    relation: '每个配角有独立诉求，与主角是利益/情感的真实交汇而非工具', relationEn: 'every supporting character pursues an independent goal and crosses the lead for real reasons, never as a plot tool',
    directiveZh: '人物走立体真实路线：每个主要角色补齐隐性设定（原生家庭、行为习惯、喜好禁忌、思维模式、底层欲望），决策必须能从其性格与前史推出；配角同样有自己的目标与难处，不为推进主角剧情而突然变脸；用生活细节（习惯动作、旧物、口头禅）让人物落地，禁止脸谱化标签人。',
    directiveEn: 'Build grounded, real characters: give every major figure a hidden profile (family of origin, habits, likes/taboos, mindset, deepest want), so each decision follows from personality and backstory; supporting characters pursue their own goals and hardships and never flip merely to advance the lead’s plot; ground people in lived detail (habitual gestures, worn objects, catchphrases); forbid flat label-people.',
    kw: [],
  },
  {
    id: 'contrast', name: '极致反差', nameEn: 'Extreme contrast',
    tagline: '表里/身份/预期三重反差，开局即记忆点，爽剧钩子型', taglineEn: 'Triple contrast (surface vs inner, identity, expectation) — an instant hook for power-fantasy drama',
    fit: '逆袭打脸、战神赘婿、扮猪吃虎、马甲流、身份流', fitEn: 'Comeuppance, war-god/son-in-law, hiding-strength, secret-identity stories',
    lead: '主角外在人设与真实实力/身份形成强反差，反差分层、逐级揭马甲', leadEn: 'the lead’s outward persona sharply contrasts real power/identity; reveals are layered and escalate',
    relation: '周围人按错误的表层认知行动，反差揭穿时群体反应是爽点弹药', relationEn: 'others act on a mistaken surface read; their reactions when the mask drops fuel payoff',
    directiveZh: '人物走极致反差路线：主角外在标签（落魄/窝囊/小人物）与真实底牌（实力/身份/资源）形成强烈但自洽的反差，马甲分层、逐级揭开、每次揭开都回收前文伏笔；反派与围观者基于错误的表层认知合理地轻视主角，揭穿时给足态度反转与反应镜头；反差必须有隐情支撑，不能为装而装、逻辑硬凹。',
    directiveEn: 'Use extreme contrast: the lead’s outward label (down-and-out / weak / nobody) sharply yet coherently contrasts hidden cards (power/identity/resources); identities are layered and peeled one level at a time, each reveal cashing in earlier foreshadowing; antagonists and onlookers reasonably underestimate the lead based on the false surface, and the unmasking must show full attitude reversal and reaction beats; the contrast needs a real hidden reason—never posturing with forced logic.',
    kw: ['反差', '逆袭', '打脸', '战神', '赘婿', '扮猪吃虎', '马甲', '隐藏身份', '装弱', 'contrast', 'hidden identity', 'secret power', 'underdog reveal', 'face slap', 'mask'],
  },
  {
    id: 'bond_dynamic', name: '关系拉扯', nameEn: 'Bond & friction',
    tagline: '关系本身就是发动机：双强博弈/欢喜冤家/相爱相杀', taglineEn: 'The relationship is the engine: two strong leads, banter-to-bond, love-hate friction',
    fit: '甜宠、都市情感、双男主/双女主、欢喜冤家、虐恋', fitEn: 'Sweet romance, urban relationship, dual-lead, enemies-to-lovers, angst romance',
    lead: '两个主角都有完整主体性，吸引与对抗同源、拉扯推动剧情', leadEn: 'both leads keep full agency; attraction and conflict share one root, friction drives plot',
    relation: '关系按“对立—试探—松动—绑定—危机”推进，每次进退都改变权力位', relationEn: 'the bond moves clash→probe→soften→bind→crisis, every move shifting the power balance',
    directiveZh: '人物走关系拉扯路线：双主角都有独立目标与底线，谁也不是谁的附属；两人的吸引力与冲突来自同一个结构性矛盾（立场/身份/旧怨/利益），关系按对立—试探—松动—绑定—危机逐级推进，每一次靠近与推开都伴随权力位变化和可感知的情绪账；配角情感线服务主线但不复制主关系模式；禁止靠误会硬拖、靠降智制造冲突。',
    directiveEn: 'Use bond-and-friction: both leads hold independent goals and bottom lines, neither subordinate to the other; their attraction and conflict spring from one structural contradiction (stance/identity/old grudge/interest), and the bond progresses clash→probe→soften→bind→crisis, every pull and push shifting the balance of power with a felt emotional ledger; side romances serve the main line without copying its pattern; forbid stalling via misunderstanding or conflict via character stupidity.',
    kw: ['甜宠', '双强', '欢喜冤家', '相爱相杀', '拉扯', '情感', 'cp', '虐恋', '暧昧', 'romance', 'enemies to lovers', 'banter', 'love hate', 'dual lead', 'relationship tension', 'slow burn'],
  },
  {
    id: 'ensemble', name: '群像并立', nameEn: 'Ensemble cast',
    tagline: '多线主角各有弧光、功能不重叠，织成一张关系网', taglineEn: 'Multiple leads with distinct arcs and non-overlapping roles woven into one relationship web',
    fit: '家庭、职场、女性群像、市井、行业、年代群像', fitEn: 'Family, workplace, women’s ensemble, street-level, industry saga, period ensemble',
    lead: '每位线主角有独立欲望、缺陷与弧光，观众能分别站队', leadEn: 'each POV character has an independent want, flaw and arc; viewers can root for each separately',
    relation: '关系网呈网状而非主配辐射，冲突来自目标与价值观的真实碰撞', relationEn: 'a web rather than a lead-and-satellites star; conflict arises from real clashes of goals and values',
    directiveZh: '人物走群像并立路线：设置3-5位线主角，每人有独立欲望、明显缺陷与完整弧光，性格功能（理性/冲动/圆滑/刚烈等）互不重叠、台词声音可盲辨；关系呈网状交织，冲突来自目标与价值观的真实对撞而非坏人使坏；每集至少给一位非主视角角色属于自己的高光时刻；切换视角时信息与情绪连续，禁止工具配角和背景板家人。',
    directiveEn: 'Use an ensemble: field 3-5 POV characters, each with an independent want, a clear flaw and a full arc; their personality functions (reason/impulse/diplomacy/steel etc.) never overlap and their voices are identifiable with names hidden; relationships form a web where conflict springs from genuine clashes of goals and values rather than villainy; give at least one non-POV character their own highlight per episode; keep information and emotion continuous across POV switches; forbid tool-supporting-casts and wallpaper family members.',
    kw: ['群像', '家庭', '职场', '女性群像', '市井', '行业剧', '多主角', 'ensemble', 'cast of characters', 'group drama', 'family saga', 'workplace ensemble'],
  },
  {
    id: 'growth_arc', name: '成长蜕变', nameEn: 'Growth arc',
    tagline: '缺陷—触发—试炼—蜕变，弧光本身就是主线', taglineEn: 'Flaw→trigger→trial→transformation; the arc itself is the main line',
    fit: '热血、青春、励志、治愈、竞技、少年向', fitEn: 'Hot-blooded, youth, inspirational, healing, sports/competition, coming-of-age',
    lead: '开局有明确性格缺陷或认知盲区，转变靠代价换来、不跳级', leadEn: 'open with a clear flaw or blind spot; change is earned at a cost, never skipped',
    relation: '导师/对手/伙伴分别承担照见缺陷、施加压力、提供支撑的功能且自身也在变', relationEn: 'mentor/rival/friend mirror the flaw, apply pressure and give support, while changing themselves',
    directiveZh: '人物走成长蜕变路线：主角开局带明确缺陷或认知盲区，经触发事件入局，在连续试炼中付出真实代价、逐级转变，关键蜕变前先有至暗时刻；成长三步一回头——旧我会反复、会犹豫，转变才可信；导师、对手、伙伴分别照见缺陷、施加压力、提供支撑且各自有变化；禁止开局满级、突然顿悟、被别人说教两句就脱胎换骨。',
    directiveEn: 'Use a growth arc: the lead opens with a clear flaw or blind spot, enters via a trigger, pays real costs through successive trials and changes step by step, with a darkest moment before the key transformation; growth zigzags—the old self relapses and hesitates, which makes change credible; mentor, rival and friend respectively mirror the flaw, apply pressure and provide support, each changing as well; forbid starting overpowered, sudden enlightenment, or reinvention after one lecture.',
    kw: ['成长', '热血', '青春', '励志', '治愈', '竞技', '蜕变', '弧光', '少年', 'growth', 'coming of age', 'character arc', 'underdog journey', 'training', 'inspirational'],
  },
];
const CHARACTER_BY_ID = new Map(CHARACTER_STRATEGIES.map((s) => [s.id, s]));


// ============================ 系统智能推荐 ============================
function matchByKeywords(text: string, list: { id: string; kw: string[] }[], fallback: string): string {
  const t = (text || '').toLowerCase();
  for (const item of list) {
    if (item.kw.some((k) => t.includes(k.toLowerCase()))) return item.id;
  }
  return fallback;
}
export interface StrategyRec<T> { id: T; auto: boolean; reason: string; reasonEn: string }
export function recommendPace(context: { text?: string; tags?: string[]; mode?: string } = {}): StrategyRec<PaceStrategyId> {
  const hay = [context.text ?? '', (context.tags ?? []).join(' '), context.mode ?? ''].join(' ');
  const order: PaceStrategy[] = [PACE_BY_ID.get('suspense_burn')!, PACE_BY_ID.get('fastcut')!, PACE_BY_ID.get('emotional_wave')!, PACE_BY_ID.get('cinematic')!];
  const id = matchByKeywords(hay, order, 'standard') as PaceStrategyId;
  const s = PACE_BY_ID.get(id)!;
  const auto = id === 'standard';
  return {
    id, auto,
    reason: auto ? `未识别到强节奏偏向，默认「${s.name}」：${s.tagline}。` : `检测到题材特征，为你默认采用「${s.name}」：${s.tagline}（可随时切换）。`,
    reasonEn: auto ? `No strong pacing signal; defaulting to “${s.nameEn}”: ${s.taglineEn}.` : `Genre detected, defaulting to “${s.nameEn}”: ${s.taglineEn} (switch anytime).`,
  };
}
export function recommendDialogue(context: { text?: string; tags?: string[]; mode?: string } = {}): StrategyRec<DialogueStrategyId> {
  const hay = [context.text ?? '', (context.tags ?? []).join(' '), context.mode ?? ''].join(' ');
  const order: DialogueStrategy[] = [DIALOGUE_BY_ID.get('street')!, DIALOGUE_BY_ID.get('sharp')!, DIALOGUE_BY_ID.get('elegant')!, DIALOGUE_BY_ID.get('youthful')!];
  const id = matchByKeywords(hay, order, 'natural') as DialogueStrategyId;
  const s = DIALOGUE_BY_ID.get(id)!;
  const auto = id === 'natural';
  return {
    id, auto,
    reason: auto ? `未识别到特殊台词风格，默认「${s.name}」：${s.tagline}。` : `按题材为你默认「${s.name}」：${s.tagline}（可随时切换）。`,
    reasonEn: auto ? `No strong dialogue signal; defaulting to “${s.nameEn}”: ${s.taglineEn}.` : `By genre, defaulting to “${s.nameEn}”: ${s.taglineEn} (switch anytime).`,
  };
}

// ============================ 解析与指令 ============================
export function getPaceStrategy(id?: string | null): PaceStrategy { return PACE_BY_ID.get((id || '') as PaceStrategyId) ?? PACE_BY_ID.get('standard')!; }
/** v2.29 节奏策略建议每集场景数区间（数值级硬绑定场景规划用） */
export function getPaceStrategyRange(id?: string | null): [number, number] { return [...getPaceStrategy(id).scenesPerEp]; }
export function getDialogueStrategy(id?: string | null): DialogueStrategy { return DIALOGUE_BY_ID.get((id || '') as DialogueStrategyId) ?? DIALOGUE_BY_ID.get('natural')!; }
export function isValidPace(id: string): boolean { return PACE_BY_ID.has(id as PaceStrategyId); }
export function isValidDialogue(id: string): boolean { return DIALOGUE_BY_ID.has(id as DialogueStrategyId); }

/** 用户显式优先，否则系统按题材推荐；返回最终策略 id */
export function resolvePaceId(chosen: string | undefined | null, ctx: { text?: string; tags?: string[]; mode?: string }): PaceStrategyId {
  if (chosen && isValidPace(chosen)) return chosen as PaceStrategyId;
  return recommendPace(ctx).id;
}
export function resolveDialogueId(chosen: string | undefined | null, ctx: { text?: string; tags?: string[]; mode?: string }): DialogueStrategyId {
  if (chosen && isValidDialogue(chosen)) return chosen as DialogueStrategyId;
  return recommendDialogue(ctx).id;
}
export function paceDirective(id: string | undefined | null, lang: StrategyLang = 'zh'): string {
  const s = getPaceStrategy(id);
  return lang === 'en' ? `[Pacing strategy: ${s.nameEn}] ${s.directiveEn}` : `【节奏策略：${s.name}】${s.directiveZh}`;
}
export function dialogueDirective(id: string | undefined | null, lang: StrategyLang = 'zh'): string {
  const s = getDialogueStrategy(id);
  return lang === 'en' ? `[Dialogue style: ${s.nameEn}] ${s.directiveEn} Sentence shape: ${s.sentenceEn}.` : `【台词风格：${s.name}】${s.directiveZh}句式：${s.sentence}。`;
}
export function describePace(id: string, lang: StrategyLang = 'zh') {
  const s = getPaceStrategy(id);
  return lang === 'en' ? { id: s.id, name: s.nameEn, tagline: s.taglineEn, fit: s.fitEn, scenesPerEp: s.scenesPerEp } : { id: s.id, name: s.name, tagline: s.tagline, fit: s.fit, scenesPerEp: s.scenesPerEp };
}
export function describeDialogue(id: string, lang: StrategyLang = 'zh') {
  const s = getDialogueStrategy(id);
  return lang === 'en' ? { id: s.id, name: s.nameEn, tagline: s.taglineEn, fit: s.fitEn, colloquial: s.colloquial, sentence: s.sentenceEn } : { id: s.id, name: s.name, tagline: s.tagline, fit: s.fit, colloquial: s.colloquial, sentence: s.sentence };
}
export function listPace(lang: StrategyLang = 'zh') { return PACE_IDS.map((id) => describePace(id, lang)); }
export function listDialogue(lang: StrategyLang = 'zh') { return DIALOGUE_IDS.map((id) => describeDialogue(id, lang)); }

// ---- 情绪/爽点曲线 ----
export function recommendEmotion(context: { text?: string; tags?: string[]; mode?: string } = {}): StrategyRec<EmotionStrategyId> {
  const hay = [context.text ?? '', (context.tags ?? []).join(' '), context.mode ?? ''].join(' ');
  // 顺序：虐心 → 甜暖 → 反转 → 爽感 → 均衡（爽感词覆盖面广，放后避免误吞“反爽剧”等）
  const order: EmotionStrategy[] = [EMOTION_BY_ID.get('angst_tug')!, EMOTION_BY_ID.get('sweet_heal')!, EMOTION_BY_ID.get('twist_puzzle')!, EMOTION_BY_ID.get('payoff_dense')!];
  const id = matchByKeywords(hay, order, 'balanced') as EmotionStrategyId;
  const s = EMOTION_BY_ID.get(id)!;
  const auto = id === 'balanced';
  return {
    id, auto,
    reason: auto ? `未识别到强情绪偏向，默认「${s.name}」：${s.tagline}。` : `按题材为你默认「${s.name}」：${s.tagline}（可随时切换）。`,
    reasonEn: auto ? `No strong emotional signal; defaulting to “${s.nameEn}”: ${s.taglineEn}.` : `By genre, defaulting to “${s.nameEn}”: ${s.taglineEn} (switch anytime).`,
  };
}
export function getEmotionStrategy(id?: string | null): EmotionStrategy { return EMOTION_BY_ID.get((id || '') as EmotionStrategyId) ?? EMOTION_BY_ID.get('balanced')!; }
export function isValidEmotion(id: string): boolean { return EMOTION_BY_ID.has(id as EmotionStrategyId); }
export function resolveEmotionId(chosen: string | undefined | null, ctx: { text?: string; tags?: string[]; mode?: string }): EmotionStrategyId {
  if (chosen && isValidEmotion(chosen)) return chosen as EmotionStrategyId;
  return recommendEmotion(ctx).id;
}
/** 映射为节拍系统风味偏好（balanced 返回全空数组，交由钩子策略/默认排布，不打架） */
export function emotionBeatHints(id: string | undefined | null): { payoffFlavors: string[]; reversalFlavors: string[]; emotionFlavors: string[] } {
  const s = getEmotionStrategy(id);
  return { payoffFlavors: [...s.payoffFlavors], reversalFlavors: [...s.reversalFlavors], emotionFlavors: [...s.emotionFlavors] };
}
export function emotionDirective(id: string | undefined | null, lang: StrategyLang = 'zh'): string {
  const s = getEmotionStrategy(id);
  return lang === 'en' ? `[Emotional arc: ${s.nameEn}] ${s.directiveEn}` : `【情绪曲线：${s.name}】${s.directiveZh}`;
}
export function describeEmotion(id: string, lang: StrategyLang = 'zh') {
  const s = getEmotionStrategy(id);
  return lang === 'en' ? { id: s.id, name: s.nameEn, tagline: s.taglineEn, fit: s.fitEn } : { id: s.id, name: s.name, tagline: s.tagline, fit: s.fit };
}
export function listEmotion(lang: StrategyLang = 'zh') { return EMOTION_IDS.map((id) => describeEmotion(id, lang)); }

// ---- 人物与关系（v2.37 第五套策略层） ----
export function recommendCharacter(context: { text?: string; tags?: string[]; mode?: string } = {}): StrategyRec<CharacterStrategyId> {
  const hay = [context.text ?? '', (context.tags ?? []).join(' '), context.mode ?? ''].join(' ');
  // 顺序：群像 → 关系 → 反差 → 成长 → 立体真实（反差词面窄但信号强，放成长前避免“成长逆袭”误吞）
  const order: CharacterStrategy[] = [CHARACTER_BY_ID.get('ensemble')!, CHARACTER_BY_ID.get('bond_dynamic')!, CHARACTER_BY_ID.get('contrast')!, CHARACTER_BY_ID.get('growth_arc')!];
  const id = matchByKeywords(hay, order, 'grounded') as CharacterStrategyId;
  const s = CHARACTER_BY_ID.get(id)!;
  const auto = id === 'grounded';
  return {
    id, auto,
    reason: auto ? `未识别到特殊人物结构，默认「${s.name}」：${s.tagline}。` : `按题材为你默认「${s.name}」：${s.tagline}（可随时切换）。`,
    reasonEn: auto ? `No strong character-structure signal; defaulting to “${s.nameEn}”: ${s.taglineEn}.` : `By genre, defaulting to “${s.nameEn}”: ${s.taglineEn} (switch anytime).`,
  };
}
export function getCharacterStrategy(id?: string | null): CharacterStrategy { return CHARACTER_BY_ID.get((id || '') as CharacterStrategyId) ?? CHARACTER_BY_ID.get('grounded')!; }
export function isValidCharacter(id: string): boolean { return CHARACTER_BY_ID.has(id as CharacterStrategyId); }
export function resolveCharacterId(chosen: string | undefined | null, ctx: { text?: string; tags?: string[]; mode?: string }): CharacterStrategyId {
  if (chosen && isValidCharacter(chosen)) return chosen as CharacterStrategyId;
  return recommendCharacter(ctx).id;
}
export function characterDirective(id: string | undefined | null, lang: StrategyLang = 'zh'): string {
  const s = getCharacterStrategy(id);
  return lang === 'en'
    ? `[Character & relationship: ${s.nameEn}] ${s.directiveEn} Lead: ${s.leadEn}. Relationship web: ${s.relationEn}.`
    : `【人物与关系策略：${s.name}】${s.directiveZh}主角：${s.lead}。关系网：${s.relation}。`;
}
export function describeCharacter(id: string, lang: StrategyLang = 'zh') {
  const s = getCharacterStrategy(id);
  return lang === 'en' ? { id: s.id, name: s.nameEn, tagline: s.taglineEn, fit: s.fitEn, lead: s.leadEn, relation: s.relationEn }
    : { id: s.id, name: s.name, tagline: s.tagline, fit: s.fit, lead: s.lead, relation: s.relation };
}
export function listCharacter(lang: StrategyLang = 'zh') { return CHARACTER_IDS.map((id) => describeCharacter(id, lang)); }
