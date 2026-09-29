// v2.80 空口威胁检测（Empty Threat）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/empty-threat.js');

describe('v2.80 empty-threat 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.emptyThreat('').score, 100);
    assert.equal(M.emptyThreat(' ').hits.length, 0);
  });
});

describe('v2.80 empty-threat 中文命中', () => {
  test('单次空口威胁：75', () => {
    const r = M.emptyThreat('顾晏辰：你给我等着！');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
    assert.equal(r.score, 75);
  });

  test('你会后悔的+付出代价：两次 50', () => {
    const r = M.emptyThreat([
      '沈知远：你会后悔的！',
      '内景·走廊·夜',
      '顾晏辰：我会让你付出代价！',
    ].join('\n'));
    assert.equal(r.hits.length, 2);
    assert.equal(r.score, 50);
  });

  test('三次压到 25', () => {
    const r = M.emptyThreat([
      '甲：你完了！',
      '内景·走廊·夜',
      '乙：咱们走着瞧！',
      '内景·车库·夜',
      '丙：这事没完！',
    ].join('\n'));
    assert.equal(r.hits.length, 3);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 empty-threat 中文兑现豁免', () => {
  test('次行立刻动手：保镖扑上', () => {
    const r = M.emptyThreat([
      '顾晏辰：你给我等着！',
      '他一挥手，两个保镖立刻扑了上来。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('本句自带具体后果+死线：rescued', () => {
    const r = M.emptyThreat('顾晏辰：你完了——我现在就取消婚礼，让你净身出户。');
    assert.equal(r.hits[0].rescued, true);
  });

  test('换场后才动手不算兑现', () => {
    const r = M.emptyThreat([
      '顾晏辰：你给我等着！',
      '内景·办公室·日',
      '他一挥手，两个保镖把人架了出去。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });

  test('"他迟早会明白"不是威胁：零命中', () => {
    const r = M.emptyThreat('林晚：他迟早会明白的，算了。');
    assert.equal(r.hits.length, 0);
  });

  test('正常对话零命中', () => {
    const r = M.emptyThreat([
      '林晚把合同推过去：签了它，我们两清。',
      '顾晏辰盯着签名页，指尖发紧。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 empty-threat English', () => {
  test("You'll regret this bare threat", () => {
    const r = M.emptyThreat('DEREK: You will regret this!');
    assert.equal(r.hits.length, 1);
    assert.equal(r.score, 75);
  });

  test('Mark my words + this is not over', () => {
    const r = M.emptyThreat('Mark my words — this is not over.');
    assert.equal(r.hits.length, 2);
  });

  test('rescued by guards lunging next line', () => {
    const r = M.emptyThreat([
      'DEREK: You will pay for this!',
      'He signaled the guards, who lunged forward.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('inline concrete consequence rescued', () => {
    const r = M.emptyThreat("You're finished — I am cancelling the wedding right now.");
    assert.equal(r.hits[0].rescued, true);
  });

  test('ordinary dialogue exempt', () => {
    const r = M.emptyThreat('She pushed the contract across the desk.');
    assert.equal(r.hits.length, 0);
  });
});
