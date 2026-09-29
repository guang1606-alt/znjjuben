/**
 * 服务端榜单仓（BoardStore）——"昨日爆款自动倾斜"的数据中枢
 * ------------------------------------------------------------------
 * 设计原则（不臆造、不欺骗）：
 *  - 仓本身不抓取、不编造任何"真实在榜剧"。真实数据只能由①采集器(collectBoards+fetcher)
 *    或②超级管理员后台投喂进入；启动默认空仓，空仓时不做爆款倾斜，只走时令+画像。
 *  - 平台为"示例/sample"的条目不参与自动倾斜，避免把演示数据当成真实市场。
 *  - 全局保鲜期 7 天：超过 7 天未更新即视为失效，自动停止倾斜，直到新数据进入。
 *  - 去重合并：同 平台::剧名 合并标签、取最高热度与最新日期；总量封顶，防止内存膨胀。
 * 纯内存单例（测试可直接 replace/clear 对拍）；后续接 Prisma/Redis 持久化时仅改本文件。
 */
import { BoardItem, BoardRegion } from '../engine/context-personalization';

export const BOARD_FRESH_DAYS = 7;
const BOARD_CAP = 300;
const ITEM_MAX_AGE_DAYS = 30; // 单条榜单超过30天即使仓未过期也不参与（防止旧剧长期霸榜）

export interface RawBoardRow {
  title?: string; platform?: string; tags?: string[] | string;
  heat?: number | string; date?: Date | string; region?: BoardRegion | string; sample?: boolean;
}

function toTags(v: RawBoardRow['tags']): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,，/／、|#\s]+/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function normalizeRow(raw: RawBoardRow, fallbackDate: Date): BoardItem | null {
  const title = String(raw.title ?? '').trim();
  const platform = String(raw.platform ?? '').trim();
  const tags = toTags(raw.tags);
  if ((!title && !tags.length) || raw.sample === true || platform === '示例') return null;
  let date = fallbackDate;
  if (raw.date) { const d = new Date(raw.date); if (!Number.isNaN(d.getTime())) date = d; }
  const heat = Math.max(0, Math.min(1e6, Number(raw.heat) || 50));
  const region: BoardRegion = raw.region === 'overseas' ? 'overseas' : 'domestic';
  return { title: title || tags[0], platform: platform || '未知平台', tags, heat, date, region };
}

class BoardStore {
  private items: BoardItem[] = [];
  private updatedAt: Date | null = null;
  private source = '';

  /** 用一批榜单条目覆盖/合并仓；返回入库条数 */
  replace(rows: RawBoardRow[] = [], source = 'admin', now: Date = new Date()): number {
    const incoming = rows.map((r) => normalizeRow(r, now)).filter((x): x is BoardItem => !!x);
    const map = new Map<string, BoardItem>();
    // 与存量合并（默认增量合并；调用方如需全量覆盖可先 clear）
    [...this.items, ...incoming].forEach((it) => {
      const key = `${it.platform}::${it.title}`;
      const prev = map.get(key);
      if (!prev) { map.set(key, it); return; }
      const tagSet = new Set([...prev.tags, ...it.tags]);
      map.set(key, {
        ...prev,
        tags: [...tagSet].slice(0, 12),
        heat: Math.max(prev.heat, it.heat),
        date: it.date > prev.date ? it.date : prev.date,
      });
    });
    this.items = [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, BOARD_CAP);
    this.updatedAt = now;
    this.source = String(source || 'admin').slice(0, 60);
    return incoming.length;
  }

  clear() { this.items = []; this.updatedAt = null; this.source = ''; }

  /** 返回保鲜期内、且单条不过期的榜单；仓过期/空仓返回 []（调用方据此不做爆款倾斜） */
  getFresh(now: Date = new Date(), maxAgeDays: number = BOARD_FRESH_DAYS): BoardItem[] {
    if (!this.updatedAt) return [];
    const ageDays = (now.getTime() - this.updatedAt.getTime()) / 86400000;
    if (ageDays > maxAgeDays) return [];
    const cutoff = now.getTime() - ITEM_MAX_AGE_DAYS * 86400000;
    return this.items.filter((it) => it.date.getTime() >= cutoff);
  }

  status(now: Date = new Date()) {
    const fresh = this.getFresh(now);
    return {
      active: fresh.length > 0,
      fresh: fresh.length > 0,
      count: fresh.length,
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : null,
      source: this.source || null,
      freshDays: BOARD_FRESH_DAYS,
      platforms: [...new Set(fresh.map((i) => i.platform))].slice(0, 12),
      note: fresh.length ? '' : '当前无保鲜期内的真实榜单，选片按市场频次+时令节点+你的画像进行，未做爆款倾斜',
    };
  }
}

export const boardStore = new BoardStore();
