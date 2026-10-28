const test = require('node:test');
const assert = require('node:assert');
const G = require('../dist/engine/mature-gating.js');
const M = require('../dist/config/modes.js');

const DAY = 24 * 3600 * 1000;
function okConsent(over = {}) {
  return {
    memberPro: true, paid: true, ageConfirmed: true, age: 25, region: 'CN',
    purposePersonal: true, noMinorDistribution: true, boundaryAccepted: true,
    legalSelfResponsible: true, signedAt: Date.now(), ...over,
  };
}

test('完整合规问卷+授权通过', () => {
  const r = G.evaluateConsent(okConsent());
  assert.strictEqual(r.pass, true);
  assert.deepStrictEqual(r.reasons, []);
});

test('缺任一勾选或未成年/未付费/非专业均拒绝并说明原因', () => {
  assert.ok(!G.evaluateConsent(okConsent({ boundaryAccepted: false })).pass);
  assert.ok(G.evaluateConsent(okConsent({ age: 17 })).reasons.includes('年龄须满18周岁'));
  assert.ok(G.evaluateConsent(okConsent({ paid: false })).reasons.includes('需单独付费开通成年向分级功能'));
  assert.ok(G.evaluateConsent(okConsent({ memberPro: false })).reasons.includes('需专业会员'));
});

test('授权30天过期需重新签署', () => {
  const r = G.evaluateConsent(okConsent({ signedAt: Date.now() - 31 * DAY }));
  assert.ok(r.reasons.includes('授权已过期，请重新签署'));
});

test('核心红线：付费+授权齐全，露骨淫秽内容仍被硬拦（免责绕不过）', () => {
  const gate = G.matureGate(okConsent(), '两人发生性交，露骨描写抽插与阴道细节。');
  assert.strictEqual(gate.admitted, true);
  assert.strictEqual(gate.screen.allowed, false);
  assert.strictEqual(gate.ok, false);
  assert.ok(gate.rejectReasons.some((x) => x.includes('内容触红线')));
});

test('非露骨成熟向（犯罪/情欲张力）放行并打R/18+分级与预警', () => {
  const s = G.screenMatureText('黑帮绑架现场，他与她拥吻，暧昧的喘息在走廊回荡，一场复仇猎杀即将开始。');
  assert.strictEqual(s.allowed, true);
  assert.ok(s.warnings.length >= 2);
  assert.ok(['R', '18+'].includes(s.rating));
});

test('未成年人性化为最高红线，一律拦截', () => {
  assert.strictEqual(G.screenMatureText('涉及幼女的性描写内容').allowed, false);
});

test('所有法域露骨色情开关恒为关闭，不可配置放开', () => {
  Object.values(G.JURISDICTIONS).forEach((j) => assert.strictEqual(j.explicitSexual, false));
});

test('v2.325 后九大模式：成年向不再单列，历史 mature_x/xscript 归一到 film，授权红线由 auth-policy 继续承担', () => {
  // 注册表里不再有 mature_x 条目，但历史 raw 名仍可识别并归一（旧项目不变成死胡同）
  assert.strictEqual(M.CREATION_MODES.find((m) => m.id === 'mature_x'), undefined);
  assert.strictEqual(M.canonicalModeId('mature_x'), 'film');
  assert.strictEqual(M.canonicalModeId('xscript'), 'film');
  assert.strictEqual(M.modeAvailable('mature_x', 'PRO'), true);
  // 电影剧本模式 PRO 可用，不再是 coming_soon
  assert.strictEqual(M.isComingSoon('film'), false);
  assert.strictEqual(M.modeAvailable('film', 'PRO'), true);
  assert.strictEqual(M.CREATION_MODES.length, 9);
});
