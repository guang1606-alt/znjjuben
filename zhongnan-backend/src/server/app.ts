/**
 * Express 应用装配工厂：生产 index.ts 与 HTTP 层测试共用。
 * 测试可注入任意路由（如内存桩版 authRouter），未注入的使用真实默认路由。
 */
import express, { Express, Router } from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter as defaultAuth } from '../routes/auth';
import { generateRouter as defaultGenerate } from '../routes/generate';
import { vaRouter as defaultVa } from '../routes/value-added';
import { roomRouter as defaultRoom } from '../routes/room';
import { interviewRouter as defaultInterview } from '../routes/interview';
import { teardownRouter as defaultTeardown } from '../routes/teardown';
import { adsRouter as defaultAds } from '../routes/ads';
import { orderRouter as defaultOrder } from '../routes/order';
import { feedbackRouter as defaultFeedback } from '../routes/feedback';
import { knowledgeRouter as defaultKnowledge } from '../routes/knowledge';
import { marketRouter as defaultMarket } from '../routes/market';
import { communityRouter as defaultCommunity } from '../routes/community';
import { exportRouter as defaultExport } from '../routes/export';
import { adminModelRouter as defaultAdminModel } from '../routes/admin-model';
import { adminRouter as defaultAdmin } from '../routes/admin';
import { adminSafetyRouter as defaultAdminSafety } from '../routes/admin-safety';
import { tagsRouter as defaultTags } from '../routes/tags';
import { craftRouter as defaultCraft } from '../routes/craft';
import { novelSourcesRouter as defaultNovels } from '../routes/novel-sources';
import { adminHandoffRouter as defaultAdminHandoff } from '../routes/admin-handoff';
import { updatesRouter as defaultUpdates } from '../routes/updates';
import { submissionRouter as defaultSubmission } from '../routes/submission';
import { bannedGuard } from '../middleware/auth';
import { settleDueEscrows } from '../lib/escrow';
import { prisma as defaultPrisma } from '../lib/prisma';

export interface AppRouters {
  auth?: Router; generate?: Router; va?: Router; order?: Router; feedback?: Router;
  knowledge?: Router; market?: Router; community?: Router; export?: Router; adminModel?: Router; adminSafety?: Router; admin?: Router; room?: Router; teardown?: Router; ads?: Router; tags?: Router; craft?: Router; novels?: Router; adminHandoff?: Router; interview?: Router; updates?: Router; submission?: Router;
}

export interface AppDeps {
  /** 生产入口传入真实 Prisma：装配全局限封守卫；测试/demo 不传则跳过 */
  prisma?: any;
}

export function createApp(routers: AppRouters = {}, preErrorRouter?: Router | Router[], deps: AppDeps = {}): Express {
  const app = express();
  app.use(express.json({ limit: '12mb' })); // 学习窗口支持上传较大文本/转写稿
  app.use(express.text({ type: 'text/plain', limit: '1mb' })); // veFaaS 定时器 Payload 以 text/plain 透传
  app.use(cors({ origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean), credentials: true }));
  // 安全响应头（v2.208）：nosniff 防_mime嗅探、DENY 防点击劫持、Referrer-Policy 限引荐泄露、
  // Permissions-Policy 关闭摄像头/麦克风/定位；/api 响应禁缓存防 token 与个人信息落中间缓存。
  // 不设 CSP：web 端大量内联样式，style-src 需 unsafe-inline 形同虚设，贸然上线会全站破坏。
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (_req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
  if (deps.prisma) app.use('/api', bannedGuard(deps.prisma));
  app.use('/api/auth', routers.auth ?? defaultAuth);
  app.use('/api/generate', routers.generate ?? defaultGenerate);
  app.use('/api/va', routers.va ?? defaultVa);
  app.use('/api/room', routers.room ?? defaultRoom);
  app.use('/api/interview', routers.interview ?? defaultInterview);
  app.use('/api/teardown', routers.teardown ?? defaultTeardown);
  app.use('/api/ads', routers.ads ?? defaultAds);
  app.use('/api/order', routers.order ?? defaultOrder);
  app.use('/api/feedback', routers.feedback ?? defaultFeedback);
  app.use('/api/admin/knowledge', routers.knowledge ?? defaultKnowledge);
  app.use('/api/admin/model', routers.adminModel ?? defaultAdminModel);
  app.use('/api/admin/safety', routers.adminSafety ?? defaultAdminSafety);
  app.use('/api/admin', routers.admin ?? defaultAdmin);
  app.use('/api/market', routers.market ?? defaultMarket);
  app.use('/api/community', routers.community ?? defaultCommunity);
  app.use('/api/export', routers.export ?? defaultExport);
  app.use('/api/tags', routers.tags ?? defaultTags);
  app.use('/api/craft', routers.craft ?? defaultCraft);
  app.use('/api/novels', routers.novels ?? defaultNovels);
  app.use('/api/admin/handoff', routers.adminHandoff ?? defaultAdminHandoff);
  app.use('/api', routers.updates ?? defaultUpdates);
  app.use('/api/submission', routers.submission ?? defaultSubmission);
  // 扩展挂载位：位于统一错误中间件之前，保证其 async 抛错也能被 JSON 兜底（测试/后续模块复用）
  if (preErrorRouter) (Array.isArray(preErrorRouter) ? preErrorRouter : [preErrorRouter]).forEach((r) => app.use(r));
  // 内部定时任务入口：云定时器周期性调用，CONFIG_SECRET 鉴权
  // 生产 setInterval 已被 DISABLE_CRON=1 关闭，改由该路由驱动托管放款
  app.post('/api/internal/escrow/settle', async (_req, res) => {
    const token = _req.headers.authorization?.replace(/^Bearer\s+/i, '') || (_req.headers['x-cron-token'] as string);
    const secret = process.env.CONFIG_SECRET;
    if (!secret?.trim() || !token || token !== secret) return res.status(401).json({ error: 'unauthorized' });
    try {
      const n = await settleDueEscrows();
      res.json({ ok: true, settled: n });
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });
  // veFaaS 定时触发器（webserver 模式）会 POST 到根路径 /，Payload 透传为请求体
  // Payload 格式：<CONFIG_SECRET>:<task>，task ∈ escrow|daily|weekly
  app.post('/', async (_req, res) => {
    const body = _req.body;
    const raw = typeof body === 'string' ? body.trim()
      : body && typeof body === 'object' ? String(Object.values(body)[0] ?? '') : '';
    const [token, task] = raw.split(':');
    const secret = process.env.CONFIG_SECRET;
    if (!secret?.trim() || !token || token !== secret) return res.status(404).end();
    try {
      if (task === 'daily') {
        const { runDailyLearningCycle } = await import('../services/auto-learning');
        const r = await runDailyLearningCycle(deps.prisma ?? defaultPrisma);
        return res.json({ ok: true, task: 'daily', collected: r.collected, fresh: r.fresh });
      }
      if (task === 'weekly') {
        const { runWeeklyModelAudit } = await import('../services/auto-learning');
        const r = await runWeeklyModelAudit(deps.prisma ?? defaultPrisma, {}, 'scheduler');
        return res.json({ ok: true, task: 'weekly', healthy: r.report.healthy });
      }
      // 默认：托管放款
      const n = await settleDueEscrows();
      res.json({ ok: true, task: 'escrow', settled: n });
    } catch (e) {
      res.status(500).json({ error: 'INTERNAL_ERROR', task });
    }
  });
  // v2.213 未知路由 404 统一 JSON 化：/api/* 未匹配路由不再穿透到 Express 默认 HTML 404，
  // 前端 fetch 失效端点拿到明确 NOT_FOUND 而非 "Cannot GET" 文本；挂载在所有 API/扩展路由之后
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });
  // 前端静态站点（零构建，web/ 目录）：必须在所有 API 与扩展路由之后，只做最后兜底，绝不吞 /api 与测试路由
  const webDir = path.join(__dirname, '../../web');
  app.use(express.static(webDir));
  app.get(/^(?!\/api(?:\/|$)|\/health$).*/, (req, res, next) => {
    // 只对浏览器导航（地址栏/刷新，Accept 含 text/html）回退单页；程序化 fetch（*/*）与后置路由放行
    if (!/text\/html/.test(req.headers.accept || '')) return next();
    res.sendFile(path.join(webDir, 'index.html'), (err) => err && next());
  });
  // 注意：此处不再加终局 404 —— 测试/扩展会在 createApp 返回后追加注册路由（如 /_test/*），
  // 终局 catch-all 会抢在它们之前吞掉请求；非 API 未知路径维持 Express 默认 404 即可。
  // 统一兜底错误处理，绝不把堆栈抛给前端
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });
  return app;
}
