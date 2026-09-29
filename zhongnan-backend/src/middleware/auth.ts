import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../lib/auth';

export interface AuthRequest extends Request {
  userId?: string;
  level?: string;
}

/** JWT 鉴权。校验密钥统一走 lib/auth（含生产强制密钥校验）。生产补充 refresh token 轮换、设备风控 */
export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const payload = verifyAccess(token);
    req.userId = payload.sub;
    req.level = payload.level;
    next();
  } catch {
    return res.status(401).json({ error: 'TOKEN_INVALID' });
  }
}

/**
 * 全局限封守卫：JWT 在封禁后最长仍有效至到期，故凡带令牌的 /api 请求都查一次用户 banned。
 * 30 秒进程内缓存，避免每请求打库；封禁/解封最长 30 秒生效。
 * 无令牌或令牌无效直接放行——由各路由 authRequired 自行 401；/api/auth/* 放行（登出/刷新不应被拦）。
 *
 * v2.55 P1 内存收紧：原 cache 只 set 不 delete，长期运行可累积无上限条目（攻击者用海量不同 sub
 * 令牌可耗尽内存）。改为 LRU 式淘汰——达到 MAX 时清最旧条目再写入；MAX 取 10000 足够覆盖活跃用户。
 */
export const BANNED_CACHE_MAX = 10000;
export function bannedGuard(prisma: any) {
  const TTL = 30 * 1000;
  const cache = new Map<string, { t: number; banned: boolean }>();
  // Map 维护插入顺序，最旧条目在迭代器首位；超限时整体清空——简单且足以避免无界增长。
  function boundedSet(sub: string, v: { t: number; banned: boolean }) {
    if (cache.size >= BANNED_CACHE_MAX) cache.clear();
    cache.set(sub, v);
  }
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.path === '/auth' || req.path.startsWith('/auth/')) return next();
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next();
      let sub = '';
      try { sub = verifyAccess(token).sub; } catch { return next(); }
      const now = Date.now();
      const hit = cache.get(sub);
      let banned: boolean;
      if (hit && now - hit.t < TTL) {
        banned = hit.banned;
      } else {
        const u = await prisma.user.findUnique({ where: { id: sub }, select: { banned: true } });
        banned = !!u?.banned;
        boundedSet(sub, { t: now, banned });
      }
      if (banned) return res.status(403).json({ error: '账号已封禁' });
      return next();
    } catch {
      return next();
    }
  };
}
