/**
 * c198 超管主账号启动引导：保证「18891995171 = 唯一最高权限账号」在任意环境（生产/测试）开箱即用。
 *
 * 语义（全部幂等，可安全重复执行）：
 * ① 无此手机号 → 创建主账号：初始密码（必须显式配置 SUPER_ADMIN_INIT_PASSWORD）
 *    经 argon2id 哈希落库，会员档直接 PRO（定价体系最高档，普通账号任何档位都在其权限之下），
 *    积分账户同步建立；
 * ② 已存在但 passwordHash 为空（历史手机号注册/导入账号）→ 补设初始密码；
 * ③ 已存在且密码正常 → 绝不触碰（不覆盖用户已改的密码）；
 * ④ 被封禁 → 自动解封（主账号不应处于不可登录态，自愈）。
 *
 * 安全边界：密码只进哈希、不落明文、不打日志、不下发接口；「仅此一个超管」由
 * middleware/admin.ts 以手机号硬判定保证——开设账号接口（requireSuperAdmin 把关）不接受
 * role/isAdmin 等提权字段，任何子账号都不可能升至主账号同级。
 */
import { prisma as defaultPrisma } from './prisma';
import { hashPassword, genInviteCode } from './auth';
import { SUPER_ADMIN_PHONE } from '../middleware/admin';
import { MemberLevel } from '../config/pricing';

/** 主账号初始密码的环境变量名（必须由部署环境显式提供） */
export const SUPER_ADMIN_INITIAL_PASSWORD_ENV = 'SUPER_ADMIN_INIT_PASSWORD';

const superAdminInitialPassword = () => {
  const password = process.env[SUPER_ADMIN_INITIAL_PASSWORD_ENV];
  if (!password || password.trim().length < 12) {
    throw new Error('SUPER_ADMIN_INIT_PASSWORD 必须显式配置且至少12位，才能创建超管或补设密码');
  }
  return password;
};

type PrismaLike = typeof defaultPrisma;

export async function ensureSuperAdmin(prisma: PrismaLike | any = defaultPrisma) {
  const existing = await prisma.user.findUnique({ where: { phone: SUPER_ADMIN_PHONE } });
  if (!existing) {
    const u = await prisma.user.create({
      data: {
        phone: SUPER_ADMIN_PHONE,
        passwordHash: await hashPassword(superAdminInitialPassword()),
        level: MemberLevel.PRO, // 应用层最高会员档（schema 另有 ENTERPRISE 未在定价体系启用）
        nickname: '超级管理员',
        inviteCode: genInviteCode(),
        pointsAccount: { create: {} },
      },
    });
    console.log(`[super-admin] 主账号已引导创建：${SUPER_ADMIN_PHONE}（${MemberLevel.PRO}，唯一最高权限）`);
    return u;
  }
  const patch: Record<string, unknown> = {};
  if (!existing.passwordHash) patch.passwordHash = await hashPassword(superAdminInitialPassword());
  if (existing.banned) patch.banned = false;
  if (Object.keys(patch).length) {
    const u = await prisma.user.update({ where: { id: existing.id }, data: patch });
    console.log('[super-admin] 主账号已自愈（补设密码/解除封禁），已有正常密码不受影响');
    return u;
  }
  return existing;
}
