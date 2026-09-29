/**
 * always-late 每次都晚一步 单测（块95）
 * 覆盖：首次豁免 / 第2次命中 / 相邻错过行合并 / 跨场景头不合并 /
 *      留话 rescue / 追赶 rescue / 纯抵达放行 / 纯错过无抵达放行 /
 *      意图句豁免 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { alwaysLate } = require('../dist/engine/always-late.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = alwaysLate('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次错过豁免（一次晚一步是命运感）', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，人已经走了。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次错过命中 70', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，人已经走了。',
    '',
    '内景 车站 夜',
    '△他冲到站台，火车刚开走。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex04 相邻错过行合并为同一事件', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，人已经走了。',
    '△白跑一趟，她瘫坐在走廊。',
    '',
    '内景 车站 夜',
    '△他冲到站台，火车刚开走。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（错过+抵达窗口内仍算事件）', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，人已经走了。',
    '内景 走廊 日',
    '△白跑一趟。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 rescue 留话通道（托人转告）', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，人已经走了。',
    '',
    '内景 车站 夜',
    '△他冲到站台，火车刚开走。',
    '护士：家属留了话，托我转告他。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 rescue 追赶通道（追了出去）', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，人已经走了。',
    '',
    '内景 车站 夜',
    '△他冲到站台，火车刚开走。',
    '△他追了出去，赶上了末班公交。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex08 纯抵达放行（无错过信号）', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，守了他一夜。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯错过无抵达放行（只是转述他人离开）', () => {
  const d = [
    '内景 酒馆 夜',
    '老陈：他早走了，你去也没用。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 意图句豁免（本想赶到，还没到）', () => {
  const d = [
    '内景 病房 日',
    '周莹：我本想赶到医院，可他已经走了。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗放行（抵达后隔3行才说走了）', () => {
  const d = [
    '内景 病房 日',
    '△她赶到病房，守了一夜。',
    '△天亮了。',
    '△护士来换药。',
    '△走廊空空。',
    '老陈：他昨晚已经走了。',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('△她赶到病房，人已经走了。');
  }
  const r = alwaysLate(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('△她赶到病房，人已经走了。');
  }
  const r = alwaysLate(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. WARD - DAY',
    'She rushed to the ward — the patient had just left.',
    '',
    'INT. PLATFORM - NIGHT',
    'He raced to the platform — the train had just left.',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex15 en 追赶 rescue（chased after）', () => {
  const d = [
    'INT. WARD - DAY',
    'She rushed to the ward — the patient had just left.',
    '',
    'INT. PLATFORM - NIGHT',
    'He raced to the platform — the train had just left.',
    'He chased after the taxi and caught up with her.',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex16 en 纯抵达放行', () => {
  const d = [
    'INT. WARD - DAY',
    'She rushed to the ward and stayed all night.',
  ].join('\n');
  const r = alwaysLate(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. WARD - DAY',
    'She rushed to the ward — the patient had just left.',
    '',
    'INT. PLATFORM - NIGHT',
    'He raced to the platform — the train had just left.',
  ].join('\n');
  const r = alwaysLate(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
