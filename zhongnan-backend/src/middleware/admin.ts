/**
 * 统一管理员鉴权。身份标记与后台操作权限分离：仅主账号手机号拥有后台操作权限。
 * 必须挂在 authRequired 之后（依赖 req.userId）。
 *
 * 主账号初始密码由 SUPER_ADMIN_INIT_PASSWORD 显式配置，启动引导仅保存哈希。
 * 主账号唯一且权限最高：开设账号等账号生命周期操作走 requireSuperAdmin（仅手机号命中，
 * 副管理员保留身份标记，但所有后台操作需额外通过 requireSuperAdmin。
 */
import { AuthRequest } from './auth';

export const SUPER_ADMIN_PHONE = '18891995171';

export function isAdminUser(u: { phone?: string | null; isAdmin?: boolean | null } | null | undefined): boolean {
  return !!u && (u.phone === SUPER_ADMIN_PHONE || u.isAdmin === true);
}

export function isSuperAdminUser(u: { phone?: string | null } | null | undefined): boolean {
  return !!u && u.phone === SUPER_ADMIN_PHONE;
}

/**
 * 仅超管主账号可过（必须排在 createRequireAdmin 之后复用其已查的 req.adminUser，避免二次查库；
 * 若 adminUser 缺席说明中间件挂载顺序错误，一律拒绝——宁可误拒不可漏放）。
 */
export function requireSuperAdmin(req: AuthRequest, res: any, next: any) {
  const u = (req as any).adminUser;
  if (!isSuperAdminUser(u)) return res.status(403).json({ error: '仅超级管理员主账号可执行此操作', needSuperAdmin: true });
  next();
}

/** 工厂：注入 prisma（便于内存桩测试），返回 express 中间件 */
export function createRequireAdmin(prisma: any, denyMsg = '仅超级管理员主账号可访问后台') {
  return async function requireAdmin(req: AuthRequest, res: any, next: any) {
    try {
      if (!req.userId) return res.status(401).json({ error: '请先登录' });
      const u = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!isAdminUser(u)) return res.status(403).json({ error: denyMsg, needAdmin: true });
      (req as any).adminUser = u;
      next();
    } catch {
      res.status(403).json({ error: '管理员鉴权失败' });
    }
  };
}
