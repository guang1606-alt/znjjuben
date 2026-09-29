/**
 * instant-endowment 无因馈赠 单测（块136）
 * 覆盖：首次豁免 / 第2次命中 / 相邻 GIVE 合并 / 跨场景头不合并 /
 *      关系铺垫 rescue / 拒绝摩擦 rescue / 交换条件 rescue /
 *      无 STRANGER 放行 / 无 GIVE 放行 / 距离超窗 / 共现成事件 /
 *      3次命中 50 / 5次命中封底 20 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantEndowment } = require('../dist/engine/instant-endowment.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = instantEndowment('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次无因馈赠豁免（一次萍水相逢是类型片彩蛋）', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，这五百万你拿去用。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次无因馈赠命中 70', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，这五百万你拿去用。',
    '',
    '内景 车库 夜',
    '老人：我们刚认识，这房子你住吧。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex04 相邻 GIVE 行合并为同一事件', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，这五百万你拿去用。',
    '老板：先拿去用，回头再说。',
    '',
    '内景 车库 夜',
    '老人：我们刚认识，这房子你住吧。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 跨场景头不合并（中间隔场景头算新事件）', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，这五百万你拿去用。',
    '内景 走廊 日',
    '老人：我们刚认识，这房子你住吧。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 4);
});

test('ex06 关系铺垫放行（救过命）', () => {
  const d = [
    '内景 茶馆 日',
    '老板：初次见面，这五百万你拿去用。',
    '',
    '内景 车库 夜',
    '老人：我们刚认识，这房子你住吧。',
    '老人：你父亲当年救过我的命，这本来就是你的。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex07 无 STRANGER 信号的馈赠放行（老朋友给的）', () => {
  const d = [
    '内景 茶馆 日',
    '老周：这五百万你拿去用，回头算账。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 无 GIVE 词的初见寒暄放行', () => {
  const d = [
    '内景 会议室 日',
    '陈总：初次见面，聊得挺投缘。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 拒绝摩擦放行（我不能收）', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，这五百万你拿去用。',
    '',
    '内景 车库 夜',
    '老人：我们刚认识，这房子你住吧。',
    '陆沉：我不能收，这怎么好意思。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex10 STRANGER 与 GIVE ±2 行共现成事件', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，聊得挺投缘。',
    '陈总：合作愉快。',
    '老板：这五百万你拿去用。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex11 交换条件放行（作为交换）', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，这五百万你拿去用。',
    '',
    '内景 车库 夜',
    '老人：我们刚认识，这房子你住吧。',
    '老人：作为交换，你帮我做件事。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex12 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('老板：初次见面，这五百万你拿去用。');
  }
  const r = instantEndowment(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex13 5次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('老板：初次见面，这五百万你拿去用。');
  }
  const r = instantEndowment(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex14 距离超窗放行（初见后隔4行才馈赠）', () => {
  const d = [
    '内景 会议室 日',
    '老板：初次见面，聊得挺投缘。',
    '△两人喝茶。',
    '△窗外起风。',
    '△茶凉了。',
    '老板：这五百万你拿去用。',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ---------- en ---------- */

test('ex15 en 第2次命中 70', () => {
  const d = [
    'INT. OFFICE - DAY',
    'MAN: We just met. Here is a check for you.',
    '',
    'INT. GARAGE - NIGHT',
    'OLD MAN: First time we met. You can stay here.',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 5);
});

test('ex16 en 关系铺垫放行（saved my life）', () => {
  const d = [
    'INT. OFFICE - DAY',
    'MAN: We just met. Here is a check for you.',
    '',
    'INT. GARAGE - NIGHT',
    'OLD MAN: First time we met. You can stay here.',
    'WOMAN: He saved my life, I owe him.',
  ].join('\n');
  const r = instantEndowment(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits[0].rescued, true);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. OFFICE - DAY',
    'MAN: We just met. Here is a check for you.',
    '',
    'INT. GARAGE - NIGHT',
    'OLD MAN: First time we met. You can stay here.',
  ].join('\n');
  const r = instantEndowment(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
