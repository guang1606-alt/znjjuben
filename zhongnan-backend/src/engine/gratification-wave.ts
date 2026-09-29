/**
 * v2.80 憋爽波浪台账（Gratification Wave Ledger）
 * ------------------------------------------------------------------
 * 缺口：payoff-rhythm-check 只看本集内"憋→爽"配对；跨集节奏崩坏
 * 无人管理——第3集被虐、第4集被虐、第5集还在被虐（连续多集零释放），
 * 或连续多集没有一次翻盘级的强释放，或爽点回回全堆在集尾（中段空窗），
 * 或连续多集白捡的胜利（一路平推）。观众熬不过连续的"憋"。
 *
 * 输入：route 逐集落库 payoff-rhythm 的摘要四元组
 * （suppressCount/releaseCount/strongReleaseCount/firstReleasePosition，
 * 存于 qcReport.payoffRhythm），下一集从 qcReport 提取喂回台账，
 * 形成"逐集检测摘要 → 下一集架构师布点约束"的检测→生成闭环。
 *
 * 规则（从最后一个已完成集往回数连续段，与 device-fatigue 同构）：
 *   1) 连续 ≥3 集无强释放 → mid；≥5 集 → high（憋太久）
 *   2) 连续 ≥2 集零释放（纯虐） → high（弃剧线）
 *   3) 连续 ≥3 集零受压（一路白捡的胜利） → mid（爽点无支点）
 *   4) 连续 ≥3 集"首个释放位置 ≥70% 篇幅" → mid（中段爽点空窗）
 * 集数不连续（取数窗口边界）即停，宁少报不误报。
 *
 * 输出：问题清单 + 架构师"爽感波浪"指令（与 fatigueDirective 同构：
 * 有跨集疲劳信号才注入）。
 * 纯确定性、零 LLM、零 IO；中英双语，en 层系统文案零中文。
 */

export interface WaveEpInput {
  /** 集号 */
  ep: number;
  /** 受压信号数 */
  suppressCount: number;
  /** 释放信号数 */
  releaseCount: number;
  /** 强释放数（翻盘/打脸/身份揭晓/跪求等） */
  strongReleaseCount: number;
  /** 首个释放位置 0-1，无释放为 null */
  firstReleasePosition: number | null;
}

export type GratIssueType =
  | 'no_strong_stretch'   // 连续无强释放
  | 'no_release_stretch'  // 连续零释放（纯虐）
  | 'no_suppress_stretch' // 连续零受压（一路平推）
  | 'tail_loaded_stretch'; // 连续爽点堆尾段

export interface GratIssue {
  severity: 'mid' | 'high';
  type: GratIssueType;
  /** 连续段起点集号 */
  fromEp: number;
  /** 连续段集数 */
  stretch: number;
}

export interface GratWaveResult {
  tracked: number;
  issues: GratIssue[];
}

/** 阈值：无强爽 ≥3 报 mid / ≥5 升 high；零释放 ≥2 即 high；无受压/尾段堆积 ≥3 报 mid */
export const GRAT_STRONG_MID = 3;
export const GRAT_STRONG_HIGH = 5;
export const GRAT_NORELEASE_HIGH = 2;
export const GRAT_STRETCH_MID = 3;
/** 首个释放位置被认定"堆在尾段"的门槛 */
export const GRAT_TAIL_POSITION = 0.7;

/**
 * 未知结构 → 规范化逐集摘要。容错：缺字段/非法值按 0 / null 处理。
 */
export function normalizeWaveEp(raw: unknown): WaveEpInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  const pos = r.firstReleasePosition;
  return {
    ep,
    suppressCount: num(r.suppressCount),
    releaseCount: num(r.releaseCount),
    strongReleaseCount: num(r.strongReleaseCount),
    firstReleasePosition: typeof pos === 'number' && Number.isFinite(pos) ? Math.max(0, Math.min(1, pos)) : null,
  };
}

/**
 * 憋爽波浪台账：按 ep 建索引，从最后一个已完成集往回数四类连续段。
 * 集数断档（该集无记录）即停——窗口外不猜。
 */
export function gratificationWave(prev: WaveEpInput[], curEpNo: number): GratWaveResult {
  const lastDone = Math.max(0, (Math.round(curEpNo) || 1) - 1);
  const byEp = new Map<number, WaveEpInput>();
  for (const raw of prev ?? []) {
    const w = normalizeWaveEp(raw);
    if (w) byEp.set(w.ep, w); // 同集后写覆盖先写（route 侧已按每集一行提取）
  }
  if (!byEp.has(lastDone)) return { tracked: byEp.size, issues: [] }; // 最后已完成集无记录 → 无法数连续段

  const countStretch = (pred: (w: WaveEpInput) => boolean): number => {
    let n = 0;
    for (let ep = lastDone; ep >= 1; ep -= 1) {
      const w = byEp.get(ep);
      if (!w) break; // 断档即停
      if (!pred(w)) break;
      n += 1;
    }
    return n;
  };

  const noStrong = countStretch((w) => w.strongReleaseCount <= 0);
  const noRelease = countStretch((w) => w.releaseCount <= 0);
  const noSuppress = countStretch((w) => w.suppressCount <= 0);
  const tailLoaded = countStretch((w) => w.firstReleasePosition !== null && w.firstReleasePosition >= GRAT_TAIL_POSITION);

  const issues: GratIssue[] = [];
  const push = (severity: GratIssue['severity'], type: GratIssueType, stretch: number, fromEp: number) => {
    if (stretch > 0) issues.push({ severity, type, fromEp, stretch });
  };
  if (noStrong >= GRAT_STRONG_HIGH) push('high', 'no_strong_stretch', noStrong, lastDone - noStrong + 1);
  else if (noStrong >= GRAT_STRONG_MID) push('mid', 'no_strong_stretch', noStrong, lastDone - noStrong + 1);
  if (noRelease >= GRAT_NORELEASE_HIGH) push('high', 'no_release_stretch', noRelease, lastDone - noRelease + 1);
  if (noSuppress >= GRAT_STRETCH_MID) push('mid', 'no_suppress_stretch', noSuppress, lastDone - noSuppress + 1);
  if (tailLoaded >= GRAT_STRETCH_MID) push('mid', 'tail_loaded_stretch', tailLoaded, lastDone - tailLoaded + 1);

  const rank = { high: 0, mid: 1 } as const;
  issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { tracked: byEp.size, issues };
}

/**
 * 爽感波浪调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 有跨集疲劳信号才出话；无问题/无输入返回空串（与 fatigueDirective 同构）。
 */
export function gratificationDirective(prev: WaveEpInput[], curEpNo: number): { zh: string; en: string } {
  const r = gratificationWave(prev, curEpNo);
  if (!r.issues.length) return { zh: '', en: '' };
  const build = (isEn: boolean): string => {
    const lines = isEn
      ? ['[Gratification wave — cross-episode pacing guard]']
      : ['【爽感波浪·跨集节奏】'];
    for (const i of r.issues) {
      if (i.type === 'no_strong_stretch') {
        lines.push(isEn
          ? `  - ${i.stretch} episodes in a row without a single strong release (table-turn / face-slap / identity-reveal level) — this episode MUST land at least one strong release; the audience has been starved.`
          : `  - 已连续 ${i.stretch} 集没有任何强释放（翻盘/打脸/身份揭晓级）——本集必须安排至少一次强释放，观众已经憋太久了。`);
      } else if (i.type === 'no_release_stretch') {
        lines.push(isEn
          ? `  - ${i.stretch} episodes in a row with zero release (pure suffering) — give a release this episode; two straight all-pain episodes is the quit line.`
          : `  - 已连续 ${i.stretch} 集零释放（纯虐）——本集必须给一次释放，连续纯虐两集就是弃剧线。`);
      } else if (i.type === 'no_suppress_stretch') {
        lines.push(isEn
          ? `  - ${i.stretch} episodes in a row of unearned wins (no pressure at all) — make the protagonist pay a price first this episode; victories without a setup feel cheap.`
          : `  - 已连续 ${i.stretch} 集零受压（一路白捡的胜利）——本集先让主角吃亏/受压再赢，没有支点的爽点是廉价的。`);
      } else {
        lines.push(isEn
          ? `  - ${i.stretch} episodes in a row where the first release lands past 70% of the runtime — put a release inside the first third this episode; no mid-episode gratification drought.`
          : `  - 已连续 ${i.stretch} 集首个释放拖到 70% 篇幅之后——本集前 1/3 内安排一次释放，中段不留爽点空窗。`);
      }
    }
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
