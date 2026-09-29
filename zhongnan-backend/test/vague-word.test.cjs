// v2.80 模糊词/空心词检测（Vague Word / Hedge Detection）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/vague-word.js');

describe('v2.80 vague-word 空输入', () => {
  test('空草稿满分', () => {
    const r = M.vagueWord('');
    assert.equal(r.score, 100);
    assert.equal(r.totalCount, 0);
  });
});

describe('v2.80 vague-word 对冲语态', () => {
  test('似乎/仿佛命中 hedge', () => {
    const draft = '内景·房间·夜\n他似乎站在门口，仿佛在等什么。';
    const r = M.vagueWord(draft);
    assert.ok(r.counts.hedge >= 2);
    assert.ok(r.score < 100);
  });
});

describe('v2.80 vague-word 空心名词', () => {
  test('东西/事情命中 filler', () => {
    const draft = '内景·房间·夜\n桌上放着一个奇怪的东西，他想起那件事情。';
    const r = M.vagueWord(draft);
    assert.ok(r.counts.filler >= 2);
  });
});

describe('v2.80 vague-word 模糊量词', () => {
  test('某种/一种/说不出的命中 measure', () => {
    const draft = '内景·房间·夜\n一股寒意升起，某种说不出的感觉弥漫开来。';
    const r = M.vagueWord(draft);
    assert.ok(r.counts.measure >= 3);
  });
});

describe('v2.80 vague-word 台词不统计', () => {
  test('对白里的口语模糊词不计入叙述', () => {
    const draft = '内景·房间·夜\n沈知远：我好像落了什么东西在家里。';
    const r = M.vagueWord(draft);
    assert.equal(r.totalCount, 0);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 vague-word 干净叙述满分', () => {
  test('具体所指无模糊词', () => {
    const draft = '内景·房间·夜\n他推开门，钥匙插进锁孔，铜芯转动两圈。';
    const r = M.vagueWord(draft);
    assert.equal(r.totalCount, 0);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 vague-word 密度与建议', () => {
  test('高模糊密度分数低', () => {
    const draft = '内景·房间·夜\n似乎有一种东西在动，仿佛某种事情要发生，看起来好像有什么玩意儿。';
    const r = M.vagueWord(draft);
    assert.ok(r.densityPer100 > 30);
    assert.ok(r.score < 60);
  });
  test('有命中时给具体化建议', () => {
    const draft = '内景·房间·夜\n他似乎看见了什么东西。';
    const r = M.vagueWord(draft);
    assert.ok(r.advice.length > 0);
    assert.ok(r.issues.length > 0);
  });
});

describe('v2.80 vague-word en 链路', () => {
  test('seemed/somehow 命中 hedge', () => {
    const draft = 'INT. ROOM - NIGHT\nHe seemed nervous and somehow the door was open.';
    const r = M.vagueWord(draft);
    assert.ok(r.counts.hedge >= 2);
  });
  test('something/stuff 命中 filler', () => {
    const draft = 'INT. ROOM - NIGHT\nThere was something on the table, some old stuff.';
    const r = M.vagueWord(draft);
    assert.ok(r.counts.filler >= 2);
  });
  test('a sense of / some kind of 命中 measure', () => {
    const draft = 'INT. ROOM - NIGHT\nA sense of dread rose, some kind of machine hummed.';
    const r = M.vagueWord(draft);
    assert.ok(r.counts.measure >= 2);
  });
  test('some kind of 不被 hedge 重复计数', () => {
    const draft = 'INT. ROOM - NIGHT\nIt was some kind of trap.';
    const r = M.vagueWord(draft);
    assert.equal(r.counts.hedge, 0);
    assert.equal(r.counts.measure, 1);
  });
  test('英文干净叙述满分', () => {
    const draft = 'INT. ROOM - NIGHT\nHe turned the key twice and pushed the door open.';
    const r = M.vagueWord(draft);
    assert.equal(r.score, 100);
  });
  test('英文台词不统计', () => {
    const draft = 'INT. ROOM - NIGHT\nSteve: I kind of forgot something, sorry.';
    const r = M.vagueWord(draft);
    assert.equal(r.counts.filler, 0);
  });
});
