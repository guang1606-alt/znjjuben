const test = require('node:test');
const assert = require('node:assert');
const W = require('../dist/engine/stage-workflow.js');
const SC = require('../dist/engine/scorecard.js');

test('阶段必须按序推进，不能跳阶段', () => {
  const no = W.canAdvance('draft', [], '随便');
  assert.strictEqual(no.ok, false);
  const goodOutline = '人物小传：林晚，30岁。\n第一集 梗概\n第二集 大纲走向';
  const yes = W.canAdvance('draft', ['outline'], goodOutline);
  assert.strictEqual(yes.ok, true);
});

test('梗概缺人物小传或分集大纲→不准进入初稿', () => {
  assert.strictEqual(W.stageArtifactOk('outline', '只有一个创意想法，很短').ok, false);
  assert.strictEqual(W.stageArtifactOk('outline', '人物小传：主角林晚，三十岁，性格坚韧。\n分集梗概：第一集冲突爆发，第二集开始反击。').ok, true);
});

test('初稿无场景或台词→不准进入润色', () => {
  assert.strictEqual(W.stageArtifactOk('draft', '这是一段没有场景也没有台词的纯叙述文字凑够二十个字以上。').ok, false);
  assert.strictEqual(W.stageArtifactOk('draft', '内景 家·日\n△ 他坐下。\n林晚：你来了。').ok, true);
});

test('分阶段计费：会员折扣正确、每阶段>0、全流程高于一键生成', () => {
  assert.strictEqual(W.stageCredits('outline', 'basic'), 4);
  assert.strictEqual(W.stageCredits('draft', 'basic'), 10);
  assert.strictEqual(W.stageCredits('outline', 'pro'), 2);
  const full = W.fullWorkflowCredits('basic');
  assert.strictEqual(full, 24);
  assert.ok(full > 10, '渐进打磨全流程应高于一键单集，体现增值');
  W.STAGES.forEach((s) => assert.ok(W.stageCredits(s.id, 'pro') >= 1, '任何会员档位单阶段都不得免费到0'));
});

test('六维总评：全优得满分、无短板待办', () => {
  const r = SC.aggregateScorecard({ character: 100, plot: 100, dialogue: 100, market: 100, format: 100, deai: 100 });
  assert.strictEqual(r.total, 100);
  assert.strictEqual(r.level, '优秀');
  assert.strictEqual(r.priorityActions.length, 0);
});

test('六维总评：准确识别最短短板并按严重度排序', () => {
  const r = SC.aggregateScorecard({ character: 88, plot: 90, dialogue: 80, market: 92, format: 85, deai: 40 });
  assert.strictEqual(r.weakest.key, 'deai');
  assert.strictEqual(r.priorityActions[0].key, 'deai');
  assert.ok(r.total < 80);
});

test('六维总评：越界分值被夹到0-100', () => {
  const r = SC.aggregateScorecard({ character: 130, plot: -5, dialogue: 90, market: 90, format: 90, deai: 90 });
  assert.ok(r.dimensions.every((d) => d.score >= 0 && d.score <= 100));
});
