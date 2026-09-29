// v2.80 牺牲账本（Sacrifice Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/sacrifice-ledger.js');

const cast = ['沈知远', '林棠', '赵烈', '苏婉'];

describe('v2.80 sacrifice-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveSacrificeRows('', cast), []);
  });
  test('无牺牲动词返回空数组', () => {
    assert.deepEqual(M.deriveSacrificeRows('沈知远和林棠站在一起。', cast), []);
  });
  test('牺牲动词建立 sacrificed 行', () => {
    const rows = M.deriveSacrificeRows('沈知远为林棠挡刀。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].giver, '沈知远');
    assert.equal(rows[0].receiver, '林棠');
    assert.ok(rows[0].sacrificed);
  });
  test('感恩动词建立 thanked 行（giver=被感恩者）', () => {
    const rows = M.deriveSacrificeRows('林棠感恩沈知远。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].giver, '沈知远');
    assert.equal(rows[0].receiver, '林棠');
    assert.ok(rows[0].thanked);
  });
  test('轻慢动词建立 mistreated 行（giver=被轻慢者）', () => {
    const rows = M.deriveSacrificeRows('林棠轻慢沈知远。', cast);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].giver, '沈知远');
    assert.equal(rows[0].receiver, '林棠');
    assert.ok(rows[0].mistreated);
  });
});

describe('v2.80 sacrifice-ledger 跨集记账', () => {
  test('牺牲后轻慢（无感恩）= high ingratitude_breach', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'ingratitude_breach');
  });
  test('牺牲后感恩再轻慢=无穿帮', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: true, mistreated: false },
      { ep: 3, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('轻慢后牺牲=合法', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.debts.length, 1);
  });
  test('同集牺牲又感恩又轻慢=不穿帮', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: true, mistreated: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同对多次轻慢只报1次', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
      { ep: 3, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多对互不干扰', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 1, giver: '赵烈', receiver: '苏婉', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.ok(r.issues[0].evidence.includes('林棠'));
  });
});

describe('v2.80 sacrifice-ledger 输出', () => {
  test('当前待感恩名册正确', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '赵烈', receiver: '苏婉', sacrificed: true, thanked: false, mistreated: false },
    ], 2);
    assert.equal(r.debts.length, 2);
  });
  test('感恩后名册移除', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: true, mistreated: false },
    ], 2);
    assert.equal(r.debts.length, 0);
  });
});

describe('v2.80 sacrifice-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.sacrificeDirective([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含牺牲警告', () => {
    const d = M.sacrificeDirective([
      { ep: 1, giver: '沈知远', receiver: '林棠', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: '沈知远', receiver: '林棠', sacrificed: false, thanked: false, mistreated: true },
    ]);
    assert.ok(d.zh.includes('牺牲'));
    assert.ok(d.en.includes('Sacrifice'));
  });
});

describe('v2.80 sacrifice-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeSacrificeRow({ ep: 3, giver: 'A', receiver: 'B', sacrificed: true, thanked: false, mistreated: false });
    assert.equal(r.ep, 3);
    assert.equal(r.giver, 'A');
    assert.ok(r.sacrificed);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeSacrificeRow({ ep: 3, giver: 'A' }), null);
  });
});

describe('v2.80 sacrifice-ledger en 链路零中文', () => {
  test('sacrificed 检测', () => {
    const rows = M.deriveSacrificeRows('Steve took the bullet for Lisa.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].giver, 'Steve');
    assert.ok(rows[0].sacrificed);
  });
  test('thanked 检测', () => {
    const rows = M.deriveSacrificeRows('Lisa thanked Steve for saving her.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].thanked);
  });
  test('mistreated 检测', () => {
    const rows = M.deriveSacrificeRows('Lisa turned on Steve after everything.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].mistreated);
  });
  test('英文跨集忘恩穿帮正确', () => {
    const r = M.sacrificeLedger([
      { ep: 1, giver: 'Steve', receiver: 'Lisa', sacrificed: true, thanked: false, mistreated: false },
      { ep: 2, giver: 'Steve', receiver: 'Lisa', sacrificed: false, thanked: false, mistreated: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
