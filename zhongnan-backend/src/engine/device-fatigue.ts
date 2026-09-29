/**
 * v2.80 全剧装置疲劳分析引擎（Device Fatigue）——"装置脱敏"预警
 * ------------------------------------------------------------------
 * 与既有引擎的分工（避免重复）：
 *  - emotion-wave：逐集张力/效价波形 + 单集改稿建议
 *  - wave-director：波形导演的逐集改稿调度
 *  - 本引擎（v2.80）：全剧维度的装置使用疲劳——同一反转/爽点/情绪装置
 *    连用 ≥3 集、单一爽点占比 >60%、爽点种类不足，观众会"脱敏"。
 *
 * 输入：emotion-wave 复现出的逐集节拍点（reversalId / payoffIds / emotionPath 头部），
 * 因此推荐语与真实创作布点严格同源、确定性、可复现。
 * 输出：连续段（runs）、占比（shares）、健康分、问题清单、同 kind 最少使用 Top2 轮换建议。
 * 纯确定性、零 LLM、零 IO；中英双语，英文层零中文（由测试守护）。
 */
import { BEAT_LIBRARY, beatNameOf } from './beat-system';
import { BEAT_NAME_EN } from './emotion-wave';

export type DfLang = 'zh' | 'en';

export interface DeviceEpInput {
  ep: number;
  reversalId?: string | null;
  payoffIds?: string[];
  /** 情绪路径 id 序列，取头部为主情绪 */
  emotionPath?: string[];
}

export type DeviceKind = 'reversal' | 'payoff' | 'emotion';

export interface DeviceRun { kind: DeviceKind; id: string; run: number; fromEp: number; toEp: number }
export interface DeviceShare { kind: DeviceKind; id: string; count: number; ratio: number }
export interface DeviceIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'reversal_run' | 'payoff_monotone' | 'emotion_run' | 'payoff_variety_low';
  evidence: string;
  advice: string;
}
export interface DeviceRotation { kind: DeviceKind; currentId: string; suggestIds: string[]; suggestNames: string[] }
export interface DeviceFatigueResult {
  epCount: number;
  runs: DeviceRun[];
  shares: DeviceShare[];
  score: number;
  issues: DeviceIssue[];
  rotations: DeviceRotation[];
}

/** 装置名：zh 用 beat-system 中文名；en 用 emotion-wave 英文名表（回退 beatNameOf/id），保证英文层零中文 */
function nameOf(id: string, lang: DfLang): string {
  if (lang === 'en') return BEAT_NAME_EN[id] ?? beatNameOf(id, 'en') ?? id;
  return beatNameOf(id, 'zh') || id;
}

/** 连续段：按 ep 升序，同 id 连续出现记一段；id 缺省断段 */
function runsOf(seq: { ep: number; id: string | null }[]): DeviceRun[] {
  const out: DeviceRun[] = [];
  let cur: { id: string; from: number; to: number; run: number } | null = null;
  for (const { ep, id } of seq) {
    if (id && cur && id === cur.id) { cur.run += 1; cur.to = ep; continue; }
    if (cur && cur.run >= 2) out.push({ kind: 'reversal', id: cur.id, run: cur.run, fromEp: cur.from, toEp: cur.to });
    cur = id ? { id, from: ep, to: ep, run: 1 } : null;
  }
  if (cur && cur.run >= 2) out.push({ kind: 'reversal', id: cur.id, run: cur.run, fromEp: cur.from, toEp: cur.to });
  return out;
}

function withKind(rs: DeviceRun[], kind: DeviceKind): DeviceRun[] {
  return rs.map((r) => ({ ...r, kind }));
}

/**
 * 全剧装置疲劳分析。eps 不足 3 集时不产出问题（样本太小，避免噪声）。
 */
export function deviceFatigue(eps: DeviceEpInput[], lang: DfLang = 'zh'): DeviceFatigueResult {
  const sorted = [...eps].sort((a, b) => a.ep - b.ep);
  const epCount = sorted.length;
  const revSeq = sorted.map((e) => ({ ep: e.ep, id: e.reversalId ?? null }));
  const emoSeq = sorted.map((e) => ({ ep: e.ep, id: e.emotionPath?.[0] ?? null }));

  // 爽点：逐 id 在各集的出现序列（同集去重）
  const payoffIdsAll = [...new Set(sorted.flatMap((e) => e.payoffIds ?? []))];
  const payoffRuns: DeviceRun[] = [];
  const shares: DeviceShare[] = [];
  for (const id of payoffIdsAll) {
    const seq = sorted.map((e) => ({ ep: e.ep, id: (e.payoffIds ?? []).includes(id) ? id : null }));
    payoffRuns.push(...runsOf(seq));
    const count = sorted.filter((e) => (e.payoffIds ?? []).includes(id)).length;
    shares.push({ kind: 'payoff', id, count, ratio: epCount ? Math.round((count / epCount) * 100) / 100 : 0 });
  }
  shares.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  const revRuns = withKind(runsOf(revSeq), 'reversal');
  const emoRuns = withKind(runsOf(emoSeq), 'emotion');
  const payRuns = withKind(payoffRuns, 'payoff');
  const runs = [...revRuns, ...payRuns, ...emoRuns].sort((a, b) => b.run - a.run);

  const issues: DeviceIssue[] = [];
  const rotations: DeviceRotation[] = [];
  let score = 100;
  if (epCount >= 3) {
    // 1) 反转连用
    for (const r of revRuns.filter((x) => x.run >= 3)) {
      const high = r.run >= 4;
      issues.push({
        severity: high ? 'high' : 'mid', type: 'reversal_run',
        evidence: lang === 'en'
          ? `"${nameOf(r.id, 'en')}" used in ${r.run} consecutive episodes (ep${r.fromEp}-${r.toEp})`
          : `反转装置「${nameOf(r.id, 'zh')}」连续 ${r.run} 集使用（第${r.fromEp}-${r.toEp}集）`,
        advice: lang === 'en'
          ? 'The same reversal three episodes running numbs the audience. Rotate within the reversal family — use the least-used devices suggested below, or fold the reversal into a payoff beat.'
          : `同一反转连用三集观众就麻了。下一集在反转家族里换装置（系统已按使用率给出最少使用的候选），或本集改用"爽点接反转"的复合结构。`,
      });
      rotations.push(buildRotation('reversal', r.id, sorted, lang));
      score -= high ? 25 : 12;
    }
    // 2) 爽点单调：连用 / 占比
    for (const r of payRuns.filter((x) => x.run >= 3)) {
      issues.push({
        severity: 'mid', type: 'payoff_monotone',
        evidence: lang === 'en'
          ? `"${nameOf(r.id, 'en')}" payoff used in ${r.run} consecutive episodes (ep${r.fromEp}-${r.toEp})`
          : `爽点装置「${nameOf(r.id, 'zh')}」连续 ${r.run} 集兑现（第${r.fromEp}-${r.toEp}集）`,
        advice: lang === 'en'
          ? 'Same payoff flavor back to back flattens the high. Swap in an unused payoff device to reset the taste.'
          : '同款爽点连着兑现，爽感会边际递减。换一个未用的爽点装置给味蕾重置。',
      });
      rotations.push(buildRotation('payoff', r.id, sorted, lang));
      score -= 12;
    }
    for (const s of shares.filter((x) => x.ratio > 0.6 && epCount >= 4)) {
      issues.push({
        severity: 'mid', type: 'payoff_monotone',
        evidence: lang === 'en'
          ? `"${nameOf(s.id, 'en')}" appears in ${Math.round(s.ratio * 100)}% of episodes (${s.count}/${epCount})`
          : `爽点装置「${nameOf(s.id, 'zh')}」覆盖 ${Math.round(s.ratio * 100)}% 的集数（${s.count}/${epCount}）`,
        advice: lang === 'en'
          ? 'One payoff flavor dominating over 60% of episodes reads as assembly-line writing. Diversify the payoff mix.'
          : '单一爽点占六成以上，像流水线作业。打散爽点配比，混入两类以上不同装置。',
      });
      rotations.push(buildRotation('payoff', s.id, sorted, lang));
      score -= 15;
    }
    // 3) 情绪主轴连用
    for (const r of emoRuns.filter((x) => x.run >= 3)) {
      issues.push({
        severity: 'mid', type: 'emotion_run',
        evidence: lang === 'en'
          ? `Emotional throughline "${nameOf(r.id, 'en')}" held for ${r.run} episodes (ep${r.fromEp}-${r.toEp})`
          : `情绪主轴「${nameOf(r.id, 'zh')}」连续 ${r.run} 集不变（第${r.fromEp}-${r.toEp}集）`,
        advice: lang === 'en'
          ? 'Holding one emotion head three+ episodes makes the wave flat. Shift the opening emotion beat of the next episode to a different family member.'
          : '情绪头连续三集不换，波形趋平。下一集把情绪路径头部换成同族其它节拍，制造先压后放的落差。',
      });
      rotations.push(buildRotation('emotion', r.id, sorted, lang));
      score -= 12;
    }
    // 4) 爽点种类不足
    if (epCount >= 4 && payoffIdsAll.length < 3) {
      issues.push({
        severity: 'mid', type: 'payoff_variety_low',
        evidence: lang === 'en'
          ? `Only ${payoffIdsAll.length} distinct payoff device(s) across ${epCount} episodes`
          : `${epCount} 集内仅使用 ${payoffIdsAll.length} 种爽点装置`,
        advice: lang === 'en'
          ? 'Fewer than three payoff devices across 4+ episodes tastes repetitive. Pull from the payoff family the engine already ships.'
          : '四集以上却不足三种爽点，重复感明显。从系统爽点家族里至少再启用两类。',
      });
      score -= 15;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
  }
  // 去重轮换建议（同 kind+currentId 只留一条）
  const seenRot = new Set<string>();
  const dedupRot = rotations.filter((r) => {
    const k = `${r.kind}:${r.currentId}`;
    if (seenRot.has(k)) return false;
    seenRot.add(k);
    return true;
  });

  return { epCount, runs, shares, score, issues, rotations: dedupRot };
}

/**
 * v2.80 生成侧注入：把疲劳分析转成架构师"本集布点约束"指令（与 continuityBrief 同构，双语齐备）。
 * 有 issue 才出话（无疲劳信号不打扰生成）；epCount<3 或零 issue 返回空串；
 * 英文层零中文由 deviceFatigue(eps,'en') + nameOf(en) 保证。
 */
export function fatigueDirective(eps: DeviceEpInput[]): { zh: string; en: string } {
  const base = deviceFatigue(eps, 'zh');
  if (!base.issues.length) return { zh: '', en: '' };
  const build = (r: DeviceFatigueResult, isEn: boolean): string => {
    const lines = isEn
      ? ['[Device fatigue guard — beat constraints for this episode]']
      : ['【装置防疲劳·本集布点约束】'];
    for (const i of r.issues) {
      lines.push(isEn ? `  - ${i.evidence} — ${i.advice}` : `  - ${i.evidence}；${i.advice}`);
    }
    for (const rot of r.rotations) {
      lines.push(isEn
        ? `  - Rotate "${nameOf(rot.currentId, 'en')}" toward least-used alternatives, prefer: ${rot.suggestNames.join(' / ')}`
        : `  - 「${nameOf(rot.currentId, 'zh')}」优先轮换：${rot.suggestNames.join(' / ')}`);
    }
    return lines.join('\n') + '\n';
  };
  return { zh: build(base, false), en: build(deviceFatigue(eps, 'en'), true) };
}

/** 同 kind 内按"全剧使用次数升序 + 库序稳定"挑最少使用的 2 个候选 */
function buildRotation(kind: DeviceKind, currentId: string, eps: DeviceEpInput[], lang: DfLang): DeviceRotation {
  const library = BEAT_LIBRARY[kind] ?? [];
  const usage = new Map<string, number>();
  for (const e of eps) {
    const ids = kind === 'reversal' ? [e.reversalId ?? null]
      : kind === 'emotion' ? [e.emotionPath?.[0] ?? null]
        : (e.payoffIds ?? []);
    for (const id of new Set(ids.filter((x): x is string => Boolean(x)))) {
      usage.set(id, (usage.get(id) ?? 0) + 1);
    }
  }
  const cands = library
    .map((b) => b.id)
    .filter((id) => id !== currentId)
    .sort((a, b) => (usage.get(a) ?? 0) - (usage.get(b) ?? 0));
  const suggestIds = cands.slice(0, 2);
  return { kind, currentId, suggestIds, suggestNames: suggestIds.map((id) => nameOf(id, lang)) };
}
