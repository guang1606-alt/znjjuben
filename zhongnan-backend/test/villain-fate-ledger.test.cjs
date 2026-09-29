// v2.80 反派下场账本（villain-fate-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveFateSignal,
  normalizeFateRow,
  villainFateLedger,
  fateDirective,
} = require('../dist/engine/villain-fate-ledger.js');

// —— deriveFateSignal：信号提取 ——

test('deriveFateSignal：zh 下场词命中（被抓入狱 / 身败名裂），△主语位同时记 active', () => {
  assert.deepEqual(deriveFateSignal('△陈峰被当场抓获，锒铛入狱。', '陈峰'), { removed: true, exempted: false, active: true });
  assert.deepEqual(deriveFateSignal('沈天雄身败名裂，仓皇出逃。', '沈天雄'), { removed: true, exempted: false, active: false });
});

test('deriveFateSignal：zh 豁免词命中（越狱/平反），豁免不等于下场', () => {
  assert.deepEqual(deriveFateSignal('陈峰越狱逃出，重出江湖。', '陈峰'), { removed: false, exempted: true, active: false });
  assert.deepEqual(deriveFateSignal('朝廷为沈家平反昭雪。', '沈家'), { removed: false, exempted: true, active: false });
});

test('deriveFateSignal：active 判定——台词行/△主语位算活动，叙述提及与"名字的"不算', () => {
  assert.deepEqual(deriveFateSignal('陈峰：我出来了。', '陈峰'), { removed: false, exempted: false, active: true });
  assert.deepEqual(deriveFateSignal('△陈峰走进茶馆坐下。', '陈峰'), { removed: false, exempted: false, active: true });
  assert.deepEqual(deriveFateSignal('茶馆里众人说起陈峰的旧事。', '陈峰'), { removed: false, exempted: false, active: false });
});

test('deriveFateSignal：zh"差点"前缀跳过（没下场成）', () => {
  assert.deepEqual(deriveFateSignal('陈峰差点被抓，侥幸逃脱。', '陈峰'), { removed: false, exempted: false, active: false });
});

test('deriveFateSignal：死亡行不收下场（归 death-ledger 管），他人死亡行不误伤', () => {
  assert.deepEqual(deriveFateSignal('陈峰被抓后咽了气。', '陈峰'), { removed: false, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal('△陈峰入狱。他爹咽了气。', '陈峰'), { removed: true, exempted: false, active: true });
});

test('deriveFateSignal：en 下场词命中（含大小写不敏感）', () => {
  assert.deepEqual(deriveFateSignal('Wang was arrested and thrown in jail.', 'Wang'), { removed: true, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal('WANG WAS ARRESTED.', 'Wang'), { removed: true, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal('The duke was deposed and disgraced.', 'duke'), { removed: true, exempted: false, active: false });
});

test('deriveFateSignal：en 豁免词命中（越狱/平反）', () => {
  assert.deepEqual(deriveFateSignal('Wang escaped prison and made a comeback.', 'Wang'), { removed: false, exempted: true, active: false });
  assert.deepEqual(deriveFateSignal('Wang was exonerated and set free.', 'Wang'), { removed: false, exempted: true, active: false });
});

test('deriveFateSignal：en almost 前缀跳过 + 死亡行让位', () => {
  assert.deepEqual(deriveFateSignal('Wang was almost captured but slipped away.', 'Wang'), { removed: false, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal('Wang was killed, his men arrested.', 'Wang'), { removed: false, exempted: false, active: false });
});

test('deriveFateSignal：空文本/超短名字/超短文本安全返回三 false', () => {
  assert.deepEqual(deriveFateSignal('', '陈峰'), { removed: false, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal('陈峰被抓走了', '峰'), { removed: false, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal('短', '陈峰'), { removed: false, exempted: false, active: false });
  assert.deepEqual(deriveFateSignal(null, null), { removed: false, exempted: false, active: false });
});

// —— normalizeFateRow：摘要规范化 ——

test('normalizeFateRow：合法行入账，ep/name 非法 → null，布尔仅认 true', () => {
  assert.deepEqual(normalizeFateRow({ ep: 4, name: ' 陈峰 ', removed: true, exempted: false, active: true }), { ep: 4, name: '陈峰', removed: true, exempted: false, active: true });
  assert.equal(normalizeFateRow({ ep: 0, name: '陈峰', removed: true }), null);
  assert.equal(normalizeFateRow({ ep: NaN, name: '陈峰' }), null);
  assert.equal(normalizeFateRow({ ep: 3, removed: true }), null); // 缺 name
  assert.equal(normalizeFateRow(null), null);
  assert.deepEqual(normalizeFateRow({ ep: 2.6, name: '陈峰', removed: 'yes', exempted: 1, active: true }), { ep: 3, name: '陈峰', removed: false, exempted: false, active: true });
});

// —— villainFateLedger：跨集记账 ——

test('villainFateLedger：空序列 → 无名册无问题', () => {
  const r = villainFateLedger([], 5);
  assert.deepEqual(r.felled, []);
  assert.deepEqual(r.issues, []);
});

test('villainFateLedger：入狱后下一集再活动 → 下场穿帮 high（每名字只报 1 次）', () => {
  const r = villainFateLedger([
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: true },
    { ep: 2, name: '陈峰', removed: false, exempted: false, active: true },
    { ep: 3, name: '陈峰', removed: false, exempted: false, active: true }, // 已报出册，不再重复
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'fated_but_active');
  assert.ok(r.issues[0].evidence.includes('第 1 集'));
  assert.ok(r.issues[0].evidence.includes('第 2 集'));
  assert.deepEqual(r.felled, []); // 报过即出册
});

test('villainFateLedger：豁免出册（越狱交代后不再追踪）', () => {
  const r = villainFateLedger([
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: true },
    { ep: 2, name: '陈峰', removed: false, exempted: true, active: true },
    { ep: 3, name: '陈峰', removed: false, exempted: false, active: true },
  ], 4);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.felled, []);
});

test('villainFateLedger：下场同集 active 不报（下场前有戏，正常）', () => {
  const r = villainFateLedger([
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: true },
  ], 2);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.felled, [{ name: '陈峰', fateEp: 1 }]);
});

test('villainFateLedger：乱序安全 + 只认 < curEpNo 的行', () => {
  const r = villainFateLedger([
    { ep: 2, name: '陈峰', removed: true, exempted: false, active: false },
    { ep: 1, name: '王虎', removed: true, exempted: false, active: false },
    { ep: 9, name: '王虎', removed: true, exempted: false, active: false }, // 未完成集剔除
  ], 4);
  assert.deepEqual(r.felled.map((d) => d.name), ['王虎', '陈峰']); // 按集升序入册
  assert.deepEqual(r.issues, []);
});

test('villainFateLedger：同集同名以后到为准', () => {
  const inBook = villainFateLedger([
    { ep: 1, name: '陈峰', removed: false, exempted: false, active: false },
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: false },
  ], 2);
  assert.deepEqual(inBook.felled, [{ name: '陈峰', fateEp: 1 }]);
  const corrected = villainFateLedger([
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: true },
    { ep: 1, name: '陈峰', removed: false, exempted: false, active: true }, // 同集修正：没下场
  ], 2);
  assert.deepEqual(corrected.felled, []);
  assert.deepEqual(corrected.issues, []);
});

// —— fateDirective：架构师指令 ——

test('fateDirective：名册非空出"下场维持"指令，zh 含名单/集号/豁免要求', () => {
  const b = fateDirective([
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: false },
    { ep: 2, name: '王虎', removed: true, exempted: false, active: false },
  ]);
  assert.ok(b.zh.includes('【跨集反派下场·下场维持】'));
  assert.ok(b.zh.includes('陈峰（第1集）'));
  assert.ok(b.zh.includes('王虎（第2集）'));
  assert.ok(b.zh.includes('越狱/平反/翻身/洗白'));
});

test('fateDirective：en 层系统文案零中文（人名按原名透传）', () => {
  const b = fateDirective([
    { ep: 1, name: 'Wang', removed: true, exempted: false, active: false },
  ]);
  assert.ok(b.en.includes('[Cross-episode villain fate'));
  assert.ok(b.en.includes('Wang (ep1)'));
  assert.ok(b.en.includes('prison-break / exoneration'));
  assert.ok(!/[\u4e00-\u9fff]/.test(b.en));
});

test('fateDirective：无输入/豁免清册后 → 空串（两语言一致）', () => {
  assert.deepEqual(fateDirective([]), { zh: '', en: '' });
  const cleared = fateDirective([
    { ep: 1, name: '陈峰', removed: true, exempted: false, active: false },
    { ep: 2, name: '陈峰', removed: false, exempted: true, active: false },
  ]);
  assert.equal(cleared.zh, '');
  assert.equal(cleared.en, '');
});
