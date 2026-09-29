const test = require('node:test');
const assert = require('node:assert');
const G = require('../dist/engine/generation-progress.js');

test('覆盖率：流水线每个阶段都配了游戏化文案（新增岗位漏配即失败）', () => {
  assert.deepStrictEqual(G.progressCoverageErrors(), []);
});

test('时间线：有序、单调不减、终点100、起context终done', () => {
  const tl = G.progressTimeline();
  assert.strictEqual(tl[0].stage, 'context');
  assert.strictEqual(tl[tl.length - 1].stage, 'done');
  assert.strictEqual(tl[tl.length - 1].percent, 100);
  for (let i = 1; i < tl.length; i++) assert.ok(tl[i].percent >= tl[i - 1].percent, '进度不得回退');
});

test('撰写阶段随集数推进：后面的集进度更高，且未到done不超过99', () => {
  const e0 = G.progressSnapshot({ stage: 'writer', episodeIndex: 0, totalEpisodes: 20 }).percent;
  const e19 = G.progressSnapshot({ stage: 'writer', episodeIndex: 19, totalEpisodes: 20 }).percent;
  assert.ok(e19 > e0);
  assert.ok(e19 <= 99);
});

test('门岗阶段也有进度与文案；未知阶段安全降级不崩', () => {
  const c = G.progressSnapshot({ stage: 'consistency' });
  assert.ok(c.percent > 0 && c.label.includes('关'));
  const u = G.progressSnapshot({ stage: 'not_exist' });
  assert.ok(u.percent === 50 && u.xiaonanLine.includes('小南'));
});

test('同输入确定性（不闪烁）；会员看到更密的彩蛋', () => {
  const a = G.progressSnapshot({ stage: 'market_pre', seed: 3 });
  const b = G.progressSnapshot({ stage: 'market_pre', seed: 3 });
  assert.strictEqual(a.xiaonanLine, b.xiaonanLine);
  const free = G.progressSnapshot({ stage: 'market_pre', tier: 'free' });
  const pro = G.progressSnapshot({ stage: 'market_pre', tier: 'pro' });
  assert.ok(pro.tip.includes('实时榜单'));
  assert.ok(!free.tip.includes('实时榜单'));
});

test('岗位事件→顺序表阶段映射：designer=character、门岗按note区分、market=market_post', () => {
  assert.strictEqual(G.roleEventToStage('dispatcher'), 'context');
  assert.strictEqual(G.roleEventToStage('designer'), 'character');
  assert.strictEqual(G.roleEventToStage('polisher', '去AI化抓到：套路句'), 'deai');
  assert.strictEqual(G.roleEventToStage('polisher', '一致性：本集未出现已立人物'), 'consistency');
  assert.strictEqual(G.roleEventToStage('polisher', '普通润色'), 'polish');
  assert.strictEqual(G.roleEventToStage('market'), 'market_post');
  // 映射结果都能安全产出进度，不抛错
  ['dispatcher','architect','designer','writer','audience','polisher','compliance','market','done']
    .forEach((r) => assert.ok(G.progressSnapshot({ stage: G.roleEventToStage(r) }).percent >= 0));
});
