/**
 * v2.186 工具优化弹窗铁律：工具更新公告路由
 *
 * 用户 2026-09-29 拍板：「工具的每一次优化、调整、更新都要有弹窗」。
 * 后端职责：①公开读最新公告 + 当前后端版本号；②超管发布新公告。
 *
 * 路由：
 *  · GET  /api/updates/latest           公开读最新公告 + 版本号
 *  · GET  /api/updates/since?version=X  返回比 X 更新的公告列表（前端增量拉取用）
 *  · POST /api/admin/updates            超管发布新公告（requireSuperAdmin 鉴权）
 *
 * 版本号：以 Announcement 表中最新一条 version 为权威源（前后端同源，
 * 不再读 package.json——package.json 只在 npm publish 时变，无法承载每次 commit 的语义）。
 * 若 Announcement 表为空，则降级读 package.json（避免首启无公告场景 500）。
 *
 * 鉴权：沿用 createRequireAdmin + requireSuperAdmin（2026-09-29「超管一人独大」收紧口径）。
 */
import { asyncRouter } from '../lib/async-router';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin, requireSuperAdmin } from '../middleware/admin';
import { prisma as defaultPrisma } from '../lib/prisma';

type PrismaLike = typeof defaultPrisma;

// 降级读 package.json 版本号（首启或无公告场景）——只读一次缓存，避免每次请求读文件
import pkg = require('../../package.json');
const FALLBACK_VERSION = (pkg as any).version || '0.0.0';

/** 简单语义版本比较：返回 -1/0/1；非标准 semver 时按字符串字典序兜底 */
function cmpVersion(a: string, b: string): number {
  const ta = (a || '').split('.').map((x) => Number(x) || 0);
  const tb = (b || '').split('.').map((x) => Number(x) || 0);
  const len = Math.max(ta.length, tb.length);
  for (let i = 0; i < len; i++) {
    const av = ta[i] ?? 0, bv = tb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/** 投影公告字段（去掉 createdById 等内部字段） */
function publicAnnouncement(a: any) {
  if (!a) return null;
  return {
    id: a.id,
    version: a.version,
    titleZh: a.titleZh ?? '',
    titleEn: a.titleEn ?? null,
    bodyZh: a.bodyZh ?? '',
    bodyEn: a.bodyEn ?? null,
    pinned: !!a.pinned,
    createdAt: a.createdAt,
  };
}

export function createUpdatesRouter(prisma: PrismaLike | any) {
  const r = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅超级管理员可发布更新公告');
  const admin = [authRequired, requireAdmin, requireSuperAdmin] as any;

  /** 公开读最新公告 + 当前版本号 */
  r.get('/updates/latest', async (_req, res) => {
    try {
      const all = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      const pinned = all.find((a: any) => a.pinned);
      const latest = pinned ?? all[0] ?? null;
      const version = latest?.version ?? FALLBACK_VERSION;
      res.json({ announcement: publicAnnouncement(latest), version });
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  /** 增量拉取：返回比 version 更新的所有公告（按 createdAt desc） */
  r.get('/updates/since', async (req, res) => {
    try {
      const v = String(req.query.version || '');
      if (!v) {
        res.status(400).json({ error: 'version is required' });
        return;
      }
      const all = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
      const items = all.filter((a: any) => cmpVersion(a.version, v) > 0).map(publicAnnouncement);
      res.json({ items });
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  /** 超管发布新公告 */
  r.post('/admin/updates', ...admin, async (req: AuthRequest, res: any) => {
    const { version, titleZh, titleEn, bodyZh, bodyEn, pinned } = req.body || {};
    if (!version || typeof version !== 'string' || !String(version).trim()) {
      return res.status(400).json({ error: 'version is required' });
    }
    if (!titleZh || typeof titleZh !== 'string' || !String(titleZh).trim()) {
      return res.status(400).json({ error: 'titleZh is required' });
    }
    if (!bodyZh || typeof bodyZh !== 'string' || !String(bodyZh).trim()) {
      return res.status(400).json({ error: 'bodyZh is required' });
    }
    try {
      const row = await prisma.announcement.create({
        data: {
          version: String(version).trim(),
          titleZh: String(titleZh).trim(),
          titleEn: titleEn ? String(titleEn) : null,
          bodyZh: String(bodyZh).trim(),
          bodyEn: bodyEn ? String(bodyEn) : null,
          pinned: pinned === true,
          createdById: req.userId ?? null,
        },
      });
      res.json(publicAnnouncement(row));
    } catch (e: any) {
      // 唯一约束（同 version 重复）→ 409
      if (e?.code === 'P2002') return res.status(409).json({ error: '该版本号已存在公告', version });
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  return r;
}

/** 生产装配默认路由（与 admin/auth 等保持一致） */
export const updatesRouter = createUpdatesRouter(defaultPrisma);
