/**
 * 超级管理员后台 · 合规规则库管理（PRD 9.2.6 安全策略·敏感词库）
 * 规则事实源：默认规则固化在 content-safety.ts（随版本走、可回滚）；本路由只管理「运营覆写」：
 *   - 新增自定义规则（BLOCK 硬拦 / WARN 预警）
 *   - 启用/停用任意规则（默认规则只能停用、不能删；停用即时全局生效）
 *   - 删除自定义规则、一键恢复默认
 * 全部走统一管理员鉴权；保存后清缓存，业务路由 scanWithStore 下一次请求即生效。
 */
import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { authRequired } from '../middleware/auth';
import { createRequireAdmin, requireSuperAdmin } from '../middleware/admin';
import { prisma as defaultPrisma } from '../lib/prisma';
import { buildCustomRule, ALL_RULES } from '../lib/content-safety';
import { loadOverrides, saveOverrides, listRuleViews, invalidateSafetyCache } from '../lib/safety-store';

type PrismaLike = typeof defaultPrisma;

export function createAdminSafetyRouter(prisma: PrismaLike | any) {
  const r = asyncRouter();
  const requireAdmin = createRequireAdmin(prisma, '仅超级管理员可管理合规规则库');
  const adm = [authRequired, requireAdmin, requireSuperAdmin] as any;

  // 规则库列表：默认规则(builtin)+自定义规则，标注 active
  r.get('/rules', ...adm, async (_req, res) => {
    const rules = await listRuleViews(prisma);
    const ov = await loadOverrides(prisma);
    res.json({
      rules,
      counts: {
        total: rules.length, active: rules.filter((x) => x.active).length,
        block: rules.filter((x) => x.active && x.severity === 'BLOCK').length,
        warn: rules.filter((x) => x.active && x.severity === 'WARN').length,
        custom: rules.filter((x) => !x.builtin).length, disabled: ov.disabled.length,
      },
      builtinIds: ALL_RULES.map((x) => x.id),
    });
  });

  const createSchema = z.object({
    severity: z.enum(['BLOCK', 'WARN']),
    category: z.string().max(40).optional(),
    label: z.string().min(1).max(40),
    patterns: z.union([z.array(z.string()).min(1), z.string().min(1)]),
    advice: z.string().max(300).optional(),
    statute: z.string().max(120).optional(),
  });

  // 新增自定义规则
  r.post('/rules', ...adm, async (req: AuthReq, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? '参数不合法' });
    const built = buildCustomRule(parsed.data as never);
    if (!built.ok) return res.status(400).json({ error: built.error });
    const ov = await loadOverrides(prisma);
    if (ov.custom.some((c) => c.id === built.rule.id)) return res.status(409).json({ error: '规则已存在' });
    ov.custom.push(built.rule);
    ov.disabled = ov.disabled.filter((id) => id !== built.rule.id);
    await saveOverrides(ov, req.userId!, prisma);
    res.json({ ok: true, rule: built.rule });
  });

  // 启用/停用（默认与自定义均可停用；停用即从生效集移除）
  r.post('/rules/:id/toggle', ...adm, async (req: AuthReq, res) => {
    const id = String(req.params.id);
    const active = Boolean((req.body as any)?.active);
    const ov = await loadOverrides(prisma);
    const known = ALL_RULES.some((x) => x.id === id) || ov.custom.some((x) => x.id === id);
    if (!known) return res.status(404).json({ error: '规则不存在' });
    ov.disabled = ov.disabled.filter((x) => x !== id);
    if (!active) ov.disabled.push(id);
    await saveOverrides(ov, req.userId!, prisma);
    res.json({ ok: true, id, active });
  });

  // 删除：仅自定义规则（c_ 开头）；默认规则请用停用
  r.delete('/rules/:id', ...adm, async (req, res) => {
    const id = String(req.params.id);
    if (!id.startsWith('c_')) return res.status(400).json({ error: '内置规则不可删除，只能停用' });
    const ov = await loadOverrides(prisma);
    const before = ov.custom.length;
    ov.custom = ov.custom.filter((x) => x.id !== id);
    ov.disabled = ov.disabled.filter((x) => x !== id);
    if (ov.custom.length === before) return res.status(404).json({ error: '自定义规则不存在' });
    await saveOverrides(ov, 'admin', prisma);
    res.json({ ok: true, id });
  });

  // 一键恢复默认（清空全部覆写）
  r.post('/reset', ...adm, async (_req, res) => {
    await saveOverrides({ custom: [], disabled: [] }, 'admin', prisma);
    invalidateSafetyCache();
    res.json({ ok: true });
  });

  return r;
}

type AuthReq = import('../middleware/auth').AuthRequest;
export const adminSafetyRouter = createAdminSafetyRouter(defaultPrisma);
