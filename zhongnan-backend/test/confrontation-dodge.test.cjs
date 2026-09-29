// v2.80 关键时刻打断逃场检测（Confrontation Dodge）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/confrontation-dodge.js');

const HEADER = '内景·公寓·夜';

describe('v2.80 confrontation-dodge 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.confrontationDodge('').score, 100);
    assert.equal(M.confrontationDodge('  ').hits.length, 0);
  });
});

describe('v2.80 confrontation-dodge 中文命中', () => {
  test('刚要摊牌+敲门声，本场不回收：单次警告 70', () => {
    const r = M.confrontationDodge([
      HEADER,
      '她刚要说出真相，敲门声突然响起。',
      '她起身去开门，门外站着快递员。',
      '两个人之后再没提这件事。',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
    assert.equal(r.score, 70);
  });

  test('台词中的即将爆发+次行电话响', () => {
    const r = M.confrontationDodge([
      HEADER,
      '林棠：我正要问你呢——',
      '手机突然响了。',
      '他如蒙大赦地接起电话聊了起来。',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('次行相邻共现也算', () => {
    const r = M.confrontationDodge([
      HEADER,
      '她正要质问他。',
      '助理推门冲了进来。',
      '会议室里的人纷纷低头看文件，没人接话。',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('四次逃场压到下限 25', () => {
    const r = M.confrontationDodge([
      HEADER,
      '她刚要说出真相，敲门声突然响起。',
      '内景·办公室·夜',
      '林棠正要质问，电话突然响了。',
      '内景·走廊·夜',
      '话还没说完，助理推门冲了进来。',
      '内景·书房·夜',
      '他刚开口，门铃不合时宜地响起。',
      '她攥着报告，终究没问出口。',
    ].join('\n'));
    assert.equal(r.hits.length, 4);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 confrontation-dodge 中文豁免', () => {
  test('rescue：打断后本场捡回冲突', () => {
    const r = M.confrontationDodge([
      '内景·办公室·夜',
      '她正要质问他合同的事，电话突然响了。',
      '他伸手要接。',
      '她一把按住话筒，继续追问：字是不是你签的？',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('集尾打断是钩子，豁免', () => {
    const r = M.confrontationDodge([
      HEADER,
      '林棠攥着鉴定报告，指尖泛白。',
      '她深吸一口气刚要开口，门铃声大作。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
    assert.equal(r.score, 100);
  });

  test('换场后才想继续不算 rescue', () => {
    const r = M.confrontationDodge([
      HEADER,
      '她刚要摊牌，手机突然响了。',
      '内景·医院·日',
      '第二天她拦住他继续追问昨晚的事。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });

  test('只有即将爆发没有打断：不算', () => {
    const r = M.confrontationDodge([
      HEADER,
      '她深吸一口气，把鉴定报告摔在他面前。',
      '林棠：说，这份亲子鉴定你怎么解释？',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('只有打断信号没有即将爆发：日常敲门不算', () => {
    const r = M.confrontationDodge([
      HEADER,
      '敲门声响起，她点的外卖到了。',
      '她起身接过餐盒道了声谢。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 confrontation-dodge English', () => {
  test('about to reveal + knock, unresolved', () => {
    const r = M.confrontationDodge([
      'INT. APARTMENT - NIGHT',
      'She was about to reveal the truth when a knock at the door cut her off.',
      'She opened it to a delivery man and never came back to it.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
    assert.equal(r.score, 70);
  });

  test('before she could finish + phone rang', () => {
    const r = M.confrontationDodge([
      'INT. OFFICE - NIGHT',
      "Before she could finish, his phone rang.",
      'He took the call and walked out without another word.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('rescued when pressed on in same scene', () => {
    const r = M.confrontationDodge([
      'INT. OFFICE - NIGHT',
      'She was about to confront him when the doorbell rang.',
      'He reached for the door. She blocked it and pressed on: "Who signed?"',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('episode-end interruption exempt', () => {
    const r = M.confrontationDodge([
      'INT. STUDY - NIGHT',
      'She held the report, hands shaking.',
      'She opened her mouth to speak, but the door burst open.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('knock without imminent beat exempt', () => {
    const r = M.confrontationDodge([
      'INT. APARTMENT - NIGHT',
      'A knock at the door — the takeout she ordered had arrived.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
