/**
 * v2.334 互动影游·线索 × 节点联合可达性（TDD 红→绿）
 * v2.333 只校验线索自身的字符串图（悬空/拆解/前置成环），从不与分支图比对：
 * 线索声明的「可得处」「拆穿点」「必需结局」可能根本落在图外或不可达节点上，
 * 或某结局其实存在绕过必需线索的路径 —— 玩家拿不到线索却照样通关，逻辑不自洽。
 * 本文件锁定联合校验的确定性规则（零模型调用、纯函数）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateClueGraph } = require('../dist/engine/interactive-branch.js');

const graph = () => ({
  start: 's',
  nodes: {
    s: { type: 'choice', to: ['c1', 'c2'], label: '开场对峙' },
    c1: { type: 'scene', to: ['e1', 'e2'], label: '选择点1' },
    c2: { type: 'scene', to: ['e1'], label: '选择点2' },
    orphan: { type: 'scene', to: ['e1'], label: '废弃支线' },
    e1: { type: 'ending', endingType: 'main', label: '主线结局' },
    e2: { type: 'ending', endingType: 'bad', label: '坏结局1' },
  },
});

const clue = (over = {}) => ({
  id: '锈钥匙', trust: 'true', source: '', gainAt: [], opens: [],
  requires: [], exposeAt: '', requiredFor: [], ...over,
});
const types = (issues) => issues.map((i) => i.type);
const find = (issues, type) => issues.find((i) => i.type === type);

describe('线索×节点·可得处落图', () => {
  it('可得处既不是节点 id 也不是节点标签 → 严重：声明点不存在', () => {
    const issues = validateClueGraph([clue({ gainAt: ['第三幕'] })], graph());
    const hit = find(issues, 'clue_gain_unknown');
    assert.ok(hit, '应报 clue_gain_unknown');
    assert.strictEqual(hit.severity, 'high');
    assert.strictEqual(hit.clue, '锈钥匙');
    assert.ok(hit.evidence.includes('第三幕'));
  });

  it('可得处按节点标签匹配（选择点1），不误报', () => {
    const issues = validateClueGraph([clue({ gainAt: ['选择点1'] })], graph());
    assert.strictEqual(find(issues, 'clue_gain_unknown'), undefined);
    assert.strictEqual(find(issues, 'clue_gain_unreachable'), undefined);
  });

  it('可得处按节点 id 匹配（c2），不误报', () => {
    const issues = validateClueGraph([clue({ gainAt: ['c2'] })], graph());
    assert.deepStrictEqual(types(issues), []);
  });

  it('可得处落在从起点不可达的节点 → 严重：玩家永远拿不到', () => {
    const issues = validateClueGraph([clue({ gainAt: ['废弃支线'] })], graph());
    const hit = find(issues, 'clue_gain_unreachable');
    assert.ok(hit, '应报 clue_gain_unreachable');
    assert.strictEqual(hit.severity, 'high');
    assert.strictEqual(find(issues, 'clue_gain_unknown'), undefined, '节点存在就不是 unknown');
  });

  it('多条可得处里只要有一条可达就不报不可达', () => {
    const issues = validateClueGraph([clue({ gainAt: ['废弃支线', '选择点2'] })], graph());
    assert.strictEqual(find(issues, 'clue_gain_unreachable'), undefined);
  });
});

describe('线索×节点·必需结局可绕过', () => {
  it('声明为某结局必需，但存在不经过可得处的路径 → 严重：结局可绕过该线索', () => {
    const issues = validateClueGraph(
      [clue({ gainAt: ['选择点2'], requiredFor: ['主线结局'] })], graph(),
    );
    const hit = find(issues, 'clue_ending_bypass');
    assert.ok(hit, '应报 clue_ending_bypass');
    assert.strictEqual(hit.severity, 'high');
    assert.ok(hit.evidence.includes('主线结局'));
  });

  it('所有通往该结局的路径都必须经过可得处 → 不报绕过', () => {
    const issues = validateClueGraph(
      [clue({ gainAt: ['选择点1', '选择点2'], requiredFor: ['主线结局'] })], graph(),
    );
    assert.strictEqual(find(issues, 'clue_ending_bypass'), undefined);
  });

  it('requiredFor 支持 endingType 别名（bad/坏结局）', () => {
    const issues = validateClueGraph(
      [clue({ gainAt: ['选择点2'], requiredFor: ['bad'] })], graph(),
    );
    assert.ok(find(issues, 'clue_ending_bypass'), '坏结局经 c1 可达，应报绕过');
  });

  it('requiredFor 指向图外结局 → 不做绕过判定（交给可解锁目标提示）', () => {
    const issues = validateClueGraph(
      [clue({ gainAt: ['选择点2'], requiredFor: ['不存在的结局'] })], graph(),
    );
    assert.strictEqual(find(issues, 'clue_ending_bypass'), undefined);
  });
});

describe('线索×节点·可解锁目标与拆穿点', () => {
  it('可解锁目标在图内找不到 → 中等：核对名称', () => {
    const issues = validateClueGraph([clue({ gainAt: ['选择点1'], opens: ['神秘门'] })], graph());
    const hit = find(issues, 'clue_opens_unknown');
    assert.ok(hit, '应报 clue_opens_unknown');
    assert.strictEqual(hit.severity, 'mid');
  });

  it('可解锁目标是图内结局标签 → 不报', () => {
    const issues = validateClueGraph([clue({ gainAt: ['选择点1'], opens: ['主线结局'] })], graph());
    assert.strictEqual(find(issues, 'clue_opens_unknown'), undefined);
  });

  it('假线索拆穿点落在不可达节点 → 中等：拆穿永远不会发生', () => {
    const issues = validateClueGraph(
      [clue({ trust: 'false', gainAt: ['选择点1'], exposeAt: '废弃支线' })], graph(),
    );
    const hit = find(issues, 'clue_expose_unreachable');
    assert.ok(hit, '应报 clue_expose_unreachable');
    assert.strictEqual(hit.severity, 'mid');
  });

  it('拆穿点是自由文本（图内无同名节点）→ 不误报', () => {
    const issues = validateClueGraph(
      [clue({ trust: 'false', gainAt: ['选择点1'], exposeAt: '第三幕对峙' })], graph(),
    );
    assert.strictEqual(find(issues, 'clue_expose_unreachable'), undefined);
  });
});

describe('线索×节点·边界与多语言', () => {
  it('无线索或空图 → 空结果', () => {
    assert.deepStrictEqual(validateClueGraph([], graph()), []);
    assert.deepStrictEqual(validateClueGraph([clue({ gainAt: ['第三幕'] })], { start: 's', nodes: {} }), []);
  });

  it('英文证据与建议不混入中文', () => {
    const issues = validateClueGraph([clue({ gainAt: ['第三幕'] })], graph(), 'en');
    const hit = find(issues, 'clue_gain_unknown');
    assert.ok(hit);
    assert.ok(/Clue/.test(hit.evidence), '英文证据应含 Clue');
    assert.ok(!/线索/.test(hit.evidence + hit.advice), '英文输出不得出现中文');
  });
});
