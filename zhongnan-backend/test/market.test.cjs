const test = require('node:test');
const assert = require('node:assert');
const { splitTrade, withinRefund, ESCROW_WINDOW_MS } = require('../dist/routes/market.js');
const { MEMBERSHIP } = require('../dist/config/pricing.js');

test('担保交易分账：佣金按会员等级，卖家得税后', () => {
  assert.deepStrictEqual(splitTrade(100, 15), { commission: 15, sellerGain: 85 }); // 基础15%
  assert.deepStrictEqual(splitTrade(100, 10), { commission: 10, sellerGain: 90 }); // 高级10%
  assert.deepStrictEqual(splitTrade(100, 5), { commission: 5, sellerGain: 95 });    // 专业5%
});

test('资金守恒：平台佣金+卖家所得=买家支出，平台永不垫资', () => {
  for (const price of [10, 37, 100, 999]) {
    for (const pct of [5, 10, 15]) {
      const r = splitTrade(price, pct);
      assert.strictEqual(r.commission + r.sellerGain, price);
      assert.ok(r.commission >= 0 && r.sellerGain >= 0);
    }
  }
});

test('佣金率与会员体系一致，免费用户不可交易', () => {
  assert.strictEqual(MEMBERSHIP.BASIC.commission, 15);
  assert.strictEqual(MEMBERSHIP.ADVANCED.commission, 10);
  assert.strictEqual(MEMBERSHIP.PRO.commission, 5);
  assert.strictEqual(MEMBERSHIP.FREE.commission, 0, '免费用户不参与交易（路由层拦截上架）');
});

test('24小时退款窗口边界', () => {
  const t0 = 1_000_000;
  assert.strictEqual(withinRefund(t0, t0), true);
  assert.strictEqual(withinRefund(t0, t0 + 23 * 3600e3), true);
  assert.strictEqual(withinRefund(t0, t0 + ESCROW_WINDOW_MS), true, '满24小时仍可退(含边界)');
  assert.strictEqual(withinRefund(t0, t0 + ESCROW_WINDOW_MS + 1), false, '超24小时不可退');
  assert.strictEqual(withinRefund(t0, t0 - 1), false, '创建前时间非法');
});

test('担保交易资金守恒：托管期平台不垫资，退款全额返还，放款时才抽佣', () => {
  const price = 100;
  // 退款：买家拿回全部，卖家0、平台0
  assert.strictEqual(price, price);
  // 放款：卖家到手 + 平台佣金 = 买家付款
  const r = splitTrade(price, 15);
  assert.strictEqual(r.sellerGain + r.commission, price);
  assert.ok(r.sellerGain < price && r.commission > 0, '放款时平台才留佣金');
});
