// v2.80 台词复述画面检测（Mirror-Visual Dialogue）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/mirror-visual-dialogue.js');

const HEADER = '内景·客厅·夜';

describe('v2.80 mirror-visual-dialogue 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.mirrorVisualDialogue('').score, 100);
  });
});

describe('v2.80 mirror-visual-dialogue 命中', () => {
  test('台词原样复述眼前物件', () => {
    const draft = [
      HEADER,
      '桌上摊着一份离婚协议书，林棠的手指按在落款处。',
      '林棠：这是离婚协议书。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].speaker, '林棠');
    assert.ok(r.score < 100);
  });

  test('复述墙上照片判', () => {
    const draft = [
      HEADER,
      '墙上还挂着那张结婚照，玻璃框裂了一道纹。',
      '林棠：这张结婚照该摘了。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 1);
  });

  test('多点复述累计扣分', () => {
    const draft = [
      HEADER,
      '桌上摊着一份离婚协议书。',
      '林棠：这是离婚协议书。',
      '沈知远没说话。',
      '门口摆着两个收拾好的行李箱。',
      '林棠：那是收拾好的行李箱。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.ok(r.hits.length >= 2);
    assert.ok(r.score < 80);
  });
});

describe('v2.80 mirror-visual-dialogue 豁免', () => {
  test('质问反应不判', () => {
    const draft = [
      HEADER,
      '她抬手一巴掌甩在他脸上，掌心发麻。',
      '林棠：你居然打我？',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('命令句不判', () => {
    const draft = [
      HEADER,
      '离婚协议书被推到他面前，笔搁在上面。',
      '林棠：把字签了。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('带新信息（合同/要求）不判', () => {
    const draft = [
      HEADER,
      '桌上摊着一份文件，封皮磨旧了。',
      '沈知远：这份合同你今天必须签。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('长台词在表达观点不判', () => {
    const draft = [
      HEADER,
      '桌上摊着一份离婚协议书。',
      '林棠：这份离婚协议书我等了整整三年，从你第一次夜不归宿那晚起我就在等它。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('给立场与新条件不判（好台词）', () => {
    const draft = [
      HEADER,
      '离婚协议书摊在茶几上，屋里没开灯。',
      '林棠：房子归我，存款归你，孩子姓林。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.score, 100);
  });

  test('场景头后首句无叙述行不判', () => {
    const draft = [
      HEADER,
      '林棠：这是离婚协议书。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('换场清空叙述行不判', () => {
    const draft = [
      HEADER,
      '桌上摊着一份离婚协议书。',
      '内景·卧室·夜',
      '林棠：这是离婚协议书。',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 mirror-visual-dialogue en', () => {
  test('restating the visible object flagged', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'A divorce agreement lies open on the table, her finger on the signature line.',
      'Anna: This is the divorce agreement on the table.',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 1);
  });

  test('question and command exempt', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'The ring sits on the table between them.',
      'Ben: Give me the ring back.',
      'Anna: Is this really happening?',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('stance line clean', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'She slides the keys across the table.',
      'Anna: The house is yours. I want the car and the shares.',
    ].join('\n');
    const r = M.mirrorVisualDialogue(draft);
    assert.equal(r.score, 100);
  });
});
