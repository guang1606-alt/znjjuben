/**
 * v2.606 三族资产删除入口：读失败不得伪装成「资产不存在」。
 *
 * 先证伪：`DELETE /api/generate/{character,prop,scene}-assets/:id` 的
 * `findUnique(...).catch(() => null as any)`——DB 抖动时 row=null → 404 `*_ASSET_NOT_FOUND`，
 * 编导以为资产已被删（实际只是读失败）；同行 `delete` 早已在 v2.584 改为如实 500，读路径却漏了。
 * 修复：读失败 → 500「资产加载失败，请重试」+ 留痕；真不存在/越权仍 404（防越权探测语义不变）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2606-secret';
process.env.JWT_REFRESH_SECRET = 'v2606-refresh';
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

const UID = 'u_v2606';
const OTHER = 'u_v2606_other';
before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  mem._seedUser({ id: OTHER, level: 'BASIC', balance: 0 });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const H = { Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` };
async function del(path, uid = UID) {
  const r = await fetch(base + path, { method: 'DELETE', headers: { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return () => { console.error = orig; return calls; };
}
function patchThrow(model, method) {
  const orig = mem[model][method];
  mem[model][method] = async () => { throw new Error('DB_DOWN'); };
  return () => { mem[model][method] = orig; };
}

const FAMILIES = [
  { key: 'cast', model: 'characterAsset', code: 'CAST_ASSET_NOT_FOUND', kind: 'character' },
  { key: 'prop', model: 'propAsset', code: 'PROP_ASSET_NOT_FOUND', kind: 'prop' },
  { key: 'scene', model: 'sceneAsset', code: 'SCENE_ASSET_NOT_FOUND', kind: 'scene' },
];

describe('v2.606 资产删除入口真实性', { concurrency: 1 }, () => {
  it('1) 读失败 → 500「资产加载失败，请重试」+ 各自留痕，而不是 404 资产不存在', async () => {
    for (const f of FAMILIES) {
      const row = await mem[f.model].create({ data: { id: `${f.key}_v2606`, userId: UID, name: `测试${f.key}` } });
      assert.ok(row);
      const restore = patchThrow(f.model, 'findUnique');
      const stop = captureErrors();
      let r;
      try {
        r = await del(`/api/generate/${f.kind}-assets/${f.key}_v2606`);
      } finally {
        const calls = stop(); restore();
        assert.ok(calls.some((c) => c.includes(`[generate.asset.${f.key}.delete.lookup]`)),
          `${f.key} 应留痕 delete.lookup；实际：${calls.join(' | ')}`);
      }
      assert.strictEqual(r.status, 500, `${f.key} 读故障应 500，实际 ${r.status}`);
      assert.deepStrictEqual(r.body, { error: '资产加载失败，请重试' });
    }
  });

  it('2) 真不存在仍 404（防越权探测语义不变）', async () => {
    for (const f of FAMILIES) {
      const r = await del(`/api/generate/${f.kind}-assets/no_such_${f.key}`);
      assert.strictEqual(r.status, 404);
      assert.deepStrictEqual(r.body, { error: f.code });
    }
  });

  it('3) 越权删除仍 404（不泄露存在性）', async () => {
    for (const f of FAMILIES) {
      await mem[f.model].create({ data: { id: `${f.key}_v2606_own`, userId: OTHER, name: `他人${f.key}` } });
      const r = await del(`/api/generate/${f.kind}-assets/${f.key}_v2606_own`);
      assert.strictEqual(r.status, 404, `${f.key} 越权应 404`);
      assert.deepStrictEqual(r.body, { error: f.code });
    }
  });

  it('4) 恢复后删除成功', async () => {
    for (const f of FAMILIES) {
      const r = await del(`/api/generate/${f.kind}-assets/${f.key}_v2606`);
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(r.body, { ok: true });
    }
  });
});
