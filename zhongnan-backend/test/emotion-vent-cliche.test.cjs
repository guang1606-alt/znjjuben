// v2.80 情绪宣泄套路检测（Emotion-Vent Cliche）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/emotion-vent-cliche.js');

describe('v2.80 emotion-vent-cliche 空输入', () => {
  test('空草稿满分', () => {
    const r = M.emotionVentCliche('');
    assert.equal(r.score, 100);
    assert.deepEqual(r.familyCounts, { cry: 0, shout: 0, kneel: 0, selfharm: 0 });
  });
});

describe('v2.80 emotion-vent-cliche 复用阈值', () => {
  test('单次痛哭不罚', () => {
    const r = M.emotionVentCliche('眼泪夺眶而出。');
    assert.equal(r.hits[0].charged, false);
    assert.equal(r.score, 100);
  });

  test('痛哭第3次起 charged：75', () => {
    const r = M.emotionVentCliche([
      '眼泪夺眶而出。',
      '内景·客厅·夜',
      '她泪流满面，说不出话。',
      '内景·卧室·夜',
      '林晚失声痛哭，整个人蜷成一团。',
    ].join('\n'));
    assert.equal(r.familyCounts.cry, 3);
    assert.equal(r.score, 75);
  });

  test('痛哭第4次：50', () => {
    const r = M.emotionVentCliche([
      '眼泪夺眶而出。',
      '她泪流满面。',
      '林晚失声痛哭。',
      '她蹲在街角泣不成声。',
    ].join('\n'));
    assert.equal(r.familyCounts.cry, 4);
    assert.equal(r.score, 50);
  });

  test('跨族不合并', () => {
    const r = M.emotionVentCliche([
      '眼泪夺眶而出。',
      '她扑通一声跪下。',
    ].join('\n'));
    assert.equal(r.score, 100);
  });
});

describe('v2.80 emotion-vent-cliche 多档堆叠', () => {
  test('痛哭+嘶吼一句：chain 即扣', () => {
    const r = M.emotionVentCliche('她泪流满面，歇斯底里地嘶吼。');
    assert.equal(r.hits[0].kind, 'chain');
    assert.equal(r.score, 75);
  });

  test('跪求+自扇：chain', () => {
    const r = M.emotionVentCliche('她扑通跪下，狠狠扇了自己两个耳光。');
    assert.equal(r.hits[0].families.length, 2);
  });
});

describe('v2.80 emotion-vent-cliche 选择豁免', () => {
  test('哭完擦干泪拿起电话报警：rescued', () => {
    const r = M.emotionVentCliche([
      '林晚失声痛哭。',
      '她擦干眼泪，拿起电话拨通报警。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('哭着当场签字：rescued', () => {
    const r = M.emotionVentCliche('她泪流满面，当场签下自己的名字。');
    assert.equal(r.hits[0].rescued, true);
  });

  test('换场后才行动不算', () => {
    const r = M.emotionVentCliche([
      '她失声痛哭。',
      '内景·走廊·日',
      '她擦干眼泪拿起电话。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });
});

describe('v2.80 emotion-vent-cliche 边界', () => {
  test('台词行跳过', () => {
    const r = M.emotionVentCliche('林晚：我眼泪都快哭干了，你给我走！');
    assert.equal(r.hits.length, 0);
  });

  test('普通生理动作零命中', () => {
    const r = M.emotionVentCliche('他打了个哈欠，把文件翻到最后一页。');
    assert.equal(r.hits.length, 0);
  });

  test('正常叙述零命中', () => {
    const r = M.emotionVentCliche('她把钥匙搁在玄关的瓷盘里，没有回头。');
    assert.equal(r.hits.length, 0);
  });

  test('嘶吼族独立累计到3', () => {
    const r = M.emotionVentCliche([
      '她歇斯底里地尖叫。',
      '内景·书房·夜',
      '他咆哮着砸碎桌面。',
      '内景·楼梯·夜',
      '她喊得嗓子都哑了。',
    ].join('\n'));
    assert.equal(r.familyCounts.shout, 3);
    assert.equal(r.score, 75);
  });
});

describe('v2.80 emotion-vent-cliche English', () => {
  test('single cry exempt', () => {
    const r = M.emotionVentCliche('Tears streamed down her face.');
    assert.equal(r.hits[0].charged, false);
    assert.equal(r.score, 100);
  });

  test('third cry charged', () => {
    const r = M.emotionVentCliche([
      'Tears streamed down her face.',
      'She burst into tears.',
      'She sobbed uncontrollably on the floor.',
    ].join('\n'));
    assert.equal(r.familyCounts.cry, 3);
    assert.equal(r.score, 75);
  });

  test('chain cry + scream', () => {
    const r = M.emotionVentCliche('She burst into tears and screamed at the top of her lungs.');
    assert.equal(r.hits[0].kind, 'chain');
  });

  test('kneel family', () => {
    const r = M.emotionVentCliche('She dropped to her knees and begged.');
    assert.equal(r.hits[0].families[0], 'kneel');
    assert.equal(r.score, 100);
  });

  test('rescued by own decision', () => {
    const r = M.emotionVentCliche([
      'Tears streamed down her face.',
      'She wiped her tears and picked up the phone.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('dialogue skipped', () => {
    const r = M.emotionVentCliche('LILY: I am begging you on my knees, please!');
    assert.equal(r.hits.length, 0);
  });

  test('objective action exempt', () => {
    const r = M.emotionVentCliche('She set the keys in the dish by the door.');
    assert.equal(r.hits.length, 0);
  });
});
