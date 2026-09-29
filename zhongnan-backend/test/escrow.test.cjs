const test = require('node:test');
const assert = require('node:assert');
const { isEscrowDue, withinRefund, ESCROW_WINDOW_MS } = require('../dist/lib/escrow.js');

const H = 3600 * 1000;
test('托管到期判定：仅 ESCROW 且超24h 才自动放款', () => {
  const created = new Date(Date.now() - 25 * H);
  assert.strictEqual(isEscrowDue({ status: 'ESCROW', createdAt: created }), true);
  assert.strictEqual(isEscrowDue({ status: 'ESCROW', createdAt: new Date(Date.now() - 10 * H) }), false);
  assert.strictEqual(isEscrowDue({ status: 'SETTLED', createdAt: created }), false, '已放款不再处理');
  assert.strictEqual(isEscrowDue({ status: 'REFUNDED', createdAt: created }), false);
});

test('退款窗口与放款边界互补：24h内可退、超24h放款', () => {
  const t0 = Date.now() - 23 * H;
  assert.strictEqual(withinRefund(t0, Date.now()), true);
  const old = Date.now() - ESCROW_WINDOW_MS - H;
  assert.strictEqual(withinRefund(old, Date.now()), false);
  assert.strictEqual(isEscrowDue({ status: 'ESCROW', createdAt: new Date(old) }, Date.now()), true);
});
