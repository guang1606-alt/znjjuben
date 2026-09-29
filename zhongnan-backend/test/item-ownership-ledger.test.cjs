// v2.80 信物归属账本（item-ownership-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveOwnershipRows,
  normalizeItemRow,
  itemOwnershipLedger,
  ownershipDirective,
} = require('../dist/engine/item-ownership-ledger.js');

// —— deriveOwnershipRows：信号提取 ——

test('deriveOwnershipRows：zh 让渡命中（把玉佩交给王虎）', () => {
  assert.deepEqual(deriveOwnershipRows('△陈峰把玉佩交给王虎。', '陈峰'), [
    { item: '玉佩', handed: true, regain: false, touched: true },
  ]);
});

test('deriveOwnershipRows：zh 拿回命中（要回玉佩）', () => {
  assert.deepEqual(deriveOwnershipRows('陈峰从王虎手里要回玉佩。', '陈峰'), [
    { item: '玉佩', handed: false, regain: true, touched: true },
  ]);
});

test('deriveOwnershipRows：zh 回忆性失去句豁免（"早送人了"不算经手）', () => {
  assert.deepEqual(deriveOwnershipRows('陈峰：那玉佩我早送人了。', '陈峰'), [
    { item: '玉佩', handed: false, regain: false, touched: false },
  ]);
});

test('deriveOwnershipRows：zh 多信物多行各成一行（玉佩 + 日记本）', () => {
  const rows = deriveOwnershipRows('△陈峰把玉佩交给王虎。\n△陈峰把日记本塞给沈青澜。', '陈峰');
  assert.deepEqual(rows, [
    { item: '玉佩', handed: true, regain: false, touched: true },
    { item: '日记本', handed: true, regain: false, touched: true },
  ]);
});

test('deriveOwnershipRows：他人让渡不误伤（名字不在句中）', () => {
  assert.deepEqual(deriveOwnershipRows('△王虎把玉佩交给沈青澜。', '陈峰'), []);
});

test('deriveOwnershipRows：空文本/超短名字安全返回空数组', () => {
  assert.deepEqual(deriveOwnershipRows('', '陈峰'), []);
  assert.deepEqual(deriveOwnershipRows('陈峰吐血了', '峰'), []);
  assert.deepEqual(deriveOwnershipRows('短', '陈峰'), []);
  assert.deepEqual(deriveOwnershipRows(null, null), []);
});

test('deriveOwnershipRows：en 让渡命中（handed over the locket）', () => {
  assert.deepEqual(deriveOwnershipRows('Wang handed over the locket.', 'Wang'), [
    { item: 'locket', handed: true, regain: false, touched: true },
  ]);
});

test('deriveOwnershipRows：en 词界防误伤（During 不中 ring）', () => {
  const rows = deriveOwnershipRows('During the trial Wang kept the pendant.', 'Wang');
  assert.deepEqual(rows, [{ item: 'pendant', handed: false, regain: false, touched: true }]);
});

test('deriveOwnershipRows：同信物跨句聚合（先让渡后拿回 → 一行两标记）', () => {
  assert.deepEqual(deriveOwnershipRows('△陈峰把玉佩交给王虎。\n△陈峰后来要回了玉佩。', '陈峰'), [
    { item: '玉佩', handed: true, regain: true, touched: true },
  ]);
});

// —— normalizeItemRow：摘要规范化 ——

test('normalizeItemRow：合法行入账，ep/name/item 非法 → null，布尔仅认 true', () => {
  assert.deepEqual(
    normalizeItemRow({ ep: 2.6, name: ' 陈峰 ', item: ' 玉佩 ', handed: 1, regain: 'true', touched: true }),
    { ep: 3, name: '陈峰', item: '玉佩', handed: false, regain: false, touched: true },
  );
  assert.equal(normalizeItemRow({ ep: 0, name: '陈峰', item: '玉佩' }), null);
  assert.equal(normalizeItemRow({ ep: NaN, name: '陈峰', item: '玉佩' }), null);
  assert.equal(normalizeItemRow({ ep: 3, item: '玉佩' }), null); // 缺 name
  assert.equal(normalizeItemRow({ ep: 3, name: '陈峰' }), null); // 缺 item
  assert.equal(normalizeItemRow({ ep: 3, name: '陈峰', item: '' }), null);
  assert.equal(normalizeItemRow(null), null);
});

// —— itemOwnershipLedger：跨集记账 ——

test('itemOwnershipLedger：空序列 → 无名册无问题', () => {
  const r = itemOwnershipLedger([], 5);
  assert.deepEqual(r.handed, []);
  assert.deepEqual(r.issues, []);
});

test('itemOwnershipLedger：首见让渡入册不报 + 同集同名同信物以后到为准', () => {
  const inBook = itemOwnershipLedger([
    { ep: 1, name: '陈峰', item: '日记本', handed: false, regain: false, touched: true },
    { ep: 1, name: '陈峰', item: '日记本', handed: true, regain: false, touched: true },
  ], 2);
  assert.deepEqual(inBook.handed, [{ name: '陈峰', item: '日记本', handEp: 1 }]);
  assert.deepEqual(inBook.issues, []);
  const corrected = itemOwnershipLedger([
    { ep: 1, name: '陈峰', item: '日记本', handed: true, regain: false, touched: true },
    { ep: 1, name: '陈峰', item: '日记本', handed: false, regain: false, touched: false }, // 同集修正：没让渡
  ], 2);
  assert.deepEqual(corrected.handed, []);
  assert.deepEqual(corrected.issues, []);
});

test('itemOwnershipLedger：让渡后隔集再经手 → 归属穿帮 high（每 name×item 只报 1 次）', () => {
  const r = itemOwnershipLedger([
    { ep: 1, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 2, name: '陈峰', item: '玉佩', handed: false, regain: false, touched: true },
    { ep: 3, name: '陈峰', item: '玉佩', handed: false, regain: false, touched: true }, // 已报出册，不再重复
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'handed_but_touched');
  assert.ok(r.issues[0].evidence.includes('第 1 集'));
  assert.ok(r.issues[0].evidence.includes('第 2 集'));
  assert.deepEqual(r.handed, []); // 报过即出册
});

test('itemOwnershipLedger：拿回出册后再经手不再追踪', () => {
  const r = itemOwnershipLedger([
    { ep: 1, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 2, name: '陈峰', item: '玉佩', handed: false, regain: true, touched: true },
    { ep: 3, name: '陈峰', item: '玉佩', handed: false, regain: false, touched: true },
  ], 4);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.handed, []);
});

test('itemOwnershipLedger：回忆句提及（touched=false）不报且保持名册', () => {
  const r = itemOwnershipLedger([
    { ep: 1, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 2, name: '陈峰', item: '玉佩', handed: false, regain: false, touched: false },
  ], 3);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.handed, [{ name: '陈峰', item: '玉佩', handEp: 1 }]);
});

test('itemOwnershipLedger：同集先拿回再转手是合法链（handEp 覆盖）', () => {
  const r = itemOwnershipLedger([
    { ep: 1, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 2, name: '陈峰', item: '玉佩', handed: true, regain: true, touched: true },
  ], 3);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.handed, [{ name: '陈峰', item: '玉佩', handEp: 2 }]);
});

test('itemOwnershipLedger：乱序安全 + 只认 < curEpNo 的行', () => {
  const r = itemOwnershipLedger([
    { ep: 2, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 1, name: '王虎', item: '钥匙', handed: true, regain: false, touched: true },
    { ep: 9, name: '王虎', item: '钥匙', handed: true, regain: false, touched: true }, // 未完成集剔除
  ], 4);
  assert.deepEqual(r.handed.map((h) => `${h.name}:${h.item}`), ['王虎:钥匙', '陈峰:玉佩']); // 按集升序入册
  assert.deepEqual(r.issues, []);
});

// —— ownershipDirective：架构师指令 ——

test('ownershipDirective：名册非空出"归属连续性"指令，zh 含名单/集号/拿回要求', () => {
  const b = ownershipDirective([
    { ep: 1, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 2, name: '王虎', item: '钥匙', handed: true, regain: false, touched: true },
  ]);
  assert.ok(b.zh.includes('【跨集信物·归属连续性】'));
  assert.ok(b.zh.includes('陈峰的「玉佩」（第1集让渡）'));
  assert.ok(b.zh.includes('王虎的「钥匙」（第2集让渡）'));
  assert.ok(b.zh.includes('拿回交代'));
});

test('ownershipDirective：en 层系统文案零中文（人名/信物名透传）', () => {
  const b = ownershipDirective([
    { ep: 1, name: 'Wang', item: 'locket', handed: true, regain: false, touched: true },
  ]);
  assert.ok(b.en.includes('[Item ownership continuity'));
  assert.ok(b.en.includes("Wang's \"locket\" (handed over ep1)"));
  assert.ok(b.en.includes('explicit recovery'));
  assert.ok(!/[\u4e00-\u9fff]/.test(b.en));
});

test('ownershipDirective：无输入/拿回清册后 → 空串（两语言一致）', () => {
  assert.deepEqual(ownershipDirective([]), { zh: '', en: '' });
  const cleared = ownershipDirective([
    { ep: 1, name: '陈峰', item: '玉佩', handed: true, regain: false, touched: true },
    { ep: 2, name: '陈峰', item: '玉佩', handed: false, regain: true, touched: true },
  ]);
  assert.equal(cleared.zh, '');
  assert.equal(cleared.en, '');
});
