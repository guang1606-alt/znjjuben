// v2.80 叙述者读心/认知结论直给检测（Mind-Reading Narration）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/mind-reading-narration.js');

const HEADER = '内景·客厅·夜';

describe('v2.80 mind-reading-narration 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.mindReadingNarration('').score, 100);
  });
});

describe('v2.80 mind-reading-narration 命中', () => {
  test('她知道这一走就是永别', () => {
    const r = M.mindReadingNarration(`${HEADER}\n她知道，这一走就是永别。`);
    assert.equal(r.hits.length, 1);
  });
  test('他明白自己没有退路', () => {
    const r = M.mindReadingNarration(`${HEADER}\n他明白自己已经没有退路了。`);
    assert.equal(r.hits.length, 1);
  });
  test('她突然意识到从没真正了解他', () => {
    const r = M.mindReadingNarration(`${HEADER}\n她突然意识到，自己从来没有真正了解过这个男人。`);
    assert.equal(r.hits.length, 1);
  });
  test('他终于懂了父亲当年为什么离开', () => {
    const r = M.mindReadingNarration(`${HEADER}\n这一刻，他终于懂了，父亲当年为什么离开。`);
    assert.equal(r.hits.length, 1);
  });
  test('人名主语也判', () => {
    const r = M.mindReadingNarration(`${HEADER}\n林棠知道，沈知远不会回来了。`);
    assert.equal(r.hits.length, 1);
  });
  test('多处累计扣分', () => {
    const draft = [
      HEADER,
      '她知道，这一走就是永别。',
      '他明白自己已经没有退路了。',
      '她确信他再也不会原谅她。',
    ].join('\n');
    const r = M.mindReadingNarration(draft);
    assert.ok(r.hits.length >= 3);
    assert.ok(r.score < 80);
  });
});

describe('v2.80 mind-reading-narration 豁免', () => {
  test('显性心想框架归 show-dont-tell，不重复报', () => {
    const r = M.mindReadingNarration(`${HEADER}\n她心想，这人再也不会回来了。`);
    assert.equal(r.hits.length, 0);
  });
  test('台词里的我知道不判', () => {
    const r = M.mindReadingNarration(`${HEADER}\n林棠：我知道你从来没信过我。`);
    assert.equal(r.hits.length, 0);
  });
  test('后跟具体数字事实不判（可验证的角色知识）', () => {
    const r = M.mindReadingNarration(`${HEADER}\n他知道保险柜密码是481218。`);
    assert.equal(r.hits.length, 0);
  });
  test('后跟引语不判', () => {
    const r = M.mindReadingNarration(`${HEADER}\n她知道他说的「马上回来」从来不算数。`);
    assert.equal(r.hits.length, 0);
  });
  test('问句不判', () => {
    const r = M.mindReadingNarration(`${HEADER}\n他怎么可能明白？`);
    assert.equal(r.hits.length, 0);
  });
  test('纯外化动作叙述满分（好写法）', () => {
    const draft = [
      HEADER,
      '林棠拿起笔，在落款处签下名字，把离婚协议书推回桌子对面。',
      '她摘下婚戒，搁在文件上，拎起行李箱出了门，没有回头。',
    ].join('\n');
    const r = M.mindReadingNarration(draft);
    assert.equal(r.score, 100);
  });
});

describe('v2.80 mind-reading-narration en', () => {
  test('she knew he would never forgive her', () => {
    const r = M.mindReadingNarration('INT. ROOM - NIGHT\nShe knew he would never forgive her.');
    assert.equal(r.hits.length, 1);
  });
  test('he realized no way out', () => {
    const r = M.mindReadingNarration('INT. ROOM - NIGHT\nHe realized there was no way out.');
    assert.equal(r.hits.length, 1);
  });
  test('for the first time she understood', () => {
    const r = M.mindReadingNarration('INT. ROOM - NIGHT\nFor the first time, she understood why her father had left.');
    assert.equal(r.hits.length, 1);
  });
  test('concrete fact exempt', () => {
    const r = M.mindReadingNarration('INT. ROOM - NIGHT\nHe knew the safe code was 481218.');
    assert.equal(r.hits.length, 0);
  });
  test('explicit thought frame exempt', () => {
    const r = M.mindReadingNarration('INT. ROOM - NIGHT\nShe thought to herself, he would never change.');
    assert.equal(r.hits.length, 0);
  });
  test('dialogue exempt', () => {
    const r = M.mindReadingNarration('INT. ROOM - NIGHT\nAnna: I knew you never trusted me.');
    assert.equal(r.hits.length, 0);
  });
});
