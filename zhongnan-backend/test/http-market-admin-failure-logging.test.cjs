/**
 * v2.570 资金写路径 5xx 失败留痕：
 * 交易广场的「购买 / 放款 / 退款」与后台「积分调账」在未知异常下此前只回中文兜底文案，
 * 服务端不留任何日志——生产上一旦账务出问题，排障时无从定位（资金不可观测）。
 * 本用例锁定：用户可见文案保持不变，同时 console.error 必须带 scope 留痕。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'mk-fl-secret';
process.env.JWT_REFRESH_SECRET = 'mk-fl-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { createAdminRouter } = require('../dist/routes/admin.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

/** 捕获 console.error，返回 { logs, restore } */
function captureErrors() {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args); };
  return { logs, restore: () => { console.error = orig; } };
}

describe('v2.570 资金写路径失败留痕（文案不变 + 日志落地）', { concurrency: 1 }, () => {
  const mem = createMemoryPrisma();
  const app = createApp({ market: createMarketRouter(mem), admin: createAdminRouter(mem) });
  let base;
  const server = app.listen(0);
  before(() => new Promise((res) => {
    const done = () => { base = `http://127.0.0.1:${server.address().port}`; res(); };
    if (server.listening) return done();
    server.once('listening', done);
  }));
  after(async () => {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
  });

  mem._seedUser({ id: 'seller', level: 'PRO' });
  mem._seedUser({ id: 'buyer', level: 'BASIC', balance: 500 });
  mem._seedUser({ id: 'adm', phone: '18891995171', level: 'FREE' });
  mem._seedUser({ id: 'target', level: 'BASIC', balance: 10 });

  const H = (uid, level = 'BASIC') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
  const post = (path, body, h) => fetch(base + path, { method: 'POST', headers: h, body: JSON.stringify(body ?? {}) });

  async function seedListing(id, title) {
    await mem.project.create({ data: { id: `pj_${id}`, userId: 'seller', title } });
    await mem.script.create({ data: { id, projectId: `pj_${id}`, epNo: 1, version: 1, title, content: `【${title}】第一集正文` } });
    const r = await post('/api/market/listings', { scriptId: id, priceFen: 1000 }, H('seller', 'PRO'));
    assert.strictEqual(r.status, 200);
    return (await r.json()).id;
  }

  it('购买：事务未知异常 → 500 支付失败，已取消 + [market.buy] 留痕', async () => {
    const lid = await seedListing('fk1', '异常购买');
    const orig = mem.$transaction;
    const cap = captureErrors();
    mem.$transaction = async () => { throw new Error('boom-buy'); };
    try {
      const r = await post(`/api/market/listings/${lid}/buy`, {}, H('buyer'));
      assert.strictEqual(r.status, 500);
      assert.strictEqual((await r.json()).error, '支付失败，已取消');
      assert.ok(cap.logs.some((l) => String(l[0]).includes('market.buy')), `应留痕 market.buy，实际：${JSON.stringify(cap.logs)}`);
    } finally {
      mem.$transaction = orig;
      cap.restore();
    }
  });

  it('放款：结算异常 → 500 放款失败，请重试 + [market.settle] 留痕', async () => {
    const lid = await seedListing('fk2', '异常放款');
    const buy = await post(`/api/market/listings/${lid}/buy`, {}, H('buyer'));
    assert.strictEqual(buy.status, 200);
    const pid = (await buy.json()).purchaseId;
    const orig = mem.$transaction;
    const cap = captureErrors();
    mem.$transaction = async () => { throw new Error('boom-settle'); };
    try {
      const r = await post(`/api/market/purchases/${pid}/confirm`, {}, H('buyer'));
      assert.strictEqual(r.status, 500);
      assert.strictEqual((await r.json()).error, '放款失败，请重试');
      assert.ok(cap.logs.some((l) => String(l[0]).includes('market.settle')), `应留痕 market.settle，实际：${JSON.stringify(cap.logs)}`);
    } finally {
      mem.$transaction = orig;
      cap.restore();
    }
  });

  it('退款：事务未知异常 → 500 退款失败，请重试 + [market.refund] 留痕', async () => {
    const lid = await seedListing('fk3', '异常退款');
    const buy = await post(`/api/market/listings/${lid}/buy`, {}, H('buyer'));
    assert.strictEqual(buy.status, 200);
    const pid = (await buy.json()).purchaseId;
    const orig = mem.$transaction;
    const cap = captureErrors();
    mem.$transaction = async () => { throw new Error('boom-refund'); };
    try {
      const r = await post(`/api/market/purchases/${pid}/refund`, {}, H('buyer'));
      assert.strictEqual(r.status, 500);
      assert.strictEqual((await r.json()).error, '退款失败，请重试');
      assert.ok(cap.logs.some((l) => String(l[0]).includes('market.refund')), `应留痕 market.refund，实际：${JSON.stringify(cap.logs)}`);
    } finally {
      mem.$transaction = orig;
      cap.restore();
    }
  });

  it('后台调账：事务未知异常 → 500 积分调整失败 + [admin.adjust] 留痕', async () => {
    const orig = mem.$transaction;
    const cap = captureErrors();
    mem.$transaction = async () => { throw new Error('boom-admin'); };
    try {
      const r = await post('/api/admin/users/target/points', { delta: 10, reason: '故障注入' }, H('adm', 'FREE'));
      assert.strictEqual(r.status, 500);
      assert.strictEqual((await r.json()).error, '积分调整失败');
      assert.ok(cap.logs.some((l) => String(l[0]).includes('admin.adjust')), `应留痕 admin.adjust，实际：${JSON.stringify(cap.logs)}`);
    } finally {
      mem.$transaction = orig;
      cap.restore();
    }
  });
});
