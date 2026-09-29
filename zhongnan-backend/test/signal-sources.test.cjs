const { describe, it } = require('node:test');
const assert = require('node:assert');
const S = require('../dist/engine/signal-sources.js');

function board(title, tags, platform, heat, date = new Date()) { return { title, platform, tags: Array.isArray(tags) ? tags : [tags], heat, date }; }

describe('signalsFromBoards 榜单→市场信号', () => {
  it('多平台共振标签得分更高且标注共振，单平台偏弱', () => {
    const boards = [
      board('剧A', ['逆袭', '豪门'], '红果', 100),
      board('剧B', ['逆袭'], '抖音', 90),
      board('剧C', ['穿越'], '快手', 80),
    ];
    const sig = S.signalsFromBoards(boards, { topN: 5 });
    const ni = sig.find((x) => x.title.includes('逆袭'));
    const cy = sig.find((x) => x.title.includes('穿越'));
    assert.ok(ni.content.includes('多平台共振'));
    assert.ok(ni.score > cy.score);
    assert.ok(ni.key.startsWith('board:逆袭:'));
  });
  it('空榜单返回空', () => { assert.deepStrictEqual(S.signalsFromBoards([]), []); });
});

describe('signalsFromPolicyUpdates 政策信号', () => {
  it('归 compliance、带稳定key、内容过短被过滤', () => {
    const out = S.signalsFromPolicyUpdates([
      { id: 'p1', title: '备案新规', content: '微短剧备案分类分级规则更新的详细说明文本，需要人工核验' },
      { id: 'p2', title: '太短', content: '短' },
    ]);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].category, 'compliance');
    assert.strictEqual(out[0].key, 'policy:p1');
  });
});

describe('signalsFromTopScripts 高分剧本脱敏提炼', () => {
  it('只取梗概与强项、不抄正文，低于阈值不取', () => {
    const out = S.signalsFromTopScripts([
      { id: 's1', synopsis: '外卖员逆袭成为集团掌门人的故事梗概', qcReport: { total: 88, dimensions: [{ key: 'dialogue', label: '台词', score: 90 }, { key: 'plot', label: '剧情结构', score: 87 }] } },
      { id: 's2', synopsis: '低分剧本梗概', qcReport: { total: 70, dimensions: [] } },
    ], { minTotal: 85 });
    assert.strictEqual(out.length, 1);
    assert.ok(out[0].content.includes('外卖员逆袭'));
    assert.ok(out[0].content.includes('台词'));
    assert.strictEqual(out[0].kind, 'HIGH_SCORE_SCRIPT');
    assert.ok(out[0].source.includes('脱敏'));
  });
});

describe('collectAllSignals + onlyNewSignals', () => {
  it('三类合并，已学key被跳过', () => {
    const all = S.collectAllSignals({
      boards: [board('A', ['战神'], '红果', 99)],
      policyUpdates: [{ id: 'q1', title: '规则', content: '某平台审核规则更新的详细说明内容文本' }],
      topScripts: [{ id: 't1', synopsis: '一个高分梗概内容用于测试', qcReport: { total: 90, dimensions: [] } }],
    });
    assert.strictEqual(all.length, 3);
    const learned = new Set([all[0].key]);
    const { fresh, skipped } = S.onlyNewSignals(all, learned);
    assert.strictEqual(fresh.length, 2); assert.strictEqual(skipped, 1);
  });
  it('本轮内重复key只留一条', () => {
    const a = { key: 'k', x: 1 }, b = { key: 'k', x: 2 };
    const { fresh } = S.onlyNewSignals([a, b], new Set());
    assert.strictEqual(fresh.length, 1);
  });
});
