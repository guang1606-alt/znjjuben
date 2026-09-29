'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { childBlurt } = require('../dist/engine/child-blurt.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(childBlurt('').score, 100);
  assert.strictEqual(childBlurt('  \n ').score, 100);
  assert.strictEqual(childBlurt('').hitCount, 0);
});

test('zh: 单次童言泄密豁免不扣分', () => {
  const draft = [
    '内景 林家客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '安安：妈妈，那个叔叔昨晚是不是睡在你房间了？',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次泄密命中 → 70，line 落 payload 场的孩童行', () => {
  const draft = [
    '内景 林家客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '安安：妈妈，那个叔叔昨晚是不是睡在你房间了？',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 餐厅 夜',
    '△四岁大的小宝踮着脚，仰起脸。',
    '小宝：王叔叔不是我亲爸爸，妈妈说你是坏人！',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.ok(r.hits[0].snippet.includes('小宝'));
  assert.strictEqual(r.score, 70);
});

test('zh: 三次泄密 n=2 → 50（血缘/奸情/目击三族）', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '安安：那个叔叔昨晚睡在妈妈房间！',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 餐厅 夜',
    '△四岁大的小宝踮着脚。',
    '小宝：王叔叔不是我亲爸爸！',
    '△风把窗帘吹得鼓起来。',
    '△玻璃杯在桌面上磕出轻响。',
    '内景 花园 日',
    '△六岁的妞妞举着棒棒糖。',
    '妞妞：是他推的奶奶，我看见了！',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('童言阀门'));
  assert.ok(r.advice[0].includes('授意'));
});

test('zh: 相邻 ≤2 行孩童表述合并为同一事件', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '△孩子在她脚边站定，仰起小脸。',
    '安安：那个叔叔昨晚睡在妈妈房间了！',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 餐厅 夜',
    '△四岁大的小宝踮着脚。',
    '小宝：王叔叔不是我亲爸爸！',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: 跨场景头不合并（夹场景头的贴脸孩童行各算一次）', () => {
  const draft = [
    '△五岁的安安喊出声：“那个叔叔昨晚睡在妈妈房间！”',
    '内景 走廊 夜',
    '△四岁大的小宝踮着脚说：“王叔叔不是我亲爸爸！”',
    '△走廊的灯嗡嗡响着。',
    '△墙上的钟走到九点。',
    '内景 花园 日',
    '△六岁的妞妞仰起头。',
    '妞妞：是他推的奶奶！',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.hits[0].line, 3);
  assert.strictEqual(r.unrescuedCount, 2);
});

test('zh: rescue 授意——事先教好的台词 → rescued', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '安安：那个叔叔昨晚睡在妈妈房间！',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 书房 夜',
    '△四岁大的小宝被推到众人面前。',
    '△林曼蹲下身，这些话是她事先教好的。',
    '小宝：爷爷，王叔叔不是我亲爸爸！',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: rescue 不采信——没人把孩子的话当真 → rescued', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '安安：那个叔叔昨晚睡在妈妈房间！',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 客厅 日',
    '△五岁的安安举着蜡笔画。',
    '安安：奶奶，是他推的妈妈！',
    '△满屋子的人都笑了，没人把一个孩子的话当真。',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯亲子戏（无秘密 payload）放行', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安坐在地毯上搭积木。',
    '安安：妈妈，我可以再吃一块蛋糕吗？',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 成人说同款秘密（无孩童锚）放行——父亲/母亲称谓划界', () => {
  const draft = [
    '内景 办公室 夜',
    '△林曼把文件摔在桌上。',
    '林曼：他不是我亲爸爸，妈妈说他是坏人，我恨他。',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 孩童锚与 payload 超过 ±2 行窗口不判', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安抱着玩偶跑进来。',
    '△窗外滚过一声闷雷。',
    '△她倒了杯温水，理平桌上的文件。',
    '林曼：那个叔叔昨晚睡在妈妈房间。',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 场景头行不参与词表匹配（KIDS 只写在头里）', () => {
  const draft = [
    'SCENE 2. KIDS WING - DAY',
    "You're not my real daddy.",
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 孩童锚与 payload 同行共现即配对（首次豁免）', () => {
  const draft = [
    '内景 客厅 日',
    '△五岁的安安仰起脸：“那个叔叔昨晚睡在妈妈房间！”',
    '△走廊里灯管嗡嗡响。',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('zh: hit 元数据完整（line/sceneIndex/sceneHeader/marker/reason）', () => {
  const draft = [
    '内景 林家客厅 日',
    '△五岁的安安抱着玩偶跑过来。',
    '安安：那个叔叔昨晚是不是睡在你房间了？',
    '△走廊里灯管嗡嗡响。',
    '△墙上的钟走到九点。',
    '内景 餐厅 夜',
    '△四岁大的小宝踮着脚，仰起脸。',
    '小宝：王叔叔不是我亲爸爸！',
  ].join('\n');
  const r = childBlurt(draft);
  const h = r.hits[0];
  assert.ok(h.line > 0);
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('餐厅'));
  assert.ok(h.marker.length > 0);
  assert.ok(h.marker.includes('岁'));
  assert.strictEqual(h.rescued, false);
  assert.ok(h.snippet.length > 0);
  assert.ok(h.reason.includes('童言'));
});

/* ============ English ============ */

test('en: first blurt exempt, second counted → 70', () => {
  const draft = [
    'INT. LIVING ROOM - DAY',
    'The five-year-old ran in with her doll.',
    'ANNIE: Mommy, did that man sleep in your room last night?',
    'The corridor hummed with an old fluorescent tube.',
    'Rain streaked the tall office windows.',
    'INT. DINING ROOM - NIGHT',
    'The small child stood on tiptoe and lifted her face.',
    "BEN: You're not my real daddy, and mommy says you're a bad man!",
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.ok(/small child/i.test(r.hits[0].snippet));
  assert.strictEqual(r.score, 70);
});

test('en: coached child → rescued, score stays 100', () => {
  const draft = [
    'INT. LIVING ROOM - DAY',
    'The five-year-old ran in with her doll.',
    'ANNIE: Mommy, did that man sleep in your room last night?',
    'The corridor hummed with an old fluorescent tube.',
    'Rain streaked the tall office windows.',
    'INT. STUDY - NIGHT',
    'The four-year-old was pushed forward in front of everyone.',
    'She knelt down; she had coached him to say every single word.',
    'BEN: Grandpa, you are not my real daddy!',
  ].join('\n');
  const r = childBlurt(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = childBlurt([
    'INT. LIVING ROOM - DAY',
    'The five-year-old ran in with her doll.',
    'ANNIE: Mommy, did that man sleep in your room last night?',
    'The corridor hummed with an old fluorescent tube.',
    'Rain streaked the tall office windows.',
    'INT. DINING ROOM - NIGHT',
    'The small child stood on tiptoe and lifted her face.',
    "BEN: You're not my real daddy, and mommy says you're a bad man!",
  ].join('\n'));
  assert.ok(r.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
