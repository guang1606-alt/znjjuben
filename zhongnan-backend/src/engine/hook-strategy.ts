/**
 * 钩子策略层（v2.27）——把导演思路产品化：用户看得懂的「策略选项」+ 系统按题材智能默认
 * ------------------------------------------------------------------
 * hook-system 已有四层 29 钩与 CuePref（auto/manual/hybrid、强度、偏好/禁用/逐点指定、微钩风味），
 * 但普通用户读不懂 CuePref。本模块把它封装成 5 个有名字、有适用说明的「钩子策略」：
 *   balanced 均衡标准流 / dense 强钩密集流 / suspense 悬念牵引流 / emotion 情绪沉浸流 / premium 精品慢热流
 * 用户：①不选 → 系统按题材/标签/模式智能推荐默认并给出“为什么”（小南可直接念给用户）；
 *       ②自选 → 尊重用户；③仍可在 hybrid/manual 下逐点覆盖（CuePref.manual 原样支持）。
 * 举一反三：同一策略同时给出节拍风味建议（爽点/反转/情绪），由调用方与用户显式 beatPref 合并（用户优先）。
 * 纯函数、双语、确定性；产出的所有钩子 id 均来自 hook-system 合法集合，绝不发明 id。
 */
import {
  CuePref, DEFAULT_PREF, Strength, HookFlavor, HOOK_FLAVORS, VALID_FLAVORS,
} from './hook-system';
import { PAYOFF_FLAVORS, REVERSAL_FLAVORS, EMOTION_FLAVORS } from './beat-system';

export type StrategyLang = 'zh' | 'en';
export type HookStrategyId = 'balanced' | 'dense' | 'suspense' | 'emotion' | 'premium';
export const HOOK_STRATEGY_IDS: HookStrategyId[] = ['balanced', 'dense', 'suspense', 'emotion', 'premium'];
const VALID_STRATEGY = new Set<string>(HOOK_STRATEGY_IDS);

export interface BeatHints {
  payoffFlavors?: string[];
  reversalFlavors?: string[];
  emotionFlavors?: string[];
}
export interface HookStrategy {
  id: HookStrategyId;
  name: string; nameEn: string;
  tagline: string; taglineEn: string;
  fit: string; fitEn: string;             // 适用题材
  strength: Strength;
  microFlavors: HookFlavor[];
  preferred: string[];                    // 软偏好的合法钩子 id（开场/集尾/场层）
  avoid: string[];
  beatHints: BeatHints;
}

export const HOOK_STRATEGIES: HookStrategy[] = [
  {
    id: 'balanced', name: '均衡标准流', nameEn: 'Balanced standard',
    tagline: '张弛有度、钩子与留白均衡，最稳妥的通用选择', taglineEn: 'Even tension and breathing room — the safe all-purpose default',
    fit: '绝大多数题材、新用户首选、平台常规节奏', fitEn: 'Most genres; first-time users; standard platform pacing',
    strength: 'balanced', microFlavors: [], preferred: [], avoid: [],
    beatHints: {},
  },
  {
    id: 'dense', name: '强钩密集流', nameEn: 'Hook-dense',
    tagline: '开场即冲突、场场有牵引、卡点更狠，最大化完播与追更', taglineEn: 'Open on conflict, pull every scene forward, harder cliffhangers — maximize completion and binge',
    fit: '逆袭打脸、战神赘婿、复仇爽剧、下沉市场、追求强留存', fitEn: 'Comeuppance/underdog/revenge binge dramas, mass-market, retention-first',
    strength: 'tight',
    microFlavors: ['action', 'gap'],
    preferred: ['open_conflict', 'open_identity', 'open_endure', 'ep_cliff_danger', 'ep_cliff_reversal', 'scene_goal_block'],
    avoid: [],
    beatHints: { payoffFlavors: ['face_slap', 'comeback', 'status_crush'], emotionFlavors: ['hype_burn'] },
  },
  {
    id: 'suspense', name: '悬念牵引流', nameEn: 'Suspense-driven',
    tagline: '问题先行、伏笔连环、集尾揭秘将揭未揭，勾着观众找答案', taglineEn: 'Questions first, chained foreshadowing, reveal-cut endings that pull the audience toward the answer',
    fit: '悬疑烧脑、刑侦法医、谍战、推理罪案、科幻解谜', fitEn: 'Mystery, procedural/crime, spy, detective, sci-fi puzzle',
    strength: 'tight',
    microFlavors: ['gap', 'foreshadow', 'atmos'],
    preferred: ['open_suspense', 'open_countdown', 'ep_cliff_reveal', 'ep_cliff_reversal', 'ep_cliff_newperson', 'scene_info_drop', 'scene_cut_question'],
    avoid: [],
    beatHints: { reversalFlavors: ['truth_cause', 'cognition_overturn'], emotionFlavors: ['suspense_tug'] },
  },
  {
    id: 'emotion', name: '情绪沉浸流', nameEn: 'Emotion-immersion',
    tagline: '以情绪载体与潜台词推进，集尾停在情绪峰值，靠共情留人', taglineEn: 'Advance through emotion carriers and subtext; end on emotional peaks; retain via empathy',
    fit: '都市情感、甜宠虐恋、家庭年代、萌宝银发、女性群像、治愈', fitEn: 'Urban romance, sweet/angst, family, kids & elders, women’s ensemble, healing',
    strength: 'balanced',
    microFlavors: ['emotion', 'line'],
    preferred: ['open_line', 'ep_cliff_emotion', 'ep_cliff_choice'],
    avoid: [],
    beatHints: { payoffFlavors: ['sweet_warm', 'truth_justice'], emotionFlavors: ['tender_heal', 'tear_angst', 'press_release'] },
  },
  {
    id: 'premium', name: '精品慢热流', nameEn: 'Premium slow-burn',
    tagline: '减少硬卡点、靠氛围与质感细钩留人，留白更多、更高级', taglineEn: 'Fewer hard cliffhangers; retain via atmosphere and textured micro-hooks with more breathing room',
    fit: '精品短剧、电影感、文艺现实向、平台获奖/品牌定制', fitEn: 'Premium/arthouse, cinematic, realistic drama, award/brand productions',
    strength: 'relax',
    microFlavors: ['atmos', 'line', 'emotion'],
    preferred: ['open_line', 'open_abnormal'],
    avoid: ['open_endure'],
    beatHints: { emotionFlavors: ['tender_heal'] },
  },
];
const STRATEGY_BY_ID = new Map(HOOK_STRATEGIES.map((s) => [s.id, s]));
export function getHookStrategy(id: string | undefined | null): HookStrategy {
  return STRATEGY_BY_ID.get((id || '') as HookStrategyId) ?? STRATEGY_BY_ID.get('balanced')!;
}

// —— 系统智能默认：按题材关键词/标签/模式确定性推荐（命中即返回，顺序即优先级）——
const DETECT_RULES: { id: HookStrategyId; kw: string[] }[] = [
  { id: 'suspense', kw: ['悬疑', '刑侦', '法医', '谍战', '推理', '罪案', '烧脑', '探案', '惊悚', 'mystery', 'crime', 'detective', 'spy', 'thriller', 'procedural', 'noir', 'investigation'] },
  { id: 'dense', kw: ['逆袭', '打脸', '战神', '赘婿', '复仇', '爽剧', '爽文', '扮猪吃虎', '隐世高手', '霸总', '下沉', 'underdog', 'revenge', 'comeuppance', 'face slap', 'binge', 'war god'] },
  { id: 'emotion', kw: ['情感', '甜宠', '虐恋', '家庭', '亲情', '萌宝', '银发', '女性群像', '女性互助', '治愈', '婚恋', '婆媳', 'romance', 'sweet', 'angst', 'family', 'healing', 'sisterhood', 'ensemble', 'melodrama'] },
  { id: 'premium', kw: ['精品', '电影感', '文艺', '慢热', '现实向', 'arthouse', 'premium', 'cinematic', 'slow burn', 'literary'] },
];
export interface StrategyRecommendation { id: HookStrategyId; auto: boolean; reason: string; reasonEn: string }
export function recommendStrategy(context: { text?: string; tags?: string[]; mode?: string } = {}): StrategyRecommendation {
  const hay = [context.text ?? '', (context.tags ?? []).join(' '), context.mode ?? ''].join(' ').toLowerCase();
  for (const rule of DETECT_RULES) {
    const hit = rule.kw.find((k) => hay.includes(k.toLowerCase()));
    if (hit) {
      const s = STRATEGY_BY_ID.get(rule.id)!;
      return {
        id: rule.id, auto: true,
        reason: `检测到题材特征“${hit}”，为你默认采用「${s.name}」：${s.tagline}（你也可以随时切换其他策略）。`,
        reasonEn: `Detected the genre signal “${hit}”, so the system defaults to “${s.nameEn}”: ${s.taglineEn} (you can switch strategy anytime).`,
      };
    }
  }
  const s = STRATEGY_BY_ID.get('balanced')!;
  return {
    id: 'balanced', auto: true,
    reason: `未识别到强题材偏向，默认采用「${s.name}」：${s.tagline}，适配最广、最稳妥。`,
    reasonEn: `No strong genre signal detected; defaulting to “${s.nameEn}”: ${s.taglineEn} — the broadest, safest fit.`,
  };
}

const cleanFlavors = (arr: string[]): HookFlavor[] => arr.filter((x) => VALID_FLAVORS.has(x)) as HookFlavor[];
/**
 * 策略 → CuePref（钩子偏好）。用户显式 hookPref 永远优先：调用方应在用户未指定时才用本结果兜底。
 * mode 透传用户的 auto/hybrid/manual（默认 auto）；manual 逐点指定由调用方合并。
 */
export function strategyToCuePref(strategyId?: string | null, mode: CuePref['mode'] = 'auto'): CuePref {
  const s = getHookStrategy(strategyId);
  return {
    ...DEFAULT_PREF,
    mode,
    strength: s.strength,
    preferred: [...s.preferred],
    avoid: [...s.avoid],
    microFlavors: cleanFlavors(s.microFlavors),
  };
}
/** 策略 → 节拍风味建议（举一反三：爽点/反转/情绪），仅返回合法风味；用户显式选择优先，调用方负责合并 */
export function strategyBeatHints(strategyId?: string | null): BeatHints {
  const s = getHookStrategy(strategyId);
  const valid = (arr: string[] | undefined, ok: Set<string>) => (arr ?? []).filter((x) => ok.has(x));
  return {
    payoffFlavors: valid(s.beatHints.payoffFlavors, new Set(PAYOFF_FLAVORS)),
    reversalFlavors: valid(s.beatHints.reversalFlavors, new Set(REVERSAL_FLAVORS)),
    emotionFlavors: valid(s.beatHints.emotionFlavors, new Set(EMOTION_FLAVORS)),
  };
}

/** 用户可读的策略说明卡（前端策略选择面板 / 小南讲解用） */
export function describeStrategy(id: string, lang: StrategyLang = 'zh'): { id: HookStrategyId; name: string; tagline: string; fit: string; strength: string } {
  const s = getHookStrategy(id);
  const strengthZh: Record<Strength, string> = { relax: '松弛留白', balanced: '均衡', tight: '密集强钩' };
  const strengthEn: Record<Strength, string> = { relax: 'relaxed', balanced: 'balanced', tight: 'dense' };
  return lang === 'en'
    ? { id: s.id, name: s.nameEn, tagline: s.taglineEn, fit: s.fitEn, strength: strengthEn[s.strength] }
    : { id: s.id, name: s.name, tagline: s.tagline, fit: s.fit, strength: strengthZh[s.strength] };
}
export function listStrategies(lang: StrategyLang = 'zh') { return HOOK_STRATEGY_IDS.map((id) => describeStrategy(id, lang)); }

export function isValidHookStrategy(id: string): boolean { return VALID_STRATEGY.has(id); }
// 供测试/前端断言：策略里出现的每个 preferred/avoid 钩子 id 必须是合法四层钩
export function _allStrategyFlavors(): HookFlavor[] { return HOOK_FLAVORS; }
