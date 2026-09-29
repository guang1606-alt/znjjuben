// v2.80 冒充账本（Impersonation Ledger）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/impersonation-ledger.js');

const cast = ['沈知远', '林棠', '赵烈', '苏婉'];

describe('v2.80 impersonation-ledger 单集提取', () => {
  test('空草稿返回空数组', () => {
    assert.deepEqual(M.deriveImpersonationRows('', cast), []);
  });
  test('无冒充动词返回空数组', () => {
    assert.deepEqual(M.deriveImpersonationRows('沈知远和林棠站在一起。', cast), []);
  });
  test('冒充动词建立 impersonated 行', () => {
    const rows = M.deriveImpersonationRows('沈知远冒充林棠。', cast);
    const r = rows.find((x) => x.impersonated);
    assert.ok(r);
    assert.equal(r.imposter, '沈知远');
    assert.equal(r.victim, '林棠');
    assert.ok(!r.exposed);
    assert.ok(!r.recognized);
  });
  test('揭穿动词建立 exposed 行', () => {
    const rows = M.deriveImpersonationRows('沈知远冒充林棠被揭穿。', cast);
    const r = rows.find((x) => x.exposed);
    assert.ok(r);
    assert.equal(r.imposter, '沈知远');
    assert.equal(r.victim, '林棠');
  });
  test('认出动词建立 recognized 行（imposter 为空）', () => {
    const rows = M.deriveImpersonationRows('林棠的真身被认出。', cast);
    const r = rows.find((x) => x.recognized);
    assert.ok(r);
    assert.equal(r.victim, '林棠');
    assert.equal(r.imposter, '');
  });
  test('同句多种信号合并到同一对', () => {
    const rows = M.deriveImpersonationRows('沈知远冒充林棠又被揭穿。', cast);
    const r = rows.find((x) => x.imposter === '沈知远' && x.victim === '林棠');
    assert.ok(r.impersonated);
    assert.ok(r.exposed);
  });
});

describe('v2.80 impersonation-ledger 跨集记账', () => {
  test('冒充后真 B 被认出（无揭穿）= high identity_conflict', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'identity_conflict');
  });
  test('冒充后揭穿再认出=无穿帮', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '沈知远', victim: '林棠', impersonated: false, exposed: true, recognized: false },
      { ep: 3, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
    ], 3);
    assert.equal(r.issues.length, 0);
  });
  test('认出后冒充=合法', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
      { ep: 2, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
    ], 2);
    assert.equal(r.issues.length, 0);
    assert.equal(r.impersonations.length, 1);
  });
  test('同集冒充又揭穿又认出=不穿帮', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: true, recognized: false },
      { ep: 1, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
    ], 1);
    assert.equal(r.issues.length, 0);
  });
  test('同对多次身份冲突只报1次', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
      { ep: 3, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
    ], 3);
    assert.equal(r.issues.length, 1);
  });
  test('多冒充者互不干扰', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 1, imposter: '赵烈', victim: '苏婉', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].evidence.includes('林棠'), true);
  });
});

describe('v2.80 impersonation-ledger 输出', () => {
  test('当前冒充名册正确', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '赵烈', victim: '苏婉', impersonated: true, exposed: false, recognized: false },
    ], 2);
    assert.equal(r.impersonations.length, 2);
  });
  test('揭穿后冒充名册移除', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '沈知远', victim: '林棠', impersonated: false, exposed: true, recognized: false },
    ], 2);
    assert.equal(r.impersonations.length, 0);
  });
});

describe('v2.80 impersonation-ledger 指令输出', () => {
  test('无穿帮指令为空', () => {
    const d = M.impersonationDirective([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
    ]);
    assert.equal(d.zh, '');
    assert.equal(d.en, '');
  });
  test('穿帮指令含高严重警告', () => {
    const d = M.impersonationDirective([
      { ep: 1, imposter: '沈知远', victim: '林棠', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '', victim: '林棠', impersonated: false, exposed: false, recognized: true },
    ]);
    assert.ok(d.zh.includes('冒充'));
    assert.ok(d.en.includes('Impersonation'));
  });
});

describe('v2.80 impersonation-ledger 规范化', () => {
  test('正常行规范化', () => {
    const r = M.normalizeImpersonationRow({ ep: 3, imposter: 'A', victim: 'B', impersonated: true, exposed: false, recognized: false });
    assert.equal(r.ep, 3);
    assert.equal(r.imposter, 'A');
    assert.ok(r.impersonated);
  });
  test('recognized 行 imposter 可空', () => {
    const r = M.normalizeImpersonationRow({ ep: 3, imposter: '', victim: 'B', impersonated: false, exposed: false, recognized: true });
    assert.ok(r);
    assert.equal(r.victim, 'B');
    assert.ok(r.recognized);
  });
  test('缺 victim 返回 null', () => {
    assert.equal(M.normalizeImpersonationRow({ ep: 3, imposter: 'A' }), null);
  });
});

describe('v2.80 impersonation-ledger en 链路零中文', () => {
  test('impersonated 检测', () => {
    const rows = M.deriveImpersonationRows('Steve impersonated Lisa at the party.', ['Steve', 'Lisa', 'Mike']);
    const r = rows.find((x) => x.impersonated);
    assert.ok(r);
    assert.equal(r.imposter, 'Steve');
    assert.equal(r.victim, 'Lisa');
  });
  test('exposed 检测', () => {
    const rows = M.deriveImpersonationRows('Steve was exposed impersonating Lisa.', ['Steve', 'Lisa', 'Mike']);
    const r = rows.find((x) => x.exposed);
    assert.ok(r);
  });
  test('recognized 检测', () => {
    const rows = M.deriveImpersonationRows('Lisa was recognized in person.', ['Steve', 'Lisa', 'Mike']);
    const r = rows.find((x) => x.recognized);
    assert.ok(r);
    assert.equal(r.victim, 'Lisa');
  });
  test('英文跨集身份冲突正确', () => {
    const r = M.impersonationLedger([
      { ep: 1, imposter: 'Steve', victim: 'Lisa', impersonated: true, exposed: false, recognized: false },
      { ep: 2, imposter: '', victim: 'Lisa', impersonated: false, exposed: false, recognized: true },
    ], 2);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
  });
});
