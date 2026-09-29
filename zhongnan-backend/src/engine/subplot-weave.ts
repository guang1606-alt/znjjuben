/**
 * v2.80 支线编织台账（Subplot Weave Ledger）
 * ------------------------------------------------------------------
 * 缺口：连载剧的 B 线（支线剧情线）没有结构化载体——大纲 JSON 只有
 * 主线节拍/钩子/爽点，支线全靠模型即兴；后果是支线断线（埋了没人接，
 * 观众"这条线怎么没下文了"）或支线自说自话（与主线节拍零交织）。
 *
 * 载体：大纲 JSON 新增可选字段 subplots: string[]（本集活跃支线名，
 * 每条 ≤12 字、最多 3 条）。route 落库 qcReport.outline.subplots，
 * 下一集从 qcReport 提取为 SubplotBit（thread × epNo）喂回台账，
 * 形成"上一集声明 → 下一集接续调度"的检测→生成闭环。
 *
 * 规则：从最后一个已完成集往回数——
 *   未接续 ≥3 集 → mid（支线冷却）；≥5 集 → high（支线断线）。
 * 指令：架构师必须输出 subplots 字段；冷却支线要么接回（沿用原词保
 * 命名一致）要么在节拍里明确收束；支线拍点须嵌进主线节拍（反转/爽点/
 * 集尾卡点承载），不开孤立的纯支线场。
 *
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * 支线名为架构师产出标识符按原样透传。
 */

export interface SubplotBit {
  /** 支线名（大纲 subplots 原词） */
  thread: string;
  /** 声明该支线活跃的集号 */
  epNo: number;
}

export interface SubplotCold {
  severity: 'mid' | 'high';
  thread: string;
  /** 最后一次活跃集号 */
  lastEp: number;
  /** 截至上个已完成集未接续集数 */
  gap: number;
}

export interface SubplotWeaveResult {
  tracked: number;
  cold: SubplotCold[];
}

/** 未接续阈值：≥3 集报 mid，≥5 集升 high */
export const SUBPLOT_GAP_MID = 3;
export const SUBPLOT_GAP_HIGH = 5;
/** 每集最多声明支线数 */
export const SUBPLOT_MAX_PER_EP = 3;
/** 单条支线名长度上限（字） */
export const SUBPLOT_MAX_LEN = 12;

/**
 * 大纲（或任意未知结构）中的 subplots 字段 → 规范化支线位。
 * 容错：非数组/非字符串项一律丢弃；trim、滤空、滤单字、滤超长、去重、cap。
 */
export function deriveSubplotBits(src: unknown, epNo: number): SubplotBit[] {
  const no = Math.max(1, Math.round(epNo) || 1);
  const raw = (src && typeof src === 'object' ? (src as { subplots?: unknown }).subplots : undefined);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SubplotBit[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (t.length < 2 || t.length > SUBPLOT_MAX_LEN) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({ thread: t, epNo: no });
    if (out.length >= SUBPLOT_MAX_PER_EP) break;
  }
  return out;
}

/**
 * 支线编织台账：按 thread 聚合最后活跃集，从最后一个已完成集往回数
 * 未接续集数，≥MID 报冷却/≥HIGH 报断线。输出按严重度降序、cap 4。
 */
export function subplotWeaveLedger(bits: SubplotBit[], curEpNo: number): SubplotWeaveResult {
  const lastDone = Math.max(0, (Math.round(curEpNo) || 1) - 1); // 最后一个已完成集
  const lastEpOf = new Map<string, number>();
  for (const b of bits ?? []) {
    const t = (b?.thread ?? '').trim();
    const ep = Math.max(1, Math.round(b?.epNo) || 1);
    if (!t) continue;
    const prev = lastEpOf.get(t);
    if (prev === undefined || ep > prev) lastEpOf.set(t, ep);
  }
  const cold: SubplotCold[] = [];
  for (const [thread, lastEp] of lastEpOf) {
    const gap = lastDone - lastEp;
    if (gap < SUBPLOT_GAP_MID) continue;
    cold.push({ severity: gap >= SUBPLOT_GAP_HIGH ? 'high' : 'mid', thread, lastEp, gap });
  }
  // 稳定排序：先按严重度（high 在前）再按 gap 降序，同级同 gap 保持构造序
  const rank = { high: 0, mid: 1 } as const;
  cold.sort((x, y) => rank[x.severity] - rank[y.severity] || y.gap - x.gap);
  return { tracked: lastEpOf.size, cold: cold.slice(0, 4) };
}

/**
 * 支线编织调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 与 pairBondDirective 的差异：schema 要求恒在（subplots 字段是闭环载体，
 * 第 1 集就要开始声明），冷线块按需追加。
 */
export function subplotWeaveDirective(bits: SubplotBit[], curEpNo: number): { zh: string; en: string } {
  const r = subplotWeaveLedger(bits, curEpNo);
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Subplot weave — keep B-threads alive]']
      : ['【支线编织·B线接续】'];
    lines.push(isEn
      ? '  - The outline JSON MUST include a "subplots" field: names of B-threads active this episode (each at most 12 characters, at most 3, [] if none).'
      : '  - 大纲 JSON 必须含 subplots 字段：本集活跃支线名列表（每条不超过12字，最多3条，无支线则填[]）。');
    lines.push(isEn
      ? '  - Never let a subplot run in isolation: carry each subplot beat inside a main-line beat (a reversal, a payoff, or the end hook); no standalone subplot-only scenes.'
      : '  - 支线不得自说自话：支线拍点要嵌进主线节拍承载（反转/爽点/集尾卡点任一），不开孤立的纯支线场。');
    if (r.cold.length) {
      lines.push(isEn
        ? '  - These threads went cold — this episode pick one and either resume it (reuse the exact name in subplots) or close it explicitly (resolve it inside beats):'
        : '  - 以下支线已断线，本集必须二选一：接回（subplots 沿用原词）或明确收束（在节拍里交代结局）：');
      for (const c of r.cold) {
        lines.push(isEn
          ? `    - "${c.thread}" unseen since ep${c.lastEp} (${c.gap} episodes cold)`
          : `    - 「${c.thread}」自第${c.lastEp}集后再未出现（已断${c.gap}集）`);
      }
    }
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
