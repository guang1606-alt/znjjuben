const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveDebtRows,
  normalizeDebtRow,
  debtLedger,
  debtDirective,
} = require('../dist/engine/debt-ledger');

const NAMES = ['林辰', '苏晚', '赵四', '老者'];

test('debt: zh owed 提取（林辰救了苏晚）', () => {
  const draft = '林辰救了苏晚一命，苏晚感激涕零。';
  const rows = deriveDebtRows(draft, NAMES);
  const r = rows.find((x) => x.owed === true);
  assert.ok(r);
  assert.equal(r.debtor, '苏晚');
  assert.equal(r.creditor, '林辰');
});

test('debt: zh repaid 提取（苏晚报答林辰）', () => {
  const draft = '苏晚决定报答林辰的救命之恩。';
  const rows = deriveDebtRows(draft, NAMES);
  const r = rows.find((x) => x.repaid === true);
  assert.ok(r);
  assert.equal(r.debtor, '苏晚');
  assert.equal(r.creditor, '林辰');
});

test('debt: zh betrayed 提取（赵四出卖林辰）', () => {
  const draft = '赵四竟然出卖了林辰。';
  const rows = deriveDebtRows(draft, NAMES);
  const r = rows.find((x) => x.betrayed === true);
  assert.ok(r);
  assert.equal(r.debtor, '赵四');
  assert.equal(r.creditor, '林辰');
});

test('debt: 跨集 debt_betrayal（欠债后恩将仇报无交代）', () => {
  const rows = [
    { ep: 1, debtor: '赵四', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '赵四', creditor: '林辰', owed: false, repaid: false, betrayed: true },
  ];
  const res = debtLedger(rows, 2);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].type, 'debt_betrayal');
  assert.equal(res.issues[0].severity, 'high');
});

test('debt: 偿还后背叛不报（已还清）', () => {
  const rows = [
    { ep: 1, debtor: '赵四', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '赵四', creditor: '林辰', owed: false, repaid: true, betrayed: false },
    { ep: 3, debtor: '赵四', creditor: '林辰', owed: false, repaid: false, betrayed: true },
  ];
  const res = debtLedger(rows, 3);
  assert.equal(res.issues.length, 0);
});

test('debt: 同集 owed+betrayed（当天就反水）', () => {
  const rows = [
    { ep: 1, debtor: '赵四', creditor: '林辰', owed: true, repaid: false, betrayed: true },
  ];
  const res = debtLedger(rows, 1);
  // owed 先建立，betrayed 检测时仍欠债 → 报
  assert.equal(res.issues.length, 1);
});

test('debt: 无债背叛不报（赵四本就不欠林辰）', () => {
  const rows = [
    { ep: 1, debtor: '赵四', creditor: '林辰', owed: false, repaid: false, betrayed: true },
  ];
  const res = debtLedger(rows, 1);
  assert.equal(res.issues.length, 0);
});

test('debt: en owed 提取', () => {
  const draft = 'Chen saved Su Wan from the fire.';
  const rows = deriveDebtRows(draft, ['Chen', 'Su Wan']);
  const r = rows.find((x) => x.owed === true);
  assert.ok(r);
  assert.equal(r.debtor, 'Su Wan');
  assert.equal(r.creditor, 'Chen');
});

test('debt: en betrayed 提取', () => {
  const draft = 'Zhao betrayed Chen and revealed everything.';
  const rows = deriveDebtRows(draft, ['Chen', 'Zhao']);
  const r = rows.find((x) => x.betrayed === true);
  assert.ok(r);
  assert.equal(r.debtor, 'Zhao');
});

test('debt: 无动词不提取', () => {
  const draft = '林辰和苏晚在花园里散步。';
  const rows = deriveDebtRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('debt: 短文本不提取', () => {
  const draft = '林辰救了。';
  const rows = deriveDebtRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('debt: normalizeDebtRow 容错', () => {
  assert.ok(normalizeDebtRow({ ep: 3, debtor: '赵四', creditor: '林辰', owed: true, repaid: false, betrayed: false }));
  assert.equal(normalizeDebtRow({ ep: 3, debtor: '', creditor: '林辰' }), null);
  assert.equal(normalizeDebtRow({ ep: 3, debtor: '赵四', creditor: '' }), null);
  const r = normalizeDebtRow({ ep: '5', debtor: '赵四', creditor: '林辰', owed: 'true' });
  assert.equal(r?.ep, 5);
  assert.equal(r?.owed, true);
});

test('debt: debtDirective 非空输出', () => {
  const dir = debtDirective([
    { ep: 1, debtor: '赵四', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '赵四', creditor: '林辰', owed: false, repaid: false, betrayed: true },
  ]);
  assert.ok(dir.zh.includes('人情债约束'));
  assert.ok(dir.zh.includes('赵四'));
  assert.ok(dir.en.includes('Debt of Gratitude Boundary'));
});

test('debt: 多对独立记账', () => {
  const rows = [
    { ep: 1, debtor: '苏晚', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 1, debtor: '赵四', creditor: '老者', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '赵四', creditor: '老者', owed: false, repaid: false, betrayed: true },
  ];
  const res = debtLedger(rows, 2);
  assert.equal(res.issues.length, 1);
  assert.ok(res.issues[0].evidence.includes('赵四'));
  assert.ok(res.debts.some((d) => d.debtor === '苏晚'));
});

test('debt: issue 不重复（同背叛只报1次）', () => {
  const rows = [
    { ep: 1, debtor: '赵四', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '赵四', creditor: '林辰', owed: false, repaid: false, betrayed: true },
    { ep: 3, debtor: '赵四', creditor: '林辰', owed: false, repaid: false, betrayed: true },
  ];
  const res = debtLedger(rows, 3);
  assert.equal(res.issues.length, 1);
});

test('debt: 债务名册输出（debts 列表）', () => {
  const rows = [
    { ep: 1, debtor: '苏晚', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '赵四', creditor: '老者', owed: true, repaid: false, betrayed: false },
  ];
  const res = debtLedger(rows, 2);
  assert.equal(res.debts.length, 2);
  assert.ok(res.debts.some((d) => d.debtor === '苏晚' && d.creditor === '林辰'));
  assert.ok(res.debts.some((d) => d.debtor === '赵四' && d.creditor === '老者'));
});

test('debt: 空输入安全返回', () => {
  const res = debtLedger([], 1);
  assert.equal(res.issues.length, 0);
  assert.equal(res.debts.length, 0);
  assert.equal(debtDirective([]).zh, '');
  assert.equal(debtDirective([]).en, '');
});

test('debt: 同集同名合并（信号取并集）', () => {
  const draft = '林辰救了赵四。\n赵四背叛了林辰。';
  const rows = deriveDebtRows(draft, NAMES);
  const r = rows.find((x) => x.debtor === '赵四' && x.creditor === '林辰');
  assert.ok(r);
  assert.equal(r.owed, true);
  assert.equal(r.betrayed, true);
});

test('debt: 偿还后债务从名册移除', () => {
  const rows = [
    { ep: 1, debtor: '苏晚', creditor: '林辰', owed: true, repaid: false, betrayed: false },
    { ep: 2, debtor: '苏晚', creditor: '林辰', owed: false, repaid: true, betrayed: false },
  ];
  const res = debtLedger(rows, 2);
  assert.equal(res.issues.length, 0);
  assert.equal(res.debts.length, 0);
});
