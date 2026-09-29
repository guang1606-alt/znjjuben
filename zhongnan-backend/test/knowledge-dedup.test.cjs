const test = require('node:test');
const assert = require('node:assert');
const { reconcileKnowledge } = require('../dist/lib/knowledge-dedup.js');

const existing = [
  { content: '真人实拍剧本单集字数严格控制在800-1000字', category: 'format' },
  { content: '黄金三秒必须用强冲突钩子抓住观众', category: 'plot' },
];

test('高度重复知识判冗余，建议合并不新增', () => {
  const r = reconcileKnowledge('真人实拍剧本单集字数严格控制在800到1000字左右', 'format', existing);
  assert.strictEqual(r.status, 'DUPLICATE');
  assert.ok(r.duplicateOf);
});

test('数值区间矛盾判相悖，挂起不生效', () => {
  const r = reconcileKnowledge('剧本单集应当写到2000-3000字才够细', 'format', existing);
  assert.strictEqual(r.status, 'CONFLICT');
  assert.ok(r.conflicts.length >= 1);
});

test('独立新知识正常通过', () => {
  const r = reconcileKnowledge('互动短剧每个分支都必须能闭环，不能有死胡同', 'plot', existing);
  assert.strictEqual(r.status, 'OK');
});

test('情态对立（必须 vs 可以）判相悖', () => {
  const r = reconcileKnowledge('主角结局必须黑化', 'plot', [
    { content: '主角结局可以不黑化，走救赎线', category: 'plot' },
  ]);
  assert.strictEqual(r.status, 'CONFLICT');
});
