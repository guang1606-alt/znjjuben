/**
 * v2.299 守护：市场交易全链路金钱守恒契约（dogfood 第三十七轮深审沉淀）。
 *
 * 深审结论：购买/确认/放款/退款四路径的幂等键、状态抢占、行锁、事务回滚均已闭环；
 * 本套件把"钱必须守恒"钉成契约——未来任何改动破坏守恒/幂等键约定即红。
 *
 * 契约内容：
 *  ① 成交路径守恒：买家扣 pricePoints = 卖家得 sellerGain + 平台佣金 commission；
 *     ledger 恰两笔（买家 BUY_HOLD OUT / 卖家 SCRIPT_SALE IN），balanceAfter 链正确。
 *  ② 退款路径守恒：买家全额退回，ledger 两笔净零；商品回 ON_SHELF，订单 REFUNDED。
 *  ③ 幂等键约定：buy:{buyer}:{listing} / refund:{purchaseId} / settle:{purchaseId} 全局唯一；
 *     重复确认 409 且 settle 流水不双写。
 *  ④ 不可复购契约：退款后买家再购同商品 409，且不产生第二笔扣款流水。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'market-ledger-test-secret';
process.env.JWT_REFRESH_SECRET = 'market-ledger-test-refresh';
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const H = (uid, level = 'BASIC') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const post = (uid, path, body, level = 'BASIC') => fetch(base + path, { method: 'POST', headers: H(uid, level), body: JSON.stringify(body ?? {}) });
const get = (uid, path) => fetch(base + path, { headers: H(uid) });

/** 造一个在售商品：卖家 + 项目 + 一集正文 + listing，返回 listing id */
async function seedListing(suffix, priceFen = 10000) {
  const sellerId = `u_sell_${suffix}`;
  mem._seedUser({ id: sellerId, level: 'BASIC' });
  await mem.project.create({ data: { id: `p_${suffix}`, userId: sellerId, title: `守恒剧本${suffix}`, status: 'active', tags: [] } });
  await mem.script.create({ data: { id: `s_${suffix}`, projectId: `p_${suffix}`, epNo: 1, title: '第1集', content: '守恒测试剧本正文。'.repeat(30) } });
  const listing = await mem.listing.create({ data: { sellerId, scriptId: `s_${suffix}`, title: `守恒剧本${suffix}`, priceFen, sample: '样章', commissionPct: 15 } });
  return { sellerId, listingId: listing.id };
}
const ledgersOf = async (uid) => await mem.ledgerEntry.findMany({ where: { userId: uid } });
const balanceOf = async (uid) => (await mem.pointsAccount.findUnique({ where: { userId: uid } }))?.balance;

describe('v2.299 市场交易金钱守恒契约', { concurrency: 1 }, () => {
  it('① 成交路径：买家扣1000=卖家得850+佣金150；ledger 恰两笔且 balanceAfter 正确', async () => {
    const { sellerId, listingId } = await seedListing('a', 10000); // 1000 积分
    mem._seedUser({ id: 'u_buy_a', level: 'BASIC', balance: 1000 });
    const buyR = await post('u_buy_a', `/api/market/listings/${listingId}/buy`);
    assert.strictEqual(buyR.status, 200, `购买应成功；实际 ${buyR.status}`);
    const { purchaseId } = await buyR.json();
    assert.strictEqual(await balanceOf('u_buy_a'), 0, '买家扣款后余额归零');
    const confirmR = await post('u_buy_a', `/api/market/purchases/${purchaseId}/confirm`);
    assert.strictEqual(confirmR.status, 200, `确认放款应成功；实际 ${confirmR.status}`);
    assert.strictEqual(await balanceOf(sellerId), 850, '卖家实得=1000×(1-15%)=850，佣金150由平台抽成');
    const purchase = await mem.purchase.findUnique({ where: { id: purchaseId } });
    assert.strictEqual(purchase.status, 'SETTLED');
    assert.strictEqual(purchase.pricePoints, 1000);
    assert.strictEqual(purchase.commissionPoints, 150, '佣金快照 150：卖家850+佣金150=买家1000 守恒');
    assert.strictEqual(purchase.sellerGainPoints, 850);
    const listing = await mem.listing.findUnique({ where: { id: listingId } });
    assert.strictEqual(listing.status, 'SOLD', '成交后商品必须 SOLD 终态');
    const bl = await ledgersOf('u_buy_a');
    assert.strictEqual(bl.length, 1, '买家仅一笔扣款流水');
    assert.strictEqual(bl[0].reason, 'BUY_HOLD');
    assert.strictEqual(bl[0].direction, 'OUT');
    assert.strictEqual(bl[0].amount, 1000);
    assert.strictEqual(bl[0].balanceAfter, 0);
    assert.strictEqual(bl[0].idempotencyKey, `buy:u_buy_a:${listingId}`, '购买幂等键约定 buy:{buyer}:{listing}');
    const sl = await ledgersOf(sellerId);
    assert.strictEqual(sl.length, 1, '卖家仅一笔放款流水');
    assert.strictEqual(sl[0].reason, 'SCRIPT_SALE');
    assert.strictEqual(sl[0].direction, 'IN');
    assert.strictEqual(sl[0].amount, 850);
    assert.strictEqual(sl[0].balanceAfter, 850);
    assert.strictEqual(sl[0].idempotencyKey, `settle:${purchaseId}`, '放款幂等键约定 settle:{purchaseId}');
  });

  it('② 退款路径：买家全额退回净零；商品回架；订单 REFUNDED；refund 幂等键唯一', async () => {
    const { sellerId, listingId } = await seedListing('b', 10000);
    mem._seedUser({ id: 'u_buy_b', level: 'BASIC', balance: 1000 });
    const buyR = await post('u_buy_b', `/api/market/listings/${listingId}/buy`);
    const { purchaseId } = await buyR.json();
    const refundR = await post('u_buy_b', `/api/market/purchases/${purchaseId}/refund`);
    assert.strictEqual(refundR.status, 200, `24h 内退款应成功；实际 ${refundR.status}`);
    assert.strictEqual(await balanceOf('u_buy_b'), 1000, '全额退款后买家余额复原');
    assert.strictEqual(await balanceOf(sellerId), 0, '退款路径卖家不得收到任何放款');
    const purchase = await mem.purchase.findUnique({ where: { id: purchaseId } });
    assert.strictEqual(purchase.status, 'REFUNDED');
    const listing = await mem.listing.findUnique({ where: { id: listingId } });
    assert.strictEqual(listing.status, 'ON_SHELF', '退款后商品必须重新上架');
    const bl = await ledgersOf('u_buy_b');
    assert.strictEqual(bl.length, 2, '退款路径买家恰两笔流水（扣+退）');
    const out = bl.find((l) => l.direction === 'OUT');
    const inn = bl.find((l) => l.direction === 'IN');
    assert.strictEqual(out.amount, 1000);
    assert.strictEqual(inn.amount, 1000, '退款金额必须等于扣款金额（全额）');
    assert.strictEqual(inn.reason, 'REFUND');
    assert.strictEqual(inn.balanceAfter, 1000);
    assert.strictEqual(inn.idempotencyKey, `refund:${purchaseId}`, '退款幂等键约定 refund:{purchaseId}');
    assert.strictEqual((await ledgersOf(sellerId)).length, 0, '退款路径卖家零流水');
  });

  it('③ 重复确认 409 且 settle 流水不双写（幂等键兜底）', async () => {
    const { sellerId, listingId } = await seedListing('c', 10000);
    mem._seedUser({ id: 'u_buy_c', level: 'BASIC', balance: 1000 });
    const buyR = await post('u_buy_c', `/api/market/listings/${listingId}/buy`);
    const { purchaseId } = await buyR.json();
    await post('u_buy_c', `/api/market/purchases/${purchaseId}/confirm`);
    const dup = await post('u_buy_c', `/api/market/purchases/${purchaseId}/confirm`);
    assert.strictEqual(dup.status, 409, 'SETTLED 后重复确认必须 409');
    assert.strictEqual((await ledgersOf(sellerId)).filter((l) => l.idempotencyKey === `settle:${purchaseId}`).length, 1, 'settle 流水全局唯一');
    assert.strictEqual(await balanceOf(sellerId), 850, '重复确认不得双放款');
  });

  it('④ 退款后不可复购：再购 409 且无第二笔扣款流水', async () => {
    const { listingId } = await seedListing('d', 10000);
    mem._seedUser({ id: 'u_buy_d', level: 'BASIC', balance: 2000 });
    const buyR = await post('u_buy_d', `/api/market/listings/${listingId}/buy`);
    const { purchaseId } = await buyR.json();
    await post('u_buy_d', `/api/market/purchases/${purchaseId}/refund`);
    const rebuy = await post('u_buy_d', `/api/market/listings/${listingId}/buy`);
    assert.strictEqual(rebuy.status, 409, '已退款买家不得复购同一剧本');
    const j = await rebuy.json();
    assert.match(j.error, /退款/, '提示语应说明退款不可复购');
    assert.strictEqual((await ledgersOf('u_buy_d')).filter((l) => l.direction === 'OUT').length, 1, '不得产生第二笔扣款');
    assert.strictEqual(await balanceOf('u_buy_d'), 2000, '余额不得因复购尝试变动');
  });

  it('⑤ 他人 confirm/refund 一律 404（订单归属闸），余额零变动', async () => {
    const { sellerId, listingId } = await seedListing('e', 10000);
    mem._seedUser({ id: 'u_buy_e', level: 'BASIC', balance: 1000 });
    mem._seedUser({ id: 'u_evil_e', level: 'BASIC', balance: 0 });
    const buyR = await post('u_buy_e', `/api/market/listings/${listingId}/buy`);
    const { purchaseId } = await buyR.json();
    const r1 = await post('u_evil_e', `/api/market/purchases/${purchaseId}/confirm`);
    const r2 = await post('u_evil_e', `/api/market/purchases/${purchaseId}/refund`);
    assert.strictEqual(r1.status, 404, '他人 confirm 必须 404');
    assert.strictEqual(r2.status, 404, '他人 refund 必须 404');
    assert.strictEqual(await balanceOf(sellerId), 0, '归属闸拦截后卖家不得被放款');
    assert.strictEqual(await balanceOf('u_buy_e'), 1000 - 1000, '买家仍处托管扣款态');
    const purchase = await mem.purchase.findUnique({ where: { id: purchaseId } });
    assert.strictEqual(purchase.status, 'ESCROW', '订单状态不得被他人翻动');
  });
});
