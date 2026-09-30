/**
 * v2.215 分页统一助手（API 分页一致性家族铁律）
 *
 * 统一契约：
 *  - 请求：page/pageSize（页码式，主风格）或 limit/offset（偏移式，别名）；两者混给时 page 优先
 *  - 响应：{ items, total, page, pageSize, limit, offset } —— items 唯一列表键、total 真总数、
 *          page/pageSize/limit/offset 四元全回显（limit 恒等于 pageSize）
 *
 * 归一化规则：
 *  - pageSize = clamp(pageSize ?? limit ?? defaultLimit, [1, maxLimit])；无效值（NaN/0/负）走 defaultLimit
 *  - page 显式给出（≥1）→ 页码式优先，offset = (page-1)*pageSize；offset 同时给出时被忽略
 *  - page 未给出 → 偏移式：offset = max(offset, 0)，page = floor(offset/pageSize)+1
 */
export interface PageParams {
  page: number;
  pageSize: number;
  /** 回显别名，恒等于 pageSize */
  limit: number;
  offset: number;
}

export interface PageParamsOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

function toInt(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : NaN;
}

export function parsePageParams(q: Record<string, unknown>, opts: PageParamsOptions = {}): PageParams {
  const defaultLimit = opts.defaultLimit ?? 20;
  const maxLimit = opts.maxLimit ?? 100;
  const rawSize = toInt(q.pageSize ?? q.limit);
  const pageSize = Math.min(maxLimit, Math.max(1, rawSize >= 1 ? rawSize : defaultLimit));
  const rawPage = toInt(q.page);
  const rawOffset = toInt(q.offset);
  if (rawPage >= 1) {
    // 页码式优先：offset 由 page 推导，显式 offset 忽略
    const page = rawPage;
    return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
  }
  const offset = rawOffset >= 0 ? rawOffset : 0;
  return { page: Math.floor(offset / pageSize) + 1, pageSize, limit: pageSize, offset };
}
