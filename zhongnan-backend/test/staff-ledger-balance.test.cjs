/**
 * v2.574 内部账户 0 元流水的余额快照必须真实
 * 旧实现 `tx.getAccount(userId).catch(() => null)` 把数据库读失败伪装成「无账户」，
 * 流水落 balanceAfter=0 与事实不符（对账时误判余额归零）。现改为读失败即让事务回滚，绝不留错账。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { staffChargeTx, staffRefundTx } = require('../dist/lib/staff-billing.js');

function fakeTx({ balance = null, failRead = false } = {}) {
  const written = [];
  return {
    written,
    raw: { ledgerEntry: { findMany: async () => [] } },
    ledgerExists: async () => false,
    getAccount: async () => {
      if (failRead) throw new Error('db read fail');
      return balance == null ? null : { balance };
    },
    writeLedger: async (row) => { written.push(row); },
  };
}

describe('内部账户流水余额快照（v2.574）', { concurrency: 1 }, () => {
  it('扣费流水记录真实余额：balanceAfter = 账户余额', async () => {
    const tx = fakeTx({ balance: 250 });
    const r = await staffChargeTx(tx, 'staff-1', 'ref-1', 'staff-va');
    assert.strictEqual(r.charged, true);
    assert.strictEqual(tx.written.length, 1);
    assert.strictEqual(tx.written[0].balanceAfter, 250);
  });

  it('账户读取失败：扣费整体失败，不写 balanceAfter=0 的假流水', async () => {
    const tx = fakeTx({ failRead: true });
    await assert.rejects(() => staffChargeTx(tx, 'staff-1', 'ref-1', 'staff-va'), /db read fail/);
    assert.strictEqual(tx.written.length, 0, '读失败不得落任何流水');
  });

  it('退款流水记录真实余额：balanceAfter = 账户余额', async () => {
    const tx = fakeTx({ balance: 88 });
    await staffRefundTx(tx, 'staff-1', 'ref-1', 'staff-va:ref-1:a1');
    assert.strictEqual(tx.written.length, 1);
    assert.strictEqual(tx.written[0].balanceAfter, 88);
    assert.strictEqual(tx.written[0].reason, 'STAFF_FREE:REFUND');
  });

  it('退款时账户读取失败：整体失败，不留错账', async () => {
    const tx = fakeTx({ failRead: true });
    await assert.rejects(() => staffRefundTx(tx, 'staff-1', 'ref-1', 'staff-va:ref-1:a1'), /db read fail/);
    assert.strictEqual(tx.written.length, 0);
  });
});
