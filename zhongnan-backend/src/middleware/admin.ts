/**
 * 统一管理员鉴权（v1.46 抽取，口径唯一；2026-09-29 收紧为「超管一人独大」）。
 *
 * 身份模型（两套独立机制，会员等级 level 与管理权限无关——PRO 只是最高会员档）：
 *  · 超级管理员（主账号）：手机号 18891995171 硬判定，全库唯一，拥有全部后台权力；
 *  · 副管理员：isAdmin === true（仅主账号能授予/撤销），是「身份标记」，默认不享有任何后台权力。
 *
 * 授权口径（产品主人 2026-09-29 拍板：超管一人独大）：
 *  所有 /api/admin/* 路由统一挂 [authRequired, requireAdmin, requireSuperAdmin]——
 *  副管理员（含历史已授予账号）访问一律 403 needSuperAdmin；账号本身保留、可正常使用产品。
 *  未来若要恢复分级，把指定路由末尾的 requireSuperAdmin 摘掉即可（机关保留、默认全锁）。
 *
 * 历史修正：
 *  c198 名实不符：旧码 SUPER_ADMIN_PHONE 误存初始密码字符串，已修正为手机号；
 *  2026-09-29 删除 role==='ADMIN' 放行条件——schema 从无 role 字段（仅内存桩有），
 *  该死条件造成测试/生产行为分叉，按「白名单硬标识、不信任易污染字段」原则移除。
 */
import { AuthRequest } from './auth';

export const SUPER_ADMIN_PHONE = '18891995171';

/** 是否具备「管理员身份标记」（注意：身份标记 ≠ 后台权力，后台权力见 isSuperAdmin） */
export function isAdminUser(u: { phone?: string | null; isAdmin?: boolean | null } | null | undefined): boolean {
  return !!u && (u.phone === SUPER_ADMIN_PHONE || u.isAdmin === true);
}

/** 是否唯一最高权限账号（手机号硬判定，杜绝任何字段提权） */
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
