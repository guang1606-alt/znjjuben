// v2.80 全知预告/伪悬念检测（Omniscient Tease）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/omniscient-tease.js');

const HEADER = '内景·别墅客厅·夜';

describe('v2.80 omniscient-tease 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.omniscientTease('').score, 100);
    assert.equal(M.omniscientTease('   ').hits.length, 0);
  });
});

describe('v2.80 omniscient-tease 命中', () => {
  test('她不知道的是 + 风暴预告', () => {
    const r = M.omniscientTease([HEADER, '她不知道的是，一场更大的风暴正在等着她。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.ok(r.score < 100);
  });

  test('此刻的她还不知道：强全知框架', () => {
    const r = M.omniscientTease([HEADER, '此刻的她还不知道，自己已经走进了圈套。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'omniscient');
  });

  test('弱认知句 + 悬念空词：丝毫不知道陷阱', () => {
    const r = M.omniscientTease([HEADER, '他丝毫不知道陷阱已经在身后布好。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'omniscient');
  });

  test('章末定调：命运的齿轮', () => {
    const r = M.omniscientTease([HEADER, '命运的齿轮开始转动。'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'tail');
  });

  test('章末定调：这只是开始 / 真正的考验', () => {
    const r = M.omniscientTease([
      HEADER,
      '这只是开始。',
      '他万万没想到，真正的考验才刚刚开始。',
    ].join('\n'));
    assert.equal(r.hits.length, 2);
    assert.ok(r.hits.every((h) => h.kind === 'tail'));
  });

  test('多命中扣分且有下限', () => {
    const r = M.omniscientTease([
      HEADER,
      '她不知道的是，命运已经对她亮出了刀。',
      '此刻的她还不知道，自己已经走进了圈套。',
      '他丝毫不知道更大的危机就在眼前。',
      '命运的齿轮缓缓转动。',
      '这只是开始。',
      '等待她的将是万劫不复。',
      '真正的风暴即将来临。',
    ].join('\n'));
    assert.equal(r.hits.length, 7);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 omniscient-tease 豁免', () => {
  test('不知道 + 具体事实宾语不判', () => {
    const r = M.omniscientTease([
      HEADER,
      '她不知道保险柜密码。',
      '他不知道母亲已经到了楼下。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('没想到 + 已发生具体事实不判（正常事后惊讶）', () => {
    const r = M.omniscientTease([HEADER, '她万万没想到他真的签了字。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('"这只是开始"后接具体动作是字面用法，不判', () => {
    const r = M.omniscientTease([HEADER, '这只是开始收拾行李，离出发还早。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('台词豁免', () => {
    const r = M.omniscientTease([
      HEADER,
      '林棠：你不知道的是，我早就准备好了。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('正常外化叙述不判', () => {
    const r = M.omniscientTease([
      HEADER,
      '她把合同翻到最后一页，在落款处停住了笔。',
      '门缝下压进来一个没署名的信封。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 omniscient-tease English', () => {
  test('Little did she know 命中', () => {
    const r = M.omniscientTease([
      'INT. MANOR - NIGHT',
      'Little did she know, the letter would change everything.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'omniscient');
  });

  test('Unbeknownst to him 命中', () => {
    const r = M.omniscientTease([
      'INT. OFFICE - NIGHT',
      'Unbeknownst to him, the deal was already signed.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('had no idea + 悬念窗口命中', () => {
    const r = M.omniscientTease([
      'INT. OFFICE - NIGHT',
      'She had no idea what awaited her in the office.',
    ].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('tail: this was only the beginning / wheels of fate', () => {
    const r = M.omniscientTease([
      'INT. COURT - NIGHT',
      'This was only the beginning.',
      'The wheels of fate had begun to turn.',
    ].join('\n'));
    assert.equal(r.hits.length, 2);
    assert.ok(r.hits.every((h) => h.kind === 'tail'));
  });

  test('客观事实句豁免', () => {
    const r = M.omniscientTease([
      'INT. OFFICE - NIGHT',
      'She did not know the address.',
      'She had no idea where the keys were.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('en 台词豁免', () => {
    const r = M.omniscientTease([
      'INT. OFFICE - NIGHT',
      'LIN: Little did you know, I recorded every word.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
