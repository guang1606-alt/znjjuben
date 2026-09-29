/**
 * vehicle-jam 单测（块133）：载具掐点故障 / 车辆阀门检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       来路/处理两路 rescue（含同行 rescue）、双锚缺一放行、
 *       距离超窗、场景头不参与、同行共现、en 全链路、en rescue、
 *       en 零 CJK、zh 元数据。
 * 语料经验（块103/104教训前置应用）：FAIL 与 CRIT 行都占位，
 *       事件组间必须插 ≥1 行零词表词隔离行（"地库的灯管嗡嗡响。"）
 *       防误合并；首次豁免后 hits 只含第 2 事件；首个场景头=scene 0。
 * 划界语料：trafficOnCue 管外部路况（堵车/封路/班次刚走），本引擎
 *       管身下车况（打不着火/爆胎/抛锚）——"车刚开走"类班次词不收。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { vehicleJam } = require('../dist/engine/vehicle-jam.js');

test('ex01 空稿满分', () => {
  const r = vehicleJam('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次熄火是经典悬念不进 hits', () => {
  const r = vehicleJam([
    '△地库里，他拉开车门。',
    '反派：把钥匙给我。',
    '小舟：你猜我敢不敢。',
    '△他拉开车门，正要开车追出去。',
    '△拧动钥匙——发动机打不着火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = vehicleJam([
    '△地库里，他拉开车门。',
    '小舟：你猜你追不追得上。',
    '△他正要开车追出去。',
    '△拧动钥匙——打不着火了。',
    '△地库的水塔滴着水。',
    '△巷口，他急着赶去堵人。',
    '△再拧钥匙，还是发动不起来。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex04 相邻≤2行的失灵行合并为同一事件', () => {
  const r = vehicleJam([
    '△他正要开车追出去。',
    '△拧动钥匙——打不着火。',
    '△再拧一次，还是发动不起来。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件（zh 元数据）', () => {
  const r = vehicleJam([
    '内景 地库 夜',
    '△他拉开车门，正要开车追出去。',
    '△拧动钥匙——发动机打不着火了。',
    '外景 巷口 夜',
    '△他正要发动车追上去。',
    '△半路熄火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].sceneIndex, 1); /* 首个场景头 = scene 0，第二段 = scene 1 */
  assert.ok(r.hits[0].sceneHeader.includes('巷口'));
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex06 来路锚 rescue：破车抛锚（来路词与失灵词同行）', () => {
  const r = vehicleJam([
    '△他拉开车门，正要开车追出去。',
    '△这辆破车又抛锚了。',
    '△地库的灯管嗡嗡响。',
    '△他急着赶去机场。',
    '△车又抛锚了，这辆老爷车早该报废了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 处理锚 rescue：换备胎排障（失灵后两行内）', () => {
  const r = vehicleJam([
    '△他急着送医，拉开车门。',
    '△拧动钥匙——打不着火。',
    '△地库的灯管嗡嗡响。',
    '△他急着赶去码头。',
    '△半路爆胎了。',
    '△他蹲在路边换上备胎，满手油污。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 处理锚 rescue：弃车拦出租换方案', () => {
  const r = vehicleJam([
    '△他正要开车追出去。',
    '△车突然熄火了。',
    '△地库的灯管嗡嗡响。',
    '△他急着赶去车站。',
    '△又打不着火了。',
    '△他拦了辆出租车继续追。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯失灵无赶路放行（修车铺交代车况/加油）', () => {
  const r = vehicleJam([
    '△修车铺里，师傅说他这车老趴窝。',
    '△回去得好好修一修。',
    '△油箱见底了，先去加满。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 纯赶路无失灵放行（正常打车赶到）', () => {
  const r = vehicleJam([
    '△他打车赶到机场，航班还没起飞。',
    '小舟：开门。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗：赶路与失灵隔4行不配对', () => {
  const r = vehicleJam([
    '△他正要开车追出去。',
    '△巷口的灯忽明忽暗。',
    '△檐角积着去年的枯叶。',
    '△天台的水塔滴着水。',
    '△车打不着火了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 三次未救：n=2 → 50', () => {
  const r = vehicleJam([
    '△他正要开车追出去。',
    '△车突然熄火了。',
    '△地库的灯管嗡嗡响。',
    '△他急着赶去码头。',
    '△又打不着火了。',
    '△巷口的灯忽明忽暗。',
    '△他要追凶，正要发动车。',
    '△车又趴窝了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.strictEqual(r.hits[1].line, 8);
});

test('ex13 场景头行不参与匹配（头含"打不着火"不成事件）', () => {
  const r = vehicleJam([
    '内景 打不着火汽修厂 夜',
    '△他急着赶去码头，正要开车。',
    '△师傅把钥匙抛给他。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex14 同行共现：正要追与打不着火同句判一次事件', () => {
  const r = vehicleJam('△他正要开车追出去，车却打不着火了。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = vehicleJam([
    'He pulled open the car door, about to chase the suspect.',
    "He turned the key - the car wouldn't start.",
    'Rain dripped from the water tower.',
    'He was rushing to the airport.',
    'The truck stalled out halfway.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.ok(!/[一-鿿]/.test(r.hits[0].reason));
});

test('ex16 en 来路锚 rescue：old car broke down, a real clunker', () => {
  const r = vehicleJam([
    'He was about to drive off and chase the thief.',
    'The old car broke down again - a real clunker.',
    'Rain drummed on the tin roof.',
    'Ethan needed to get there before dawn.',
    "The car wouldn't start again - the beater was never reliable.",
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 零 CJK：输出串不含中文', () => {
  const r = vehicleJam([
    'He was about to drive off and chase the thief.',
    'Rain drummed on the tin roof.',
    "The car wouldn't start again.",
    'Ethan needed to get there before dawn.',
    'Rain drummed on the tin roof.',
    'The truck stalled out halfway.',
  ].join('\n'));
  assert.strictEqual(r.unrescuedCount, 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)));
});
