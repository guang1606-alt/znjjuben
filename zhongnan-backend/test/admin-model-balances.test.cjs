const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'am-bal-secret';
process.env.JWT_REFRESH_SECRET = 'am-bal-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

// 超管主账号（手机号硬判定）+ 副管理员 + 普通用户
mem._seedUser({ id: 'admin1', phone: '18891995171', level: 'PRO', isAdmin: false });
mem._seedUser({ id: 'subadm', phone: '13000000009', level: 'PRO', isAdmin: true });
mem._seedUser({ id: 'u_norm', level: 'BASIC' });

const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const get = async (p, uid, level) => { const r = await fetch(base + p, { headers: uid ? H(uid, level) : {} }); return { s: r.status, j: await r.json().catch(() => null) }; };
const post = async (p, uid, level, body) => { const r = await fetch(base + p, { method: 'POST', headers: H(uid, level), body: JSON.stringify(body || {}) }); return { s: r.status, j: await r.json().catch(() => null) }; };

// 通过 PUT /providers 直接写一个 deepseek provider（绕过 saveProvider 路径直接落库；用 maskProviders 路径）
async function seedProvider(name, baseUrl, apiKey, model = 'deepseek-v4') {
  const r = await fetch(base + '/api/admin/model/providers', {
    method: 'PUT', headers: H('admin1', 'PRO'),
    body: JSON.stringify({ name, modality: 'text', baseUrl, apiKey, model, inYuanPerMTok: 1, outYuanPerMTok: 2, enabled: true }),
  });
  const j = await r.json();
  return j.masked.providers.find((p) => p.name === name);
}

describe('v2.612 供应商余额监控（仅超管）', { concurrency: 1 }, () => {
  let savedFetch;
  beforeEach(() => { savedFetch = global.fetch; global.fetch = async (url, opts) => {
    // 仅当 url 是 deepseek/moonshot 时走 mock；其他 fetch（本地服务）保留原 fetch
    if (typeof url === 'string' && (url.includes('api.deepseek.com') || url.includes('api.moonshot.cn'))) {
      return global.__probeRoute ? global.__probeRoute(url, opts) : { ok: true, status: 200, async text() { return '{}'; } };
    }
    return savedFetch(url, opts);
  }; });
  afterEach(() => { global.fetch = savedFetch; global.__probeRoute = null; });

  it('未登录 GET /balances → 401', async () => {
    const { s } = await get('/api/admin/model/balances');
    assert.strictEqual(s, 401);
  });

  it('普通用户 GET /balances → 403', async () => {
    const { s } = await get('/api/admin/model/balances', 'u_norm', 'BASIC');
    assert.strictEqual(s, 403);
  });

  it('副管理员 GET /balances → 403 needSuperAdmin', async () => {
    const { s, j } = await get('/api/admin/model/balances', 'subadm', 'PRO');
    assert.strictEqual(s, 403);
    assert.strictEqual(j.needSuperAdmin, true);
  });

  it('超管 GET /balances 空列表：summary.worstLevel=NORMAL，missing 含未配置的供应商', async () => {
    const pv = await seedProvider('DeepSeek-主', 'https://api.deepseek.com/v1', 'sk-deepseek-x', 'deepseek-v4');
    const { s, j } = await get('/api/admin/model/balances', 'admin1', 'PRO');
    assert.strictEqual(s, 200);
    assert.deepStrictEqual(j.balances, []);
    assert.strictEqual(j.summary.worstLevel, 'NORMAL');
    assert.ok(j.missing.length >= 1);
    const ds = j.missing.find((m) => m.vendor === 'deepseek');
    assert.ok(ds && ds.strategy.auto === true, 'deepseek 应可自动查询');
  });

  it('超管 POST /balances/:providerId 手动填值 → 落库 source=MANUAL，alertLevel=CRITICAL', async () => {
    const pv = await seedProvider('DeepSeek-手填', 'https://api.deepseek.com/v1', 'sk-deepseek-y');
    const { s, j } = await post('/api/admin/model/balances/' + pv.id, 'admin1', 'PRO', { balanceYuan: 1, thresholdYuan: 5, note: '充值前快照' });
    assert.strictEqual(s, 200);
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.balance.source, 'MANUAL');
    assert.strictEqual(j.balance.alertLevel, 'CRITICAL');
    assert.strictEqual(j.balance.balanceYuan, 1);

    const g = await get('/api/admin/model/balances', 'admin1', 'PRO');
    assert.strictEqual(g.s, 200);
    assert.ok(g.j.balances.some((b) => b.providerId === pv.id && b.alertLevel === 'CRITICAL'));
    assert.strictEqual(g.j.summary.worstLevel, 'CRITICAL');
  });

  it('POST /balances/:providerId 缺 balanceYuan → 400', async () => {
    const r = await post('/api/admin/model/balances/pv_x', 'admin1', 'PRO', { thresholdYuan: 5 });
    assert.strictEqual(r.s, 400);
  });

  it('POST /balances/:providerId 不存在的 provider → 404', async () => {
    const r = await post('/api/admin/model/balances/pv_not_exist', 'admin1', 'PRO', { balanceYuan: 100 });
    assert.strictEqual(r.s, 404);
  });

  it('超管 POST /balances/refresh：mock deepseek 自动查询成功；其余厂商跳过 manual', async () => {
    // mock deepseek 返回 100 元
    global.__probeRoute = (url) => {
      if (url.includes('api.deepseek.com/user/balance')) {
        return { ok: true, status: 200, async text() { return JSON.stringify({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '100' }] }); } };
      }
      return { ok: true, status: 200, async text() { return '{}'; } };
    };
    const ds = await seedProvider('DeepSeek-自动', 'https://api.deepseek.com/v1', 'sk-deepseek-auto');
    const vol = await seedProvider('火山-手动', 'https://ark.cn/v1', 'sk-volc-xxx', 'doubao-pro');
    const { s, j } = await post('/api/admin/model/balances/refresh', 'admin1', 'PRO');
    assert.strictEqual(s, 200);
    assert.strictEqual(j.ok, true);
    const dsR = j.results.find((r) => r.providerId === ds.id);
    assert.ok(dsR, '应有 deepseek 结果');
    assert.strictEqual(dsR.balanceYuan, 100);
    assert.strictEqual(dsR.alertLevel, 'NORMAL'); // 100 > 2×5=10
    const volR = j.results.find((r) => r.providerId === vol.id);
    assert.ok(volR && volR.skipped === true, 'volcengine 应被跳过');
    assert.strictEqual(volR.reason, 'manual');
  });

  it('副管 POST /balances/refresh → 403', async () => {
    const { s } = await post('/api/admin/model/balances/refresh', 'subadm', 'PRO');
    assert.strictEqual(s, 403);
  });
});
