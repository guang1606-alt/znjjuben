const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveLeakRows,
  normalizeLeakRow,
  secretLeakLedger,
  secretLeakDirective,
} = require('../dist/engine/secret-leak-ledger');

const NAMES = ['林辰', '苏晚', '老者', '赵四'];

test('secret-leak: zh 单集 told 提取（林辰告诉苏晚秘密）', () => {
  const draft = '林辰告诉苏晚一个惊天秘密，让她千万别外传。';
  const rows = deriveLeakRows(draft, NAMES);
  assert.ok(rows.some((r) => r.told === true && r.a === '林辰' && r.b === '苏晚'));
});

test('secret-leak: zh 单集 knows 提取（赵四说出真相）', () => {
  const draft = '赵四当众说出了真相，全场哗然。';
  const rows = deriveLeakRows(draft, NAMES);
  assert.ok(rows.some((r) => r.knows === true && r.a === '赵四'));
});

test('secret-leak: zh 单集 witness 提取（苏晚偷听到秘密）', () => {
  const draft = '苏晚在门外偷听到了这个秘密。';
  const rows = deriveLeakRows(draft, NAMES);
  assert.ok(rows.some((r) => r.witness === true && r.a === '苏晚'));
});

test('secret-leak: 跨集 secret_leak（A告诉B，下集C无交代知道真相）', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '赵四', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 2);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].type, 'secret_leak');
  assert.equal(res.issues[0].severity, 'high');
});

test('secret-leak: 跨集合法知情（B被告知后说出，不报）', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '苏晚', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 2);
  assert.equal(res.issues.length, 0);
});

test('secret-leak: 跨集 witness 豁免（C偷听到后说出，不报）', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '赵四', b: '__self__', told: false, knows: false, witness: true },
    { ep: 3, a: '赵四', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 3);
  assert.equal(res.issues.length, 0);
});

test('secret-leak: 知情圈累积（B告知D，D合法知情）', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '苏晚', b: '老者', told: true, knows: false, witness: false },
    { ep: 3, a: '老者', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 3);
  assert.equal(res.issues.length, 0);
});

test('secret-leak: 同集 told+knows 合法过渡', () => {
  // 同集：A 告诉 B，B 立刻说出（B 已在知情圈）
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 1, a: '苏晚', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 1);
  assert.equal(res.issues.length, 0);
});

test('secret-leak: en told 提取', () => {
  const draft = 'Chen told Su Wan the truth about the undercover agent.';
  const rows = deriveLeakRows(draft, ['Chen', 'Su Wan']);
  assert.ok(rows.some((r) => r.told === true && r.a === 'Chen' && r.b === 'Su Wan'));
});

test('secret-leak: en knows 提取', () => {
  const draft = 'Zhao knew the secret and revealed it to everyone.';
  const rows = deriveLeakRows(draft, ['Zhao']);
  assert.ok(rows.some((r) => r.knows === true && r.a === 'Zhao'));
});

test('secret-leak: 无秘密词不提取', () => {
  const draft = '林辰和苏晚在花园里散步，聊了很久。';
  const rows = deriveLeakRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('secret-leak: 短文本不提取', () => {
  const draft = '林辰告诉苏晚。';
  const rows = deriveLeakRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('secret-leak: 单人名 told 不提取（无听者）', () => {
  const draft = '林辰说出了秘密，无人回应。';
  const rows = deriveLeakRows(draft, NAMES);
  // 只有 knows（林辰说出秘密），无 told
  assert.ok(!rows.some((r) => r.told === true));
  assert.ok(rows.some((r) => r.knows === true && r.a === '林辰'));
});

test('secret-leak: normalizeLeakRow 容错', () => {
  assert.ok(normalizeLeakRow({ ep: 3, a: '林辰', b: '苏晚', told: true, knows: false, witness: false }));
  assert.equal(normalizeLeakRow({ ep: 3, a: '', b: '苏晚' }), null);
  assert.equal(normalizeLeakRow({ ep: 3, a: '林辰', b: '' }), null);
  const r = normalizeLeakRow({ ep: '5', a: '林辰', b: '苏晚', told: 'true' });
  assert.equal(r?.ep, 5);
  assert.equal(r?.told, true);
});

test('secret-leak: secretLeakDirective 非空输出', () => {
  const dir = secretLeakDirective([
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '赵四', b: '__self__', told: false, knows: true, witness: false },
  ]);
  assert.ok(dir.zh.includes('知情范围约束'));
  assert.ok(dir.zh.includes('赵四'));
  assert.ok(dir.en.includes('Knowledge Boundary'));
});

test('secret-leak: 多角色独立记账', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '老者', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 2);
  // 老者不在知情圈，报泄露
  assert.equal(res.issues.length, 1);
  assert.ok(res.issues[0].evidence.includes('老者'));
});

test('secret-leak: 同集同名合并（信号取并集）', () => {
  const draft = '赵四说出了真相。\n赵四偷听到了秘密。';
  const rows = deriveLeakRows(draft, NAMES);
  const r = rows.find((x) => x.a === '赵四' && x.b === '__self__');
  assert.ok(r);
  assert.equal(r.knows, true);
  assert.equal(r.witness, true);
});

test('secret-leak: 知情圈输出（informed 列表）', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
  ];
  const res = secretLeakLedger(rows, 1);
  assert.equal(res.informed.length, 2);
  assert.ok(res.informed.some((i) => i.name === '林辰'));
  assert.ok(res.informed.some((i) => i.name === '苏晚'));
});

test('secret-leak: issue 只报一次（同角色多集 knows 只1条）', () => {
  const rows = [
    { ep: 1, a: '林辰', b: '苏晚', told: true, knows: false, witness: false },
    { ep: 2, a: '赵四', b: '__self__', told: false, knows: true, witness: false },
    { ep: 3, a: '赵四', b: '__self__', told: false, knows: true, witness: false },
  ];
  const res = secretLeakLedger(rows, 3);
  assert.equal(res.issues.length, 1);
});

test('secret-leak: 空输入安全返回', () => {
  const res = secretLeakLedger([], 1);
  assert.equal(res.issues.length, 0);
  assert.equal(res.informed.length, 0);
  assert.equal(secretLeakDirective([]).zh, '');
  assert.equal(secretLeakDirective([]).en, '');
});

test('secret-leak: witness 同集豁免 knows（偷听后当场说出合法）', () => {
  const draft = '赵四在门外偷听到秘密，转身就说出了真相。';
  const rows = deriveLeakRows(draft, NAMES);
  const r = rows.find((x) => x.a === '赵四' && x.b === '__self__');
  assert.ok(r);
  assert.equal(r.knows, true);
  assert.equal(r.witness, true);
  // 过账：witness 加入知情圈，knows 不报
  const res = secretLeakLedger(rows.map((x) => ({ ep: 1, ...x })), 1);
  assert.equal(res.issues.length, 0);
});
