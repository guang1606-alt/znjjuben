const { describe, it } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'mrace-secret';
process.env.JWT_REFRESH_SECRET = 'mrace-refresh';
delete process.env.WECHAT_API_V3_KEY;
const { createDeliver } = require('../dist/routes/order.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// v2.315：会员发货身份写读改写并发破防「只升不降」。
// BASIC 月卡与 PRO 年卡两单并发回调：BASIC 已读过 FREE 通过等级判断、即将写身份时，
// PRO 单完整发货（写 PRO + ~390 天，因 BASIC 会员行已建，PRO 按跨等级叠加规则续在其后），
// 旧实现 BASIC 再无条件落库 → 身份降为 BASIC、到期时间砍到 ~30 天（付费年卡权益蒸发）。
// 条件写：where 带「已过期 或 当前等级≤新购等级阶梯」，PRO 在有效期内时 BASIC 落库 count=0 跳过。
describe('会员并发回调身份只升不降（deliverPaidOrder user 读改写）', { concurrency: 1 }, () => {
  it('低档单后写不得覆盖先提交的高档单：PRO 在有效期内 BASIC 跳过', async () => {
    const mem = createMemoryPrisma();
    const deliver = createDeliver(mem);
    mem._seedUser({ id: 'mrace', level: 'FREE' });

    const basicOrder = await mem.order.create({ data: { userId: 'mrace', status: 'PENDING', kind: 'MEMBER', level: 'BASIC', amountFen: 9900 } });
    const proOrder = await mem.order.create({ data: { userId: 'mrace', status: 'PENDING', kind: 'MEMBER', level: 'PRO', amountFen: 299900 } });

    // 写屏障：第一笔（BASIC）的身份写「即将发生」时，先让 PRO 单完整发货提交
    let armed = true;
    const runProThen = (orig) => async (args) => {
      if (armed) {
        armed = false;
        await deliver(proOrder.id, 'RACE_PRO');
      }
      return orig(args);
    };
    if (mem.user.update) mem.user.update = runProThen(mem.user.update.bind(mem.user));
    if (mem.user.updateMany) mem.user.updateMany = runProThen(mem.user.updateMany.bind(mem.user));

    await deliver(basicOrder.id, 'RACE_BASIC');

    const u = mem._users.get('mrace');
    assert.strictEqual(u.level, 'PRO', '高档单已提交后，低档单不得把身份降回去');
    const days = (new Date(u.levelExpireAt).getTime() - Date.now()) / 864e5;
    assert.ok(days > 385, `PRO 年卡应跨等级叠加在 BASIC 月卡之后 ≈390 天，实际 ${days.toFixed(1)} 天`);
    assert.strictEqual(mem._memberships.some((m) => m.userId === 'mrace' && m.level === 'PRO'), true);
    assert.strictEqual(mem._orders.find((o) => o.id === basicOrder.id).status, 'PAID');
    assert.strictEqual(mem._orders.find((o) => o.id === proOrder.id).status, 'PAID');
  });
});
