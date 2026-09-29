// v2.80 群体反应偷懒检测（Crowd Reaction）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/crowd-reaction.js');

const HEADER = '内景·宴会厅·夜';

describe('v2.80 crowd-reaction 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.crowdReaction('').score, 100);
    assert.equal(M.crowdReaction('   ').hits.length, 0);
  });
});

describe('v2.80 crowd-reaction 命中', () => {
  test('众人哗然', () => {
    const r = M.crowdReaction([HEADER, '众人哗然。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
    assert.ok(r.score < 100);
  });

  test('全场愣住', () => {
    const r = M.crowdReaction([HEADER, '话音落下，全场都愣住了。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].crowd, '全场');
  });

  test('所有人倒吸凉气', () => {
    const r = M.crowdReaction([HEADER, '所有人倒吸一口凉气。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].reaction, '倒吸一口凉气');
  });

  test('大家纷纷点头', () => {
    const r = M.crowdReaction([HEADER, '台下大家纷纷点头附和。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('群体成语无需主语：议论纷纷/鸦雀无声/面面相觑', () => {
    const r = M.crowdReaction([
      HEADER,
      '席间议论纷纷。',
      '门外鸦雀无声。',
      '几个亲戚面面相觑。',
    ].join('\n'));
    assert.equal(r.hits.length, 3);
  });

  test('员工们不敢出声', () => {
    const r = M.crowdReaction([HEADER, '员工们低着头，不敢出声。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('多命中累计扣分且有下限', () => {
    const r = M.crowdReaction([
      HEADER,
      '众人哗然。',
      '全场震惊。',
      '所有人都惊呆了。',
      '宾客们纷纷后退。',
      '台下掌声雷动。',
      '人群哄堂大笑。',
      '记者们面面相觑。',
    ].join('\n'));
    assert.equal(r.hits.length, 7);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 crowd-reaction rescue 豁免', () => {
  test('群体后紧跟具体个体特写，rescued 不扣分', () => {
    const r = M.crowdReaction([
      HEADER,
      '众人哗然。',
      '角落里，老管家攥紧了拐杖。',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.hits[0].rescueLine, 3);
    assert.equal(r.score, 100);
  });

  test('隔一行给特写仍算 rescue', () => {
    const r = M.crowdReaction([
      HEADER,
      '全场鸦雀无声。',
      '',
      '门边站着的王秘书，手抖着碰翻了水杯。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('换场后特写不救上一场', () => {
    const r = M.crowdReaction([
      '内景·宴会厅·夜',
      '众人哗然。',
      '外景·走廊·夜',
      '老管家攥紧了拐杖。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });
});

describe('v2.80 crowd-reaction 豁免与边界', () => {
  test('台词中引用群体反应不判', () => {
    const r = M.crowdReaction([
      HEADER,
      '林棠：等会儿，所有人都会震惊的。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('群体主语但无群体反应不判', () => {
    const r = M.crowdReaction([HEADER, '他要让所有人付出代价。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('纯具体个体写法不判', () => {
    const r = M.crowdReaction([
      HEADER,
      '王秘书后退半步，撞翻了水杯。',
      '林母捏皱了请帖，指节发白。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('群体与反应距离过远不判', () => {
    const r = M.crowdReaction([
      HEADER,
      '所有人都看着台上那个穿黑裙的女人一步步走上台阶，大厅里只有风声。',
    ].join('\n'));
    // 群体主语后没有群体反应动词，只是在叙述众人的具体动作（看着）
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 crowd-reaction English', () => {
  test('whole room froze 命中', () => {
    const r = M.crowdReaction(['INT. BALLROOM - NIGHT', 'The whole room froze.'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
  });

  test('everyone gasped / crowd erupted', () => {
    const r = M.crowdReaction([
      'INT. BALLROOM - NIGHT',
      'Everyone gasped at the verdict.',
      'The crowd erupted in applause.',
    ].join('\n'));
    assert.equal(r.hits.length, 2);
  });

  test('collective gasp idiom 命中', () => {
    const r = M.crowdReaction(['INT. HALL - NIGHT', 'A collective gasp swept the room.'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('en rescue：个体特写豁免', () => {
    const r = M.crowdReaction([
      'INT. BALLROOM - NIGHT',
      'The crowd went silent.',
      'In the back, the old butler tightened his grip on the cane.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('en 台词豁免', () => {
    const r = M.crowdReaction([
      'INT. BALLROOM - NIGHT',
      'LIN: Everyone is going to be shocked when I walk in.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
