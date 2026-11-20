/**
 * v2.604 写失败必须留痕，不得静默吞掉。
 *
 * 先证伪：
 *   1) 三族 batch-complete 的 `update(...).catch(() => null)`——写库失败只把该条计入 skipped『UPDATE_FAILED』，
 *     服务端零日志，线上无法定位是「字段已满」还是「DB 写失败」。
 *   2) 立项成功后三族资产 `updateMany(...).catch(() => null)`——引用计数自增失败完全无声，
 *     资产库 usedCount 与真实引用数长期漂移且无人知晓。
 * 修复：各自 try/catch + logInternal，业务行为（skipped 文案 / 项目创建成功）保持不变——非破坏性。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2604-secret';
process.env.JWT_REFRESH_SECRET = 'v2604-refresh';
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

const UID = 'u_v2604';
before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  await mem.characterAsset.create({ data: { id: 'ca_v2604', userId: UID, name: '林昭', persona: '刑警', visualAnchor: '', signatureLines: [], voice: '' } });
  await mem.propAsset.create({ data: { id: 'pa_v2604', userId: UID, name: '铜怀表', visualAnchor: '' } });
  await mem.sceneAsset.create({ data: { id: 'sa_v2604', userId: UID, name: '老宅祠堂', visualAnchor: '' } });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` };
async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.join(' ')); orig(...a); };
  return () => { console.error = orig; return calls; };
}
function patchThrow(model, method, msg = 'DB_DOWN') {
  const orig = mem[model][method];
  mem[model][method] = async () => { throw new Error(msg); };
  return () => { mem[model][method] = orig; };
}

const FAMILIES = [
  { key: 'cast', model: 'characterAsset', id: 'ca_v2604', path: '/api/generate/character-assets/batch-complete' },
  { key: 'prop', model: 'propAsset', id: 'pa_v2604', path: '/api/generate/prop-assets/batch-complete' },
  { key: 'scene', model: 'sceneAsset', id: 'sa_v2604', path: '/api/generate/scene-assets/batch-complete' },
];

describe('v2.604 写失败留痕', { concurrency: 1 }, () => {
  it('1) 三族 batch-complete 写库失败：仍回 200 + UPDATE_FAILED（合约不变）+ 各自留痕', async () => {
    for (const f of FAMILIES) {
      const restore = patchThrow(f.model, 'update');
      const stop = captureErrors();
      let r;
      try {
        r = await post(f.path, { ids: [f.id], patches: [{ id: f.id, patch: { visualAnchor: '冷光下的旧物' } }], fields: ['visualAnchor'] });
      } finally {
        const calls = stop(); restore();
        assert.ok(calls.some((c) => c.includes(`[generate.asset.${f.key}.batchComplete.write]`)),
          `${f.key} 应留痕 batchComplete.write；实际：${calls.join(' | ')}`);
      }
      assert.strictEqual(r.status, 200, `${f.key} 应 200`);
      assert.strictEqual(r.body.updated.length, 0, `${f.key} 不得谎报已更新`);
      assert.strictEqual(r.body.skipped[0]?.reason, 'UPDATE_FAILED', `${f.key} 应明示 UPDATE_FAILED`);
    }
  });

  it('2) 立项成功但三族引用计数自增失败：项目仍创建（非破坏）+ 各自留痕', async () => {
    const restores = FAMILIES.map((f) => patchThrow(f.model, 'updateMany'));
    const stop = captureErrors();
    let r;
    try {
      r = await post('/api/generate/projects', {
        title: '引用计数测试', mode: 'tags',
        castAssetIds: ['ca_v2604'], propAssetIds: ['pa_v2604'], sceneAssetIds: ['sa_v2604'],
      });
    } finally {
      const calls = stop(); restores.forEach((x) => x());
      for (const f of FAMILIES) {
        assert.ok(calls.some((c) => c.includes(`[generate.project.create.${f.key}-usedCount]`)),
          `${f.key} 应留痕 usedCount；实际：${calls.join(' | ')}`);
      }
    }
    assert.strictEqual(r.status, 200, '计数失败不得影响建项目');
    assert.ok(r.body?.id, '应返回新项目');
  });

  it('3) 恢复后 batch-complete 正常写入', async () => {
    for (const f of FAMILIES) {
      const r = await post(f.path, { ids: [f.id], patches: [{ id: f.id, patch: { visualAnchor: '冷光下的旧物' } }], fields: ['visualAnchor'] });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.updated.length, 1, `${f.key} 恢复后应真正写入`);
    }
  });
});
