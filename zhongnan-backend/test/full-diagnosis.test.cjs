const test = require('node:test');
const assert = require('node:assert');
const { diagnoseFull } = require('../dist/engine/full-diagnosis.js');

// 刻意“问题密集”的样本：伪断章、无代价系统、形容词立人、AI腔
const badEp = [
  '第1集\n他是一个杀伐果断、冷酷无情、不怒自威、气场强大的男人。主角绑定系统获得新手大礼包，从此轻松获得一切。总而言之，综上所述，他决定开始逆袭。',
  '第2集\n他一路高歌，大仇得报，赢了，故事圆满。主角一脚踹开大门，拔剑指着反派大喊：今天就是你的死期！',
].map((c, i) => ({ epNo: i + 1, title: i === 0 ? '测试开局' : '测试', content: c }));

// 相对健康样本：有现实特权反派、老实人、清算、代价、痕迹债
const goodEp = [{
  epNo: 1,
  title: '桃花开的时候',
  content: '跋扈富二代靠关系抢了兢兢业业老员工的转正名额，老实人百口莫辩。系统每次使用都要透支寿命，等价交换。他出征前答应女儿，桃花开了就带她放风筝。她没哭，只是第二天吃饭时下意识多摆了一副碗筷，再也没有人回答。她不问对错，已提前切断对方退路，两人共享一个秘密。最终主角揭穿并连根拔起，完成清算。',
}];

test('六维齐全且总分在0-100', () => {
  const r = diagnoseFull(badEp);
  assert.strictEqual(r.scorecard.dimensions.length, 6);
  assert.ok(r.scorecard.total >= 0 && r.scorecard.total <= 100);
  assert.strictEqual(r.groups.length, 6);
  assert.strictEqual(r.counts.episodeCount, 2);
});

test('问题样本能抓到结构尺子问题并给出优先清单', () => {
  const r = diagnoseFull(badEp);
  const rules = r.topFixes.map((f) => f.rule);
  assert.ok(rules.includes('cliffhanger'), '应抓到伪断章: ' + rules.join(','));
  assert.ok(rules.includes('goldenFinger'), '应抓到无代价金手指');
  assert.ok(rules.includes('showByChoice'), '应抓到形容词立人');
  assert.ok(r.counts.aiHits >= 1, '应识别AI腔');
});

test('健康样本总分高于问题样本', () => {
  const bad = diagnoseFull(badEp).scorecard.total;
  const good = diagnoseFull(goodEp).scorecard.total;
  assert.ok(good > bad, `good=${good} 应大于 bad=${bad}`);
});

test('市场维度：外部传入优先，否则标记为估算', () => {
  const est = diagnoseFull(goodEp);
  assert.strictEqual(est.marketEstimated, true);
  const ext = diagnoseFull(goodEp, { marketScore: 88 });
  assert.strictEqual(ext.marketEstimated, false);
  const marketDim = ext.groups.find((g) => g.key === 'market');
  assert.strictEqual(marketDim.score, 88);
});

test('受众追更欲分可作为市场兜底', () => {
  const r = diagnoseFull(goodEp, { audienceScore: 72 });
  assert.strictEqual(r.marketEstimated, false);
  assert.strictEqual(r.groups.find((g) => g.key === 'market').score, 72);
});

test('空输入不崩溃', () => {
  const r = diagnoseFull([]);
  assert.strictEqual(r.counts.episodeCount, 0);
  assert.ok(r.scorecard.total >= 0);
  assert.strictEqual(r.topFixes.length, 0);
});

test('topFixes 按严重度排序且限量12', () => {
  const r = diagnoseFull(badEp.concat(badEp).concat(badEp));
  assert.ok(r.topFixes.length <= 12);
  const order = { P0: 0, P1: 1, P2: 2 };
  for (let i = 1; i < r.topFixes.length; i++) {
    assert.ok(order[r.topFixes[i - 1].level] <= order[r.topFixes[i].level]);
  }
});
