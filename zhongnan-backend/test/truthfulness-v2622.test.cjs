/**
 * v2.622 托管批量放款的单笔失败必须留下可排障的痕迹
 *
 * 证伪背景：settleDueEscrows 单笔 catch 用 `console.error('[escrow] settle failed', p.id, (e as Error).message)`
 * 只打 message：① 丢掉堆栈，Prisma 事务失败/行锁超时/序列化冲突无法定位到具体调用点；
 * ② 非 Error 抛出（字符串、对象）时 message 为 undefined，日志只剩订单号；
 * ③ 未走统一 logInternal，scope 与全仓 [模块.动作] 规范不一致，日志检索/告警规则漏收。
 * 放款失败意味着卖家回款被卡住，是本仓最需要可归因的资金路径之一。
 * 本文件锁定：批量继续（不阻断整批）、计入失败不计数，但每条失败必须带 scope + 订单号 + 原始堆栈。
 */
const test = require('node:test');
const assert = require('node:assert');
const { settleDueEscrows } = require('../dist/lib/escrow.js');

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => (a instanceof Error && a.stack ? a.stack : String(a))).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ r, logs }))
    .finally(() => { console.error = orig; });
}

const due = {
  id: 'pu_v2622', buyerId: 'u_buyer', sellerId: 'u_seller', listingId: 'ls_1',
  status: 'ESCROW', sellerGainPoints: 100, commissionPoints: 10,
  createdAt: new Date(Date.now() - 25 * 3600 * 1000),
};

function dbWith(list, fail) {
  return {
    purchase: { findMany: async () => list },
    $transaction: async () => { throw fail; },
  };
}

test('单笔放款事务失败：整批不中断，且日志必须带 escrow.settle 作用域、订单号与原始堆栈', async () => {
  const boom = new Error('ESCROW_TX_BOOM_V2622');
  const { r: settled, logs } = await captureErr(() => settleDueEscrows(Date.now(), dbWith([due], boom)));
  assert.strictEqual(settled, 0, '失败单不计入放款笔数');
  const hit = logs.find((l) => l.includes('escrow.settle'));
  assert.ok(hit, '必须走统一 logInternal 作用域，否则告警规则检索不到');
  assert.ok(hit.includes('pu_v2622'), '必须带订单号，否则无法定位是哪笔回款被卡');
  assert.ok(hit.includes('ESCROW_TX_BOOM_V2622') && hit.includes('\n    at '), '必须保留原始异常与堆栈');
});

test('非 Error 抛出同样要留下原始值，不能只剩 undefined', async () => {
  const { logs } = await captureErr(() => settleDueEscrows(Date.now(), dbWith([due], 'ESCROW_STRING_BOOM_V2622')));
  const hit = logs.find((l) => l.includes('escrow.settle'));
  assert.ok(hit && hit.includes('ESCROW_STRING_BOOM_V2622'), '非 Error 抛出必须原样留痕');
});

test('无到期订单或全部成功时不得产生 escrow.settle 噪音', async () => {
  const { r: none, logs } = await captureErr(() => settleDueEscrows(Date.now(), dbWith([], new Error('unused'))));
  assert.strictEqual(none, 0);
  assert.ok(!logs.some((l) => l.includes('escrow.settle')), '空批不应写失败日志');
});
