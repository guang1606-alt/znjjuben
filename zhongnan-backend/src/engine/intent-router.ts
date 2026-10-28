/**
 * v2.329 意图路由：自然语言 → 8 种创作模式 + 剧本类型 + 灵感子轨道（零 LLM、纯本地、可解释）
 *
 * 产品目的：用户不必先判断「我该选哪个模式」，直接把想做什么写进创意框，
 * 由本模块给出 canonical mode + scriptType + spark track + 置信度；低置信时诚实标记 needsClarify，
 * 由前端引导到采访式创作（对话式引导），绝不静默猜测一个高等级模式硬扣费。
 *
 * 约束：
 *  · 只在「当前会员等级可用」的模式里选（避免推荐后 403 白跑一趟）
 *  · 完全确定性：同一输入永远同一结果（可测试、可回归）
 *  · 中文用子串命中，英文用整词边界命中（避免 bug→debug 这类误伤）
 */
import { MemberLevel } from '../config/pricing';
import {
  CREATION_MODES, ModeId, SparkTrack, ScriptTypeId, canonicalSparkTrack,
  modesForLevel, scriptTypesForLevel, scriptTypeAvailable,
} from '../config/modes';

/** 线上可识别的「自动」入口别名（建项目时传 mode=auto 即触发路由） */
export const AUTO_MODE_ALIASES = ['auto', 'smart', 'recommend', 'auto_mode'] as const;

export function isAutoMode(id: string | null | undefined): boolean {
  if (!id) return false;
  return (AUTO_MODE_ALIASES as readonly string[]).includes(String(id).trim().toLowerCase());
}

interface ModeSignals {
  /** 强信号：出现即高度指向该模式（每个命中计 3 分） */
  strong: string[];
  /** 弱信号：辅助判断（每个命中计 1 分） */
  weak: string[];
}

/** 关键词表：中文子串 + 英文整词；宁少勿滥，避免「爆款」这类泛词把某模式吃满 */
export const MODE_SIGNALS: Record<ModeId, ModeSignals> = {
  tag: {
    strong: ['标签组合', '题材组合', '一键出本', 'tag combo'],
    weak: ['标签', '题材', 'tag'],
  },
  interview: {
    strong: ['还没想好', '不知道', '帮我聊', '采访我', '聊聊', '引导我', '帮我理', '聊出', 'brainstorm', 'not sure', 'help me think', 'interview me'],
    weak: ['灵感', '想法很多', '零散', '模糊', '启发', 'idea', 'vague'],
  },
  diary: {
    strong: ['日记', '日志', '随笔', '心情记录', '日记本', 'diary', 'journal', 'diary entry'],
    weak: ['记录', '那天的', '回忆', 'memory', 'memoir'],
  },
  spark: {
    strong: ['灵感', '一句话', '续写', '改编', '同人', '衍生', '番外', '联动', '小说', '原著', '名场面', '爆款拆解', '拆解', '逆向', '对标', '拆剧', '短视频', '口播', '竖屏', 'idea', 'inspiration', 'adaptation', 'fanfic', 'spin-off', 'teardown', 'reverse-engineer', 'short video', 'tiktok'],
    weak: ['爆款', '骨架', '结构复用', '素材', '一条', 'hook', 'reels'],
  },
  hot: {
    strong: ['热点', '热搜', '追更', '借势', '蹭热度', '微博热搜', '今日头条', 'trending', 'hot topic', 'newsjacking'],
    weak: ['新闻', '事件', '舆情', '热搜榜', '爆点', '梗', 'viral trend'],
  },
  persona: {
    strong: ['角色自述', '自述', '第一人称', '独白', '角色视角', 'monologue', 'first-person', 'first person', 'character voice', 'unreliable narrator'],
    weak: ['口吻', '内心', '我是', 'voice', 'memoir'],
  },
  duel: {
    strong: ['对撞', '双人', '对决', '对峙', '双雄', '辩论', '两人交手', 'face-off', 'duel', 'two-hander', 'two hander', 'confrontation'],
    weak: ['较量', '拉锯', '摊牌', 'standoff', 'versus'],
  },
  multiverse: {
    strong: ['世界线', '平行时空', '平行宇宙', '多结局', '分支', '蝴蝶效应', '如果当初', '世界线推演', 'multiverse', 'parallel universe', 'what if', 'branching', 'multiple endings', 'world line'],
    weak: ['推演', '另一种可能', '时空', 'choice', 'endings'],
  },
};

/** 剧本类型关键词（第二维：成品形态；与模式正交，可单独识别） */
export const SCRIPT_TYPE_SIGNALS: Record<ScriptTypeId, string[]> = {
  live_action_drama: ['真人', '实拍', '真人短剧', 'live action'],
  aigc_drama: ['aigc', '漫剧', '动漫', 'ai短剧', 'animated'],
  short_video: ['短视频', '竖屏', '口播', '抖音', '快手', '视频号', 'short video', 'tiktok', 'reels'],
  ad_script: ['广告', '软广', '品牌植入', '带货', '种草', 'branded', 'ad script'],
  promo_script: ['宣传片', '形象片', '企业片', 'promo'],
  tv_series: ['电视剧', '网剧', '多集', '集数', 'tv series', 'web series'],
  interactive_drama: ['互动剧', '互动短剧', 'interactive drama'],
  feature_film: ['电影', '院线', '长片', 'feature film', 'screenplay'],
  long_series: ['长系列', '多季', '季终', 'ip宇宙', 'franchise', 'multi-season'],
};

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;
/** 低置信阈值：低于此值不硬猜，交由前端引导澄清 */
export const CLARIFY_THRESHOLD = 0.45;
/** 剧本类型识别的最低分（低于此分不写死类型，交给前端默认） */
export const SCRIPT_TYPE_THRESHOLD = 3;

const MODE_NAME: Record<ModeId, string> = CREATION_MODES.reduce((acc, m) => {
  acc[m.id] = m.name;
  return acc;
}, {} as Record<ModeId, string>);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 中文按子串命中；纯 ASCII 关键词按整词边界命中（避免 bug 命中 debug） */
function hitWord(text: string, word: string): boolean {
  const w = word.toLowerCase();
  if (/^[a-z0-9\- ]+$/.test(w)) return new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i').test(text);
  return text.includes(w);
}

function scoreMode(text: string, signals: ModeSignals): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  for (const w of signals.strong) {
    if (hitWord(text, w)) { score += STRONG_WEIGHT; matched.push(w); }
  }
  for (const w of signals.weak) {
    // 强信号已含该词时不再重复计分
    if (matched.includes(w)) continue;
    if (hitWord(text, w)) { score += WEAK_WEIGHT; matched.push(w); }
  }
  return { score, matched };
}

export interface IntentRouteInput {
  brief?: string;
  title?: string;
  tags?: string[];
  /** 当前会员等级：只在可用模式/类型里推荐；缺省按 FREE */
  level?: MemberLevel;
  /** 内部账户：不受等级限制 */
  isStaff?: boolean;
}

export interface IntentAlternative {
  mode: ModeId;
  name: string;
  score: number;
  locked: boolean;
  unlockLevel: MemberLevel;
}

/** 路由后必须先经过的确认闸门（前端据此弹对应流程，绝不跳过） */
export type RouteGate = 'spark_confirm' | 'diary_authorize' | 'hot_compliance';

export interface IntentRouteResult {
  mode: ModeId;
  name: string;
  confidence: number;
  needsClarify: boolean;
  scriptType?: ScriptTypeId;
  track?: SparkTrack;
  gate?: RouteGate;
  alternatives: IntentAlternative[];
  reasons: string[];
}

/** 灵感轨道：出现「拆解整剧/方法论/批量换皮」→ 爆款逆向；出现「名场面/高能场面」→ 名场面拓展；否则素材改编 */
function routeSparkTrack(text: string): SparkTrack {
  const reverse = ['拆解', '逆向', '方法论', '换皮', '批量', '骨架', '对标', 'teardown', 'reverse', 'benchmark', 'skeleton'];
  if (reverse.some((w) => hitWord(text, w))) return 'hit_reverse';
  const signature = ['名场面', '高能场面', '关键场面', 'signature scene', 'peak scene'];
  if (signature.some((w) => hitWord(text, w))) return 'signature_scene';
  return 'material_rewrite';
}

/** 剧本类型识别：只在命中足够明确时给出，避免「短」这类泛词误判 */
export function routeScriptType(text: string, level: MemberLevel = MemberLevel.FREE): ScriptTypeId | undefined {
  const allowed = scriptTypesForLevel(level).map((t) => t.id);
  let best: { id: ScriptTypeId; score: number } | null = null;
  for (const [id, words] of Object.entries(SCRIPT_TYPE_SIGNALS) as [ScriptTypeId, string[]][]) {
    const score = words.filter((w) => hitWord(text, w)).length;
    if (!best || score > best.score) best = { id, score };
  }
  if (!best || best.score * STRONG_WEIGHT < SCRIPT_TYPE_THRESHOLD) return undefined;
  // 等级不够的类型不硬塞；交给前端展示升级提示
  return scriptTypeAvailable(best.id, level) ? best.id : undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 置信度：强度（命中多少信号）+ 领先幅度（与第二名的差）共同决定。
 * 只有单个弱词命中时约 0.5，低于澄清阈值——诚实承认「信息不足」。
 */
function confidenceOf(top: number, second: number): number {
  if (top <= 0) return 0;
  const strength = Math.min(1, top / 4);
  const margin = (top - second) / top;
  return round2(Math.min(0.98, 0.25 * strength + 0.45 * margin + (top >= 2 ? 0.2 : 0)));
}

export function routeIntent(input: IntentRouteInput): IntentRouteResult {
  const text = `${input.brief ?? ''}\n${input.title ?? ''}`.toLowerCase();
  const available = input.isStaff
    ? CREATION_MODES.map((m) => m.id)
    : modesForLevel(input.level ?? MemberLevel.FREE).map((m) => m.id);
  const level = input.level ?? MemberLevel.FREE;

  // 「用户真的写了点东西」才有资格触发短正文的信号，否则纯标题不足以推断意图
  const hasBrief = (input.brief ?? '').trim().length > 0;
  const scored = (Object.keys(MODE_SIGNALS) as ModeId[]).map((mode) => {
    const r = scoreMode(text, MODE_SIGNALS[mode]);
    let score = r.score;
    // 结构化信号：标签越多，标签创建越合理（但仍可能被正文强信号压过）
    if (mode === 'tag' && (input.tags?.length ?? 0) > 0) score += Math.min(3, input.tags!.length);
    // 正文很短且无明确指向 → 采访式创作（对话引导）才是正确归宿
    if (mode === 'interview' && hasBrief && text.trim().length < 8) score += 2;
    // 超长正文（多半是贴了原作/日记）→ 灵感式的素材改编
    if (mode === 'spark' && (input.brief?.length ?? 0) > 2000) score += 1;
    // kwScore 单独留存：置信度只认「说出口的关键词」，结构信号不得伪装成确定性
    return { mode, score, kwScore: r.score, matched: r.matched, locked: !available.includes(mode) };
  });

  const sorted = [...scored].sort((a, b) => (b.score - a.score) || (a.mode < b.mode ? -1 : 1));
  const open = sorted.filter((x) => !x.locked && x.score > 0);
  const top = open[0];

  const reasons: string[] = [];
  // 被等级锁住的更强候选：如实说明，不静默降级（用户知道升级能拿到更准的模式）
  const lockedBetter = sorted.find((x) => x.locked && x.score > 0 && (!top || x.score > top.score));
  if (lockedBetter) {
    const m = CREATION_MODES.find((x) => x.id === lockedBetter.mode);
    reasons.push(`「${MODE_NAME[lockedBetter.mode]}」更贴近你的描述，但需${m?.minLevel ?? '更高'}会员`);
  }

  if (!top) {
    // 零信号：有标签走标签创建，否则引导采访式创作
    const fallback: ModeId = available.includes('tag') ? 'tag' : (available[0] ?? 'interview');
    reasons.push('未识别到明确模式信号，先用最轻量的方式起稿；随时可切换');
    return {
      mode: fallback,
      name: MODE_NAME[fallback] ?? fallback,
      confidence: 0,
      needsClarify: true,
      alternatives: [],
      reasons,
    };
  }

  if (top.matched.length) {
    reasons.unshift(`命中关键词：${top.matched.slice(0, 4).join('、')}`);
  }

  const second = open.filter((x) => x.mode !== top.mode)[0]?.kwScore ?? 0;
  const confidence = confidenceOf(top.kwScore, second);
  // 路由到采访式创作本身就说明「想法还在雏形」——即使模式判断很确定，也需要澄清
  // kwScore=0 表示只靠结构信号（标签数/超短正文）选中，同样必须标记信息不足
  const needsClarify = top.kwScore === 0 || confidence < CLARIFY_THRESHOLD || top.mode === 'interview';

  let track: SparkTrack | undefined;
  let gate: RouteGate | undefined;
  if (top.mode === 'spark') {
    track = routeSparkTrack(text);
    // 轨道分级：逆向批量仅专业版、名场面仅高级版；不足时降级到素材改编，不直接 403
    if (track === 'hit_reverse' && !input.isStaff && level !== MemberLevel.PRO) {
      reasons.push('「爆款逆向批量」为专业版轨道，已先按「素材改编」起稿');
      track = 'material_rewrite';
    } else if (track === 'signature_scene' && !input.isStaff
      && level !== MemberLevel.ADVANCED && level !== MemberLevel.PRO) {
      reasons.push('「名场面拓展」为高级会员轨道，已先按「素材改编」起稿');
      track = 'material_rewrite';
    }
    // 灵感式硬约束：未确认不落稿
    gate = 'spark_confirm';
  } else if (top.mode === 'diary') {
    // 日记式硬约束：必须显式授权（摘要/指定段落/全部）后才可梳理成剧本
    gate = 'diary_authorize';
  } else if (top.mode === 'hot') {
    // 热点式硬约束：生成前必须给合规与时效提示
    gate = 'hot_compliance';
  }

  const scriptType = routeScriptType(text, level);

  if (needsClarify) {
    reasons.push(top.mode === 'interview'
      ? '想法还在雏形：建议用采访式创作把人物、冲突、结局聊清楚后再动笔'
      : '描述里可判断的信息偏少；可直接生成，也可先用采访式创作聊清楚再写');
  }

  return {
    mode: top.mode,
    name: MODE_NAME[top.mode] ?? top.mode,
    confidence,
    needsClarify,
    ...(scriptType ? { scriptType } : {}),
    ...(track ? { track } : {}),
    ...(gate ? { gate } : {}),
    alternatives: open
      .filter((x) => x.mode !== top.mode)
      .slice(0, 3)
      .map((x) => ({
        mode: x.mode,
        name: MODE_NAME[x.mode] ?? x.mode,
        score: x.score,
        locked: false,
        unlockLevel: CREATION_MODES.find((m) => m.id === x.mode)?.minLevel ?? MemberLevel.FREE,
      })),
    reasons,
  };
}

/** 供测试与前端提示：把路由结果压成一句话 */
export function describeRoute(r: IntentRouteResult, lang: 'zh' | 'en' = 'zh'): string {
  const trackName = r.track === 'hit_reverse'
    ? (lang === 'en' ? 'hit reverse batch' : '爆款逆向批量')
    : r.track === 'signature_scene'
      ? (lang === 'en' ? 'signature scene' : '名场面拓展')
      : (lang === 'en' ? 'material rewrite' : '素材改编');
  if (lang === 'en') {
    return r.track
      ? `Auto-routed to ${r.name} · ${trackName} (${Math.round(r.confidence * 100)}%)`
      : `Auto-routed to ${r.name} (${Math.round(r.confidence * 100)}%)`;
  }
  return r.track
    ? `已自动识别：${r.name} · ${trackName}（置信度 ${Math.round(r.confidence * 100)}%）`
    : `已自动识别：${r.name}（置信度 ${Math.round(r.confidence * 100)}%）`;
}
