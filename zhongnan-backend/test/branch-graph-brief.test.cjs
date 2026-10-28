const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalizeGraph, GraphFormatError } = require('../dist/engine/interactive-branch.js');
const { normalizeBranchBrief, buildBranchDirective, BranchBriefError } = require('../dist/engine/branch-brief.js');

const graph = () => ({
  start: 's',
  nodes: {
    s: { type: 'choice', to: ['hold', 'confront'], label: '开场对峙' },
    hold: { type: 'scene', to: ['主线结局'], label: '按兵不动' },
    confront: { type: 'scene', to: ['坏结局'], label: '直接拆穿' },
    主线结局: { type: 'ending', endingType: '主线', label: '各退一步' },
    坏结局: { type: 'ending', endingType: 'bad' },
  },
});

const brief = (extra = {}) => normalizeBranchBrief({
  mainLine: '外卖员小陈送到别墅区发现收件人是前女友',
  choicePoints: '前女友求助他送文件给现任男友',
  endingsMain: 1, endingsHidden: 0, endingsBad: 1,
  ...extra,
});

describe('v2.335 分支图规范化', () => {
  it('缺省返回 null（不传图不改变旧行为）', () => {
    assert.strictEqual(normalizeGraph(undefined), null);
    assert.strictEqual(normalizeGraph(null), null);
  });

  it('收敛字段：结局别名归一、去重出边、裁掉非数字权重、标签截断', () => {
    const g = normalizeGraph({
      start: 's',
      nodes: {
        s: { type: 'choice', kind: 'probability', to: ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], weights: [70, 'x', 30, 10] },
        a: { type: 'ending', endingType: '主线' },
        b: { type: 'ending', endingType: 'hidden ending' },
        ...Object.fromEntries(['c', 'd', 'e', 'f', 'g'].map((id) => [id, { type: 'ending' }])),
      },
    });
    assert.deepStrictEqual(g.nodes.s.to, ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, 6));
    assert.strictEqual(g.nodes.s.kind, 'probability');
    assert.deepStrictEqual(g.nodes.s.weights, [70, 30, 10]);
    assert.strictEqual(g.nodes.a.endingType, 'main');
    assert.strictEqual(g.nodes.b.endingType, 'hidden');
    assert.strictEqual(g.nodes.a.label, undefined);
  });

  it('构不成图的形状问题抛 GraphFormatError（400 面）', () => {
    const cases = [
      [{}, '分支图需要 start'],
      [{ start: 'x', nodes: {} }, '没有节点'],
      [{ start: 'x', nodes: { y: { type: 'scene' } } }, '不在 nodes'],
      [{ start: 'x', nodes: { x: { type: 'branch' } } }, '类型必须是'],
      [{ start: 'x', nodes: { x: null } }, '类型必须是'],
    ];
    for (const [raw, hint] of cases) {
      assert.throws(() => normalizeGraph(raw), (e) => e instanceof GraphFormatError && e.field === 'graph' && e.message.includes(hint));
    }
    const many = { start: 's', nodes: { s: { type: 'ending' } } };
    for (let i = 0; i < 400; i += 1) many.nodes['n' + i] = { type: 'ending' };
    assert.throws(() => normalizeGraph(many), /最多 400 个节点/);
  });

  it('en 输出英文报错，不混中文', () => {
    assert.throws(() => normalizeGraph({ start: 'x', nodes: {} }, 'en'), (e) => e instanceof GraphFormatError && e.message === 'Branch graph has no nodes');
  });
});

describe('v2.335 分支简报接图', () => {
  it('合法图进入简报；形状错误转 BranchBriefError(field=graph)', () => {
    const b = brief({ graph: graph() });
    assert.ok(b.graph && b.graph.nodes[graph().start]);
    assert.throws(() => brief({ graph: { start: 'nope', nodes: { s: { type: 'ending' } } } }),
      (e) => e instanceof BranchBriefError && e.field === 'graph');
  });

  it('不传图时 graph 为 null，指令块与旧版一致（不出现图段）', () => {
    const b = brief();
    assert.strictEqual(b.graph, null);
    assert.ok(!buildBranchDirective(b, 'zh').includes('已定分支图'));
    assert.ok(!buildBranchDirective(b, 'en').includes('FIXED BRANCH GRAPH'));
  });

  it('中文指令块：结构锁定 + 起点/选择点去向/结局标签 + 线索落图要求', () => {
    const d = buildBranchDirective(brief({ graph: graph() }), 'zh');
    assert.ok(d.includes('已定分支图'));
    assert.ok(d.includes('不得增删节点或改连线'));
    assert.ok(d.includes('起点：s（开场对峙）'));
    assert.ok(d.includes('选择点：s（开场对峙） → hold（按兵不动） / confront（直接拆穿）'));
    assert.ok(d.includes('结局：主线结局（各退一步）［主线］') && d.includes('坏结局［坏］'));
    assert.ok(d.includes('不得新增出口'));
  });

  it('英文指令块：同口径，标签原样输出', () => {
    const d = buildBranchDirective(brief({ graph: {
      start: 's',
      nodes: {
        s: { type: 'choice', to: ['hold'], label: 'Opening standoff' },
        hold: { type: 'ending', endingType: 'main', label: 'Main ending' },
        bad: { type: 'ending', endingType: 'bad' },
      },
    } }), 'en');
    assert.ok(d.includes('FIXED BRANCH GRAPH'));
    assert.ok(d.includes('Start: s (Opening standoff)'));
    assert.ok(d.includes('Choice points: s (Opening standoff) → hold (Main ending)'));
    assert.ok(d.includes('Endings: hold (Main ending) [main]; bad [bad]'));
  });

  it('概率选择点在指令块标注机制', () => {
    const g = normalizeGraph({
      start: 's',
      nodes: {
        s: { type: 'choice', kind: 'probability', to: ['a', 'b'], weights: [30, 70], label: '抛硬币' },
        a: { type: 'ending' }, b: { type: 'ending', endingType: 'bad' },
      },
    });
    const d = buildBranchDirective(brief({ graph: g }), 'zh');
    assert.ok(d.includes('［概率］'));
  });
});
