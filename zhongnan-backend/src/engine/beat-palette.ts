/**
 * v2.57 节拍调色板（Beat Palette）——导演「反转×爽点×情绪逐集可点选」产品化（v2.56 钩子调色板的同构姊妹件）
 * ------------------------------------------------------------------
 * beat-system 已有 8 反转 / 10 爽点 / 8 情绪节拍、三套风味轴、CuePref.manual 逐点指定；
 * v2.57 先根治了三类节拍共用数字键的撞号隐患（BEAT_POS_NS 分层命名空间），本模块补上「用户看得见、点得动」的一层：
 *   1) 用与管线完全相同的 planBeats + 固定种子算出全剧节拍骨架（哪些集有主反转、每集几个爽点、情绪三拍），
 *      保证调色板上的★系统默认与真实创作落位一致，绝不「展示一套、生成另一套」；
 *   2) 每个节拍位给出 1 个系统默认 + 2 个备选，全部带双语「为什么是它」（题材命中/风味偏好/防疲劳轮换）；
 *   3) 用户点选即转成分层命名空间的 CuePref.manual（hybrid：用户指定优先、其余系统补），与创作管线零缝衔接；
 *   4) 纯函数、确定性（同输入同输出，种子 PRNG 仅做同分稳定破序）、双语；产出 id 全部来自合法节拍集合。
 */
import {
  REVERSAL_BEATS, PAYOFF_BEATS, EMOTION_BEATS, BeatType, BeatKind,
  normalizeBeatPref, planBeats, localizeBeat, beatManualKey,
  payoffFlavorOf, reversalFlavorOf, emotionFlavorOf,
} from './beat-system';
import { CuePref, Strength } from './hook-system';

export interface Bilingual { zh: string; en: string }
export interface BeatPaletteOption {
  id: string;
  name: string; nameEn: string;
  definition: string; definitionEn: string;
  technique: string; techniqueEn: string;
  example: string; exampleEn: string;
  kind: BeatKind;
  score: number;
  reason: Bilingual;
}
export interface BeatPaletteSlot {
  /** 与 planBeats 一致的分层 manual 键（reversal=10000+e；payoff=20000+e*10+k；emotion=30000+e*3+j） */
  pos: number;
  kind: BeatKind;
  ep: number;    // 1 基集号
  slot: number;  // 该类节拍在本集内的 0 基序号
  label: Bilingual;
  systemDefault: BeatPaletteOption;
  alternatives: BeatPaletteOption[];
  validIds: string[];
}
export interface BeatPaletteEpisode { ep: number; slots: BeatPaletteSlot[] }
export interface BeatPalette {
  strength: Strength;
  mode: 'auto';
  episodes: BeatPaletteEpisode[];
  note: Bilingual;
}

export interface BeatPaletteInput {
  episodeCount: number;
  strength?: Strength;
  /** 用户已选的偏好/风味（不含 manual；manual 由调色板点选产生），让默认与备选贴合用户选择 */
  pref?: Partial<CuePref>;
  tags?: string[];
}

// 确定性 PRNG（与管线/钩子调色板同款算法，仅用于同分稳定破序）
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const CIRCLED = ['①', '②', '③'];
const EMOTION_LABEL_ZH = ['情绪起·铺垫/压抑', '情绪承·拉扯/升温', '情绪合·释放/落点'];
const EMOTION_LABEL_EN = ['Emotion rise · setup', 'Emotion build · tug', 'Emotion land · release'];

const KIND_CANDIDATES: Record<BeatKind, BeatType[]> = {
  reversal: REVERSAL_BEATS, payoff: PAYOFF_BEATS, emotion: EMOTION_BEATS,
};
const flavorOf = (kind: BeatKind, id: string): string | undefined => {
  if (kind === 'payoff') return payoffFlavorOf(id);
  if (kind === 'reversal') return reversalFlavorOf(id);
  return emotionFlavorOf(id);
};

interface Scored { b: BeatType; score: number; tagsHit: string[]; preferred: boolean; flavored: boolean; cooled: boolean }

function slotLabel(kind: BeatKind, ep: number, slot: number): Bilingual {
  if (kind === 'reversal') return { zh: `第${ep}集 · 主反转`, en: `Ep${ep} · Main reversal` };
  if (kind === 'payoff') return { zh: `第${ep}集 · 爽点${CIRCLED[slot] ?? slot + 1}`, en: `Ep${ep} · Payoff ${slot + 1}` };
  return { zh: `第${ep}集 · ${EMOTION_LABEL_ZH[slot] ?? `情绪拍${slot + 1}`}`, en: `Ep${ep} · ${EMOTION_LABEL_EN[slot] ?? `Emotion beat ${slot + 1}`}` };
}

function scoreCandidates(
  kind: BeatKind, pos: number, candidates: BeatType[], tags: string[], pref: CuePref, recent: Map<string, number>, rng: () => number,
): Scored[] {
  const tagHay = tags.map((t) => t.toLowerCase());
  const flavorPref: string[] = kind === 'payoff' ? (pref.payoffFlavors ?? [])
    : kind === 'reversal' ? (pref.reversalFlavors ?? []) : (pref.emotionFlavors ?? []);
  return candidates
    .map((b) => {
      let score = 0;
      const preferred = pref.preferred.includes(b.id);
      if (preferred) score += 3;
      const bestHay = b.bestFor.map((x) => x.toLowerCase());
      const tagsHit = tagHay.filter((t) => bestHay.some((x) => x.includes(t) || t.includes(x)));
      score += tagsHit.length * 2;
      const flavored = flavorPref.includes(flavorOf(kind, b.id) ?? '');
      if (flavored) score += 1;
      const last = recent.get(b.id);
      const cooled = last !== undefined && pos - last <= b.cooldown;
      if (cooled) score -= 2; // 冷却期降权（与 pickBeat 同思想，但调色板保留可见、不硬删）
      score += rng() * 0.01;
      return { b, score, tagsHit, preferred, flavored, cooled };
    })
    .sort((a, c) => c.score - a.score);
}

function buildOption(s: Scored, kind: BeatKind): BeatPaletteOption {
  const zh = localizeBeat(s.b, 'zh'); const en = localizeBeat(s.b, 'en');
  const whyZh: string[] = []; const whyEn: string[] = [];
  if (s.preferred) { whyZh.push('在你偏好的节拍清单内'); whyEn.push('On your preferred-beat list'); }
  if (s.tagsHit.length) {
    whyZh.push(`命中题材标签「${s.tagsHit.slice(0, 3).join('、')}」`);
    whyEn.push(`Matches genre tag(s): ${s.tagsHit.slice(0, 3).join(', ')}`);
  }
  if (s.flavored) { whyZh.push('契合你选的风味轴'); whyEn.push('Matches your chosen flavor axis'); }
  if (s.cooled) {
    whyZh.push('刚用过同型，系统已轮换降权以避免观众疲劳');
    whyEn.push('Same type used recently — deprioritized to avoid viewer fatigue');
  }
  if (!whyZh.length) {
    whyZh.push(kind === 'reversal' ? '反转意外感与题材适配综合最优' : kind === 'payoff' ? '即时满足强度与节奏轮换综合最优' : '情绪起伏与「有压必放」综合最优');
    whyEn.push(kind === 'reversal' ? 'Best overall surprise fit for this genre' : kind === 'payoff' ? 'Best instant-gratification after rotation' : 'Best emotional undulation with press→release guaranteed');
  }
  return {
    id: s.b.id, kind, score: Math.round(s.score * 100) / 100,
    name: zh.name, nameEn: en.name,
    definition: zh.definition, definitionEn: en.definition,
    technique: zh.technique, techniqueEn: en.technique,
    example: zh.example, exampleEn: en.example,
    reason: { zh: whyZh.join('；'), en: whyEn.join('; ') },
  };
}

/** 生成全剧逐集节拍位的「系统默认 + 备选」调色板（确定性；默认与 planBeats 真实落位一致） */
export function buildBeatPalette(input: BeatPaletteInput): BeatPalette {
  const episodeCount = clamp(Math.floor(input.episodeCount || 1), 1, 120);
  const strength: Strength = input.strength === 'relax' || input.strength === 'tight' || input.strength === 'balanced'
    ? input.strength : 'balanced';
  const tags = (input.tags ?? []).map((t) => String(t).slice(0, 24)).filter(Boolean).slice(0, 40);
  // 系统骨架：与管线完全同种子方案——逐集换种子重排全剧、取本集（pipeline.ts / emotion-wave.ts 同式），
  // 保证调色板上第 e 集的★默认就是真实生成第 e 集时采用的节拍；钩子对齐只在缺反转时补位、从不覆盖用户点选。
  const basePref = normalizeBeatPref({ ...(input.pref ?? {}), mode: 'auto', strength, manual: {} });
  const skeletonAt = (e: number) => planBeats(episodeCount, basePref, mulberry32(0x5bd1e995 ^ (e * 40503))).episodes[e];

  const recent = { reversal: new Map<string, number>(), payoff: new Map<string, number>(), emotion: new Map<string, number>() };
  let revPos = 0; let payPos = 0;
  const episodes: BeatPaletteEpisode[] = [];

  const pushSlot = (kind: BeatKind, ep0: number, slot: number, plannedId: string, coolPos: number) => {
    const rng = mulberry32(0xbea7 ^ (beatManualKey(kind, ep0, slot) * 2654435761));
    const ranked = scoreCandidates(kind, coolPos, KIND_CANDIDATES[kind], tags, basePref, recent[kind], rng);
    const defIdx = ranked.findIndex((s) => s.b.id === plannedId);
    const defScored = defIdx >= 0 ? ranked.splice(defIdx, 1)[0] : ranked.shift()!;
    recent[kind].set(defScored.b.id, coolPos);
    const systemDefault = buildOption(defScored, kind);
    const alternatives = ranked.slice(0, 2).map((s) => buildOption(s, kind));
    return {
      pos: beatManualKey(kind, ep0, slot), kind, ep: ep0 + 1, slot,
      label: slotLabel(kind, ep0 + 1, slot),
      systemDefault, alternatives,
      validIds: [systemDefault.id, ...alternatives.map((a) => a.id)],
    };
  };

  for (let e = 0; e < episodeCount; e++) {
    const planEp = skeletonAt(e);
    const slots: BeatPaletteSlot[] = [];
    if (planEp.reversalId) slots.push(pushSlot('reversal', e, 0, planEp.reversalId, revPos++));
    planEp.payoffIds.forEach((id, k) => slots.push(pushSlot('payoff', e, k, id, payPos++)));
    planEp.emotionPath.forEach((id, j) => slots.push(pushSlot('emotion', e, j, id, e * 10 + j)));
    episodes.push({ ep: e + 1, slots });
  }

  return {
    strength, mode: 'auto', episodes,
    note: {
      zh: '高亮★为系统默认（按密度规则+题材+风味+防疲劳轮换算出，与实际生成落位一致）；点任一备选即改为你指定，未改位置系统自动补；情绪三拍强制「有压必放」。本面板仅做方案编排，不消耗积分。',
      en: 'Highlighted ★ is the system default (density rules + genre + flavor + anti-fatigue rotation; identical to what generation actually uses). Tap any alternative to take over that slot; untouched slots stay automatic. The 3-beat emotion arc always guarantees press→release. Planning here costs no credits.',
    },
  };
}

/**
 * 用户在调色板上的点选 → CuePref.manual（只接受该位白名单内的合法 id；与默认相同不落 manual）
 * picks: pos(字符串或数字) → beatId
 */
export function palettePicksToManual(
  palette: BeatPalette,
  picks: Record<string, string>,
): { manual: Record<number, string>; rejected: string[] } {
  const manual: Record<number, string> = {};
  const rejected: string[] = [];
  const byPos = new Map<number, BeatPaletteSlot>();
  palette.episodes.forEach((ep) => ep.slots.forEach((s) => byPos.set(s.pos, s)));
  for (const [k, id] of Object.entries(picks || {})) {
    const pos = Number(k);
    const s = byPos.get(pos);
    if (!s || !s.validIds.includes(id)) { rejected.push(k); continue; }
    if (id !== s.systemDefault.id) manual[pos] = id;
  }
  return { manual, rejected };
}
