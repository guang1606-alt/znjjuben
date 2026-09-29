// v2.80 动作回声台词检测（Action-Echo Dialogue）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/action-echo-dialogue.js');

describe('v2.80 action-echo 空输入', () => {
  test('空草稿满分', () => {
    const r = M.actionEchoDialogue('');
    assert.equal(r.score, 100);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 action-echo 中文 question 型', () => {
  test('巴掌+你打我：首次不罚', () => {
    const r = M.actionEchoDialogue(['他一巴掌甩在她脸上。', '林晚：你打我？'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].kind, 'question');
    assert.equal(r.hits[0].charged, false);
    assert.equal(r.score, 100);
  });

  test('第二次回声 charged：80', () => {
    const r = M.actionEchoDialogue([
      '他一巴掌甩在她脸上。',
      '林晚：你打我？',
      '内景·书房·夜',
      '他把离婚协议撕成两半。',
      '林晚：你把合同撕了？',
    ].join('\n'));
    assert.equal(r.hits.length, 2);
    assert.equal(r.hits[1].charged, true);
    assert.equal(r.score, 80);
  });

  test('第三次：56', () => {
    const r = M.actionEchoDialogue([
      '他一巴掌甩在她脸上。',
      '林晚：你打我？',
      '他把戒指摘下扔在地上。',
      '林晚：你把戒指扔了？',
      '内景·客厅·夜',
      '他把照片扔进火里。',
      '林晚：你烧照片？',
    ].join('\n'));
    assert.equal(r.hits.length, 3);
    assert.equal(r.score, 56);
  });

  test('强动词语境：撕合同无需 cue', () => {
    const r = M.actionEchoDialogue(['他撕了合同。', '林晚：你撕了？'].join('\n'));
    assert.equal(r.hits.length, 1);
  });
});

describe('v2.80 action-echo 宽动词误判保护', () => {
  test('打电话不算动作回声', () => {
    const r = M.actionEchoDialogue(['他拿起手机打电话。', '林晚：你要打电话？'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('普通问句零命中', () => {
    const r = M.actionEchoDialogue(['他坐在沙发上喝水。', '林晚：你吃饭了吗？'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('与上一拍无动作关联零命中', () => {
    const r = M.actionEchoDialogue(['窗外下雨了。', '林晚：你还爱我吗？'].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 action-echo confirm 型与道具映射', () => {
  test('你真把合同撕了：confirm', () => {
    const r = M.actionEchoDialogue(['他把合同撕成两半。', '林晚：你真把合同撕了。'].join('\n'));
    assert.equal(r.hits[0].kind, 'confirm');
  });

  test('辞职信推来+你要辞职：prop', () => {
    const r = M.actionEchoDialogue(['主管把辞职信推回她面前。', '主管：你要辞职？'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('离婚协议+你要跟我离婚', () => {
    const r = M.actionEchoDialogue(['他把离婚协议书推到她面前。', '林晚：你要跟我离婚？'].join('\n'));
    assert.equal(r.hits.length, 1);
  });
});

describe('v2.80 action-echo rescue', () => {
  test('回声+要价：rescued', () => {
    const r = M.actionEchoDialogue([
      '他一巴掌甩在她脸上。',
      '林晚：你打我？律师函明天就到。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
    assert.equal(r.score, 100);
  });

  test('回声+下一行立即决定：rescued', () => {
    const r = M.actionEchoDialogue([
      '他把合同撕了。',
      '林晚：你撕了？',
      '她当场签下自己的名字。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('换场后行动不算 rescue', () => {
    const r = M.actionEchoDialogue([
      '他一巴掌甩在她脸上。',
      '林晚：你打我？',
      '内景·走廊·日',
      '她拿起电话报警。',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, false);
  });

  test('长台词放行（在控诉而非确认）', () => {
    const r = M.actionEchoDialogue([
      '他一巴掌甩在她脸上。',
      '林晚：你打我？我嫁到你们家三年，每天端茶倒水伺候你妈，你就是这么对我的？',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 action-echo 结构边界', () => {
  test('换场清空：无叙述行不判', () => {
    const r = M.actionEchoDialogue(['内景·客厅·夜', '林晚：你撕了？'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('宽话者叙述句不吞（她终于懂得型）', () => {
    const r = M.actionEchoDialogue(['她终于懂得：他早就想推开她了。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('mirror 域不重叠：陈述眼前物零命中', () => {
    const r = M.actionEchoDialogue(['桌上摊着一份离婚协议书。', '林晚：这是离婚协议书。'].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 action-echo English', () => {
  test('slap + you hit me: first exempt', () => {
    const r = M.actionEchoDialogue(['He slapped her across the face.', 'LILY: You hit me?'].join('\n'));
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].charged, false);
  });

  test('second echo charged', () => {
    const r = M.actionEchoDialogue([
      'He slapped her across the face.',
      'LILY: You hit me?',
      'INT. STUDY - NIGHT',
      'He tore the contract in two.',
      'LILY: You ripped up the contract?',
    ].join('\n'));
    assert.equal(r.hits[1].charged, true);
    assert.equal(r.score, 80);
  });

  test('weak verb without cue: no hit', () => {
    const r = M.actionEchoDialogue(['He called his mother.', 'LILY: You called her?'].join('\n'));
    // called 不在动词集，零命中
    assert.equal(r.hits.length, 0);
  });

  test('divorce papers echo', () => {
    const r = M.actionEchoDialogue(['He slid the divorce papers across the table.', 'LILY: You are divorcing me?'].join('\n'));
    assert.equal(r.hits.length, 1);
  });

  test('rescued by demand', () => {
    const r = M.actionEchoDialogue([
      'He slapped her across the face.',
      'LILY: You hit me? My lawyer will call tomorrow.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('rescued next line', () => {
    const r = M.actionEchoDialogue([
      'He tore the contract in two.',
      'LILY: You ripped it?',
      'She picked up the phone and called her lawyer.',
    ].join('\n'));
    assert.equal(r.hits[0].rescued, true);
  });

  test('scene reset', () => {
    const r = M.actionEchoDialogue(['INT. STUDY - NIGHT', 'LILY: You tore it?'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('ordinary question no hit', () => {
    const r = M.actionEchoDialogue(['He sat on the couch.', 'LILY: Do you still love me?'].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('long line passes', () => {
    const r = M.actionEchoDialogue([
      'He slapped her across the face.',
      'LILY: You hit me? After three years of serving your family every single day, this is what I get?',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });
});
