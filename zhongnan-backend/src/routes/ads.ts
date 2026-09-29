/**
 * ads.ts —— 广告位路由
 *  - 公开 GET /api/ads?slot= 取生效广告（首页多滚动广告位等），按 sort 排序，自动过滤未到/已结束/下线
 *  - POST /api/ads/:id/click 点击计数（前端跳转前调用，失败静默不影响跳转）
 *  - 管理端 /api/ads/admin/* 增删改（仅超管），刊例价 priceFenDay 作为收费依据
 */
import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin } from '../middleware/admin';
import { prisma as defaultPrisma } from '../lib/prisma';

type PrismaLike = typeof defaultPrisma;

export const AD_SLOTS = [
  { id: 'home_hero_roll', name: '首页顶部滚动广告位' },
  { id: 'create_done', name: '创作完成页广告位' },
  { id: 'square_feed', name: '广场信息流广告位' },
  { id: 'user_side', name: '个人中心侧边广告位' },
] as const;

export function createAdsRouter(prisma: PrismaLike | any) {
  const router = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅超级管理员可管理广告位');
  const admin = [authRequired, requireAdmin] as any;

  // 生效广告（公开）
  router.get('/', async (req, res) => {
    const slot = typeof req.query.slot === 'string' ? req.query.slot : undefined;
    const now = new Date();
    const all = await prisma.advert.findMany({ where: { active: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] });
    const list = all
      .filter((a: any) => !slot || a.slot === slot)
      .filter((a: any) => (!a.startAt || new Date(a.startAt) <= now) && (!a.endAt || new Date(a.endAt) >= now))
      .map((a: any) => ({ id: a.id, slot: a.slot, title: a.title, imageUrl: a.imageUrl ?? null, linkUrl: a.linkUrl ?? null, badge: a.badge ?? '广告', sponsorName: a.sponsorName ?? null }));
    res.json({ list, slots: AD_SLOTS });
  });

  router.post('/:id/click', async (req, res) => {
    try { await prisma.advert.update({ where: { id: req.params.id }, data: { clicks: { increment: 1 } } }); } catch { /* 计数失败不影响用户 */ }
    res.json({ ok: true });
  });

  // 管理端：列表（含下线/统计）
  router.get('/admin/list', ...admin, async (_req: AuthRequest, res) => {
    const list = await prisma.advert.findMany({ orderBy: [{ slot: 'asc' }, { sort: 'asc' }] });
    res.json({ list, slots: AD_SLOTS });
  });

  const upsertSchema = z.object({
    slot: z.string().min(1).max(40),
    title: z.string().min(1).max(80),
    imageUrl: z.string().max(500).optional().nullable(),
    linkUrl: z.string().max(500).optional().nullable(),
    badge: z.string().max(20).optional().nullable(),
    sponsorName: z.string().max(80).optional().nullable(),
    priceFenDay: z.number().int().min(0).max(10000000).optional(),
    active: z.boolean().optional(),
    sort: z.number().int().min(0).max(9999).optional(),
    startAt: z.union([z.string(), z.null()]).optional(),
    endAt: z.union([z.string(), z.null()]).optional(),
  });

  router.post('/admin/create', ...admin, async (req: AuthRequest, res) => {
    const p = upsertSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '广告参数不合法' });
    const d = p.data;
    const ad = await prisma.advert.create({
      data: {
        slot: d.slot, title: d.title, imageUrl: d.imageUrl ?? null, linkUrl: d.linkUrl ?? null,
        badge: d.badge ?? '广告', sponsorName: d.sponsorName ?? null, priceFenDay: d.priceFenDay ?? 0,
        active: d.active ?? true, sort: d.sort ?? 0,
        startAt: d.startAt ? new Date(d.startAt) : null, endAt: d.endAt ? new Date(d.endAt) : null,
      },
    });
    res.json(ad);
  });

  router.post('/admin/:id/update', ...admin, async (req: AuthRequest, res) => {
    const exist = await prisma.advert.findUnique({ where: { id: req.params.id } });
    if (!exist) return res.status(404).json({ error: '广告不存在' });
    const p = upsertSchema.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: '广告参数不合法' });
    const d: any = { ...p.data };
    if ('startAt' in d) d.startAt = d.startAt ? new Date(d.startAt) : null;
    if ('endAt' in d) d.endAt = d.endAt ? new Date(d.endAt) : null;
    const ad = await prisma.advert.update({ where: { id: exist.id }, data: d });
    res.json(ad);
  });

  router.post('/admin/:id/delete', ...admin, async (req: AuthRequest, res) => {
    await prisma.advert.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ ok: true });
  });

  return router;
}

import { prisma as defaultPrismaInstance } from '../lib/prisma';
export const adsRouter = createAdsRouter(defaultPrismaInstance);
