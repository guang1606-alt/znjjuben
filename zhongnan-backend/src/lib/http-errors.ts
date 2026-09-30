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
