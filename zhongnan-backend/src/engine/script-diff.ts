/**
 * script-diff.ts —— 剧本版本行级对比（纯函数、零 token、确定性，可单测/可缓存）
 *
 * /fix 与围读改写每次都新增 Script 版本行并保留旧版；用户付了积分，必须能看到“小南到底改了什么”。
 * 本模块按行做 LCS 对齐，输出 equal/added/removed 段落序列、统计与改写幅度分档：
 *  - splitScriptLines：按行切分、trim、丢弃空行（空白差异不产生噪音）；
 *  - diffScripts：LCS 动态规划（单集剧本通常 <150 行，O(nm) 毫秒级）；
 *  - assessRewrite：对称行 churn=(added+removed)/2/max(旧行,新行)，分 negligible/light/partial/major；
 *  - summarizeChanges（c204）：把红绿行按"场标/台词/动作/其他"归类计数 + 摘出最值得看的改动亮点，
 *    在逐行 diff 之上给一句"小南改了什么"，零 token、确定性。
 * 不连库、不调模型、不做语言识别；钱与 I/O 一律在路由层。
 */

import { parseScriptLine, type ScriptLineKind } from './listen-script';

export type DiffSegType = 'equal' | 'added' | 'removed';
export interface DiffSegment { type: DiffSegType; text: string }
export interface DiffStats { equal: number; added: number; removed: number }
export type RewriteLevel = 'negligible' | 'light' | 'partial' | 'major';

/**
 * c203：DP 行数硬上限。LCS 是 O(nm) 时间与内存：2000×2000=400 万 cell
 * （number[] 双层数组实际占用数十 MB），正常单集剧本 <150 行，2000 行留足 10 倍余量。
 * 超限直接拒绝，避免异常超长内容把只读 diff 端点拖垮（OOM/长事件循环阻塞）。
 */
export const MAX_DIFF_LINES = 2000;
export class ScriptTooLargeError extends Error {
  code = 'SCRIPT_TOO_LARGE' as const;
  constructor() { super('剧本过长，超过在线逐行对比的行数上限'); this.name = 'ScriptTooLargeError'; }
}

/** 剧本按行归一：拆行、去首尾空白、丢空行；null/undefined 安全为空数组 */
export function splitScriptLines(text: string): string[] {
  return String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/** 行级 LCS 对比，返回按原文顺序排列的段落序列（removed/added 成对出现在改动位置） */
export function diffScripts(oldText: string, newText: string): { segments: DiffSegment[]; stats: DiffStats } {
  const a = splitScriptLines(oldText);
  const b = splitScriptLines(newText);
  const n = a.length;
  const m = b.length;
  if (n > MAX_DIFF_LINES || m > MAX_DIFF_LINES) throw new ScriptTooLargeError();
  // dp[i][j] = a[i:] 与 b[j:] 的最长公共子序列长度
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      segments.push({ type: 'equal', text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      segments.push({ type: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) segments.push({ type: 'removed', text: a[i++] });
  while (j < m) segments.push({ type: 'added', text: b[j++] });
  const stats: DiffStats = { equal: 0, added: 0, removed: 0 };
  for (const s of segments) stats[s.type]++;
  return { segments, stats };
}

/**
 * 改写幅度评估（观测用，不做退款/阻断）：
 *  - 对称行 churn，新增与删除各算半权，0~1；
 *  - <0.06 negligible（几乎没动）/ <0.25 light（局部微调）/ <0.6 partial（局部重写）/ >=0.6 major（大幅重写）；
 *  - 旧稿为空→整体新增按 major；双空→negligible。
 */
export function assessRewrite(oldText: string, newText: string): { changedRatio: number; level: RewriteLevel } {
  const oldLines = splitScriptLines(oldText);
  const newLines = splitScriptLines(newText);
  if (!oldLines.length && !newLines.length) return { changedRatio: 0, level: 'negligible' };
  if (!oldLines.length) return { changedRatio: 1, level: 'major' };
  // c203：观测函数只允许返回分档，绝不允许抛错阻断 /fix 主流程（钱已经扣、改写已成功）。
  // 超行数上限或任何异常一律降级 major（保守告知用户“改动很大，建议看全文”）。
  let stats: DiffStats;
  try {
    ({ stats } = diffScripts(oldText, newText));
  } catch {
    return { changedRatio: 1, level: 'major' };
  }
  const ratio = Math.min(1, ((stats.added + stats.removed) / 2) / Math.max(oldLines.length, newLines.length));
  const changedRatio = Math.round(ratio * 100) / 100;
  const level: RewriteLevel = changedRatio < 0.06 ? 'negligible'
    : changedRatio < 0.25 ? 'light'
    : changedRatio < 0.6 ? 'partial'
    : 'major';
  return { changedRatio, level };
}

/* ------------------------- c204 变更摘要卡（零 token、确定性） ------------------------- */

export type ChangeCategory = ScriptLineKind; // scene | dialogue | action | other
export interface ChangeCategoryCount { scene: number; dialogue: number; action: number; other: number }
export interface ChangeHighlight {
  category: ChangeCategory;
  /** dialogue 时为角色名，前端可直接渲染"谁的台词改了" */
  speaker?: string;
  /** 展示文本：台词为纯内容，其他为整行；超长已截断 */
  text: string;
}
export interface ChangeSummary {
  added: ChangeCategoryCount;
  removed: ChangeCategoryCount;
  highlights: { added: ChangeHighlight[]; removed: ChangeHighlight[] };
}

/** 每侧亮点条数上限：摘要卡只做概览，完整逐行内容看 diff body */
export const MAX_CHANGE_HIGHLIGHTS = 3;
/** 单条亮点文本最长字符数（含省略号），防止响应 payload 随异常长行失控 */
const MAX_HIGHLIGHT_CHARS = 60;
/** 亮点优先级：台词最值得看（谁的哪句话变了）→ 场标（场景调整）→ 动作 → 其他 */
const HIGHLIGHT_RANK: Record<ChangeCategory, number> = { dialogue: 0, scene: 1, action: 2, other: 3 };

function zeroBuckets(): ChangeCategoryCount {
  return { scene: 0, dialogue: 0, action: 0, other: 0 };
}

function clipHighlight(text: string): string {
  const t = String(text || '').trim();
  // c205：按码点截断。旧实现 t.slice(0,60) 按 UTF-16 单元切，边界落在 emoji/生僻字的
  // 代理对中间会留下 lone surrogate，JSON 输出与前端渲染均成坏字符。
  const chars = Array.from(t);
  return chars.length > MAX_HIGHLIGHT_CHARS ? `${chars.slice(0, MAX_HIGHLIGHT_CHARS).join('')}…` : t;
}

/**
 * 把 diff 段落归纳成"变更摘要"：
 *  - 新增/删除行分别按 场标/台词/动作/其他 计数（分类口径复用 listen-script.parseScriptLine）；
 *  - 亮点按 台词→场标→动作→其他 优先、同类保原文顺序，每侧最多 maxHighlights 条；
 *  - 纯展示用，绝不抛错：null/非数组入参给零摘要；未知类型段整体忽略。
 *  - c205 守恒精化：已知红绿类型即使文本缺失/空白也计入 other（parseScriptLine 空行即 other），
 *    桶和严格等于入参红绿段总数（引擎自产段永不为空，此条约束外部脏输入的未来复用方）；
 *    但空段不进亮点池，避免渲染空亮点。
 */
export function summarizeChanges(
  segments: unknown,
  opts: { maxHighlights?: number } = {},
): ChangeSummary {
  const added = zeroBuckets();
  const removed = zeroBuckets();
  const pool: Record<'added' | 'removed', ChangeHighlight[]> = { added: [], removed: [] };
  const list = Array.isArray(segments) ? (segments as Array<Partial<DiffSegment>>) : [];
  for (const seg of list) {
    if (seg?.type !== 'added' && seg?.type !== 'removed') continue; // equal/未知类型不进摘要
    const raw = String(seg.text ?? '').trim();
    const info = parseScriptLine(raw); // 空行→other：计数不许蒸发，桶和必须等于红绿段总数
    // other（镜头/配乐/场记台账等技术/元数据行，含空段）也计入桶，只是亮点优先级最低；
    // 前端摘要卡通常不展示它（完整逐行内容看 diff body）。
    const buckets = seg.type === 'added' ? added : removed;
    buckets[info.kind] += 1;
    if (!raw) continue;                                            // 空段只计数，不产生亮点
    pool[seg.type].push({
      category: info.kind,
      ...(info.kind === 'dialogue' ? { speaker: info.speaker, text: clipHighlight(info.content || raw) } : { text: clipHighlight(raw) }),
    });
  }
  const cap = Number.isInteger(opts.maxHighlights) && (opts.maxHighlights as number) >= 0
    ? (opts.maxHighlights as number)
    : MAX_CHANGE_HIGHLIGHTS;
  const pick = (items: ChangeHighlight[]): ChangeHighlight[] =>
    [...items]
      .sort((a, b) => HIGHLIGHT_RANK[a.category] - HIGHLIGHT_RANK[b.category])
      .slice(0, cap);
  // 排序稳定性：Array.prototype.sort 在 Node 上稳定，同优先级保留原文（段落）顺序
  return { added, removed, highlights: { added: pick(pool.added), removed: pick(pool.removed) } };
}
