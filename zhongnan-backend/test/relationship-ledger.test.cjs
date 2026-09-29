// v2.80 关系翻转账本（relationship-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveRelationRows,
  normalizeRelRow,
  relationshipLedger,
  relationshipDirective,
} = require('../dist/engine/relationship-ledger.js');

// —— deriveRelationRows：信号提取 ——

test('deriveRelationRows：zh 决裂命中（离婚同句两名字配对）', () => {
  assert.deepEqual(deriveRelationRows('陈峰与沈青澜离婚，从此形同陌路。', ['陈峰', '沈青澜', '王虎']), [
    { name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
  ]);
});

test('deriveRelationRows：zh 亲密命中（十指相扣）', () => {
  assert.deepEqual(deriveRelationRows('△陈峰和沈青澜十指相扣漫步江边。', ['陈峰', '沈青澜']), [
    { name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: true },
  ]);
});

test('deriveRelationRows：zh 修复命中（冰释前嫌）', () => {
  assert.deepEqual(deriveRelationRows('陈峰与沈青澜冰释前嫌，重归于好。', ['陈峰', '沈青澜']), [
    { name: '陈峰', other: '沈青澜', rift: false, reconciled: true, close: false },
  ]);
});

test('deriveRelationRows：zh 三人同句两两配对（3 对全决裂）', () => {
  const rows = deriveRelationRows('陈峰、沈青澜、王虎三人在祠堂决裂。', ['陈峰', '沈青澜', '王虎']);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.rift && !r.close && !r.reconciled));
});

test('deriveRelationRows：名字不在名单中不配对', () => {
  assert.deepEqual(deriveRelationRows('路人甲与路人乙离婚了。', ['陈峰', '沈青澜']), []);
});

test('deriveRelationRows：空文本/名单不足两人安全返回空数组', () => {
  assert.deepEqual(deriveRelationRows('', ['陈峰', '沈青澜']), []);
  assert.deepEqual(deriveRelationRows('陈峰和沈青澜离婚了', ['陈峰']), []);
  assert.deepEqual(deriveRelationRows('文本足够长但名单空。', []), []);
  assert.deepEqual(deriveRelationRows(null, null), []);
});

test('deriveRelationRows：en 决裂命中（divorced）', () => {
  assert.deepEqual(deriveRelationRows('Wang and Lucy divorced last year.', ['Wang', 'Lucy']), [
    { name: 'Wang', other: 'Lucy', rift: true, reconciled: false, close: false },
  ]);
});

test('deriveRelationRows：en 词界防误伤（huge 不中 hug）', () => {
  assert.deepEqual(deriveRelationRows('Wang gave Lucy a huge gift.', ['Wang', 'Lucy']), []);
});

test('deriveRelationRows：同对跨句聚合（先决裂后和好 → 一行两标记）', () => {
  assert.deepEqual(deriveRelationRows('陈峰与沈青澜离婚。\n后来陈峰与沈青澜和好了。', ['陈峰', '沈青澜']), [
    { name: '陈峰', other: '沈青澜', rift: true, reconciled: true, close: false },
  ]);
});

// —— normalizeRelRow：摘要规范化 ——

test('normalizeRelRow：合法行入账，ep/name/other 非法 → null，布尔仅认 true', () => {
  assert.deepEqual(
    normalizeRelRow({ ep: 2.6, name: ' 陈峰 ', other: ' 沈青澜 ', rift: 1, reconciled: 'true', close: true }),
    { ep: 3, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: true },
  );
  assert.equal(normalizeRelRow({ ep: 0, name: '陈峰', other: '沈青澜' }), null);
  assert.equal(normalizeRelRow({ ep: NaN, name: '陈峰', other: '沈青澜' }), null);
  assert.equal(normalizeRelRow({ ep: 3, other: '沈青澜' }), null); // 缺 name
  assert.equal(normalizeRelRow({ ep: 3, name: '陈峰' }), null); // 缺 other
  assert.equal(normalizeRelRow({ ep: 3, name: '陈峰', other: '陈峰' }), null); // 自己配自己
  assert.equal(normalizeRelRow(null), null);
});

// —— relationshipLedger：跨集记账 ——

test('relationshipLedger：空序列 → 无名册无问题', () => {
  const r = relationshipLedger([], 5);
  assert.deepEqual(r.rifted, []);
  assert.deepEqual(r.issues, []);
});

test('relationshipLedger：首见决裂入册不报 + 同集同对以后到为准', () => {
  const inBook = relationshipLedger([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: true },
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
  ], 2);
  assert.deepEqual(inBook.rifted, [{ a: '陈峰', b: '沈青澜', riftEp: 1 }]);
  assert.deepEqual(inBook.issues, []);
  const corrected = relationshipLedger([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 1, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: false }, // 同集修正：没决裂
  ], 2);
  assert.deepEqual(corrected.rifted, []);
  assert.deepEqual(corrected.issues, []);
});

test('relationshipLedger：决裂后隔集亲密 → 关系穿帮 high（每对只报 1 次）', () => {
  const r = relationshipLedger([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 2, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: true },
    { ep: 3, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: true }, // 已报出册，不再重复
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'rifted_but_close');
  assert.ok(r.issues[0].evidence.includes('第 1 集'));
  assert.ok(r.issues[0].evidence.includes('第 2 集'));
  assert.deepEqual(r.rifted, []); // 报过即出册
});

test('relationshipLedger：修复出册后再亲密不再追踪', () => {
  const r = relationshipLedger([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 2, name: '陈峰', other: '沈青澜', rift: false, reconciled: true, close: false },
    { ep: 3, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: true },
  ], 4);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.rifted, []);
});

test('relationshipLedger：决裂后无亲密（close=false）不报且保持名册', () => {
  const r = relationshipLedger([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 2, name: '陈峰', other: '沈青澜', rift: false, reconciled: false, close: false },
  ], 3);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.rifted, [{ a: '陈峰', b: '沈青澜', riftEp: 1 }]);
});

test('relationshipLedger：同集和解+亲密是合法修复（不报且出册）', () => {
  const r = relationshipLedger([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 2, name: '陈峰', other: '沈青澜', rift: false, reconciled: true, close: true },
  ], 3);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.rifted, []);
});

test('relationshipLedger：乱序安全 + 只认 < curEpNo 的行 + 无序对合并', () => {
  const r = relationshipLedger([
    { ep: 2, name: '沈青澜', other: '陈峰', rift: false, reconciled: false, close: true }, // 顺序反写，仍命中同对
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 9, name: '王虎', other: '李梅', rift: true, reconciled: false, close: false }, // 未完成集剔除
  ], 4);
  assert.equal(r.issues.length, 1); // 无序对合并：反写名字与入册对合并
  assert.ok(r.issues[0].evidence.includes('陈峰与沈青澜'));
  assert.deepEqual(r.rifted, []); // 报过即出册
});

// —— relationshipDirective：架构师指令 ——

test('relationshipDirective：名册非空出"翻转账本"指令，zh 含名单/集号/修复台阶', () => {
  const b = relationshipDirective([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 2, name: '王虎', other: '李梅', rift: true, reconciled: false, close: false },
  ]);
  assert.ok(b.zh.includes('【跨集关系·翻转账本】'));
  assert.ok(b.zh.includes('陈峰×沈青澜（第1集决裂）'));
  assert.ok(b.zh.includes('王虎×李梅（第2集决裂）'));
  assert.ok(b.zh.includes('修复台阶'));
});

test('relationshipDirective：en 层系统文案零中文（人名透传）', () => {
  const b = relationshipDirective([
    { ep: 1, name: 'Wang', other: 'Lucy', rift: true, reconciled: false, close: false },
  ]);
  assert.ok(b.en.includes('[Cross-episode relationship'));
  assert.ok(b.en.includes('Wang × Lucy (rift ep1)'));
  assert.ok(b.en.includes('repair beat'));
  assert.ok(!/[\u4e00-\u9fff]/.test(b.en));
});

test('relationshipDirective：无输入/修复清册后 → 空串（两语言一致）', () => {
  assert.deepEqual(relationshipDirective([]), { zh: '', en: '' });
  const cleared = relationshipDirective([
    { ep: 1, name: '陈峰', other: '沈青澜', rift: true, reconciled: false, close: false },
    { ep: 2, name: '陈峰', other: '沈青澜', rift: false, reconciled: true, close: false },
  ]);
  assert.equal(cleared.zh, '');
  assert.equal(cleared.en, '');
});
