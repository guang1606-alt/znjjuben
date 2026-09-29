/**
 * wake-up-call 单测（块101）：一句话点醒 / 说教治愈检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       挣扎/时间过程双 rescue、双锚缺一放行、距离超窗、
 *       en 全链路、en rescue、en 零 CJK、zh 元数据。
 * 语料经验（块100 沉淀）：每组事件自带 KNOT 行且距 WAKE 行 ≤2；
 * rescue 行不占 KNOT 位；sceneIdx 从 -1 自增（首场景头后 = 0）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { wakeUpCall } = require('../dist/engine/wake-up-call.js');

test('ex01 空稿满分', () => {
  const r = wakeUpCall('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次被点醒是情感高光不进 hits', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '△她低下头。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
    '他：原来我恨错了人……我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行的点醒行合并为同一事件', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '她低下头。',
    '她：我懂了，这些年的怨恨都白费了。',
    '△她抬起头。',
    '△灯亮起。',
    '他：原来我恨错了人……我想通了。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并：两段各算一事件', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '内景 书房 夜',
    '他：原来我恨错了人……我想通了。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.ok(r.hits[0].sceneHeader.includes('书房'));
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex06 挣扎锚 rescue：攥紧拳头僵了很久', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '△她低下头。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
    '△他攥紧了拳头，僵了很久。',
    '他：原来我恨错了人……我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 时间过程锚 rescue：一夜没睡翻来覆去', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '△她低下头。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
    '△他翻来覆去一夜没睡，才来找她。',
    '他：原来我恨错了人……我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯心结陈述无点醒行放行（创伤展示本身是戏）', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '△她枯坐了一夜。',
    '周砚：你还好吗？',
    '她：没事。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯顿悟无长期心结放行（普通感悟）', () => {
  const r = wakeUpCall([
    '周砚：想好了？',
    '她：我想通了。',
    '△她给两人倒了茶。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗：心结与点醒隔4行不配对', () => {
  const r = wakeUpCall([
    '△她攥着怀表，这是她二十年解不开的心结。',
    '△雨停了。',
    '△灯亮起。',
    '△她抬起头。',
    '她：我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 三次未救：n=2 → 50', () => {
  const r = wakeUpCall([
    '△她攥着怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '△她低下头。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
    '他：原来我恨错了人……我想通了。',
    '△他把照片收起来。',
    '△阴影在她心里压了半辈子。',
    '她：你说的对……我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex12 五次未救：n=4 → 封底 20', () => {
  const r = wakeUpCall([
    '△她攥着怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '△她低下头。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
    '他：原来我恨错了人……我想通了。',
    '△他把照片收起来。',
    '△阴影在她心里压了半辈子。',
    '她：你说的对……我想通了。',
    '△茶凉了。',
    '△他惦记那个人的执念折磨了他多年。',
    '他：如今豁然开朗了。',
    '△雨落下来。',
    '△这些年欠下的债，她一直放不下。',
    '她：我想通了。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex13 en 全链路：两事件 n=1 → 70', () => {
  const r = wakeUpCall([
    'Maya has never gotten over her mother\'s death.',
    '△Elena sits across from her.',
    'Maya: You\'re right. I see it now.',
    '△The room goes quiet.',
    'He has hated him for ten years.',
    'He: I see it now. I hated the wrong man.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex14 en 挣扎锚 rescue：fists clenched', () => {
  const r = wakeUpCall([
    'Maya has never gotten over her mother\'s death.',
    '△Elena sits across from her.',
    'Maya: You\'re right. I see it now.',
    '△The room goes quiet.',
    'He has hated him for ten years.',
    'His fists clenched and he stared for a long time.',
    'He: I see it now.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 纯心结陈述无点醒行放行', () => {
  const r = wakeUpCall([
    'Maya has never gotten over her mother\'s death.',
    '△She keeps the watch in a drawer.',
    'Elena pours two cups of tea.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 层零中文：issues/advice/reason 无 CJK', () => {
  const r = wakeUpCall([
    'Maya has never gotten over her mother\'s death.',
    '△Elena sits across from her.',
    'Maya: You\'re right. I see it now.',
    '△The room goes quiet.',
    'He has hated him for ten years.',
    'He: I see it now. I hated the wrong man.',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.issues[0] || ''));
  assert.ok(r.advice.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.advice[0] || ''));
  assert.ok(!/[\u4e00-\u9fff]/.test(r.hits[0].reason || ''));
});

test('ex17 zh 元数据：issues/advice/reason 中文', () => {
  const r = wakeUpCall([
    '△她攥着母亲的怀表，这是她二十年解不开的心结。',
    '周砚：你妈要是在，也不想看你这样活着。',
    '她：你说的对……我想通了。',
    '△她低下头。',
    '△那是他恨了十年的仇人留下的最后一张合影。',
    '他：原来我恨错了人……我想通了。',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(r.issues[0].includes('说教治愈'));
  assert.ok(r.advice[0].includes('挣扎'));
  assert.ok(r.hits[0].reason.includes('一句话点醒'));
});
