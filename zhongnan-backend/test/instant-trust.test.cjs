/**
 * instant-trust 初见托付 单测（块92）
 * 覆盖：首次豁免 / 第2次命中 / 相邻托付合并 / 跨场景头不合并 /
 *      建立过程 rescue / 拒绝摩擦 rescue / 无初见信号放行 /
 *      无托付词放行 / 距离超窗 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantTrust } = require('../dist/engine/instant-trust.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = instantTrust('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次初见托付豁免（一次速热是类型惯例）', () => {
  const d = [
    '内景 会议室 日',
    '陈总：我们才认识三天，公章就交给你了。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次初见托付命中 70', () => {
  const d = [
    '内景 会议室 日',
    '陈总：我们才认识三天，公章就交给你了。',
    '',
    '内景 车库 夜',
    '周莹：素不相识，你把命脉就交给你了？',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex04 相邻托付行合并为同一事件', () => {
  const d = [
    '内景 会议室 日',
    '陈总：我们才认识一周，账本就交给你了。',
    '陈总：全交给你，密码回头再说。',
    '',
    '内景 车库 夜',
    '周莹：素不相识，这么快就把后背交给你？',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头算新事件）', () => {
  const d = [
    '内景 会议室 日',
    '陈总：我们才认识，账本就交给你了。',
    '内景 走廊 日',
    '周莹：素不相识，也全交给你？',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 信任建立过程放行（救过命）', () => {
  const d = [
    '内景 茶馆 日',
    '老周：才认识几年，账本就交给你了。',
    '',
    '内景 仓库 夜',
    '苏黎：才认识三天，命脉也交给你。',
    '老陈：他救过我的命，我信他。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 无初见信号的托付放行（老朋友交托）', () => {
  const d = [
    '内景 茶馆 日',
    '老周：账本就交给你了，回头算账。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 无托付词的初见寒暄放行', () => {
  const d = [
    '内景 会议室 日',
    '陈总：我们才认识三天，聊得挺投缘。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 拒绝摩擦放行（我不能收）', () => {
  const d = [
    '内景 会议室 日',
    '陈总：才认识三天，公章就交给你了。',
    '',
    '内景 车库 夜',
    '周莹：素不相识，存折也交给你保管。',
    '陆沉：我不能收，这太重了。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex10 初见信号与托付 ±2 行共现成事件', () => {
  const d = [
    '内景 会议室 日',
    '周莹：我们才认识三天。',
    '陈总：就这么定了。',
    '陈总：公章交给你，密码明天给。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 距离超窗放行（初见后隔4行才托付）', () => {
  const d = [
    '内景 会议室 日',
    '周莹：我们才认识三天，投缘。',
    '△两人喝茶。',
    '△窗外起风。',
    '△茶凉了。',
    '陈总：公章交给你保管。',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('陈总：我们才认识，账本就交给你了。');
  }
  const r = instantTrust(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('陈总：我们才认识，账本就交给你了。');
  }
  const r = instantTrust(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. OFFICE - DAY',
    "CLARA: Here's the key to the vault.",
    'VANCE: We met an hour ago!',
    '',
    'INT. GARAGE - NIGHT',
    'MARK: Keep this between us - we barely know each other.',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 6);
});

test('ex15 en 建立过程放行（saved my life）', () => {
  const d = [
    'INT. OFFICE - DAY',
    "CLARA: Here's the key to the vault.",
    'VANCE: We met an hour ago!',
    '',
    'INT. GARAGE - NIGHT',
    'MARK: I leave everything with you - we just met.',
    'CLARA: He saved my life, that counts for ten years.',
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex16 en 无初见信号放行', () => {
  const d = [
    'INT. OFFICE - DAY',
    "CLARA: Here's the key to the vault, partner.",
  ].join('\n');
  const r = instantTrust(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. OFFICE - DAY',
    "CLARA: Here's the key to the vault.",
    'VANCE: We met an hour ago!',
    '',
    'INT. GARAGE - NIGHT',
    'MARK: Keep this between us - we barely know each other.',
  ].join('\n');
  const r = instantTrust(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
