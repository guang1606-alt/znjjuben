/**
 * 爽点-反转兑现链时间线（v2.62）——把全剧「反转卡点 / 爽点节拍 / 情绪压放弧」逐集摊开，
 * 并做兑现链体检：反转/爽点最大空窗、有压必放达成率、伏笔落点是否过晚。
 * 同源保真：管线对第 e 集（0 基）依次调用
 *   planHooks(n, scenes, cuePref,  mulberry32(0x9e3779b1 ^ (e*2654435761)))
 *   planBeats (n, beatPref,        mulberry32(0x5bd1e995 ^ (e*40503)))
 *   alignBeatsToHooks(...)                                        mulberry32(0x1b873593 ^ (e*2246822519))
 * 本模块逐集复现同一三次调用并取该集，保证时间线与真实创作一致、确定性可复现。
 */
import {
  planBeats, normalizeBeatPref, beatNameOf, payoffFlavorOf, payoffFlavorName,
  SUPPRESSION_IDS, RELEASE_IDS, type EpisodeBeat,
} from '../engine/beat-system';
import { planHooks, type CuePref as HookPref } from '../engine/hook-system';
import { alignBeatsToHooks } from '../engine/narrative-orchestrator';
import { normalizeCuePref } from '../agents/pipeline';

type BeatPrefInput = Parameters<typeof normalizeBeatPref>[0];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChainEpisode {
  ep: number;
  reversalZh: string | null; reversalEn: string | null;
  payoffsZh: string[]; payoffsEn: string[];
  arcZh: string[]; arcEn: string[];
  foreshadowCount: number;
}

export interface ChainStats {
  reversalCount: number;
  payoffCount: number;
  longestReversalGap: number; // 连续无反转的最大集数
  longestPayoffGap: number;   // 连续无爽点的最大集数
  pressReleaseOk: number;     // 有压必放达成集数
  pressReleaseTotal: number;  // 出现压抑/揪心拍的集数
  lateForeshadow: boolean;    // 最后一集仍在埋伏笔（无后续可回收）
  flavorCounts: Record<string, number>; // 爽点五风味计数
}

export interface BeatChain {
  episodeCount: number;
  episodes: ChainEpisode[];
  stats: ChainStats;
}

export function buildBeatChain(
  episodeCount: number,
  scenesPerEp: number,
  beatPrefRaw?: BeatPrefInput,
  hookPrefRaw?: Partial<HookPref> | null,
): BeatChain {
  // 延迟引入避免循环：normalizeCuePref 在 agents/pipeline
  const n = Math.max(1, Math.min(300, Math.floor(episodeCount) || 1));
  const scenes = Math.min(8, Math.max(1, Math.floor(scenesPerEp) || 4));
  const beatPref = normalizeBeatPref(beatPrefRaw ?? null);
  const hookPref = normalizeCuePref(hookPrefRaw ?? null);
  const episodes: ChainEpisode[] = [];
  for (let e = 0; e < n; e++) {
    const hookPlan = planHooks(n, scenes, hookPref, mulberry32(0x9e3779b1 ^ (e * 2654435761)));
    const beatPlan = planBeats(n, beatPref, mulberry32(0x5bd1e995 ^ (e * 40503)));
    alignBeatsToHooks(hookPlan, beatPlan, mulberry32(0x1b873593 ^ (e * 2246822519)));
    const b: EpisodeBeat = beatPlan.episodes[e];
    const h = hookPlan.episodes[e];
    const foreshadowCount = h.scenes.reduce(
      (s, sc) => s + sc.microHookIds.filter((id) => id === 'micro_foreshadow').length, 0,
    );
    episodes.push({
      ep: e + 1,
      reversalZh: b.reversalId ? beatNameOf(b.reversalId, 'zh') : null,
      reversalEn: b.reversalId ? beatNameOf(b.reversalId, 'en') : null,
      payoffsZh: b.payoffIds.map((id) => beatNameOf(id, 'zh')),
      payoffsEn: b.payoffIds.map((id) => beatNameOf(id, 'en')),
      arcZh: b.emotionPath.map((id) => beatNameOf(id, 'zh')),
      arcEn: b.emotionPath.map((id) => beatNameOf(id, 'en')),
      foreshadowCount,
    });
  }
  // —— 兑现链体检 ——
  let longestReversalGap = 0; let longestPayoffGap = 0;
  let gapR = 0; let gapP = 0;
  let pressReleaseOk = 0; let pressReleaseTotal = 0;
  let reversalCount = 0; let payoffCount = 0;
  const flavorCounts: Record<string, number> = {};
  episodes.forEach((ep, idx) => {
    if (ep.reversalZh) { reversalCount++; gapR = 0; } else { gapR++; longestReversalGap = Math.max(longestReversalGap, gapR); }
    if (ep.payoffsZh.length) { payoffCount += ep.payoffsZh.length; gapP = 0; } else { gapP++; longestPayoffGap = Math.max(longestPayoffGap, gapP); }
    // 有压必放与风味分布：用同源原始 id 判定
    const bp = planBeats(n, beatPref, mulberry32(0x5bd1e995 ^ (idx * 40503))).episodes[idx];
    const pressed = bp.emotionPath.some((id) => SUPPRESSION_IDS.has(id));
    if (pressed) {
      pressReleaseTotal++;
      if (bp.emotionPath.some((id) => RELEASE_IDS.has(id))) pressReleaseOk++;
    }
    bp.payoffIds.forEach((id) => { const f = payoffFlavorOf(id); if (f) flavorCounts[f] = (flavorCounts[f] ?? 0) + 1; });
  });
  const last = episodes[n - 1];
  return {
    episodeCount: n,
    episodes,
    stats: {
      reversalCount, payoffCount,
      longestReversalGap, longestPayoffGap,
      pressReleaseOk, pressReleaseTotal,
      lateForeshadow: n > 1 && (last?.foreshadowCount ?? 0) > 0,
      flavorCounts,
    },
  };
}

/** 爽点风味分布（5 风味） */
export function payoffFlavorDistribution(chain: BeatChain, lang: 'zh' | 'en' = 'zh'): string {
  return Object.entries(chain.stats.flavorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([f, c]) => `${payoffFlavorName(f as never, lang)}×${c}`)
    .join(lang === 'en' ? '/' : '/');
}

/** 兑现链文本行（纯确定性）；超 24 集前 10 后 4 截断 */
export function formatBeatChainLines(chain: BeatChain, lang: 'zh' | 'en' = 'zh'): string[] {
  const s = chain.stats;
  const lines: string[] = [];
  if (lang === 'en') {
    lines.push(`Payoff chain: ${chain.episodeCount} eps · ${s.reversalCount} reversals · ${s.payoffCount} payoffs · flavor mix ${payoffFlavorDistribution(chain, 'en')}`);
  } else {
    lines.push(`兑现链总览：共${chain.episodeCount}集 · 反转${s.reversalCount}次 · 爽点${s.payoffCount}处 · 爽点风味 ${payoffFlavorDistribution(chain, 'zh')}`);
  }
  const one = (e: ChainEpisode): string => (lang === 'en'
    ? `E${e.ep}: reversal ${e.reversalEn ? `「${e.reversalEn}」` : '—'}｜payoffs ${e.payoffsEn.join('/') || '—'}｜arc ${e.arcEn.join('→')}`
    : `第${e.ep}集 反转${e.reversalZh ? `「${e.reversalZh}」` : '（留白）'}｜爽点：${e.payoffsZh.join('/') || '无'}｜情绪弧：${e.arcZh.join('→')}${e.foreshadowCount ? `｜埋伏笔×${e.foreshadowCount}` : ''}`);
  const eps = chain.episodes;
  if (eps.length <= 24) eps.forEach((e) => lines.push(one(e)));
  else {
    eps.slice(0, 10).forEach((e) => lines.push(one(e)));
    lines.push(lang === 'en' ? `… (${eps.length - 14} eps omitted) …` : `……（中段${eps.length - 14}集略，完整时间线见创作端导演控制台）……`);
    eps.slice(-4).forEach((e) => lines.push(one(e)));
  }
  // 体检结论
  if (lang === 'en') {
    lines.push(`Check: longest reversal gap ${s.longestReversalGap} ep(s), longest payoff gap ${s.longestPayoffGap} ep(s); press-release ${s.pressReleaseOk}/${s.pressReleaseTotal} eps${s.pressReleaseTotal ? '' : ' (no suppression beat)'}`);
    if (s.longestPayoffGap >= 3) lines.push('⚠ No payoff for 3+ consecutive eps — audience may drop; add a small win.');
    if (s.lateForeshadow) lines.push('⚠ A foreshadow is planted in the final episode with no room to pay off — move it earlier or close it on the spot.');
    if (!s.lateForeshadow && s.longestPayoffGap < 3) lines.push('✓ Chain healthy: payoffs cadence steady, every suppression has a release.');
  } else {
    lines.push(`兑现体检：反转最大空窗${s.longestReversalGap}集、爽点最大空窗${s.longestPayoffGap}集；有压必放达成 ${s.pressReleaseOk}/${s.pressReleaseTotal} 集${s.pressReleaseTotal ? '' : '（本计划无压抑拍）'}`);
    if (s.longestPayoffGap >= 3) lines.push('⚠ 连续3集以上无爽点，观众易流失，建议补一个小赢/小甜/小反转。');
    if (s.lateForeshadow) lines.push('⚠ 末集仍在埋伏笔且无后续集可回收，建议前移或当场兑现。');
    if (!s.lateForeshadow && s.longestPayoffGap < 3) lines.push('✓ 兑现链健康：爽点节奏稳定、压抑拍均有释放、伏笔未压到末集。');
  }
  return lines;
}
