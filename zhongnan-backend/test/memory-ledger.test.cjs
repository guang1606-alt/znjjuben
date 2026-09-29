// v2.80 记忆账本（Memory Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/memory-ledger.js');

const cast = ['沈知远', '林棠', '赵烈', '苏婉'];

describe('v2.80 memory-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveMemoryRows('', cast), []);
  });
  test('无记忆动词返回空数组', () => {
    assert.deepEqual(M.deriveMemoryRows('沈知远和林棠站在一起。', cast), []);
  });
  test('失忆动词建立 lost 行', () => {
    const rows = M.deriveMemoryRows('沈知远失忆了。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].lost);
    assert.ok(!rows[0].restored);
    assert.ok(!rows[0].recalled);
  });
  test('恢复动词建立 restored 行', () => {
    const rows = M.deriveMemoryRows('沈知远恢复记忆了。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].restored);
  });
  test('回忆动词建立 recalled 行', () => {
    const rows = M.deriveMemoryRows('沈知远想起了过去。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].recalled);
  });
  test('同人同句多种信号合并', () => {
    const rows = M.deriveMemoryRows('沈知远失忆了又恢复记忆。', cast);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].lost);
    assert.ok(rows[0].restored);
  });
  test('多人各自行独立', () => {
    const rows = M.deriveMemoryRows('沈知远失忆了，林棠想起了过去。', cast);
    assert.equal(rows.length, 2);
  });
});

describe('v2.80 memory-ledger 跨集记账', () => {
  test('失忆后回忆（无恢复交代）= high', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 2, name: '沈知远', lost: false, restored: false, recalled: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'memory_breach');
  });
  test('失忆后恢复再回忆=无穿帮', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 2, name: '沈知远', lost: false, restored: true, recalled: false },
      { ep: 3, name: '沈知远', lost: false, restored: false, recalled: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('回忆后失忆=合法', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: false, restored: false, recalled: true },
      { ep: 2, name: '沈知远', lost: true, restored: false, recalled: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.amnesiacs.length, 1);
  });
  test('同集失忆又恢复又回忆=不穿帮', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: true, recalled: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同人多次回忆只报1次', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 2, name: '沈知远', lost: false, restored: false, recalled: true },
      { ep: 3, name: '沈知远', lost: false, restored: false, recalled: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多人互不干扰', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 1, name: '林棠', lost: true, restored: false, recalled: false },
      { ep: 2, name: '沈知远', lost: false, restored: false, recalled: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].evidence.includes('沈知远'), true);
  });
});

describe('v2.80 memory-ledger 输出', () => {
  test('当前失忆名册正确', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 2, name: '林棠', lost: true, restored: false, recalled: false },
    ], 2);
    assert.equal(r.amnesiacs.length, 2);
  });
  test('恢复后失忆名册移除', () => {
    const r = M.memoryLedger([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 2, name: '沈知远', lost: false, restored: true, recalled: false },
    ], 2);
    assert.equal(r.amnesiacs.length, 0);
  });
});

describe('v2.80 memory-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.memoryDirective([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含高严重警告', () => {
    const d = M.memoryDirective([
      { ep: 1, name: '沈知远', lost: true, restored: false, recalled: false },
      { ep: 2, name: '沈知远', lost: false, restored: false, recalled: true },
    ]);
    assert.ok(d.zh.includes('记忆'));
    assert.ok(d.en.includes('Memory'));
  });
});

describe('v2.80 memory-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeMemoryRow({ ep: 3, name: 'A', lost: true, restored: false, recalled: false });
    assert.equal(r.ep, 3);
    assert.equal(r.name, 'A');
    assert.ok(r.lost);
  });
  test('缺字段返回 null', () => {
    assert.equal(M.normalizeMemoryRow({ ep: 3 }), null);
  });
});

describe('v2.80 memory-ledger en 链路零中文', () => {
  test('lost 检测', () => {
    const rows = M.deriveMemoryRows('Steve lost his memory after the fall.', ['Steve', 'Lisa']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].lost);
  });
  test('restored 检测', () => {
    const rows = M.deriveMemoryRows('Steve regained his memory in the hospital.', ['Steve', 'Lisa']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].restored);
  });
  test('recalled 检测', () => {
    const rows = M.deriveMemoryRows('Steve remembered the password.', ['Steve', 'Lisa']);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].recalled);
  });
  test('英文跨集穿帮正确', () => {
    const r = M.memoryLedger([
      { ep: 1, name: 'Steve', lost: true, restored: false, recalled: false },
      { ep: 2, name: 'Steve', lost: false, restored: false, recalled: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
