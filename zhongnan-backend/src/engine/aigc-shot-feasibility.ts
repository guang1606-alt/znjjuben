/**
 * v2.341 AIGC 单镜可生成性闸门（机器分镜层口径）
 * ------------------------------------------------------------------
 * 缺口：v2.33 已有机器分镜层 buildShotManifest，但没有任何引擎判定「单镜能否被
 * 生图/视频/配音模型生成」——一镜塞 8 句台词、单镜 ≥8 秒、纯台词无画面镜都能过闸。
 * 本模块只做判定与诊断，不改写；复用 buildShotManifest，保证「分镜中层 ↔ 闸门」同源。
 *
 * 口径：1 秒 ≈ 22 字当量（视觉叙述 + 台词 + 内心），英文按单词×1.67 折算。
 *  - high（不可生成，进 violations）：单镜 ≥8 秒；整镜无画面（纯台词/纯音效）
 *  - mid（成本/质量提示，不拦截）：单镜 5-8 秒；单镜台词 ≥4 句
 * 纯函数、确定性、双语；英文链路零中文。
 */
import { buildShotManifest, type MachineShot } from './aigc-screenplay';

export const AIGC_SHOT_LIMITS = {
  /** 每秒成片可承载的字当量（中文叙述朗读 + 台词节奏综合） */
  unitsPerSecond: 22,
  /** 单镜硬上限：≥8 秒视频模型无法稳定生成，必须拆镜 */
  shotHighSeconds: 8,
  /** 单镜建议上限：5 秒以上开始出现动作/口型漂移 */
  shotMidSeconds: 5,
  /** 单镜台词句数建议上限 */
  linesPerShotMid: 4,
};

export type AigcShotIssue = {
  kind: 'shot_overlong' | 'visualess_shot' | 'lines_jammed';
  severity: 'high' | 'mid';
  message: string;
  evidence: string[];
};

export interface AigcShotStats {
  shotCount: number;
  /** 每分钟镜头数（成片时长口径） */
  shotsPerMinute: number;
  avgUnits: number;
  maxUnits: number;
  /** 最长单镜估算秒数 */
  maxSeconds: number;
  /** 整镜无画面的镜头数（纯台词/纯音效场） */
  visualessShots: number;
  /** 单镜承载台词句数峰值 */
  maxLinesPerShot: number;
}

/** v2.343 逐镜健康面板：MachineShot 原始数据的聚合视图，每镜一行 */
export interface ShotBreakdownItem {
  scene: number;
  shot: number;
  size: string;
  move: string;
  /** 估算秒数（取视觉/发声较大值 / unitsPerSecond） */
  seconds: number;
  /** 字当量合计（视觉 + 发声） */
  units: number;
  /** 台词句数 */
  lines: number;
  /** 是否有画面描述 */
  hasVisual: boolean;
  /** 风险等级：与 issues 对齐 */
  risk: 'ok' | 'mid' | 'high';
  /** 画面摘要（截取前 30 字/词，供前端快速预览） */
  visual: string;
}

export interface AigcShotReport {
  level: 'ok' | 'watch' | 'over';
  score: number;
  stats: AigcShotStats;
  issues: AigcShotIssue[];
  /** v2.343 逐镜健康面板（按 seconds 降序 → units 降序 → scene 升序 → shot 升序） */
  shotBreakdown: ShotBreakdownItem[];
}

function countCjk(s: string): number {
  const m = String(s || '').match(/[一-鿿]/g);
  return m ? m.length : 0;
}
function countEnWords(s: string): number {
  const m = String(s || '').match(/[a-z][a-z'-]*/gi);
  return m ? m.length : 0;
}
/** 字当量：英文按单词×1.67 折算汉字，中文按汉字数（夹带英文的少量词一并折算） */
function unitsOf(s: string, en: boolean): number {
  const c = countCjk(s);
  const w = countEnWords(s);
  return en ? Math.round(w * 1.67) : c + Math.round(w * 1.67);
}
function shotUnits(sh: MachineShot, en: boolean): number {
  return shotVisualUnits(sh, en) + shotSpokenUnits(sh, en);
}
function shotVisualUnits(sh: MachineShot, en: boolean): number {
  return unitsOf(sh.visual, en);
}
function shotSpokenUnits(sh: MachineShot, en: boolean): number {
  const lines = sh.lines.reduce((n, l) => n + unitsOf(l.text, en), 0);
  const inner = sh.inner.reduce((n, x) => n + unitsOf(x, en), 0);
  return lines + inner;
}
/**
 * 单镜估算秒数：台词与内心独白是叠在画面上播的，不与画面时长相加，取二者较大值。
 * （一镜画面 4 秒、台词 6 秒 → 实测 6 秒；否则正常的长画面+正常台词会被误判成巨镜）
 */
function shotSeconds(sh: MachineShot, en: boolean): number {
  const v = shotVisualUnits(sh, en);
  const s = shotSpokenUnits(sh, en);
  return Math.round((Math.max(v, s) / AIGC_SHOT_LIMITS.unitsPerSecond) * 10) / 10;
}

export function checkAigcShotFeasibility(
  text: string,
  durationMin = 1,
  lang: 'zh' | 'en' = countCjk(text) >= countEnWords(text) ? 'zh' : 'en',
): AigcShotReport {
  const en = lang === 'en';
  const d = Math.min(5, Math.max(0.5, Number(durationMin) || 1));
  const shots = buildShotManifest(text || '').shots;
  const totalUnits = shots.reduce((n, sh) => n + shotUnits(sh, en), 0);
  const maxUnits = shots.reduce((n, sh) => Math.max(n, shotUnits(sh, en)), 0);
  const maxSeconds = shots.reduce((n, sh) => Math.max(n, shotSeconds(sh, en)), 0);
  const visualessShots = shots.filter((sh) => !String(sh.visual || '').trim()).length;
  const maxLinesPerShot = shots.reduce((n, sh) => Math.max(n, sh.lines.length), 0);

  const stats: AigcShotStats = {
    shotCount: shots.length,
    shotsPerMinute: shots.length ? Math.round((shots.length / d) * 10) / 10 : 0,
    avgUnits: shots.length ? Math.round(totalUnits / shots.length) : 0,
    maxUnits,
    maxSeconds,
    visualessShots,
    maxLinesPerShot,
  };

  if (!shots.length) return { level: 'ok', score: 100, stats, issues: [], shotBreakdown: [] };

  const issues: AigcShotIssue[] = [];
  const breakdown: ShotBreakdownItem[] = [];
  for (const sh of shots) {
    const u = shotUnits(sh, en);
    const sec = shotSeconds(sh, en);
    const at = en ? `Scene ${sh.scene} shot ${sh.shot}` : `第${sh.scene}场第${sh.shot}镜`;
    const hasVisual = !!String(sh.visual || '').trim();
    // risk 判定（high 覆盖 mid）
    let risk: 'ok' | 'mid' | 'high' = 'ok';
    if (!hasVisual || sec >= AIGC_SHOT_LIMITS.shotHighSeconds) risk = 'high';
    else if (sec >= AIGC_SHOT_LIMITS.shotMidSeconds || sh.lines.length >= AIGC_SHOT_LIMITS.linesPerShotMid) risk = 'mid';
    // 画面摘要：中英都按字符截取前 30
    const visual = String(sh.visual || '').slice(0, 30);
    breakdown.push({
      scene: sh.scene, shot: sh.shot, size: sh.size, move: sh.move,
      seconds: sec, units: u, lines: sh.lines.length,
      hasVisual, risk, visual,
    });

    if (!hasVisual) {
      issues.push({
        kind: 'visualess_shot',
        severity: 'high',
        message: en
          ? `${at} has no visual description at all; image/video models have nothing to render, so it cannot be generated — give it one concrete visual action.`
          : `${at} 没有画面描述，只有台词/音效，生图与视频模型没有可生成内容——不可生成，需补一个可拍摄的画面动作。`,
        evidence: [`lines:${sh.lines.length}`, `units:${u}`],
      });
    }
    if (sec >= AIGC_SHOT_LIMITS.shotHighSeconds) {
      issues.push({
        kind: 'shot_overlong',
        severity: 'high',
        message: en
          ? `${at} runs about ${sec}s (${u} units); a single shot over ${AIGC_SHOT_LIMITS.shotHighSeconds}s cannot be generated reliably — split it into several shots.`
          : `${at} 约 ${sec} 秒（${u} 字当量），单镜超过 ${AIGC_SHOT_LIMITS.shotHighSeconds} 秒不可生成，需拆成多镜。`,
        evidence: [`units:${u}`, `seconds:${sec}`, `lines:${sh.lines.length}`],
      });
    } else if (sec >= AIGC_SHOT_LIMITS.shotMidSeconds) {
      issues.push({
        kind: 'shot_overlong',
        severity: 'mid',
        message: en
          ? `${at} runs about ${sec}s; keep shots under 5s to avoid lip-sync and motion drift — splitting is optional.`
          : `${at} 约 ${sec} 秒，偏长（建议单镜不超过 ${AIGC_SHOT_LIMITS.shotMidSeconds} 秒），可拆可保留，仅提示成本与漂移风险。`,
        evidence: [`units:${u}`, `seconds:${sec}`],
      });
    }
    if (sh.lines.length >= AIGC_SHOT_LIMITS.linesPerShotMid) {
      issues.push({
        kind: 'lines_jammed',
        severity: 'mid',
        message: en
          ? `${at} carries ${sh.lines.length} dialogue lines; lip-sync and pacing will drift — split lines across adjacent shots.`
          : `${at} 塞了 ${sh.lines.length} 句台词，口型与节奏会对不上，建议拆镜或把台词分给相邻镜头。`,
        evidence: [`lines:${sh.lines.length}`, `units:${u}`],
      });
    }
  }

  // 排序：seconds 降序 → units 降序 → scene 升序 → shot 升序
  breakdown.sort((a, b) =>
    b.seconds - a.seconds || b.units - a.units || a.scene - b.scene || a.shot - b.shot,
  );

  const high = issues.filter((i) => i.severity === 'high').length;
  const mid = issues.filter((i) => i.severity === 'mid').length;
  const level: AigcShotReport['level'] = high ? 'over' : mid ? 'watch' : 'ok';
  const score = Math.max(0, 100 - high * 25 - mid * 12);
  return { level, score, stats, issues, shotBreakdown: breakdown };
}
