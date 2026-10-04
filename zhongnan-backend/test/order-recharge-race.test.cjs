const { describe, it } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'race-secret';
process.env.JWT_REFRESH_SECRET = 'race-refresh';
delete process.env.WECHAT_API_V3_KEY;
const { createDeliver } = require('../dist/routes/order.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// v2.314：积分发货读改写并发丢更新（Read Committed 裸事务无行锁，后写覆盖先写）
// 生产交错模型：A 事务读到旧余额、即将写时，B 事务完整提交；A 再整体落库 → B 的充值蒸发。
// 原子增量（UPDATE balance=balance+$1，语句级行锁）下，A 的写基于 B 已提交值，两笔都到账。
describe('积分充值并发交错（deliverPaidOrder 账户读改写）', { concurrency: 1 }, () => {
  it('两笔积分单并发回调：后发货的一笔不得覆盖先提交的一笔', async () => {
    const mem = createMemoryPrisma();
    const deliver = createDeliver(mem);
    mem._seedUser({ id: 'raceuser', level: 'FREE', balance: 100 });

    const mkPointsOrder = (n) =>
      mem.order.create({ data: { userId: 'raceuser', status: 'PENDING', kind: 'POINTS', amountFen: n * 100, points: n } });
    const [orderA, orderB] = await Promise.all([mkPointsOrder(1000), mkPointsOrder(2000)]);

    // 写屏障：A 的账户写「即将发生」时，先让 B 完整发货并提交，再放行 A 的写。
    // 旧实现：A 持旧读快照 100，写整体 balance=1100 → 覆盖 B 已提交的 2100（一笔充值蒸发）。
    // 原子增量：A 的 increment 基于存储现值 2100 → 3100，两笔都到账。
    let armed = true;
    const origUpdate = mem.pointsAccount.update.bind(mem.pointsAccount);
    mem.pointsAccount.update = async (args) => {
      if (armed) {
        armed = false;
        await deliver(orderB.id, 'RACE_B');
      }
      return origUpdate(args);
    };

    const rA = await deliver(orderA.id, 'RACE_A');
    assert.strictEqual(rA.skipped, false);

    assert.strictEqual(mem._accounts.get('raceuser').balance, 3100, '两笔充值必须全部到账，后写不得覆盖先写');
    assert.strictEqual(mem._orders.find((o) => o.id === orderA.id).status, 'PAID');
    assert.strictEqual(mem._orders.find((o) => o.id === orderB.id).status, 'PAID');
    const inLedgers = mem._ledgers
      .filter((l) => l.userId === 'raceuser' && l.direction === 'IN' && l.bucket === 'RECHARGE')
      .sort((a, b) => a.amount - b.amount);
    assert.strictEqual(inLedgers.length, 2, '两笔充值各写一条 IN 流水');
    // 按金额排序：B（2000）先提交，A（1000）在 B 已提交值上增量
    assert.strictEqual(inLedgers[0].amount, 1000);
    assert.strictEqual(inLedgers[1].amount, 2000);
    assert.strictEqual(inLedgers[1].balanceAfter, 2100, 'B（2000）先提交：100+2000=2100');
    assert.strictEqual(inLedgers[0].balanceAfter, 3100, 'A（1000）后提交：在 2100 基础上到 3100');
  });
});
