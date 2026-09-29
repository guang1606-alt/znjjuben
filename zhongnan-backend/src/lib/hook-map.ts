/**
 * 逐集钩子地图（v2.61）——把四层钩子（开场钩/场末牵引/句子级微钩/集尾卡点）的事前排布，
 * 变成交付文件里的「钩子编排页」，让出品方/买家逐集看到钩子设计。
 * 同源保真：管线 src/agents/pipeline.ts 对第 e 集（0 基）用
 *   planHooks(n, scenesPerEp, cuePref, mulberry32(0x9e3779b1 ^ (e*2654435761)))
 * 本模块逐集复现同一调用并取该集，保证地图与实际创作一致、确定性、可复现。
 */
import {
  planHooks, hookName, hookFlavor, flavorName,
  HOOK_FLAVORS, type CuePref, type HookFlavor,
} from '../engine/hook-system';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HookMapEpisode {
  ep: number;
  openId: string; openZh: string; openEn: string;
  endId: string; endZh: string; endEn: string;
  sceneHookCount: number;
  microCount: number;
  /** 微钩六大风味计数（动作/语言/氛围/情绪/信息差/伏笔） */
  flavorCounts: Partial<Record<HookFlavor, number>>;
}

export interface HookMap {
  episodeCount: number;
  scenesPerEp: number;
  strength: string;
  mode: string;
  episodes: HookMapEpisode[];
  /** 全剧微钩风味合计 */
  flavorTotals: Partial<Record<HookFlavor, number>>;
}

export function buildHookMap(episodeCount: number, scenesPerEp: number, pref: CuePref): HookMap {
  const n = Math.max(1, Math.min(300, Math.floor(episodeCount) || 1));
  const scenes = Math.min(8, Math.max(1, Math.floor(scenesPerEp) || 4));
  const episodes: HookMapEpisode[] = [];
  const flavorTotals: Partial<Record<HookFlavor, number>> = {};
  for (let e = 0; e < n; e++) {
    const plan = planHooks(n, scenes, pref, mulberry32(0x9e3779b1 ^ (e * 2654435761)));
    const epPlan = plan.episodes[e];
    const flavorCounts: Partial<Record<HookFlavor, number>> = {};
    let sceneHookCount = 0; let microCount = 0;
    epPlan.scenes.forEach((sc) => {
      if (sc.endHookId) sceneHookCount += 1;
      sc.microHookIds.forEach((id) => {
        microCount += 1;
        const f = hookFlavor(id);
        if (f) {
          flavorCounts[f] = (flavorCounts[f] ?? 0) + 1;
          flavorTotals[f] = (flavorTotals[f] ?? 0) + 1;
        }
      });
    });
    episodes.push({
      ep: e + 1,
      openId: epPlan.openHookId,
      openZh: hookName(epPlan.openHookId, 'zh'),
      openEn: hookName(epPlan.openHookId, 'en'),
      endId: epPlan.endHookId,
      endZh: hookName(epPlan.endHookId, 'zh'),
      endEn: hookName(epPlan.endHookId, 'en'),
      sceneHookCount, microCount, flavorCounts,
    });
  }
  return { episodeCount: n, scenesPerEp: scenes, strength: pref.strength, mode: pref.mode, episodes, flavorTotals };
}

const STRENGTH_ZH: Record<string, string> = { relax: '松弛', balanced: '均衡', tight: '紧锣密鼓' };
const STRENGTH_EN: Record<string, string> = { relax: 'relaxed', balanced: 'balanced', tight: 'tight' };

function flavorPart(counts: Partial<Record<HookFlavor, number>>, lang: 'zh' | 'en'): string {
  const parts = HOOK_FLAVORS
    .filter((f) => (counts[f] ?? 0) > 0)
    .map((f) => `${flavorName(f, lang)}×${counts[f]}`);
  return parts.length ? parts.join(lang === 'en' ? '/' : '/') : (lang === 'en' ? 'none' : '无');
}

/**
 * 钩子编排页文本行（纯确定性）。
 * 超长剧（>24 集）只列前 10 与后 4 集并注明，避免交付文件被钩子表撑爆；完整排布仍在创作端可调。
 */
export function formatHookMapLines(map: HookMap, lang: 'zh' | 'en' = 'zh'): string[] {
  const totalFlavor = HOOK_FLAVORS
    .filter((f) => (map.flavorTotals[f] ?? 0) > 0)
    .map((f) => `${flavorName(f, lang)}×${map.flavorTotals[f]}`).join(lang === 'en' ? '/' : '/');
  const head = lang === 'en'
    ? `Hook map: ${map.episodeCount} eps · ${map.scenesPerEp} scenes/ep · strength ${STRENGTH_EN[map.strength] ?? map.strength} · micro-hook mix ${totalFlavor || 'none'}`
    : `钩子编排：共${map.episodeCount}集 · 每集${map.scenesPerEp}场 · 钩子密度${STRENGTH_ZH[map.strength] ?? map.strength} · 全剧微钩风味 ${totalFlavor || '无'}`;
  const oneLine = (e: HookMapEpisode): string => (lang === 'en'
    ? `E${e.ep}: open「${e.openEn}」→ end「${e.endEn}」｜scene pulls ${e.sceneHookCount} · micro ${e.microCount} (${flavorPart(e.flavorCounts, 'en')})`
    : `第${e.ep}集 开场「${e.openZh}」→集尾「${e.endZh}」｜场末牵引${e.sceneHookCount}处 · 微钩${e.microCount}处（${flavorPart(e.flavorCounts, 'zh')}）`);
  const lines: string[] = [head];
  const eps = map.episodes;
  if (eps.length <= 24) {
    eps.forEach((e) => lines.push(oneLine(e)));
  } else {
    eps.slice(0, 10).forEach((e) => lines.push(oneLine(e)));
    lines.push(lang === 'en' ? `… (${eps.length - 14} eps omitted) …` : `……（中段${eps.length - 14}集略，完整排布见创作端导演控制台）……`);
    eps.slice(-4).forEach((e) => lines.push(oneLine(e)));
  }
  return lines;
}
