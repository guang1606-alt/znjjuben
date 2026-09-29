// v2.80 时间跳转兑付检测（Time-Jump Payoff）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/time-jump-payoff.js');

describe('v2.80 time-jump-payoff 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.timeJumpPayoff('').score, 100);
    assert.equal(M.timeJumpPayoff('  ').hits.length, 0);
  });
});

describe('v2.80 time-jump-payoff 中文命中', () => {
  test('三天后+已签离婚：75', () => {
    const r = M.timeJumpPayoff('三天后，她已经签好了离婚协议。');
    assert.equal(r.hits.length, 1);
    assert.equal(r.score, 75);
    assert.equal(r.hits[0].payoff.includes('签'), true);
  });

  test('一年后公司上市+一周后撤诉：50', () => {
    const r = M.timeJumpPayoff([
      '一年后，公司成功上市。',
      '内景·法庭·日',
      '一周后，对方终于撤诉了。',
    ].join('\n'));
    assert.equal(r.hits.length, 2);
    assert.equal(r.score, 50);
  });

  test('次日+和好如初', () => {
    const r = M.timeJumpPayoff('第二天，两人和好如初。');
    assert.equal(r.hits.length, 1);
  });

  test('裸跳转行+次行兑付：跨句命中', () => {
    const r = M.timeJumpPayoff(['三天后。', '婆婆终于松口，答应了这门婚事。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].line, 1);
  });

  test('不知过了多久+醒过来：命中', () => {
    const r = M.timeJumpPayoff('不知过了多久，她醒了过来。');
    assert.equal(r.hits.length, 1);
  });

  test('三次压到 25', () => {
    const r = M.timeJumpPayoff([
      '三天后，她签下了字。',
      '一周后，他撤诉了。',
      '一年后，公司易主。',
    ].join('\n'));
    assert.equal(r.hits.length, 3);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 time-jump-payoff 中文豁免', () => {
  test('裸跳转标记不判（归 timeline 引擎）', () => {
    const r = M.timeJumpPayoff('三天后。');
    assert.equal(r.hits.length, 0);
  });

  test('跳转后进入新场景不判', () => {
    const r = M.timeJumpPayoff('三年后，她推门走进会议室，所有董事同时起立。');
    assert.equal(r.hits.length, 0);
  });

  test('无跳转的当场结果不判', () => {
    const r = M.timeJumpPayoff('她抓起笔，当场签下离婚协议，抬眼看向他。');
    assert.equal(r.hits.length, 0);
  });

  test('正常叙述零命中', () => {
    const r = M.timeJumpPayoff('林晚把协议推过桌面：签。顾晏辰的笔悬在半空。');
    assert.equal(r.hits.length, 0);
  });

  test('裸跳转后次行是动作场面不判', () => {
    const r = M.timeJumpPayoff(['三天后。', '林晚推开会议室的门，把U盘拍在桌上。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 time-jump-payoff English', () => {
  test('three days later + papers signed', () => {
    const r = M.timeJumpPayoff('Three days later, the divorce papers were already signed.');
    assert.equal(r.hits.length, 1);
    assert.equal(r.score, 75);
  });

  test('a year later + went public', () => {
    const r = M.timeJumpPayoff('A year later, the company went public.');
    assert.equal(r.hits.length, 1);
  });

  test('bare jump line + next-line payoff', () => {
    const r = M.timeJumpPayoff(['The next morning.', 'He agreed to drop the charges.'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('jump entering a scene exempt', () => {
    const r = M.timeJumpPayoff('Three years later, she pushed open the boardroom door.');
    assert.equal(r.hits.length, 0);
  });

  test('no-jump on-screen result exempt', () => {
    const r = M.timeJumpPayoff('She grabbed the pen and signed the papers on the spot.');
    assert.equal(r.hits.length, 0);
  });
});
