// v2.80 背叛账本（Betrayal Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/betrayal-ledger.js');

const cast = ['沈知远', '林棠', '赵烈', '苏婉'];

describe('v2.80 betrayal-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveBetrayalRows('', cast), []);
  });
  test('无背叛动词返回空数组', () => {
    assert.deepEqual(M.deriveBetrayalRows('沈知远和林棠站在一起。', cast), []);
  });
  test('背叛动词建立 betrayed 行', () => {
    const rows = M.deriveBetrayalRows('沈知远背叛了林棠。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].betrayed);
    assert.ok(!rows[0].reconciled);
    assert.ok(!rows[0].cooperated);
  });
  test('和解动词建立 reconciled 行', () => {
    const rows = M.deriveBetrayalRows('沈知远和林棠和解了。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].reconciled);
  });
  test('合作动词建立 cooperated 行', () => {
    const rows = M.deriveBetrayalRows('沈知远和林棠并肩作战。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].cooperated);
  });
  test('同句多种信号合并到同一对', () => {
    const rows = M.deriveBetrayalRows('沈知远背叛林棠又和解。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].betrayed);
    assert.ok(rows[0].reconciled);
  });
});

describe('v2.80 betrayal-ledger 跨集记账', () => {
  test('背叛后合作（无和解）= high trust_breach', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'trust_breach');
  });
  test('背叛后和解再合作=无穿帮', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: true, cooperated: false },
      { ep: 3, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('合作后背叛=合法', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.breaches.length, 1);
  });
  test('同集背叛又和解又合作=不穿帮', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: true, cooperated: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同对多次合作只报1次', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
      { ep: 3, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多对互不干扰', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 1, betrayer: '赵烈', victim: '苏婉', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].evidence.includes('沈知远'), true);
  });
});

describe('v2.80 betrayal-ledger 输出', () => {
  test('当前信任破裂名册正确', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '赵烈', victim: '苏婉', betrayed: true, reconciled: false, cooperated: false },
    ], 2);
    assert.equal(r.breaches.length, 2);
  });
  test('和解后名册移除', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: true, cooperated: false },
    ], 2);
    assert.equal(r.breaches.length, 0);
  });
});

describe('v2.80 betrayal-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.betrayalDirective([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含高严重警告', () => {
    const d = M.betrayalDirective([
      { ep: 1, betrayer: '沈知远', victim: '林棠', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: '沈知远', victim: '林棠', betrayed: false, reconciled: false, cooperated: true },
    ]);
    assert.ok(d.zh.includes('背叛'));
    assert.ok(d.en.includes('Betrayal'));
  });
});

describe('v2.80 betrayal-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeBetrayalRow({ ep: 3, betrayer: 'A', victim: 'B', betrayed: true, reconciled: false, cooperated: false });
    assert.equal(r.ep, 3);
    assert.equal(r.betrayer, 'A');
    assert.ok(r.betrayed);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeBetrayalRow({ ep: 3, betrayer: 'A' }), null);
  });
});

describe('v2.80 betrayal-ledger en 链路零中文', () => {
  test('betrayed 检测', () => {
    const rows = M.deriveBetrayalRows('Steve betrayed Lisa.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].betrayed);
  });
  test('reconciled 检测', () => {
    const rows = M.deriveBetrayalRows('Steve and Lisa reconciled.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].reconciled);
  });
  test('cooperated 检测', () => {
    const rows = M.deriveBetrayalRows('Steve and Lisa cooperated on the mission.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].cooperated);
  });
  test('英文跨集信任穿帮正确', () => {
    const r = M.betrayalLedger([
      { ep: 1, betrayer: 'Steve', victim: 'Lisa', betrayed: true, reconciled: false, cooperated: false },
      { ep: 2, betrayer: 'Steve', victim: 'Lisa', betrayed: false, reconciled: false, cooperated: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
