/**
 * 本地演示/走查服务器（DEMO 模式）：无需 Postgres，使用与测试同源的内存数据桩，
 * 供本机浏览器完整走查 UI/沙盘创作。数据不持久化，重启即清空；严禁用于生产。
 * 启动：DEMO=1 PORT=8099 node dist/dev-server.js
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMemoryPrisma } = require('../test/helpers/memory-prisma.cjs');
import { assertNoLoss } from './config/pricing';
import { createApp } from './server/app';
import { createAuthRouter } from './routes/auth';
import { createGenerateRouter } from './routes/generate';
import { createValueAddedRouter } from './routes/value-added';
import { createRoomRouter } from './routes/room';
import { createTeardownRouter } from './routes/teardown';
import { createAdsRouter } from './routes/ads';
import { createOrderRouter } from './routes/order';
import { createFeedbackRouter } from './routes/feedback';
import { createKnowledgeRouter } from './routes/knowledge';
import { createMarketRouter } from './routes/market';
import { createCommunityRouter } from './routes/community';
import { createExportRouter } from './routes/export';
import { createAdminModelRouter } from './routes/admin-model';
import { createAdminRouter } from './routes/admin';
import { createAdminSafetyRouter } from './routes/admin-safety';
import { createAdminHandoffRouter } from './routes/admin-handoff';
import { hashPassword } from './lib/auth';

const mem = createMemoryPrisma();

const loss = assertNoLoss();
if (loss.length) { console.error('定价自检失败', loss); process.exit(1); }

const app = createApp({
  auth: createAuthRouter(mem),
  generate: createGenerateRouter(mem),
  va: createValueAddedRouter(mem),
  room: createRoomRouter(mem),
  teardown: createTeardownRouter(mem),
  ads: createAdsRouter(mem),
  order: createOrderRouter(mem),
  feedback: createFeedbackRouter(mem),
  knowledge: createKnowledgeRouter(mem),
  market: createMarketRouter(mem),
  community: createCommunityRouter(mem),
  export: createExportRouter(mem),
  adminModel: createAdminModelRouter(mem),
  admin: createAdminRouter(mem),
  adminSafety: createAdminSafetyRouter(mem),
  adminHandoff: createAdminHandoffRouter(mem),
});

// 预置四个等级的演示账号（手机号登录，密码统一 demo123456）
const demoUsers = [
  { id: 'demo_free', phone: '13900000001', level: 'FREE', balance: 200, isAdmin: false },
  { id: 'demo_basic', phone: '13900000002', level: 'BASIC', balance: 2000, isAdmin: false },
  { id: 'demo_adv', phone: '13900000003', level: 'ADVANCED', balance: 6000, isAdmin: false },
  { id: 'demo_pro', phone: '13900000004', level: 'PRO', balance: 20000, isAdmin: false },
  // 2026-09-29 超管一人独大：演示管理员须用超管手机号硬标识（isAdmin 布尔已不再赋予后台权）
  { id: 'demo_admin', phone: '18891995171', level: 'PRO', balance: 99999, isAdmin: false },
  { id: 'local_admin_15209291219', phone: '15209291219', level: 'PRO', balance: 99999, isAdmin: true },
];
demoUsers.forEach(async (u) => {
  const seeded = mem._seedUser(u);
  seeded.passwordHash = await hashPassword('demo123456');
});

const port = Number(process.env.PORT) || 8099;
app.listen(port, () => {
  console.log(`🎬 终南集 DEMO 模式: http://127.0.0.1:${port}（内存数据，重启清空）`);
  console.log('演示账号：FREE 13900000001 / BASIC 13900000002 / ADVANCED 13900000003 / PRO 13900000004 / 超管 18891995171，密码均 demo123456');
  console.log('本地管理员：15209291219，密码 demo123456');
});
