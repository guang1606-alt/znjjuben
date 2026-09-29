// v2.80 道理升华旁白检测（Moral Narration）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/moral-narration.js');

describe('v2.80 moral-narration 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.moralNarration('').score, 100);
    assert.equal(M.moralNarration(' ').hits.length, 0);
  });
});

describe('v2.80 moral-narration 中文命中', () => {
  test('领悟宣告：这一刻她终于明白+抽象道理', () => {
    const r = M.moralNarration('这一刻，她终于明白，心软是病，情深致命。');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'realization');
    assert.equal(r.hits[0].rescued, false);
    assert.equal(r.score, 75);
  });

  test('领悟宣告：终于懂得+世界/善良', () => {
    const r = M.moralNarration('她终于懂得：在这个世界，善良换不来尊重。');
    assert.equal(r.hits.length, 1);
  });

  test('格言起句：原来豪门婚姻从来都是交易', () => {
    const r = M.moralNarration('原来豪门婚姻从来都是一场交易。');
    assert.equal(r.hits[0].kind, 'aphorism');
  });

  test('格言起句：这就是成长的代价', () => {
    const r = M.moralNarration('这就是成长的代价。');
    assert.equal(r.hits.length, 1);
  });

  test('三次命中压到 25', () => {
    const r = M.moralNarration([
      '这一刻，她终于明白，心软是病。',
      '内景·公寓·夜',
      '原来男人从来都是靠不住的。',
      '内景·医院·日',
      '这就是嫁入豪门的报应。',
    ].join('\n'));
    assert.equal(r.hits.length, 3);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 moral-narration 中文豁免', () => {
  test('rescue：领悟后立刻拉黑+不回头', () => {
    const r = M.moralNarration([
      '这一刻她终于明白，乞求换不来尊重。',
      '她拉黑了所有联系方式，再没回头。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.hits[0].rescueLine, 2);
    assert.equal(r.score, 100);
  });

  test('台词里的格言是人物声口：跳过', () => {
    const r = M.moralNarration('林晚：我算是明白了，这男人就没一个好东西。');
    assert.equal(r.hits.length, 0);
  });

  test('直接引语行：跳过', () => {
    const r = M.moralNarration('“我终于明白，嫁入豪门就是跳火坑。”');
    assert.equal(r.hits.length, 0);
  });

  test('换场后才行动不算 rescue', () => {
    const r = M.moralNarration([
      '这一刻她终于明白，乞求换不来尊重。',
      '内景·公寓·日',
      '她拉黑了他的号码。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });

  test('具体事实发现不是格言：原来他早就出轨了', () => {
    const r = M.moralNarration('原来他早就出轨了。');
    assert.equal(r.hits.length, 0);
  });

  test('看清真面目无抽象道理词：不判', () => {
    const r = M.moralNarration('她看清了他的真面目。');
    assert.equal(r.hits.length, 0);
  });

  test('纯动作叙述零命中', () => {
    const r = M.moralNarration('她攥紧了报告单，指节发白。');
    assert.equal(r.score, 100);
  });
});

describe('v2.80 moral-narration English', () => {
  test('finally understood + abstract lesson', () => {
    const r = M.moralNarration('In that moment she finally understood that love was a ledger.');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'realization');
  });

  test('Life … was aphorism', () => {
    const r = M.moralNarration('Life, she realized, was just a series of transactions.');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'aphorism');
  });

  test('dialogue aphorism skipped', () => {
    const r = M.moralNarration('MAYA: I finally get it — men are trash.');
    assert.equal(r.hits.length, 0);
  });

  test('rescued by blocking the number', () => {
    const r = M.moralNarration([
      'In that moment she finally understood that promises meant nothing.',
      'She blocked his number and never looked back.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('concrete discovery without abstract noun exempt', () => {
    const r = M.moralNarration('She finally understood the alarm code.');
    assert.equal(r.hits.length, 0);
  });
});
