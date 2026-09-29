// v2.80 机械问答乒乓对白检测（Dialogue Ping-Pong）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/dialogue-pingpong.js');

describe('v2.80 dialogue-pingpong 空输入', () => {
  test('空草稿满分', () => {
    const r = M.dialoguePingpong('');
    assert.equal(r.score, 100);
    assert.equal(r.scenes.length, 0);
  });
});

describe('v2.80 dialogue-pingpong 三连机械问答', () => {
  test('问→短答连续3轮判过密', () => {
    const draft = [
      '内景·审讯室·夜',
      '警察：你叫什么名字？',
      '嫌犯：沈知远。',
      '警察：今年多大？',
      '嫌犯：二十八。',
      '警察：昨晚在哪？',
      '嫌犯：在家。',
      '警察：有人作证吗？',
      '嫌犯：没有。',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    assert.ok(r.scenes[0].maxChain >= 3);
    assert.equal(r.scenes[0].overused, true);
    assert.ok(r.score < 80);
  });
});

describe('v2.80 dialogue-pingpong 有对抗的问答', () => {
  test('反问/回避打断接球链', () => {
    const draft = [
      '内景·审讯室·夜',
      '警察：你叫什么名字？',
      '嫌犯：你凭什么抓我？',
      '警察：回答问题！',
      '嫌犯：没什么好说的。',
      '警察：昨晚在哪？',
      '嫌犯：（沉默）',
      '警察：说话！',
      '嫌犯：我说了，在家。',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    // 含反问、回避、沉默，直答链不超过1
    assert.ok(r.scenes[0].maxChain <= 1);
    assert.equal(r.scenes[0].overused, false);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 dialogue-pingpong 无问句句不判', () => {
  test('陈述对话满分', () => {
    const draft = [
      '内景·客厅·夜',
      '沈知远：今天天气不错。',
      '林棠：是啊，出去走走。',
      '沈知远：走吧。',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    assert.equal(r.scenes[0].questionCount, 0);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 dialogue-pingpong 直答率口径', () => {
  test('4问3直答但无3连，靠直答率>60%判过密', () => {
    const draft = [
      '内景·客厅·夜',
      '甲：你去哪？',
      '乙：外面。',
      '甲：跟谁？',
      '乙：你别管。',
      '甲：几点回？',
      '乙：十点。',
      '甲：要钱吗？',
      '乙：要。',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    // 3/4 直答 = 75%，问句≥4 → overused（直答率规则）
    assert.equal(r.scenes[0].overused, true);
  });
});

describe('v2.80 dialogue-pingpong en 链路', () => {
  test('英文三连机械问答', () => {
    const draft = [
      'INT. ROOM - NIGHT',
      'Cop: What is your name?',
      'Man: Steve.',
      'Cop: How old are you?',
      'Man: Twenty eight.',
      'Cop: Where were you last night?',
      'Man: At home.',
      'Cop: Any witness?',
      'Man: No.',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    assert.ok(r.scenes[0].maxChain >= 3);
    assert.equal(r.scenes[0].overused, true);
  });
  test('英文反问回避不接球', () => {
    const draft = [
      'INT. ROOM - NIGHT',
      'Cop: What is your name?',
      'Man: Why do you care?',
      'Cop: Answer me.',
      'Man: None of your business.',
      'Cop: Where were you?',
      'Man: Whatever.',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    assert.ok(r.scenes[0].maxChain <= 1);
    assert.equal(r.scenes[0].overused, false);
  });
  test('英文句首疑问词识别', () => {
    const draft = [
      'INT. ROOM - NIGHT',
      'Steve: Do you know the time?',
      'Lisa: Three.',
      'Steve: Is he coming?',
      'Lisa: Yeah.',
      'Steve: Can we wait?',
      'Lisa: Sure.',
      'Steve: Will it rain?',
      'Lisa: Nope.',
    ].join('\n');
    const r = M.dialoguePingpong(draft);
    assert.ok(r.scenes[0].questionCount >= 4);
  });
});
