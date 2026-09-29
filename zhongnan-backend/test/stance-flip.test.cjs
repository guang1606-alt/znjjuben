'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stanceFlip } = require('../dist/engine/stance-flip.js');

const pad = (n) =>
  Array.from({ length: n }, (_, i) => `△林晚看着窗外，指尖在扶手上轻轻敲了一下${i + 1}。`);
const epad = (n) =>
  Array.from({ length: n }, (_, i) => `Linna stares out the window, her fingers tapping the armrest (${i + 1}).`);

/* ============================ 中文：无因横跳命中 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(stanceFlip('').score, 100);
});

test('zh: 死誓不签字，隔一句就签 → 57（adjacent+terse）', () => {
  const r = stanceFlip([...pad(3), '沈志国：签了它。', '林晚：我绝不签字，你死了这条心。', '沈志国：你再想想。', '林晚：我签。'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].family, 'sign');
  assert.equal(r.hits[0].fromLine, 5);
  assert.equal(r.hits[0].toLine, 7);
  assert.equal(r.hits[0].rescued, false);
  assert.deepEqual(r.hits[0].boosters.sort(), ['adjacent', 'terse']);
  assert.equal(r.score, 57);
});

test('zh: 不回家 → 对方一句干求 → 干巴巴「好吧。」→ 57', () => {
  const r = stanceFlip([...pad(3), '沈志国：跟我回去。', '林晚：我不回去，谁劝都没用。', '沈志国：算爸求你了。', '林晚：好吧。'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].family, 'goto');
  assert.equal(r.score, 57);
});

test('zh: 不帮忙 → 「行，我帮你」→ 命中 cooperate', () => {
  const r = stanceFlip([...pad(3), '助理：帮我把文件递进去吧。', '林晚：我不帮，别找我。', '助理：就这一次。', '林晚：行，我帮你。'].join('\n'));
  assert.equal(r.hits[0].family, 'cooperate');
  assert.equal(r.hits[0].rescued, false);
});

test('zh: 决意离开 → 立刻又不走 → 62（仅 adjacent）', () => {
  const r = stanceFlip([...pad(3), '林晚：我要走了，这个家我待不下去。', '沈志国：你站住！', '林晚：我不走了，你把话说清楚。'].join('\n'));
  assert.equal(r.hits[0].family, 'leave');
  assert.deepEqual(r.hits[0].boosters, ['adjacent']);
  assert.equal(r.score, 62);
});

test('zh: 离婚离定了 → 算了先不离 → 命中 divorce', () => {
  const r = stanceFlip([...pad(3), '林晚：这婚我离定了。', '沈志国：你冷静点。', '林晚：算了，先不离。'].join('\n'));
  assert.equal(r.hits[0].family, 'divorce');
  assert.equal(r.hits[0].rescued, false);
});

test('zh: 坚决不离 → 离就离（反方向横跳同样抓）', () => {
  const r = stanceFlip([...pad(3), '林晚：我死都不离。', '沈志国：签字吧。', '林晚：离就离！'].join('\n'));
  assert.equal(r.hits[0].family, 'divorce');
});

test('zh: 我不嫁 → 我嫁 → 命中 wedlock', () => {
  const r = stanceFlip([...pad(3), '林晚：我不嫁，你死了心吧。', '媒婆：姑娘再想想。', '林晚：好，我嫁。'].join('\n'));
  assert.equal(r.hits[0].family, 'wedlock');
});

test('zh: 东西我不给 → 还给你 → 命中 handover', () => {
  const r = stanceFlip([...pad(3), '沈志国：把钥匙给我。', '林晚：我不给，你别想拿到。', '沈志国：给我！', '林晚：给你。'].join('\n'));
  assert.equal(r.hits[0].family, 'handover');
});

/* ============================ 中文：豁免 ============================ */

test('zh rescue: 证据拍桌 + 反做自带条件 → 100', () => {
  const r = stanceFlip([
    ...pad(3),
    '沈志国：签了它。',
    '林晚：我绝不签字，你死了这条心。',
    '△沈志国把亲子鉴定甩在桌上。',
    '沈志国：你先看看这个再说话。',
    '林晚：好，我签，但你必须把她接回来。',
  ].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh rescue: 只有反做台词自带条件（无人施压）也豁免', () => {
  const r = stanceFlip([
    ...pad(3),
    '沈志国：签了吧。',
    '林晚：我不签。',
    '沈志国：嗯。',
    '林晚：好，我签，但你得先把股份转到我名下。',
  ].join('\n'));
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh rescue: 强筹码一句（你妈住院）即豁免', () => {
  const r = stanceFlip([
    ...pad(3),
    '沈志国：回家看看吧。',
    '林晚：我不回去。',
    '沈志国：算爸求你了，你妈住院了，就想见你一面。',
    '林晚：我回去。',
  ].join('\n'));
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('zh: 弱求情单句不够（rescue=1）照样判', () => {
  const r = stanceFlip([...pad(3), '沈志国：回家吧。', '林晚：我不回去。', '沈志国：算我求你了。', '林晚：我回去。'].join('\n'));
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.hits[0].rescueScore, 1);
});

test('zh rescue: 信息动作拍 + 一句弱求情凑满 2 分', () => {
  const r = stanceFlip([
    ...pad(3),
    '沈志国：帮我这一次。',
    '林晚：我不帮。',
    '△助理把一叠照片推到她面前。',
    '助理：求你了。',
    '林晚：行，我帮你。',
  ].join('\n'));
  assert.equal(r.hits[0].rescued, true);
});

/* ============================ 中文：反例/边界 ============================ */

test('neg zh: 正常剧本无横跳 → 100', () => {
  const r = stanceFlip([
    ...pad(2),
    '沈志国：晚饭好了。',
    '林晚：我不饿。',
    '沈志国：随你。',
    '林晚：我出去走走。',
  ].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 拒绝后立场被重申（同极更新），不判', () => {
  const r = stanceFlip([
    ...pad(3),
    '沈志国：签了吧。',
    '林晚：我不签。',
    '沈志国：你可想清楚。',
    '林晚：我说了，我不签，别再逼我。',
  ].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 间隔超过 10 个非空行，旧锚点失效', () => {
  const r = stanceFlip(['林晚：我绝不签字。', ...pad(11), '林晚：我签。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 同一说话人连续两句，无对方插话，干巴巴「好」不算横跳', () => {
  const r = stanceFlip(['林晚：我不签。', '林晚：好吧。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 疑问尾句「我签？」不是反做决定', () => {
  const r = stanceFlip([...pad(3), '沈志国：签了吧。', '林晚：我绝不签字。', '沈志国：嗯。', '林晚：我签？'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 原谅域不归本引擎（归 cheap-forgiveness）', () => {
  const r = stanceFlip([...pad(3), '林晚：我恨你，一辈子都不原谅你。', '沈志国：晚晚……', '林晚：我原谅你了。'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg zh: 讨价还价后成交（条件在过程中说清）不判', () => {
  const r = stanceFlip([
    ...pad(3),
    '张总：这个项目你接不接？',
    '林晚：我不接。',
    '张总：条件随你开。',
    '林晚：我要三个点。',
    '张总：两个半，再给你配两个人。',
    '林晚：成交，我接了。',
  ].join('\n'));
  assert.equal(r.hits.length, 0);
});

/* ============================ 英文 ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(stanceFlip('').score, 100);
});

test('en: I am not signing → Fine. I will sign with one gap line → 57', () => {
  const r = stanceFlip(
    [...epad(3), 'VICTOR: Sign it.', 'LINNA: I am not signing, over my dead body.', 'VICTOR: Think again.', 'LINNA: Fine. I will sign.'].join('\n'),
  );
  assert.equal(r.hits[0].family, 'sign');
  assert.equal(r.hits[0].rescued, false);
  assert.equal(r.score, 57);
});

test('en: refusal → bare "Fine." after one weak plea → 57', () => {
  const r = stanceFlip(
    [...epad(3), 'VICTOR: Come home.', 'LINNA: I am not going back.', 'VICTOR: Please.', 'LINNA: Fine.'].join('\n'),
  );
  assert.equal(r.hits[0].family, 'goto');
  assert.equal(r.score, 57);
});

test('en: handover refusal → here take it, no pressure → hit', () => {
  const r = stanceFlip(
    [...epad(3), 'VICTOR: Give me the file.', 'LINNA: You are not getting it.', 'VICTOR: Now.', 'LINNA: Here, take it.'].join('\n'),
  );
  assert.equal(r.hits[0].family, 'handover');
  assert.equal(r.hits[0].rescued, false);
});

test('en: wedlock refusal → okay I will marry → hit', () => {
  const r = stanceFlip(
    [...epad(3), 'VICTOR: Marry me.', 'LINNA: I will not marry you.', 'VICTOR: Please?', 'LINNA: Okay. I will marry you.'].join('\n'),
  );
  assert.equal(r.hits[0].family, 'wedlock');
});

test('en rescue: evidence beat + strong cue + conditional reversal → 100', () => {
  const r = stanceFlip(
    [
      ...epad(3),
      'VICTOR: Sign it.',
      'LINNA: I am not signing.',
      'He slides the paternity report across the desk.',
      'VICTOR: Read this first.',
      'LINNA: Fine, I will sign, but you have to bring her home.',
    ].join('\n'),
  );
  assert.equal(r.hits[0].rescued, true);
  assert.equal(r.score, 100);
});

test('neg en: ordinary dialogue → 100', () => {
  const r = stanceFlip(
    [...epad(3), 'VICTOR: Dinner is ready.', 'LINNA: I am not hungry.', 'VICTOR: Suit yourself.', 'LINNA: I will take a walk.'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg en: gap beyond 10 non-empty lines voids the anchor', () => {
  const r = stanceFlip(['LINNA: I am not signing.', ...epad(11), 'VICTOR: Sign.', 'LINNA: I will sign.'].join('\n'));
  assert.equal(r.hits.length, 0);
});

test('neg en: question reversal does not count', () => {
  const r = stanceFlip(
    [...epad(3), 'VICTOR: Sign it.', 'LINNA: I am not signing.', 'VICTOR: Well?', 'LINNA: I will sign?'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

/* ============================ 多跳封底 ============================ */

test('score: 两处无因横跳封底 20', () => {
  const r = stanceFlip(
    [
      ...pad(2),
      '沈志国：签字吧。',
      '林晚：我不签。',
      '沈志国：快签。',
      '林晚：我签。',
      '助理：那文件的事？',
      '林晚：我不帮，别找我。',
      '助理：求你了。',
      '林晚：行，我帮你。',
    ].join('\n'),
  );
  assert.equal(r.hits.filter((h) => !h.rescued).length, 2);
  assert.equal(r.score, 20);
});
