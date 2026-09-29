/**
 * 管理员后台：迭代接续档案（v2.43）
 * GET  /            系统快照 + 接续数据 + 接续口令 Markdown
 * PUT  /            保存管理员维护的迭代脉络（zod 校验长度/类型）
 * POST /append      追加一条迭代日志
 * POST /import      导入外部 JSON 档案（备份恢复/换机）
 * GET  /brief       仅取纯文本接续口令（便于直接下载/复制）
 * 仅超管；工厂化注入 prisma 便于内存桩测试。
 */
import { asyncRouter } from '../lib/async-router';
import { authRequired, AuthRequest } from '../middleware/auth';
import { createRequireAdmin } from '../middleware/admin';
import { prisma } from '../lib/prisma';
import {
  buildSystemSnapshot, loadHandoff, saveHandoff, buildHandoffBrief,
  sanitizeHandoff, appendIteration, importHandoff,
} from '../lib/handoff';
import { z } from 'zod';

const saveSchema = z.object({
  lastDelivery: z.string().max(4000).optional().default(''),
  nextPlan: z.string().max(4000).optional().default(''),
  notes: z.string().max(8000).optional().default(''),
  backlog: z.array(z.string().max(1000)).max(60).optional().default([]),
  openQuestions: z.array(z.string().max(1000)).max(60).optional().default([]),
  iterationLog: z.array(z.object({
    version: z.string().max(20),
    date: z.string().max(20),
    summary: z.string().max(2000),
  })).max(60).optional().default([]),
});

const appendSchema = z.object({
  version: z.string().min(1).max(20),
  date: z.string().max(20).optional().default(''),
  summary: z.string().min(1).max(2000),
});

export function createAdminHandoffRouter(p: any) {
  const r = asyncRouter();
  const requireAdmin = createRequireAdmin(p, '仅超级管理员可读写接续档案');

  r.get('/', authRequired, requireAdmin, async (_req, res) => {
    const snapshot = buildSystemSnapshot();
    const data = await loadHandoff(p);
    res.json({ snapshot, data, brief: buildHandoffBrief(snapshot, data) });
  });

  r.get('/brief', authRequired, requireAdmin, async (_req, res) => {
    const snapshot = buildSystemSnapshot();
    const data = await loadHandoff(p);
    res.type('text/markdown; charset=utf-8').send(buildHandoffBrief(snapshot, data));
  });

  r.put('/', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    const parsed = saveSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? '参数非法' });
    const checked = sanitizeHandoff(parsed.data);
    if (!checked.ok) return res.status(400).json({ error: checked.errors.join('；') });
    const saved = await saveHandoff(checked.data, req.userId || 'admin', p);
    const snapshot = buildSystemSnapshot();
    res.json({ ok: true, data: saved, brief: buildHandoffBrief(snapshot, saved) });
  });

  r.post('/append', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    const parsed = appendSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? '参数非法' });
    const cur = await loadHandoff(p);
    const next = appendIteration(cur, { version: parsed.data.version, date: parsed.data.date, summary: parsed.data.summary });
    const saved = await saveHandoff(next, req.userId || 'admin', p);
    res.json({ ok: true, data: saved });
  });

  r.post('/import', authRequired, requireAdmin, async (req: AuthRequest, res) => {
    const result = importHandoff((req.body as any)?.data ?? req.body);
    if (!result.ok) return res.status(400).json({ error: result.errors.join('；') });
    const saved = await saveHandoff(result.data, req.userId || 'admin', p);
    res.json({ ok: true, data: saved });
  });

  return r;
}

export const adminHandoffRouter = createAdminHandoffRouter(prisma);
