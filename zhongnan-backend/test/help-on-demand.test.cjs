/**
 * help-on-demand 随叫随到工具人 单测（块90）
 * 覆盖：首次豁免 / 第2次命中 / 相邻求助合并 / 代价与拒绝 rescue /
 *      职责豁免 / 跨场不结算 / 距离超窗 / 孤立应允不触发 /
 *      纯求助无应允 / 封底 / en 全链路 + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { helpOnDemand } = require('../dist/engine/help-on-demand.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = helpOnDemand('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次求助白给豁免（一次人情合法）', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '老周：没问题，包在我身上。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex03 第2次白给命中 70', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '老周：没问题，包在我身上。',
    '',
    '内景 车库 夜',
    '苏黎：能不能帮我混进拍卖行？',
    '阿凯：小事一桩，今晚就办。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex04 相邻求助行合并为同一次开口', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '陆沉：帮帮我，求你了。',
    '老周：没问题，包在我身上。',
    '',
    '内景 车库 夜',
    '苏黎：能不能帮我混进拍卖行？',
    '阿凯：小事一桩，今晚就办。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex05 代价放行（有报价）', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '老周：没问题，不过这次什么条件？得给我好处费。',
    '',
    '内景 车库 夜',
    '苏黎：能不能帮我混进拍卖行？',
    '阿凯：小事一桩，今晚就办。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.hits[0].line, 7);
});

test('ex06 拒绝放行（帮不了）', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '老周：这次真帮不了，无能为力。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex07 职责豁免（本职工作）', () => {
  const d = [
    '内景 律所 日',
    '陆沉：帮我盯着这笔账目。',
    '会计：没问题，这是我的工作，职责所在。',
    '',
    '内景 仓库 夜',
    '苏黎：能不能帮我运走这批货？',
    '司机：包在我身上。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('ex08 跨场景不结算（应允须同场）', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '',
    '内景 车库 夜',
    '阿凯：没问题，包在我身上。',
    '苏黎：能不能帮我混进拍卖行？',
    '老周：小事一桩，今晚就办。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex09 距离超窗放行（求助后隔5行才应允）', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '△老周放下茶杯。',
    '△窗外雨声渐密。',
    '△陆沉望着他。',
    '△老周起身踱步。',
    '△半晌无言。',
    '老周：没问题，包在我身上。',
    '',
    '内景 车库 夜',
    '苏黎：能不能帮我混进拍卖行？',
    '阿凯：小事一桩，今晚就办。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex10 孤立应允无求助不触发', () => {
  const d = [
    '内景 会议室 日',
    '△方案陈述完毕，众人点头。',
    '老周：没问题，就这么定了。',
    '△散会。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 纯求助无应允放行', () => {
  const d = [
    '内景 茶馆 日',
    '陆沉：我需要你帮我查一个人。',
    '△老周沉默。',
    '△灯灭了。',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex12 多次命中封底 20', () => {
  const beats = [];
  for (let s = 0; s < 5; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('陆沉：我需要你帮我查点东西。');
    beats.push('老周：没问题，包在我身上。');
  }
  const r = helpOnDemand(beats.join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex13 3次命中 score 50', () => {
  const beats = [];
  for (let s = 0; s < 3; s += 1) {
    beats.push(`内景 场景${s + 1} 日`);
    beats.push('陆沉：帮帮我，能不能帮我弄到钥匙？');
    beats.push('老周：小事一桩，明天就办。');
  }
  const r = helpOnDemand(beats.join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

/* ---------- en ---------- */

test('ex14 en 第2次命中 70', () => {
  const d = [
    'INT. CAFE - DAY',
    'MARCUS: I need your help finding someone.',
    'VANCE: No problem, leave it to me.',
    '',
    'INT. GARAGE - NIGHT',
    'CLARA: Could you get me into the auction?',
    'KAI: Easy, tonight it is. Consider it done.',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

test('ex15 en 代价豁免（in exchange）', () => {
  const d = [
    'INT. CAFE - DAY',
    'MARCUS: I need your help finding someone.',
    'VANCE: No problem. What do I get in exchange?',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 职责豁免（that is my job）', () => {
  const d = [
    'INT. AGENCY - DAY',
    'MARCUS: Could you get the trace on this account?',
    'ANALYST: No problem, that is my job.',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex17 en 结果对象零 CJK', () => {
  const d = [
    'INT. CAFE - DAY',
    'MARCUS: I need your help finding someone.',
    'VANCE: No problem, leave it to me.',
    '',
    'INT. GARAGE - NIGHT',
    'CLARA: Could you get me into the auction?',
    'KAI: Consider it done.',
  ].join('\n');
  const r = helpOnDemand(d);
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r)), 'en result must contain zero CJK');
  assert.strictEqual(r.score, 70);
});
