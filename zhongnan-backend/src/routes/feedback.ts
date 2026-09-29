import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin, requireSuperAdmin } from '../middleware/admin';
import { prisma as defaultPrisma } from '../lib/prisma';
import {
  FeedbackAction, nextStatus, organizeRequest, xiaonanReply, queryTodos, resolveFixPath,
} from '../engine/feedback';

type PrismaLike = typeof defaultPrisma;

export function createFeedbackRouter(prisma: PrismaLike | any) {
  const feedbackRouter = asyncRouter();
  const schema = z.object({
    type: z.enum(['SUGGESTION', 'BUG']),
    urgent: z.boolean().optional(),
    content: z.string().min(1, '内容不能为空').max(5000),
    contact: z.string().max(100).optional(),
    meta: z.unknown().optional(), // 自动采集：页面/浏览器/版本/脱敏用户ID
  });

  const requireAdmin = createRequireAdmin(prisma, '仅管理员可操作反馈后台');

  /** 提交意见反馈 / Bug报警；Bug 自动生成工单号，urgent 后台置顶 */
  feedbackRouter.post('/', authRequired, async (req: AuthRequest, res) => {
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
    const prefix = p.data.type === 'BUG' ? 'BUG' : 'FB';
    const ticketNo = `${prefix}-${Date.now().toString().slice(-8)}`;
    await prisma.feedback.create({
      data: {
        userId: req.userId!, type: p.data.type, urgent: !!p.data.urgent,
        content: p.data.content, contact: p.data.contact,
        meta: (p.data.meta ?? {}) as object, ticketNo,
      },
    });
    res.json({ ok: true, ticketNo, message: '已收到，工单编号请留存' });
  });

  /** 用户查自己的反馈与小南回复（三态处置后这里能看到被尊重的回应） */
  feedbackRouter.get('/mine', authRequired, async (req: AuthRequest, res) => {
    const list = await prisma.feedback.findMany({
      where: { userId: req.userId! }, orderBy: { createdAt: 'desc' }, take: 20,
    });
    res.json(list);
  });

  /** 管理员：全量工单，可按 status/type 过滤，紧急置顶、时间倒序 */
  feedbackRouter.get('/admin/list', authRequired, requireAdmin, requireSuperAdmin, async (req: any, res) => {
    const where: Record<string, unknown> = {};
    const { status, type } = req.query as { status?: string; type?: string };
    if (status) where.status = status;
    if (type) where.type = type;
    const list = await prisma.feedback.findMany({
      where, include: { user: { select: { penName: true, level: true, phone: true } } },
      orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(list);
  });

  /** 管理员：待办后台，按时间或会员等级归纳排序，可按等级筛选 */
  feedbackRouter.get('/admin/todos', authRequired, requireAdmin, requireSuperAdmin, async (req: any, res) => {
    const { sortBy, level, order } = req.query as { sortBy?: 'time' | 'level'; level?: string; order?: 'asc' | 'desc' };
    const rows = await prisma.feedback.findMany({
      where: { status: 'TODO' },
      include: { user: { select: { penName: true, level: true } } },
    });
    const todos = queryTodos(
      rows.map((r: any) => ({ id: r.id, content: r.content, level: r.user?.level ?? 'FREE', createdAt: r.createdAt })),
      { sortBy: sortBy === 'level' ? 'level' : 'time', level, order },
    );
    // 排序后回填工单详情（ticketNo/urgent/type/penName），便于后台展示
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    res.json(todos.map((t) => ({ ...t, ticket: byId.get(t.id) })));
  });

  /** 一键执行前：先梳理诉求（分类+摘要）并预判修复路径，供管理员确认/手改，不落库 */
  feedbackRouter.post('/admin/:id/preview', authRequired, requireAdmin, requireSuperAdmin, async (req: any, res) => {
    const fb = await prisma.feedback.findUnique({ where: { id: req.params.id } });
    if (!fb) return res.status(404).json({ error: '工单不存在' });
    const org = organizeRequest(fb.content);
    const fix = resolveFixPath(fb.content);
    res.json({ id: fb.id, ticketNo: fb.ticketNo, content: fb.content, ...org, fixPath: fix });
  });

  const actionSchema = z.object({
    action: z.enum(['execute', 'todo', 'reject']),
    manualText: z.string().max(1000).optional(), // 管理员手改的回复，优先于模板
  });
  /** 管理员三态处置：一键执行/待办/否定；选定后经小南自动给用户暖心回复 */
  feedbackRouter.post('/admin/:id/action', authRequired, requireAdmin, requireSuperAdmin, async (req: any, res) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const action: FeedbackAction = parsed.data.action;
    const fb = await prisma.feedback.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { penName: true } } },
    });
    if (!fb) return res.status(404).json({ error: '工单不存在' });
    const org = organizeRequest(fb.content);
    const reply = xiaonanReply(action, {
      penName: (fb.user as any)?.penName ?? null,
      summary: org.summary,
      manualText: parsed.data.manualText ?? null,
    });
    const dbStatus = nextStatus(action).toUpperCase(); // engine 小写态 → DB 枚举大写
    const fixPath = action === 'execute' ? resolveFixPath(fb.content) : null;
    await prisma.feedback.update({ where: { id: fb.id }, data: { status: dbStatus, reply } });
    res.json({ ok: true, id: fb.id, status: dbStatus, category: org.category, summary: org.summary, fixPath, reply });
  });

  return feedbackRouter;
}

export const feedbackRouter = createFeedbackRouter(defaultPrisma);
