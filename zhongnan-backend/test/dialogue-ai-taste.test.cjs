// v2.80 对白 AI 味检测（Dialogue AI-Taste Detection）
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/engine/dialogue-ai-taste.js');

describe('v2.80 dialogue-ai-taste 空输入', () => {
  test('空草稿返回零分零问题', () => {
    const r = M.dialogueAiTaste('');
    assert.equal(r.score, 0);
    assert.equal(r.issues.length, 0);
  });
});

describe('v2.80 dialogue-ai-taste 排比堆砌', () => {
  test('≥3 个相同开头短句触发 parallelism', () => {
    const draft = '沈知远：你不懂，你不懂，你不懂。';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'parallelism'));
  });
  test('正常对白不触发', () => {
    const draft = '沈知远：今天天气不错。\n林棠：是啊。';
    const r = M.dialogueAiTaste(draft);
    assert.equal(r.issues.length, 0);
  });
});

describe('v2.80 dialogue-ai-taste 说教腔', () => {
  test('你要知道 + 长句触发 lecturing (high)', () => {
    const draft = '沈知远：你要知道这个世界从来不会因为你的眼泪而改变什么。';
    const r = M.dialogueAiTaste(draft);
    const iss = r.issues.find((i) => i.type === 'lecturing');
    assert.ok(iss);
    assert.equal(iss.severity, 'high');
  });
});

describe('v2.80 dialogue-ai-taste 书面语', () => {
  test('因此/然而触发 formal', () => {
    const draft = '沈知远：因此我们必须离开这里。';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'formal'));
  });
});

describe('v2.80 dialogue-ai-taste 解释性台词', () => {
  test('是因为触发 expository (high)', () => {
    const draft = '沈知远：我告诉你这些是因为你必须知道真相。';
    const r = M.dialogueAiTaste(draft);
    const iss = r.issues.find((i) => i.type === 'expository');
    assert.ok(iss);
    assert.equal(iss.severity, 'high');
  });
});

describe('v2.80 dialogue-ai-taste 万能金句', () => {
  test('人生就像触发 aphorism', () => {
    const draft = '沈知远：人生就像一杯茶，不会苦一辈子。';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'aphorism'));
  });
});

describe('v2.80 dialogue-ai-taste 评分与 breakdown', () => {
  test('所有问题都计入 breakdown', () => {
    const draft = [
      '沈知远：你要知道这个世界从来不会因为你的眼泪而改变什么。',
      '沈知远：因此我们必须离开这里。',
    ].join('\n');
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.breakdown.lecturing > 0);
    assert.ok(r.breakdown.formal > 0);
    assert.ok(r.score > 0);
  });
  test('满分封顶 100', () => {
    const draft = '沈知远：你不懂，你不懂，你不懂。\n沈知远：你不懂，你不懂，你不懂。';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.score <= 100);
  });
});

describe('v2.80 dialogue-ai-taste 场景标题不被误判', () => {
  test('内景标题行跳过', () => {
    const draft = '内景·客厅·日\n沈知远：今天天气不错。';
    const r = M.dialogueAiTaste(draft);
    assert.equal(r.issues.length, 0);
  });
});

describe('v2.80 dialogue-ai-taste en 链路', () => {
  test('英文 lecturing 检测', () => {
    const draft = 'Steve: You must understand that this is not the way.';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'lecturing'));
  });
  test('英文 formal 检测', () => {
    const draft = 'Steve: Therefore we must leave now.';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'formal'));
  });
  test('英文 expository 检测', () => {
    const draft = 'Steve: This is why I had to do it.';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'expository'));
  });
  test('英文 aphorism 检测', () => {
    const draft = 'Steve: Life is like a box of chocolates.';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'aphorism'));
  });
  test('英文 parallelism 检测', () => {
    const draft = 'Steve: You don\'t know, you don\'t care, you don\'t matter.';
    const r = M.dialogueAiTaste(draft);
    assert.ok(r.issues.some((i) => i.type === 'parallelism'));
  });
  test('英文正常对白不触发', () => {
    const draft = 'Steve: How are you today?\nLisa: I am fine, thanks.';
    const r = M.dialogueAiTaste(draft);
    assert.equal(r.issues.length, 0);
  });
});
