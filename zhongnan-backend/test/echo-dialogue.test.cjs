// v2.80 对白回声复述检测（Echo Dialogue）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/echo-dialogue.js');

describe('v2.80 echo-dialogue 空输入', () => {
  test('空草稿满分', () => {
    const r = M.echoDialogue('');
    assert.equal(r.score, 100);
  });
});

describe('v2.80 echo-dialogue 鹦鹉学舌', () => {
  test('短问句复述对方内容词判 parrot', () => {
    const draft = '内景·客厅·夜\n林棠：我们离婚吧。\n沈知远：离婚？';
    const r = M.echoDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'parrot' && h.echoed.includes('离婚')));
    assert.equal(r.parrotCount, 1);
  });

  test('同说话人不算回声', () => {
    const draft = '内景·客厅·夜\n林棠：我们离婚吧。\n林棠：离婚，你听见没有。';
    const r = M.echoDialogue(draft);
    assert.equal(r.parrotCount, 0);
  });

  test('功能性短语回声豁免', () => {
    const draft = '内景·客厅·夜\n林棠：我把合同签了。\n沈知远：真的吗？';
    const r = M.echoDialogue(draft);
    assert.equal(r.parrotCount, 0);
  });

  test('带立场新信息的回应不判', () => {
    const draft = '内景·客厅·夜\n林棠：我们离婚吧。\n沈知远：离就离，孩子和房子都归我。';
    const r = M.echoDialogue(draft);
    // 回应14字以上，含大量新内容，不构成短回声
    assert.equal(r.parrotCount, 0);
  });

  test('密集回声扣分', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我怀孕了。',
      '沈知远：怀孕了？',
      '林棠：孩子我要打掉。',
      '沈知远：打掉？',
      '林棠：明天我去医院。',
      '沈知远：医院？',
    ].join('\n');
    const r = M.echoDialogue(draft);
    assert.ok(r.parrotCount >= 2);
    assert.ok(r.score < 85);
  });
});

describe('v2.80 echo-dialogue 旁白复述', () => {
  test('他说+内容复述判 restate', () => {
    const draft = '内景·客厅·夜\n沈知远：我明天搬走。\n他说明天搬走。';
    const r = M.echoDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'restate'));
    assert.equal(r.restateCount, 1);
  });

  test('动作行提供新信息不判', () => {
    const draft = '内景·客厅·夜\n沈知远：我明天搬走。\n她把钥匙搁进玄关的瓷碗，碗沿磕出一声轻响。';
    const r = M.echoDialogue(draft);
    assert.equal(r.restateCount, 0);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 echo-dialogue 跨场不误判', () => {
  test('场尾与场首相同词不判', () => {
    const draft = '内景·客厅·夜\n林棠：合同作废。\n内景·办公室·日\n沈知远：合同签了。';
    const r = M.echoDialogue(draft);
    assert.equal(r.parrotCount, 0);
  });
});

describe('v2.80 echo-dialogue en 链路', () => {
  test('英文整句抛回判 parrot', () => {
    const draft = 'INT. ROOM - NIGHT\nAnna: The deal is off.\nBen: The deal is off?';
    const r = M.echoDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'parrot'));
  });
  test('英文 said 复述判 restate', () => {
    const draft = 'INT. ROOM - NIGHT\nSteve: I am leaving tomorrow.\nHe said he was leaving tomorrow.';
    const r = M.echoDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'restate'));
  });
  test('英文功能回应豁免', () => {
    const draft = 'INT. ROOM - NIGHT\nAnna: I signed the contract.\nBen: Are you serious?';
    const r = M.echoDialogue(draft);
    assert.equal(r.parrotCount, 0);
  });
});
