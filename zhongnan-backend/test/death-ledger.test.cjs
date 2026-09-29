// v2.80 死亡穿帮账本（death-ledger）测试：死亡/豁免/活动信号提取 / 摘要规范化 / 跨集记账 / 复活穿帮 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveDeathSignal,
  normalizeDeathRow,
  deathLedger,
  deathDirective,
} = require('../dist/engine/death-ledger.js');

// —— deriveDeathSignal：信号提取 ——

test('deriveDeathSignal：zh 死亡词命中（台词行死者 + 名字共现）', () => {
  const text = '△林晚倒在血泊中\n林晚（微弱）：替我照顾好孩子\n△陈峰抱着林晚嚎啕大哭，林晚咽气';
  assert.deepEqual(deriveDeathSignal(text, '林晚'), { dead: true, revived: false, active: true });
});

test('deriveDeathSignal：zh 死亡词在名字前（看着 X 咽气）也命中', () => {
  assert.equal(deriveDeathSignal('陈峰眼睁睁看着林晚咽气，跪地不起。', '林晚').dead, true);
});

test('deriveDeathSignal：zh 叙述提及不算活动，无死亡词不判死', () => {
  const text = '△陈峰把林晚的遗物收进木匣\n陈峰（哽咽）：林晚最喜欢这支簪子了';
  assert.deepEqual(deriveDeathSignal(text, '林晚'), { dead: false, revived: false, active: false });
});

test('deriveDeathSignal：zh 豁免词命中（假死/还魂/替身）', () => {
  assert.equal(deriveDeathSignal('陈峰（震惊）：林晚其实是假死，棺材里是空的！', '林晚').revived, true);
  assert.equal(deriveDeathSignal('△道士摆坛作法，林晚还魂睁眼。', '林晚').revived, true);
});

test('deriveDeathSignal：zh 裸"死了"不收（防"心死了"误伤）', () => {
  assert.equal(deriveDeathSignal('陈峰（绝望）：我的心已经死了。', '陈峰').dead, false);
});

test('deriveDeathSignal：en 死者自方谓语命中 + 被动窄窗命中，主宾不误伤', () => {
  assert.deepEqual(deriveDeathSignal('Lin Wan took her last breath in his arms.', 'Lin Wan'), { dead: true, revived: false, active: false });
  assert.equal(deriveDeathSignal('Wang was killed by the assassin on the bridge.', 'Wang').dead, true);
  // Zhang killed Wang：Zhang 是凶手不是死者，Wang 才是
  assert.equal(deriveDeathSignal('Zhang killed Wang with a single stab.', 'Zhang').dead, false);
  assert.equal(deriveDeathSignal('Zhang killed Wang with a single stab.', 'Wang').dead, true);
});

test('deriveDeathSignal：en 台词行/动作行判活动，大小写不敏感', () => {
  const text = '△Lin Wan walks into the hall\nLIN WAN (angry): You never told me the truth.';
  assert.deepEqual(deriveDeathSignal(text, 'Lin Wan'), { dead: false, revived: false, active: true });
});

test('deriveDeathSignal：空文本/超短名/超长名安全返回三 false', () => {
  assert.deepEqual(deriveDeathSignal('', '林晚'), { dead: false, revived: false, active: false });
  assert.deepEqual(deriveDeathSignal('很短', '林'), { dead: false, revived: false, active: false });
  assert.deepEqual(deriveDeathSignal('正常长度的正文内容，人名也正常', 'a'.repeat(30)), { dead: false, revived: false, active: false });
  assert.deepEqual(deriveDeathSignal(null, '林晚'), { dead: false, revived: false, active: false });
});

// —— normalizeDeathRow：摘要规范化 ——

test('normalizeDeathRow：合法行入账，ep/name 非法丢弃，布尔仅认 true', () => {
  assert.deepEqual(
    normalizeDeathRow({ ep: 4, name: ' 林晚 ', dead: true, revived: false, active: true }),
    { ep: 4, name: '林晚', dead: true, revived: false, active: true },
  );
  assert.equal(normalizeDeathRow({ ep: 0, name: '林晚', dead: true }), null);
  assert.equal(normalizeDeathRow({ ep: NaN, name: '林晚' }), null);
  assert.equal(normalizeDeathRow({ ep: 3, name: '林' }), null); // 单字名丢弃
  assert.equal(normalizeDeathRow({ ep: 3, name: 42 }), null);
  assert.equal(normalizeDeathRow(null), null);
  assert.deepEqual(normalizeDeathRow({ ep: 2.6, name: '林晚', dead: 'yes', active: 1 }), { ep: 3, name: '林晚', dead: false, revived: false, active: false });
});

// —— deathLedger：跨集记账 ——

test('deathLedger：空序列 → 空名册无问题', () => {
  const r = deathLedger([], 5);
  assert.deepEqual(r.dead, []);
  assert.deepEqual(r.issues, []);
});

test('deathLedger：跨集复活穿帮（第3集确认死亡，第7集再开口）→ high', () => {
  const r = deathLedger([
    { ep: 3, name: '林晚', dead: true, revived: false, active: true },
    { ep: 7, name: '林晚', dead: false, revived: false, active: true },
  ], 8);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'resurrected_after_death');
  assert.ok(r.issues[0].evidence.includes('林晚'));
  assert.ok(r.issues[0].evidence.includes('第 3 集') && r.issues[0].evidence.includes('第 7 集'));
});

test('deathLedger：豁免出册（复活交代后不再报穿帮）', () => {
  const r = deathLedger([
    { ep: 3, name: '林晚', dead: true, revived: false, active: true },
    { ep: 5, name: '林晚', dead: false, revived: true, active: false },
    { ep: 7, name: '林晚', dead: false, revived: false, active: true },
  ], 8);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.dead, []);
});

test('deathLedger：死亡名册记录确认死亡（name + deathEp），同集 active 是死前有戏不报', () => {
  const r = deathLedger([
    { ep: 3, name: '王五', dead: true, revived: false, active: true },
  ], 4);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.dead, [{ name: '王五', deathEp: 3 }]);
});

test('deathLedger：册中死者纯叙述提及（非台词/动作）不算复活', () => {
  const r = deathLedger([
    { ep: 3, name: '林晚', dead: true, revived: false, active: false },
    { ep: 6, name: '林晚', dead: false, revived: false, active: false },
  ], 7);
  assert.deepEqual(r.issues, []);
});

test('deathLedger：每名字只报 1 次（报后出册），后续集不再刷屏', () => {
  const r = deathLedger([
    { ep: 2, name: '林晚', dead: true, revived: false, active: false },
    { ep: 5, name: '林晚', dead: false, revived: false, active: true },
    { ep: 6, name: '林晚', dead: false, revived: false, active: true },
  ], 7);
  assert.equal(r.issues.length, 1);
  assert.deepEqual(r.dead, []);
});

test('deathLedger：curEpNo 透传校验（≥当前集的行忽略）、乱序安全、同集同名以后到为准', () => {
  const r = deathLedger([
    { ep: 7, name: '林晚', dead: true, revived: false, active: false }, // ≥ cur 被忽略
    { ep: 3, name: '林晚', dead: false, revived: false, active: false },
    { ep: 3, name: '林晚', dead: true, revived: false, active: true }, // 后到为准
    { ep: 1, name: '王五', dead: true, revived: false, active: false },
  ], 6);
  assert.deepEqual(r.dead, [{ name: '王五', deathEp: 1 }, { name: '林晚', deathEp: 3 }]);
});

// —— deathDirective：架构师指令 ——

test('deathDirective：名册非空出双语指令，en 层系统文案零中文（英文名）', () => {
  const rows = [{ ep: 2, name: 'Lin Wan', dead: true, revived: false, active: false }];
  const zh = deathDirective(rows).zh;
  const en = deathDirective(rows).en;
  assert.ok(zh.includes('【跨集死亡·复活预警】'));
  assert.ok(zh.includes('Lin Wan（第2集）'));
  assert.ok(zh.includes('假死/还魂/替身'));
  assert.ok(en.includes('[Cross-episode death — resurrection watch]'));
  assert.ok(en.includes('Lin Wan (ep2)'));
  assert.ok(en.includes('faked-death'));
  assert.ok(!/[一-鿿]/.test(en)); // en 系统文案零中文（人名用英文）
});

test('deathDirective：名册为空/豁免后返回空串', () => {
  assert.deepEqual(deathDirective([]), { zh: '', en: '' });
  const revived = [{ ep: 2, name: '林晚', dead: true, revived: false, active: false }, { ep: 4, name: '林晚', dead: false, revived: true, active: false }];
  assert.deepEqual(deathDirective(revived), { zh: '', en: '' });
});
