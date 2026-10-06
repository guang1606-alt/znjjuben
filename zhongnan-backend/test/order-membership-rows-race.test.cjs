const { describe, it } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'mrows-secret';
process.env.JWT_REFRESH_SECRET = 'mrows-refresh';
delete process.env.WECHAT_API_V3_KEY;
const { createDeliver } = require('../dist/routes/order.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { MEMBERSHIP } = require('../dist/config/pricing.js');

// v2.316：会员「行」层面两处并发（v2.315 只修了 user 身份写）。
//  ① 同档续期 expireAt 读改写：两单都读到 T、都写 T+周期，同 id 无条件覆盖 → 丢一个付费周期；
//  ② 无在保行时双 create：两单都查不到行 → 同档两条 active 行（额度重复计算/续费锚点歧义），
//     生产由部分唯一索引 (userId,level) WHERE expireAt>now() 兜底，应用须整事务回滚后重试走续期。
describe('会员行并发：续期不丢周期 / 无双在保行', { concurrency: 1 }, () => {
  it('① 同档两单并发续期：后写者锚定旧快照失败后重读最新值追加（~1080 天，不回退到 ~720）', async () => {
    const mem = createMemoryPrisma();
    const deliver = createDeliver(mem);
    mem._seedUser({ id: 'renewu', level: 'PRO' });
    const t0 = new Date(Date.now() + 360 * 864e5);
    mem._users.get('renewu').levelExpireAt = t0;
    mem._memberships.push({ id: 'ms_seed', userId: 'renewu', level: 'PRO', startedAt: new Date(), expireAt: t0, quotaTotal: 30, quotaUsed: 0, orderId: 'seed' });

    const a = await mem.order.create({ data: { userId: 'renewu', status: 'PENDING', kind: 'MEMBER', level: 'PRO', amountFen: MEMBERSHIP.PRO.yearlyFen } });
    const b = await mem.order.create({ data: { userId: 'renewu', status: 'PENDING', kind: 'MEMBER', level: 'PRO', amountFen: MEMBERSHIP.PRO.yearlyFen } });

    let armed = true;
    const orig = mem.membership.updateMany.bind(mem.membership);
    mem.membership.updateMany = async (args) => {
      if (armed) { armed = false; await deliver(b.id, 'RACE_B'); }
      return orig(args);
    };

    await deliver(a.id, 'RACE_A');

    const rows = mem._memberships.filter((m) => m.userId === 'renewu' && m.level === 'PRO' && new Date(m.expireAt) > new Date());
    assert.strictEqual(rows.length, 1, '始终只复用一条在保行');
    const days = (new Date(rows[0].expireAt).getTime() - Date.now()) / 864e5;
    assert.ok(days > 1060, `两笔年卡应在 360 天余期上叠加 720 天 ≈1080，实际 ${days.toFixed(1)}（旧码 ~720 吞一笔）`);
    const uDays = (new Date(mem._users.get('renewu').levelExpireAt).getTime() - Date.now()) / 864e5;
    assert.ok(uDays > 1060, `身份到期须与会员行一致 ≈1080，实际 ${uDays.toFixed(1)}（不得用读时预计算值）`);
    assert.strictEqual(mem._orders.find((o) => o.id === a.id).status, 'PAID');
    assert.strictEqual(mem._orders.find((o) => o.id === b.id).status, 'PAID');
  });

  it('② 无在保行同档两单并发：唯一冲突后整事务回滚重试，终态一行且时长为两单之和（~60 天）', async () => {
    const mem = createMemoryPrisma();
    const deliver = createDeliver(mem);
    mem._seedUser({ id: 'freshu', level: 'FREE' });

    const a = await mem.order.create({ data: { userId: 'freshu', status: 'PENDING', kind: 'MEMBER', level: 'BASIC', amountFen: MEMBERSHIP.BASIC.monthlyFen } });
    const b = await mem.order.create({ data: { userId: 'freshu', status: 'PENDING', kind: 'MEMBER', level: 'BASIC', amountFen: MEMBERSHIP.BASIC.monthlyFen } });

    let armed = true;
    const origCreate = mem.membership.create.bind(mem.membership);
    mem.membership.create = async (args) => {
      if (armed) { armed = false; await deliver(b.id, 'RACE_B'); }
      return origCreate(args);
    };

    await deliver(a.id, 'RACE_A'); // 旧码：P2002 直接冒泡 reject；新码：外层重试改走续期

    const rows = mem._memberships.filter((m) => m.userId === 'freshu' && m.level === 'BASIC' && new Date(m.expireAt) > new Date());
    assert.strictEqual(rows.length, 1, '同档在保行唯一，不得双 create');
    const days = (new Date(rows[0].expireAt).getTime() - Date.now()) / 864e5;
    assert.ok(days > 58, `两张月卡时长都应到账 ≈60 天，实际 ${days.toFixed(1)}`);
    assert.strictEqual(mem._orders.find((o) => o.id === a.id).status, 'PAID');
    assert.strictEqual(mem._orders.find((o) => o.id === b.id).status, 'PAID');
    assert.strictEqual(mem._payments.filter((p) => p.orderId === a.id).length, 1, 'A 回滚后重试只落一笔支付凭证');
    assert.strictEqual(mem._payments.filter((p) => p.orderId === b.id).length, 1);
  });
});
