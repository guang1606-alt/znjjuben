// 金钱核心逻辑自动化测试：node --test test/billing.test.cjs（build 后运行）
const test = require('node:test');
const assert = require('node:assert');
const { freeze, settle, unfreeze, grantBonus, consumeValueAdded, BillingError } = require('../dist/lib/billing');
const { InMemoryTx } = require('../dist/lib/memory-tx');
const { assertNoLoss, episodePoints, MemberLevel, EngineTier, MEMBERSHIP } = require('../dist/config/pricing');

test('冻结后余额减少、冻结额增加', async () => {
  const tx = new InMemoryTx(); tx.seed('u', 100);
  await freeze(tx, 'u', 10, 't1', 'k1');
  assert.deepStrictEqual(tx.dump('u').account, { balance: 90, frozen: 10, bonusGranted: 0 });
});

test('成功结算：冻结额被扣掉、不退回', async () => {
  const tx = new InMemoryTx(); tx.seed('u', 100);
  await freeze(tx, 'u', 10, 't1', 'k1');
  await settle(tx, 'u', 10, 't1', 'k2');
  const a = tx.dump('u').account;
  assert.strictEqual(a.balance, 90);
  assert.strictEqual(a.frozen, 0);
});

test('失败解冻：余额全额退回，用户不损失', async () => {
  const tx = new InMemoryTx(); tx.seed('u', 100);
  await freeze(tx, 'u', 10, 't1', 'k1');
  await unfreeze(tx, 'u', 10, 't1', 'k2');
  assert.deepStrictEqual(tx.dump('u').account, { balance: 100, frozen: 0, bonusGranted: 0 });
});

test('幂等：同一请求重复冻结只扣一次（防重试多扣）', async () => {
  const tx = new InMemoryTx(); tx.seed('u', 100);
  await freeze(tx, 'u', 10, 't1', 'same');
  await freeze(tx, 'u', 10, 't1', 'same');
  assert.strictEqual(tx.dump('u').account.balance, 90);
});

test('余额不足抛 INSUFFICIENT', async () => {
  const tx = new InMemoryTx(); tx.seed('u', 5);
  await assert.rejects(() => freeze(tx, 'u', 10, 't', 'k'), (e) => e.code === 'INSUFFICIENT');
});

test('赠送上限：累计超过300分拒绝（补贴不超支）', async () => {
  const tx = new InMemoryTx(); tx.seed('u', 0);
  await grantBonus(tx, 'u', 200, 'r1', 'g1');
  await assert.rejects(() => grantBonus(tx, 'u', 200, 'r2', 'g2'), (e) => e.code === 'BONUS_CAP');
});

test('不赔钱铁律：全站定价无一项 售价<成本×2', () => {
  assert.deepStrictEqual(assertNoLoss(), []);
});

test('最终定价v1.31：经济档对齐锚点 基础1元/高级0.8元/专业0.5元，旗舰不破成本×2', () => {
  assert.strictEqual(episodePoints(MemberLevel.BASIC, EngineTier.ECONOMY), 10);
  assert.strictEqual(episodePoints(MemberLevel.ADVANCED, EngineTier.ECONOMY), 8);
  assert.strictEqual(episodePoints(MemberLevel.PRO, EngineTier.ECONOMY), 5);
  assert.strictEqual(episodePoints(MemberLevel.BASIC, EngineTier.STANDARD), 15);
  assert.strictEqual(episodePoints(MemberLevel.ADVANCED, EngineTier.FLAGSHIP), 28);
  assert.strictEqual(episodePoints(MemberLevel.PRO, EngineTier.FLAGSHIP), 24);
  // 免费档零售、越权组合
  assert.strictEqual(episodePoints(MemberLevel.FREE, EngineTier.ECONOMY), 12);
  assert.strictEqual(episodePoints(MemberLevel.FREE, EngineTier.FLAGSHIP), 0);
  // 锚点：基础经济档100集=1000积分=100元
  const { ANCHOR_PACKAGE } = require('../dist/config/pricing');
  assert.strictEqual(ANCHOR_PACKAGE.episodes * episodePoints(MemberLevel.BASIC, EngineTier.ECONOMY), ANCHOR_PACKAGE.points);
  assert.strictEqual(ANCHOR_PACKAGE.points, 1000);
  // 月费对齐制式：39/99/299 元；赠送集数 高级300/专业1000
  assert.strictEqual(MEMBERSHIP.BASIC.monthlyFen, 3900);
  assert.strictEqual(MEMBERSHIP.ADVANCED.monthlyFen, 9900);
  assert.strictEqual(MEMBERSHIP.PRO.monthlyFen, 29900);
  assert.strictEqual(MEMBERSHIP.ADVANCED.quotaMonthly, 300);
  assert.strictEqual(MEMBERSHIP.PRO.quotaMonthly, 1000);
});

test('免费档无权标准/旗舰（由会员engines约束）', () => {
  assert.deepStrictEqual(MEMBERSHIP.FREE.engines, ['ECONOMY']);
});
