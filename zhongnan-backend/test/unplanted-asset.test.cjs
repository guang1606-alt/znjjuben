'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { unplantedAsset } = require('../dist/engine/unplanted-asset.js');

const pad = (n) =>
  Array.from({ length: n }, (_, i) => `△林晚看着窗外，指尖在扶手上轻轻敲了一下${i + 1}。`);
const epad = (n) =>
  Array.from({ length: n }, (_, i) => `Linna stares out the window, her fingers tapping the armrest (${i + 1}).`);

/* ============================ 中文：后手空降 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(unplantedAsset('').score, 100);
});

test('zh: 幸好留了一手+录音，且对手当场泄气 → 57', () => {
  const r = unplantedAsset(
    [...pad(6), '沈志国：你今天必须签。', '林晚：幸好我留了一手，这段录音你自己听。', '△沈志国脸色煞白，连退两步瘫坐在沙发上。'].join('\n'),
  );
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].line, 8);
  assert.equal(r.hits[0].asset, '录音');
  assert.equal(r.hits[0].planted, false);
  assert.deepEqual(r.hits[0].boosters, ['instant_win']);
  assert.equal(r.score, 57);
});

test('zh: 我已经报警了，警察马上到，首次出现 → 65', () => {
  const r = unplantedAsset(
    [...pad(6), '沈志国：你走不出这个门。', '林晚：我已经报警了，警察马上就到。', '沈志国：你……'].join('\n'),
  );
  assert.equal(r.hits[0].asset, '警察');
  assert.equal(r.hits[0].planted, false);
  assert.equal(r.score, 65);
});

test('zh: 我的律师已经在楼下+股权转让书，全稿首次出现 → 命中', () => {
  const r = unplantedAsset(
    [...pad(6), '沈志国：这家公司我说了算。', '林晚：我的律师已经在楼下，这份股权转让书你签过字。'].join('\n'),
  );
  assert.ok(['律师', '股权转让书'].includes(r.hits[0].asset));
  assert.equal(r.hits[0].planted, false);
});

test('zh: 保镖就在门口+框架词 → 命中', () => {
  const r = unplantedAsset(
    [...pad(6), '混混：今天别想站着出去。', '林晚：我早就安排好了，保镖就在门口，你们动一下试试。'].join('\n'),
  );
  assert.equal(r.hits[0].planted, false);
});

/* ============================ 中文：豁免与边界 ============================ */

test('zh rescue: 开场已铺垫录音动作，后文掏出不判（枪挂上了墙）', () => {
  const r = unplantedAsset(
    ['场1：夜·车里', '△林晚坐下前悄悄打开手机录音，屏幕朝下扣在桌上。', ...pad(6), '沈志国：你别逼我。', '林晚：幸好刚才全程有录音。'].join('\n'),
  );
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].planted, true);
  assert.equal(r.score, 100);
});

test('zh rescue: 报警动作在更早台词出现，后文"警察马上到"视为已铺垫', () => {
  const r = unplantedAsset(
    [...pad(2), '林晚：（低声）我已经报警了。', ...pad(4), '沈志国：你跑不了。', '林晚：警察马上就到。'].join('\n'),
  );
  // 第一处报警自身无更早铺垫 → 空降；第二处"警察马上就到"有第一处铺垫 → planted
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[0].planted, false);
  assert.equal(r.hits[1].planted, true);
});

test('neg zh: 无框架词的证据揭晓是正当反转（亲子鉴定），不判', () => {
  const r = unplantedAsset(
    [...pad(6), '沈志国：你到底想干什么。', '林晚：这是亲子鉴定报告，你自己看清楚。', '△沈志国愣住了。'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg zh: 框架词但窗口内无具体道具（我早说过他靠不住），不判', () => {
  const r = unplantedAsset(
    [...pad(6), '林晚：我早就说过他靠不住，你非不听。', '助理：现在怎么办？'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg zh: 普通对峙后手 → 100', () => {
  const r = unplantedAsset(
    [...pad(8), '林晚：把合同给我。', '沈志国：你先签字。'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
  assert.equal(r.score, 100);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(unplantedAsset('').score, 100);
});

test('en: luckily I came prepared + recording + instant collapse → 57', () => {
  const r = unplantedAsset(
    [...epad(6), 'VICTOR: You are not leaving with it.', 'LINNA: Luckily I came prepared, I recorded everything.', 'His face goes white and he steps back.'].join('\n'),
  );
  assert.equal(r.hits[0].asset, 'recording');
  assert.equal(r.hits[0].planted, false);
  assert.deepEqual(r.hits[0].boosters, ['instant_win']);
  assert.equal(r.score, 57);
});

test('en: police on their way, first mention → hit', () => {
  const r = unplantedAsset(
    [...epad(6), 'VICTOR: You cannot walk out of here.', 'LINNA: The police are on their way.', 'VICTOR: What?'].join('\n'),
  );
  assert.equal(r.hits[0].asset, 'police');
  assert.equal(r.hits[0].planted, false);
});

test('en: my lawyer is downstairs + signed contract → hit', () => {
  const r = unplantedAsset(
    [...epad(6), 'VICTOR: I own this company.', 'LINNA: My lawyer is downstairs, and this is the contract you signed.'].join('\n'),
  );
  assert.equal(r.hits[0].planted, false);
});

test('en rescue: recording planted earlier → 100', () => {
  const r = unplantedAsset(
    ['INT. CAR - NIGHT', 'She taps record on her phone and lays it face down on the table.', ...epad(6), 'VICTOR: Do not push me.', 'LINNA: Good thing this whole conversation is on the recording.'].join('\n'),
  );
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].planted, true);
  assert.equal(r.score, 100);
});

test('neg en: plain evidence reveal without contingency frame → no hit', () => {
  const r = unplantedAsset(
    [...epad(6), 'VICTOR: What do you want?', 'LINNA: This is the paternity report. Read it yourself.', 'Victor freezes.'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg en: ordinary dialogue → 100', () => {
  const r = unplantedAsset(
    [...epad(8), 'LINNA: Give me the contract.', 'VICTOR: Sign first.'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

/* ============================ 多次命中封底 ============================ */

test('score: 两处空降后手封底 20', () => {
  const r = unplantedAsset(
    [
      ...pad(4),
      '沈志国：你别想赢。',
      '林晚：幸好这段录音在我手上。',
      '△沈志国脸色煞白。',
      ...pad(2),
      '沈志国：有录音又怎样。',
      '林晚：我早就请好律师了，律师函明天就发。',
      '△沈志国瘫坐在椅子上。',
    ].join('\n'),
  );
  assert.ok(r.hits.filter((h) => !h.planted).length >= 2);
  assert.equal(r.score, 20);
});
