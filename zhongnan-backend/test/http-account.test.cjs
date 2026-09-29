const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'acc-secret';
process.env.JWT_REFRESH_SECRET = 'acc-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createOrderRouter } = require('../dist/routes/order.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ auth: createAuthRouter(mem), order: createOrderRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'u1', level: 'BASIC', balance: 500, phone: '13800001111' });
const tok = signAccess({ sub: 'u1', level: 'BASIC' });

describe('账户资料 /me 与笔名修改', { concurrency: 1 }, () => {
  it('未登录 /me 401', async () => {
    const r = await fetch(base + '/api/auth/me');
    assert.strictEqual(r.status, 401);
  });
  it('登录后 /me 返回等级、积分、掩码手机号、存储用量', async () => {
    await mem.storageObject.create({ data: { userId: 'u1', kind: 'docx', bytes: 1000 } });
    await mem.storageObject.create({ data: { userId: 'u1', kind: 'pdf', bytes: 500 } });
    const r = await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${tok}` } });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.level, 'BASIC');
    assert.strictEqual(d.points.balance, 500);
    assert.strictEqual(d.phone, '138****1111');           // 手机号掩码，不回传全号
    assert.strictEqual(d.storageUsedBytes, 1500);
    assert.ok(d.benefits);                                // 带当前档权益
  });
  it('PATCH /profile 合法笔名成功', async () => {
    const r = await fetch(base + '/api/auth/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ penName: '终南_老杨', bio: '二十年影视老兵' }),
    });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.penName, '终南_老杨');
    const me = await (await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${tok}` } })).json();
    assert.strictEqual(me.penName, '终南_老杨');
  });
  it('非法笔名（含特殊符号/超长）400', async () => {
    const bad1 = await fetch(base + '/api/auth/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ penName: '<script>x' }),
    });
    assert.strictEqual(bad1.status, 400);
    const bad2 = await fetch(base + '/api/auth/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ penName: 'a'.repeat(21) }),
    });
    assert.strictEqual(bad2.status, 400);
  });
});

describe('商品目录 /order/catalog（价格只认服务端）', () => {
  it('无需登录可获取，含 SKU、四档权益、X剧本，金额来自服务端', async () => {
    const r = await fetch(base + '/api/order/catalog');
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    const skuMap = Object.fromEntries(d.items.map((i) => [i.sku, i]));
    assert.strictEqual(skuMap.BASIC_M.amountFen, 3900);       // 基础月卡 39 元
    assert.strictEqual(skuMap.BASIC_Y.amountFen, 36500);      // 基础年卡 365 元（v1.80补齐）
    assert.strictEqual(skuMap.ADVANCED_Y.amountYuan, 999);    // 高级年卡 999
    assert.strictEqual(skuMap.PT_199.points, 1990);           // 199元=1990积分
    assert.strictEqual(skuMap.PT_599.points, 6200);           // 599元=6200（赠3.5%）
    assert.strictEqual(skuMap.PT_1999.points, 22000);         // 1999元=22000（赠10.5%）
    assert.ok(!skuMap.PACK_100, '旧199元100集包已下架，避免与锚点冲突');
    assert.strictEqual(d.plans.length, 4);                    // 四档会员
    const pro = d.plans.find((p) => p.level === 'PRO');
    assert.strictEqual(pro.quotaMonthly, 1000);
    assert.ok(d.xScript && d.xScript.gating);                 // X剧本分级说明
    assert.strictEqual(d.pointsPerYuan, 10);
  });
});
