// v2.80 情绪道具拐杖检测（Emotion-Prop Crutch）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/emotion-prop-crutch.js');

describe('v2.80 emotion-prop-crutch 空输入', () => {
  test('空草稿满分', () => {
    const r = M.emotionPropCrutch('');
    assert.equal(r.score, 100);
    assert.equal(r.hits.length, 0);
    assert.deepEqual(r.familyCounts, { smash: 0, drink: 0, rain: 0, tear: 0, grip: 0 });
  });
});

describe('v2.80 emotion-prop-crutch 复用阈值', () => {
  test('单次摔杯是正当外化：不扣分', () => {
    const r = M.emotionPropCrutch('她摔碎了杯子。');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].charged, false);
    assert.equal(r.score, 100);
  });

  test('同族第3次起 charged：75', () => {
    const r = M.emotionPropCrutch([
      '她摔碎了杯子。',
      '内景·书房·夜',
      '他把花瓶砸在地上。',
      '内景·餐厅·日',
      '她掼碎了酒瓶。',
    ].join('\n'));
    assert.equal(r.familyCounts.smash, 3);
    assert.equal(r.score, 75);
    assert.equal(r.hits.filter((h) => h.charged).length, 1);
  });

  test('同族第4次：两个 charged → 50', () => {
    const r = M.emotionPropCrutch([
      '她摔碎了杯子。',
      '他把花瓶砸在地上。',
      '她掼碎了酒瓶。',
      '他一巴掌扫落桌上的碗碟。',
    ].join('\n'));
    // 碗碟：扫落...碗
    assert.equal(r.familyCounts.smash, 4);
    assert.equal(r.score, 50);
  });

  test('跨族不合并计数', () => {
    const r = M.emotionPropCrutch([
      '她摔碎了杯子。',
      '他仰头灌下一整杯威士忌。',
    ].join('\n'));
    assert.equal(r.score, 100);
    assert.equal(r.hits.every((h) => !h.charged), true);
  });
});

describe('v2.80 emotion-prop-crutch 多族堆叠', () => {
  test('同句摔杯+灌酒：chain 单次即扣分', () => {
    const r = M.emotionPropCrutch('她摔碎杯子，仰头灌下整杯威士忌。');
    assert.equal(r.hits[0].kind, 'chain');
    assert.equal(r.hits[0].charged, true);
    assert.equal(r.score, 75);
  });

  test('撕照片+淋雨：chain', () => {
    const r = M.emotionPropCrutch('她撕碎照片冲进暴雨里。');
    assert.equal(r.hits[0].families.length, 2);
    assert.equal(r.score, 75);
  });
});

describe('v2.80 emotion-prop-crutch 后果豁免', () => {
  test('摔杯同句甩出证据：rescued', () => {
    const r = M.emotionPropCrutch('她摔碎杯子，当场甩出录音拍在桌上。');
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('次行宣布取消婚礼：rescued', () => {
    const r = M.emotionPropCrutch([
      '她掼碎了酒瓶。',
      '他转身宣布取消婚礼，冻结她所有的卡。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('换场后才宣布不算', () => {
    const r = M.emotionPropCrutch([
      '她摔碎了杯子。',
      '内景·走廊·夜',
      '他转身宣布取消婚礼。',
    ].join('\n'));
    // 单次本来也不 charged；验证 rescueLine 不存在
    assert.equal(r.hits[0].rescued, false);
  });

  test('摘戒指扔还推动决裂：rescued', () => {
    const r = M.emotionPropCrutch('她摘下戒指扔还给他，转身签字，头也不回。');
    assert.equal(r.hits[0].rescued, true);
  });
});

describe('v2.80 emotion-prop-crutch 边界', () => {
  test('台词行跳过', () => {
    const r = M.emotionPropCrutch('林晚：我告诉你，我已经摔碎了你送的所有杯子！');
    assert.equal(r.hits.length, 0);
  });

  test('客观下雨不判', () => {
    const r = M.emotionPropCrutch('窗外下起了大雨，路灯在水洼里晃。');
    assert.equal(r.hits.length, 0);
  });

  test('普通动作零命中', () => {
    const r = M.emotionPropCrutch('她把合同推过桌面，指尖压住落款行。');
    assert.equal(r.hits.length, 0);
  });

  test('捏杯子与掐掌同族累计', () => {
    const r = M.emotionPropCrutch([
      '指甲深深掐进掌心。',
      '内景·客厅·夜',
      '指节攥得发白。',
      '内景·走廊·日',
      '她攥皱了那张纸。',
    ].join('\n'));
    assert.equal(r.familyCounts.grip, 3);
    assert.equal(r.score, 75);
  });
});

describe('v2.80 emotion-prop-crutch English', () => {
  test('single smash exempt', () => {
    const r = M.emotionPropCrutch('She smashed the glass against the wall.');
    assert.equal(r.hits[0].charged, false);
    assert.equal(r.score, 100);
  });

  test('third smash charged', () => {
    const r = M.emotionPropCrutch([
      'She smashed the glass.',
      'He hurled the vase to the floor.',
      'She shattered the bottle against the door.',
    ].join('\n'));
    assert.equal(r.familyCounts.smash, 3);
    assert.equal(r.score, 75);
  });

  test('chain smash + drinking charged immediately', () => {
    const r = M.emotionPropCrutch('She smashed the glass and downed another whiskey.');
    assert.equal(r.hits[0].kind, 'chain');
    assert.equal(r.score, 75);
  });

  test('drinking repeat: one drink after another x3', () => {
    const r = M.emotionPropCrutch([
      'It was one drink after another.',
      'He poured himself another whiskey.',
      'She drank herself into oblivion that night.',
    ].join('\n'));
    assert.equal(r.familyCounts.drink, 3);
    assert.equal(r.score, 75);
  });

  test('rescued by same-line evidence', () => {
    const r = M.emotionPropCrutch('She smashed the cup, then slapped the recording down on the table.');
    assert.equal(r.hits[0].rescued, true);
  });

  test('rescued next line by lawyer', () => {
    const r = M.emotionPropCrutch([
      'He tore up the photo.',
      'She phoned her lawyer and cancelled the wedding.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('objective rain exempt', () => {
    const r = M.emotionPropCrutch('Rain tapped against the window of the empty office.');
    assert.equal(r.hits.length, 0);
  });

  test('dialogue line skipped', () => {
    const r = M.emotionPropCrutch('LILY: I smashed every vase he ever gave me!');
    assert.equal(r.hits.length, 0);
  });
});
