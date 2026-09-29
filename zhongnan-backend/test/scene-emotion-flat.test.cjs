// v2.80 场景情绪平检测（Scene Emotional Flatness）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/scene-emotion-flat.js');

describe('v2.80 scene-emotion-flat 空输入', () => {
  test('空草稿满分', () => {
    const r = M.sceneEmotionFlat('');
    assert.equal(r.score, 100);
    assert.equal(r.flatScenes.length, 0);
  });
});

describe('v2.80 scene-emotion-flat 单一场景全中性', () => {
  test('≥3句全中性触发 all-neutral', () => {
    const draft = '内景·客厅·日\n沈知远：今天周二。\n林棠：嗯。\n沈知远：走吧。';
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 1);
    assert.equal(r.flatScenes[0].reason, 'all-neutral');
    assert.ok(r.score < 100);
  });
});

describe('v2.80 scene-emotion-flat 单一情绪价', () => {
  test('全负面情绪触发 single-valence', () => {
    const draft = '内景·客厅·日\n沈知远：我恨你。\n林棠：我也痛苦。\n沈知远：去死吧。';
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 1);
    assert.equal(r.flatScenes[0].reason, 'single-valence');
  });
  test('正负对撞不触发', () => {
    const draft = '内景·客厅·日\n沈知远：我恨你。\n林棠：但我还爱你。\n沈知远：走吧。';
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 0);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 scene-emotion-flat 少于3句跳过', () => {
  test('2句对白不判平', () => {
    const draft = '内景·客厅·日\n沈知远：今天周二。\n林棠：嗯。';
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 0);
  });
});

describe('v2.80 scene-emotion-flat 多场景', () => {
  test('一个平一个不平只报平的', () => {
    const draft = [
      '内景·客厅·日',
      '沈知远：今天周二。',
      '林棠：嗯。',
      '沈知远：走吧。',
      '外景·街道·日',
      '沈知远：我好开心。',
      '林棠：但我怕。',
      '沈知远：别怕有我。',
    ].join('\n');
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 1);
    assert.ok(r.score > 0 && r.score < 100);
  });
});

describe('v2.80 scene-emotion-flat en 链路', () => {
  test('英文全中性触发', () => {
    const draft = 'INT. LIVING ROOM - DAY\nSteve: It is Tuesday.\nLisa: Yes.\nSteve: Let us go.';
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 1);
    assert.equal(r.flatScenes[0].reason, 'all-neutral');
  });
  test('英文正负对撞不触发', () => {
    const draft = 'INT. LIVING ROOM - DAY\nSteve: I hate you.\nLisa: But I still love you.\nSteve: Go.';
    const r = M.sceneEmotionFlat(draft);
    assert.equal(r.flatScenes.length, 0);
  });
});

describe('v2.80 scene-emotion-flat advice 非空', () => {
  test('每个平场景都有改写建议', () => {
    const draft = '内景·客厅·日\n沈知远：今天周二。\n林棠：嗯。\n沈知远：走吧。';
    const r = M.sceneEmotionFlat(draft);
    assert.ok(r.flatScenes[0].advice.length > 0);
  });
});
