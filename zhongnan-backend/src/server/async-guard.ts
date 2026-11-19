/**
 * v2.567 异步路由兜底：Express 4 只捕获同步抛错，async 处理器里的 reject 不会被转发到
 * 终局错误中间件，请求会一直挂着（前端只看到转圈，直到浏览器超时）。
 * 这里给 Router 的注册方法包一层，把 Promise 拒绝交给 next(err)，由 app.ts 统一回 500 JSON。
 *
 * 必须在所有路由模块被导入之前执行（app.ts 的首个 import），因为路由是模块级单例、
 * 在各自的模块求值时就完成了 hander 注册。
 */
import { Router } from 'express';

type AnyHandler = (...args: any[]) => any;

let installed = false;

/** 只包裹普通处理器（≤3 参）；4 参是错误中间件，原样放行，避免破坏 Express 的签名判定 */
function guard(fn: AnyHandler): AnyHandler {
  if (typeof fn !== 'function' || fn.length >= 4) return fn;
  return function guarded(this: any, req: any, res: any, next: any) {
    try {
      const ret = fn.call(this, req, res, next);
      if (ret && typeof ret.then === 'function') ret.then(undefined, next);
      return ret;
    } catch (e) {
      next(e);
      return undefined;
    }
  };
}

export function installAsyncGuard(): void {
  if (installed) return;
  installed = true;
  // 注意：Express 4 的 Router 实例是 Object.create(导出函数本身)，方法挂在 Router 上而非
  // Router.prototype，打 prototype 是空转。
  const proto = Router as unknown as Record<string, AnyHandler>;
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'all'] as const;
  for (const m of methods) {
    const orig = proto[m];
    if (typeof orig !== 'function') continue;
    proto[m] = function (this: any, path: any, ...handlers: AnyHandler[]) {
      return orig.call(this, path, ...handlers.flat().map(guard));
    };
  }
}

installAsyncGuard();
