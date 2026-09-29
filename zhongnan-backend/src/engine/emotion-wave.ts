/**
 * 全剧情绪曲线（v2.38）——把节拍系统的事前排布变成用户看得见的"情绪波形"。
 * 关键保真：管线每集都是用 planBeats(全剧集数, pref, mulberry32(0x5bd1e995 ^ (本集序号*40503)))
 * 重排全剧后取第 e 集；本模块逐集复现同一过程，保证波形与实际创作一致、确定性、可复现。
 */
import { planBeats, BEAT_LIBRARY, type EpisodeBeat } from './beat-system';
import type { CuePref } from './hook-system';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 情绪节拍的唤醒度（张力 0-100）与效价（-1 负向 ~ +1 正向）
export const EMOTION_VALENCE: Record<string, { tension: number; valence: number }> = {
  emo_suppress: { tension: 70, valence: -0.9 }, // 憋屈蓄力
  emo_suspense: { tension: 76, valence: -0.4 }, // 揪心悬念
  emo_burst: { tension: 86, valence: 0.2 },    // 情绪爆发（高唤醒，方向随语境，取中性偏正）
  emo_release: { tension: 44, valence: 0.95 },  // 爽感释放
  emo_tear: { tension: 80, valence: -0.3 },    // 破防泪点
  emo_hype: { tension: 90, valence: 0.9 },     // 高燃
  emo_warmth: { tension: 34, valence: 0.8 },   // 温情回甘
  emo_heal: { tension: 24, valence: 0.7 },     // 治愈慰藉
};
const REVERSAL_TENSION = 12;   // 每集反转贡献的张力
const PAYOFF_TENSION = 8;      // 每个爽点贡献的张力
const INTENSITY_CAP = 100;

export interface WavePoint {
  ep: number;
  /** 情绪唤醒/张力 0-100 */
  intensity: number;
  /** 情绪效价 -100~+100（负=压抑揪心，正=释放高燃温暖） */
  valence: number;
  path: { id: string; name: string; nameEn: string }[];
  reversal: { id: string; name: string; nameEn: string } | null;
  payoffs: { id: string; name: string; nameEn: string }[];
  payoffCount: number;
}
export interface EmotionWave {
  episodeCount: number;
  points: WavePoint[];
  avgIntensity: number;
  peakEp: number;
  /** 是否存在连续 3 集以上张力几乎无起伏（平到犯困） */
  flatWarn: boolean;
  /** 全剧张力级差（峰-谷），过低提示一条直线 */
  range: number;
}

function beatName(id: string): { name: string; nameEn: string } {
  const all = [...BEAT_LIBRARY.reversal, ...BEAT_LIBRARY.payoff, ...BEAT_LIBRARY.emotion];
  const b = all.find((x) => x.id === id);
  return { name: b?.name ?? id, nameEn: BEAT_NAME_EN[id] ?? b?.name ?? id };
}

// beat-system 的 BeatType 无英文名字段，波形图英文界面在此集中维护（零中文泄漏到英文层由测试守）
// v2.80 起导出，供 device-fatigue / recap-builder 的英文层复用同一套节拍英文名（单一事实源）
export const BEAT_NAME_EN: Record<string, string> = {
  rev_identity: 'Identity reversal', rev_stance: 'Stance reversal', rev_friendfoe: 'Friend/foe reversal',
  rev_truefalse: 'True/false reversal', rev_cause: 'Cause reversal', rev_cognition: 'Cognitive reversal',
  rev_strongweak: 'Power reversal', rev_timeline: 'Timeline reversal',
  pay_faceslap: 'Face-slap', pay_counter: 'Comeback', 'pay_id压制': 'Status dominance', pay_crush: 'Skill dominance',
  pay_truth: 'Truth revealed', pay_karma: 'Instant karma', pay_underdog: 'Underdog rises',
  pay_resource: 'Cheat resource activated', pay_wish: 'Wish fulfillment', pay_sweet: 'Sweet payoff',
  emo_suppress: 'Grievance buildup', emo_burst: 'Emotional burst', emo_release: 'Payoff release',
  emo_warmth: 'Warm aftertaste', emo_suspense: 'Suspense tug', emo_tear: 'Tear moment',
  emo_hype: 'Hype peak', emo_heal: 'Healing calm',
};

function pointOf(ep1Based: number, beat: EpisodeBeat): WavePoint {
  const metas = beat.emotionPath.map((id) => ({ id, ...(EMOTION_VALENCE[id] ?? { tension: 50, valence: 0 }) }));
  const emoTension = metas.length ? metas.reduce((s, m) => s + m.tension, 0) / metas.length : 50;
  const emoValence = metas.length ? metas.reduce((s, m) => s + m.valence, 0) / metas.length : 0;
  let intensity = emoTension + (beat.reversalId ? REVERSAL_TENSION : 0) + beat.payoffIds.length * PAYOFF_TENSION;
  intensity = Math.max(5, Math.min(INTENSITY_CAP, Math.round(intensity)));
  return {
    ep: ep1Based,
    intensity,
    valence: Math.round(emoValence * 100),
    path: beat.emotionPath.map((id) => ({ id, ...beatName(id) })),
    reversal: beat.reversalId ? { id: beat.reversalId, ...beatName(beat.reversalId) } : null,
    payoffs: beat.payoffIds.map((id) => ({ id, ...beatName(id) })),
    payoffCount: beat.payoffIds.length,
  };
}

/**
 * 针对某一集给出确定性的波形改稿建议（v2.39）：免费诊断，优化动作走增值 /fix。
 * 返回 null 表示该集波形健康、无需建议。
 */
export interface WaveAdvice {
  ep: number;
  level: 'P1' | 'P2';
  rule: 'emotion_wave';
  /** v2.49 规则类型，供六语模板定位（press=只压不放/overheat=连续高能/flat=过平/level=齐平无起伏） */
  ruleKind: 'press' | 'overheat' | 'flat' | 'level';
  dimLabel: string;
  dimLabelEn: string;
  advice: string;
  adviceEn: string;
}
const SUPPRESS = new Set(['emo_suppress', 'emo_suspense', 'emo_tear']);
const RELEASE_SET = new Set(['emo_release', 'emo_burst', 'emo_hype', 'emo_warmth', 'emo_heal']);
export function adviseWavePoint(wave: EmotionWave, ep1Based: number, lang: 'zh' | 'en' = 'zh'): WaveAdvice | null {
  const i = Math.max(0, Math.min(wave.points.length - 1, ep1Based - 1));
  const p = wave.points[i]; if (!p) return null;
  const ids = p.path.map((q) => q.id);
  const hasPress = ids.some((x) => SUPPRESS.has(x));
  const hasRelease = ids.some((x) => RELEASE_SET.has(x));
  const prev = wave.points[i - 1]; const next = wave.points[i + 1];
  const flatNeighbors = (!prev || Math.abs(prev.intensity - p.intensity) <= 6) && (!next || Math.abs(next.intensity - p.intensity) <= 6);
  const overheated = !!(prev && next && prev.intensity >= 84 && p.intensity >= 84 && next.intensity >= 84);
  let zh = ''; let en = ''; let level: 'P1' | 'P2' = 'P2';
  if (hasPress && !hasRelease) {
    level = 'P1';
    zh = `第${p.ep}集情绪只压不放（${p.path.map((q) => q.name).join('→')}），观众会憋到弃剧：在集中或集尾补一个释放拍（爽感释放/情绪爆发/温情回甘），做到有压必有放，并把释放落在本集钩子前。`;
    en = `Ep${p.ep} only suppresses without release (${p.path.map((q) => q.nameEn).join('→')}); add a release beat (payoff release / emotional burst / warm aftertaste) before the episode hook so tension is not left unresolved.`;
  } else if (overheated) {
    zh = `第${p.ep}集与相邻集连续高能（张力均≥84），缺少呼吸留白：本集前段安排一个低张力过渡场（日常/温情/信息场），把真正的爆点后移，避免观众情绪疲劳。`;
    en = `Ep${p.ep} and its neighbours stay at ≥84 intensity with no breathing room; open with a lower-tension transition (daily life / warmth / exposition) and move the real peak later to avoid emotional fatigue.`;
  } else if (p.intensity < 55) {
    level = 'P1';
    zh = `第${p.ep}集张力仅${p.intensity}，偏平：增加一个具体冲突或即时爽点（反转/打脸/身份压制），并把结尾钩子升级为强悬念，防止中段掉观众。`;
    en = `Ep${p.ep} intensity is only ${p.intensity}, too flat: add one concrete conflict or instant payoff (reversal / face-slap / status dominance) and upgrade the end hook into a strong suspense.`;
  } else if (flatNeighbors && wave.points.length >= 3) {
    zh = `第${p.ep}集与相邻集张力几乎齐平，曲线缺少起伏：用"先压后放"或"假平静→突发"重排本集三拍，拉开与前后集的情绪差。`;
    en = `Ep${p.ep} is level with its neighbours; reorder its three beats as suppress→release or false-calm→sudden-turn to widen the emotional contrast across episodes.`;
  }
  if (!zh) return null;
  const ruleKind = hasPress && !hasRelease ? 'press' : overheated ? 'overheat' : p.intensity < 55 ? 'flat' : 'level';
  return { ep: p.ep, level, rule: 'emotion_wave', ruleKind, dimLabel: '剧情', dimLabelEn: 'Plot', advice: lang === 'en' ? en : zh, adviceEn: en };
}

/**
 * 生成全剧情绪波形（确定性）。
 * @param episodeCount 总集数（夹 1-300）
 * @param pref 已归一化的节拍偏好（管线同源）
 */
export function buildEmotionWave(episodeCount: number, pref?: CuePref): EmotionWave {
  const n = Math.max(1, Math.min(300, Math.floor(episodeCount) || 1));
  const points: WavePoint[] = [];
  for (let e = 0; e < n; e++) {
    // 与 pipeline 完全相同的种子方案：逐集重排全剧、取本集
    const plan = planBeats(n, pref, mulberry32(0x5bd1e995 ^ (e * 40503)));
    points.push(pointOf(e + 1, plan.episodes[e]));
  }
  const intensities = points.map((p) => p.intensity);
  const avgIntensity = Math.round(intensities.reduce((s, x) => s + x, 0) / n);
  const peakEp = intensities.indexOf(Math.max(...intensities)) + 1;
  const range = Math.max(...intensities) - Math.min(...intensities);
  let flatWarn = false;
  for (let i = 0; i + 2 < n; i++) {
    const seg = intensities.slice(i, i + 3);
    if (Math.max(...seg) - Math.min(...seg) <= 6) { flatWarn = true; break; }
  }
  return { episodeCount: n, points, avgIntensity, peakEp, flatWarn, range };
}

/** 图上点旁短标签（中文 2 字 /英文 4 字母内），v2.60 导演页逐集主情绪标注 */
export const EMOTION_SHORT: Record<string, { zh: string; en: string }> = {
  emo_suppress: { zh: '压抑', en: 'Supp' },
  emo_suspense: { zh: '悬念', en: 'Susp' },
  emo_burst: { zh: '爆发', en: 'Burst' },
  emo_release: { zh: '释放', en: 'Rel' },
  emo_tear: { zh: '泪点', en: 'Tear' },
  emo_hype: { zh: '高燃', en: 'Hype' },
  emo_warmth: { zh: '暖意', en: 'Warm' },
  emo_heal: { zh: '治愈', en: 'Heal' },
};

/**
 * 取一集的主导情绪拍：情绪路径中唤醒度最高的那拍（并列取更靠后的，贴近集尾爆点）。
 * 无路径时返回 null（老数据容错）。
 */
export function dominantEmotionOf(p: WavePoint): { id: string; name: string; nameEn: string; shortZh: string; shortEn: string } | null {
  if (!p?.path?.length) return null;
  let best = p.path[0]; let bestT = EMOTION_VALENCE[best.id]?.tension ?? -1;
  for (const q of p.path) {
    const t = EMOTION_VALENCE[q.id]?.tension ?? -1;
    if (t >= bestT) { best = q; bestT = t; }
  }
  return { ...best, shortZh: EMOTION_SHORT[best.id]?.zh ?? best.name.slice(0, 2), shortEn: EMOTION_SHORT[best.id]?.en ?? best.nameEn.slice(0, 4) };
}
