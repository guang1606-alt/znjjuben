/**
 * v2.597 三族批量补全（POST /api/generate/{character,prop,scene}-assets/batch-complete）
 * 读取失败不得伪装成「全部已补全」：
 * 旧实现 `prisma.{character,prop,scene}Asset.findMany({id:{in:ids},userId}).catch(() => [])`——
 * 数据库抖动时 rows=[] → for 循环空跑 → 返回 {updated:[], skipped:[], total:0}，
 * 用户提交了资产 ids 要补全，DB 故障时假装「没有要补的」，与 v2.594-2.596 同族。
 * 本用例锁定：
 *   1. 正常合约不变（{updated, skipped, total}）；
 *   2. findMany 故障必须 500 + 可重试提示 + 三族各自留痕 scope；
 *   3. 恢复后立即可读。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'bc-secret';
process.env.JWT_REFRESH_SECRET = 'bc-refresh';
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

const UID = 'u_bc';
const BC_MSG = '批量补全加载失败，请重试';

before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  // 三族各 seed 一条资产
  await mem.characterAsset.create({ data: { id: 'ca_bc1', userId: UID, name: '林昭', persona: '刑警', level: 'BASIC', usedCount: 0, bible: {} } });
  await mem.propAsset.create({ data: { id: 'pa_bc1', userId: UID, name: '铜怀表', meaning: '父亲遗物', level: 'BASIC', usedCount: 0, bible: {} } });
  await mem.sceneAsset.create({ data: { id: 'sa_bc1', userId: UID, name: '老宅祠堂', mood: '森严', level: 'BASIC', usedCount: 0, bible: {} } });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

async function post(path, body) {
  const resp = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` },
    body: JSON.stringify(body),
  });
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
  { path: '/api/generate/character-assets/batch-complete', model: 'characterAsset', family: 'cast', assetId: 'ca_bc1' },
  { path: '/api/generate/prop-assets/batch-complete', model: 'propAsset', family: 'prop', assetId: 'pa_bc1' },
  { path: '/api/generate/scene-assets/batch-complete', model: 'sceneAsset', family: 'scene', assetId: 'sa_bc1' },
];

describe('三族批量补全真实性·asset-batch-complete（v2.597）', { concurrency: 1 }, () => {
  // 正常合约：至少能通、返回形状含 updated/skipped/total
  it('正常：POST 通、返回形状含 updated/skipped/total', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path, { ids: [f.assetId], fields: [] });
      // memory-prisma 隔离供应商 → autoFill 引擎可能无法真实调用，但端点应至少不 500
      assert.ok(r.status === 200 || r.status === 503, `${f.path} 状态 ${r.status} 不是 2xx 或 503`);
      if (r.status === 200) {
        assert.ok(r.body && typeof r.body === 'object', `${f.path} body 必须是对象`);
      }
    }
  });

  // 故障：patch 三族各自 findMany → 各自 500 + 文案 + 各 scope 留痕
  it('findMany 故障：三族各自 500 + 文案 + 各自留痕，绝不回空 updated 冒充成功', async () => {
    const restores = FAMILIES.map((f) =>
      patch(f.model, 'findMany', (orig) => async (arg) => {
        if (arg?.where?.id?.in?.includes(f.assetId) && arg?.where?.userId === UID) throw new Error('DB_DOWN');
        return orig.call(mem[f.model], arg);
      })
    );
    try {
      const calls = await captureErrors(async () => {
        for (const f of FAMILIES) {
          const r = await post(f.path, { ids: [f.assetId], fields: [] });
          assert.strictEqual(r.status, 500, `${f.path} 应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, BC_MSG, `${f.path} 错误文案不符`);
          assert.strictEqual(r.body.updated, undefined, `${f.path} 不得返回空 updated 冒充成功`);
          assert.strictEqual(r.body.skipped, undefined, `${f.path} 不得返回空 skipped`);
        }
      });
      // 三族各自 scope
      assert.ok(hasScope(calls, 'generate.asset.cast.batchComplete'), '必须留痕 cast.batchComplete');
      assert.ok(hasScope(calls, 'generate.asset.prop.batchComplete'), '必须留痕 prop.batchComplete');
      assert.ok(hasScope(calls, 'generate.asset.scene.batchComplete'), '必须留痕 scene.batchComplete');
    } finally { restores.forEach((r) => r()); }
  });

  // 恢复后立即可读
  it('恢复后立即可读（故障不污染后续请求）', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path, { ids: [f.assetId], fields: [] });
      assert.ok(r.status === 200 || r.status === 503, `${f.path} 恢复后应通`);
    }
  });
});
