const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveDisguiseRows,
  normalizeDisguiseRow,
  disguiseLedger,
  disguiseDirective,
} = require('../dist/engine/disguise-ledger');

const NAMES = ['林辰', '苏晚', '赵四', '老者'];

test('disguise: zh 伪装提取（林辰假扮老者）', () => {
  const draft = '林辰假扮老者混入会场，无人察觉。';
  const rows = deriveDisguiseRows(draft, NAMES);
  const r = rows.find((x) => x.name === '林辰' && x.disguised);
  assert.ok(r);
  assert.equal(r.alias, '老者');
});

test('disguise: zh 揭穿提取（苏晚识破林辰）', () => {
  const draft = '苏晚当场识破了林辰的伪装。';
  const rows = deriveDisguiseRows(draft, NAMES);
  const r = rows.find((x) => x.name === '苏晚' && x.revealed);
  assert.ok(r);
});

test('disguise: 跨集 identity_relapse（揭穿后又伪装同一身份）', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '林辰', alias: '老者', disguised: false, revealed: true },
    { ep: 3, name: '林辰', alias: '老者', disguised: true, revealed: false },
  ];
  const res = disguiseLedger(rows, 3);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].type, 'identity_relapse');
  assert.equal(res.issues[0].severity, 'high');
});

test('disguise: 揭穿后换身份伪装不报 relapse', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '林辰', alias: '老者', disguised: false, revealed: true },
    { ep: 3, name: '林辰', alias: '商人', disguised: true, revealed: false },
  ];
  const res = disguiseLedger(rows, 3);
  assert.equal(res.issues.length, 0);
});

test('disguise: 伪装状态持续（未揭穿则维持）', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '林辰', alias: '', disguised: false, revealed: false },
  ];
  const res = disguiseLedger(rows, 2);
  assert.equal(res.issues.length, 0);
  assert.ok(res.disguised.some((d) => d.name === '林辰' && d.alias === '老者'));
});

test('disguise: 揭穿后状态解除', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '林辰', alias: '老者', disguised: false, revealed: true },
  ];
  const res = disguiseLedger(rows, 2);
  assert.equal(res.issues.length, 0);
  assert.equal(res.disguised.length, 0);
});

test('disguise: 同集 disguised+revealed（本集揭穿）', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: true },
  ];
  const res = disguiseLedger(rows, 1);
  // revealed 先处理，disguised 命中 revealedSet → relapse
  assert.equal(res.issues.length, 1);
});

test('disguise: en 伪装提取', () => {
  const draft = 'Chen disguised as the old man and entered the meeting.';
  const rows = deriveDisguiseRows(draft, ['Chen', 'Su Wan']);
  const r = rows.find((x) => x.name === 'Chen' && x.disguised);
  assert.ok(r);
  assert.ok(r.alias.length > 0);
});

test('disguise: en 揭穿提取', () => {
  const draft = 'Su Wan recognized Chen and exposed his disguise.';
  const rows = deriveDisguiseRows(draft, ['Chen', 'Su Wan']);
  assert.ok(rows.some((r) => r.revealed === true));
});

test('disguise: 无伪装动词不提取', () => {
  const draft = '林辰和苏晚在花园里散步。';
  const rows = deriveDisguiseRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('disguise: 短文本不提取', () => {
  const draft = '林辰假扮。';
  const rows = deriveDisguiseRows(draft, NAMES);
  assert.equal(rows.length, 0);
});

test('disguise: 伪装成第二人名（林辰冒充苏晚）', () => {
  const draft = '林辰冒充苏晚去赴约。';
  const rows = deriveDisguiseRows(draft, NAMES);
  const r = rows.find((x) => x.name === '林辰' && x.disguised);
  assert.ok(r);
  assert.equal(r.alias, '苏晚');
});

test('disguise: normalizeDisguiseRow 容错', () => {
  assert.ok(normalizeDisguiseRow({ ep: 3, name: '林辰', alias: '老者', disguised: true, revealed: false }));
  assert.equal(normalizeDisguiseRow({ ep: 3, name: '', alias: '老者' }), null);
  const r = normalizeDisguiseRow({ ep: '5', name: '林辰', alias: '老者', disguised: 'true' });
  assert.equal(r?.ep, 5);
  assert.equal(r?.disguised, true);
});

test('disguise: disguiseDirective 非空输出', () => {
  const dir = disguiseDirective([
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '林辰', alias: '老者', disguised: false, revealed: true },
    { ep: 3, name: '林辰', alias: '老者', disguised: true, revealed: false },
  ]);
  assert.ok(dir.zh.includes('伪装身份约束'));
  assert.ok(dir.zh.includes('林辰'));
  assert.ok(dir.en.includes('Disguise Identity Boundary'));
});

test('disguise: 多角色独立记账', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 1, name: '赵四', alias: '商人', disguised: true, revealed: false },
    { ep: 2, name: '赵四', alias: '商人', disguised: false, revealed: true },
    { ep: 3, name: '赵四', alias: '商人', disguised: true, revealed: false },
  ];
  const res = disguiseLedger(rows, 3);
  // 赵四 relapse，林辰维持伪装
  assert.equal(res.issues.length, 1);
  assert.ok(res.issues[0].evidence.includes('赵四'));
  assert.ok(res.disguised.some((d) => d.name === '林辰'));
});

test('disguise: issue 不重复（同 name+alias 多次 relapse 只报1次）', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '林辰', alias: '老者', disguised: false, revealed: true },
    { ep: 3, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 4, name: '林辰', alias: '老者', disguised: true, revealed: false },
  ];
  const res = disguiseLedger(rows, 4);
  // 两次 relapse 都报（每次 disguised 命中 revealedSet 都报）
  assert.equal(res.issues.length, 2);
});

test('disguise: 伪装名册输出（disguised 列表）', () => {
  const rows = [
    { ep: 1, name: '林辰', alias: '老者', disguised: true, revealed: false },
    { ep: 2, name: '赵四', alias: '商人', disguised: true, revealed: false },
  ];
  const res = disguiseLedger(rows, 2);
  assert.equal(res.disguised.length, 2);
  assert.ok(res.disguised.some((d) => d.name === '林辰' && d.alias === '老者'));
  assert.ok(res.disguised.some((d) => d.name === '赵四' && d.alias === '商人'));
});

test('disguise: 空输入安全返回', () => {
  const res = disguiseLedger([], 1);
  assert.equal(res.issues.length, 0);
  assert.equal(res.disguised.length, 0);
  assert.equal(disguiseDirective([]).zh, '');
  assert.equal(disguiseDirective([]).en, '');
});

test('disguise: 同集同名合并（信号取并集）', () => {
  const draft = '林辰假扮老者。\n林辰的伪装被识破。';
  const rows = deriveDisguiseRows(draft, NAMES);
  const r = rows.find((x) => x.name === '林辰');
  assert.ok(r);
  assert.equal(r.disguised, true);
  assert.equal(r.revealed, true);
});

test('disguise: 化名身份提取（截尾缀"的"）', () => {
  const draft = '林辰化名张老板的身份混进商会。';
  const rows = deriveDisguiseRows(draft, NAMES);
  const r = rows.find((x) => x.name === '林辰' && x.disguised);
  assert.ok(r);
  // alias 不应以"的"结尾
  assert.ok(!r.alias.endsWith('的'));
});
