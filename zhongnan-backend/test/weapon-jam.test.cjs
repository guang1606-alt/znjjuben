/**
 * weapon-jam 单测（块105）：武器哑火 / 装备阀门检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       来路/处理两路 rescue（含同行 rescue）、双锚缺一放行、
 *       距离超窗、场景头不参与、同行共现、en 全链路、en rescue、
 *       en 零 CJK、zh 元数据。
 * 语料经验（块103/104教训前置应用）：FAIL 与 CRIT 行都占位，
 *       事件组间必须插 ≥2 行零词表词隔离行（"天台的水塔滴着水。"）
 *       防误合并；首次豁免后 hits 只含第 2 事件；首个场景头=scene 0。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { weaponJam } = require('../dist/engine/weapon-jam.js');

test('ex01 空稿满分', () => {
  const r = weaponJam('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次哑火是经典悬念不进 hits', () => {
  const r = weaponJam([
    '△天台上，风很大。',
    '反派：把枪放下。',
    '小舟：你猜我敢不敢。',
    '△他举枪瞄准小舟。',
    '△他扣下扳机——咔哒，枪哑火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = weaponJam([
    '△天台上，风很大。',
    '小舟：你猜我敢不敢。',
    '△他举枪瞄准小舟。',
    '△他扣下扳机——咔哒，枪哑火了。',
    '△天台的水塔滴着水。',
    '△角斗场上，他瞄准了老周。',
    '△扣下扳机，枪里没子弹。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行的失灵行合并为同一事件', () => {
  const r = weaponJam([
    '△他瞄准了门锁。',
    '△扣下扳机——卡壳了。',
    '△再扣一次，还是空膛。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件（zh 元数据）', () => {
  const r = weaponJam([
    '内景 废弃厂房 夜',
    '△他举枪瞄准了看场子的。',
    '△扣下扳机，没子弹。',
    '外景 天台 夜',
    '△他举枪瞄准小舟。',
    '△枪哑火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].sceneIndex, 1); /* 首个场景头 = scene 0，第二段 = scene 1 */
  assert.ok(r.hits[0].sceneHeader.includes('天台'));
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex06 来路锚 rescue：土造私枪哑火（来路词与失灵词同行）', () => {
  const r = weaponJam([
    '△他举枪瞄准了债主。',
    '△那把土造的私枪又哑火了。',
    '△天台的水塔滴着水。',
    '△他举枪瞄准老周。',
    '△子弹受潮，枪又哑火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 处理锚 rescue：退壳拉栓排故障（失灵后一行）', () => {
  const r = weaponJam([
    '△他举枪瞄准了看场子的。',
    '△扣下扳机，没子弹。',
    '△天台的水塔滴着水。',
    '△他举枪瞄准老周。',
    '△枪哑火了。',
    '△他蹲下退出卡壳的弹壳，拉枪栓排故障。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 处理锚 rescue：扔枪拔刀换方案', () => {
  const r = weaponJam([
    '△他举枪瞄准了陈金海。',
    '△枪哑火了。',
    '△天台的水塔滴着水。',
    '△他举枪瞄准陈金海。',
    '△又一声空膛。',
    '△他扔了枪，拔出匕首扑上去。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯失灵无对峙放行（打靶耗弹/老枪道具交代）', () => {
  const r = weaponJam([
    '△靶场里，他打完了最后一箱子弹。',
    '△这枪老卡壳，他早就想换了。',
    '△回去得好好擦一擦。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 纯对峙无失灵放行（正常开枪命中）', () => {
  const r = weaponJam([
    '△他瞄准了挂锁，扣下扳机，锁应声而断。',
    '小舟：开门。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗：对峙与哑火隔4行不配对', () => {
  const r = weaponJam([
    '△他举枪瞄准小舟。',
    '△风把他的衣角吹得猎猎作响。',
    '△天台的水塔滴着水。',
    '△檐角积着去年的枯叶。',
    '△枪哑火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 三次未救：n=2 → 50', () => {
  const r = weaponJam([
    '△他举枪瞄准小舟。',
    '△枪哑火了。',
    '△天台的水塔滴着水。',
    '△他举枪瞄准老周。',
    '△扣下扳机，没子弹。',
    '△檐角积着去年的枯叶。',
    '△他举枪瞄准看场子的。',
    '△又是空膛。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.strictEqual(r.hits[1].line, 8);
});

test('ex13 场景头行不参与匹配（头含"卡壳"不成事件）', () => {
  const r = weaponJam([
    '内景 卡壳钟表店 夜',
    '△他举枪瞄准了劫匪。',
    '△劫匪也被他震住了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex14 同行共现：扣扳机与空膛同句判一次事件', () => {
  const r = weaponJam('△他扣下扳机——空膛。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = weaponJam([
    'The rooftop wind howled.',
    'Ethan: Put the gun down.',
    'Victor aimed the gun at Ethan and pulled the trigger - the pistol misfired.',
    'Rain dripped from the water tower.',
    "Victor pointed the gun at Ethan's chest.",
    'He pulled the trigger - the gun clicked empty.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.ok(!/[一-鿿]/.test(r.hits[0].reason));
});

test('ex16 en 来路锚 rescue：rusted revolver misfired', () => {
  const r = weaponJam([
    'Victor aimed the gun at Ethan and pulled the trigger - the pistol misfired.',
    'Rain dripped from the water tower.',
    "Victor pointed the gun at Ethan's chest.",
    'The rusted old revolver misfired again.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 零 CJK：输出串不含中文', () => {
  const r = weaponJam([
    'He aimed the gun at Ethan and pulled the trigger - the pistol misfired.',
    'Rain drummed on the tin roof.',
    "He pointed the gun at Ethan's chest.",
    'He pulled the trigger - the gun clicked empty.',
  ].join('\n'));
  assert.strictEqual(r.unrescuedCount, 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)));
});
