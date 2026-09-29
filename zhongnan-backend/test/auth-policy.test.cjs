const test = require('node:test');
const assert = require('node:assert');
const A = require('../dist/lib/auth-policy.js');

test('手机号规范化与脱敏', () => {
  assert.strictEqual(A.normalizePhone('138 1234-5678').phone, '13812345678');
  assert.strictEqual(A.normalizePhone('13812345678').ok, true);
  assert.strictEqual(A.normalizePhone('12812345678').ok, false); // 号段非法
  assert.strictEqual(A.normalizePhone('1381234567').ok, false);  // 位数不足
  assert.strictEqual(A.maskPhone('13812345678'), '138****5678');
});

test('密码强度：弱口令/纯数字/过短被拒，强密码通过', () => {
  assert.strictEqual(A.passwordStrength('12345678').ok, false);
  assert.strictEqual(A.passwordStrength('abcdefgh').ok, false); // 无数字
  assert.strictEqual(A.passwordStrength('ab1').ok, false);      // 过短
  assert.strictEqual(A.passwordStrength('Zhongnan2026').ok, true);
});

test('会员等级断言', () => {
  assert.strictEqual(A.hasLevel('FREE', 'BASIC'), false);
  assert.strictEqual(A.hasLevel('ADVANCED', 'PRO'), false);
  assert.strictEqual(A.hasLevel('PRO', 'PRO'), true);
  assert.strictEqual(A.hasLevel('ENTERPRISE', 'PRO'), true);
});

test('登录失败锁定：第5次锁15分钟，锁定期内拒绝，reset后清零', () => {
  let s = { failCount: 0, firstFailAt: null };
  for (let i = 0; i < 4; i++) s = A.registerFail(s);
  assert.strictEqual(A.loginLock({ ...s, lockedUntil: null }).locked, false);
  s = A.registerFail(s); // 第5次
  const lock = A.loginLock({ ...s, lockedUntil: null });
  assert.strictEqual(lock.locked, true);
  assert.strictEqual(lock.retryAfterSec, 900);
  // 锁定期内
  const now = 1_000_000;
  assert.strictEqual(A.loginLock({ failCount: 5, firstFailAt: now, lockedUntil: now + 900_000 }, now).locked, true);
  assert.deepStrictEqual(A.resetFail(), { failCount: 0, firstFailAt: null, lockedUntil: null });
});

test('成年向模式必须授权', () => {
  assert.strictEqual(A.requiresMatureConsent('mature_x'), true);
  assert.strictEqual(A.requiresMatureConsent('tag'), false);
});
