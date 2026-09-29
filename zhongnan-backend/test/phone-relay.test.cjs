'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { phoneRelay } = require('../dist/engine/phone-relay.js');

/* ============================ 中文 ============================ */

test('zh: 空稿满分', () => {
  const r = phoneRelay('');
  assert.equal(r.score, 100);
  assert.equal(r.hits.length, 0);
});

test('zh: 单行三连回声+内容复读（什么/他死了/我马上到）→ 命中', () => {
  const r = phoneRelay('场1：夜·林家\n△手机响起，是陌生号码。\n林晚：（接起）喂？……什么？！他死了？在哪家医院？……你们别动，我马上到！\n△她抓起车钥匙冲出门。');
  assert.equal(r.calls, 1);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].echoes >= 3);
  assert.ok(r.hits[0].contentEchoes >= 1);
  assert.equal(r.score, 50);
});

test('zh: 分行回声+内容复读（什么/你说沈总把合同签了）→ 命中', () => {
  const r = phoneRelay('场1：夜·办公室\n△电话响了。\n林晚：喂。\n林晚：什么？\n林晚：你说……沈总把合同签了？\n林晚：我知道了。');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].contentEchoes, 1);
  assert.equal(r.score, 50);
});

test('neg zh: 单个"什么？"无重大事件复读 → 100', () => {
  const r = phoneRelay('场1：日·客厅\n△手机响。\n林晚：喂？什么？我知道了，谢谢你通知。\n△她放下手机，看向窗外。');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('rescue zh: 镜头切到另一边（现场可见）→ 豁免', () => {
  const r = phoneRelay('场1：夜\n△手机响。\n林晚：喂？什么？\n△镜头切到另一边——医院走廊，医生拿着电话。\n医生：人已经没了，家属尽快来。');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('rescue zh: 电话那头画外音有台词（双面通话）→ 豁免', () => {
  const r = phoneRelay('场1：夜\n△手机响。\n林晚：喂？\n电话那头（画外音）：你爸出事了，在三院。\n林晚：我马上到。');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('neg zh: 非电话语境当面震惊（什么！你怎么在这）→ 不判', () => {
  const r = phoneRelay('场1：日\n沈志国：（推门进来）什么！你怎么在这？\n林晚：谈合同。\n沈志国：真的是你？');
  assert.equal(r.calls, 0);
  assert.equal(r.hits.length, 0);
});

test('zh: hit 含锚点行号/说话人/回声行号', () => {
  const r = phoneRelay('场1：夜\n△手机响了。\n林晚：喂？什么？你说他跑了？我马上到！');
  assert.equal(r.hits[0].anchorLine, 2);
  assert.equal(r.hits[0].speaker, '林晚');
  assert.ok(r.hits[0].lines.includes(3));
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(phoneRelay('').score, 100);
});

test('en: one-line triple relay with parrot (What/He is dead/right there) → hit', () => {
  const r = phoneRelay('INT. STUDY - NIGHT\nHer phone rang. She picked up.\nVICTOR: Hello? What?! He is dead? Which hospital? Do not move, I will be right there.');
  assert.equal(r.calls, 1);
  assert.equal(r.hits.length, 1);
  assert.ok(r.hits[0].echoes >= 3);
  assert.ok(r.hits[0].contentEchoes >= 1);
});

test('en: split-line relay with content parrot (signed the papers) → hit', () => {
  const r = phoneRelay('INT. OFFICE - NIGHT\nThe phone rang.\nVICTOR: Hello?\nVICTOR: What?\nVICTOR: So he signed the papers?\nVICTOR: I see.');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].contentEchoes, 1);
});

test('neg en: single What on a normal logistics call → 100', () => {
  const r = phoneRelay('INT. ROOM - DAY\nThe phone rang.\nVICTOR: Hello? What? Got it. Thanks.\nHe put the phone down.');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('neg en: normal scheduling call with no echoes → 100', () => {
  const r = phoneRelay('INT. ROOM - DAY\nThe phone rang.\nVICTOR: Hey. Yeah. Tomorrow at nine. I will be there.\nHe hung up.');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

test('rescue en: CALLER (V.O.) staged as dialogue → exempt', () => {
  const r = phoneRelay('INT. ROOM - NIGHT\nHe picked up the phone.\nVICTOR: Hello?\nCALLER (V.O.): Your father is gone. Three hours ago.\nVICTOR: I am on my way.');
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

/* ============================ 封底与边界 ============================ */

test('score: 两处传话机封底 20', () => {
  const r = phoneRelay('场1：夜\n△手机响。\n林晚：喂？什么？你说他死了？我马上到！\n场2：日\n△电话又响了。\n林晚：喂？什么？你说她跑了？我马上来！');
  assert.equal(r.hits.length, 2);
  assert.equal(r.score, 20);
});

test('boundary: 窗口遇场景头截断，不跨场串回声', () => {
  const r = phoneRelay('场1：夜\n△手机响。\n林晚：喂？什么？\n场2：日\n林晚：不可能。他真的死了？\n林晚：我马上到。');
  // 场1 仅 1 回声无内容复读；场2 无电话锚点
  assert.equal(r.hits.length, 0);
});
