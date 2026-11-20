/**
 * v2.621 消费限额结算失败必须保留原始异常
 *
 * 证伪背景：spend-limit.settleModelSpend 的 catch 直接 `throw new Error('MODEL_SPEND_LIMIT_UNAVAILABLE ...')`，
 * 原始异常（Prisma 事务失败 / 连接池耗尽 / 行锁超时）被整体丢弃。结算失败意味着资金台账没落平，
 * 线上只能看到统一话术，无法判断是数据库故障还是数据异常，事后对账也没有入口。
 * 本文件锁定：对外抛出的错误语义与话术完全不变，但必须先写入 [spend.settle] 且携带原始异常。
 */
const test = require('node:test');
const assert = require('node:assert');
const { settleModelSpend } = require('../dist/lib/spend-limit.js');

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ err: null, r, logs }), (err) => ({ err, logs }))
    .finally(() => { console.error = orig; });
}

const boomDb = {
  $transaction: async () => { throw new Error('SPEND_SETTLE_DB_DOWN_V2621'); },
};
const okDb = {
  $transaction: async (fn) => fn({ modelSpendBudget: { update: async () => ({}) } }),
};

test('结算事务失败：对外话术不变，但必须写入 [spend.settle] 且带原始异常', async () => {
  const { err, logs } = await captureErr(() => settleModelSpend(
    { prisma: boomDb, reserveFen: 100, keyId: null }, 100,
  ));
  assert.ok(err instanceof Error);
  assert.match(err.message, /^MODEL_SPEND_LIMIT_UNAVAILABLE/, '对外错误码与话术必须保持不变');
  assert.ok(
    logs.some((l) => l.includes('[spend.settle]') && l.includes('SPEND_SETTLE_DB_DOWN_V2621')),
    '结算失败必须保留原始异常，否则资金台账不平无从归因',
  );
});

test('结算成功与空预留不得产生 [spend.settle] 噪音', async () => {
  const ok = await captureErr(() => settleModelSpend({ prisma: okDb, reserveFen: 100, keyId: null }, 100));
  assert.strictEqual(ok.err, null);
  assert.ok(!ok.logs.some((l) => l.includes('[spend.settle]')), '正常结算不应写降级日志');

  const none = await captureErr(() => settleModelSpend(null, 0));
  assert.strictEqual(none.err, null);
  assert.ok(!none.logs.some((l) => l.includes('[spend.settle]')), '未预留时直接返回，不应写日志');
});
