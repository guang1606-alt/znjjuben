/**
 * v2.373 AIGC 外观登记台账前置教学 —— buildLookRegistryDirective
 * 缺口：lookRegistryCheck（v2.356）检测存在，pipeline 已消费，但无生成侧前置教学；
 *       既有 aigcScreenplayDirective 规则 5 只给泛化承诺（首次出场登记/全集继承/换装重登记），
 *       未点名三类型与扣分（主角 ≥3 句 high 22 / 配角 1-2 句 mid 10 / 迟到 mid 10 / 同场互斥 mid 10）、
 *       未说明「只算有台词角色、旁白/群体豁免」「名归一」「同场两次互斥必为笔误」。
 * 本组用例：制式门控（LIVE 空串）+ zh 教学覆盖 + en 零中文。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLookRegistryDirective } = require('../dist/engine/look-registry-check');

// ---------- 1. 制式门控：LIVE 真人稿无外观槽机制 → 空串 ----------
test('LIVE: 真人稿返回空串（演员服化道由服装组管）', () => {
  assert.equal(buildLookRegistryDirective('LIVE', 'zh'), '');
  assert.equal(buildLookRegistryDirective('LIVE', 'en'), '');
});

// ---------- 2. 缺省 format=LIVE → 空串 ----------
test('缺省: 不传 format 时按 LIVE 返回空串', () => {
  assert.equal(buildLookRegistryDirective(), '');
  assert.equal(buildLookRegistryDirective(undefined, 'zh'), '');
});

// ---------- 3. zh：登记槽写法与多角色分号 ----------
test('zh: 教（外观：角色名=服装/发型/道具；…）登记写法与分号分隔', () => {
  const d = buildLookRegistryDirective('AIGC', 'zh');
  assert.ok(d.includes('（外观：'), '未教（外观：…）登记槽写法');
  assert.ok(d.includes('分号'), '未说明多角色分号分隔');
});

// ---------- 4. zh：主角/配角分级与 22/10 扣分 ----------
test('zh: 点名主角 ≥3 句 high 扣 22、配角 1-2 句 mid 扣 10', () => {
  const d = buildLookRegistryDirective('AIGC', 'zh');
  assert.ok(/主角/.test(d) && /配角/.test(d), '未点名主角/配角分级');
  assert.ok(/22/.test(d) && /10/.test(d), '未点名 22/10 扣分');
  assert.ok(/≥3|3 句/.test(d), '未点名主角 ≥3 句阈值');
});

// ---------- 5. zh：首次出场登记 + 全集继承 + 换装重新登记 ----------
test('zh: 教首次出场登记一次、全集沿用继承、只有换装才重新登记', () => {
  const d = buildLookRegistryDirective('AIGC', 'zh');
  assert.ok(/首次出场/.test(d), '未教首次出场登记');
  assert.ok(/继承|沿用/.test(d), '未教全集继承');
  assert.ok(/换装/.test(d) && /重新登记/.test(d), '未教换装重新登记');
});

// ---------- 6. zh：登记迟到 + 同场互斥笔误 ----------
test('zh: 教登记不得晚于首次出场；同场两次互斥必为笔误', () => {
  const d = buildLookRegistryDirective('AIGC', 'zh');
  assert.ok(/迟到/.test(d), '未教登记迟到');
  assert.ok(/同场/.test(d), '未教同场矛盾');
  assert.ok(/互斥|笔误/.test(d), '未说明同场互斥必为笔误');
});

// ---------- 7. zh：只算有台词角色；旁白/群体豁免 ----------
test('zh: 只统计有台词角色，旁白/解说/群体豁免', () => {
  const d = buildLookRegistryDirective('AIGC', 'zh');
  assert.ok(/有台词/.test(d), '未说明只算有台词角色');
  assert.ok(/旁白/.test(d), '未说明旁白豁免');
  assert.ok(/群体|众人|群众/.test(d), '未说明群体豁免');
});

// ---------- 8. zh：名归一（去空格/统一大小写，同一角色只算一个） ----------
test('zh: 教登记与台词统一写法，同一角色只算一个', () => {
  const d = buildLookRegistryDirective('AIGC', 'zh');
  assert.ok(/统一写法|归一/.test(d), '未教名归一');
  assert.ok(/只算一个|同一个角色/.test(d), '未说明同名只算一个');
});

// ---------- 9. en：零中文 + 教 (LOOK: …) + persist / re-register ----------
test('en: 零中文，教 (LOOK: …) 写法与 persist / re-register 纪律', () => {
  const d = buildLookRegistryDirective('AIGC', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), `en 指令混入中文: ${d}`);
  assert.ok(d.includes('(LOOK:'), 'en 未教 (LOOK: …) 写法');
  assert.ok(/persist|inherit/i.test(d), 'en 未教继承');
  assert.ok(/re-register|costume change/i.test(d), 'en 未教换装重新登记');
});

// ---------- 10. en：22/10 分级 + late + same-scene conflict + exemption ----------
test('en: 点名 22/10 分级、late registry、same-scene conflict、豁免', () => {
  const d = buildLookRegistryDirective('AIGC', 'en');
  assert.ok(/22/.test(d) && /10/.test(d), 'en 未点名 22/10 扣分');
  assert.ok(/late/i.test(d), 'en 未教 late registry');
  assert.ok(/conflict/i.test(d), 'en 未教 same-scene conflict');
  assert.ok(/exempt/i.test(d), 'en 未说明豁免');
});
