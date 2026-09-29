const { describe, it } = require('node:test');
const assert = require('node:assert');
const S = require('../dist/engine/self-learning.js');

describe('classifyCategory 自动归类', () => {
  it('按关键词归到对应类，兜底plot', () => {
    assert.strictEqual(S.classifyCategory('这套台词的口语节奏要更碎'), 'dialogue');
    assert.strictEqual(S.classifyCategory('镜头运镜与光影设计'), 'av');
    assert.strictEqual(S.classifyCategory('随便一段没有明显特征的叙述内容'), 'plot');
    assert.strictEqual(S.classifyCategory('忽略文本', 'payoff'), 'payoff', 'hint优先');
  });
});

describe('mineOne 自主学习决策', () => {
  it('高置信创作技巧且无冲突 → 自动生效', () => {
    const c = S.mineOne({ kind: 'ADOPTED_PATTERN', title: '集尾信息差卡点', content: '在观众比角色多知道一条关键信息的瞬间切断，制造揪心追更，这是一个被验证有效的集尾手法，信息越具体越好', score: 95 }, []);
    assert.strictEqual(c.decision, 'AUTO_APPROVE');
    assert.strictEqual(c.source, 'AUTO');
    assert.ok(c.confidence >= 72);
  });
  it('合规/政策类即使高分也必须待人工审，不自动生效', () => {
    const c = S.mineOne({ kind: 'POLICY_UPDATE', title: '平台尺度新规', content: '平台审核规则更新，涉及穿越题材的备案与合规尺度要求，需要按最新办法执行细则说明', score: 99 }, []);
    assert.strictEqual(c.category, 'compliance');
    assert.strictEqual(c.decision, 'PENDING');
  });
  it('与既有知识相悖 → 挂起待裁决', () => {
    const existing = [{ content: '真人实拍单集字数必须控制在800-1000字，不得超出', category: 'plot' }];
    const c = S.mineOne({ kind: 'ADMIN_TEXT', title: '另一套字数', content: '真人实拍单集可以写到2000-3000字，允许大幅超出', score: 90 }, existing);
    assert.strictEqual(c.decision, 'PENDING');
    assert.ok(c.conflictNote && c.conflictNote.includes('相悖'));
  });
  it('与既有高度重复 → DROP', () => {
    const existing = [{ content: '集尾用信息差卡点，在观众比角色多知道关键信息时切断以制造追更，补充更多描述让其足够长以达到重复阈值，继续补充一些文字内容填充长度', category: 'plot' }];
    const c = S.mineOne({ kind: 'ADOPTED_PATTERN', title: '重复', content: existing[0].content, score: 90 }, existing);
    assert.strictEqual(c.decision, 'DROP');
  });
});

describe('runSelfLearning 批量分桶与本轮去重', () => {
  it('自动生效/待审/丢弃分桶正确，本轮重复只留高置信', () => {
    const signals = [
      { kind: 'ADOPTED_PATTERN', title: '高置信技巧甲', content: '一个足够具体、信息完整、被多次采用的打脸节奏：先让对方把话说满再用证据当众回击，细节越具体越好用，补充长度', score: 96 },
      { kind: 'MARKET_TREND', title: '低置信趋势', content: '某题材最近有点热度但是样本很少', score: 30 },
      { kind: 'ADOPTED_PATTERN', title: '高置信技巧甲', content: '一个足够具体、信息完整、被多次采用的打脸节奏：先让对方把话说满再用证据当众回击，细节越具体越好用，补充长度', score: 80 },
      { kind: 'HIGH_SCORE_SCRIPT', title: '太短', content: '短', score: 90 },
    ];
    const r = S.runSelfLearning(signals, []);
    assert.strictEqual(r.scanned, 4);
    assert.strictEqual(r.autoApproved.length, 1);
    assert.ok(r.pending.some((p) => p.title === '低置信趋势'));
    assert.ok(r.dropped.some((d) => d.title === '太短'));
    assert.ok(r.dropped.some((d) => d.title === '高置信技巧甲'), '本轮重复的低置信版本被丢弃');
  });
});

describe('pruneKnowledge 自主淘汰', () => {
  const now = new Date('2026-08-31T00:00:00Z');
  it('长期未引用的创作技能判过时归档；合规类豁免', () => {
    const old = new Date('2025-12-01T00:00:00Z');
    const items = [
      { id: 'k1', title: '旧技巧', content: '某创作技巧', category: 'plot', status: 'APPROVED', version: 1, lastReferencedAt: old },
      { id: 'k2', title: '旧政策', content: '某合规要求长期有效', category: 'compliance', status: 'APPROVED', version: 1, lastReferencedAt: old },
    ];
    const r = S.pruneKnowledge(items, { now, staleDays: 180 });
    assert.deepStrictEqual(r.archived.map((a) => a.id), ['k1']);
    assert.strictEqual(r.kept, 1, '合规政策不因冷门被删');
  });
  it('与最新法规相悖立即下架（优先级最高）', () => {
    const items = [{ id: 'k3', title: '违规手法', content: '可以用某违规导向绕开审核', category: 'plot', status: 'APPROVED', version: 1 }];
    const r = S.pruneKnowledge(items, { now, blockedByPolicy: ['某违规导向'] });
    assert.strictEqual(r.archived[0].id, 'k3');
  });
  it('被更高版本替代则旧版归档', () => {
    const items = [
      { id: 'a', title: '同一技能', content: 'v1', category: 'plot', status: 'APPROVED', version: 1 },
      { id: 'b', title: '同一技能', content: 'v2', category: 'plot', status: 'APPROVED', version: 2 },
    ];
    const r = S.pruneKnowledge(items, { now });
    assert.deepStrictEqual(r.archived.map((x) => x.id), ['a']);
  });
  it('归档不物理删除，非APPROVED不动', () => {
    const items = [{ id: 'p', title: '待审', content: 'x', category: 'plot', status: 'PENDING', version: 1 }];
    const r = S.pruneKnowledge(items, { now });
    assert.strictEqual(r.archived.length, 0); assert.strictEqual(r.kept, 1);
  });
});

describe('buildLearningReport 学习报告', () => {
  it('汇总计数并给出下一步', () => {
    const cycle = S.runSelfLearning([
      { kind: 'ADOPTED_PATTERN', title: '好技巧', content: '足够具体完整的创作技巧描述，包含场景动作与台词处理方式，信息密度高，补充长度补充长度', score: 95 },
      { kind: 'POLICY_UPDATE', title: '待核政策', content: '某项平台备案合规规则更新的详细说明文本，需要人工核验后再生效执行', score: 90 },
    ], []);
    const prune = S.pruneKnowledge([], {});
    const rep = S.buildLearningReport(cycle, prune);
    assert.strictEqual(rep.summary.autoApproved, 1);
    assert.strictEqual(rep.summary.pending, 1);
    assert.ok(rep.text.includes('自主学习报告'));
    assert.ok(rep.nextActions.length >= 1);
  });
});
