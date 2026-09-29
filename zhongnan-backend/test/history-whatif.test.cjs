const test = require('node:test');
const assert = require('node:assert');
const H = require('../dist/engine/history-whatif.js');

test('历史脑洞简报：含真实锚点、单一变量、自洽推演、红线类别', () => {
  const b = H.historyWhatIfBrief({ anchor: '林肯遇刺当晚', variable: 'event_flip', tone: '悬疑' });
  assert.ok(b.includes('林肯遇刺当晚'));
  assert.ok(b.includes('一次只改一个变量'));
  assert.ok(b.includes('红线'));
  assert.ok(H.HISTORY_REDLINE_CATEGORIES.length >= 4);
});

test('五个变量方向齐全，小人物视角是最安全路径', () => {
  const ideas = H.whatIfIdeas('唐朝');
  assert.strictEqual(ideas.length, 5);
  assert.ok(ideas.some((i) => i.type === 'nobody_view'));
  ideas.forEach((i) => assert.ok(i.premise.includes('唐朝')));
});

test('合规：未注入检测器默认不放行（安全侧默认拒绝）；注入后按结果判定', () => {
  assert.strictEqual(H.assertHistorySafe('普通文本').safe, false);
  const clean = H.assertHistorySafe('普通文本', () => []);
  assert.strictEqual(clean.safe, true);
  const bad = H.assertHistorySafe('x', () => ['某红线类别']);
  assert.strictEqual(bad.safe, false);
  assert.ok(bad.hitCategories.length === 1);
});
