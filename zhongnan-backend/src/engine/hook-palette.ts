/**
 * v2.56 钩子调色板（Hook Palette）——把导演「场钩/集钩/动作钩/氛围钩/语言钩…用户可选+系统默认」彻底产品化
 * ------------------------------------------------------------------
 * hook-system 已有四层 29 钩、CuePref.manual 逐点指定；hook-strategy 已有 5 张命名策略卡。
 * 本模块补上「用户看得见、点得动」的最后一公里：
 *   1) 按 planHooks 完全相同的位置编号规则，列出全剧结构性钩子位（每集开场钩、集尾卡点、场末牵引）；
 *   2) 每个位置给出 1 个系统默认 + 2 个备选，全部带双语「为什么是它」；
 *   3) 用户点选即转成 CuePref.manual（hybrid：用户指定优先、其余系统补），与创作管线零缝衔接；
 *   4) 句子级微钩（动作/语言/氛围/情绪/信息差/伏笔六风味）不在逐点位重复造轮子，沿用 microFlavors 软偏好。
 * 纯函数、确定性（同输入同输出，种子 PRNG 仅做稳定的同分破序）、双语；产出 id 全部来自合法四层钩集合。
 */
import {
  OPEN_HOOKS, EPISODE_END_HOOKS, SCENE_HOOKS, HookType, Strength,
  localizeHook, HOOK_FLAVORS, FLAVOR_META, HookFlavor, HOOK_POS_NS,
} from './hook-system';
import { getHookStrategy, recommendStrategy, isValidHookStrategy } from './hook-strategy';

export type PaletteKind = 'open' | 'end' | 'scene';
export interface Bilingual { zh: string; en: string }
export interface PaletteOption {
  id: string;
  name: string; nameEn: string;
  definition: string; definitionEn: string;
  example: string;
  layer: HookType['layer'];
  score: number;
  reason: Bilingual;
}
export interface PalettePosition {
  /** 与 planHooks 一致的 numeric manual key（open=集0基序号；scene=1000+ep*100+sceneIdx；end=20000+集0基序号） */
  pos: number;
  kind: PaletteKind;
  ep: number;       // 1 基集号
  scene?: number;   // 1 基场号
  label: Bilingual;
  systemDefault: PaletteOption;
  alternatives: PaletteOption[];
  /** 该位置合法可选 id（默认+备选之外不允许，前端白名单校验用） */
  validIds: string[];
}
export interface PaletteMicroFlavor {
  id: HookFlavor; name: string; nameEn: string; desc: string; descEn: string;
}
export interface HookPalette {
  strategy: { id: string; auto: boolean; reason: Bilingual };
  strength: Strength;
  positions: PalettePosition[];
  microFlavors: PaletteMicroFlavor[];
  note: Bilingual;
}

export interface PaletteInput {
  episodeCount: number;
  scenesPerEp: number;
  strategy?: string;       // 用户显式策略；不传则按标签智能推荐
  tags?: string[];
  strength?: Strength;     // 显式强度优先于策略强度
}

// 确定性 PRNG（与 pipeline 同款算法，仅用于同分稳定破序，不影响可解释性）
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

const KIND_META: Record<PaletteKind, { candidates: HookType[]; label: (ep: number, sc?: number) => Bilingual }> = {
  open: {
    candidates: OPEN_HOOKS,
    label: (ep) => ({ zh: `第${ep}集 · 开场钩（黄金3秒）`, en: `Ep${ep} · Opening hook (golden 3s)` }),
  },
  end: {
    candidates: EPISODE_END_HOOKS,
    label: (ep) => ({ zh: `第${ep}集 · 集尾卡点（促追更/付费）`, en: `Ep${ep} · End cliff (binge/pay point)` }),
  },
  scene: {
    candidates: SCENE_HOOKS,
    label: (ep, sc) => ({ zh: `第${ep}集 第${sc}场 · 场末牵引`, en: `Ep${ep} Scene ${sc} · End-of-scene pull` }),
  },
};

/** 与 planHooks 完全一致的「该场是否需要场末牵引」判定，保证调色板与实际落位不打架 */
function needSceneEnd(strength: Strength, s: number, scenesPerEp: number): boolean {
  return strength === 'tight' || (strength === 'balanced' && s % 2 === 1) || (strength === 'relax' && s === scenesPerEp - 1);
}

interface Scored { h: HookType; score: number; tagsHit: string[]; preferred: boolean; cooled: boolean }

function scoreCandidates(
  kind: PaletteKind, pos: number, tags: string[],
  strategyPreferred: Set<string>, strategyAvoid: Set<string>,
  recent: Map<string, number>,
): Scored[] {
  const rng = mulberry32(0x9e37 ^ (pos * 2654435761));
  const tagHay = tags.map((t) => t.toLowerCase());
  return KIND_META[kind].candidates
    .filter((h) => !strategyAvoid.has(h.id))
    .map((h) => {
      let score = 0;
      const preferred = strategyPreferred.has(h.id);
      if (preferred) score += 3;
      const bestHay = h.bestFor.map((b) => b.toLowerCase());
      const tagsHit = tagHay.filter((t) => bestHay.some((b) => b.includes(t) || t.includes(b)));
      score += tagsHit.length * 2;
      const last = recent.get(h.id);
      const cooled = last !== undefined && pos - last <= h.cooldown;
      if (cooled) score -= 2; // 冷却期降权（与 pickWithPreference 同思想，但调色板保留可见、不硬删）
      score += rng() * 0.01;   // 稳定破序
      return { h, score, tagsHit, preferred, cooled };
    })
    .sort((a, b) => b.score - a.score);
}

function buildOption(s: Scored, kind: PaletteKind, pos: number): PaletteOption {
  const zh = localizeHook(s.h, 'zh'); const en = localizeHook(s.h, 'en');
  const whyZh: string[] = []; const whyEn: string[] = [];
  if (s.preferred) {
    whyZh.push('契合所选钩子策略');
    whyEn.push('Matches the chosen hook strategy');
  }
  if (s.tagsHit.length) {
    whyZh.push(`命中题材标签「${s.tagsHit.slice(0, 3).join('、')}」`);
    whyEn.push(`Matches genre tag(s): ${s.tagsHit.slice(0, 3).join(', ')}`);
  }
  if (s.cooled) {
    whyZh.push('刚用过同型，系统已轮换降权以避免观众疲劳');
    whyEn.push('Same type used recently — deprioritized to avoid viewer fatigue');
  }
  if (!whyZh.length) {
    whyZh.push(kind === 'open' ? '开场抓力与题材适配综合最优' : kind === 'end' ? '卡点追更力与节奏轮换综合最优' : '场景牵引力与轮换综合最优');
    whyEn.push(kind === 'open' ? 'Best overall opening grip for this genre' : kind === 'end' ? 'Best overall binge-pull after rotation' : 'Best scene pull after rotation');
  }
  return {
    id: s.h.id, layer: s.h.layer, score: Math.round(s.score * 100) / 100,
    name: zh.name, nameEn: en.name,
    definition: zh.definition, definitionEn: en.definition,
    example: zh.example,
    reason: { zh: whyZh.join('；'), en: whyEn.join('; ') },
  };
}

/** 生成全剧结构性钩子位的「系统默认 + 备选」调色板（确定性） */
export function buildHookPalette(input: PaletteInput): HookPalette {
  const episodeCount = clamp(Math.floor(input.episodeCount || 1), 1, 120);
  const scenesPerEp = clamp(Math.floor(input.scenesPerEp || 4), 1, 8);
  const tags = (input.tags ?? []).map((t) => String(t).slice(0, 24)).filter(Boolean).slice(0, 40);
  const reco = input.strategy && isValidHookStrategy(input.strategy)
    ? { id: input.strategy as string, auto: false, reason: { zh: '使用你手动选定的钩子策略。', en: 'Using your manually selected hook strategy.' } }
    : (() => { const r = recommendStrategy({ tags }); return { id: r.id, auto: r.auto, reason: { zh: r.reason, en: r.reasonEn } }; })();
  const strat = getHookStrategy(reco.id);
  const strength: Strength = input.strength ?? strat.strength;
  const preferred = new Set(strat.preferred);
  const avoid = new Set(strat.avoid);

  const positions: PalettePosition[] = [];
  // 各层独立记录最近落位，模拟 planHooks 的冷却轮换
  const recent = { open: new Map<string, number>(), end: new Map<string, number>(), scene: new Map<string, number>() };
  const pushPos = (kind: PaletteKind, pos: number, ep: number, scene?: number) => {
    const ranked = scoreCandidates(kind, pos, tags, preferred, avoid, recent[kind]);
    const chosen = ranked[0]; recent[kind].set(chosen.h.id, pos);
    const systemDefault = buildOption(chosen, kind, pos);
    const alternatives = ranked.slice(1, 3).map((s) => buildOption(s, kind, pos));
    positions.push({
      pos, kind, ep, scene,
      label: KIND_META[kind].label(ep, scene),
      systemDefault, alternatives,
      validIds: [systemDefault.id, ...alternatives.map((a) => a.id)],
    });
  };
  for (let e = 0; e < episodeCount; e++) {
    pushPos('open', e, e + 1);
    for (let s = 0; s < scenesPerEp; s++) {
      if (needSceneEnd(strength, s, scenesPerEp)) pushPos('scene', HOOK_POS_NS.sceneBase + e * 100 + s, e + 1, s + 1);
    }
    pushPos('end', HOOK_POS_NS.endBase + e, e + 1);
  }

  const microFlavors: PaletteMicroFlavor[] = HOOK_FLAVORS.map((id) => ({
    id,
    name: FLAVOR_META[id].name, nameEn: FLAVOR_META[id].nameEn,
    desc: FLAVOR_META[id].desc, descEn: FLAVOR_META[id].descEn,
  }));
  return {
    strategy: reco, strength, positions, microFlavors,
    note: {
      zh: '高亮项为系统默认（按策略+题材+防疲劳轮换算出）；点任一备选即改为你指定，未改位置系统自动补；句子级动作/语言/氛围等微钩用下方风味偏好软控制。',
      en: 'Highlighted = system default (strategy + genre + anti-fatigue rotation). Tap any alternative to take over that position; untouched positions stay automatic. Sentence-level action/line/atmosphere micro-hooks are softly controlled via flavor preferences below.',
    },
  };
}

/**
 * 用户在调色板上的点选 → CuePref.manual（只接受该位置白名单内的合法 id）
 * picks: pos(字符串或数字) → hookId；返回 numeric-key record 与被拒绝的非法项
 */
export function palettePicksToManual(
  palette: HookPalette,
  picks: Record<string, string>,
): { manual: Record<number, string>; rejected: string[] } {
  const manual: Record<number, string> = {};
  const rejected: string[] = [];
  const byPos = new Map(palette.positions.map((p) => [p.pos, p]));
  for (const [k, id] of Object.entries(picks || {})) {
    const pos = Number(k);
    const p = byPos.get(pos);
    if (!p || !p.validIds.includes(id)) { rejected.push(k); continue; }
    if (id !== p.systemDefault.id) manual[pos] = id; // 与默认相同不必落 manual
  }
  return { manual, rejected };
}
