/**
 * 全网榜单采集器（把“平台源 → 归一化榜单 BoardItem”这一层补全）
 * ----------------------------------------------------------------
 * 上承 config/context-personalization.PLATFORM_BOARDS（源清单），
 * 下接 trendingSignals / opportunityRadar / creation-context（消费归一化后的 BoardItem）。
 *
 * 诚信与稳健原则：
 *  1) 本模块【不内置任何具体平台的爬虫选择器/假数据】——各平台多需登录或有反爬，
 *     硬写抓取是脆弱且造假；真实抓取由后台注入的 BoardFetcher 完成（官方开放接口/RSS/
 *     运营人工录入/合规采集服务均可），本模块只负责调度、超时容错、归一、去重、排序；
 *  2) 单源失败/超时绝不拖垮整体（allSettled 思路），失败源如实记录，供后台告警补采；
 *  3) 归一化不编造：缺 heat 用榜单名次反推，缺日期用采集时刻（不伪造成历史日期）。
 * 纯逻辑可离线对拍。
 */
import { BoardItem, BoardSource, PLATFORM_BOARDS } from './context-personalization';

export interface RawEntry {
  title: string;
  /** 原始标签：可能是字符串（逗号/斜杠/空格分隔）或数组 */
  tags?: string | string[];
  heat?: number;
  rank?: number;           // 榜单名次（1 起），缺 heat 时据此反推热度
  date?: Date | string;
  url?: string;
}
export type BoardFetcher = (source: BoardSource) => Promise<RawEntry[]>;

export interface CollectOptions { timeoutMs?: number; now?: Date; sources?: BoardSource[] }
export interface CollectResult {
  items: BoardItem[];
  failures: { id: string; name: string; reason: string }[];
  collectedAt: Date;
  sourceCount: number;
  okCount: number;
}

/** 标签归一：字符串按常见分隔符拆，数组逐项 trim，去空去重，保序 */
export function normalizeTags(raw: RawEntry['tags']): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[,，/／、|#\s]+/);
  const seen = new Set<string>(); const out: string[] = [];
  for (const t of arr) {
    const v = (t ?? '').trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

/** 单条原始条目归一为 BoardItem（不编造：缺热度按名次、缺日期用采集时刻） */
export function normalizeEntry(source: BoardSource, raw: RawEntry, now: Date = new Date()): BoardItem | null {
  const title = (raw.title ?? '').trim();
  if (!title) return null;
  let heat = Number(raw.heat);
  if (!Number.isFinite(heat) || heat <= 0) {
    heat = Number.isFinite(raw.rank as number) && (raw.rank as number) > 0
      ? Math.max(1, 101 - Math.floor(raw.rank as number))
      : 1; // 既无热度也无名次：给最低 1，不虚构高热度
  }
  let date = now;
  if (raw.date) {
    const d = raw.date instanceof Date ? raw.date : new Date(raw.date);
    if (!Number.isNaN(d.getTime())) date = d; // 无效日期不采用，落到采集时刻
  }
  return { title, platform: source.name, tags: normalizeTags(raw.tags), heat, date, region: source.region };
}

/** 合并多源榜单：同 平台+标题 视为重复（保留高 heat、合并 tags），按时间新→旧、热度高→低排序 */
export function mergeBoards(items: BoardItem[] = []): BoardItem[] {
  const map = new Map<string, BoardItem>();
  for (const it of items) {
    const key = `${it.platform}::${it.title}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, it); continue; }
    const tagSet = new Set([...prev.tags, ...it.tags]);
    map.set(key, {
      ...prev,
      heat: Math.max(prev.heat, it.heat),
      tags: [...tagSet],
      date: it.date > prev.date ? it.date : prev.date,
    });
  }
  return [...map.values()].sort((a, b) => {
    if (b.date.getTime() !== a.date.getTime()) return b.date.getTime() - a.date.getTime();
    return b.heat - a.heat;
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}采集超时(${ms}ms)`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

/** 调度全部源：单源失败/超时隔离，最终归一+去重；全部失败也安全返回空清单 */
export async function collectBoards(fetcher: BoardFetcher, opts: CollectOptions = {}): Promise<CollectResult> {
  const sources = opts.sources ?? PLATFORM_BOARDS;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const now = opts.now ?? new Date();
  const failures: CollectResult['failures'] = [];
  const collected: BoardItem[] = [];
  const settled = await Promise.allSettled(
    sources.map((s) => withTimeout(fetcher(s), timeoutMs, s.name).then((rows) => ({ s, rows }))),
  );
  let okCount = 0;
  settled.forEach((res, i) => {
    const src = sources[i];
    if (res.status === 'rejected') {
      failures.push({ id: src.id, name: src.name, reason: (res.reason as Error)?.message ?? '采集失败' });
      return;
    }
    okCount += 1;
    for (const raw of res.value.rows ?? []) {
      const item = normalizeEntry(src, raw, now);
      if (item) collected.push(item);
    }
  });
  return { items: mergeBoards(collected), failures, collectedAt: now, sourceCount: sources.length, okCount };
}

/** 后台/运营手动录入通道（无需爬虫也能补榜单，走同一归一管线） */
export function manualEntries(source: BoardSource, rows: RawEntry[], now: Date = new Date()): BoardItem[] {
  return mergeBoards(rows.map((r) => normalizeEntry(source, r, now)).filter((x): x is BoardItem => !!x));
}
