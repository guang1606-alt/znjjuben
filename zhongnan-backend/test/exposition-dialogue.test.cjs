// v2.80 保姆式对白检测（Exposition Dialogue）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/exposition-dialogue.js');

describe('v2.80 exposition-dialogue 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.expositionDialogue('').score, 100);
  });
});

describe('v2.80 exposition-dialogue 共知旧事', () => {
  test('你还记得吗+成段事实判 shared_memory', () => {
    const draft = '内景·客厅·夜\n林母：你还记得吗，十年前那个雨夜，是我出钱把你妈从医院抢救回来的。';
    const r = M.expositionDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'shared_memory'));
  });

  test('短唤起无 payload 不判', () => {
    const draft = '内景·客厅·夜\n林棠：你还记得吗？\n沈知远：记得。';
    const r = M.expositionDialogue(draft);
    assert.equal(r.hits.filter((h) => h.type === 'shared_memory').length, 0);
  });

  test('短提醒（十年之约）不判，长要挟才判', () => {
    const short = M.expositionDialogue('内景·书房·夜\n林棠：你别忘了十年之约。');
    assert.equal(short.hits.length, 0);
    const long = M.expositionDialogue('内景·书房·夜\n林棠：当年要不是我卖了老宅给你凑三百万启动资金，你哪有今天的公司。');
    assert.ok(long.hits.some((h) => h.type === 'shared_memory'));
  });
});

describe('v2.80 exposition-dialogue 规矩宣讲', () => {
  test('根据规定+长解释判 rule_dump', () => {
    const draft = '内景·办公室·日\n总监：根据公司规定，连续三个月业绩垫底的员工会被无条件开除，而且没有任何赔偿。';
    const r = M.expositionDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'rule_dump'));
  });

  test('按规矩办三字不判', () => {
    const draft = '内景·办公室·日\n总监：按规矩办。';
    const r = M.expositionDialogue(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 exposition-dialogue 正常对白', () => {
  test('冲突中的事实交锋不判', () => {
    const draft = [
      '内景·客厅·夜',
      '林棠：字签了，房子归我。',
      '沈知远：你做梦，首付是我妈出的。',
      '林棠：那你去法院说，看收据上写的谁的名字。',
    ].join('\n');
    const r = M.expositionDialogue(draft);
    assert.equal(r.score, 100);
    assert.equal(r.dialogueLines, 3);
  });

  test('叙述行不统计', () => {
    const draft = '内景·客厅·夜\n十年前的往事在她脑子里翻涌。';
    const r = M.expositionDialogue(draft);
    assert.equal(r.dialogueLines, 0);
  });
});

describe('v2.80 exposition-dialogue 密度与扣分', () => {
  test('dumpRate 与分数随命中下降', () => {
    const draft = [
      '内景·客厅·夜',
      '甲：你还记得吗，十年前那个雨夜，是我爸出钱把你妈从医院抢救回来的。',
      '乙：够了。',
      '甲：你再想想，当年要不是我卖了老宅替你还债，你早就被人打断腿了。',
    ].join('\n');
    const r = M.expositionDialogue(draft);
    assert.ok(r.hits.length >= 2);
    assert.ok(r.dumpRate > 0.3);
    assert.ok(r.score < 80);
  });
});

describe('v2.80 exposition-dialogue en', () => {
  test('do you remember + payload', () => {
    const draft = "INT. ROOM - NIGHT\nMary: Do you remember that rainy night ten years ago when my father paid for your mother's surgery?";
    const r = M.expositionDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'shared_memory'));
  });
  test('policy lecture', () => {
    const draft = 'INT. OFFICE - DAY\nBoss: According to company policy, employees who miss targets three months in a row are terminated without any severance.';
    const r = M.expositionDialogue(draft);
    assert.ok(r.hits.some((h) => h.type === 'rule_dump'));
  });
  test('short remember is clean', () => {
    const draft = 'INT. ROOM - NIGHT\nMary: Remember?\nJohn: Yeah.';
    const r = M.expositionDialogue(draft);
    assert.equal(r.hits.length, 0);
  });
});
