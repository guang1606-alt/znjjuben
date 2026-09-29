const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scoreEpisode, scoreProject, runPk } = require('../dist/lib/script-pk.js');

describe('剧本PK 评分引擎（v2.67，纯确定性）', () => {
  it('空内容返回中位基准分，不崩', () => {
    const s = scoreEpisode('');
    ['character', 'plot', 'dialogue', 'market', 'format', 'antiAi'].forEach((k) => {
      assert.ok(typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 100, k);
    });
    const p = scoreProject([]);
    assert.strictEqual(p.character, 55);
  });

  it('丰富剧本得分高于空泛剧本', () => {
    const rich = [
      '【第1场·夜·车库·内景】',
      '林晚攥着离职证明，指尖发白。',
      '周振邦：（目光锐利）你那个被毙的方案，是他们偷了你的创意。',
      '林晚猛地抬头，眼眶红了……',
      '【第2场·办公室·夜】',
      '周振邦把合同推过去：三个月，做不出爆款，你自己走。',
      '林晚深吸一口气，签下名字。窗外灯火通明，她的眼神从委屈变成冷硬。',
    ].join('\n');
    const empty = '她走了。他也走了。结束。'.repeat(2);
    const a = scoreEpisode(rich);
    const b = scoreEpisode(empty);
    assert.ok(a.plot > b.plot, `rich.plot=${a.plot} empty.plot=${b.plot}`);
    assert.ok(a.format > b.format);
  });

  it('runPk 输出六维、总分、胜者、小南点评，且可复现', () => {
    const A = ['【第1场】甲：你好！\n乙：（冷笑）来得正好。'.repeat(5)];
    const B = ['平淡的一天。大家都很平静。没有冲突。'.repeat(5)];
    const r1 = runPk(A, B);
    const r2 = runPk(A, B);
    assert.strictEqual(r1.dimensions.length, 6);
    assert.ok(r1.totalA >= 0 && r1.totalA <= 100);
    assert.ok(['A', 'B', 'tie'].includes(r1.winner));
    assert.ok(r1.xiaonanCommentZh.length > 0);
    assert.ok(!/[一-鿿]/.test(r1.xiaonanCommentEn), '英文点评不得含中文');
    // 可复现
    assert.strictEqual(r1.totalA, r2.totalA);
    assert.strictEqual(r1.winner, r2.winner);
  });

  it('多集聚合取均值，不被单集极端值带偏', () => {
    const eps = ['好剧本'.repeat(20), '差剧本'.repeat(5), '【第1场】冲突！反转？'.repeat(10)];
    const s = scoreProject(eps);
    assert.ok(s.character >= 0 && s.character <= 100);
  });
});
