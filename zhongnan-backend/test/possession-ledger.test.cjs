// v2.80 附身账本（Possession Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/possession-ledger.js');

const cast = ['沈知远', '林棠', '赵烈'];

describe('v2.80 possession-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.derivePossessionRows('', cast), []);
  });
  test('无附身动词返回空数组', () => {
    assert.deepEqual(M.derivePossessionRows('沈知远和林棠站在一起。', cast), []);
  });
  test('附身动词建立 possessed 行', () => {
    const rows = M.derivePossessionRows('沈知远被附身了。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, '沈知远');
    assert.ok(rows[0].possessed);
  });
  test('解除动词建立 freed 行', () => {
    const rows = M.derivePossessionRows('沈知远被驱离了附身。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].freed);
  });
  test('本人意志动词建立 self_willed 行', () => {
    const rows = M.derivePossessionRows('沈知远恢复了意识。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].self_willed);
  });
  test('同句多信号合并到同一人名', () => {
    const rows = M.derivePossessionRows('沈知远被附身却恢复意识。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].possessed);
    assert.ok(rows[0].self_willed);
  });
});

describe('v2.80 possession-ledger 跨集记账', () => {
  test('被附身后本人意志（无解除）= high possession_contradiction', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '沈知远', possessed: false, freed: false, self_willed: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'possession_contradiction');
  });
  test('被附身后解除再本人意志=无穿帮', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '沈知远', possessed: false, freed: true, self_willed: false },
      { ep: 3, name: '沈知远', possessed: false, freed: false, self_willed: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('本人意志后被附身=合法', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: false, freed: false, self_willed: true },
      { ep: 2, name: '沈知远', possessed: true, freed: false, self_willed: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.possessed.length, 1);
  });
  test('同集被附身又解除又本人意志=不穿帮', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: true, self_willed: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同人多次本人意志只报1次', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '沈知远', possessed: false, freed: false, self_willed: true },
      { ep: 3, name: '沈知远', possessed: false, freed: false, self_willed: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多人互不干扰', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 1, name: '林棠', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '沈知远', possessed: false, freed: false, self_willed: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.ok(r.issues[0].evidence.includes('沈知远'));
  });
});

describe('v2.80 possession-ledger 输出', () => {
  test('当前被附身名册正确', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '林棠', possessed: true, freed: false, self_willed: false },
    ], 2);
    assert.equal(r.possessed.length, 2);
  });
  test('解除后名册移除', () => {
    const r = M.possessionLedger([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '沈知远', possessed: false, freed: true, self_willed: false },
    ], 2);
    assert.equal(r.possessed.length, 0);
  });
});

describe('v2.80 possession-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.possessionDirective([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含附身警告', () => {
    const d = M.possessionDirective([
      { ep: 1, name: '沈知远', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: '沈知远', possessed: false, freed: false, self_willed: true },
    ]);
    assert.ok(d.zh.includes('附身'));
    assert.ok(d.en.includes('Possession'));
  });
});

describe('v2.80 possession-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizePossessionRow({ ep: 3, name: 'A', possessed: true, freed: false, self_willed: false });
    assert.equal(r.ep, 3);
    assert.equal(r.name, 'A');
    assert.ok(r.possessed);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizePossessionRow({ ep: 3 }), null);
  });
});

describe('v2.80 possession-ledger en 链路零中文', () => {
  test('possessed 检测', () => {
    const rows = M.derivePossessionRows('Steve was possessed.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Steve');
    assert.ok(rows[0].possessed);
  });
  test('freed 检测', () => {
    const rows = M.derivePossessionRows('Steve was exorcised.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].freed);
  });
  test('self_willed 检测', () => {
    const rows = M.derivePossessionRows('Steve was conscious again.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].self_willed);
  });
  test('英文跨集附身穿帮正确', () => {
    const r = M.possessionLedger([
      { ep: 1, name: 'Steve', possessed: true, freed: false, self_willed: false },
      { ep: 2, name: 'Steve', possessed: false, freed: false, self_willed: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
