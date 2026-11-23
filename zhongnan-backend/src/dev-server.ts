/**
 * 本地演示/走查服务器（DEMO 模式）：无需 Postgres，使用与测试同源的内存数据桩，
 * 供本机浏览器完整走查 UI/沙盘创作。数据不持久化，重启即清空；严禁用于生产。
 * 启动：DEMO=1 PORT=8099 node dist/dev-server.js
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMemoryPrisma } = require('../test/helpers/memory-prisma.cjs');
import { assertNoLoss, pricingMatrixErrors } from './config/pricing';
import { createApp } from './server/app';
import { createAuthRouter } from './routes/auth';
import { createGenerateRouter } from './routes/generate';
import { createValueAddedRouter } from './routes/value-added';
import { createRoomRouter } from './routes/room';
import { createInterviewRouter } from './routes/interview';
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
import { createMediaRouter } from './routes/media';
import { hashPassword } from './lib/auth';

const mem = createMemoryPrisma();

const loss = assertNoLoss();
if (loss.length) { console.error('定价自检失败', loss); process.exit(1); }
const matrix = pricingMatrixErrors();
if (matrix.length) { console.error('定价矩阵不一致（可售引擎与单集价未一一对应）', matrix); process.exit(1); }

const app = createApp({
  auth: createAuthRouter(mem),
  generate: createGenerateRouter(mem),
  va: createValueAddedRouter(mem),
  room: createRoomRouter(mem),
  interview: createInterviewRouter(mem),
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
  // v2.558：媒体读取必须同样落在内存桩上，否则种子海报 /media/demo_media_1 会 404
  media: createMediaRouter(mem),
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
// v2.655：必须先补齐密码哈希再监听。此前这里是 forEach(async) 先入库、后异步写
// passwordHash，而 app.listen 立即接客——健康检查已通过的那几百毫秒里演示账号登录全是
// 401，连续重试还会把登录限流打成 429（全量用例偶发失真的根因）。
async function seedDemoUsers(): Promise<void> {
  await Promise.all(
    demoUsers.map(async (u) => {
      const seeded = mem._seedUser(u);
      seeded.passwordHash = await hashPassword('demo123456');
    }),
  );
}

// v2.492 演示内容种子：让「需要数据才能点开」的弹窗在 DEMO 下拥有真实入口。
// 覆盖九类此前巡检盲区：PK/价值证书/导演交付包/物料（需项目+成稿）、听剧本（需成稿）、
// 剧本详情（需在架 listing）、上架（需自有剧本）、已购全文（需 SETTLED purchase）。
// 全部为内存数据，随重启清空；只种一次，幂等。
void (async function seedDemoContent() {
  const SCRIPT_CONTENT = [
    '第1集 雨夜归来',
    '内景 老旧居民楼·楼道 夜',
    '镜头：缓推至302门口，声控灯忽明忽暗。',
    '△林晚攥紧钥匙，指节发白，鞋尖还滴着水。',
    '林晚（压低声音）：妈，是我，我回来了。',
    '母亲（哽咽）：你还知道回来……三年了。',
    '配乐：钢琴单音渐入。',
    '△窗外一道闪电劈过，照亮她脸上未干的泪痕。',
  ].join('\n');
  try {
    await mem.project.create({
      data: {
        id: 'demo_proj_1', userId: 'demo_pro', title: '雨夜出租车',
        genre: '都市情感', mode: 'tag', engineTier: 'STANDARD', format: 'LIVE_ACTION',
        status: 'active', totalEps: 1, maleChannel: false, premiumLens: false,
        bible: { theme: '归乡与和解', premise: '离家三年的女儿在雨夜敲开家门', characters: [{ name: '林晚' }, { name: '母亲' }] },
        createdAt: new Date(Date.now() - 86400000), updatedAt: new Date(),
      },
    });
    await mem.script.create({
      data: {
        id: 'demo_script_1', projectId: 'demo_proj_1', epNo: 1, title: '雨夜归来',
        synopsis: '林晚冒雨回家，与母亲重逢。', content: SCRIPT_CONTENT,
        wordCount: 120, qcPassed: true, version: 1, qcReport: null,
      },
    });
    await mem.listing.create({
      data: {
        id: 'demo_ls_1', sellerId: 'demo_admin', scriptId: 'demo_seller_script',
        title: '夜班出租车（全 12 集完稿）', priceFen: 12800, sample: SCRIPT_CONTENT,
        commissionPct: 10, status: 'ON_SHELF', createdAt: new Date(),
        valueIndex: 88, valueGrade: 'A', valueEpisodes: 12, valueScannedAt: new Date(),
      },
    });
    await mem.purchase.create({
      data: {
        id: 'demo_purchase_1', buyerId: 'demo_pro', sellerId: 'demo_admin', listingId: 'demo_ls_1',
        priceFen: 12800, pricePoints: 128, feeFen: 1280, status: 'SETTLED',
        contentSnapshot: { title: '夜班出租车', episodes: 12, content: SCRIPT_CONTENT },
        createdAt: new Date(Date.now() - 86400000 * 2), updatedAt: new Date(),
      },
    });
    // v2.558 我的海报：种一张带真实字节的演示海报，让「大图预览/下载原图」弹窗在巡检中有真实入口；
    // 只种内存字节，重启清空，不产生 TOS 依赖。
    const demoPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await mem.mediaAsset.create({
      data: {
        id: 'demo_media_1', userId: 'demo_pro', kind: 'poster', mime: 'image/png',
        size: demoPng.length, bytes: demoPng, createdAt: new Date(Date.now() - 3600000),
      },
    });
  } catch (e) {
    console.warn('[demo] 内容种子失败（不影响启动）:', (e as Error).message);
  }
})();

const port = Number(process.env.PORT) || 8099;

// v2.655：种子就绪后才监听，保证「健康检查通过」等价于「演示账号可登录」。
void (async function main(): Promise<void> {
  await seedDemoUsers();
  app.listen(port, () => {
    console.log(`🎬 终南集 DEMO 模式: http://127.0.0.1:${port}（内存数据，重启清空）`);
    console.log('演示账号：FREE 13900000001 / BASIC 13900000002 / ADVANCED 13900000003 / PRO 13900000004 / 超管 18891995171，密码均 demo123456');
    console.log('本地管理员：15209291219，密码 demo123456');
  });
})();
