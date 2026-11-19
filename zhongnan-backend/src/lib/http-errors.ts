import type { Response } from 'express';

/**
 * 500 统一出口（v2.216 错误脱敏铁律）：
 * 客户端一律 { error: 'INTERNAL_ERROR' }，内部异常详情（Prisma/文件路径/供应商错误等）只进服务端日志。
 * 用法：catch (e) { failInternal(res, e, '模块.端点'); }
 */
export function failInternal(res: Response, e: unknown, scope: string): void {
  console.error(`[${scope}]`, e);
  if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
}

/**
 * 只留痕、不响应（v2.570）：
 * 资金/交易等路径的 5xx 兜底文案是产品既定话术（前端与用户已依赖），不宜改成 INTERNAL_ERROR；
 * 但失败必须可观测，统一用本函数把内部异常写进服务端日志。
 * 用法：catch (e) { logInternal(e, 'market.buy'); return res.status(500).json({ error: '...' }); }
 */
export function logInternal(e: unknown, scope: string): void {
  console.error(`[${scope}]`, e);
}
