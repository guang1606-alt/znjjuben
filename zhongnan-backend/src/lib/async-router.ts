/**
 * asyncRouter：自动捕获 async 路由处理器抛出/拒绝的异常并转交统一错误中间件。
 * 背景：Express 4 不会自动捕获 async handler 的 rejected promise，一旦内部抛错且未 try/catch，
 * 请求会永久挂起（前端一直转圈）直到超时。用本工厂替代 express.Router() 即可全局兜底。
 * 仅包装 HTTP 动词，不包装 use，避免误伤子路由/中间件挂载。
 * 返回类型标注为 Router，保证调用处 req/res 仍获得 Express 类型推断。
 */
import { Router, RequestHandler } from 'express';

const VERBS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const wrap = (h: RequestHandler): RequestHandler => ((req, res, next) =>
  Promise.resolve(h(req, res, next)).catch(next)) as RequestHandler;

export function asyncRouter(): Router {
  const r: any = Router();
  for (const verb of VERBS) {
    const orig = r[verb];
    r[verb] = (path: any, ...handlers: RequestHandler[]) =>
      orig.call(r, path, ...handlers.map((h) => (typeof h === 'function' ? wrap(h) : h)));
  }
  return r as Router;
}
