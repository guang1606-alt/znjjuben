import 'dotenv/config';
import { assertNoLoss } from './config/pricing';
import { createApp } from './server/app';
import { settleDueEscrows } from './lib/escrow';
import { prisma } from './lib/prisma';
import { startAutoScheduler } from './services/scheduler';
import { assertJwtSecrets } from './lib/auth';
import { ensureSuperAdmin } from './lib/super-admin';

/** 启动前自检：任何售卖组合售价低于成本2倍，直接拒绝启动 */
const lossErrors = assertNoLoss();
if (lossErrors.length) {
  console.error('❌ 定价违反不赔钱铁律，拒绝启动：\n -', lossErrors.join('\n - '));
  process.exit(1);
}
console.log('✅ 定价自检通过：所有售卖组合 售价 >= 成本×2');

/** 启动前自检：生产环境必须显式配置 JWT 密钥，杜绝公开默认密钥导致的令牌伪造 */
try {
  assertJwtSecrets();
} catch (e) {
  console.error('❌', (e as Error).message);
  process.exit(1);
}

const app = createApp({}, undefined, { prisma });

// 担保交易：每小时自动把托管满24h的订单放款给卖家（幂等，可安全重复执行）
// Serverless（veFaaS）实例按流量冻结/回收且可能多实例，setInterval 不可靠：
// 云端部署用 DISABLE_CRON=1 关闭，改由云定时任务周期性触发 settleDueEscrows。
const ESCROW_CRON_MS = 3600 * 1000;
if (process.env.DISABLE_CRON === '1') {
  console.log('⏸️  DISABLE_CRON=1：已关闭托管放款定时器（由外部定时任务驱动）');
} else {
  setInterval(() => { settleDueEscrows().then((n) => n && console.log(`[escrow] 自动放款 ${n} 笔`)).catch(() => {}); }, ESCROW_CRON_MS);
}

// 自主进化调度：每日自主学习闭环 + 每周一 API 全面盘点（DISABLE_AUTO_SCHEDULER=1 可关）
startAutoScheduler(prisma);

// c198 超管主账号引导：18891995171 无则建（ENTERPRISE + 初始密码）、空密码补设、封禁自愈；
// 幂等且失败不阻断启动（如数据库暂不可达，下次启动重试，主账号仍可用既有密码登录）
ensureSuperAdmin(prisma).catch((e) => console.error('[super-admin] 引导失败（不阻断启动）:', (e as Error).message));

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`🚀 终南集·AGI编剧大师 后端: http://localhost:${port} (health: /health)`));
