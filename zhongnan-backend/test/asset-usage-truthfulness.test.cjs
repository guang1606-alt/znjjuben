/**
 * v2.596 三族资产引用统计（GET /api/generate/{character,prop,scene}-assets/usage）读取失败不得伪装成「零引用」：
 * 旧实现 `prisma.project.findMany(...).catch(() => [])`——数据库抖动时接口照常 200，
 * usage map 全空、scannedProjects=0，L3 编导看不到资产当前被哪些项目引用，
 * 与 v2.594 资产库 list/health、v2.595 资产看板 dashboard 故障伪装空库同族。
 * 本用例锁定：
 *   1. 正常合约不变（usage map 含真实引用 + scannedProjects 反映扫描范围）；
 *   2. findMany 阶段故障必须 500 + 可重试提示 + 三族各自留痕 scope，绝不回空 map；
 *   3. 恢复后立即可读。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'au-secret';
process.env.JWT_REFRESH_SECRET = 'au-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);

const UID = 'u_usage';
const UASG_MSG = '资产引用统计加载失败，请重试';

before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  // 三族 seed 各一条资产（直接 create，usage 端点不需要资产本身存在——只扫项目 bible 快照里的 id；
  // 但项目 bible 里要有对应 id，buildAssetUsageMap 才能聚合出真实 usage map）
  await mem.characterAsset.create({ data: { id: 'ca_u1', userId: UID, name: '林昭', persona: '刑警', level: 'BASIC', usedCount: 1, bible: {} } });
  await mem.propAsset.create({ data: { id: 'pa_u1', userId: UID, name: '铜怀表', meaning: '父亲遗物', level: 'BASIC', usedCount: 1, bible: {} } });
  await mem.sceneAsset.create({ data: { id: 'sa_u1', userId: UID, name: '老宅祠堂', mood: '森严', level: 'BASIC', usedCount: 1, bible: {} } });
  // seed 一个项目，bible 快照引用三族各一条——usage 端点扫这个项目就能聚合出真实引用
  await mem.project.create({
    data: {
      id: 'p_usage1',
      userId: UID,
      title: '测试项目',
      status: 'LIVE',
      bible: {
        castAssets: [{ id: 'ca_u1', name: '林昭' }],
        propAssets: [{ id: 'pa_u1', name: '铜怀表' }],
        sceneAssets: [{ id: 'sa_u1', name: '老宅祠堂' }],
      },
    },
  });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

async function get(path) {
  const resp = await fetch(base + path, { headers: { Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` } });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}
function patch(model, method, impl) {
  const orig = mem[model][method];
  mem[model][method] = impl(orig);
  return () => { mem[model][method] = orig; };
}
async function captureErrors(fn) {
  const calls = [];
  const orig = console.error;
  console.error = (...a) => { calls.push(a); };
  try { await fn(); } finally { console.error = orig; }
  return calls;
}
function hasScope(calls, scope) {
  return calls.some((c) => typeof c[0] === 'string' && c[0].includes(`[${scope}]`));
}

const FAMILIES = [
  { path: '/api/generate/character-assets/usage', family: 'cast', assetId: 'ca_u1' },
  { path: '/api/generate/prop-assets/usage', family: 'prop', assetId: 'pa_u1' },
  { path: '/api/generate/scene-assets/usage', family: 'scene', assetId: 'sa_u1' },
];

describe('三族资产引用统计真实性·asset-usage（v2.596）', { concurrency: 1 }, () => {
  // —— 正常合约：三族各返回 usage map + scannedProjects ——
  it('正常：三族 usage map 含真实引用 + scannedProjects 反映扫描范围', async () => {
    for (const f of FAMILIES) {
      const r = await get(f.path);
      assert.strictEqual(r.status, 200, `${f.path} 应 200`);
      assert.ok(r.body.usage && typeof r.body.usage === 'object', `${f.path} 必须返回 usage 对象`);
      assert.ok(r.body.scannedProjects >= 1, `${f.path} scannedProjects 应 ≥ 1（扫到测试项目）`);
      // bible 快照里引用了该资产 → usage map 里应该有对应 id
      assert.ok(r.body.usage[f.assetId], `${f.path} usage map 应含 ${f.assetId}`);
      assert.strictEqual(r.body.usage[f.assetId][0].projectId, 'p_usage1');
    }
  });

  // —— 故障：patch project.findMany 抛 DB_DOWN → 三族全部 500 + 文案 + 各自 scope 留痕 ——
  it('findMany 故障：三族全部 500 + 文案 + 各自留痕，绝不回空 map 冒充零引用', async () => {
    const restore = patch('project', 'findMany', (orig) => async (arg) => {
      if (arg?.where?.userId === UID) throw new Error('DB_DOWN');
      return orig.call(mem.project, arg);
    });
    try {
      const calls = await captureErrors(async () => {
        for (const f of FAMILIES) {
          const r = await get(f.path);
          assert.strictEqual(r.status, 500, `${f.path} 应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, UASG_MSG, `${f.path} 错误文案不符`);
          assert.strictEqual(r.body.usage, undefined, `${f.path} 不得返回空 usage map`);
          assert.strictEqual(r.body.scannedProjects, undefined, `${f.path} 不得返回 scannedProjects`);
        }
      });
      // 三族各自 scope 必须都留痕
      assert.ok(hasScope(calls, 'generate.asset.cast.usage'), '必须留痕 cast.usage');
      assert.ok(hasScope(calls, 'generate.asset.prop.usage'), '必须留痕 prop.usage');
      assert.ok(hasScope(calls, 'generate.asset.scene.usage'), '必须留痕 scene.usage');
    } finally { restore(); }
  });

  // —— 恢复后立即可读 ——
  it('恢复后立即可读（故障不污染后续请求）', async () => {
    for (const f of FAMILIES) {
      const r = await get(f.path);
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.usage[f.assetId]);
    }
  });
});
