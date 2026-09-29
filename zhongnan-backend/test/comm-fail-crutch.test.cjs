'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { commFailCrutch } = require('../dist/engine/comm-fail-crutch.js');

/* ============ 中文 ============ */

test('zh: 首次失灵豁免，第2次起命中', () => {
  const draft = [
    '场1：夜·公寓',
    '△她正要打给林总，手机却没了信号。',
    '场2：夜·山道',
    '△她急着报警，可手机显示无法接通。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 4);
  assert.strictEqual(r.score, 70);
});

test('zh: 单次失灵豁免不扣分', () => {
  const r = commFailCrutch('场1：夜\n△她正要打给林总，手机却没了信号。');
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 三次失灵 → n=2 → 50', () => {
  const draft = [
    '场1：夜', '△她正要打给律师，手机没电了。',
    '场2：日', '△他想通知家里人，电话拨不出去，没有信号。',
    '场3：夜', '△她要说出真相，电话偏偏在这时断线。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('剧情阀门'));
  assert.ok(r.advice[0].includes('换方案'));
});

test('zh: 失灵后换方案补救 → rescued 不扣分', () => {
  const draft = [
    '场1：夜',
    '△她正要打给林总，手机却没了信号。',
    '△她转身开车赶了过去，要当面把话说清楚。',
    '场2：日',
    '△他打不通急救电话，抓起外套跑去了诊所。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻行同一次失灵（没信号+再拨不通）只计1次', () => {
  const draft = [
    '场1：夜·山脚',
    '△她掏出手机，屏幕上写着：无服务。',
    '△再拨，依然是无法接通。',
    '场2：夜·山顶',
    '△他想打给救援队，电话还是打不通。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: 纯环境描写（无传递语境）不判', () => {
  const draft = [
    '场1：日·深山',
    '△车开进山谷，手机彻底没了信号。',
    '△两人决定步行上山。',
    '场2：夜·营地',
    '△帐篷外，手电筒也没电了。',
    '△他们升起一堆篝火。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 主动挂断不判（misunderstandingDrag 域）', () => {
  const draft = [
    '场1：夜',
    '△电话那头传来沈致的声音，她直接挂断了电话。',
    '场2：日',
    '△他按掉了她的来电，把手机扣在桌上。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: cue 台词宣布失灵+传递语境照样命中', () => {
  const draft = [
    '场1：夜·林中小屋',
    '周野：这山里没有信号，你打不了报警电话。',
    '△苏离攥着手机，屏幕上果然写着：无服务。',
    '场2：日·派出所',
    '钱进：又是占线，你们这儿的报警电话怎么老是打不通。',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: 封底 20（6 次失灵）', () => {
  const beats = [
    '场1：夜', '△她正要打给律师，手机没电了。',
    '场2：日', '△他想通知家里，拨不出去。',
    '场3：夜', '△她要说真相，电话断了。',
    '场4：日', '△他急着求救，手机黑屏。',
    '场5：夜', '△她要报警，忙音响个不停。',
    '场6：日', '△他要说出证据的下落，通话中断了。',
  ].join('\n');
  const r = commFailCrutch(beats);
  assert.strictEqual(r.hitCount, 6);
  assert.strictEqual(r.unrescuedCount, 5);
  assert.strictEqual(r.score, 20);
});

test('zh: 空稿与无失灵稿', () => {
  assert.strictEqual(commFailCrutch('').score, 100);
  assert.strictEqual(commFailCrutch('  \n ').score, 100);
  const r = commFailCrutch('场1：夜\n△她拨通了电话，把地址一五一十说了。\n林晚：我马上到。');
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: first failure exempt, second counted with line', () => {
  const draft = [
    'INT. APARTMENT - NIGHT',
    'She tries to call her lawyer — no signal.',
    'INT. MOUNTAIN ROAD - NIGHT',
    'He needs to warn the family, but the call drops again.',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 4);
  assert.strictEqual(r.score, 70);
});

test('en: rescue with plan B keeps the score clean', () => {
  const draft = [
    'INT. CABIN - NIGHT',
    'She tries to call for help — no signal.',
    'She sends a text from the ridge and drives over in person.',
    'INT. ROAD - DAY',
    'He cannot get through, so he borrows a phone at the gas station.',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: environmental dead zone without intent ignored', () => {
  const draft = [
    'EXT. VALLEY - DAY',
    'The van winds into the mountains. No signal on any phone.',
    'They decide to hike the rest of the way.',
    'INT. TENT - NIGHT',
    'The flashlight dies. They light a fire instead.',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: active hang-up ignored (misunderstandingDrag domain)', () => {
  const draft = [
    'INT. OFFICE - NIGHT',
    'She hears his voice and hangs up on him.',
    'INT. CAR - DAY',
    'He silences the call and flips the phone face-down.',
  ].join('\n');
  const r = commFailCrutch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: empty/whitespace draft is a clean 100', () => {
  assert.strictEqual(commFailCrutch('').score, 100);
  assert.strictEqual(commFailCrutch('  \n ').score, 100);
});

test('en layer contains zero CJK in strings', () => {
  const r = commFailCrutch([
    'INT. APARTMENT - NIGHT',
    'She tries to call her lawyer — no signal.',
    'INT. MOUNTAIN ROAD - NIGHT',
    'He needs to warn the family, but the call drops again.',
  ].join('\n'));
  assert.ok(r.hits.length >= 1);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(r)), 'English result must contain no CJK');
});
