/**
 * v2.595 资产看板（GET /api/generate/asset-dashboard）读取失败不得伪装成「空库」：
 * 旧实现两个 Promise.all 里 findMany `.catch(() => [])`、count `.catch(() => rows.length)`——
 * 数据库抖动时接口照常 200，整板显示「0 条资产、一切健康」（hotCast=[] / castStats.total=0 / conflicts=0），
 * L3 编导据此做出的资产化运营决策被误导，且服务端无日志无从重试。本用例锁定：
 *   1. 正常看板合约不变（hotCast/hotProp/hotScene/thinQueue/cold 三族/castStats/propStats/sceneStats 齐全）；
 *   2. findMany 阶段故障必须 500 + 可重试提示 + 留痕 generate.asset.dashboard.list，绝不回空板；
 *   3. count 阶段故障同样 500 + 留痕 generate.asset.dashboard.count，不得用 rows.length 静默兜底；
 *   4. 恢复后立即可读。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'alt-secret';
process.env.JWT_REFRESH_SECRET = 'alt-refresh';
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

const UID = 'u_dash';
const DASH_MSG = '资产看板加载失败，请重试';

before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  mem._seedUser({ id: UID, level: 'BASIC', balance: 0 });
  // 三族各 seed 一条，让看板有真实数据（usedCount 默认 0，score 函数对最小字段可用——与 list/health 端点同口径）
  await post('/api/generate/character-assets', { name: '林昭', persona: '外冷内热的刑警' });
  await post('/api/generate/prop-assets', { name: '铜怀表', meaning: '父亲遗物' });
  await post('/api/generate/scene-assets', { name: '老宅祠堂', meaning: '家产争夺的主线舞台', mood: '森严压抑' });
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

async function get(path) {
  const resp = await fetch(base + path, { headers: { Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` } });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}
async function post(path, body) {
  const resp = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` },
    body: JSON.stringify(body),
  });
  return resp.json();
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

describe('资产看板读取真实性·asset-dashboard（v2.595）', { concurrency: 1 }, () => {
  it('正常看板：合约不变，返回三族榜单/队列/健康总览齐全', async () => {
    const r = await get('/api/generate/asset-dashboard?lang=zh');
    assert.strictEqual(r.status, 200);
    for (const k of ['hotCast', 'hotProp', 'hotScene', 'thinQueue', 'coldCast', 'coldProp', 'coldScene', 'castStats', 'propStats', 'sceneStats']) {
      assert.ok(r.body[k] !== undefined, `看板必须返回 ${k}`);
    }
    // 三族各 1 条 → top10 榜单各 1 条，castStats.total 真实计数 = 1
    assert.strictEqual(r.body.hotCast.length, 1);
    assert.strictEqual(r.body.hotProp.length, 1);
    assert.strictEqual(r.body.hotScene.length, 1);
    assert.strictEqual(r.body.castStats.total, 1);
    assert.strictEqual(r.body.propStats.total, 1);
    assert.strictEqual(r.body.sceneStats.total, 1);
  });

  it('findMany 阶段故障：500 + 可重试提示 + 留痕，绝不回空板冒充成功', async () => {
    const restore = patch('characterAsset', 'findMany', (orig) => async (arg) => {
      if (arg?.where?.userId === UID) throw new Error('DB_DOWN');
      return orig.call(mem.characterAsset, arg);
    });
    try {
      const calls = await captureErrors(async () => {
        const r = await get('/api/generate/asset-dashboard?lang=zh');
        assert.strictEqual(r.status, 500, `应 500，实际 ${r.status}`);
        assert.strictEqual(r.body.error, DASH_MSG);
        assert.strictEqual(r.body.hotCast, undefined, '不得返回空 hotCast 冒充空库');
        assert.strictEqual(r.body.castStats, undefined, '不得返回空 castStats 冒充健康');
      });
      assert.ok(hasScope(calls, 'generate.asset.dashboard.list'), '必须留痕 generate.asset.dashboard.list');
    } finally { restore(); }
  });

  it('count 阶段故障：同样 500 + 留痕，不得用 rows.length 静默兜底', async () => {
    const restore = patch('characterAsset', 'count', (orig) => async (arg) => {
      if (arg?.where?.userId === UID) throw new Error('DB_DOWN');
      return orig.call(mem.characterAsset, arg);
    });
    try {
      const calls = await captureErrors(async () => {
        const r = await get('/api/generate/asset-dashboard?lang=zh');
        assert.strictEqual(r.status, 500, `应 500，实际 ${r.status}`);
        assert.strictEqual(r.body.error, DASH_MSG);
      });
      assert.ok(hasScope(calls, 'generate.asset.dashboard.count'), '必须留痕 generate.asset.dashboard.count');
    } finally { restore(); }
  });

  it('恢复后立即可读（故障不污染后续请求）', async () => {
    const r = await get('/api/generate/asset-dashboard?lang=zh');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.hotCast.length, 1);
    assert.strictEqual(r.body.castStats.total, 1);
  });
});
