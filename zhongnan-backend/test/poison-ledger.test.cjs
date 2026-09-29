// v2.80 中毒账本（Poison Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/poison-ledger.js');

const cast = ['沈知远', '林棠', '赵烈'];

describe('v2.80 poison-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.derivePoisonRows('', cast), []);
  });
  test('无中毒动词返回空数组', () => {
    assert.deepEqual(M.derivePoisonRows('沈知远和林棠站在一起。', cast), []);
  });
  test('中毒动词建立 poisoned 行', () => {
    const rows = M.derivePoisonRows('沈知远身中剧毒。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, '沈知远');
    assert.ok(rows[0].poisoned);
  });
  test('解毒动词建立 cured 行', () => {
    const rows = M.derivePoisonRows('沈知远服下了解药。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].cured);
  });
  test('无恙动词建立 healthy 行', () => {
    const rows = M.derivePoisonRows('沈知远运功如常。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].healthy);
  });
  test('同句多信号合并到同一人名', () => {
    const rows = M.derivePoisonRows('沈知远中毒后服下了解药。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].poisoned);
    assert.ok(rows[0].cured);
  });
});

describe('v2.80 poison-ledger 跨集记账', () => {
  test('中毒后无恙行动（无解毒）= high poison_contradiction', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '沈知远', poisoned: false, cured: false, healthy: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'poison_contradiction');
  });
  test('中毒后解毒再无恙=无穿帮', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '沈知远', poisoned: false, cured: true, healthy: false },
      { ep: 3, name: '沈知远', poisoned: false, cured: false, healthy: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('无恙后中毒=合法', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: false, cured: false, healthy: true },
      { ep: 2, name: '沈知远', poisoned: true, cured: false, healthy: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.poisoned.length, 1);
  });
  test('同集中毒又解毒又无恙=不穿帮', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: true, healthy: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同人多次无恙只报1次', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '沈知远', poisoned: false, cured: false, healthy: true },
      { ep: 3, name: '沈知远', poisoned: false, cured: false, healthy: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多人互不干扰', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 1, name: '林棠', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '沈知远', poisoned: false, cured: false, healthy: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.ok(r.issues[0].evidence.includes('沈知远'));
  });
});

describe('v2.80 poison-ledger 输出', () => {
  test('当前已中毒名册正确', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '林棠', poisoned: true, cured: false, healthy: false },
    ], 2);
    assert.equal(r.poisoned.length, 2);
  });
  test('解毒后名册移除', () => {
    const r = M.poisonLedger([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '沈知远', poisoned: false, cured: true, healthy: false },
    ], 2);
    assert.equal(r.poisoned.length, 0);
  });
});

describe('v2.80 poison-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.poisonDirective([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含中毒警告', () => {
    const d = M.poisonDirective([
      { ep: 1, name: '沈知远', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: '沈知远', poisoned: false, cured: false, healthy: true },
    ]);
    assert.ok(d.zh.includes('中毒'));
    assert.ok(d.en.includes('Poison'));
  });
});

describe('v2.80 poison-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizePoisonRow({ ep: 3, name: 'A', poisoned: true, cured: false, healthy: false });
    assert.equal(r.ep, 3);
    assert.equal(r.name, 'A');
    assert.ok(r.poisoned);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizePoisonRow({ ep: 3 }), null);
  });
});

describe('v2.80 poison-ledger en 链路零中文', () => {
  test('poisoned 检测', () => {
    const rows = M.derivePoisonRows('Steve was poisoned.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Steve');
    assert.ok(rows[0].poisoned);
  });
  test('cured 检测', () => {
    const rows = M.derivePoisonRows('Steve took the antidote.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].cured);
  });
  test('healthy 检测', () => {
    const rows = M.derivePoisonRows('Steve was unharmed.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].healthy);
  });
  test('英文跨集中毒穿帮正确', () => {
    const r = M.poisonLedger([
      { ep: 1, name: 'Steve', poisoned: true, cured: false, healthy: false },
      { ep: 2, name: 'Steve', poisoned: false, cured: false, healthy: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
