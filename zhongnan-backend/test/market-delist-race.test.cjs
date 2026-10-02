/**
 * v2.308 delist 竞态加固（TOCTOU）——先红后绿
 *
 * 缺口：market.ts 下架此前是「findUnique 读快照 → 判 ON_SHELF → 裸 update by id」。
 * 读取与写入之间存在窗口：买家购买事务（条件抢占 ON_SHELF→ESCROW）在该窗口内提交后，
 * 卖家裸 update 无条件把 ESCROW 翻成 OFF_SHELF —— 买家货款在托管、订单 ESCROW，
 * 商品却显示已下架；后续放款（escrow.ts:55 条件 ESCROW→SOLD）/退款（market.ts:330
 * 条件 ESCROW→ON_SHELF）的 listing 侧条件更新全部 count=0 落空，数据不再自洽。
 *
 * 修复：delist 改用与购买/退款/放款同族的条件抢占
 *   updateMany({ where: { id, status: 'ON_SHELF' } })，count=0 → 409。
 *
 * 确定性复现（不依赖真并发）：mock findUnique 返回竞态前的过期快照（ON_SHELF），
 * 实际行已是 ESCROW —— 等价于「读→写窗口内买家事务已提交」。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'dlr-secret';
process.env.JWT_REFRESH_SECRET = 'dlr-refresh';
const { createApp } = require('../dist/server/app.js');
const { createMarketRouter } = require('../dist/routes/market.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ market: createMarketRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const M = '/api/market';
mem._seedUser({ id: 'seller', level: 'PRO' });
const H = (uid, level) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });

/** 把 listing 的 findUnique 包装成返回过期快照（仅对指定 id 生效） */
function staleSnapshot(id, staleStatus) {
  const real = mem.listing.findUnique.bind(mem.listing);
  mem.listing.findUnique = async (args) => {
    const row = await real(args);
    if (row && args?.where?.id === id && row.id === id) return { ...row, status: staleStatus };
    return row;
  };
  return () => { mem.listing.findUnique = real; };
}

describe('v2.308 delist 竞态：读到 ON_SHELF 后买家已抢占 ESCROW', { concurrency: 1 }, () => {
  it('竞态窗口内买家已抢到 → delist 必须 409 且商品保持 ESCROW（不得被裸写翻下架）', async () => {
    await mem.listing.create({ data: { id: 'ls_race', sellerId: 'seller', scriptId: 'sr', title: '竞态剧', priceFen: 3000, sample: 'x', commissionPct: 5, status: 'ESCROW' } });
    const restore = staleSnapshot('ls_race', 'ON_SHELF'); // 路由读到过期 ON_SHELF，实际已 ESCROW
    try {
      const r = await fetch(base + M + '/listings/ls_race/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
      assert.strictEqual(r.status, 409, '竞态下 delist 必须 409（条件抢占落空），实际=' + r.status);
    } finally { restore(); }
    const row = await mem.listing.findUnique({ where: { id: 'ls_race' } });
    assert.strictEqual(row.status, 'ESCROW', '托管中商品不得被下架裸写翻转');
  });

  it('对照：真实在售商品正常下架仍 200（条件抢占不得误伤正常流）', async () => {
    await mem.listing.create({ data: { id: 'ls_ok', sellerId: 'seller', scriptId: 'so', title: '正常剧', priceFen: 3000, sample: 'x', commissionPct: 5, status: 'ON_SHELF' } });
    const r = await fetch(base + M + '/listings/ls_ok/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 200);
    const row = await mem.listing.findUnique({ where: { id: 'ls_ok' } });
    assert.strictEqual(row.status, 'OFF_SHELF');
  });

  it('对照：托管中商品直接 delist（无快照污染）仍 409（前置状态检查保留）', async () => {
    await mem.listing.create({ data: { id: 'ls_esc', sellerId: 'seller', scriptId: 'se', title: '托管剧', priceFen: 3000, sample: 'x', commissionPct: 5, status: 'ESCROW' } });
    const r = await fetch(base + M + '/listings/ls_esc/delist', { method: 'PATCH', headers: H('seller', 'PRO') });
    assert.strictEqual(r.status, 409);
    const row = await mem.listing.findUnique({ where: { id: 'ls_esc' } });
    assert.strictEqual(row.status, 'ESCROW');
  });
});
