// v2.80 简历式自我介绍检测（Self-Intro Dump）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/self-intro-dump.js');

describe('v2.80 self-intro-dump 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.selfIntroDump('').score, 100);
    assert.equal(M.selfIntroDump('  ').hits.length, 0);
  });
});

describe('v2.80 self-intro-dump 中文命中', () => {
  test('经典旁白简历包（中文数字年龄）', () => {
    const r = M.selfIntroDump('我叫林晚，今年二十五岁，是顾氏集团的总裁助理。');
    assert.equal(r.hits.length, 1);
    assert.deepEqual(r.hits[0].elements.sort(), ['age', 'identity', 'name']);
    assert.equal(r.score, 75);
  });

  test('名片式开场：姓名，N岁，头衔', () => {
    const r = M.selfIntroDump('林晚，25岁，顾氏集团总裁助理。');
    assert.equal(r.hits.length, 1);
  });

  test('身份前置式：我是XX总裁，今年三十岁', () => {
    const r = M.selfIntroDump('我是顾氏集团总裁顾晏辰，今年三十岁。');
    assert.equal(r.hits.length, 1);
  });

  test('镜中自我介绍旁白金句', () => {
    const r = M.selfIntroDump('镜子里的女人叫沈知意，今年28岁，沈家千金。');
    assert.equal(r.hits.length, 1);
  });

  test('跨行打包：我叫林晚。/今年25岁，是总裁特助。', () => {
    const r = M.selfIntroDump('我叫林晚。\n今年25岁，是总裁特助。');
    assert.equal(r.hits.length, 1);
    assert.equal(r.hits[0].line, 1);
  });

  test('三次命中压到 25', () => {
    const r = M.selfIntroDump([
      '我叫林晚，今年25岁，是总裁助理。',
      '内景·办公室·日',
      '我是顾晏辰，今年30岁，是集团总裁。',
      '内景·酒会·夜',
      '这位是苏晴，今年24岁，是顾家的私人医生。',
    ].join('\n'));
    assert.equal(r.hits.length, 3);
    assert.equal(r.score, 25);
  });
});

describe('v2.80 self-intro-dump 中文豁免', () => {
  test('只有姓名+来意，没有年龄：不算', () => {
    const r = M.selfIntroDump('我叫林晚，是来面试的。');
    assert.equal(r.hits.length, 0);
  });

  test('只有身份没有姓名信号：不算', () => {
    const r = M.selfIntroDump('今年30岁的顾晏辰是顾氏集团总裁。');
    assert.equal(r.hits.length, 0);
  });

  test('执法登记问答：分字段作答前有提问，豁免', () => {
    const r = M.selfIntroDump([
      '警察：姓名、年龄、职业？',
      '林晚：我叫林晚，今年25岁，是顾氏集团总裁助理。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('问诊问答豁免', () => {
    const r = M.selfIntroDump([
      '医生：怎么称呼，今年多大，做什么工作？',
      '病人：我叫林晚，今年25岁，是设计师。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('正常用动作立身份：零命中', () => {
    const r = M.selfIntroDump([
      '前台头也不抬：顾总在18楼，预约了吗？',
      '林晚把工牌拍在桌上，踩着高跟鞋冲进电梯。',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 self-intro-dump English', () => {
  test('My name is + age + CEO assistant', () => {
    const r = M.selfIntroDump("My name is Lin Wan. I'm 25 years old and the CEO's assistant.");
    assert.equal(r.hits.length, 1);
    assert.equal(r.score, 75);
  });

  test('Card-style opening: Name, N, title', () => {
    const r = M.selfIntroDump('Lin Wan, 25, the new secretary, had ten minutes to save her job.');
    assert.equal(r.hits.length, 1);
  });

  test('Official Q&A exempt', () => {
    const r = M.selfIntroDump([
      'Officer: Name, age, occupation?',
      'Witness: My name is Lin Wan, I am 25, a designer.',
    ].join('\n'));
    assert.equal(r.hits.length, 0);
  });

  test('Greeting without age exempt', () => {
    const r = M.selfIntroDump("Hi, I'm Susan, the new intern from accounting.");
    assert.equal(r.hits.length, 0);
  });

  test('Identity without name signal exempt', () => {
    const r = M.selfIntroDump('At 30, Daniel was the youngest CEO in the city.');
    assert.equal(r.hits.length, 0);
  });
});
