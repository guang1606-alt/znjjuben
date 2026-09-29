'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { previewVoiceover } = require('../dist/engine/preview-voiceover.js');

const pad = (n) =>
  Array.from({ length: n }, (_, i) => `△林晚走进客厅，扫了一眼桌上的文件，脚步顿住${i + 1}。`);
const epad = (n) =>
  Array.from({ length: n }, (_, i) => `Linna steps into the room and glances at the papers, pausing briefly (${i + 1}).`);

/* ============================ 中文：A 预告标记 ============================ */

test('zh: 空稿满分', () => {
  assert.equal(previewVoiceover('').score, 100);
});

test('zh A: 集尾「下集预告：…」→ marker，55 分', () => {
  const r = previewVoiceover([...pad(14), '下集预告：沈志国带着亲子鉴定出现在婚礼上。'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'marker');
  assert.equal(r.hits[0].line, 15);
  assert.equal(r.score, 55);
});

test('zh A: 未完待续 / 且听下回分解 → marker', () => {
  const r1 = previewVoiceover([...pad(14), '未完待续。'].join('\n'));
  assert.equal(r1.hits[0].kind, 'marker');
  const r2 = previewVoiceover([...pad(14), '预知后事如何，且听下回分解。'].join('\n'));
  assert.equal(r2.hits[0].kind, 'marker');
});

test('zh A: 剧中段出现预告标记也要判（不限集尾）', () => {
  const draft = ['场1：夜·沈家客厅', '沈志国：你好。', '下集预告：他将摊牌。', '林晚：请坐。'].join('\n');
  const r = previewVoiceover(draft);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].line, 3);
  assert.equal(r.score, 55);
});

/* ============================ 中文：B 主播口播 ============================ */

test('zh B: 关注点赞追更口播 → pitch，80 分', () => {
  const r = previewVoiceover([...pad(14), '关注我，下集更精彩，记得点赞追更！'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'pitch');
  assert.equal(r.score, 80);
});

test('zh B: 订阅/双击屏幕/一键三连 → pitch', () => {
  const r1 = previewVoiceover([...pad(14), '喜欢的话双击屏幕，订阅不迷路！'].join('\n'));
  assert.equal(r1.hits[0].kind, 'pitch');
  const r2 = previewVoiceover([...pad(14), '记得一键三连，每日更新。'].join('\n'));
  assert.equal(r2.hits[0].kind, 'pitch');
});

/* ============================ 中文：C 集尾将来时排播 ============================ */

test('zh C: 叙述句集尾连播两个具体节拍 → future_dump，74 分', () => {
  const r = previewVoiceover(
    [...pad(11), '△第二天，他将带着合同上门逼她签字，她会在董事会上被当众揭穿。'].join('\n'),
  );
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'future_dump');
  assert.equal(r.hits[0].beats, 2);
  assert.equal(r.hits[0].narrator, true);
  assert.equal(r.score, 74);
});

test('zh C: 旁白（NARRATOR 说话人）连播两拍 → future_dump', () => {
  const r = previewVoiceover(
    [...pad(11), '旁白：明天的婚礼上，他将当众跪下求婚，而她会拿出亲子鉴定揭穿一切。'].join('\n'),
  );
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'future_dump');
  assert.equal(r.hits[0].beats, 2);
});

test('zh C: 只有一个具体节拍不判（给单拍预告留余地）', () => {
  const r = previewVoiceover(
    [...pad(11), '△第二天，他将带着合同上门。'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('zh C: 抽象全知预告不归本引擎（归 omniscient-tease）', () => {
  const r = previewVoiceover(
    [...pad(11), '△明天，等待她的将是一场无人知晓的审判。'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('zh C: 非集尾位置（开头）不判 future_dump', () => {
  const r = previewVoiceover(
    ['△第二天，他将带着合同上门逼她签字，她会在董事会上被当众揭穿。', ...pad(13)].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

/* ============================ 中文：反例 ============================ */

test('neg zh: 在场的现在时强钩子 → 100', () => {
  const r = previewVoiceover(
    [
      ...pad(11),
      '△门被猛地推开，林晚浑身湿透站在门口，手里攥着那份亲子鉴定。',
      '林晚：你还有什么话说？',
      '△沈志国的脸瞬间煞白。',
    ].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg zh: 角色当场布置明天的计划（对白，非旁白）→ 100', () => {
  const r = previewVoiceover(
    [...pad(11), '林晚：明天我去公司拖住他，你去机场接人，东西到手立刻联系。'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg zh: 集尾台词威胁（现在时情绪，不是预告）→ 100', () => {
  const r = previewVoiceover(
    [...pad(11), '林晚：沈志国，我会让你身败名裂，跪着把我妈的东西还回来。'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg zh: 正文正常段落 → 100', () => {
  const draft = [
    '场1：夜·沈家别墅',
    '△林晚推门进来，雨水顺着衣角往下滴。',
    '林晚：亲子鉴定在我手上，你还有什么话说？',
    '△沈志国猛地起身，带翻了身后的椅子。',
    '沈志国：你想怎么样？',
  ].join('\n');
  assert.equal(previewVoiceover(draft).hits.length, 0);
});

/* ============================ 英文：A/B/C ============================ */

test('en: empty draft scores 100', () => {
  assert.equal(previewVoiceover('').score, 100);
});

test('en A: TO BE CONTINUED → marker', () => {
  const r = previewVoiceover([...epad(14), 'TO BE CONTINUED.'].join('\n'));
  assert.equal(r.hits[0].kind, 'marker');
  assert.equal(r.score, 55);
});

test('en A: stay tuned / next time on → marker', () => {
  const r1 = previewVoiceover([...epad(14), 'Stay tuned for more.'].join('\n'));
  assert.equal(r1.hits[0].kind, 'marker');
  const r2 = previewVoiceover([...epad(14), "Next time on Crimson Vows, she will lose everything."].join('\n'));
  assert.equal(r2.hits[0].kind, 'marker');
});

test('en B: subscribe and hit the bell → pitch, 80', () => {
  const r = previewVoiceover([...epad(14), 'Subscribe and hit the bell for more!'].join('\n'));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'pitch');
  assert.equal(r.score, 80);
});

test('en C: NARRATOR future-tense two beats in tail zone → future_dump, 74', () => {
  const r = previewVoiceover(
    [
      ...epad(11),
      'NARRATOR: Tomorrow he will bring the contract and force her to sign, and she will expose him at the press conference.',
    ].join('\n'),
  );
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, 'future_dump');
  assert.equal(r.hits[0].beats, 2);
  assert.equal(r.score, 74);
});

test('en C: narration line "the next day" with two filmed actions → future_dump', () => {
  const r = previewVoiceover(
    [
      ...epad(11),
      'The next day, he will show up at the wedding with the paternity report, and the board will expose her in public.',
    ].join('\n'),
  );
  assert.equal(r.hits[0].kind, 'future_dump');
  assert.equal(r.hits[0].beats, 2);
});

/* ============================ 英文：反例 ============================ */

test('neg en: present-tense cliffhanger on a concrete action → 100', () => {
  const r = previewVoiceover(
    [
      ...epad(11),
      'The door flies open. Linna stands there, soaking wet, the paternity report in her hand.',
      'LINNA: Explain this.',
      'His face goes white.',
    ].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg en: character planning aloud in dialogue → 100', () => {
  const r = previewVoiceover(
    [...epad(11), 'LINNA: Tomorrow I will keep him busy at the office; you pick her up at the airport.'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

test('neg en: ordinary script body → 100', () => {
  const draft = [
    'INT. VILLA - NIGHT',
    'Linna pushes the door open, rain dripping from her coat.',
    'LINNA: I have the paternity report. What do you have to say?',
    'Victor stands up so fast his chair crashes to the floor.',
    'VICTOR: What do you want?',
  ].join('\n');
  assert.equal(previewVoiceover(draft).hits.length, 0);
});

test('neg en: one abstract tease belongs to omniscient-tease, not this engine', () => {
  const r = previewVoiceover(
    [...epad(11), 'What awaited her tomorrow was a trial no one knew about.'].join('\n'),
  );
  assert.equal(r.hits.length, 0);
});

/* ============================ 叠加计分 ============================ */

test('score: marker + pitch 同句叠加 → 35 分', () => {
  const r = previewVoiceover(
    [...pad(14), '下集预告更精彩，点个关注不迷路，未完待续！'].join('\n'),
  );
  assert.ok(r.hits.some((h) => h.kind === 'marker'));
  assert.ok(r.hits.some((h) => h.kind === 'pitch'));
  assert.equal(r.score, 35);
});

test('score: 多个命中封底 20', () => {
  const r = previewVoiceover(
    [
      ...pad(8),
      '下集预告：他将摊牌。',
      '未完待续。',
      '关注我点赞追更订阅频道双击屏幕。',
      '且听下回分解，敬请期待下集。',
      '旁白：明天他会签字，她会揭穿他，他们会报警，董事会将宣布一切。',
    ].join('\n'),
  );
  assert.ok(r.hits.length >= 4);
  assert.equal(r.score, 20);
});
