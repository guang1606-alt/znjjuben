const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ord-test-secret';
process.env.JWT_REFRESH_SECRET = 'ord-test-refresh';
delete process.env.WECHAT_API_V3_KEY; // 确保回调验签默认拒绝
const { createApp } = require('../dist/server/app.js');
const { createOrderRouter, createDeliver } = require('../dist/routes/order.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ order: createOrderRouter(mem) });
const deliver = createDeliver(mem);
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'buyer', level: 'FREE', balance: 0 });
mem._seedUser({ id: 'yearbuyer', level: 'FREE' });
mem._seedUser({ id: 'pointbuyer', level: 'FREE', balance: 0 });

async function create(uid, level, sku) {
  const headers = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer ${signAccess({ sub: uid, level })}`;
  const r = await fetch(base + '/api/order/create', { method: 'POST', headers, body: JSON.stringify({ sku }) });
  return { status: r.status, json: await r.json().catch(() => null) };
}

describe('订单下单-支付回调-发货-幂等 资金链路', { concurrency: 1 }, () => {
  it('未登录下单 401', async () => {
    const r = await create(null, null, 'BASIC_M');
    assert.strictEqual(r.status, 401);
  });
  it('非法/不存在 sku 400，金额只认服务端', async () => {
    const r1 = await create('buyer', 'FREE', 'HACK_999');
    assert.strictEqual(r1.status, 400);
  });
  it('年卡下单金额服务端锁定 2999 元、状态 PENDING', async () => {
    const r = await create('yearbuyer', 'FREE', 'PRO_Y');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.amountFen, 299900);
    const ord = mem._orders.find((o) => o.id === r.json.orderId);
    assert.strictEqual(ord.status, 'PENDING');
  });
  it('月卡支付发货：升级会员、写会员周期与支付流水；重复回调幂等不重复发货', async () => {
    const c = await create('buyer', 'FREE', 'BASIC_M');
    const r1 = await deliver(c.json.orderId, 'WX_TRADE_1');
    assert.strictEqual(r1.skipped, false);
    assert.strictEqual(mem._users.get('buyer').level, 'BASIC');
    assert.strictEqual(mem._memberships.filter((m) => m.orderId === c.json.orderId).length, 1);
    assert.strictEqual(mem._payments.length >= 1, true);
    assert.strictEqual(mem._orders.find((o) => o.id === c.json.orderId).status, 'PAID');
    const r2 = await deliver(c.json.orderId, 'WX_TRADE_1');
    assert.strictEqual(r2.skipped, true);
    assert.strictEqual(mem._memberships.filter((m) => m.orderId === c.json.orderId).length, 1, '重复回调不得重复发货');
  });
  it('年卡发货有效期≈12个月（修复年卡被误发成1个月的隐患）', async () => {
    const c = await create('yearbuyer', 'FREE', 'PRO_Y');
    await deliver(c.json.orderId, 'WX_TRADE_2');
    const ms = mem._memberships.find((m) => m.orderId === c.json.orderId);
    const days = (ms.expireAt.getTime() - Date.now()) / 864e5;
    assert.ok(days > 330 && days <= 366, `年卡应约360天，实际${days.toFixed(1)}天`);
    assert.strictEqual(mem._users.get('yearbuyer').level, 'PRO');
  });
  it('积分包发货：余额增加1990、写充值流水；重复回调不重复到账', async () => {
    const c = await create('pointbuyer', 'FREE', 'PT_199');
    await deliver(c.json.orderId, 'ZFB_TRADE_1');
    assert.strictEqual(mem._accounts.get('pointbuyer').balance, 1990);
    const inLedger = mem._ledgers.filter((l) => l.refId === c.json.orderId && l.direction === 'IN');
    assert.strictEqual(inLedger.length, 1);
    assert.strictEqual(inLedger[0].balanceAfter, 1990);
    await deliver(c.json.orderId, 'ZFB_TRADE_1');
    assert.strictEqual(mem._accounts.get('pointbuyer').balance, 1990, '重复回调不得重复加积分');
  });
  it('微信回调无有效验签一律 401（前端无法绕过支付直接发货）', async () => {
    const r = await fetch(base + '/api/order/notify/wechat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'TRANSACTION.SUCCESS', out_trade_no: 'x', transaction_id: 'y' }),
    });
    assert.strictEqual(r.status, 401);
  });
  it('发货不存在的订单抛 ORDER_NOT_FOUND', async () => {
    await assert.rejects(() => deliver('not_exist', 't'), /ORDER_NOT_FOUND/);
  });

  it('同等级续期：时长在原到期日上叠加，复用同一会员行不新增', async () => {
    const before = mem._memberships.find((m) => m.userId === 'buyer' && m.level === 'BASIC');
    assert.ok(before, '前置：buyer 已有 BASIC 月卡');
    const expireBefore = before.expireAt.getTime();
    const c = await create('buyer', 'BASIC', 'BASIC_M');
    await deliver(c.json.orderId, 'WX_TRADE_RENEW');
    const rows = mem._memberships.filter((m) => m.userId === 'buyer' && m.level === 'BASIC');
    assert.strictEqual(rows.length, 1, '续期必须更新同一行，不得新增会员行');
    assert.strictEqual(rows[0].id, before.id, '被更新的必须是原会员行');
    assert.strictEqual(rows[0].orderId, c.json.orderId);
    const added = rows[0].expireAt.getTime() - expireBefore;
    assert.ok(Math.abs(added - 30 * 864e5) < 5 * 60 * 1000, `月卡续期应+30天，实际+${(added / 864e5).toFixed(2)}天`);
    assert.strictEqual(mem._users.get('buyer').levelExpireAt.getTime(), rows[0].expireAt.getTime());
  });

  it('只升不降：PRO 有效期内买 BASIC 月卡，身份保持 PRO 不被降级', async () => {
    mem._seedUser({ id: 'prohold', level: 'PRO', balance: 0 });
    const proExpire = new Date(Date.now() + 100 * 864e5);
    mem._users.get('prohold').levelExpireAt = proExpire;
    await mem.membership.create({ data: { userId: 'prohold', level: 'PRO', expireAt: proExpire, quotaTotal: 999, orderId: 'oldpro' } });
    const c = await create('prohold', 'PRO', 'BASIC_M');
    await deliver(c.json.orderId, 'WX_TRADE_DOWNGRADE');
    const u = mem._users.get('prohold');
    assert.strictEqual(u.level, 'PRO', '高级会员有效期内购低档不得降级');
    assert.strictEqual(u.levelExpireAt.getTime(), proExpire.getTime(), 'PRO 到期时间不应被低档单改写');
  });

  it('高级会员已过期后买 BASIC：正常切换为 BASIC', async () => {
    mem._seedUser({ id: 'expiredpro', level: 'PRO', balance: 0 });
    mem._users.get('expiredpro').levelExpireAt = new Date(Date.now() - 864e5);
    await mem.membership.create({ data: { userId: 'expiredpro', level: 'PRO', expireAt: new Date(Date.now() - 864e5), quotaTotal: 999, orderId: 'oldpro2' } });
    const c = await create('expiredpro', 'PRO', 'BASIC_M');
    await deliver(c.json.orderId, 'WX_TRADE_EXPIRED');
    assert.strictEqual(mem._users.get('expiredpro').level, 'BASIC');
    const days = (mem._users.get('expiredpro').levelExpireAt.getTime() - Date.now()) / 864e5;
    assert.ok(days > 28 && days <= 31, `新月卡应约30天，实际${days.toFixed(1)}天`);
  });
});
