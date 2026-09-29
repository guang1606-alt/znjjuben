const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/config/pricing.js');
const { resolveEpisodeCharge: R, MemberLevel: LV, EngineTier: T } = P;

test('免费用户不走赠送集，按免费档处理（points取价目表）', () => {
  const r = R(LV.FREE, T.ECONOMY, null);
  assert.strictEqual(r.useQuota, false);
});

test('付费会员·经济档·有效且有余额 → 用赠送集、不扣积分', () => {
  const m = { level: LV.ADVANCED, quotaTotal: 300, quotaUsed: 10, expireAt: new Date(Date.now() + 864e5) };
  const r = R(LV.ADVANCED, T.ECONOMY, m);
  assert.strictEqual(r.useQuota, true);
  assert.strictEqual(r.points, 0);
  assert.strictEqual(r.quotaRemainBefore, 290);
});

test('【防赔核心】高级会员有赠送余额，但跑标准/旗舰 → 必须扣积分、不得用赠送集', () => {
  const m = { level: LV.ADVANCED, quotaTotal: 300, quotaUsed: 0, expireAt: new Date(Date.now() + 864e5) };
  const std = R(LV.ADVANCED, T.STANDARD, m);
  const flag = R(LV.ADVANCED, T.FLAGSHIP, m);
  assert.strictEqual(std.useQuota, false);
  assert.strictEqual(std.points, P.EP_PRICE.ADVANCED.STANDARD);
  assert.strictEqual(flag.useQuota, false);
  assert.strictEqual(flag.points, P.EP_PRICE.ADVANCED.FLAGSHIP);
});

test('【防赔核心】专业会员1000赠送集也不能用于旗舰，必须扣24积分', () => {
  const m = { level: LV.PRO, quotaTotal: 1000, quotaUsed: 0, expireAt: new Date(Date.now() + 864e5) };
  const flag = R(LV.PRO, T.FLAGSHIP, m);
  assert.strictEqual(flag.useQuota, false);
  assert.strictEqual(flag.points, 24);
  const std = R(LV.PRO, T.STANDARD, m);
  assert.strictEqual(std.useQuota, false);
  assert.strictEqual(std.points, 9);
  // 只有经济档能用赠送
  assert.strictEqual(R(LV.PRO, T.ECONOMY, m).useQuota, true);
});

test('赠送集已用完 → 经济档也回落为扣积分', () => {
  const m = { level: LV.PRO, quotaTotal: 1000, quotaUsed: 1000, expireAt: new Date(Date.now() + 864e5) };
  const r = R(LV.PRO, T.ECONOMY, m);
  assert.strictEqual(r.useQuota, false);
  assert.strictEqual(r.points, 5);
});

test('会员已过期 → 不用赠送集，回落积分', () => {
  const m = { level: LV.ADVANCED, quotaTotal: 300, quotaUsed: 0, expireAt: new Date(Date.now() - 864e5) };
  const r = R(LV.ADVANCED, T.ECONOMY, m);
  assert.strictEqual(r.useQuota, false);
  assert.strictEqual(r.points, 8);
});

test('无会员记录/传null → 经济档正常扣积分，不报错', () => {
  assert.strictEqual(R(LV.BASIC, T.ECONOMY, null).useQuota, false);
  assert.strictEqual(R(LV.BASIC, T.ECONOMY, null).points, 10);
});

test('等级与会员记录不一致 → 不视为有效赠送', () => {
  const m = { level: LV.ADVANCED, quotaTotal: 300, quotaUsed: 0, expireAt: new Date(Date.now() + 864e5) };
  const r = R(LV.PRO, T.ECONOMY, m); // 当前是PRO但记录是ADVANCED
  assert.strictEqual(r.useQuota, false);
});

test('quotaUsed 异常超过 quotaTotal 不产生负余额', () => {
  const m = { level: LV.PRO, quotaTotal: 100, quotaUsed: 150, expireAt: new Date(Date.now() + 864e5) };
  const r = R(LV.PRO, T.ECONOMY, m);
  assert.strictEqual(r.quotaRemainBefore, 0);
  assert.strictEqual(r.useQuota, false);
});
