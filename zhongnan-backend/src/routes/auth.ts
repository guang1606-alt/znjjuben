import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { prisma as defaultPrisma } from '../lib/prisma';
import { hashPassword, verifyPassword, signAccess, signRefresh, genInviteCode } from '../lib/auth';
import { passwordStrength } from '../lib/auth-policy';
import { grantBonus } from '../lib/billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import { INVITE, MEMBERSHIP, MemberLevel } from '../config/pricing';
import { authRequired } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { isAdminUser, isSuperAdminUser, SUPER_ADMIN_PHONE } from '../middleware/admin';
import { createLoginThrottle } from '../lib/login-throttle';
import { AGE_BAND_IDS, GENDERS, PROFILE_REGIONS } from '../lib/profile-mapping';

/** 工厂化：生产用默认 prisma 单例，测试可注入内存桩（HTTP 层端到端，不依赖真实数据库） */
type PrismaLike = typeof defaultPrisma;
export function createAuthRouter(prisma: PrismaLike | any) {
  const authRouter = asyncRouter();
  // 登录失败限流（每路由实例独立，测试互不污染）：IP+手机号 15 分钟窗口内 5 次失败即锁定
  const loginThrottle = createLoginThrottle();
  // v2.217 注册限流（防批量注册刷邀请积分）：同 IP 15 分钟窗口内成功注册达 5 个即锁定。
  // 语义与登录限流相反——成功才计数：失败探测（400/409）无收益不计数，刷号必须成功注册。
  const registerThrottle = createLoginThrottle();
  // v2.217 改密节流（防持有 access token 的攻击者暴力猜当前密码）：同用户 15 分钟内
  // 当前密码验证失败 5 次即锁定；成功改密清零。语义与登录限流一致。
  const pwThrottle = createLoginThrottle();
  const phoneSchema = z.object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
    password: z.string().min(8, '密码至少8位').max(64),
    inviteCode: z.string().optional(),
  });
  /** 手机号注册（密码登录版；微信/抖音走 oauth 回调，结构相同） */
  authRouter.post('/register', async (req, res) => {
    const ipKey = req.ip ?? 'unknown';
    if (registerThrottle.isLocked(ipKey)) return res.status(429).json({ error: '注册过于频繁，请稍后再试' });
    const parsed = phoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { phone, password, inviteCode } = parsed.data;
    // 主账号仅由受控引导创建；未初始化时也不可通过公开注册取得特权。
    // （409 占用判断优先于密码强度：与既有防枚举契约一致，保留号一律同样响应）
    if (phone === SUPER_ADMIN_PHONE) return res.status(409).json({ error: '该手机号已注册' });
    const existed = await prisma.user.findUnique({ where: { phone } });
    if (existed) return res.status(409).json({ error: '该手机号已注册' });
    // v2.212 统一密码策略：弱口令黑名单 + 必须含字母和数字（登录不校验强度，存量用户不受影响）
    const pw = passwordStrength(password);
    if (!pw.ok) return res.status(400).json({ error: pw.problems[0] });
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
    // v2.217 账号创建成功才计入注册限流（失败探测不计）
    registerThrottle.recordFailure(ipKey);
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
    const throttleKey = `${req.ip ?? 'unknown'}:${p.data.phone}`;
    if (loginThrottle.isLocked(throttleKey)) return res.status(429).json({ error: '尝试过于频繁，请稍后再试' });
    const user = await prisma.user.findUnique({ where: { phone: p.data.phone } });
    if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, p.data.password))) {
      loginThrottle.recordFailure(throttleKey);
      return res.status(401).json({ error: '手机号或密码错误' }); // 不区分“用户不存在/密码错”，防枚举
    }
    if (user.banned) return res.status(403).json({ error: '账号已封禁' });
    loginThrottle.clear(throttleKey);
    const payload = { sub: user.id, level: user.level };
    res.json({ accessToken: signAccess(payload), refreshToken: signRefresh(payload), user: { id: user.id, level: user.level, isAdmin: isAdminUser(user), staff: isAdminUser(user), isSuperAdmin: isSuperAdminUser(user) } });
  });
  authRouter.post('/refresh', async (req, res) => {
    try {
      const { verifyRefresh, signRefresh } = await import('../lib/auth');
      const { withRefreshFlight } = await import('../lib/refresh-rotate');
      const { createHash } = await import('crypto');
      const data = verifyRefresh(req.body?.refreshToken);
      // 一次性消费（重放防护）：新格式 token 用 jti；旧格式无 jti 用 token 摘要兜底，同样只放行一次，刷完即升级为轮换 token
      // v2.291 在途单飞：同 rt 并发续期（双标签页 access 同时到期）共享首个 flight 结果，
      // 次个请求不再被判 REFRESH_REUSED 误踢全端；flight 完成后重放仍 401（重放防护不破）。
      const key = data.jti ?? `legacy:${createHash('sha256').update(String(req.body?.refreshToken)).digest('hex')}`;
      const flight = await withRefreshFlight(key, data.exp ?? Math.floor(Date.now() / 1000) + 86400, async () => {
        const user = await prisma.user.findUnique({ where: { id: data.sub } });
        if (!user || user.banned) return null;
        const payload = { sub: user.id, level: user.level };
        // 轮换：每次刷新同时下发新 refreshToken，旧 token 即刻作废
        return { accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
      });
      if (!flight.ok) return res.status(401).json({ error: 'REFRESH_REUSED' });
      if (!flight.value) return res.status(401).json({ error: '无效凭证' });
      res.json(flight.value);
    } catch {
      res.status(401).json({ error: 'REFRESH_INVALID' });
    }
  });
  // 登出即吊销：将该 refresh token 的 jti 标记为已消费（复用 refresh-rotate；旧格式无 jti 用摘要兜底）。
  // 幂等：无论 token 是否有效均返回 200，不泄露存在性信息；未传 token 仅表示前端已清理。
  authRouter.post('/logout', async (req, res) => {
    try {
      const { verifyRefresh } = await import('../lib/auth');
      const { consumeRefreshToken } = await import('../lib/refresh-rotate');
      const { createHash } = await import('crypto');
      const rt = req.body?.refreshToken;
      if (rt) {
        const data = verifyRefresh(rt);
        const key = data.jti ?? `legacy:${createHash('sha256').update(String(rt)).digest('hex')}`;
        consumeRefreshToken(key, data.exp ?? Math.floor(Date.now() / 1000) + 86400);
      }
    } catch { /* 无效 token 静默：保持幂等 200 */ }
    res.json({ ok: true });
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
    // v2.303 协议白名单（纵深防御）：仅放行 http(s) 外链与站内相对路径，空串=清空；
    // javascript:/data:text/html/vbscript: 等伪协议一律拒绝——该字段经 /me 与 community 列表透出，
    // 一旦任何消费端以 href/window.open 渲染即 XSS，必须在入库前阻断（不依赖每个渲染点转义）。
    avatarUrl: z.string().trim().max(500)
      .refine((v) => v === '' || /^https?:\/\//i.test(v) || v.startsWith('/'), '头像地址仅支持 http(s) 链接或站内路径')
      .optional(),
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
  // v2.214 自助修改密码：验证当前密码 → 新密码过统一强度策略（v2.212）→ 重哈希落库。
  // 成功后前端清空本地会话、用新密码重新登录；其他设备存量 refresh token 由 TTL 自然过期
  // （不引入 passwordChangedAt 字段，避免迁移依赖；access token 本身短时效，风险可控）。
  const changePwSchema = z.object({
    currentPassword: z.string().min(1, '请输入当前密码').max(64),
    newPassword: z.string().min(8, '新密码至少8位').max(64),
  });
  authRouter.post('/change-password', authRequired, async (req: AuthRequest, res) => {
    const p = changePwSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
    const pwKey = `pw:${req.userId}`;
    if (pwThrottle.isLocked(pwKey)) return res.status(429).json({ error: '尝试过于频繁，请稍后再试' });
    const u = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!u) return res.status(404).json({ error: '用户不存在' });
    if (!u.passwordHash) return res.status(400).json({ error: '当前账号未设置密码，请使用第三方登录' });
    if (!(await verifyPassword(u.passwordHash, p.data.currentPassword))) {
      pwThrottle.recordFailure(pwKey); // v2.217 当前密码猜错计数（持 token 暴力猜密防护）
      return res.status(400).json({ error: '当前密码错误' });
    }
    const pw = passwordStrength(p.data.newPassword);
    if (!pw.ok) return res.status(400).json({ error: `新密码${pw.problems[0]}` });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(p.data.newPassword) } });
    pwThrottle.clear(pwKey); // v2.217 成功改密清零
    res.json({ ok: true });
  });
  return authRouter;
}

export const authRouter = createAuthRouter(defaultPrisma);
