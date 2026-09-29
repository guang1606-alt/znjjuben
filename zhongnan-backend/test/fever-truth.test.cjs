/**
 * fever-truth 单测（块135）：高烧谵妄吐真言 / 病床钥匙检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头不合并、
 *       含糊不泄/事后作废两路 rescue（含同行 rescue）、双锚缺一
 *       放行、距离超窗、场景头不参与、同行共现、en 全链路、
 *       en rescue、en 零 CJK、zh 元数据。
 * 语料经验（块103/104教训前置应用）：FEVER 锚行与 LEAK payload
 *       行都占位，事件组间必须插 ≥2 行零词表词隔离行（"病房的
 *       输液管滴着水。"）防误合并；首次豁免后 hits 只含第 2 事件；
 *       首个场景头=scene 0；合并事件 hit 行号取 FEVER 锚行。
 * 划界语料：mute/deaf/blind-on-cue 管高烧失能成因（烧坏嗓子），
 *       wound-on-cue 管伤情症状——本引擎只管发烧 × 机密共现。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { feverTruth } = require('../dist/engine/fever-truth.js');

test('ex01 空稿满分', () => {
  const r = feverTruth('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一场高烧泄密是苦情彩蛋不进 hits', () => {
  const r = feverTruth([
    '△病房里，他守在床边。',
    '△她高烧不退，烧糊涂了。',
    '△她迷迷糊糊把当年下毒的事说了出来。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = feverTruth([
    '△病房里，他守在床边。',
    '△她高烧不退，烧糊涂了。',
    '△她把当年下毒的事说了出来。',
    '△病房的输液管滴着水。',
    '△窗外落着雨。',
    '△深夜，他守在婆婆床边。',
    '△婆婆烧糊涂了，说出了账本藏在哪儿。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex04 相邻≤2行的烧态行合并为同一场病', () => {
  const r = feverTruth([
    '△她高烧不退。',
    '△嘴里说着胡话，念出了密码。',
    '△后来又念叨起那把钥匙。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件（zh 元数据）', () => {
  const r = feverTruth([
    '内景 病房 夜',
    '△她高烧不退，把当年下毒的事说了出来。',
    '外景 老宅 夜',
    '△婆婆烧糊涂了，说出了账本藏在哪儿。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].sceneIndex, 1); /* 首个场景头 = scene 0，第二段 = scene 1 */
  assert.ok(r.hits[0].sceneHeader.includes('老宅'));
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 rescue 含糊不泄：谵语没人听懂（命中行后两行内）', () => {
  const r = feverTruth([
    '△病房里，他守在床边。',
    '△她高烧不退，说出了账本的下落。',
    '△可她语无伦次，没人听懂那句地名。',
    '△病房的输液管滴着水。',
    '△窗外落着雨。',
    '△深夜，他守在婆婆床边。',
    '△婆婆烧糊涂了，说出了地窖的位置。',
    '△她满口呓语含糊不清。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 rescue 事后作废：烧糊涂的话当不得真', () => {
  const r = feverTruth([
    '△病房里，他守在床边。',
    '△她高烧不退，说出了账本的下落。',
    '△可烧糊涂的话当不得真。',
    '△病房的输液管滴着水。',
    '△窗外落着雨。',
    '△深夜，他守在婆婆床边。',
    '△婆婆烧糊涂了，说出了凶手就是谁。',
    '△退烧后她什么都不记得。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯病床戏放行（物理降温/喂药，无机密词）', () => {
  const r = feverTruth([
    '△她高烧不退。',
    '△他拧了毛巾给她敷额头。',
    '△又喂她吃了退烧药。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯机密戏放行（清醒对话谈账本，无发烧语境）', () => {
  const r = feverTruth([
    '△书房里，两人低声商量。',
    '小舟：账本一旦交出去，谁都跑不了。',
    '△他点了点头。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗：发烧与机密隔4行不配对', () => {
  const r = feverTruth([
    '△她高烧不退。',
    '△他守了一夜。',
    '△天亮时雨停了。',
    '△护工进来换了床单。',
    '△输液的药水一滴一滴。',
    '△账本还在老地方。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 三次未救：n=2 → 50', () => {
  const r = feverTruth([
    '△病房里，他守在床边。',
    '△她高烧不退，说出了账本的下落。',
    '△病房的输液管滴着水。',
    '△窗外落着雨。',
    '△深夜，他守在婆婆床边。',
    '△婆婆烧糊涂了，说出了地窖的位置。',
    '△老宅的灯忽明忽暗。',
    '△檐角积着去年的枯叶。',
    '△天台的水塔滴着水。',
    '△三天后，外公也说起了胡话，念出遗嘱的下落。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.strictEqual(r.hits[1].line, 10);
});

test('ex12 场景头行不参与匹配（头含"高烧"不成事件）', () => {
  const r = feverTruth([
    '内景 高烧病房 夜',
    '△他守在床边。',
    '△护士进来换了药。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex13 同行共现：一场谵妄说了机密判一次事件', () => {
  const r = feverTruth('△他烧糊涂了，把当年下毒的事说了出来。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex14 合并事件 hit 行号取 FEVER 锚行（非后续烧态行）', () => {
  const r = feverTruth([
    '△病房里，他守在床边。',
    '△她高烧不退，说出了账本的下落。',
    '△病房的输液管滴着水。',
    '△窗外落着雨。',
    '△深夜，他守在婆婆床边。',
    '△婆婆高烧昏迷。',
    '△梦里念出了凶手就是谁。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  /* L6 锚行与 L7 泄露行相邻合并为同一场病，hit 行号取锚行 L6 */
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex15 en 全链路：两次未救 n=1 → 70', () => {
  const r = feverTruth([
    'She kept watch at his bedside.',
    'He was delirious, and spilled where the ledger was hidden.',
    'The IV drip ticked softly.',
    'Rain fell outside the window.',
    'Late that night, the old man was burning up.',
    'He raved about the combination of the safe.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.ok(!/[一-鿿]/.test(r.hits[0].reason));
});

test('ex16 en rescue：fever talk / remembered nothing', () => {
  const r = feverTruth([
    'She kept watch at his bedside.',
    'He was delirious, and spilled where the ledger was hidden.',
    'But it was fever talk, unreliable as weather.',
    'The IV drip ticked softly.',
    'Rain fell outside the window.',
    'Late that night, the old man was burning up.',
    'He raved about the combination of the safe.',
    'He remembered nothing the next morning.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 零 CJK：输出串不含中文', () => {
  const r = feverTruth([
    'She kept watch at his bedside.',
    'Rain fell outside the window.',
    'He was delirious, and spilled where the ledger was hidden.',
    'The IV drip ticked softly.',
    'Rain drummed on the tin roof.', /* 隔离行：与上一 delirious 行距 3>2，防误合并 */
    'Late that night, the old man was burning up.',
    'Rain fell outside the window.',
    'He raved about the combination of the safe.',
  ].join('\n'));
  assert.strictEqual(r.unrescuedCount, 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)));
});
