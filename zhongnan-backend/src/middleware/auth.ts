import { Request, Response, NextFunction } from 'express';
import { verifyAccess, passwordVersion } from '../lib/auth';

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
 * 会话守卫（历史名 bannedGuard）：凡带令牌的 /api 请求都查一次用户的封禁状态与密码版本。
 *
 * 1) 封禁：JWT 在封禁后最长仍有效至到期，故每请求查一次 banned。
 * 2) 密码版本（v2.459）：比对令牌 pv 与库中当前 passwordHash 的 pv，不一致即 401 SESSION_REVOKED。
 *    v2.458 只在 /refresh 校验 pv，access token 仍能撑到 15 分钟 TTL——改密后其他设备/失窃令牌
 *    在这段时间里仍可调用全部业务接口。守卫本来就要查用户，顺带比对 pv 不增加查库成本。
 *    无 pv 的历史令牌按兼容放行（与 v2.458 同口径）。
 * 3) 30 秒进程内缓存，避免每请求打库：封禁/解封与改密失效最长 30 秒生效（已知边界，远小于 15 分钟）。
 * 4) 只有会话建立/销毁端点豁免：登录、注册无会话；续期与登出必须能在 access 失效后继续可用，
 *    其凭据校验各自完成（续期自己比对 pv 并轮换）。/auth/me、/auth/profile、改密等仍受本守卫约束。
 * 无令牌或令牌无效直接放行——由各路由 authRequired 自行 401。
 *
 * v2.55 P1 内存收紧：原 cache 只 set 不 delete，长期运行可累积无上限条目（攻击者用海量不同 sub
 * 令牌可耗尽内存）。改为 LRU 式淘汰——达到 MAX 时清最旧条目再写入；MAX 取 10000 足够覆盖活跃用户。
 */
export const BANNED_CACHE_MAX = 10000;
/** 豁免本守卫的会话建立/销毁端点（Express 挂在 /api 上时 req.path 已去掉 /api 前缀） */
const SESSION_EXEMPT_PATHS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);
/**
 * 进程级会话缓存：封禁状态 + 当前密码版本。模块级而非守卫闭包内，是为了让改密等「主动变更凭据」
 * 的路径能立刻失效自己那一格——否则改密请求先经过守卫缓存了旧 pv，紧接着客户端用新令牌请求 /me
 * 会撞上旧缓存被判 SESSION_REVOKED，前端清会话跳登录，正是 v2.457 修掉的回归。
 */
const sessionCache = new Map<string, { t: number; banned: boolean; pv: string }>();
/** 主动失效某用户的会话缓存（改密成功后调用；多实例部署下其他实例最长 30 秒后才生效） */
export function invalidateSessionCache(sub: string) {
  sessionCache.delete(sub);
}
export function bannedGuard(prisma: any) {
  const TTL = 30 * 1000;
  // Map 维护插入顺序，最旧条目在迭代器首位；超限时整体清空——简单且足以避免无界增长。
  function boundedSet(sub: string, v: { t: number; banned: boolean; pv: string }) {
    if (sessionCache.size >= BANNED_CACHE_MAX) sessionCache.clear();
    sessionCache.set(sub, v);
  }
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (SESSION_EXEMPT_PATHS.has(req.path)) return next();
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next();
      let sub = '';
      let tokenPv = '';
      try {
        const payload = verifyAccess(token);
        sub = payload.sub;
        tokenPv = typeof payload.pv === 'string' ? payload.pv : '';
      } catch { return next(); }
      const now = Date.now();
      const hit = sessionCache.get(sub);
      let entry: { t: number; banned: boolean; pv: string };
      if (hit && now - hit.t < TTL) {
        entry = hit;
      } else {
        const u = await prisma.user.findUnique({ where: { id: sub }, select: { banned: true, passwordHash: true } });
        entry = { t: now, banned: !!u?.banned, pv: passwordVersion(u?.passwordHash) };
        boundedSet(sub, entry);
      }
      if (entry.banned) return res.status(403).json({ error: '账号已封禁' });
      // pv 为空的令牌是升级前签发/无密码账号：兼容放行，15 分钟内自然过期后全部换成带 pv 的令牌
      if (tokenPv && tokenPv !== entry.pv) return res.status(401).json({ error: 'SESSION_REVOKED' });
      return next();
    } catch {
      // v2.302 修复：数据库异常时不得静默放行（封禁穿透）——503 拒绝并提示系统繁忙
      return res.status(503).json({ error: '系统繁忙，请稍后重试' });
    }
  };
}
