// v2.80 会议体轮转对白检测（Round-Robin Dialogue）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/round-robin-dialogue.js');

const HEADER = '内景·会议室·夜';

describe('v2.80 round-robin-dialogue 空输入', () => {
  test('空草稿满分', () => {
    assert.equal(M.roundRobinDialogue('').score, 100);
  });
});

describe('v2.80 round-robin-dialogue 命中', () => {
  test('四人五句轮流读稿、句长整齐，判 1 场', () => {
    const draft = [
      HEADER,
      '张三：我觉得这个方案有风险。',
      '李四：我同意张三刚才的看法。',
      '王五：但我们也不能错过这次机会。',
      '赵六：那就大家投票决定吧。',
      '张三：好，现在开始举手表决。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 1);
    assert.ok(r.hits[0].turnCount >= 4);
    assert.ok(r.score < 100);
  });

  test('三人轮转 ABCABC 也判', () => {
    const draft = [
      HEADER,
      '甲：这件事情必须立刻处理。',
      '乙：我同意尽快处理比较好。',
      '丙：但是资金目前还没有到位。',
      '甲：资金问题我去想办法。',
      '乙：那时间定在明天上午。',
      '丙：好，明天上午会议室见。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 1);
  });
});

describe('v2.80 round-robin-dialogue 豁免', () => {
  test('句长差距大不判（有主次）', () => {
    const draft = [
      HEADER,
      '张三：我反对。这个项目从立项到现在三个季度，烧掉一千二百万，连个能上线的 demo 都没有，市场窗口期早就关了，现在追加预算就是往无底洞里扔钱。',
      '李四：我同意。',
      '王五：可是客户已经在催了。',
      '赵六：那也不能硬上。',
      '张三：散会。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
    assert.equal(r.score, 100);
  });

  test('有打断抢话不判（有活人气息）', () => {
    const draft = [
      HEADER,
      '张三：我觉得这个方案有风险。',
      '李四：我同意——',
      '王五：你先别急着同意，数据呢？',
      '赵六：那就投票吧。',
      '张三：等等，让她说完。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('少于三个说话人不判', () => {
    const draft = [
      HEADER,
      '张三：我觉得这个方案有风险。',
      '李四：风险可控，继续吧。',
      '张三：出了问题谁负责？',
      '李四：我负责。',
      '张三：好，那就这样。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('不足五句对白不判', () => {
    const draft = [
      HEADER,
      '张三：我觉得有风险。',
      '李四：我同意看法。',
      '王五：不能错过机会。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('一人压场连说不判（强势角色主导）', () => {
    const draft = [
      HEADER,
      '张三：这个方案有风险。',
      '张三：而且预算根本批不下来。',
      '李四：可是客户那边——',
      '王五：我站张总。',
      '赵六：那就再议。',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
  });
});

describe('v2.80 round-robin-dialogue en', () => {
  test('even-length rotating meeting flagged', () => {
    const draft = [
      'INT. BOARDROOM - NIGHT',
      'Anna: I think this plan is risky.',
      'Ben: I agree with Anna here.',
      'Cara: But we cannot miss this chance.',
      'Dan: Then put it to a vote.',
      'Anna: Fine, raise hands now.',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 1);
  });

  test('cross-talk exempt', () => {
    const draft = [
      'INT. BOARDROOM - NIGHT',
      'Anna: I think this plan is risky.',
      'Ben: I agree with—',
      'Cara: Data? Where is the data?',
      'Dan: Then put it to a vote.',
      'Anna: Wait, let her finish.',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
  });

  test('uneven lengths exempt', () => {
    const draft = [
      'INT. BOARDROOM - NIGHT',
      'Anna: I object. Three quarters in, twelve million burned, no shippable demo, the window closed months ago, and more budget is just pouring cash into a hole.',
      'Ben: Agreed.',
      'Cara: But the client is pushing.',
      'Dan: We cannot force it.',
      'Anna: Meeting over.',
    ].join('\n');
    const r = M.roundRobinDialogue(draft);
    assert.equal(r.hits.length, 0);
  });
});
