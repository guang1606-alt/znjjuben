/**
 * v2.328 意图路由：自然语言 → 9 种创作模式（零 LLM、纯本地、可解释）
 *
 * 产品目的：用户不必先判断「我该选哪个模式」，直接把想做什么写进创意框，
 * 由本模块给出 canonical mode + 名场面轨道 + 置信度；低置信时诚实标记 needsClarify，
 * 由前端引导到采访式创作（对话式引导），绝不静默猜测一个高等级模式硬扣费。
 *
 * 约束：
 *  · 只在「当前会员等级可用」的模式里选（避免推荐后 403 白跑一趟）
 *  · 完全确定性：同一输入永远同一结果（可测试、可回归）
 *  · 中文用子串命中，英文用整词边界命中（避免 bug→debug 这类误伤）
 */
import { MemberLevel } from '../config/pricing';
import {
  CREATION_MODES, ModeId, HitLabTrack, modesForLevel,
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

/** 关键词表：中文子串 + 英文整词；宁少勿滥，避免「爆款」这类泛词把短视频吃满 */
export const MODE_SIGNALS: Record<ModeId, ModeSignals> = {
  video_short: {
    strong: ['短视频', '口播', '竖屏', '前3秒', '前三秒', '3秒', '分镜', '抖音', '快手', '视频号', '带货', '种草', '软广', '品牌植入', 'short video', 'short-form', 'tiktok', 'reels', 'vertical video', 'voiceover'],
    weak: ['钩子', '转化', '完播', '15秒', '30秒', '60秒', '爆款', '传播', '广告', '品牌', 'cta', 'hook', 'ad'],
  },
  film: {
    strong: ['电影', '长片', '院线', '三幕', '90分钟', '120分钟', '银幕', '电影剧本', 'feature film', 'screenplay', 'three-act', 'feature-length'],
    weak: ['长片', '电影感', '犯罪', '惊悚', '黑暗', '人性', '悬疑大片', 'noir', 'thriller', 'drama feature'],
  },
  long_ip: {
    strong: ['长系列', '多季', '第一季', '第二季', '第三季', '季终', '世界观', 'ip宇宙', '系列剧', '长线运营', 'franchise', 'multi-season', 'seasons', 'cinematic universe'],
    weak: ['系列', '伏笔', '成长线', '群像', '跨季', 'saga', 'season arc'],
  },
  hot: {
    strong: ['热点', '热搜', '追更', '借势', '蹭热度', '微博热搜', '今日头条', 'trending', 'hot topic', 'newsjacking'],
    weak: ['新闻', '事件', '舆情', '热搜榜', '爆点', '梗', 'viral trend'],
  },
  interactive: {
    strong: ['互动剧', '互动短剧', '分支', '多结局', '玩家的选择', '选项', '剧情树', 'branching', 'multiple endings', 'choice-driven', 'interactive drama'],
    weak: ['选择', '结局', '支线', '沉浸', '抉择', 'endings', 'choice'],
  },
  hit_lab: {
    strong: ['名场面', '爆款拆解', '拆解', '逆向', '对标', '拆剧', '拆片', '方法论', '换皮', '批量出新本', 'teardown', 'reverse-engineer', 'benchmark'],
    weak: ['爆款', '骨架', '结构复用', '复刻', 'skeleton'],
  },
  adapt: {
    strong: ['改编', '续写', '同人', '衍生', '番外', '联动', '小说', '原著', '原文', 'adaptation', 'fanfic', 'fan fiction', 'spin-off', 'novel'],
    weak: ['原作', '章节', '角色沿用', '世界观沿用', 'sequel'],
  },
  interview: {
    strong: ['还没想好', '不知道', '帮我聊', '采访我', '聊聊', '引导我', '帮我理', '聊出', 'brainstorm', 'not sure', 'help me think', 'interview me'],
    weak: ['灵感', '想法很多', '零散', '模糊', '启发', 'idea', 'vague'],
  },
  tag: {
    strong: ['标签组合', '题材组合', '一键出本', 'tag combo'],
    weak: ['标签', '题材', 'tag'],
  },
};

const STRONG_WEIGHT = 3;
const WEAK_WEIGHT = 1;
/** 低置信阈值：低于此值不硬猜，交由前端引导澄清 */
export const CLARIFY_THRESHOLD = 0.45;

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
    // 强信号已含该词时不再重复计分（如「短视频」已命中，不再因「爆款」重复加分）
    if (matched.includes(w)) continue;
    if (hitWord(text, w)) { score += WEAK_WEIGHT; matched.push(w); }
  }
  return { score, matched };
}

export interface IntentRouteInput {
  brief?: string;
  title?: string;
  tags?: string[];
  /** 当前会员等级：只在可用模式里推荐；缺省按 FREE */
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

export interface IntentRouteResult {
  mode: ModeId;
  name: string;
  confidence: number;
  needsClarify: boolean;
  track?: HitLabTrack;
  alternatives: IntentAlternative[];
  reasons: string[];
}

/** 名场面轨道：出现「拆解整剧/方法论/批量换皮」→ 爆款逆向；否则名场面拓展 */
function routeTrack(text: string): HitLabTrack {
  const reverse = ['拆解', '逆向', '方法论', '换皮', '批量', '骨架', '对标', 'teardown', 'reverse', 'benchmark', 'skeleton'];
  return reverse.some((w) => hitWord(text, w)) ? 'hit_reverse' : 'signature_scene';
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

  // 「用户真的写了点东西」才有资格触发短正文的信号，否则纯标题不足以推断意图
  const hasBrief = (input.brief ?? '').trim().length > 0;
  const scored = (Object.keys(MODE_SIGNALS) as ModeId[]).map((mode) => {
    const r = scoreMode(text, MODE_SIGNALS[mode]);
    let score = r.score;
    // 结构化信号：标签越多，标签创建越合理（但仍可能被正文强信号压过）
    if (mode === 'tag' && (input.tags?.length ?? 0) > 0) score += Math.min(3, input.tags!.length);
    // 正文很短且无明确指向 → 采访式创作（对话引导）才是正确归宿
    if (mode === 'interview' && hasBrief && text.trim().length < 8) score += 2;
    // 超长正文（多半是贴了原作）→ 改编
    if (mode === 'adapt' && (input.brief?.length ?? 0) > 2000) score += 1;
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

  let track: HitLabTrack | undefined;
  if (top.mode === 'hit_lab') {
    track = routeTrack(text);
    // 爆款逆向批量是专业版轨道：等级不够先给名场面拓展，不直接 403
    if (track === 'hit_reverse' && !input.isStaff && (input.level ?? MemberLevel.FREE) !== MemberLevel.PRO) {
      reasons.push('「爆款逆向批量」为专业版轨道，已先按「名场面拓展」起稿');
      track = 'signature_scene';
    }
  } else if (top.mode === 'tag') {
    track = undefined;
  }

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
    ...(track ? { track } : {}),
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
  if (lang === 'en') {
    return r.track
      ? `Auto-routed to ${r.name} · ${r.track === 'hit_reverse' ? 'hit reverse batch' : 'signature scene'} (${Math.round(r.confidence * 100)}%)`
      : `Auto-routed to ${r.name} (${Math.round(r.confidence * 100)}%)`;
  }
  return r.track
    ? `已自动识别：${r.name} · ${r.track === 'hit_reverse' ? '爆款逆向批量' : '名场面拓展'}（置信度 ${Math.round(r.confidence * 100)}%）`
    : `已自动识别：${r.name}（置信度 ${Math.round(r.confidence * 100)}%）`;
}
