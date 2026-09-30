import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { prisma as defaultPrisma } from '../lib/prisma';
import { hashPassword, verifyPassword, signAccess, signRefresh, genInviteCode } from '../lib/auth';
import { grantBonus } from '../lib/billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import { INVITE, MEMBERSHIP, MemberLevel } from '../config/pricing';
import { authRequired } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { isAdminUser, isSuperAdminUser, SUPER_ADMIN_PHONE } from '../middleware/admin';
import { AGE_BAND_IDS, GENDERS, PROFILE_REGIONS } from '../lib/profile-mapping';

/** 工厂化：生产用默认 prisma 单例，测试可注入内存桩（HTTP 层端到端，不依赖真实数据库） */
type PrismaLike = typeof defaultPrisma;
export function createAuthRouter(prisma: PrismaLike | any) {
  const authRouter = asyncRouter();
  const phoneSchema = z.object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
    password: z.string().min(8, '密码至少8位').max(64),
    inviteCode: z.string().optional(),
  });
  /** 手机号注册（密码登录版；微信/抖音走 oauth 回调，结构相同） */
  authRouter.post('/register', async (req, res) => {
    const parsed = phoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { phone, password, inviteCode } = parsed.data;
    // 主账号仅由受控引导创建；未初始化时也不可通过公开注册取得特权。
    if (phone === SUPER_ADMIN_PHONE) return res.status(409).json({ error: '该手机号已注册' });
    const existed = await prisma.user.findUnique({ where: { phone } });
    if (existed) return res.status(409).json({ error: '该手机号已注册' });
    const inviter = inviteCode ? await prisma.user.findUnique({ where: { inviteCode } }) : null;
    const user = await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.create({
        data: {
          phone, passwordHash: await hashPassword(password),
          inviteCode: genInviteCode(), invitedById: inviter?.id,
          pointsAccount: { create: {} },
        },
      });
      if (inviter) await tx.invitation.create({ data: { inviterId: inviter.id, inviteeId: u.id } });
      return u;
    });
    // 注册奖励：双方各得积分（受赠送上限约束，幂等）
    if (inviter) {
      await withBillingTransaction(prisma, user.id, (t) =>
        grantBonus(t, user.id, INVITE.BOTH_REWARD_POINTS, 'INVITE_REGISTER', `invreg:${user.id}`));
      await withBillingTransaction(prisma, inviter.id, (t) =>
        grantBonus(t, inviter.id, INVITE.BOTH_REWARD_POINTS, 'INVITE_REGISTER', `invreg:${inviter.id}:${user.id}`));
    }
    const payload = { sub: user.id, level: user.level };
    res.json({ accessToken: signAccess(payload), refreshToken: signRefresh(payload), user: { id: user.id, level: user.level, isAdmin: isAdminUser(user), staff: isAdminUser(user), isSuperAdmin: isSuperAdminUser(user) } });
  });
  const loginSchema = z.object({ phone: z.string(), password: z.string() });
  authRouter.post('/login', async (req, res) => {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '参数错误' });
    const user = await prisma.user.findUnique({ where: { phone: p.data.phone } });
    if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, p.data.password)))
      return res.status(401).json({ error: '手机号或密码错误' }); // 不区分“用户不存在/密码错”，防枚举
    if (user.banned) return res.status(403).json({ error: '账号已封禁' });
    const payload = { sub: user.id, level: user.level };
    res.json({ accessToken: signAccess(payload), refreshToken: signRefresh(payload), user: { id: user.id, level: user.level, isAdmin: isAdminUser(user), staff: isAdminUser(user), isSuperAdmin: isSuperAdminUser(user) } });
  });
  authRouter.post('/refresh', async (req, res) => {
    try {
      const { verifyRefresh } = await import('../lib/auth');
      const data = verifyRefresh(req.body?.refreshToken);
      const user = await prisma.user.findUnique({ where: { id: data.sub } });
      if (!user || user.banned) return res.status(401).json({ error: '无效凭证' });
      res.json({ accessToken: signAccess({ sub: user.id, level: user.level }) });
    } catch {
      res.status(401).json({ error: 'REFRESH_INVALID' });
    }
  });
  // 当前登录用户资料（个人中心数据源）：资料 + 积分 + 存储用量 + 当前会员权益
  authRouter.get('/me', authRequired, async (req: AuthRequest, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!u) return res.status(404).json({ error: '用户不存在' });
    const acct = await prisma.pointsAccount.findUnique({ where: { userId: u.id } });
    const used = await prisma.storageObject.aggregate({ where: { userId: u.id, deletedAt: null }, _sum: { bytes: true } });
    const maskPhone = u.phone ? u.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : null;
    res.json({
      id: u.id, phone: maskPhone, nickname: u.nickname, penName: u.penName ?? null, bio: u.bio ?? null,
      region: (u as any).region ?? null, ageBand: (u as any).ageBand ?? null, gender: (u as any).gender ?? null,
      personalized: (u as any).personalized !== false,
      avatarUrl: u.avatarUrl ?? null, level: u.level, levelExpireAt: u.levelExpireAt ?? null,
      engineTier: u.engineTier, inviteCode: u.inviteCode, isPartner: u.isPartner, extraStorageBytes: u.extraStorageBytes ?? 0,
      isAdmin: isAdminUser(u), // 管理员身份标记（含主账号与历史副管理员；2026-09-29 起不代表后台权力）
      // 内部账户：超管手机号硬命中 + 杨光指定的副管理员。生成/增值服务全免费（后端 isStaff 短路的镜像）
      staff: isAdminUser(u),
      isSuperAdmin: u.phone === SUPER_ADMIN_PHONE, // c199 前端据此显示/隐藏「开设账号」入口（副管理员不可见）
      // 2026-09-29「超管一人独大」：前端后台入口/管理按钮统一以此为准；isAdmin 仅身份展示用
      canAdmin: isSuperAdminUser(u),
      points: { balance: acct?.balance ?? 0, frozen: acct?.frozen ?? 0 },
      storageUsedBytes: (used && used._sum && used._sum.bytes) || 0,
      benefits: MEMBERSHIP[u.level as MemberLevel] ?? null,
    });
  });
  // 修改笔名/昵称/简介（笔名会成为剧本水印；长度与字符合规校验，防注入与超长）
  const profileSchema = z.object({
    nickname: z.string().trim().min(1).max(24).optional(),
    penName: z.string().trim().min(2).max(20).regex(/^[\u4e00-\u9fa5A-Za-z0-9_·\-]+$/, '笔名仅支持中英文数字与 _·-').optional().or(z.literal('')),
    bio: z.string().trim().max(300).optional().or(z.literal('')),
    avatarUrl: z.string().max(500).optional(),
    // v2.71 显式画像：枚举白名单校验，非法值直接 400；空串=清空
    region: z.string().trim().max(12).refine((v) => v === '' || PROFILE_REGIONS.includes(v), '地区不在可选范围').optional(),
    ageBand: z.string().trim().max(8).refine((v) => v === '' || AGE_BAND_IDS.includes(v), '年龄段不合法').optional(),
    gender: z.string().trim().max(4).refine((v) => v === '' || (GENDERS as readonly string[]).includes(v), '性别不合法').optional(),
    personalized: z.boolean().optional(),
  });
  authRouter.patch('/profile', authRequired, async (req: AuthRequest, res) => {
    const p = profileSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? '资料不合法' });
    const data: Record<string, unknown> = {};
    (['nickname', 'penName', 'bio', 'avatarUrl', 'region', 'ageBand', 'gender'] as const).forEach((k) => { const v = p.data[k]; if (v !== undefined) data[k] = v === '' ? null : v; });
    if (p.data.personalized !== undefined) data.personalized = p.data.personalized;
    const u = await prisma.user.update({ where: { id: req.userId! }, data });
    res.json({
      ok: true, nickname: u.nickname, penName: u.penName ?? null, bio: u.bio ?? null, avatarUrl: u.avatarUrl ?? null,
      region: (u as any).region ?? null, ageBand: (u as any).ageBand ?? null, gender: (u as any).gender ?? null,
      personalized: (u as any).personalized !== false,
    });
  });
  return authRouter;
}

export const authRouter = createAuthRouter(defaultPrisma);
