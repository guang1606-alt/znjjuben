// v2.80 联盟账本（Alliance Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/alliance-ledger.js');

const cast = ['沈知远', '林棠', '赵烈', '苏婉'];

describe('v2.80 alliance-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveAllianceRows('', cast), []);
  });
  test('无结盟动词返回空数组', () => {
    assert.deepEqual(M.deriveAllianceRows('沈知远和林棠站在一起。', cast), []);
  });
  test('结盟动词建立联盟行（allied）', () => {
    const rows = M.deriveAllianceRows('沈知远和林棠联手行动。', cast);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.ok(r.allied);
    assert.ok(!r.dissolved);
    assert.ok(!r.hostile);
  });
  test('瓦解动词建立 dissolved 行', () => {
    const rows = M.deriveAllianceRows('沈知远和林棠翻脸了。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].dissolved);
  });
  test('敌对动词建立 hostile 行', () => {
    const rows = M.deriveAllianceRows('沈知远和林棠反目了。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].hostile);
  });
  test('同句三种信号合并到同一对', () => {
    const rows = M.deriveAllianceRows('沈知远和林棠合作成功却又翻脸。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].allied);
    assert.ok(rows[0].dissolved);
  });
});

describe('v2.80 alliance-ledger 跨集记账', () => {
  test('结盟后敌对（无瓦解交代）= high', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'alliance_breach');
  });
  test('结盟后瓦解再敌对=无穿帮', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '沈知远', b: '林棠', allied: false, dissolved: true, hostile: false },
      { ep: 3, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('敌对后结盟=合法（不穿帮）', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
      { ep: 2, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.alliances.length, 1);
  });
  test('同集结盟又瓦解不穿帮', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: true, hostile: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同对多次敌对只报1次', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
      { ep: 3, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多对联盟互不干扰', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 1, a: '赵烈', b: '苏婉', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].evidence.includes('沈知远'), true);
  });
});

describe('v2.80 alliance-ledger 输出', () => {
  test('当前联盟名册正确', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '赵烈', b: '苏婉', allied: true, dissolved: false, hostile: false },
    ], 2);
    assert.equal(r.alliances.length, 2);
  });
  test('瓦解后联盟名册移除', () => {
    const r = M.allianceLedger([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '沈知远', b: '林棠', allied: false, dissolved: true, hostile: false },
    ], 2);
    assert.equal(r.alliances.length, 0);
  });
});

describe('v2.80 alliance-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.allianceDirective([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含高严重警告', () => {
    const d = M.allianceDirective([
      { ep: 1, a: '沈知远', b: '林棠', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: '沈知远', b: '林棠', allied: false, dissolved: false, hostile: true },
    ]);
    assert.ok(d.zh.includes('联盟'));
    assert.ok(d.en.includes('Alliance'));
  });
});

describe('v2.80 alliance-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeAllianceRow({ ep: 3, a: 'A', b: 'B', allied: true, dissolved: false, hostile: false });
    assert.equal(r.ep, 3);
    assert.equal(r.a, 'A');
    assert.ok(r.allied);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeAllianceRow({ ep: 3, a: 'A' }), null);
  });
});

describe('v2.80 alliance-ledger en 链路零中文', () => {
  test('allied 检测（英文结盟动词）', () => {
    const rows = M.deriveAllianceRows('Steve and Lisa teamed up for the mission.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].allied);
  });
  test('dissolved 检测（英文瓦解动词）', () => {
    const rows = M.deriveAllianceRows('Steve and Lisa fell out after the deal.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].dissolved);
  });
  test('hostile 检测（英文敌对动词）', () => {
    const rows = M.deriveAllianceRows('Steve attacked Lisa in the finale.', ['Steve', 'Lisa', 'Mike']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].hostile);
  });
  test('英文跨集穿帮正确', () => {
    const r = M.allianceLedger([
      { ep: 1, a: 'Steve', b: 'Lisa', allied: true, dissolved: false, hostile: false },
      { ep: 2, a: 'Steve', b: 'Lisa', allied: false, dissolved: false, hostile: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
