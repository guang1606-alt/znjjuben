/**
 * 超级管理员后台（PRD 第九章）v1.46
 * 覆盖：用户管理（列表/搜索/封禁/调级/增减积分/重置密码）、数据运营总览、财务汇总、社区帖子审核。
 * 模型配置 / 学习窗口 / 反馈处置分别在 admin-model / knowledge / feedback 路由，统一走 createRequireAdmin。
 * 所有聚合用 findMany + JS reduce（不依赖 Prisma groupBy，内存桩可测）；敏感字段 passwordHash 绝不下发。
 */
import { asyncRouter } from '../lib/async-router';
import { createHash } from 'crypto';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin, requireSuperAdmin, SUPER_ADMIN_PHONE } from '../middleware/admin';
import { hashPassword, genInviteCode } from '../lib/auth';
import { passwordStrength } from '../lib/auth-policy';
import { prisma as defaultPrisma } from '../lib/prisma';
import { parsePageParams } from '../lib/pagination';
import { MemberLevel, MEMBERSHIP, EP_PRICE, ENGINE, EngineTier } from '../config/pricing';
import { checkEpPrice, simulateMonthlyPlan } from '../config/pricing-sim';
import { withBillingTransaction } from '../lib/prisma-tx';
import { boardStore } from '../services/board-store';

type PrismaLike = typeof defaultPrisma;

const LEVELS = Object.values(MemberLevel) as [string, ...string[]];
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** 仅回传可展示字段，杜绝 passwordHash 等敏感信息泄露 */
function publicUser(u: any, balance?: number, projectCount?: number) {
  return {
    id: u.id, phone: u.phone ?? null, nickname: u.nickname, penName: u.penName ?? null,
    level: u.level, engineTier: u.engineTier, banned: u.banned, isPartner: u.isPartner,
    isAdmin: (u as any).isAdmin ?? false, // c199 副管理员标识随列表下发，后台可辨
    extraStorageBytes: u.extraStorageBytes ?? 0, levelExpireAt: u.levelExpireAt ?? null,
    createdAt: u.createdAt, balance: balance ?? null, projectCount: projectCount ?? null,
  };
}

export function createAdminRouter(prisma: PrismaLike | any) {
  const r = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅超级管理员可访问管理后台');
  // 2026-09-29「超管一人独大」：所有后台路由在管理员身份之上再加手机号硬判定，
  // 副管理员（isAdmin=true）一律 403；账号保留但无任何后台权力。
  const admin = [authRequired, requireAdmin, requireSuperAdmin] as any;

  // c199 危险操作目标保护（封禁/调级/加减分/重置密码/admin-flag 统一挂载）。
  // 2026-09-29「超管一人独大」后所有操作者必为超管，②已不可达，整组守卫保留作纵深防御——
  // 未来若恢复分级（摘掉部分路由的 requireSuperAdmin），目标保护立即重新生效：
  // ① 主账号绝不可成为目标——防任何账号（含副管理员）下克上封禁/重置最高权限者；
  // ② 副管理员（操作者非主账号）不可操作其他副管理员——只能管普通用户，防互斗窃号/自肥调级；
  // ③ 主账号是唯一仲裁者，可处置包括副管理员在内的所有人。
  // 命中即 403，并顺带把目标用户缓存到 req._targetUser 供 handler 复用（省一次查库）。
  const guardTarget = async (req: any, res: any, next: any) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) return res.status(404).json({ error: '用户不存在' });
    req._targetUser = u;
    // 操作者身份复用 requireAdmin 已查好的 req.adminUser（含 phone），不再二次查库
    const operatorIsSuper = req.adminUser?.phone === SUPER_ADMIN_PHONE;
    if (u.phone === SUPER_ADMIN_PHONE) return res.status(403).json({ error: '不能对主账号执行此操作', protectedTarget: 'superAdmin' });
    if (u.isAdmin && !operatorIsSuper) return res.status(403).json({ error: '副管理员账号仅主账号可操作', protectedTarget: 'subAdmin' });
    next();
  };

  /* ---------- 定价/盈利测算（v1.79，辅助最终定价决策，不臆造用量） ---------- */
  // 默认给「会员只用完每月赠送集」的确定性下限测算；要模拟超量，query 传 eco/std/flag 集数与 other(分/月)
  r.get('/pricing-sim', ...admin, async (req: any, res) => {
    const num = (k: string) => { const v = parseInt(String(req.query[k] ?? ''), 10); return Number.isFinite(v) && v >= 0 ? v : 0; };
    const paid = {
      [EngineTier.ECONOMY]: num('eco'), [EngineTier.STANDARD]: num('std'), [EngineTier.FLAGSHIP]: num('flag'),
    } as Record<EngineTier, number>;
    const otherCostFen = num('other');
    const tiers = [EngineTier.ECONOMY, EngineTier.STANDARD, EngineTier.FLAGSHIP];
    // 各档当前单集售价倍数与不赔钱下限
    const priceTable = (Object.keys(MEMBERSHIP) as MemberLevel[]).map((lv) => ({
      level: lv,
      engines: tiers.filter((t) => EP_PRICE[lv][t] != null).map((t) => checkEpPrice(t, EP_PRICE[lv][t] as number)),
    }));
    // 各会员档月模型（赠送集成本 + 可选超量）
    const plans = (Object.keys(MEMBERSHIP) as MemberLevel[])
      .filter((lv) => lv !== MemberLevel.FREE)
      .map((lv) => {
        const m = MEMBERSHIP[lv] as any;
        const overagePoints: Partial<Record<EngineTier, number>> = {};
        tiers.forEach((t) => { if (EP_PRICE[lv][t] != null) overagePoints[t] = EP_PRICE[lv][t] as number; });
        return simulateMonthlyPlan({
          level: lv, monthlyFen: m.monthlyFen ?? 0, quotaEps: m.quotaMonthly ?? 0,
          paidEps: paid, overagePoints, otherCostFen,
        });
      });
    res.json({
      fenPerPoint: 10, engineCostFen: { ECONOMY: ENGINE.ECONOMY.costFenPerEp, STANDARD: ENGINE.STANDARD.costFenPerEp, FLAGSHIP: ENGINE.FLAGSHIP.costFenPerEp },
      assumedPaidEps: paid, assumedOtherCostFen: otherCostFen,
      note: '赠送集按经济档成本兑现；超量集数与其他月成本为显式传入假设，不传则只算月费覆盖赠送集的下限',
      priceTable, plans,
    });
  });

  /* ---------- 用户管理 ---------- */

  // c198 开设账号（仅超管主账号）：预设初始密码 + 任意权限档（FREE..ENTERPRISE），子账号即开即登录。
  // 层级铁律：不接受 role 等未知提权字段（zod 默认剥离，未在 schema 声明即丢弃）。
  // c199 显式提权口 isAdmin（副管理员身份标记）：仅主账号本人可调本接口授予；
  // 2026-09-29 起副管理员默认不享有任何后台权力（超管一人独大），仅保留身份标记供未来分级。
  const createSchema = z.object({
    phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
    initialPassword: z.string().min(8, '初始密码至少8位').max(64),
    level: z.enum(LEVELS),
    nickname: z.string().trim().min(1).max(24).optional(),
    isAdmin: z.boolean().optional(),
  });
  r.post('/users', ...admin, async (req: AuthRequest, res) => {
    const p = createSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? '参数不合法' });
    const { phone, initialPassword, level, nickname, isAdmin } = p.data;
    // v2.212 统一密码策略：开设账号的初始密码与注册同规则（8位+字母+数字+黑名单）
    const pwCheck = passwordStrength(initialPassword);
    if (!pwCheck.ok) return res.status(400).json({ error: `初始密码${pwCheck.problems[0]}` });
    const existed = await prisma.user.findUnique({ where: { phone } });
    if (existed) return res.status(409).json({ error: '该手机号已存在' });
    const u = await prisma.user.create({
      data: {
        phone, level: level as any,
        passwordHash: await hashPassword(initialPassword),
        nickname: nickname ?? '编剧新人',
        isAdmin: isAdmin ?? false, // c199 副管理员标识（仅主账号可授）
        inviteCode: genInviteCode(),
        pointsAccount: { create: {} },
      },
    });
    res.json(publicUser(u, 0, 0));
  });

  // 用户列表：分页 + 关键词搜索（手机号/昵称/笔名），带积分余额与作品数
  // v2.215 分页统一契约：parsePageParams 归一化（page/pageSize 主风格 + limit/offset 别名），
  // 响应 { items, total, page, pageSize, limit, offset } 四元全回显
  r.get('/users', ...admin, async (req: any, res) => {
    const { page, pageSize, offset } = parsePageParams(req.query, { defaultLimit: 20, maxLimit: 100 });
    const q = String(req.query.q ?? '').trim();
    const all: any[] = await prisma.user.findMany();
    let list = all;
    if (q) {
      const k = q.toLowerCase();
      list = all.filter((u) =>
        [u.phone, u.nickname, u.penName].some((v) => v != null && String(v).toLowerCase().includes(k)));
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const pageItems = list.slice(offset, offset + pageSize);
    const items = await Promise.all(pageItems.map(async (u) => {
      const acc = await prisma.pointsAccount.findUnique({ where: { userId: u.id } });
      const projs = await prisma.project.findMany({ where: { userId: u.id } });
      return publicUser(u, acc?.balance ?? 0, projs.length);
    }));
    res.json({ items, total, page, pageSize, limit: pageSize, offset });
  });

  // 封禁 / 解封
  const banSchema = z.object({ banned: z.boolean() });
  r.post('/users/:id/ban', ...admin, guardTarget, async (req: AuthRequest, res) => {
    const p = banSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
    const u = (req as any)._targetUser; // guardTarget 已校验存在与目标保护
    await prisma.user.update({ where: { id: u.id }, data: { banned: p.data.banned } });
    res.json({ ok: true, banned: p.data.banned });
  });

  // 调整会员等级（可选 days：多少天后到期；不传则长期有效）
  const levelSchema = z.object({
    level: z.enum(LEVELS),
    days: z.number().int().positive().max(3650).optional(),
  });
  r.post('/users/:id/level', ...admin, guardTarget, async (req: AuthRequest, res) => {
    const p = levelSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '等级非法或天数超范围' });
    const u = (req as any)._targetUser;
    const expireAt = p.data.days ? new Date(Date.now() + p.data.days * 864e5) : null;
    await prisma.user.update({ where: { id: u.id }, data: { level: p.data.level as any, levelExpireAt: expireAt } });
    res.json({ ok: true, level: p.data.level, levelExpireAt: expireAt });
  });

  // 授予 / 撤销副管理员身份标记（仅超管；guardTarget 已挡主账号与越权操作其他管理员）。
  // 用途：超管一人独大口径下的唯一回收口——不封禁账号，只摘掉/戴上管理员帽；默认戴了也无后台权。
  const adminFlagSchema = z.object({ isAdmin: z.boolean() });
  r.post('/users/:id/admin-flag', ...admin, guardTarget, async (req: AuthRequest, res) => {
    const p = adminFlagSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'isAdmin 须为布尔值' });
    const u = (req as any)._targetUser;
    await prisma.user.update({ where: { id: u.id }, data: { isAdmin: p.data.isAdmin } });
    res.json({ ok: true, userId: u.id, isAdmin: p.data.isAdmin });
  });

  // 增减积分（正=补发，负=扣减；走计费事务、写流水、余额不得为负），全程可追溯
  const pointsSchema = z.object({
    delta: z.number().int().refine((n) => n !== 0, { message: '积分变动不能为 0' }),
    reason: z.string().min(1).max(100),
    clientToken: z.string().max(200).optional(),
  });
  r.post('/users/:id/points', ...admin, guardTarget, async (req: AuthRequest, res) => {
    const p = pointsSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '积分变动须为非零整数，且需填写原因' });
    const u = (req as any)._targetUser;
    // 确定性幂等键：杜绝双击/重试导致的重复调账。同 Idempotency-Key/clientToken 重试只生效一次；
    // 无令牌时退化为「目标用户+增减额+原因+5分钟窗」，刻意的重复调账请换令牌或等窗口翻过
    const win = Math.floor(Date.now() / (5 * 60 * 1000));
    const token = String(req.get?.('idempotency-key') || p.data.clientToken || '').trim();
    const h = createHash('sha256').update(token ? token.slice(0, 200) : `${p.data.delta}|${p.data.reason}`).digest('hex').slice(0, 16);
    const idem = `ADMIN-ADJUST:${u.id}:w${win}:t${h}`;
    try {
      const result = await withBillingTransaction(prisma as any, u.id, async (tx) => {
        await tx.lockAccount(u.id);
        if (await tx.ledgerExists(idem)) throw new Error('DUP');
        const acc = await tx.getAccount(u.id);
        if (!acc) throw new Error('NO_ACC');
        const nb = acc.balance + p.data.delta;
        if (nb < 0) throw new Error('NEG');
        await tx.updateAccount(u.id, { balance: nb });
        await tx.writeLedger({
          userId: u.id,
          direction: p.data.delta > 0 ? 'IN' : 'OUT',
          bucket: 'RECHARGE',
          amount: Math.abs(p.data.delta),
          reason: `ADMIN_ADJUST:${p.data.reason}`,
          idempotencyKey: idem,
          balanceAfter: nb,
        });
        return nb;
      });
      res.json({ ok: true, balance: result });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'NEG') return res.status(400).json({ error: '调整后余额为负，已拒绝' });
      if (msg === 'NO_ACC') return res.status(400).json({ error: '该用户积分账户尚未建立' });
      if (msg === 'DUP') return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '相同调整刚已提交，请勿重复操作' });
      res.status(500).json({ error: '积分调整失败' });
    }
  });

  // 重置密码（argon2id 重新哈希；管理员不获知原密码）。v2.212 统一密码策略：与注册同规则（8位+字母+数字+黑名单），修复 min(6) 不一致
  const pwSchema = z.object({ newPassword: z.string().min(8, '新密码至少8位').max(64) });
  r.post('/users/:id/reset-password', ...admin, guardTarget, async (req: AuthRequest, res) => {
    const p = pwSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '新密码长度需 8-64 位' });
    const pw = passwordStrength(p.data.newPassword);
    if (!pw.ok) return res.status(400).json({ error: `新密码${pw.problems[0]}` });
    const u = (req as any)._targetUser;
    const hash = await hashPassword(p.data.newPassword);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
    res.json({ ok: true });
  });

  /* ---------- 数据运营总览 ---------- */
  r.get('/stats/overview', ...admin, async (_req, res) => {
    const [users, projects, scripts, posts, listings, orders]: any[][] = await Promise.all([
      prisma.user.findMany(), prisma.project.findMany(), prisma.script.findMany(),
      prisma.post.findMany(), prisma.listing.findMany(), prisma.order.findMany(),
    ]);
    const today = startOfToday();
    const countBy = (arr: any[], key: string) => arr.reduce<Record<string, number>>((m, x) => {
      m[x[key]] = (m[x[key]] ?? 0) + 1; return m;
    }, {});
    res.json({
      users: {
        total: users.length,
        newToday: users.filter((u) => new Date(u.createdAt) >= today).length,
        banned: users.filter((u) => u.banned).length,
        partners: users.filter((u) => u.isPartner).length,
        byLevel: countBy(users, 'level'),
      },
      projects: { total: projects.length, byMode: countBy(projects, 'mode') },
      scripts: { total: scripts.length, qcPassed: scripts.filter((s) => s.qcPassed).length },
      community: { posts: posts.length, postsHidden: posts.filter((p2) => p2.hidden).length },
      market: {
        listings: listings.length,
        onShelf: listings.filter((l) => l.status === 'ON_SHELF').length,
        sold: listings.filter((l) => l.status === 'SOLD').length,
      },
      orders: { total: orders.length, byStatus: countBy(orders, 'status') },
    });
  });

  /* ---------- 财务汇总（单位：分 / 积分） ---------- */
  r.get('/finance/overview', ...admin, async (_req, res) => {
    const [orders, ledgers]: any[][] = await Promise.all([
      prisma.order.findMany(), prisma.ledgerEntry.findMany(),
    ]);
    const paid = orders.filter((o) => o.status === 'PAID' || o.status === 'DELIVERED');
    const byKind: Record<string, { count: number; amountFen: number; points: number }> = {};
    for (const o of paid) {
      const k = o.kind ?? 'UNKNOWN';
      byKind[k] ??= { count: 0, amountFen: 0, points: 0 };
      byKind[k].count += 1;
      byKind[k].amountFen += o.amountFen ?? 0;
      byKind[k].points += o.points ?? 0;
    }
    const pointsIn = ledgers.filter((l) => l.direction === 'IN').reduce((s, l) => s + (l.amount ?? 0), 0);
    const pointsOut = ledgers.filter((l) => l.direction === 'OUT').reduce((s, l) => s + (l.amount ?? 0), 0);
    res.json({
      paidRevenueFen: paid.reduce((s, o) => s + (o.amountFen ?? 0), 0),
      paidOrderCount: paid.length,
      byKind,
      points: { in: pointsIn, out: pointsOut },
    });
  });

  /* ---------- 社区帖子审核 ---------- */
  r.get('/posts', ...admin, async (req: any, res) => {
    const all: any[] = await prisma.post.findMany();
    const includeHidden = String(req.query.hidden ?? 'all');
    let list = all;
    if (includeHidden === 'hidden') list = all.filter((p) => p.hidden);
    if (includeHidden === 'visible') list = all.filter((p) => !p.hidden);
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ items: list, total: list.length });
  });

  const hideSchema = z.object({ hidden: z.boolean() });
  r.post('/posts/:id/hide', ...admin, async (req: AuthRequest, res) => {
    const p = hideSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'hidden 须为布尔值' });
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    await prisma.post.update({ where: { id: post.id }, data: { hidden: p.data.hidden } });
    res.json({ ok: true, hidden: p.data.hidden });
  });

  /* ---------- 榜单仓投喂（昨日爆款自动倾斜的数据来源；采集器/人工均可投喂） ---------- */
  // 查看当前榜单仓状态
  r.get('/board/status', ...admin, (_req, res) => res.json(boardStore.status()));
  // 投喂/合并榜单：body {items:[{title,platform,tags,heat,date,region}], source, replace?}
  const boardSchema = z.object({
    items: z.array(z.object({
      title: z.string().max(120).optional(),
      platform: z.string().max(40).optional(),
      tags: z.any().optional(),
      heat: z.any().optional(),
      date: z.any().optional(),
      region: z.string().max(20).optional(),
      sample: z.boolean().optional(),
    })).max(500),
    source: z.string().max(60).optional(),
    replace: z.boolean().optional(),
  });
  r.post('/board/ingest', ...admin, (req, res) => {
    const p = boardSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? '榜单数据不合法' });
    if (p.data.replace) boardStore.clear();
    const ingested = boardStore.replace(p.data.items as any, p.data.source ?? 'admin');
    res.json({ ok: true, ingested, status: boardStore.status() });
  });
  r.post('/board/clear', ...admin, (_req, res) => { boardStore.clear(); res.json({ ok: true, status: boardStore.status() }); });

  return r;
}

export const adminRouter = createAdminRouter(defaultPrisma);
