// v2.80 努力过程概述/场外达成检测（Effort Gloss）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/effort-gloss.js');

const HEADER = '内景·会客室·日';

describe('v2.80 effort-gloss 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.effortGloss('').score, 100);
    assert.equal(M.effortGloss('   ').hits.length, 0);
  });
});

describe('v2.80 effort-gloss 中文命中', () => {
  test('几经周折 + 签下', () => {
    const r = M.effortGloss([HEADER, '几经周折，她终于签下了合同。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].phrase, '几经周折');
    assert.ok(r.score < 100);
  });

  test('好说歹说 + 答应', () => {
    const r = M.effortGloss([HEADER, '好说歹说，他才答应帮忙。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('费尽口舌 + 说服', () => {
    const r = M.effortGloss([HEADER, '费尽口舌，林棠总算说服了婆婆。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('软磨硬泡 + 拿下', () => {
    const r = M.effortGloss([HEADER, '靠着软磨硬泡，她拿下了这个项目。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('反复沟通 + 同意', () => {
    const r = M.effortGloss([HEADER, '经过反复沟通，对方终于同意和解。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('苦苦哀求 + 松口', () => {
    const r = M.effortGloss([HEADER, '她苦苦哀求，保安才松口放行。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('好不容易 + 查到', () => {
    const r = M.effortGloss([HEADER, '他好不容易才查到那份病历的下落。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('多命中扣分且有下限', () => {
    const r = M.effortGloss([
      HEADER,
      '几经周折，她终于签下了合同。',
      '好说歹说，他才答应帮忙。',
      '费尽口舌，林棠总算说服了婆婆。',
      '软磨硬泡，她拿下了这个项目。',
      '苦苦哀求，保安才松口放行。',
      '反复交涉后，对方同意撤诉。',
      '几经辗转，她找回了被带走的孩子。',
    ].join('\n'));
    assert.equal(r.hits.length, 7);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 effort-gloss 中文豁免', () => {
  test('裸结果句不判（场内正常结果交代）', () => {
    const r = M.effortGloss([
      HEADER,
      '她提笔签下了合同。',
      '对方同意了全部条件。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('终于 + 无结果动词不判', () => {
    const r = M.effortGloss([
      HEADER,
      '终于下雨了。',
      '他终于到家，鞋上全是泥。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('裸过程短语无结果（show-dont-tell 域，本引擎不判）', () => {
    const r = M.effortGloss([HEADER, '经过一番争辩，两人沉默下来。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('台词豁免', () => {
    const r = M.effortGloss([
      HEADER,
      '林棠：这一单是我几经周折才签下来的！',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('正面写出的交锋不判', () => {
    const r = M.effortGloss([
      HEADER,
      '她把合同推到他面前，钢笔悬在指尖。',
      '他看了三秒，把合同推了回去，起身扣上西装扣。',
      '她绕到门前，背抵着门板把笔又递了一次。',
      '他盯着她，夺过笔，在落款处划下名字。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 effort-gloss English', () => {
  test('after much persuasion + agreed', () => {
    const r = M.effortGloss([
      'INT. OFFICE - DAY',
      'After much persuasion, he finally agreed to sign.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('managed to convince（短语内含结果）', () => {
    const r = M.effortGloss([
      'INT. BOARDROOM - DAY',
      'She managed to convince the board after a lot of back and forth.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('after hours of negotiation + relented', () => {
    const r = M.effortGloss([
      'INT. LOBBY - NIGHT',
      'After hours of negotiation, the guard relented and let her pass.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('plain on-screen result is exempt', () => {
    const r = M.effortGloss([
      'INT. OFFICE - DAY',
      'She signed the contract without a word and slid it back.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('en dialogue is exempt', () => {
    const r = M.effortGloss([
      'INT. OFFICE - DAY',
      'LIN: I pulled so many strings just to get this meeting.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
