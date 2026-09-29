// v2.80 环境共情/天气替演检测（Pathetic Fallacy）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/pathetic-fallacy.js');

const HEADER = '外景·江边·夜';

describe('v2.80 pathetic-fallacy 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.patheticFallacy('').score, 100);
    assert.equal(M.patheticFallacy('  ').hits.length, 0);
  });
});

describe('v2.80 pathetic-fallacy 命中', () => {
  test('A 拟人框架：暴雨仿佛在为她哭泣', () => {
    const r = M.patheticFallacy([HEADER, '暴雨仿佛在为她哭泣。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'frame');
    assert.ok(r.score < 100);
  });

  test('A 雨水像是在嘲笑他', () => {
    const r = M.patheticFallacy([HEADER, '雨水顺着玻璃爬下来，像是在嘲笑他。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'frame');
  });

  test('B 直接拟人：风在窗外呜咽', () => {
    const r = M.patheticFallacy([HEADER, '风在窗外呜咽。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'direct');
    assert.equal(r.hits[0].subject, '风');
  });

  test('B 雷声怒吼', () => {
    const r = M.patheticFallacy([HEADER, '雷声在远处怒吼。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('B 月光同情地洒下', () => {
    const r = M.patheticFallacy([HEADER, '月光同情地洒在她身上。'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('C 天意代言：连老天都看不下去', () => {
    const r = M.patheticFallacy([HEADER, '连老天都看不下去了。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'heaven');
  });

  test('多命中累计扣分且有下限', () => {
    const r = M.patheticFallacy([
      HEADER,
      '暴雨仿佛在为她哭泣。',
      '风在窗外呜咽。',
      '连老天都看不下去了。',
      '月光怜悯地照着她。',
      '雷声怒吼。',
      '乌云在嘲笑她。',
      '江水也在叹息。',
    ].join('\n'));
    assert.equal(r.hits.length, 7);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 pathetic-fallacy 豁免', () => {
  test('客观天气白描不判', () => {
    const r = M.patheticFallacy([
      HEADER,
      '雨越下越大，雷声滚滚，月光照在地板上，积水漫过了台阶。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('角色感知框架豁免：她觉得雨声像在哭', () => {
    const r = M.patheticFallacy([HEADER, '她觉得这雨声像是谁在哭。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('人物名主语的感知句豁免', () => {
    const r = M.patheticFallacy([HEADER, '林棠听着风穿过楼道，像是有人在叹气。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('台词豁免', () => {
    const r = M.patheticFallacy([
      HEADER,
      '林棠：你看，连老天都看不下去你了。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('场景头豁免', () => {
    const r = M.patheticFallacy('外景·暴雨夜·公路\n车在雨里抛锚了。');
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 pathetic-fallacy English', () => {
  test('seemed to weep 命中', () => {
    const r = M.patheticFallacy(['EXT. RIVERBANK - NIGHT', 'The rain seemed to weep for her.'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'frame');
  });

  test('the wind mocked her 直接拟人命中', () => {
    const r = M.patheticFallacy(['EXT. RIVERBANK - NIGHT', 'The wind mocked her through the cracked window.'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'direct');
  });

  test('even heaven mourned 天意代言', () => {
    const r = M.patheticFallacy(['EXT. GRAVEYARD - NIGHT', 'Even heaven mourned her passing.'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'heaven');
  });

  test('客观白描豁免：rain hammered / wind shook', () => {
    const r = M.patheticFallacy([
      'EXT. CABIN - NIGHT',
      'Rain hammered the windows. The wind shook the door.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('明喻但无情绪词不判：fell like bullets', () => {
    const r = M.patheticFallacy(['EXT. STREET - NIGHT', 'Rain fell like bullets on the awning.'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('角色感知豁免：she felt as if', () => {
    const r = M.patheticFallacy([
      'EXT. RIVERBANK - NIGHT',
      'She felt as if the rain were crying with her.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('en 台词豁免', () => {
    const r = M.patheticFallacy([
      'EXT. RIVERBANK - NIGHT',
      'LIN: Even heaven is on my side today.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
