const test = require('node:test');
const assert = require('node:assert');
const { InMemoryTx } = require('../dist/lib/memory-tx.js');

test('并发抢占最后1个赠送集：两次 takeQuota 只成功一次，绝不超发', async () => {
  const tx = new InMemoryTx();
  const [a, b] = await Promise.all([tx.takeQuota('ms1', 1), tx.takeQuota('ms1', 1)]);
  assert.strictEqual(a + b, 1, '总配额1时两个并发请求只能有1个成功');
  assert.ok(a === true || b === true);
});

test('赠送集用尽后再占被拒（quotaUsed 不超过 quotaTotal）', async () => {
  const tx = new InMemoryTx();
  assert.strictEqual(await tx.takeQuota('ms', 2), true);
  assert.strictEqual(await tx.takeQuota('ms', 2), true);
  assert.strictEqual(await tx.takeQuota('ms', 2), false);
});

test('生成中断/失败：takeQuota 后 returnQuota 精确退还，可再次占用且不出现负额度', async () => {
  const tx = new InMemoryTx();
  assert.strictEqual(await tx.takeQuota('ms', 1), true);
  await tx.returnQuota('ms'); // 模拟生成失败回滚赠送集
  assert.strictEqual(await tx.takeQuota('ms', 1), true, '退还后应能重新占用');
  // 没有占用时退还不应把额度减成负数（幂等保护）
  await tx.returnQuota('never');
  assert.strictEqual(await tx.takeQuota('never', 1), true);
});

test('不同会员的赠送额度互不串用', async () => {
  const tx = new InMemoryTx();
  assert.strictEqual(await tx.takeQuota('msA', 1), true);
  assert.strictEqual(await tx.takeQuota('msB', 1), true, 'B 的额度独立，不受 A 占用影响');
});
