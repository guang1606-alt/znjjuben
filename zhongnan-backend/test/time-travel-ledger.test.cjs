// v2.80 穿越账本（Time-Travel Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/time-travel-ledger.js');

const cast = ['沈知远', '林棠', '赵烈'];

describe('v2.80 time-travel-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveTimeTravelRows('', cast), []);
  });
  test('无穿越动词返回空数组', () => {
    assert.deepEqual(M.deriveTimeTravelRows('沈知远和林棠站在一起。', cast), []);
  });
  test('穿越动词建立 traveled 行', () => {
    const rows = M.deriveTimeTravelRows('沈知远穿越到了古代。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, '沈知远');
    assert.ok(rows[0].traveled);
  });
  test('回归动词建立 returned 行', () => {
    const rows = M.deriveTimeTravelRows('沈知远回到了现代。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].returned);
  });
  test('原时间线动词建立 native 行', () => {
    const rows = M.deriveTimeTravelRows('沈知远回到了原本的世界。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].native);
  });
  test('同句多信号合并到同一人名', () => {
    const rows = M.deriveTimeTravelRows('沈知远穿越后回到现代。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].traveled);
    assert.ok(rows[0].returned);
  });
});

describe('v2.80 time-travel-ledger 跨集记账', () => {
  test('穿越后原时间线行动（无回归）= high time_travel_contradiction', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 2, name: '沈知远', traveled: false, returned: false, native: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'time_travel_contradiction');
  });
  test('穿越后回归再原时间线=无穿帮', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 2, name: '沈知远', traveled: false, returned: true, native: false },
      { ep: 3, name: '沈知远', traveled: false, returned: false, native: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('原时间线后穿越=合法', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: false, returned: false, native: true },
      { ep: 2, name: '沈知远', traveled: true, returned: false, native: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.traveled.length, 1);
  });
  test('同集穿越又回归又原时间线=不穿帮', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: true, native: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同人多次原时间线只报1次', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 2, name: '沈知远', traveled: false, returned: false, native: true },
      { ep: 3, name: '沈知远', traveled: false, returned: false, native: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多人互不干扰', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 1, name: '林棠', traveled: true, returned: false, native: false },
      { ep: 2, name: '沈知远', traveled: false, returned: false, native: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.ok(r.issues[0].evidence.includes('沈知远'));
  });
});

describe('v2.80 time-travel-ledger 输出', () => {
  test('当前已穿越名册正确', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 2, name: '林棠', traveled: true, returned: false, native: false },
    ], 2);
    assert.equal(r.traveled.length, 2);
  });
  test('回归后名册移除', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 2, name: '沈知远', traveled: false, returned: true, native: false },
    ], 2);
    assert.equal(r.traveled.length, 0);
  });
});

describe('v2.80 time-travel-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.timeTravelDirective([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含穿越警告', () => {
    const d = M.timeTravelDirective([
      { ep: 1, name: '沈知远', traveled: true, returned: false, native: false },
      { ep: 2, name: '沈知远', traveled: false, returned: false, native: true },
    ]);
    assert.ok(d.zh.includes('穿越'));
    assert.ok(d.en.includes('Time-Travel'));
  });
});

describe('v2.80 time-travel-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeTimeTravelRow({ ep: 3, name: 'A', traveled: true, returned: false, native: false });
    assert.equal(r.ep, 3);
    assert.equal(r.name, 'A');
    assert.ok(r.traveled);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeTimeTravelRow({ ep: 3 }), null);
  });
});

describe('v2.80 time-travel-ledger en 链路零中文', () => {
  test('traveled 检测', () => {
    const rows = M.deriveTimeTravelRows('Steve traveled through time.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Steve');
    assert.ok(rows[0].traveled);
  });
  test('returned 检测', () => {
    const rows = M.deriveTimeTravelRows('Steve returned to the present.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].returned);
  });
  test('native 检测', () => {
    const rows = M.deriveTimeTravelRows('Steve was back in his own time.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].native);
  });
  test('英文跨集穿越穿帮正确', () => {
    const r = M.timeTravelLedger([
      { ep: 1, name: 'Steve', traveled: true, returned: false, native: false },
      { ep: 2, name: 'Steve', traveled: false, returned: false, native: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
