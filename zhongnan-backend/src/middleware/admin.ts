/**
 * 统一管理员鉴权（v1.46 抽取，消除 admin-model / feedback / knowledge 三处重复实现，口径唯一）。
 * 命中三选一即为管理员：① 超管主账号手机号 18891995171；② role === 'ADMIN'（子账号/角色体系）；③ isAdmin === true。
 * 必须挂在 authRequired 之后（依赖 req.userId）。
 *
 * c198 名实不符修正：旧码 SUPER_ADMIN_PHONE 误存了初始密码字符串 'yxgnono0726'（连手机号正则都
 * 过不了，永远无法命中）。主账号 = 手机号 18891995171 / 初始密码 yxgnono0726（密码由
 * lib/super-admin.ts 启动引导落库，绝不入库明文、绝不下发）。
 * 主账号唯一且权限最高：开设账号等账号生命周期操作走 requireSuperAdmin（仅手机号命中，
 * role==='ADMIN' 的后台子账号也无权开设新账号——「其他账号的权限都在主账号之下」）。
 */
import { AuthRequest } from './auth';

export const SUPER_ADMIN_PHONE = '18891995171';

export function isAdminUser(u: { phone?: string | null; role?: string | null; isAdmin?: boolean | null } | null | undefined): boolean {
  return !!u && (u.phone === SUPER_ADMIN_PHONE || (u as any).role === 'ADMIN' || (u as any).isAdmin === true);
}

/**
 * 仅超管主账号可过（必须排在 createRequireAdmin 之后复用其已查的 req.adminUser，避免二次查库；
 * 若 adminUser 缺席说明中间件挂载顺序错误，一律拒绝——宁可误拒不可漏放）。
 */
export function requireSuperAdmin(req: AuthRequest, res: any, next: any) {
  const u = (req as any).adminUser;
  if (!u || u.phone !== SUPER_ADMIN_PHONE) return res.status(403).json({ error: '仅超管主账号可执行此操作', needSuperAdmin: true });
  next();
}

/** 工厂：注入 prisma（便于内存桩测试），返回 express 中间件 */
export function createRequireAdmin(prisma: any, denyMsg = '仅管理员可访问后台') {
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
