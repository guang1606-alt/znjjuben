// v2.80 变身账本（Transformation Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/transformation-ledger.js');

const cast = ['沈知远', '林棠', '赵烈'];

describe('v2.80 transformation-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveTransformationRows('', cast), []);
  });
  test('无变身动词返回空数组', () => {
    assert.deepEqual(M.deriveTransformationRows('沈知远和林棠站在一起。', cast), []);
  });
  test('变身动词建立 transformed 行', () => {
    const rows = M.deriveTransformationRows('沈知远化作人形。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, '沈知远');
    assert.ok(rows[0].transformed);
  });
  test('恢复动词建立 reverted 行', () => {
    const rows = M.deriveTransformationRows('沈知远恢复了原形。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].reverted);
  });
  test('原形动词建立 original 行', () => {
    const rows = M.deriveTransformationRows('沈知远现出了真身。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].original);
  });
  test('同句多信号合并到同一人名', () => {
    const rows = M.deriveTransformationRows('沈知远化形后恢复了原形。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].transformed);
    assert.ok(rows[0].reverted);
  });
});

describe('v2.80 transformation-ledger 跨集记账', () => {
  test('变身后原形行动（无恢复）= high transformation_contradiction', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 2, name: '沈知远', transformed: false, reverted: false, original: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'transformation_contradiction');
  });
  test('变身后恢复再原形=无穿帮', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 2, name: '沈知远', transformed: false, reverted: true, original: false },
      { ep: 3, name: '沈知远', transformed: false, reverted: false, original: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('原形后变身=合法', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: false, reverted: false, original: true },
      { ep: 2, name: '沈知远', transformed: true, reverted: false, original: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.transformed.length, 1);
  });
  test('同集变身又恢复又原形=不穿帮', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: true, original: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同人多次原形只报1次', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 2, name: '沈知远', transformed: false, reverted: false, original: true },
      { ep: 3, name: '沈知远', transformed: false, reverted: false, original: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多人互不干扰', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 1, name: '林棠', transformed: true, reverted: false, original: false },
      { ep: 2, name: '沈知远', transformed: false, reverted: false, original: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.ok(r.issues[0].evidence.includes('沈知远'));
  });
});

describe('v2.80 transformation-ledger 输出', () => {
  test('当前已变身名册正确', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 2, name: '林棠', transformed: true, reverted: false, original: false },
    ], 2);
    assert.equal(r.transformed.length, 2);
  });
  test('恢复后名册移除', () => {
    const r = M.transformationLedger([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 2, name: '沈知远', transformed: false, reverted: true, original: false },
    ], 2);
    assert.equal(r.transformed.length, 0);
  });
});

describe('v2.80 transformation-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.transformationDirective([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含变身警告', () => {
    const d = M.transformationDirective([
      { ep: 1, name: '沈知远', transformed: true, reverted: false, original: false },
      { ep: 2, name: '沈知远', transformed: false, reverted: false, original: true },
    ]);
    assert.ok(d.zh.includes('变身'));
    assert.ok(d.en.includes('Transformation'));
  });
});

describe('v2.80 transformation-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeTransformationRow({ ep: 3, name: 'A', transformed: true, reverted: false, original: false });
    assert.equal(r.ep, 3);
    assert.equal(r.name, 'A');
    assert.ok(r.transformed);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeTransformationRow({ ep: 3 }), null);
  });
});

describe('v2.80 transformation-ledger en 链路零中文', () => {
  test('transformed 检测', () => {
    const rows = M.deriveTransformationRows('Steve transformed into a wolf.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Steve');
    assert.ok(rows[0].transformed);
  });
  test('reverted 检测', () => {
    const rows = M.deriveTransformationRows('Steve reverted to his true form.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].reverted);
  });
  test('original 检测', () => {
    const rows = M.deriveTransformationRows('Steve was back in his true form.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].original);
  });
  test('英文跨集变身穿帮正确', () => {
    const r = M.transformationLedger([
      { ep: 1, name: 'Steve', transformed: true, reverted: false, original: false },
      { ep: 2, name: 'Steve', transformed: false, reverted: false, original: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
