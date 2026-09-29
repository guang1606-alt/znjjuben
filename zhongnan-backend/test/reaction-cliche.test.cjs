// v2.80 面部反应公式检测（Reaction Cliche）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/reaction-cliche.js');

const HEADER = '内景·办公室·夜';

describe('v2.80 reaction-cliche 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.reactionCliche('').score, 100);
    assert.equal(M.reactionCliche('   ').hits.length, 0);
  });
});

describe('v2.80 reaction-cliche 连缀命中', () => {
  test('愣+皱眉+咬唇三连', () => {
    const r = M.reactionCliche([HEADER, '她愣了愣，皱了皱眉，下意识咬了咬唇。'].join('\n'));
    assert.ok(r.hits.some((h) => h.kind === 'chain'));
    assert.ok(r.score < 100);
  });

  test('瞳孔一缩+嘴角抽搐+脸色一沉', () => {
    const r = M.reactionCliche([HEADER, '他瞳孔一缩，嘴角抽搐，脸色瞬间沉了下来。'].join('\n'));
    assert.ok(r.hits.some((h) => h.kind === 'chain'));
  });

  test('挑眉+似笑非笑+心头一紧', () => {
    const r = M.reactionCliche([HEADER, '男人挑了挑眉，勾起一抹冷笑，她心头一紧。'].join('\n'));
    assert.ok(r.hits.some((h) => h.kind === 'chain'));
  });

  test('多连缀扣分压到下限', () => {
    const r = M.reactionCliche([
      HEADER,
      '她愣了愣，皱了皱眉，咬了咬唇。',
      '他瞳孔一缩，嘴角抽搐，脸色一沉。',
      '女人挑眉，眸光一闪，呼吸一滞。',
      '老管家眼眶一红，叹了口气，眼神一暗。',
      '秘书心头一紧，倒吸一口凉气，愣住了。',
      '他皱眉，脸色发黑，咬着唇不说话。',
      '她嘴角一抽，挑眉，似笑非笑。',
    ].join('\n'));
    assert.equal(r.score, 25);
  });
});

describe('v2.80 reaction-cliche 复用命中', () => {
  test('同一反应词全片3次：瞳孔一缩', () => {
    const r = M.reactionCliche([
      HEADER,
      '听到离婚两个字，她瞳孔一缩。',
      '内景·走廊·夜',
      '看见监控画面，他瞳孔一缩。',
      '内景·车库·日',
      '亲子鉴定摊在桌上，林棠瞳孔一缩。',
    ].join('\n'));
    assert.ok(r.overusedTokens.includes('瞳孔一缩'));
    assert.ok(r.hits.some((h) => h.kind === 'repeat'));
  });
});

describe('v2.80 reaction-cliche 豁免', () => {
  test('单个生理反应不判（正当外化）', () => {
    const r = M.reactionCliche([
      HEADER,
      '看到落款的瞬间，她瞳孔一缩，反手把合同扣进了抽屉。',
      '他没说话，只把钢笔在指间转了半圈。',
      '她喉头滚了一下，伸手按下了录音键。',
    ].join('\n'));
    assert.equal(r.hits.filter((h) => h.kind === 'chain').length, 0);
  });

  test('单次出现不判复用', () => {
    const r = M.reactionCliche([
      HEADER,
      '她愣了一下，把钥匙塞进了他掌心。',
      '对面的男人笑了，替她拉开门。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('台词豁免', () => {
    const r = M.reactionCliche([
      HEADER,
      '林棠：你刚才瞳孔一缩，又皱眉又咬唇，撒谎都不会。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('正常动作戏不判', () => {
    const r = M.reactionCliche([
      HEADER,
      '她抄起桌上的花瓶砸在地上，碎片溅到他的裤脚。',
      '他后退半步，把那张支票撕成两半甩在她脸上。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 reaction-cliche English', () => {
  test('froze + frowned + bit lip chain', () => {
    const r = M.reactionCliche([
      'INT. OFFICE - NIGHT',
      'She froze, frowned, and bit her lip.',
    ].join('\n'));
    assert.ok(r.hits.some((h) => h.kind === 'chain'));
  });

  test('eyes widened + jaw clenched + swallowed hard', () => {
    const r = M.reactionCliche([
      'INT. OFFICE - NIGHT',
      'His eyes widened, his jaw clenched, and he swallowed hard.',
    ].join('\n'));
    assert.ok(r.hits.some((h) => h.kind === 'chain'));
  });

  test('repeat: froze 3x', () => {
    const r = M.reactionCliche([
      'INT. OFFICE - NIGHT',
      'She froze at the word divorce.',
      'INT. HALLWAY - NIGHT',
      'He froze at the footage.',
      'INT. GARAGE - DAY',
      'Lin froze at the test result on the table.',
    ].join('\n'));
    assert.ok(r.overusedTokens.includes('froze'));
  });

  test('single reaction exempt', () => {
    const r = M.reactionCliche([
      'INT. OFFICE - NIGHT',
      'She froze for half a second, then slammed the contract face down.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('en dialogue exempt', () => {
    const r = M.reactionCliche([
      'INT. OFFICE - NIGHT',
      'LIN: You froze, frowned, bit your lip — you cannot even lie.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
