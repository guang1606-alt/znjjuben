// v2.80 境界进阶账本（power-progress-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  derivePowerSignal,
  normalizePowerRow,
  powerProgressLedger,
  powerDirective,
  REALM_STAIRS,
} = require('../dist/engine/power-progress-ledger.js');

const NONE = { realm: null, broke: false, down: false, exempted: false };

// —— derivePowerSignal：信号提取 ——

test('derivePowerSignal：zh 境界词命中（筑基 / 金丹结丹）', () => {
  assert.deepEqual(derivePowerSignal('△陈峰筑基期修为，一拳轰退强敌。', '陈峰'), { realm: 1, broke: false, down: false, exempted: false });
  assert.deepEqual(derivePowerSignal('沈青澜已结丹期圆满。', '沈青澜'), { realm: 2, broke: false, down: false, exempted: false });
});

test('derivePowerSignal：zh 同行多境界词取最高（从筑基突破金丹）', () => {
  const r = derivePowerSignal('陈峰筑基突破金丹，全场哗然。', '陈峰');
  assert.equal(r.realm, 2);
  assert.equal(r.broke, true);
});

test('derivePowerSignal：zh 突破/破境命中', () => {
  assert.equal(derivePowerSignal('△陈峰破境而出，气浪掀翻屋顶。', '陈峰').broke, true);
  assert.equal(derivePowerSignal('陈峰：我当突破筑基！', '陈峰').broke, true);
});

test('derivePowerSignal：zh 废功/走火入魔降级交代命中', () => {
  assert.equal(derivePowerSignal('△陈峰被废功，修为尽失。', '陈峰').down, true);
  assert.equal(derivePowerSignal('陈峰走火入魔，丹田被毁。', '陈峰').down, true);
});

test('derivePowerSignal：zh 身份洗牌豁免命中（夺舍/隐藏修为），他人词不误伤', () => {
  assert.equal(derivePowerSignal('原来陈峰是被夺舍重生的老怪。', '陈峰').exempted, true);
  assert.equal(derivePowerSignal('陈峰向来深藏不露。', '陈峰').exempted, true);
  assert.equal(derivePowerSignal('△王虎被夺舍了。', '陈峰').exempted, false);
});

test('derivePowerSignal：zh"差点"前缀跳过（没突破成）', () => {
  const r = derivePowerSignal('陈峰差点突破，遗憾闭关。', '陈峰');
  assert.equal(r.broke, false);
  assert.equal(r.realm, null);
});

test('derivePowerSignal：en 境界词命中（含 reached 隔开）', () => {
  assert.deepEqual(derivePowerSignal('Wang has reached Foundation Establishment.', 'Wang'), { realm: 1, broke: false, down: false, exempted: false });
  assert.deepEqual(derivePowerSignal('Wang is a Golden Core cultivator now.', 'Wang'), { realm: 2, broke: false, down: false, exempted: false });
});

test('derivePowerSignal：en 突破/降级/豁免命中且零中文（人名除外透传）', () => {
  assert.equal(derivePowerSignal('Wang finally broke through to Nascent Soul.', 'Wang').broke, true);
  assert.equal(derivePowerSignal('Wang lost his cultivation in the fight.', 'Wang').down, true);
  assert.equal(derivePowerSignal('Wang was possessed by an ancient evil.', 'Wang').exempted, true);
});

test('derivePowerSignal：空文本/超短名字安全返回', () => {
  assert.deepEqual(derivePowerSignal('', '陈峰'), NONE);
  assert.deepEqual(derivePowerSignal('陈峰筑基了', '陈'), NONE);
  assert.deepEqual(derivePowerSignal('陈峰筑基了', ''), NONE);
});

// —— normalizePowerRow：摘要规范化 ——

test('normalizePowerRow：容错（ep 非法丢弃 / realm 越界归 null / 布尔仅认 true）', () => {
  assert.equal(normalizePowerRow(null), null);
  assert.equal(normalizePowerRow({ ep: 0, name: '陈峰' }), null);
  assert.deepEqual(
    normalizePowerRow({ ep: 3.4, name: ' 陈峰 ', realm: 99, broke: 'yes', down: true, exempted: false }),
    { ep: 3, name: '陈峰', realm: null, broke: false, down: true, exempted: false },
  );
});

// —— powerProgressLedger：跨集记账 ——

test('记账：首见境界入池不报（圣经既定基线）', () => {
  const r = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 1, broke: false, down: false, exempted: false },
  ], 2);
  assert.equal(r.issues.length, 0);
  assert.deepEqual(r.tracked, [{ name: '陈峰', realm: 1, realmLabel: '筑基', realmLabelEn: 'Foundation Establishment', lastEp: 1 }]);
});

test('记账：带突破合法升 1 级不报', () => {
  const r = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 1, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: 2, broke: true, down: false, exempted: false },
  ], 3);
  assert.equal(r.issues.length, 0);
  assert.equal(r.tracked[0].realm, 2);
});

test('记账：凭空跳级（连升≥2 无突破）报 skip_realm_jump high，每名字只报 1 次', () => {
  const r = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 0, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: 3, broke: false, down: false, exempted: false },
    { ep: 3, name: '陈峰', realm: 8, broke: false, down: false, exempted: false },
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].type, 'skip_realm_jump');
  assert.equal(r.issues[0].severity, 'high');
});

test('记账：升 1 级无突破场景报 soft_realm_jump mid', () => {
  const r = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 1, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: 2, broke: false, down: false, exempted: false },
  ], 3);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].type, 'soft_realm_jump');
  assert.equal(r.issues[0].severity, 'mid');
});

test('记账：凭空降级报 realm_drop high；带废功交代合法不报', () => {
  const drop = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 3, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: 1, broke: false, down: false, exempted: false },
  ], 3);
  assert.equal(drop.issues.length, 1);
  assert.equal(drop.issues[0].type, 'realm_drop');
  assert.equal(drop.issues[0].severity, 'high');
  const legal = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 3, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: 1, broke: false, down: true, exempted: false },
  ], 3);
  assert.equal(legal.issues.length, 0);
});

test('记账：仅突破无境界词 = 阶梯 +1；豁免词重置后无基线不判定', () => {
  const up = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 2, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: null, broke: true, down: false, exempted: false },
  ], 3);
  assert.equal(up.issues.length, 0);
  assert.equal(up.tracked[0].realm, 3);
  const reset = powerProgressLedger([
    { ep: 1, name: '陈峰', realm: 2, broke: false, down: false, exempted: false },
    { ep: 2, name: '陈峰', realm: 6, broke: false, down: false, exempted: true },
  ], 3);
  assert.equal(reset.issues.length, 0);
  assert.equal(reset.tracked.length, 0);
});

test('记账：ep≥cur 过滤 + 同集同名以后到为准 + 乱序安全', () => {
  const r = powerProgressLedger([
    { ep: 3, name: '陈峰', realm: 8, broke: false, down: false, exempted: false }, // ≥cur 丢弃
    { ep: 2, name: '陈峰', realm: 0, broke: false, down: false, exempted: false }, // 同集先到
    { ep: 2, name: '陈峰', realm: 1, broke: false, down: false, exempted: false }, // 同集后到为准
    { ep: 1, name: '陈峰', realm: 1, broke: false, down: false, exempted: false }, // 乱序
  ], 3);
  assert.equal(r.issues.length, 0);
  assert.equal(r.tracked[0].lastEp, 2);
  assert.equal(r.tracked[0].realm, 1);
});

// —— powerDirective：架构师指令 ——

test('指令：zh 列出已入册境界与变化要求', () => {
  const d = powerDirective([
    { ep: 1, name: '陈峰', realm: 1, broke: false, down: false, exempted: false },
    { ep: 1, name: '沈青澜', realm: 4, broke: false, down: false, exempted: false },
  ]);
  assert.ok(d.zh.includes('【跨集境界·进阶连续性】'));
  assert.ok(d.zh.includes('陈峰＝筑基'));
  assert.ok(d.zh.includes('沈青澜＝化神'));
  assert.ok(d.zh.includes('严禁连跳两级'));
});

test('指令：en 层零中文（境界用对译、人名透传）', () => {
  const d = powerDirective([
    { ep: 1, name: 'Wang', realm: 2, broke: false, down: false, exempted: false },
  ]);
  assert.ok(d.en.includes('[Cross-episode cultivation ladder'));
  assert.ok(d.en.includes('Wang = Golden Core'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en.replace(/Wang/g, '')));
});

test('指令：无输入返回空串', () => {
  assert.deepEqual(powerDirective([]), { zh: '', en: '' });
  assert.deepEqual(powerDirective(null), { zh: '', en: '' });
});
