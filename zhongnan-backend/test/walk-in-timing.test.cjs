/**
 * walk-in-timing 说曹操曹操到 单测（块89）
 * 覆盖：空稿 / 无名字集 / 首次豁免 / 第2次命中 / 窗口超界 /
 *      名字不匹配 / 铺垫豁免 / rescue 门铃 / 跨场景重置 /
 *      连续台词合并 / 叙述谈论动词门槛 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { walkInTiming } = require('../dist/engine/walk-in-timing.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = walkInTiming('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 无说话人标签（名字集为空）满分', () => {
  const d = [
    '内景 客厅 夜',
    '△两人低声交谈。',
    '△门被推开，一个人走了进来。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 首次巧合登场豁免', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：王律师怎么还没到？',
    '△门开了，王律师走了进来。',
    '王律师：抱歉，路上堵车。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex04 第2次巧合登场命中 70', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：王律师怎么还没到？',
    '△门开了，王律师走了进来。',
    '王律师：抱歉，路上堵车。',
    '',
    '内景 办公室 日',
    '李娜：赵总那边什么意思？',
    '△话音未落，赵总推门而入。',
    '赵总：我的意思很清楚。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 8);
});

test('ex05 谈论与登场距离超窗放行', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：王律师怎么还没到？',
    '△张伟倒了杯水。',
    '△水洒了一点。',
    '△他擦了擦手。',
    '△窗外传来汽车声。',
    '△门开了，王律师走了进来。',
    '王律师：久等了。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex06 登场者与谈论者不是同一人放行', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：赵总怎么还没到？',
    '王律师：先坐下等等吧。',
    '△门开了，王律师走了进来。',
    '王律师：我刚办完事过来。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex07 铺垫豁免（去把人请来）', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：去把王律师请来。',
    '△门开了，王律师走了进来。',
    '王律师：什么事这么急？',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 rescue：登场有门铃/敲门物理前因', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：王律师怎么还没到？',
    '△门铃响了。',
    '△门开了，王律师走了进来。',
    '王律师：我来了。',
    '',
    '内景 办公室 日',
    '李娜：赵总怎么还没来？',
    '△敲门声响起。',
    '△门开了，赵总走了进来。',
    '赵总：都到了？',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex09 谈论与登场跨场景头重置（不追）', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：王律师怎么还没到？',
    '内景 走廊 夜',
    '△门开了，王律师走了进来。',
    '王律师：让我进去。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 连续台词行合并为同一段谈论', () => {
  const d = [
    '内景 客厅 夜',
    '张伟：王律师怎么还没到？',
    '李娜：他从来不准时。',
    '△门开了，王律师走了进来。',
    '王律师：抱歉抱歉。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 叙述谈论须带动词（正说起算谈，无动词不算）', () => {
  const d = [
    '内景 客厅 夜',
    '△张伟正说起王律师的官司。',
    '△门开了，王律师走了进来。',
    '王律师：你们聊到我了？',
    '',
    '内景 书房 夜',
    '△王律师的公文包还放在沙发上。',
    '△门开了，王律师走了进来。',
    '王律师：我回来拿东西。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 hits=2 score=50', () => {
  const d = [
    '内景 场1 夜',
    '张伟：王律师怎么还没到？',
    '△门开了，王律师走了进来。',
    '王律师：抱歉。',
    '',
    '内景 场2 日',
    '李娜：赵总怎么还没来？',
    '△门开了，赵总走了进来。',
    '赵总：何事？',
    '',
    '内景 场3 夜',
    '钱风：孙经理人呢？',
    '△门开了，孙经理走了进来。',
    '孙经理：我在。',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 多次命中封底 20', () => {
  const pairs = [
    ['张伟', '王律师'],
    ['李娜', '赵总'],
    ['钱风', '孙经理'],
    ['周远', '吴会计'],
    ['郑涵', '冯秘书'],
    ['楚门', '何助理'],
  ];
  const beats = [];
  pairs.forEach(([a, b], idx) => {
    beats.push(`内景 场${idx + 1} 日`);
    beats.push(`${a}：${b}怎么还没到？`);
    beats.push('△门开了，' + b + '走了进来。');
    beats.push(`${b}：抱歉。`);
  });
  const r = walkInTiming(beats.join('\n'));
  assert.strictEqual(r.hitCount, 6);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. LIVING ROOM - NIGHT',
    'DETECTIVE: Where is MARSH? He should be here by now.',
    'The door swings open and MARSH walks in.',
    'MARSH: Sorry, traffic.',
    '',
    'INT. OFFICE - DAY',
    'CLERK: Mr. CHEN has not arrived.',
    'CHEN bursts through the door.',
    'CHEN: I heard everything.',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 8);
});

test('ex15 en 铺垫豁免（go get / on his way）', () => {
  const d = [
    'INT. LIVING ROOM - NIGHT',
    'DETECTIVE: Go get Marsh. He is on his way.',
    'MARSH walks in.',
    'MARSH: You called?',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en rescue（doorbell / knock）', () => {
  const d = [
    'INT. LIVING ROOM - NIGHT',
    'DETECTIVE: Where is MARSH?',
    'A knock at the door. MARSH walks in.',
    'MARSH: I came as soon as I heard.',
    '',
    'INT. OFFICE - DAY',
    'CLERK: Mr. CHEN?',
    'The doorbell rings. CHEN walks in.',
    'CHEN: Sorry to interrupt.',
  ].join('\n');
  const r = walkInTiming(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. LIVING ROOM - NIGHT',
    'DETECTIVE: Where is MARSH?',
    'MARSH walks in.',
    'MARSH: You called?',
    '',
    'INT. OFFICE - DAY',
    'CLERK: Mr. CHEN?',
    'CHEN bursts through the door.',
    'CHEN: Sorry to interrupt.',
  ].join('\n');
  const r = walkInTiming(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
