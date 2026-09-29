// v2.80 情绪硬切无铺垫检测（Emotion Whiplash）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/emotion-whiplash.js');

describe('v2.80 emotion-whiplash 空输入', () => {
  test('空草稿满分', () => {
    const r = M.emotionWhiplash('');
    assert.equal(r.score, 100);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 emotion-whiplash 无铺垫对跳', () => {
  test('同一角色相邻台词怒→笑判硬切', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我恨你，滚出去！',
      '林棠：我原谅你了，我们重新开始吧。',
    ].join('\n');
    const r = M.emotionWhiplash(draft);
    assert.ok(r.hits.some((h) => h.type === 'bare_flip'));
    assert.ok(r.score < 90);
  });

  test('中间只有短动作行仍判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我恨你，滚出去！',
      '他愣了一下。',
      '林棠：我原谅你了。',
    ].join('\n');
    const r = M.emotionWhiplash(draft);
    assert.ok(r.hits.some((h) => h.type === 'bare_flip'));
  });
});

describe('v2.80 emotion-whiplash 有铺垫赦免', () => {
  test('揭示性新信息触发赦免', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我恨你，滚出去！',
      '沈知远：原来化验单是真的，孩子是你的。',
      '林棠：我原谅你了。',
    ].join('\n');
    const r = M.emotionWhiplash(draft);
    assert.equal(r.hits.filter((h) => h.type === 'bare_flip').length, 0);
    assert.equal(r.pardoned, 1);
  });

  test('≥20字实质动作缓冲赦免', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我恨你，滚出去！',
      '窗外的雨打在玻璃上，水痕一道一道往下淌，屋里没人说话。',
      '林棠：我原谅你了。',
    ].join('\n');
    const r = M.emotionWhiplash(draft);
    assert.equal(r.hits.filter((h) => h.type === 'bare_flip').length, 0);
    assert.equal(r.pardoned, 1);
  });
});

describe('v2.80 emotion-whiplash 瞬时翻转短语', () => {
  test('转怒为喜直接判', () => {
    const draft = '内景·客厅·夜\n她转怒为喜，笑着原谅了他。';
    const r = M.emotionWhiplash(draft);
    assert.ok(r.hits.some((h) => h.type === 'instant_phrase'));
  });
});

describe('v2.80 emotion-whiplash 不误判', () => {
  test('同极性连续不判', () => {
    const draft = '内景·客厅·夜\n林棠：我恨你！\n林棠：你给我滚出去！';
    const r = M.emotionWhiplash(draft);
    assert.equal(r.hits.length, 0);
  });
  test('跨场情绪变化不判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：我恨你，滚出去！',
      '外景·江边·日',
      '林棠：我原谅你了。',
    ].join('\n');
    const r = M.emotionWhiplash(draft);
    assert.equal(r.hits.filter((h) => h.type === 'bare_flip').length, 0);
  });
  test('无强情绪词的日常对话满分', () => {
    const draft = '内景·客厅·夜\n林棠：饭在锅里。\n沈知远：知道了。';
    const r = M.emotionWhiplash(draft);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 emotion-whiplash en 链路', () => {
  test('英文无铺垫 hate→love 判', () => {
    const draft = 'INT. ROOM - NIGHT\nAnna: I hate you!\nAnna: I love you.';
    const r = M.emotionWhiplash(draft);
    assert.ok(r.hits.some((h) => h.type === 'bare_flip'));
  });
  test('英文新信息铺垫赦免', () => {
    const draft = [
      'INT. ROOM - NIGHT',
      'Anna: I hate you!',
      'Mother: The police called. It turns out he was innocent.',
      'Anna: I love you.',
    ].join('\n');
    const r = M.emotionWhiplash(draft);
    assert.equal(r.hits.filter((h) => h.type === 'bare_flip').length, 0);
    assert.equal(r.pardoned, 1);
  });
  test('英文瞬时翻转短语判', () => {
    const draft = 'INT. ROOM - NIGHT\nHer anger instantly melted into a smile.';
    const r = M.emotionWhiplash(draft);
    assert.ok(r.hits.some((h) => h.type === 'instant_phrase'));
  });
});
