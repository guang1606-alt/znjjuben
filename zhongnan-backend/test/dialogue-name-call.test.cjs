// v2.80 对白直呼名检测（Dialogue Name-Call）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/dialogue-name-call.js');

describe('v2.80 dialogue-name-call 空输入', () => {
  test('空草稿满分', () => {
    const r = M.dialogueNameCall('');
    assert.equal(r.score, 100);
    assert.equal(r.callCount, 0);
  });
});

describe('v2.80 dialogue-name-call 两人戏句句叫名', () => {
  test('高称呼占比判过密', () => {
    const draft = [
      '内景·客厅·夜',
      '沈知远：林棠，你听我说。',
      '林棠：沈知远，我不听。',
      '沈知远：林棠，求你了。',
      '林棠：沈知远，晚了。',
    ].join('\n');
    const r = M.dialogueNameCall(draft);
    assert.ok(r.callCount >= 3);
    assert.ok(r.scenes[0].overused);
    assert.ok(r.score < 80);
    assert.ok(r.issues.length > 0);
  });
});

describe('v2.80 dialogue-name-call 两人戏自然对话', () => {
  test('不叫名满分', () => {
    const draft = [
      '内景·客厅·夜',
      '沈知远：你听我说。',
      '林棠：我不听。',
      '沈知远：求你了。',
      '林棠：晚了。',
    ].join('\n');
    const r = M.dialogueNameCall(draft);
    assert.equal(r.callCount, 0);
    assert.equal(r.score, 100);
  });
  test('偶发一次叫名不判过密', () => {
    const draft = [
      '内景·客厅·夜',
      '沈知远：你听我说。',
      '林棠：我不听。',
      '沈知远：林棠，求你了。',
      '林棠：晚了。',
    ].join('\n');
    const r = M.dialogueNameCall(draft);
    assert.equal(r.callCount, 1);
    assert.equal(r.scenes[0].overused, false);
  });
});

describe('v2.80 dialogue-name-call 多人戏', () => {
  test('三人戏叫名锁定对象阈值放宽到50%', () => {
    const draft = [
      '内景·大厅·夜',
      '沈知远：林棠，你过来。',
      '林棠：好。',
      '沈知远：顾先生，你也留下。',
      '顾晏：可以。',
    ].join('\n');
    const r = M.dialogueNameCall(draft);
    assert.equal(r.scenes[0].threshold, 0.5);
    assert.equal(r.scenes[0].overused, false);
  });
});

describe('v2.80 dialogue-name-call 短句场不判', () => {
  test('少于4行对白不判过密', () => {
    const draft = [
      '内景·门口·夜',
      '沈知远：林棠，走。',
      '林棠：沈知远，嗯。',
    ].join('\n');
    const r = M.dialogueNameCall(draft);
    assert.equal(r.scenes[0].overused, false);
  });
});

describe('v2.80 dialogue-name-call castNames 外部名', () => {
  test('传入全剧名但不在场不计', () => {
    const draft = [
      '内景·客厅·夜',
      '沈知远：你听我说。',
      '林棠：我不听。',
      '沈知远：走吧。',
      '林棠：嗯。',
    ].join('\n');
    const r = M.dialogueNameCall(draft, ['沈知远', '林棠', '顾晏']);
    // 顾晏不在场，台词里也没出现，零命中
    assert.equal(r.callCount, 0);
  });
});

describe('v2.80 dialogue-name-call en 链路', () => {
  test('英文两人戏高称呼占比判过密', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'Steve: Lisa, listen to me.',
      'Lisa: Steve, I cannot.',
      'Steve: Lisa, please.',
      'Lisa: Steve, too late.',
    ].join('\n');
    const r = M.dialogueNameCall(draft, ['Steve', 'Lisa']);
    assert.ok(r.callCount >= 3);
    assert.ok(r.scenes[0].overused);
  });
  test('英文词界（名不做子串匹配）', () => {
    const draft = [
      'INT. ROOM - NIGHT',
      'Steve: The steward looked away.',
      'Lisa: Stewardship matters.',
      'Steve: Give me the stew.',
      'Lisa: Fine then.',
    ].join('\n');
    // "stew/steward" 不应被当成 "Stew" 之类角色名；无在场角色名出现
    const r = M.dialogueNameCall(draft, ['Steve', 'Lisa']);
    assert.equal(r.callCount, 0);
  });
  test('英文自然对话满分', () => {
    const draft = [
      'INT. LIVING ROOM - NIGHT',
      'Steve: Listen to me.',
      'Lisa: I cannot.',
      'Steve: Please.',
      'Lisa: Too late.',
    ].join('\n');
    const r = M.dialogueNameCall(draft, ['Steve', 'Lisa']);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 dialogue-name-call advice', () => {
  test('过密时给删称呼建议', () => {
    const draft = [
      '内景·客厅·夜',
      '沈知远：林棠，你听我说。',
      '林棠：沈知远，我不听。',
      '沈知远：林棠，求你了。',
      '林棠：沈知远，晚了。',
    ].join('\n');
    const r = M.dialogueNameCall(draft);
    assert.ok(r.advice.includes('称呼'));
  });
});
