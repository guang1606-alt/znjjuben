/**
 * v2.58 全剧情绪波形「事前编排器」（Wave Director）
 * ------------------------------------------------------------------
 * v2.38 的 emotion-wave 只能在项目生成后看曲线、逐集给诊断；本模块把同一套能力前移到「动笔之前」：
 *   1) 生成前确定性预览全剧情绪张力曲线（复用 buildEmotionWave，逐集同种子重排，与真实管线同源）；
 *   2) 区间框选连改：选定集区间 [from,to] + 波形意图，把意图落成每集情绪三拍（起/承/合）的
 *      分层 manual 定点（beat-system BEAT_POS_NS 的 30000 段），与 v2.57 节拍调色板共用同一份 manual，
 *      调色板上立刻反映为已定点，创作管线零缝遵循；
 *   3) 只动情绪节拍，反转/爽点定点一律不碰；每个意图模板都守「三拍互异、有压必放」硬规则；
 *   4) 纯函数、确定性、双语（英文层零中文），产出 id 全部来自 EMOTION_BEATS 合法集合。
 */
import { buildEmotionWave, type EmotionWave } from './emotion-wave';
import {
  normalizeBeatPref, beatManualKey, EMOTION_BEATS, SUPPRESSION_IDS, RELEASE_IDS,
} from './beat-system';
import type { CuePref, Strength } from './hook-system';

export type WaveIntent = 'press_release' | 'hype_climb' | 'tear_angst' | 'suspense_tug' | 'tender_heal';

/**
 * 五种波形意图 → 情绪三拍固定模板（起 / 承 / 合）。
 * 硬约束（与 planBeats 完全一致）：三拍互异；起或承含压抑/揪心类时，合必须是释放类。
 */
export const WAVE_INTENT_TRIPLES: Record<WaveIntent, [string, string, string]> = {
  press_release: ['emo_suppress', 'emo_suspense', 'emo_release'], // 蓄力加压：憋屈→揪心→释放
  hype_climb: ['emo_suspense', 'emo_burst', 'emo_hype'],           // 高燃拉升：悬念→爆发→高燃
  tear_angst: ['emo_suppress', 'emo_tear', 'emo_release'],         // 破防催泪：压抑→泪点→释放
  suspense_tug: ['emo_suspense', 'emo_suppress', 'emo_burst'],     // 揪心连拽：悬念→憋屈→爆发
  tender_heal: ['emo_warmth', 'emo_release', 'emo_heal'],          // 温情治愈：温情→释放→治愈
};

export interface WaveIntentMeta {
  id: WaveIntent;
  name: string; nameEn: string;
  desc: string; descEn: string;
  triple: [string, string, string];
}
export const WAVE_INTENT_META: Record<WaveIntent, Omit<WaveIntentMeta, 'id' | 'triple'>> = {
  press_release: {
    name: '蓄力加压（先压后放）', nameEn: 'Suppress then release',
    desc: '区间内先憋屈蓄力、再揪心拉扯，每集都给释放落点，观众情绪被逐级抬高后松开',
    descEn: 'Buildup and tug first, then every episode lands a release — tension is lifted step by step',
  },
  hype_climb: {
    name: '高燃拉升', nameEn: 'Hype climb',
    desc: '悬念起、爆发承、高燃合，把整段情绪一路推到燃点，适合高潮区间',
    descEn: 'Suspense rises into an outburst and a hype peak — built for the climax stretch',
  },
  tear_angst: {
    name: '破防催泪', nameEn: 'Tear and catharsis',
    desc: '压抑起、破防泪点承、释放合，先把共情推到峰值再给情绪出口',
    descEn: 'Press into a tearjerker peak, then a cathartic release — empathy maxed, then unburdened',
  },
  suspense_tug: {
    name: '揪心连拽', nameEn: 'Sustained suspense',
    desc: '悬念与憋屈交替、爆发收口，让观众整段都悬着心追下去',
    descEn: 'Suspense and suppression alternate with a burst close — viewers are held across the whole stretch',
  },
  tender_heal: {
    name: '温情治愈', nameEn: 'Tender healing',
    desc: '温情起、释放承、治愈合，整段张力回落、柔软收束，适合结局或过渡区间',
    descEn: 'Warmth, gentle release and healing — tension settles softly; ideal for endings or transitions',
  },
};
export const WAVE_INTENTS: WaveIntent[] = ['press_release', 'hype_climb', 'tear_angst', 'suspense_tug', 'tender_heal'];

export function waveIntentMeta(intent: WaveIntent, lang: 'zh' | 'en' = 'zh'): WaveIntentMeta {
  const m = WAVE_INTENT_META[intent];
  const triple = WAVE_INTENT_TRIPLES[intent];
  return {
    id: intent, triple, nameEn: m.nameEn, descEn: m.descEn,
    name: lang === 'en' ? m.nameEn : m.name,
    desc: lang === 'en' ? m.descEn : m.desc,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const EMOTION_IDS = new Set(EMOTION_BEATS.map((b) => b.id));

/** 模板自检：所有意图三拍必须合法、互异、守「有压必放」（测试与模块加载各执行一次） */
export function validateWaveIntents(): string[] {
  const problems: string[] = [];
  for (const intent of WAVE_INTENTS) {
    const t = WAVE_INTENT_TRIPLES[intent];
    t.forEach((id, j) => { if (!EMOTION_IDS.has(id)) problems.push(`${intent}.slot${j}=${id} 不是合法情绪节拍`); });
    if (new Set(t).size !== 3) problems.push(`${intent} 三拍必须互异`);
    if ((SUPPRESSION_IDS.has(t[0]) || SUPPRESSION_IDS.has(t[1])) && !RELEASE_IDS.has(t[2])) {
      problems.push(`${intent} 起/承含压抑类但合不是释放类，违反有压必放`);
    }
  }
  return problems;
}
const _selfProblems = validateWaveIntents();
if (_selfProblems.length) throw new Error(`WAVE_INTENT_TRIPLES 非法：${_selfProblems.join('；')}`);

export interface WaveRangePatch {
  intent: WaveIntent;
  /** 1 基、闭区间 */
  from: number; to: number;
  /** 分层 manual（30000 段情绪键 → 情绪节拍 id），可直接并入 CuePref.manual */
  manual: Record<number, string>;
  affectedEps: number[];
  /** 覆盖了多少个用户此前已定点的情绪位（反转/爽点位不计） */
  overwritten: number;
}

export interface PlanWaveRangeInput {
  episodeCount: number;
  /** 1 基，缺省 1 */
  from?: number;
  /** 1 基，缺省末集；首尾颠倒自动交换 */
  to?: number;
  intent: WaveIntent;
  /** 用户此前已有的 manual（用于统计覆盖数，不修改原对象） */
  existingManual?: Record<number, string>;
}

/** 把一个波形意图落到指定集区间：生成情绪三拍的分层 manual 定点（确定性、只动 30000 段） */
export function planWaveRange(input: PlanWaveRangeInput): WaveRangePatch {
  const n = clamp(Math.floor(input.episodeCount || 1), 1, 120);
  const meta = WAVE_INTENT_TRIPLES[input.intent];
  if (!meta) throw new Error(`unknown wave intent: ${String(input.intent)}`);
  let a = Number.isFinite(input.from as number) ? clamp(Math.floor(input.from as number), 1, n) : 1;
  let b = Number.isFinite(input.to as number) ? clamp(Math.floor(input.to as number), 1, n) : n;
  if (a > b) { const t = a; a = b; b = t; }
  const manual: Record<number, string> = {};
  const affectedEps: number[] = [];
  let overwritten = 0;
  for (let e = a - 1; e <= b - 1; e++) {
    affectedEps.push(e + 1);
    for (let j = 0; j < 3; j++) {
      const key = beatManualKey('emotion', e, j);
      const prev = input.existingManual?.[key];
      if (prev && prev !== meta[j]) overwritten += 1;
      manual[key] = meta[j];
    }
  }
  return { intent: input.intent, from: a, to: b, manual, affectedEps, overwritten };
}

export interface WaveDirectorInput {
  episodeCount: number;
  strength?: Strength;
  pref?: Partial<CuePref>;
  tags?: string[];
  from?: number; to?: number;
  intent?: WaveIntent | null;
}
export interface WaveDirectorResult {
  episodeCount: number;
  strength: Strength;
  intents: WaveIntentMeta[];
  /** 应用区间连改之前的曲线（含用户既有定点） */
  waveBefore: EmotionWave;
  /** 应用之后的曲线；未给意图时为 null */
  waveAfter: EmotionWave | null;
  patch: WaveRangePatch | null;
  note: { zh: string; en: string };
}

/** 生成前波形编排：始终返回 before 曲线；给意图时同时返回 patch 与 after 曲线，前端可对比曲线移动 */
export function buildWaveDirector(input: WaveDirectorInput, lang: 'zh' | 'en' = 'zh'): WaveDirectorResult {
  const n = clamp(Math.floor(input.episodeCount || 1), 1, 120);
  const strength: Strength = input.strength === 'relax' || input.strength === 'tight' || input.strength === 'balanced'
    ? input.strength : 'balanced';
  // 只要存在逐点定点，manual 仅在 manual/hybrid 模式生效；调用方未显式给 mode 时自动转 hybrid
  const pinCount = input.pref?.manual ? Object.keys(input.pref.manual).length : 0;
  const autoMode = input.pref?.mode ?? (pinCount ? 'hybrid' : undefined);
  const beforePref = normalizeBeatPref({ ...(input.pref ?? {}), strength, mode: autoMode });
  const waveBefore = buildEmotionWave(n, beforePref);
  let patch: WaveRangePatch | null = null;
  let waveAfter: EmotionWave | null = null;
  if (input.intent && WAVE_INTENT_TRIPLES[input.intent]) {
    patch = planWaveRange({
      episodeCount: n, from: input.from, to: input.to, intent: input.intent, existingManual: beforePref.manual,
    });
    const afterPref = normalizeBeatPref({ ...beforePref, mode: 'hybrid', manual: { ...beforePref.manual, ...patch.manual } });
    waveAfter = buildEmotionWave(n, afterPref);
  }
  const intents = WAVE_INTENTS.map((id) => waveIntentMeta(id, lang));
  const noteEn = 'The curve uses the same per-episode deterministic engine as real generation. A range edit pins only the three emotion beats; reversals and payoffs are untouched, and every template keeps the press→release guarantee. Planning here costs no credits.';
  const noteZh = '曲线与真实生成同源（逐集同种子重排，展示即生成）。区间连改只定点情绪三拍，反转、爽点不动；每种意图都守「有压必放」硬规则；本面板仅做方案编排，不消耗积分。';
  return {
    episodeCount: n, strength, intents, waveBefore, waveAfter, patch,
    note: { zh: noteZh, en: noteEn },
  };
}
