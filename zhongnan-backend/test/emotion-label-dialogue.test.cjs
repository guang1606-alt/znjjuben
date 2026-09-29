// v2.80 台词情绪点名检测（Emotion-Label Dialogue）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/emotion-label-dialogue.js');

describe('v2.80 emotion-label-dialogue 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.emotionLabelDialogue('').score, 100);
  });
});

describe('v2.80 emotion-label-dialogue 中文命中', () => {
  test('我对你太失望了', () => {
    const r = M.emotionLabelDialogue('内景·客厅·夜\n林母：我对你太失望了。');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].emotion, '失望');
  });
  test('你让我很生气', () => {
    const r = M.emotionLabelDialogue('内景·客厅·夜\n林棠：你真的让我很生气。');
    assert.equal(r.hits.length, 1);
  });
  test('我好害怕', () => {
    const r = M.emotionLabelDialogue('内景·卧室·夜\n林棠：我好害怕。');
    assert.equal(r.hits.length, 1);
  });
  test('我现在真的很难过', () => {
    const r = M.emotionLabelDialogue('内景·卧室·夜\n林棠：我现在真的很难过。');
    assert.ok(r.hits.length >= 1);
  });
});

describe('v2.80 emotion-label-dialogue 豁免', () => {
  test('带具体事实的长句不判', () => {
    const r = M.emotionLabelDialogue('内景·客厅·夜\n林棠：我生气是因为你瞒着我把合同签了。');
    assert.equal(r.hits.length, 0);
  });
  test('叙述行情绪词不统计（归 show-dont-tell）', () => {
    const r = M.emotionLabelDialogue('内景·客厅·夜\n她很失望地看着离婚协议。');
    assert.equal(r.dialogueLines, 0);
  });
  test('把情绪压成具体指控不判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：字签了，明天搬家。',
      '沈知远：首付是我妈卖了老宅凑的，你一分钱别想拿。',
    ].join('\n');
    const r = M.emotionLabelDialogue(draft);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 emotion-label-dialogue 密度扣分', () => {
  test('多点名累计扣分并算率', () => {
    const draft = [
      '内景·客厅·夜',
      '甲：我对你太失望了。',
      '乙：我也很难过。',
      '甲：我现在特别焦虑。',
      '乙：够了。',
    ].join('\n');
    const r = M.emotionLabelDialogue(draft);
    assert.ok(r.hits.length >= 2);
    assert.ok(r.rate > 0.4);
    assert.ok(r.score < 85);
  });
});

describe('v2.80 emotion-label-dialogue en', () => {
  test("I'm so disappointed in you", () => {
    const r = M.emotionLabelDialogue('INT. ROOM - NIGHT\nAnna: I am so disappointed in you.');
    assert.equal(r.hits.length, 1);
  });
  test('you make me angry', () => {
    const r = M.emotionLabelDialogue('INT. ROOM - NIGHT\nAnna: You make me feel angry.');
    assert.equal(r.hits.length, 1);
  });
  test('because-specific line exempt', () => {
    const r = M.emotionLabelDialogue('INT. ROOM - NIGHT\nAnna: I am angry because you signed the contract behind my back.');
    assert.equal(r.hits.length, 0);
  });
  test('specific action line clean', () => {
    const r = M.emotionLabelDialogue('INT. ROOM - NIGHT\nAnna: Keep the house. I want the shares.');
    assert.equal(r.score, 100);
  });
});
