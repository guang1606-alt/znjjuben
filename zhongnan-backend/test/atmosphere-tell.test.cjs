// v2.80 气氛直述检测（Atmosphere Tell）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/atmosphere-tell.js');

const HEADER = '内景·包厢·夜';

describe('v2.80 atmosphere-tell 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.atmosphereTell('').score, 100);
    assert.equal(M.atmosphereTell('  ').hits.length, 0);
  });
});

describe('v2.80 atmosphere-tell 中文命中', () => {
  test('气氛+情绪结论', () => {
    const r = M.atmosphereTell([HEADER, '气氛顿时变得尴尬，谁都没有先开口。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
    assert.ok(r.score < 100);
  });

  test('空气凝固', () => {
    const r = M.atmosphereTell([HEADER, '空气仿佛凝固了，连呼吸声都听不见。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('场面微妙', () => {
    const r = M.atmosphereTell([HEADER, '场面一度十分微妙，两拨人隔着桌子对峙。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('时间静止', () => {
    const r = M.atmosphereTell([HEADER, '时间仿佛静止，她盯着那份亲子鉴定报告。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('情绪蔓延', () => {
    const r = M.atmosphereTell([HEADER, '一股暧昧的气息在两人之间弥漫开来。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('多命中压到下限', () => {
    const r = M.atmosphereTell([
      HEADER,
      '气氛顿时尴尬。',
      '空气仿佛凝固。',
      '场面一度十分微妙。',
      '时间仿佛静止。',
      '压抑在车厢里弥漫。',
      '满室凝重。',
      '气氛剑拔弩张。',
    ].join('\n'));
    assert.equal(r.hits.length, 7);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 atmosphere-tell 中文豁免', () => {
  test('同行 rescue：抽象句后紧跟具体人的动作', () => {
    const r = M.atmosphereTell([HEADER, '气氛一时尴尬，林棠先笑了，端起茶杯抿了一口。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('次行 rescue：下一行具体动作', () => {
    const r = M.atmosphereTell([
      HEADER,
      '空气凝固了几秒。',
      '顾晏辞放下筷子，抬眼看向她。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('台词 rescue：有人开口打破', () => {
    const r = M.atmosphereTell([
      HEADER,
      '场面顿时尴尬起来。',
      '林棠：都愣着干什么，坐下吃饭。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('台词中点破气氛不算', () => {
    const r = M.atmosphereTell([
      HEADER,
      '助理：这气氛怎么突然这么尴尬，我先出去？',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('换场后不 rescue', () => {
    const r = M.atmosphereTell([
      HEADER,
      '气氛压抑得让人喘不过气。',
      '外景·江边·夜',
      '林棠端起咖啡笑了笑。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });

  test('群体静默归 crowd-reaction，本引擎不重复扣', () => {
    const r = M.atmosphereTell([
      HEADER,
      '众人鸦雀无声。',
      '全场瞬间安静下来。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('纯具体动作叙述不误报', () => {
    const r = M.atmosphereTell([
      HEADER,
      '她把合同推过桌面，指尖压在签字栏上没有挪开。',
      '他盯着那支笔，过了三秒才接过去。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 atmosphere-tell English', () => {
  test('atmosphere grew awkward', () => {
    const r = M.atmosphereTell([
      'INT. PRIVATE ROOM - NIGHT',
      'The atmosphere grew awkward and nobody spoke first.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].rescued, false);
  });

  test('air grew thick', () => {
    const r = M.atmosphereTell([
      'INT. CAR - NIGHT',
      'The air between them grew thick with everything unsaid.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('time seemed to freeze', () => {
    const r = M.atmosphereTell([
      'INT. OFFICE - NIGHT',
      'Time seemed to freeze as she read the DNA report.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('awkward silence', () => {
    const r = M.atmosphereTell([
      'INT. LOBBY - NIGHT',
      'An awkward silence stretched between the two families.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('rescued by next-line action', () => {
    const r = M.atmosphereTell([
      'INT. DINING ROOM - NIGHT',
      'The air was heavy for a long second.',
      'Lin Tang laughed first and picked up her teacup.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('en dialogue exempt', () => {
    const r = M.atmosphereTell([
      'INT. OFFICE - NIGHT',
      'AIDE: Wow, the atmosphere in here is brutal — should I leave?',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
