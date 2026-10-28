/**
 * v2.329 三维创作结构：创作模式（8）× 剧本类型（9）× 输出语言（10）
 *
 * 设计根因：旧版把「创作入口」（怎么聊出来）与「成品形态」（写成长片还是短视频）
 * 混在同一层枚举里，导致模式数量膨胀且互相重叠。v2.329 拆成三个正交维度：
 *  · mode：用户怎么把想法交出来（采访/日记/标签/灵感/热点/自述/对撞/世界线）
 *  · scriptType：最终成品是什么（真人短剧/漫剧/电影/剧集/短视频/广告/宣传片/互动剧/长系列）
 *  · language：成稿主语言（10 个有短剧市场的语言，本地化而非直译）
 *
 * 会员分层按「算力与产能成本」而非「看起来高级」：
 *  FREE     tag（标签一键出本，单次成本最低）
 *  BASIC    interview / diary / spark（单线对话或单稿）
 *  ADVANCED hot / persona / duel（多轮检索或双角色对撞，token ×2 起）
 *  PRO      multiverse（多分支世界线推演，token ×4 起）+ feature_film / long_series 类型 + hit_reverse 批量
 *
 * 兼容铁律：所有历史 wire-id 必须仍有去处（旧项目打开不丢模式、不降级、不清空原文），
 * 因此保留 LEGACY_MODE_MAP 与 craftKeyOf（旧方法论/旧闸门按旧 key 继续生效）。
 */
import { MemberLevel } from './pricing';

/** 8 种创作入口 */
export type ModeId =
  | 'interview' | 'diary' | 'tag' | 'spark'
  | 'hot' | 'persona' | 'duel' | 'multiverse';

/** 9 种剧本类型（成品形态） */
export type ScriptTypeId =
  | 'live_action_drama' | 'aigc_drama' | 'feature_film' | 'tv_series'
  | 'short_video' | 'ad_script' | 'promo_script' | 'interactive_drama' | 'long_series';

/** 10 种输出主语言（覆盖主要短剧消费市场；小语种走本地化而非直译） */
export type LanguageCode =
  | 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'pt' | 'th' | 'id' | 'vi' | 'ar';

/** 灵感式的三条子轨道（旧 adapt / hit_lab / shortvideo 全部并入此处） */
export type SparkTrack = 'material_rewrite' | 'signature_scene' | 'hit_reverse';

const L = MemberLevel;
const LEVEL_ORDER: MemberLevel[] = [L.FREE, L.BASIC, L.ADVANCED, L.PRO];

/* ------------------------------------------------------------------ *
 * 一、创作模式注册表
 * ------------------------------------------------------------------ */
export interface CreationMode {
  id: ModeId;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  minLevel: MemberLevel;
  status?: 'available' | 'coming_soon';
  /** 该模式的成本量级（用于前端提示：单稿 / 双角色 / 多分支） */
  costNote?: string;
  costNoteEn?: string;
}

export const CREATION_MODES: CreationMode[] = [
  {
    id: 'tag', name: '标签创建', nameEn: 'Tag combo',
    desc: '标签组合，一键定向题材（最低算力：单稿直出）', descEn: 'Combine tags into a targeted draft (lowest cost: single pass)',
    minLevel: L.FREE,
  },
  {
    id: 'interview', name: '采访式创作', nameEn: 'Interview',
    desc: '对话式引导，把模糊创意聊成剧本', descEn: 'Conversational guidance turns vague ideas into a script',
    minLevel: L.BASIC, costNote: '单线对话', costNoteEn: 'single-thread dialogue',
  },
  {
    id: 'diary', name: '日记式创作', nameEn: 'Diary',
    desc: '在工具里写日记，经你授权后把日记梳理成剧本（摘要/指定段落/全部三档授权）',
    descEn: 'Write real diary entries; after explicit authorization the diary is distilled into a script (summary / selected passages / all)',
    minLevel: L.BASIC, costNote: '日记整理 + 单稿', costNoteEn: 'diary digest + single draft',
  },
  {
    id: 'spark', name: '灵感式创作', nameEn: 'Spark',
    desc: '一句话灵感或已有素材：AI 提供灵感，多轮对话直到你确认才落稿；含素材改编 / 名场面拓展 / 爆款逆向三条轨道',
    descEn: 'From a one-line spark or existing material: AI proposes ideas, multi-round dialogue, no draft until you confirm; includes material-rewrite / signature-scene / hit-reverse tracks',
    minLevel: L.BASIC, costNote: '多轮对话 + 单稿', costNoteEn: 'multi-round dialogue + single draft',
  },
  {
    id: 'hot', name: '实时热点创作', nameEn: 'Live trend',
    desc: '借势实时热点快速出本（生成前给合规与时效提示）', descEn: 'Draft fast off a live trend (compliance & timeliness notice before generation)',
    minLevel: L.ADVANCED, costNote: '热点检索 + 单稿', costNoteEn: 'trend retrieval + single draft',
  },
  {
    id: 'persona', name: '角色自述式', nameEn: 'Persona monologue',
    desc: '以角色的第一人称自述推进：谁在讲、为什么现在讲、讲到哪句崩不住——用不可靠叙述制造反转',
    descEn: 'First-person persona monologue: who speaks, why now, where the voice cracks — unreliable narration drives the twist',
    minLevel: L.ADVANCED, costNote: '角色声线 + 单稿', costNoteEn: 'persona voice + single draft',
  },
  {
    id: 'duel', name: '双人对撞式', nameEn: 'Two-hander duel',
    desc: '两个立场对立的角色轮流出招，每一轮都要升级筹码，直到一方无法再退',
    descEn: 'Two opposed characters trade moves round by round, escalating stakes until one cannot retreat',
    minLevel: L.ADVANCED, costNote: '双角色对撞（token ×2 起）', costNoteEn: 'dual-persona duel (token ×2+)',
  },
  {
    id: 'multiverse', name: '世界线推演式', nameEn: 'World-line deduction',
    desc: '从一个关键选择分叉出多条世界线，逐线推演代价与结局，可合并回主线',
    descEn: 'Fork one pivotal choice into multiple world-lines, deduce the cost and ending of each, then merge back into the mainline',
    minLevel: L.PRO, costNote: '多分支推演（token ×4 起）', costNoteEn: 'multi-branch deduction (token ×4+)',
  },
];

/* ------------------------------------------------------------------ *
 * 二、灵感式三条子轨道（旧 adapt / hit_lab / shortvideo 的归宿）
 * ------------------------------------------------------------------ */
export interface SparkTrackDef {
  id: SparkTrack;
  name: string;
  nameEn: string;
  minLevel: MemberLevel;
  desc: string;
  descEn: string;
}
export const SPARK_TRACKS: SparkTrackDef[] = [
  {
    id: 'material_rewrite', name: '素材改编', nameEn: 'Material rewrite',
    minLevel: L.BASIC,
    desc: '续写/衍生/联动/同人/小说压缩/短视频脚本——把已有素材改写成新本，只借方法不抄表达',
    descEn: 'Sequel / spin-off / crossover / fanfic / novel compression / short-video script — borrow the method, never the expression',
  },
  {
    id: 'signature_scene', name: '名场面拓展', nameEn: 'Signature-scene expansion',
    minLevel: L.ADVANCED,
    desc: '围绕一个高能名场面，向前补因、向后延果，扩成完整单集/全本',
    descEn: 'Build causes before and consequences after one high-energy scene into a full episode/script',
  },
  {
    id: 'hit_reverse', name: '爆款逆向批量', nameEn: 'Hit reverse-engineering batch',
    minLevel: L.PRO,
    desc: '拆解整剧爆款方法论骨架，替换人设/背景/世界观，批量产出不侵权新本',
    descEn: 'Extract a hit’s method skeleton, swap persona/setting/worldview and batch non-infringing drafts',
  },
];
export function canonicalSparkTrack(track: string | null | undefined): SparkTrack {
  const t = String(track ?? '').trim().toLowerCase();
  if (t === 'hit_reverse' || t === 'reverse' || t === 'viral_reverse' || t === 'hitlab_reverse') return 'hit_reverse';
  if (t === 'signature_scene' || t === 'scene' || t === 'signature') return 'signature_scene';
  return 'material_rewrite';
}

/* ------------------------------------------------------------------ *
 * 三、剧本类型（成品形态）
 * ------------------------------------------------------------------ */
export interface ScriptType {
  id: ScriptTypeId;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  minLevel: MemberLevel;
}
export const SCRIPT_TYPES: ScriptType[] = [
  { id: 'live_action_drama', name: '真人实拍短剧', nameEn: 'Live-action short drama', desc: '竖屏真人短剧，单集 2-3 分钟', descEn: 'Vertical live-action short drama, 2-3 min per episode', minLevel: L.FREE },
  { id: 'aigc_drama', name: 'AIGC 短剧 / 漫剧', nameEn: 'AIGC / animated drama', desc: 'AI 生成画面或漫剧，按镜头可执行性写', descEn: 'AI-generated or animated drama, written for shot executability', minLevel: L.BASIC },
  { id: 'short_video', name: '爆款短视频脚本', nameEn: 'Viral short-video script', desc: '强钩子前 3 秒 · 分镜化口播 · 每镜一句', descEn: 'Hook in 3s · storyboarded voiceover · one line per shot', minLevel: L.BASIC },
  { id: 'ad_script', name: '广告 / 软广脚本', nameEn: 'Ad / branded script', desc: '剧情化软广，品牌是解题者不是主角', descEn: 'Story-led branded script; brand solves, never stars', minLevel: L.BASIC },
  { id: 'promo_script', name: '宣传片脚本', nameEn: 'Promo film script', desc: '企业/城市/产品形象片，画面优先', descEn: 'Corporate / city / product promo, image-first', minLevel: L.BASIC },
  { id: 'tv_series', name: '电视剧 / 多集网剧', nameEn: 'TV / multi-episode series', desc: '常规剧集，单集 40-45 分钟或短剧多集', descEn: 'Standard episodes, 40-45 min or multi-episode short form', minLevel: L.ADVANCED },
  { id: 'interactive_drama', name: '互动剧', nameEn: 'Interactive drama', desc: '分支选择、多结局，需做分支闭环校验', descEn: 'Branching choices and multiple endings with closure validation', minLevel: L.ADVANCED },
  { id: 'feature_film', name: '电影剧本', nameEn: 'Feature film', desc: '三幕结构长片，90-120 分钟', descEn: 'Three-act feature, 90-120 minutes', minLevel: L.PRO },
  { id: 'long_series', name: '长系列 IP 连载', nameEn: 'Long-running IP series', desc: '多季/长系列，跨季伏笔账本与季终大钩', descEn: 'Multi-season IP with cross-season foreshadow ledger and finale hooks', minLevel: L.PRO },
];

export function canonicalScriptTypeId(id: string | null | undefined): ScriptTypeId | undefined {
  if (!id) return undefined;
  const key = String(id).trim().toLowerCase();
  const alias: Record<string, ScriptTypeId> = {
    drama: 'live_action_drama', short_drama: 'live_action_drama', live: 'live_action_drama', live_action: 'live_action_drama',
    aigc: 'aigc_drama', anime: 'aigc_drama', manga: 'aigc_drama', manju: 'aigc_drama',
    shortvideo: 'short_video', short: 'short_video', video: 'short_video',
    ad: 'ad_script', branded: 'ad_script', softad: 'ad_script',
    promo: 'promo_script', brand_film: 'promo_script',
    tv: 'tv_series', series: 'tv_series', web_series: 'tv_series',
    interactive: 'interactive_drama', branch: 'interactive_drama',
    film: 'feature_film', movie: 'feature_film',
    long_ip: 'long_series', longip: 'long_series',
  };
  if (SCRIPT_TYPES.some((t) => t.id === key)) return key as ScriptTypeId;
  return alias[key];
}

export function scriptTypeAvailable(id: string | null | undefined, level: MemberLevel): boolean {
  const canon = canonicalScriptTypeId(id);
  if (!canon) return false;
  const t = SCRIPT_TYPES.find((x) => x.id === canon)!;
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(t.minLevel);
}
export function scriptTypesForLevel(level: MemberLevel): ScriptType[] {
  return SCRIPT_TYPES.filter((t) => LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(t.minLevel));
}
export function scriptTypeUnlockLevel(id: string | null | undefined): MemberLevel | null {
  const canon = canonicalScriptTypeId(id);
  return canon ? SCRIPT_TYPES.find((x) => x.id === canon)!.minLevel : null;
}

/* ------------------------------------------------------------------ *
 * 四、输出语言
 * ------------------------------------------------------------------ */
export interface OutputLanguage {
  code: LanguageCode;
  name: string;
  nameEn: string;
  native: string;
  minLevel: MemberLevel;
}
export const OUTPUT_LANGUAGES: OutputLanguage[] = [
  { code: 'zh', name: '中文', nameEn: 'Chinese', native: '中文', minLevel: L.FREE },
  { code: 'en', name: '英语', nameEn: 'English', native: 'English', minLevel: L.FREE },
  { code: 'ja', name: '日语', nameEn: 'Japanese', native: '日本語', minLevel: L.BASIC },
  { code: 'ko', name: '韩语', nameEn: 'Korean', native: '한국어', minLevel: L.BASIC },
  { code: 'es', name: '西班牙语', nameEn: 'Spanish', native: 'Español', minLevel: L.BASIC },
  { code: 'pt', name: '葡萄牙语', nameEn: 'Portuguese', native: 'Português', minLevel: L.BASIC },
  { code: 'th', name: '泰语', nameEn: 'Thai', native: 'ไทย', minLevel: L.ADVANCED },
  { code: 'id', name: '印尼语', nameEn: 'Indonesian', native: 'Bahasa Indonesia', minLevel: L.ADVANCED },
  { code: 'vi', name: '越南语', nameEn: 'Vietnamese', native: 'Tiếng Việt', minLevel: L.ADVANCED },
  { code: 'ar', name: '阿拉伯语', nameEn: 'Arabic', native: 'العربية', minLevel: L.ADVANCED },
];
export function canonicalLanguageCode(v: string | null | undefined): LanguageCode | undefined {
  if (!v) return undefined;
  const key = String(v).trim().toLowerCase();
  const alias: Record<string, LanguageCode> = {
    cn: 'zh', chinese: 'zh', mandarin: 'zh', 'zh-cn': 'zh',
    english: 'en', jp: 'ja', japanese: 'ja', kr: 'ko', korean: 'ko',
    spanish: 'es', portuguese: 'pt', thai: 'th', indonesian: 'id', vietnamese: 'vi', arabic: 'ar',
  };
  if (OUTPUT_LANGUAGES.some((l) => l.code === key)) return key as LanguageCode;
  return alias[key];
}
export function languageAvailable(code: string | null | undefined, level: MemberLevel): boolean {
  const canon = canonicalLanguageCode(code);
  if (!canon) return false;
  const l = OUTPUT_LANGUAGES.find((x) => x.code === canon)!;
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(l.minLevel);
}
export function languagesForLevel(level: MemberLevel): OutputLanguage[] {
  return OUTPUT_LANGUAGES.filter((l) => LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(l.minLevel));
}
export function languageUnlockLevel(code: string | null | undefined): MemberLevel | null {
  const canon = canonicalLanguageCode(code);
  return canon ? OUTPUT_LANGUAGES.find((x) => x.code === canon)!.minLevel : null;
}

/* ------------------------------------------------------------------ *
 * 五、历史 wire-id → 新结构（兼容铁律：不留死胡同）
 * ------------------------------------------------------------------ */
export interface LegacyResolution {
  mode: ModeId;
  scriptType: ScriptTypeId;
  track?: SparkTrack;
  /** 是否来自历史 id（历史项目不按新类型/语言闸门二次收费） */
  legacy: boolean;
}

/**
 * 旧 9 模式（以及更早的 12 模式）拆解去向：
 *  · adapt / novel                → spark · material_rewrite · live_action_drama
 *  · hit_lab / scene              → spark · signature_scene
 *  · reverse / viral_reverse      → spark · hit_reverse
 *  · video_short / branded_skit / softad → spark · material_rewrite · short_video / ad_script
 *  · interactive                  → tag   · interactive_drama（互动剧下沉为类型）
 *  · long_ip                      → multiverse · long_series
 *  · film                         → persona · feature_film
 *  · mature_x / xscript           → persona · feature_film（成年分级仍由 mature 闸门单独管）
 */
export const LEGACY_MODE_MAP: Record<string, LegacyResolution> = {
  adapt: { mode: 'spark', scriptType: 'live_action_drama', track: 'material_rewrite', legacy: true },
  novel: { mode: 'spark', scriptType: 'live_action_drama', track: 'material_rewrite', legacy: true },
  hit_lab: { mode: 'spark', scriptType: 'live_action_drama', track: 'signature_scene', legacy: true },
  hitlab: { mode: 'spark', scriptType: 'live_action_drama', track: 'signature_scene', legacy: true },
  scene: { mode: 'spark', scriptType: 'live_action_drama', track: 'signature_scene', legacy: true },
  reverse: { mode: 'spark', scriptType: 'live_action_drama', track: 'hit_reverse', legacy: true },
  viral_reverse: { mode: 'spark', scriptType: 'live_action_drama', track: 'hit_reverse', legacy: true },
  video_short: { mode: 'spark', scriptType: 'short_video', track: 'material_rewrite', legacy: true },
  shortvideo: { mode: 'spark', scriptType: 'short_video', track: 'material_rewrite', legacy: true },
  short_video: { mode: 'spark', scriptType: 'short_video', track: 'material_rewrite', legacy: true },
  branded_skit: { mode: 'spark', scriptType: 'ad_script', track: 'material_rewrite', legacy: true },
  softad: { mode: 'spark', scriptType: 'ad_script', track: 'material_rewrite', legacy: true },
  soft_ad: { mode: 'spark', scriptType: 'ad_script', track: 'material_rewrite', legacy: true },
  interactive: { mode: 'tag', scriptType: 'interactive_drama', legacy: true },
  long_ip: { mode: 'multiverse', scriptType: 'long_series', legacy: true },
  longip: { mode: 'multiverse', scriptType: 'long_series', legacy: true },
  longseries: { mode: 'multiverse', scriptType: 'long_series', legacy: true },
  long_series: { mode: 'multiverse', scriptType: 'long_series', legacy: true },
  film: { mode: 'persona', scriptType: 'feature_film', legacy: true },
  mature_x: { mode: 'persona', scriptType: 'feature_film', legacy: true },
  xscript: { mode: 'persona', scriptType: 'feature_film', legacy: true },
  x_script: { mode: 'persona', scriptType: 'feature_film', legacy: true },
};

/** 线上 wire-id / 别名 → canonical ModeId（含全部历史 id） */
export const MODE_ALIASES: Record<string, ModeId> = {
  // 新 8 模式
  interview: 'interview', diary: 'diary', journal: 'diary', tag: 'tag', tags: 'tag',
  spark: 'spark', idea: 'spark', inspiration: 'spark',
  hot: 'hot', hotspot: 'hot', trend: 'hot', trending: 'hot',
  persona: 'persona', monologue: 'persona', first_person: 'persona',
  duel: 'duel', confrontation: 'duel', two_hander: 'duel',
  multiverse: 'multiverse', worldline: 'multiverse', world_line: 'multiverse',
  // 历史 id（v2.329 拆解后仍有去处）
  ...Object.fromEntries(Object.entries(LEGACY_MODE_MAP).map(([k, v]) => [k, v.mode])) as Record<string, ModeId>,
};

/** 历史 craft/闸门 key：保留旧方法论与旧硬闸门，避免合并后能力蒸发 */
const LEGACY_CRAFT_KEY: Record<string, string> = {
  adapt: 'adapt', novel: 'adapt', // v2.325 小说压缩并入改编，方法论共用一份（mode-gate 仍按 raw 给小说专属闸门）
  hit_lab: 'hit_lab', hitlab: 'hit_lab', scene: 'hit_lab', reverse: 'hit_lab', viral_reverse: 'hit_lab',
  video_short: 'video_short', shortvideo: 'video_short', short_video: 'video_short',
  branded_skit: 'video_short', softad: 'video_short', soft_ad: 'video_short',
  interactive: 'interactive', long_ip: 'long_ip', longip: 'long_ip', longseries: 'long_ip', long_series: 'long_ip',
  film: 'film', mature_x: 'film', xscript: 'film', x_script: 'film',
};

export function resolveCreationMode(raw: string | null | undefined): LegacyResolution | undefined {
  if (!raw) return undefined;
  const key = String(raw).trim().toLowerCase();
  const legacy = LEGACY_MODE_MAP[key];
  if (legacy) return legacy;
  const mode = MODE_ALIASES[key];
  if (!mode) return undefined;
  return { mode, scriptType: 'live_action_drama', legacy: false };
}

/** 把任意线上/历史 mode 字符串归一为规范 ModeId；无法识别返回 undefined */
export function canonicalModeId(id: string | null | undefined): ModeId | undefined {
  return resolveCreationMode(id)?.mode;
}

/** 解析模式的成品形态：显式 scriptType 优先，其次历史映射，最后默认真人短剧 */
export function resolveScriptType(raw: string | null | undefined, explicit?: string | null): ScriptTypeId | undefined {
  const picked = canonicalScriptTypeId(explicit);
  if (picked) return picked;
  return resolveCreationMode(raw)?.scriptType;
}

/**
 * 方法论/闸门查表 key：历史 id 保留旧 key（旧项目方法论与硬闸门一字不改），
 * 新 8 模式返回自身；spark 按轨道细分（material_rewrite→adapt，名场面/逆向→hit_lab）。
 */
export function craftKeyOf(raw: string | null | undefined, track?: string | null): string {
  if (!raw) return '';
  const key = String(raw).trim().toLowerCase();
  if (LEGACY_CRAFT_KEY[key]) return LEGACY_CRAFT_KEY[key];
  const mode = MODE_ALIASES[key];
  if (!mode) return key;
  if (mode === 'spark') {
    const t = canonicalSparkTrack(track);
    return t === 'material_rewrite' ? 'adapt' : 'hit_lab';
  }
  return mode;
}

/** 需要原文（n-gram 侵权闸门）的模式：素材改编 / 小说压缩 / 名场面 / 爆款逆向 */
export function isSourceTextMode(raw: string | null | undefined, track?: string | null): boolean {
  const k = craftKeyOf(raw, track);
  return k === 'adapt' || k === 'novel' || k === 'hit_lab';
}

/** 历史交互剧/短视频/长系列判断（前端与闸门复用，避免各处硬编码旧 id） */
export function isLegacyMode(raw: string | null | undefined): boolean {
  return !!raw && !!LEGACY_MODE_MAP[String(raw).trim().toLowerCase()];
}

/**
 * 成品形态 → 方法论 key（v2.331）。
 * v2.329 把「互动剧/短视频/软广/电影/长系列」从模式下沉为剧本类型后，新路径（8 模式 + 类型）
 * 不再经过 LEGACY_CRAFT_KEY，必须按类型补回该形态的方法论，否则「tag + 互动剧」拿不到
 * 真选择/分支闭环、「spark + 广告脚本」拿不到 3 秒钩子/每镜口播/CTA。
 * 只登记确实有专属方法论的形态：电视剧/AIGC/真人短剧共用模式方法论，不在此重复。
 */
const SCRIPT_TYPE_CRAFT_KEY: Partial<Record<ScriptTypeId, string>> = {
  short_video: 'video_short',
  ad_script: 'video_short', // 广告/软广共用短视频条目里的「剧情软广子轨道」
  promo_script: 'video_short',
  interactive_drama: 'interactive',
  feature_film: 'film',
  long_series: 'long_ip',
};

export function scriptTypeCraftKeyOf(scriptType: string | null | undefined): string | undefined {
  const canon = canonicalScriptTypeId(scriptType);
  return canon ? SCRIPT_TYPE_CRAFT_KEY[canon] : undefined;
}

/* ------------------------------------------------------------------ *
 * 六、会员闸门
 * ------------------------------------------------------------------ */
function findMode(modeId: string): CreationMode | undefined {
  const canon = canonicalModeId(modeId);
  return canon ? CREATION_MODES.find((m) => m.id === canon) : undefined;
}
export function isComingSoon(modeId: string): boolean {
  return findMode(modeId)?.status === 'coming_soon';
}
export function modeAvailable(modeId: string, level: MemberLevel): boolean {
  const mode = findMode(modeId);
  if (!mode || mode.status === 'coming_soon') return false;
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(mode.minLevel);
}
export function modesForLevel(level: MemberLevel): CreationMode[] {
  return CREATION_MODES.filter((m) => m.status !== 'coming_soon' && modeAvailable(m.id, level));
}
/** 引导升级：返回解锁该模式所需的最低等级名 */
export function unlockLevel(modeId: string): MemberLevel | null {
  return findMode(modeId)?.minLevel ?? null;
}

/** 轨道级权限：仅 spark 的三条轨道分级；其余模式/轨道走模式级权限 */
export function trackAvailable(modeId: string, track: string | undefined, level: MemberLevel): boolean {
  if (canonicalModeId(modeId) !== 'spark') return true;
  const t = SPARK_TRACKS.find((x) => x.id === canonicalSparkTrack(track));
  return !!t && LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf(t.minLevel);
}
export function trackUnlockLevel(modeId: string, track: string | undefined): MemberLevel | null {
  if (canonicalModeId(modeId) !== 'spark') return null;
  return SPARK_TRACKS.find((x) => x.id === canonicalSparkTrack(track))?.minLevel ?? null;
}

/** 项目级三维解析：旧项目 mode 缺 scriptType/language 时按历史映射兜底 */
export function resolveProjectAxes(input: { mode?: string | null; scriptType?: string | null; language?: string | null }): {
  mode?: ModeId; scriptType?: ScriptTypeId; language?: LanguageCode; legacy: boolean;
} {
  const res = resolveCreationMode(input.mode);
  return {
    mode: res?.mode,
    scriptType: resolveScriptType(input.mode, input.scriptType),
    language: canonicalLanguageCode(input.language) ?? 'zh',
    legacy: !!res?.legacy,
  };
}
