/**
 * v2.318 制作中管理台：统一查看 + 干预（仅超管主账号）。
 * 查看：QUEUED/RUNNING/FAILED/CANCELED 任务统一列表（live 实时句柄标记，区分「正在跑」与「进程重启孤儿」）、
 *       任务详情（全字段 + 项目 + 项目主人 + 岗位级 ModelCallLog 调用时间线）。
 * 干预：① cancel——abort 共享注册表里的真实句柄，管线在下一岗位边界抛 CANCELLED，走既有退款闭环；
 *       ② force-fail——清僵尸：进程重启后 QUEUED/RUNNING 悬挂任务（registry 无句柄即孤儿），
 *          先按幂等键 `unfreeze:${taskId}` 解冻（与生成失败路径同键，重复调用安全），成功后翻 FAILED。
 * 诚实边界：管线为 SSE 内联执行，无真实「暂停/恢复」能力，不做假按钮；「重跑」由用户在项目页重新发起。
 * 安全：查询/干预均为后台操作，authRequired + requireAdmin + requireSuperAdmin 三层拦截。
 */
import { asyncRouter } from '../lib/async-router';
import { failInternal } from '../lib/http-errors';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin, requireSuperAdmin } from '../middleware/admin';
import { getActiveAbort } from '../lib/active-tasks';
import { withBillingTransaction } from '../lib/prisma-tx';
import { unfreeze, BillingError } from '../lib/billing';
import { prisma as defaultPrisma } from '../lib/prisma';

/** 任务行：列表与详情共用的脱敏投影（不外露供应商/模型名） */
function taskRow(t: any) {
  const created = new Date(t.createdAt).getTime();
  const end = t.finishedAt ? new Date(t.finishedAt).getTime() : Date.now();
  return {
    id: t.id,
    status: t.status,
    stage: t.stage ?? null,
    engineTier: t.engineTier ?? null,
    pointsCost: t.pointsCost ?? 0,
    errorMsg: t.errorMsg ?? null,
    createdAt: t.createdAt,
    finishedAt: t.finishedAt ?? null,
    live: !!getActiveAbort(t.id),
    durationMs: Math.max(0, end - created),
    project: t.project ? { id: t.project.id, title: t.project.title, mode: t.project.mode, userId: t.project.userId } : null,
  };
}

/** 生产默认解冻：幂等键与生成失败路径完全一致；免费单/已结算单 NO_LOSS/NO_CHARGE 静默通过 */
async function defaultRefundTask(prisma: any, task: { id: string; pointsCost: number; project: { userId: string } | null }) {
  const userId = task.project?.userId;
  if (!userId || !task.pointsCost) return;
  try {
    await withBillingTransaction(prisma, userId, async (tx: any) => {
      await unfreeze(tx, userId, task.pointsCost, task.id, `unfreeze:${task.id}`);
    });
  } catch (e) {
    if (e instanceof BillingError && (e.code === 'NO_LOSS' || e.code === 'NO_CHARGE' || e.code === 'IDEMPOTENT')) return;
    throw e; // 资金侧真实故障：上抛阻断状态翻转，保证「先退款后翻状态」可安全重试
  }
}

export interface ProductionConsoleOpts {
  /** 测试注入：覆盖默认幂等解冻（签名收到 task 含 project.userId/pointsCost） */
  refundTask?: (task: { id: string; pointsCost: number; project: { userId: string } | null }) => Promise<void>;
}

export function createProductionConsoleRouter(prisma: any, opts: ProductionConsoleOpts = {}) {
  const r = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅超级管理员可访问制作中管理台');
  const refundTask = opts.refundTask ?? ((t: any) => defaultRefundTask(prisma, t));
  const PROJECT_SELECT = { select: { id: true, title: true, mode: true, userId: true } };

  // 查看列表：scope=active(默认 QUEUED+RUNNING) / failed(FAILED+CANCELED) / all
  r.get('/tasks', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const scope = String((req.query as any).scope || 'active');
      const statusIn = scope === 'failed' ? ['FAILED', 'CANCELED']
        : scope === 'all' ? ['QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELED']
        : ['QUEUED', 'RUNNING'];
      const lim = Math.min(Math.max(Number((req.query as any).limit) || 100, 1), 200);
      const rows = await prisma.generationTask.findMany({
        where: { status: { in: statusIn } },
        orderBy: { createdAt: 'desc' },
        take: lim,
        include: { project: PROJECT_SELECT },
      });
      res.json({ ok: true, scope, tasks: rows.map(taskRow) });
    } catch (e) {
      failInternal(res, e, 'production-list');
    }
  });

  // 查看详情：任务 + 项目主人 + 岗位级调用日志（成本/档位时间线）
  r.get('/tasks/:id', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const t = await prisma.generationTask.findUnique({ where: { id: req.params.id }, include: { project: PROJECT_SELECT } });
      if (!t) return res.status(404).json({ error: '任务不存在' });
      const callLogs = await prisma.modelCallLog.findMany({ where: { taskId: t.id }, orderBy: { createdAt: 'desc' }, take: 200 });
      const owner = t.project?.userId
        ? await prisma.user.findUnique({ where: { id: t.project.userId }, select: { id: true, phone: true, nickname: true } })
        : null;
      res.json({ ok: true, task: { ...taskRow(t), owner: owner ?? null, callLogs } });
    } catch (e) {
      failInternal(res, e, 'production-detail');
    }
  });

  // 干预①：取消活跃任务（abort 真实句柄 → 管线下一岗位边界抛 CANCELLED → 既有 catch 解冻退款）
  r.post('/tasks/:id/cancel', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const t = await prisma.generationTask.findUnique({ where: { id: req.params.id } });
      if (!t) return res.status(404).json({ error: '任务不存在' });
      if (t.status !== 'RUNNING' && t.status !== 'QUEUED') return res.status(409).json({ error: '任务已结束，无需取消' });
      const ctrl = getActiveAbort(t.id);
      if (!ctrl) return res.status(409).json({ error: '任务无活跃执行句柄（疑似进程重启孤儿），请使用强制失败清理' });
      ctrl.abort();
      res.json({ ok: true, taskId: t.id, action: 'cancel' });
    } catch (e) {
      failInternal(res, e, 'production-cancel');
    }
  });

  // 干预②：强制失败清僵尸（仅孤儿：registry 无句柄）。先幂等解冻再翻状态，退款失败保持原状可重试
  r.post('/tasks/:id/force-fail', authRequired, requireAdmin, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const t = await prisma.generationTask.findUnique({
        where: { id: req.params.id },
        include: { project: { select: { userId: true } } },
      });
      if (!t) return res.status(404).json({ error: '任务不存在' });
      if (t.status !== 'RUNNING' && t.status !== 'QUEUED') return res.status(409).json({ error: '任务已结束' });
      if (getActiveAbort(t.id)) return res.status(409).json({ error: '任务执行中且有活跃句柄，请使用取消（保证退款闭环）' });
      await refundTask({ id: t.id, pointsCost: t.pointsCost ?? 0, project: t.project ?? null });
      const updated = await prisma.generationTask.update({
        where: { id: t.id },
        data: { status: 'FAILED', errorMsg: '管理员标记失败（僵尸任务清理：服务重启悬挂，无活跃执行句柄）' },
      });
      res.json({ ok: true, taskId: t.id, action: 'force-fail', task: taskRow(updated) });
    } catch (e) {
      failInternal(res, e, 'production-force-fail');
    }
  });

  return r;
}

export const productionConsoleRouter = createProductionConsoleRouter(defaultPrisma);
