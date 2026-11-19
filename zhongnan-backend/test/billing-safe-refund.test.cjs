const { describe, it } = require('node:test');
const assert = require('node:assert');
const { safeRefund } = require('../dist/lib/billing.js');

describe('safeRefund：失败路径退款留痕', () => {
  it('退款失败：打结构化日志（scope/userId/key/refId/原因），且不向上抛', async () => {
    const logs = [];
    const orig = console.error;
    console.error = (...a) => { logs.push(a); };
    try {
      await safeRefund('room.pitch', 'u-1', 'PITCH_MEETING', 'ref-9', async () => { throw new Error('db down'); });
    } finally {
      console.error = orig;
    }
    assert.strictEqual(logs.length, 1, '失败必须且只留一条日志');
    const [msg, ctx] = logs[0];
    assert.match(String(msg), /room\.pitch/);
    assert.match(String(msg), /退款失败/);
    assert.deepStrictEqual(
      { userId: ctx.userId, key: ctx.key, refId: ctx.refId, error: ctx.error },
      { userId: 'u-1', key: 'PITCH_MEETING', refId: 'ref-9', error: 'db down' },
    );
  });

  it('退款成功：不写任何日志', async () => {
    const logs = [];
    const orig = console.error;
    console.error = (...a) => { logs.push(a); };
    try {
      await safeRefund('room.pitch', 'u-1', 'PITCH_MEETING', 'ref-9', async () => {});
    } finally {
      console.error = orig;
    }
    assert.strictEqual(logs.length, 0);
  });
});
