const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'au-secret';
process.env.JWT_REFRESH_SECRET = 'au-refresh';
const { buildAssetUsageMap } = require('../dist/engine/asset-usage.js');
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 沙盘隔离：无供应商 → 零真实模型调用
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

async function jsonReq(method, path, uid, level) {
  const headers = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer ${signAccess({ sub: uid, level })}`;
  const resp = await fetch(base + path, { method, headers });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

// —— 引擎单元测试 ——
describe('资产引用统计引擎 buildAssetUsageMap', () => {
  it('空/非数组输入返回空映射', () => {
    assert.deepStrictEqual(buildAssetUsageMap([], 'castAssets'), {});
    assert.deepStrictEqual(buildAssetUsageMap(null, 'castAssets'), {});
    assert.deepStrictEqual(buildAssetUsageMap('x', 'propAssets'), {});
  });

  it('缺 id / 非字符串 id 快照跳过（按名字归账会误并同名档）；bible 缺键、null bible、脏行均安全跳过', () => {
    const projects = [
      { id: 'p1', title: 'A', status: 'DRAFT', bible: { castAssets: [{ name: '无id档' }, { id: 42, name: '非字符串id' }, null] } },
      { id: 'p2', bible: null },
      { id: 'p3', title: 'C', bible: {} },
      null,
      { id: '', title: '空id项目' },
    ];
    assert.deepStrictEqual(buildAssetUsageMap(projects, 'castAssets'), {});
  });

  it('多项目聚合：同 id 资产聚合为多条引用，字段裁剪为 projectId/projectTitle/status', () => {
    const projects = [
      { id: 'p1', title: '剧一', status: 'DRAFT', bible: { castAssets: [{ id: 'a1', name: '林昭' }] } },
      { id: 'p2', title: '剧二', status: 'COMPLETED', bible: { castAssets: [{ id: 'a1', name: '林昭' }, { id: 'a2', name: '陈默' }] } },
    ];
    const out = buildAssetUsageMap(projects, 'castAssets');
    assert.strictEqual(out.a1.length, 2, '同资产跨两剧聚合');
    assert.deepStrictEqual(out.a1[0], { projectId: 'p1', projectTitle: '剧一', status: 'DRAFT' });
    assert.deepStrictEqual(out.a1[1], { projectId: 'p2', projectTitle: '剧二', status: 'COMPLETED' });
    assert.deepStrictEqual(out.a2[0], { projectId: 'p2', projectTitle: '剧二', status: 'COMPLETED' });
  });

  it('族键隔离：castAssets 快照不记入 propAssets / sceneAssets', () => {
    const projects = [{ id: 'p1', title: 'T', status: 'DRAFT', bible: { castAssets: [{ id: 'a1' }] } }];
    assert.deepStrictEqual(buildAssetUsageMap(projects, 'propAssets'), {});
    assert.deepStrictEqual(buildAssetUsageMap(projects, 'sceneAssets'), {});
  });
});

// —— HTTP 三族端点（串行）——
describe('资产 usage 端点', { concurrency: 1 }, () => {
  it('三族 usage 返回实时引用明细（按 id 精确归账、无 id 快照跳过）；未登录 401', async () => {
    mem._seedUser({ id: 'u_usage', level: 'BASIC', balance: 100 });
    const cast = await mem.characterAsset.create({ data: { userId: 'u_usage', name: '林昭', persona: '刑警', usedCount: 1 } });
    const prop = await mem.propAsset.create({ data: { userId: 'u_usage', name: '玉佩', meaning: '认亲信物', usedCount: 1 } });
    const scene = await mem.sceneAsset.create({ data: { userId: 'u_usage', name: '老宅', meaning: '主线舞台', usedCount: 1 } });
    await mem.project.create({ data: { userId: 'u_usage', title: '旧案', status: 'DRAFT', bible: { castAssets: [{ id: cast.id, name: '林昭' }], propAssets: [{ id: prop.id, name: '玉佩' }], sceneAssets: [{ id: scene.id, name: '老宅' }] } } });
    // 第二项目：同一角色资产再次引用（聚合为 2 条）+ 一条无 id 的历史脏道具快照（应跳过）
    await mem.project.create({ data: { userId: 'u_usage', title: '新案', status: 'COMPLETED', bible: { castAssets: [{ id: cast.id, name: '林昭' }], propAssets: [{ name: '无名旧档' }] } } });

    const anon = await fetch(base + '/api/generate/character-assets/usage');
    assert.strictEqual(anon.status, 401);

    const cu = await jsonReq('GET', '/api/generate/character-assets/usage', 'u_usage', 'BASIC');
    assert.strictEqual(cu.status, 200);
    assert.strictEqual(cu.json.scannedProjects, 2);
    const castUsage = cu.json.usage[cast.id];
    assert.strictEqual(castUsage.length, 2, '同资产跨两剧聚合');
    assert.deepStrictEqual(new Set(castUsage.map(item => item.projectTitle)), new Set(['旧案', '新案']));
    assert.strictEqual(castUsage.find(item => item.projectTitle === '新案').status, 'COMPLETED');

    const pu = await jsonReq('GET', '/api/generate/prop-assets/usage', 'u_usage', 'BASIC');
    assert.strictEqual(pu.status, 200);
    assert.strictEqual(pu.json.usage[prop.id].length, 1);
    assert.strictEqual(pu.json.usage[prop.id][0].projectTitle, '旧案');
    assert.ok(!pu.json.usage[''], '无 id 快照不产生空键归账');

    const su = await jsonReq('GET', '/api/generate/scene-assets/usage', 'u_usage', 'BASIC');
    assert.strictEqual(su.status, 200);
    assert.strictEqual(su.json.usage[scene.id][0].projectTitle, '旧案');
    assert.strictEqual(su.json.usage[scene.id][0].status, 'DRAFT');
  });

  it('归属隔离：他人项目的引用不进我的 usage', async () => {
    mem._seedUser({ id: 'u_usage_b', level: 'BASIC', balance: 0 });
    const cast = await mem.characterAsset.create({ data: { userId: 'u_usage_b', name: '陈默', persona: 'B 的资产', usedCount: 0 } });
    await mem.project.create({ data: { userId: 'u_usage', title: '别人的剧', status: 'DRAFT', bible: { castAssets: [{ id: cast.id, name: '陈默' }] } } });
    const r = await jsonReq('GET', '/api/generate/character-assets/usage', 'u_usage_b', 'BASIC');
    assert.strictEqual(r.status, 200);
    assert.ok(!r.json.usage[cast.id], '他人项目引用不计入');
  });
});
