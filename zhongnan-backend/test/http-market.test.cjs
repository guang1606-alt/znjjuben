const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'mk-secret';
process.env.JWT_REFRESH_SECRET = 'mk-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'seller', level: 'PRO' });        // PRO 佣金 5%
mem._seedUser({ id: 'buyer', level: 'BASIC', balance: 500 });
mem._seedUser({ id: 'poor', level: 'BASIC', balance: 0 });
mem._seedUser({ id: 'free', level: 'FREE' });
const M = '/api/market';
const H = (uid, level = 'BASIC') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });
const post = (path, body, uid, level) => fetch(base + M + path, { method: 'POST', headers: H(uid, level), body: JSON.stringify(body ?? {}) });
const get = (path, uid) => fetch(base + M + path, uid ? { headers: H(uid) } : {});
const bal = (uid) => mem._accounts.get(uid).balance;

async function seedScript(id, title) {
  await mem.project.create({ data: { id: `pj_${id}`, userId: 'seller', title } });
  await mem.script.create({ data: { id, projectId: `pj_${id}`, epNo: 1, version: 1, title, content: `【${title}全本正文】第一集……第二集……` } });
}

describe('剧本交易广场·担保交易状态机 HTTP 闭环', { concurrency: 1 }, () => {
  it('免费用户上架 403；价格低于1元 400；剧本不存在 404', async () => {
    const r403 = await post('/listings', { scriptId: 'x', priceFen: 1000 }, 'free', 'FREE');
    assert.strictEqual(r403.status, 403);
    await seedScript('s1', '逆袭之王');
    const r400 = await post('/listings', { scriptId: 's1', priceFen: 50 }, 'seller', 'PRO');
    assert.strictEqual(r400.status, 400);
    const r404 = await post('/listings', { scriptId: 'nope', priceFen: 1000 }, 'seller', 'PRO');
    assert.strictEqual(r404.status, 404);
  });
  it('PRO 上架成功，佣金率 5%；列表只给样章并换算积分价', async () => {
    const r = await post('/listings', { scriptId: 's1', priceFen: 1000, sample: '样章：她推开门……' }, 'seller', 'PRO');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.commissionPct, 5);
    const list = (await (await fetch(base + M + '/listings')).json()).items;
    assert.ok(list.length >= 1);
    const row = list.find((l) => l.id === j.id);
    assert.strictEqual(row.pricePoints, 100); // 1000分=10元=100积分
    assert.ok(!('fullText' in row) || row.fullText === undefined);
  });
  it('买家付款→托管扣款、解锁全本、进入 ESCROW；不能买自己/重复购买', async () => {
    const lid = mem._listings[0].id;
    const self = await post(`/listings/${lid}/buy`, {}, 'seller', 'PRO');
    assert.strictEqual(self.status, 400);
    const before = bal('buyer');
    const r = await post(`/listings/${lid}/buy`, {}, 'buyer');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.escrow, true);
    assert.strictEqual(j.spentPoints, 100);
    assert.match(j.fullText, /全本正文/); // 付款即解锁全本
    assert.ok(j.purchaseId, '购买响应必须回带 purchaseId，供确认/退款'); // v1.44
    assert.strictEqual(bal('buyer'), before - 100);
    assert.strictEqual(mem._listings[0].status, 'ESCROW');
    const again = await post(`/listings/${lid}/buy`, {}, 'buyer');
    assert.strictEqual(again.status, 409);
  });
  it('确认收货→放款给卖家(扣5%佣金)、订单SETTLED、商品SOLD；重复确认409；非本人404', async () => {
    const pid = mem._purchases[0].id;
    const sellerBefore = bal('seller');
    const r = await post(`/purchases/${pid}/confirm`, {}, 'buyer');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.sellerGainPoints, 95); // 100-5佣金
    assert.strictEqual(j.platformCommission, 5);
    assert.strictEqual(bal('seller'), sellerBefore + 95);
    assert.strictEqual(mem._purchases[0].status, 'SETTLED');
    assert.strictEqual(mem._listings[0].status, 'SOLD');
    const again = await post(`/purchases/${pid}/confirm`, {}, 'buyer');
    assert.strictEqual(again.status, 409);
    const other = await post(`/purchases/${pid}/confirm`, {}, 'poor');
    assert.strictEqual(other.status, 404);
  });
  it('24h内退款：全额退买家、订单REFUNDED、商品重新上架、退款后不可复购', async () => {
    await seedScript('s2', '隐婚甜妻');
    const lid = (await (await post('/listings', { scriptId: 's2', priceFen: 2000, sample: '样' }, 'seller', 'PRO')).json()).id;
    await post(`/listings/${lid}/buy`, {}, 'buyer');
    const pid = mem._purchases.find((p) => p.listingId === lid).id;
    const before = bal('buyer');
    const r = await post(`/purchases/${pid}/refund`, {}, 'buyer');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.refundPoints, 200);
    assert.strictEqual(bal('buyer'), before + 200);
    assert.strictEqual(mem._purchases.find((p) => p.id === pid).status, 'REFUNDED');
    assert.strictEqual(mem._listings.find((l) => l.id === lid).status, 'ON_SHELF');
    const rebuy = await post(`/listings/${lid}/buy`, {}, 'buyer');
    assert.strictEqual(rebuy.status, 409, '退款后不可复购');
  });
  it('超过24h退款窗口 409（货款已打给卖家）', async () => {
    await seedScript('s3', '过期订单');
    const lid = (await (await post('/listings', { scriptId: 's3', priceFen: 1000 }, 'seller', 'PRO')).json()).id;
    await post(`/listings/${lid}/buy`, {}, 'buyer');
    const pu = mem._purchases.find((p) => p.listingId === lid);
    pu.createdAt = new Date(Date.now() - 25 * 3600 * 1000); // 25小时前
    const r = await post(`/purchases/${pu.id}/refund`, {}, 'buyer');
    assert.strictEqual(r.status, 409);
  });
  it('余额不足购买 402 且商品自动回上架（不锁死库存）', async () => {
    await seedScript('s4', '买不起的本');
    const lid = (await (await post('/listings', { scriptId: 's4', priceFen: 1000 }, 'seller', 'PRO')).json()).id;
    const r = await post(`/listings/${lid}/buy`, {}, 'poor');
    assert.strictEqual(r.status, 402);
    assert.strictEqual(mem._listings.find((l) => l.id === lid).status, 'ON_SHELF');
  });
  it('付款交付每集最新正文，已购可重取；结算后仍可读，退款及越权不可读', async () => {
    await mem.project.create({ data: { id: 'pj_multi', userId: 'seller', title: '多集测试' } });
    await mem.script.create({ data: { id: 'multi_1_old', projectId: 'pj_multi', epNo: 1, version: 1, title: '第一集', content: '旧版正文' } });
    await mem.script.create({ data: { id: 'multi_1_new', projectId: 'pj_multi', epNo: 1, version: 2, title: '第一集', content: '新版正文' } });
    await mem.script.create({ data: { id: 'multi_2', projectId: 'pj_multi', epNo: 2, version: 1, title: '第二集', content: '第二集正文' } });
    const lid = (await (await post('/listings', { projectId: 'pj_multi', priceFen: 1000 }, 'seller', 'PRO')).json()).id;
    const bought = await post(`/listings/${lid}/buy`, {}, 'buyer');
    assert.strictEqual(bought.status, 200);
    const payload = await bought.json();
    assert.strictEqual(payload.episodes.length, 2);
    assert.deepStrictEqual(payload.episodes.map((e) => e.epNo), [1, 2]);
    assert.match(payload.fullText, /新版正文/);
    assert.match(payload.fullText, /第二集正文/);
    assert.doesNotMatch(payload.fullText, /旧版正文/);

    const path = `/purchases/${payload.purchaseId}/content`;
    assert.strictEqual((await get(path)).status, 401);
    assert.strictEqual((await get(path, 'seller')).status, 404);
    assert.strictEqual((await get(path, 'poor')).status, 404);
    await mem.script.create({ data: { projectId: 'pj_multi', epNo: 1, version: 3, title: '第一集', content: '付款后改写的正文' } });
    const reopened = await get(path, 'buyer');
    assert.strictEqual(reopened.status, 200);
    assert.strictEqual((await reopened.json()).fullText, payload.fullText);
    const sellerOrders = await (await get('/my', 'seller')).json();
    const buyerOrders = await (await get('/my', 'buyer')).json();
    for (const row of [...sellerOrders.sales, ...buyerOrders.buys]) {
      assert.ok(!('contentSnapshot' in row) && !('fullText' in row));
    }
    assert.strictEqual((await post(`/purchases/${payload.purchaseId}/confirm`, {}, 'buyer')).status, 200);
    const settled = await get(path, 'buyer');
    assert.strictEqual(settled.status, 200);
    assert.strictEqual((await settled.json()).status, 'SETTLED');

    await seedScript('refund_access', '退款访问');
    const refundListing = (await (await post('/listings', { scriptId: 'refund_access', priceFen: 1000 }, 'seller', 'PRO')).json()).id;
    const refundBuy = await (await post(`/listings/${refundListing}/buy`, {}, 'buyer')).json();
    const refundPath = `/purchases/${refundBuy.purchaseId}/content`;
    assert.strictEqual((await get(refundPath, 'buyer')).status, 200);
    assert.strictEqual((await post(`/purchases/${refundBuy.purchaseId}/refund`, {}, 'buyer')).status, 200);
    assert.strictEqual((await get(refundPath, 'buyer')).status, 404);
  });
  it('最新稿为空时不回退出售旧稿，且不扣款、不生成订单', async () => {
    await seedScript('empty_latest', '空稿');
    await mem.script.create({ data: { projectId: 'pj_empty_latest', epNo: 1, version: 2, title: '空稿新版', content: '  ' } });
    const lid = (await (await post('/listings', { scriptId: 'empty_latest', priceFen: 1000 }, 'seller', 'PRO')).json()).id;
    const before = bal('buyer');
    const r = await post(`/listings/${lid}/buy`, {}, 'buyer');
    assert.strictEqual(r.status, 409);
    assert.strictEqual(bal('buyer'), before);
    assert.strictEqual(mem._listings.find((l) => l.id === lid).status, 'ON_SHELF');
    assert.ok(!mem._purchases.some((p) => p.listingId === lid));
  });
});

describe('资方视角评估 /investor-lens（免费只读·无需登录）', () => {
  it('空输入 400；正常梗概返回四维/结论/必问清单', async () => {
    const empty = await fetch(base + M + '/investor-lens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '' }) });
    assert.strictEqual(empty.status, 400);
    const r = await fetch(base + M + '/investor-lens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '重生复仇爆款对标红果，封闭场景少量演员成本可控，分账投流回本，前3秒强钩子高能切片付费卡点，人设逻辑自洽', tags: ['重生', '复仇'] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.dimensions.length, 4);
    assert.ok(['STRONG', 'TALK', 'CAUTION', 'PASS'].includes(j.verdict));
    assert.ok(j.funderQuestions.length >= 8);
    assert.ok(typeof j.oneLiner === 'string' && j.oneLiner.includes('资方视角综合'));
  });
});
