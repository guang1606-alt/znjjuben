// v2.80 诅咒账本（Curse Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/curse-ledger.js');

const cast = ['沈知远', '林棠', '赵烈'];

describe('v2.80 curse-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveCurseRows('', cast), []);
  });
  test('无诅咒动词返回空数组', () => {
    assert.deepEqual(M.deriveCurseRows('沈知远和林棠站在一起。', cast), []);
  });
  test('中咒动词建立 cursed 行', () => {
    const rows = M.deriveCurseRows('沈知远被诅咒了。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, '沈知远');
    assert.ok(rows[0].cursed);
  });
  test('解除动词建立 lifted 行', () => {
    const rows = M.deriveCurseRows('沈知远的诅咒被解除了。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].lifted);
  });
  test('不受影响动词建立 unaffected 行', () => {
    const rows = M.deriveCurseRows('沈知远安然无恙。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].unaffected);
  });
  test('同句多信号合并到同一人名', () => {
    const rows = M.deriveCurseRows('沈知远被诅咒却安然无恙。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].cursed);
    assert.ok(rows[0].unaffected);
  });
});

describe('v2.80 curse-ledger 跨集记账', () => {
  test('中咒后不受影响（无解除）= high curse_contradiction', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '沈知远', cursed: false, lifted: false, unaffected: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'curse_contradiction');
  });
  test('中咒后解除再不受影响=无穿帮', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '沈知远', cursed: false, lifted: true, unaffected: false },
      { ep: 3, name: '沈知远', cursed: false, lifted: false, unaffected: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('不受影响后中咒=合法', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: false, lifted: false, unaffected: true },
      { ep: 2, name: '沈知远', cursed: true, lifted: false, unaffected: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.cursed.length, 1);
  });
  test('同集中咒又解除又不受影响=不穿帮', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: true, unaffected: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同人多次不受影响只报1次', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '沈知远', cursed: false, lifted: false, unaffected: true },
      { ep: 3, name: '沈知远', cursed: false, lifted: false, unaffected: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多人互不干扰', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 1, name: '林棠', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '沈知远', cursed: false, lifted: false, unaffected: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.ok(r.issues[0].evidence.includes('沈知远'));
  });
});

describe('v2.80 curse-ledger 输出', () => {
  test('当前中咒名册正确', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '林棠', cursed: true, lifted: false, unaffected: false },
    ], 2);
    assert.equal(r.cursed.length, 2);
  });
  test('解除后名册移除', () => {
    const r = M.curseLedger([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '沈知远', cursed: false, lifted: true, unaffected: false },
    ], 2);
    assert.equal(r.cursed.length, 0);
  });
});

describe('v2.80 curse-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.curseDirective([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含诅咒警告', () => {
    const d = M.curseDirective([
      { ep: 1, name: '沈知远', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: '沈知远', cursed: false, lifted: false, unaffected: true },
    ]);
    assert.ok(d.zh.includes('诅咒'));
    assert.ok(d.en.includes('Curse'));
  });
});

describe('v2.80 curse-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeCurseRow({ ep: 3, name: 'A', cursed: true, lifted: false, unaffected: false });
    assert.equal(r.ep, 3);
    assert.equal(r.name, 'A');
    assert.ok(r.cursed);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeCurseRow({ ep: 3 }), null);
  });
});

describe('v2.80 curse-ledger en 链路零中文', () => {
  test('cursed 检测', () => {
    const rows = M.deriveCurseRows('Steve was cursed.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Steve');
    assert.ok(rows[0].cursed);
  });
  test('lifted 检测', () => {
    const rows = M.deriveCurseRows("The curse was lifted from Steve.", ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].lifted);
  });
  test('unaffected 检测', () => {
    const rows = M.deriveCurseRows('Steve was unaffected by the curse.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].unaffected);
  });
  test('英文跨集诅咒穿帮正确', () => {
    const r = M.curseLedger([
      { ep: 1, name: 'Steve', cursed: true, lifted: false, unaffected: false },
      { ep: 2, name: 'Steve', cursed: false, lifted: false, unaffected: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
