/**
 * 交流广场（PRD 7.2）：发帖 / 分区列表 / 点赞。发帖先过合规，违规直接拦截。
 */
import { asyncRouter } from '../lib/async-router';
import { prisma as defaultPrisma } from '../lib/prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { scanWithStore } from '../lib/safety-store';

type PrismaLike = typeof defaultPrisma;
const SECTIONS = ['experience', 'team', 'review', 'news'];

export function createCommunityRouter(prisma: PrismaLike | any) {
  const communityRouter = asyncRouter();

  communityRouter.post('/posts', authRequired, async (req: AuthRequest, res) => {
    const raw = req.body as { section?: unknown; title?: unknown; body?: unknown };
    const section = typeof raw.section === 'string' ? raw.section : '';
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const body = typeof raw.body === 'string' ? raw.body.trim() : '';
    if (!SECTIONS.includes(section)) return res.status(400).json({ error: '分区不合法' });
    if (title.length < 1 || title.length > 100 || body.length < 1 || body.length > 5000) {
      return res.status(400).json({ error: '标题/正文长度不合法' });
    }
    // 统一走内容合规中台（标题+正文合并扫描，硬拦截即 422，保持历史错误文案口径）
    const scan = await scanWithStore(`${title}\n${body}`, prisma);
    if (scan.level === 'block') return res.status(422).json({ error: scan.blockReason!, hits: scan.blocked });
    const post = await prisma.post.create({
      data: { userId: req.userId!, section: section!, title, body, hidden: false },
    });
    res.json({ ok: true, id: post.id });
  });

  // 广场列表公开可读（未登录也能浏览），只出未隐藏帖，按热度、时间倒序
  communityRouter.get('/posts', async (req, res) => {
    const section = String(req.query.section ?? '');
    const list = await prisma.post.findMany({
      where: { hidden: false, ...(SECTIONS.includes(section) ? { section } : {}) },
      orderBy: [{ likes: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, section: true, title: true, body: true, likes: true, createdAt: true, user: { select: { nickname: true, avatarUrl: true } } },
    });
    res.json(list);
  });

  communityRouter.post('/posts/:id/like', authRequired, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const postId = req.params.id;
    // 点赞幂等：(userId,postId) 唯一记录 + 计数自增放在同一事务，重复点赞不刷热度
    try {
      const r: { gone: boolean; likes: number; liked: boolean } = await prisma.$transaction(async (tx: any) => {
        const p = await tx.post.findUnique({ where: { id: postId } });
        if (!p || p.hidden) return { gone: true, likes: 0, liked: false };
        const existed = await tx.postLike.findFirst({ where: { userId, postId } });
        // 赞数一律以 postLike 实际计数为准（不依赖 p.likes 快照/活引用语义，内存桩与 Prisma 行为一致）
        if (existed) return { gone: false, likes: await tx.postLike.count({ where: { postId } }), liked: false };
        await tx.postLike.create({ data: { userId, postId } });
        await tx.post.updateMany({ where: { id: postId, hidden: false }, data: { likes: { increment: 1 } } });
        return { gone: false, likes: await tx.postLike.count({ where: { postId } }), liked: true };
      });
      if (r.gone) return res.status(404).json({ error: '帖子不存在' });
      res.json({ ok: true, liked: r.liked, likes: r.likes });
    } catch (e: unknown) {
      // 并发下两人同时首赞：唯一约束兜底，后到者幂等返回
      if ((e as { code?: string })?.code === 'P2002') {
        const likes = await prisma.postLike.count({ where: { postId } });
        return res.json({ ok: true, liked: false, likes });
      }
      throw e;
    }
  });

  return communityRouter;
}

export const communityRouter = createCommunityRouter(defaultPrisma);
