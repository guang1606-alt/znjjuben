const test = require('node:test');
const assert = require('node:assert');
const { classifyAlertLevel, pickBalanceQueryStrategy, summarizeBalances } = require('../dist/lib/balance-policy.js');

// ---------- classifyAlertLevel ----------
test('classifyAlertLevel：null 余额 → UNKNOWN', () => {
  assert.strictEqual(classifyAlertLevel(null, 5), 'UNKNOWN');
});

test('classifyAlertLevel：恰好 2×threshold → LOW（边界属于 LOW）', () => {
  assert.strictEqual(classifyAlertLevel(10, 5), 'LOW');       // = 2×5
  assert.strictEqual(classifyAlertLevel(10.0, 5.0), 'LOW');
});

test('classifyAlertLevel：略大于 2×threshold → NORMAL', () => {
  assert.strictEqual(classifyAlertLevel(10.01, 5), 'NORMAL');
  assert.strictEqual(classifyAlertLevel(100, 5), 'NORMAL');
});

test('classifyAlertLevel：恰好 threshold → CRITICAL（≤阈值）', () => {
  assert.strictEqual(classifyAlertLevel(5, 5), 'CRITICAL');
  assert.strictEqual(classifyAlertLevel(0, 5), 'CRITICAL');
});

test('classifyAlertLevel：略大于 threshold → LOW', () => {
  assert.strictEqual(classifyAlertLevel(5.01, 5), 'LOW');
  assert.strictEqual(classifyAlertLevel(9.99, 5), 'LOW');
});

test('classifyAlertLevel：负数余额按 ≤threshold 处理 → CRITICAL', () => {
  assert.strictEqual(classifyAlertLevel(-1, 5), 'CRITICAL');
});

// ---------- pickBalanceQueryStrategy ----------
test('pickBalanceQueryStrategy：deepseek → auto=true', () => {
  const s = pickBalanceQueryStrategy('deepseek');
  assert.strictEqual(s.auto, true);
  assert.ok(s.docUrl && s.docUrl.startsWith('http'));
});

test('pickBalanceQueryStrategy：moonshot → auto=true', () => {
  const s = pickBalanceQueryStrategy('moonshot');
  assert.strictEqual(s.auto, true);
  assert.ok(s.docUrl && s.docUrl.startsWith('http'));
});

test('pickBalanceQueryStrategy：volcengine/aliyun/minimax → auto=false', () => {
  for (const v of ['volcengine', 'aliyun', 'minimax']) {
    const s = pickBalanceQueryStrategy(v);
    assert.strictEqual(s.auto, false, `${v} 应为手动`);
    assert.ok(s.docUrl);
  }
});

test('pickBalanceQueryStrategy：未知 vendor → auto=false 且有文档链接', () => {
  const s = pickBalanceQueryStrategy('unknown-vendor');
  assert.strictEqual(s.auto, false);
  assert.ok(s.docUrl);
});

// ---------- summarizeBalances ----------
test('summarizeBalances：空数组 → total=0，三列表全空，worstLevel=NORMAL', () => {
  const r = summarizeBalances([]);
  assert.strictEqual(r.total, 0);
  assert.deepStrictEqual(r.critical, []);
  assert.deepStrictEqual(r.low, []);
  assert.deepStrictEqual(r.unknown, []);
  assert.strictEqual(r.worstLevel, 'NORMAL');
});

test('summarizeBalances：worstLevel 优先级 CRITICAL > LOW > UNKNOWN > NORMAL', () => {
  // 仅 NORMAL
  assert.strictEqual(summarizeBalances([
    { providerId: 'a', providerName: 'A', vendor: 'deepseek', balanceYuan: 100, thresholdYuan: 5, alertLevel: 'NORMAL' },
  ]).worstLevel, 'NORMAL');
  // UNKNOWN 比 NORMAL 更差
  assert.strictEqual(summarizeBalances([
    { providerId: 'a', providerName: 'A', vendor: 'deepseek', balanceYuan: 100, thresholdYuan: 5, alertLevel: 'NORMAL' },
    { providerId: 'u', providerName: 'U', vendor: 'minimax', balanceYuan: null, thresholdYuan: 5, alertLevel: 'UNKNOWN' },
  ]).worstLevel, 'UNKNOWN');
  // LOW 比 UNKNOWN 更差
  assert.strictEqual(summarizeBalances([
    { providerId: 'u', providerName: 'U', vendor: 'minimax', balanceYuan: null, thresholdYuan: 5, alertLevel: 'UNKNOWN' },
    { providerId: 'l', providerName: 'L', vendor: 'deepseek', balanceYuan: 7, thresholdYuan: 5, alertLevel: 'LOW' },
  ]).worstLevel, 'LOW');
  // CRITICAL 最高优先级
  assert.strictEqual(summarizeBalances([
    { providerId: 'n', providerName: 'N', vendor: 'deepseek', balanceYuan: 100, thresholdYuan: 5, alertLevel: 'NORMAL' },
    { providerId: 'l', providerName: 'L', vendor: 'deepseek', balanceYuan: 7, thresholdYuan: 5, alertLevel: 'LOW' },
    { providerId: 'u', providerName: 'U', vendor: 'minimax', balanceYuan: null, thresholdYuan: 5, alertLevel: 'UNKNOWN' },
    { providerId: 'c', providerName: 'C', vendor: 'deepseek', balanceYuan: 1, thresholdYuan: 5, alertLevel: 'CRITICAL' },
  ]).worstLevel, 'CRITICAL');
});

test('summarizeBalances：total 累加非 null 余额，分类到对应列表', () => {
  const r = summarizeBalances([
    { providerId: 'a', providerName: 'A', vendor: 'deepseek', balanceYuan: 100, thresholdYuan: 5, alertLevel: 'NORMAL' },
    { providerId: 'b', providerName: 'B', vendor: 'moonshot', balanceYuan: 7, thresholdYuan: 5, alertLevel: 'LOW' },
    { providerId: 'c', providerName: 'C', vendor: 'volcengine', balanceYuan: 1, thresholdYuan: 5, alertLevel: 'CRITICAL' },
    { providerId: 'd', providerName: 'D', vendor: 'minimax', balanceYuan: null, thresholdYuan: 5, alertLevel: 'UNKNOWN' },
  ]);
  assert.strictEqual(r.total, 108);
  assert.deepStrictEqual(r.critical, ['c']);
  assert.deepStrictEqual(r.low, ['b']);
  assert.deepStrictEqual(r.unknown, ['d']);
});

test('summarizeBalances：未带 alertLevel 字段时按 balanceYuan+thresholdYuan 推断', () => {
  const r = summarizeBalances([
    { providerId: 'a', providerName: 'A', vendor: 'deepseek', balanceYuan: 100, thresholdYuan: 5 },
    { providerId: 'b', providerName: 'B', vendor: 'moonshot', balanceYuan: null, thresholdYuan: 5 },
  ]);
  assert.strictEqual(r.worstLevel, 'UNKNOWN');
  assert.deepStrictEqual(r.unknown, ['b']);
  assert.deepStrictEqual(r.critical, []);
});
