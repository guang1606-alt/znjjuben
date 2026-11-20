/**
 * v2.594 三族资产库列表/体检读取失败不得伪装成「空库」：
 * 旧实现 findMany `.catch(() => [])`、count `.catch(() => rows.length)`——数据库抖动时接口照常 200，
 * 角色/道具/场景资产库凭空返回成空（assets=[]/total=0 或 items=[]/conflicts=[]），用户跨项目沉淀的付费资产
 * 看起来全部丢失，无从重试，服务端也无日志。本用例锁定三族 × 列表/体检共 6 端点：
 *   1. 正常读取合约不变（list 仍 {assets,total}，health 仍 {total,items,conflicts,...}）；
 *   2. findMany 故障必须 500 + 可重试提示 + 留痕，绝不回空库；
 *   3. count 故障同样 500，不得用 rows.length 静默兜底；
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

// 沙盘隔离：无供应商 → callText 走确定性兜底，零真实模型调用
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(async () => {
  await new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); }));
  for (const c of CASES) {
    mem._seedUser({ id: c.uid, level: 'BASIC', balance: 0 });
    for (const s of c.seed) await post(c.listPath, c.uid, s);
  }
});
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const CASES = [
  {
    type: 'character', model: 'characterAsset', uid: 'u_char',
    listPath: '/api/generate/character-assets', healthPath: '/api/generate/character-assets/health',
    listMsg: '角色资产库加载失败，请重试', healthMsg: '角色资产体检加载失败，请重试',
    seed: [{ name: '林昭', persona: '外冷内热的刑警' }, { name: '苏晚', persona: '冷静的法医' }],
  },
  {
    type: 'prop', model: 'propAsset', uid: 'u_prop',
    listPath: '/api/generate/prop-assets', healthPath: '/api/generate/prop-assets/health',
    listMsg: '道具资产库加载失败，请重试', healthMsg: '道具资产体检加载失败，请重试',
    seed: [{ name: '铜怀表', meaning: '父亲遗物' }, { name: '匿名信', meaning: '翻案线索' }],
  },
  {
    type: 'scene', model: 'sceneAsset', uid: 'u_scene',
    listPath: '/api/generate/scene-assets', healthPath: '/api/generate/scene-assets/health',
    listMsg: '场景资产库加载失败，请重试', healthMsg: '场景资产体检加载失败，请重试',
    seed: [{ name: '老宅祠堂', meaning: '家产争夺的主线舞台', mood: '森严压抑' }, { name: '医院天台', meaning: '情感锚点', mood: '开阔' }],
  },
];

async function get(path, uid) {
  const resp = await fetch(base + path, { headers: { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` } });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}
async function post(path, uid, body) {
  const resp = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` },
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

for (const c of CASES) {
  describe(`三族资产库读取真实性·${c.type}（v2.594）`, { concurrency: 1 }, () => {
    it('正常 list：合约不变，返回本人资产 + total', async () => {
      const r = await get(c.listPath, c.uid);
      assert.strictEqual(r.status, 200);
      assert.ok(Array.isArray(r.body.assets), 'list 必须返回 assets 数组');
      assert.strictEqual(r.body.assets.length, c.seed.length);
      assert.strictEqual(r.body.total, c.seed.length);
    });

    it('正常 health：合约不变，返回 items + conflicts + total', async () => {
      const r = await get(c.healthPath, c.uid);
      assert.strictEqual(r.status, 200);
      assert.ok(Array.isArray(r.body.items), 'health 必须返回 items 数组');
      assert.ok(Array.isArray(r.body.conflicts), 'health 必须返回 conflicts 数组');
      assert.strictEqual(r.body.total, c.seed.length);
      assert.strictEqual(r.body.items.length, c.seed.length);
    });

    it('list findMany 故障：500 + 可重试提示 + 留痕，绝不回空库', async () => {
      const restore = patch(c.model, 'findMany', (orig) => async (arg) => {
        if (arg?.where?.userId === c.uid) throw new Error('DB_DOWN');
        return orig.call(mem[c.model], arg);
      });
      try {
        const calls = await captureErrors(async () => {
          const r = await get(c.listPath, c.uid);
          assert.strictEqual(r.status, 500, `应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, c.listMsg);
          assert.strictEqual(r.body.assets, undefined, '不得返回空 assets 冒充空库');
          assert.strictEqual(r.body.total, undefined, '不得回 total');
        });
        assert.ok(hasScope(calls, `generate.asset.${c.type}.list`), '必须留痕 generate.asset.<type>.list');
      } finally { restore(); }
    });

    it('list count 故障：同样 500，不得用 rows.length 静默兜底', async () => {
      const restore = patch(c.model, 'count', (orig) => async (arg) => {
        if (arg?.where?.userId === c.uid) throw new Error('DB_DOWN');
        return orig.call(mem[c.model], arg);
      });
      try {
        const calls = await captureErrors(async () => {
          const r = await get(c.listPath, c.uid);
          assert.strictEqual(r.status, 500, `应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, c.listMsg);
        });
        assert.ok(hasScope(calls, `generate.asset.${c.type}.list`), 'count 故障也必须留痕');
      } finally { restore(); }
    });

    it('health findMany 故障：500 + 可重试提示 + 留痕，绝不回空 items/conflicts', async () => {
      const restore = patch(c.model, 'findMany', (orig) => async (arg) => {
        if (arg?.where?.userId === c.uid) throw new Error('DB_DOWN');
        return orig.call(mem[c.model], arg);
      });
      try {
        const calls = await captureErrors(async () => {
          const r = await get(c.healthPath, c.uid);
          assert.strictEqual(r.status, 500, `应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, c.healthMsg);
          assert.strictEqual(r.body.items, undefined, '不得返回空 items 冒充空库');
          assert.strictEqual(r.body.conflicts, undefined, '不得返回空 conflicts');
        });
        assert.ok(hasScope(calls, `generate.asset.${c.type}.health`), '必须留痕 generate.asset.<type>.health');
      } finally { restore(); }
    });

    it('health count 故障：同样 500，不得用 rows.length 静默兜底', async () => {
      const restore = patch(c.model, 'count', (orig) => async (arg) => {
        if (arg?.where?.userId === c.uid) throw new Error('DB_DOWN');
        return orig.call(mem[c.model], arg);
      });
      try {
        const calls = await captureErrors(async () => {
          const r = await get(c.healthPath, c.uid);
          assert.strictEqual(r.status, 500, `应 500，实际 ${r.status}`);
          assert.strictEqual(r.body.error, c.healthMsg);
        });
        assert.ok(hasScope(calls, `generate.asset.${c.type}.health`), 'count 故障也必须留痕');
      } finally { restore(); }
    });

    it('恢复后立即可读（故障不污染后续请求）', async () => {
      const rl = await get(c.listPath, c.uid);
      assert.strictEqual(rl.status, 200);
      assert.strictEqual(rl.body.assets.length, c.seed.length);
      const rh = await get(c.healthPath, c.uid);
      assert.strictEqual(rh.status, 200);
      assert.strictEqual(rh.body.items.length, c.seed.length);
    });
  });
}
