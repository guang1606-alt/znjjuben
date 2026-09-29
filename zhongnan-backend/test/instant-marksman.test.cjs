/**
 * instant-marksman 单测（块99）：神枪手一枪毙命/技能开挂检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头、
 *       来路/失手双 rescue、双锚缺一放行、距离超窗、
 *       en 全链路、en rescue、en 零 CJK、zh 元数据。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantMarksman } = require('../dist/engine/instant-marksman.js');

test('ex01 空稿满分', () => {
  const r = instantMarksman('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次百步穿杨是爽点不进 hits', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△枪声。',
    '△子弹正中太阳穴。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△枪声。',
    '△子弹正中太阳穴。',
    '△他退出弹壳。',
    '△他开了一枪。',
    '△依旧正中靶心。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行射击行合并为同一事件', () => {
  const r = instantMarksman([
    '△陈锐开枪，正中太阳穴。',
    '△枪声在靶场回荡。',
    '△他又开一枪，仍然正中眉心。',
    '△他收枪入套。',
    '△人群散开。',
    '△灯亮起。',
    '△他再次举枪，一枪爆头。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并：两段各算一事件', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△子弹正中太阳穴。',
    '内景 靶场 日',
    '△他开了一枪。',
    '△依旧正中靶心。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.ok(r.hits[0].sceneHeader.includes('靶场'));
});

test('ex06 来路锚 rescue：十年前的射击冠军', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△枪声。',
    '△子弹正中太阳穴。',
    '△人群里有人低声嘀咕。',
    '△他收枪入套。十年前的射击冠军。',
    '△他再次举枪。',
    '△依旧正中靶心。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 失手锚 rescue：第一枪脱了靶', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△枪声。',
    '△子弹正中太阳穴。',
    '△他深吸一口气。',
    '△靶场上，他第一枪脱了靶，子弹擦着边缘飞过。',
    '△他开了一枪。',
    '△依旧正中靶心。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯射击无精准上靶放行（普通交火戏）', () => {
  const r = instantMarksman([
    '△他朝天开枪。',
    '△人群四散。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯枪法夸赞无射击动作放行（人设传说）', () => {
  const r = instantMarksman([
    '老张：他是出了名的神枪手。',
    '△老张摇了摇头。',
    '△叹了口气。',
    '老张：可这些年，他连枪都没摸过。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗：上靶与射击隔4行不配对', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△他呼吸平稳。',
    '△风停了。',
    '△时间仿佛静止。',
    '△所有人都屏住呼吸。',
    '△子弹直入眉心。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 三次未救：n=2 → 50', () => {
  const r = instantMarksman([
    '△陈锐开枪，正中太阳穴。',
    '△他换弹匣。',
    '△人群炸开锅。',
    '△他再次举枪，一枪爆头。',
    '△他换弹匣。',
    '△人群炸开锅。',
    '△他又开枪，依旧正中靶心。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex12 五次未救：n=4 → 封底 20', () => {
  const r = instantMarksman([
    '△他开枪，正中太阳穴。',
    '△换弹匣。',
    '△人群炸开锅。',
    '△他再开一枪，正中眉心。',
    '△换弹匣。',
    '△人群炸开锅。',
    '△他又开枪，一枪爆头。',
    '△换弹匣。',
    '△人群炸开锅。',
    '△他继续开枪，正中靶心。',
    '△换弹匣。',
    '△人群炸开锅。',
    '△他最后开了一枪，弹无虚发。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex13 en 全链路：两事件 n=1 → 70', () => {
  const r = instantMarksman([
    '△The range lights hummed.',
    'Maya fired a shot, the round hitting right between the eyes.',
    '△The target fell.',
    '△She reloaded.',
    '△The crowd went silent.',
    'She raised the pistol again.',
    '△A breath.',
    'Maya: Another perfect shot.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex14 en 来路锚 rescue：Olympic champion', () => {
  const r = instantMarksman([
    'Maya fired a shot, the round hitting right between the eyes.',
    '△The target fell.',
    '△She reloaded.',
    '△A former Olympic champion, retired five years.',
    'She raised the pistol again.',
    'Maya: Another perfect shot.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 纯开火无精准上靶放行', () => {
  const r = instantMarksman([
    'Maya opened fire into the air.',
    '△The crowd scattered.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 层零中文：issues/advice/reason 无 CJK', () => {
  const r = instantMarksman([
    '△The range lights hummed.',
    'Maya fired a shot, the round hitting right between the eyes.',
    '△The target fell.',
    '△She reloaded.',
    '△The crowd went silent.',
    'She raised the pistol again.',
    '△A breath.',
    'Maya: Another perfect shot.',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.issues[0] || ''));
  assert.ok(r.advice.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.advice[0] || ''));
  assert.ok(!/[\u4e00-\u9fff]/.test(r.hits[0].reason || ''));
});

test('ex17 zh 元数据：issues/advice/reason 中文', () => {
  const r = instantMarksman([
    '△陈锐举枪瞄准。',
    '△枪声。',
    '△子弹正中太阳穴。',
    '△他退出弹壳。',
    '△他开了一枪。',
    '△依旧正中靶心。',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(r.issues[0].includes('枪枪上靶'));
  assert.ok(r.advice[0].includes('枪战'));
  assert.ok(r.hits[0].reason.includes('零训练'));
});
