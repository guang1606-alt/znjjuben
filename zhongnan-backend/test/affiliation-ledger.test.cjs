// v2.80 阵营归属账本（affiliation-ledger）测试：信号提取 / 摘要规范化 / 跨集记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveAffiliationRows,
  normalizeAffRow,
  affiliationLedger,
  affiliationDirective,
} = require('../dist/engine/affiliation-ledger.js');

// —— deriveAffiliationRows：信号提取 ——

test('deriveAffiliationRows：zh 脱离命中（叛出+动词后组织名提取）', () => {
  assert.deepEqual(deriveAffiliationRows('陈峰叛出青云宗，远走北漠。', ['陈峰', '沈青澜']), [
    { name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
  ]);
});

test('deriveAffiliationRows：zh 回归命中（重归+门下尾缀截断）', () => {
  assert.deepEqual(deriveAffiliationRows('陈峰重归青云宗门下。', ['陈峰']), [
    { name: '陈峰', org: '青云宗', left: false, rejoined: true, loyal: false },
  ]);
});

test('deriveAffiliationRows：zh 身份后缀效忠（青云宗长老）', () => {
  assert.deepEqual(deriveAffiliationRows('△陈峰仍以青云宗长老的身份主持大典。', ['陈峰']), [
    { name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true },
  ]);
});

test('deriveAffiliationRows：zh 名义/旗号句式效忠', () => {
  assert.deepEqual(deriveAffiliationRows('陈峰以青云宗的名义收拢旧部。', ['陈峰']), [
    { name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true },
  ]);
  assert.deepEqual(deriveAffiliationRows('陈峰打着青云宗的旗号招摇撞骗。', ['陈峰']), [
    { name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true },
  ]);
});

test('deriveAffiliationRows：zh 同句多路径合并（叛出+自称弟子 → 一行双标记）', () => {
  assert.deepEqual(deriveAffiliationRows('陈峰既已叛出青云宗，为何还自称青云宗弟子', ['陈峰']), [
    { name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: true },
  ]);
});

test('deriveAffiliationRows：zh 卧底豁免（潜伏不算效忠；脱离不受豁免影响）', () => {
  assert.deepEqual(deriveAffiliationRows('陈峰潜伏青云宗，仍以青云宗弟子的身份示人。', ['陈峰']), []);
  assert.deepEqual(deriveAffiliationRows('陈峰被青云宗除名后诈降烈阳教。', ['陈峰']), [
    { name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
  ]);
});

test('deriveAffiliationRows：zh 黑名单分工（断绝关系/逐出家门归 relationship-ledger）', () => {
  assert.deepEqual(deriveAffiliationRows('陈峰与沈青澜脱离关系，形同陌路。', ['陈峰', '沈青澜']), []);
  assert.deepEqual(deriveAffiliationRows('陈峰被家族逐出家门。', ['陈峰']), []);
});

test('deriveAffiliationRows：en 脱离命中（left the Silver Hand → Silver Hand）', () => {
  assert.deepEqual(deriveAffiliationRows('Wang left the Silver Hand last winter.', ['Wang']), [
    { name: 'Wang', org: 'Silver Hand', left: true, rejoined: false, loyal: false },
  ]);
});

test('deriveAffiliationRows：en 回归命中 + 小写宾语不误伤（the room/job 非组织）', () => {
  assert.deepEqual(deriveAffiliationRows('Wang rejoined the Silver Hand.', ['Wang']), [
    { name: 'Wang', org: 'Silver Hand', left: false, rejoined: true, loyal: false },
  ]);
  assert.deepEqual(deriveAffiliationRows('Wang left the room quietly.', ['Wang']), []);
  assert.deepEqual(deriveAffiliationRows('Wang quit his job.', ['Wang']), []);
});

test('deriveAffiliationRows：名字不在名单不配对 + 空输入安全返回空数组', () => {
  assert.deepEqual(deriveAffiliationRows('路人甲叛出青云宗。', ['陈峰']), []);
  assert.deepEqual(deriveAffiliationRows('', ['陈峰']), []);
  assert.deepEqual(deriveAffiliationRows('陈峰叛出青云宗', []), []);
  assert.deepEqual(deriveAffiliationRows(null, null), []);
});

// —— normalizeAffRow：摘要规范化 ——

test('normalizeAffRow：合法行入账，ep/name/org 非法 → null，布尔仅认 true', () => {
  assert.deepEqual(
    normalizeAffRow({ ep: 2.6, name: ' 陈峰 ', org: ' 青云宗 ', left: 1, rejoined: 'true', loyal: true }),
    { ep: 3, name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true },
  );
  assert.equal(normalizeAffRow({ ep: 0, name: '陈峰', org: '青云宗' }), null);
  assert.equal(normalizeAffRow({ ep: NaN, name: '陈峰', org: '青云宗' }), null);
  assert.equal(normalizeAffRow({ ep: 3, name: '陈峰' }), null); // 缺 org
  assert.equal(normalizeAffRow({ ep: 3, name: '陈峰', org: '青' }), null); // org 超短
  assert.equal(normalizeAffRow(null), null);
});

// —— affiliationLedger：跨集记账 ——

test('affiliationLedger：空序列 → 无名册无问题', () => {
  const r = affiliationLedger([], 5);
  assert.deepEqual(r.departed, []);
  assert.deepEqual(r.issues, []);
});

test('affiliationLedger：首见脱离入册不报 + 同集同名同组织以后到为准', () => {
  const inBook = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
  ], 2);
  assert.deepEqual(inBook.departed, [{ name: '陈峰', org: '青云宗', leftEp: 1 }]);
  assert.deepEqual(inBook.issues, []);
  const corrected = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
    { ep: 1, name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: false }, // 同集修正：没脱离
  ], 2);
  assert.deepEqual(corrected.departed, []);
  assert.deepEqual(corrected.issues, []);
});

test('affiliationLedger：脱离后隔集效忠 → 阵营穿帮 high（每对只报 1 次）', () => {
  const r = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
    { ep: 2, name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true },
    { ep: 3, name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true }, // 已报出册，不再重复
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'high');
  assert.equal(r.issues[0].type, 'left_but_loyal');
  assert.ok(r.issues[0].evidence.includes('第 1 集'));
  assert.ok(r.issues[0].evidence.includes('第 2 集'));
  assert.deepEqual(r.departed, []); // 报过即出册
});

test('affiliationLedger：回归出册后再效忠不再追踪', () => {
  const r = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
    { ep: 2, name: '陈峰', org: '青云宗', left: false, rejoined: true, loyal: false },
    { ep: 3, name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: true },
  ], 4);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.departed, []);
});

test('affiliationLedger：脱离后无效忠不报且保持名册', () => {
  const r = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
    { ep: 2, name: '陈峰', org: '青云宗', left: false, rejoined: false, loyal: false },
  ], 3);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.departed, [{ name: '陈峰', org: '青云宗', leftEp: 1 }]);
});

test('affiliationLedger：同集脱离+回归 = 本集内过渡（以重归收尾出册）', () => {
  const r = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: true, loyal: false },
  ], 2);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.departed, []);
});

test('affiliationLedger：多组织并行记账（name×org 独立键，只报命中者）', () => {
  const r = affiliationLedger([
    { ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false },
    { ep: 2, name: '陈峰', org: '烈阳教', left: true, rejoined: false, loyal: false },
    { ep: 3, name: '陈峰', org: '烈阳教', left: false, rejoined: false, loyal: true },
  ], 4);
  assert.equal(r.issues.length, 1);
  assert.ok(r.issues[0].evidence.includes('烈阳教'));
  assert.deepEqual(r.departed, [{ name: '陈峰', org: '青云宗', leftEp: 1 }]); // 青云宗仍在册
});

// —— affiliationDirective：架构师指令 ——

test('affiliationDirective：名册空返回空串', () => {
  assert.deepEqual(affiliationDirective([]), { zh: '', en: '' });
});

test('affiliationDirective：zh 层含账本头与脱离名册与禁令', () => {
  const d = affiliationDirective([{ ep: 1, name: '陈峰', org: '青云宗', left: true, rejoined: false, loyal: false }]);
  assert.ok(d.zh.includes('【跨集阵营·归属账本】'));
  assert.ok(d.zh.includes('陈峰×「青云宗」'));
  assert.ok(d.zh.includes('严禁'));
});

test('affiliationDirective：en 层零中文（人名/组织名透传）', () => {
  const d = affiliationDirective([{ ep: 1, name: 'Wang', org: 'Silver Hand', left: true, rejoined: false, loyal: false }]);
  assert.ok(d.en.includes('[Cross-episode affiliation'));
  assert.ok(d.en.includes('Wang × "Silver Hand"'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en));
});
