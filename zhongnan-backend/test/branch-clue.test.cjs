/**
 * v2.333 互动影游·线索链可达性校验（TDD 红→绿）
 * 约束：无 clues 时行为与 v2.332 完全一致；线索校验全部为确定性检查，零模型调用。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  normalizeBranchBrief, buildBranchDirective, validateClueChain,
} = require('../dist/engine/branch-brief.js');

const baseRaw = {
  mainLine: '外卖员小陈送到豪华别墅区，发现收件人是前女友',
  choicePoints: '前女友求他送文件给现任男友，接不接是关键选择',
  endingsMain: 1, endingsHidden: 1, endingsBad: 1,
};
const clue = (over = {}) => ({
  id: '锈钥匙', trust: 'true', source: '老管家在杂物间递出',
  gainAt: ['选择点3'], opens: ['隐藏结局1'], requires: [], requiredFor: [], exposeAt: '',
  ...over,
});
const types = (issues) => issues.map((i) => i.type);

describe('线索链·向后兼容', () => {
  it('不传 clues → clues 为空数组，指令与旧版逐字一致', () => {
    const b = normalizeBranchBrief(baseRaw);
    assert.deepStrictEqual(b.clues, []);
    const d = buildBranchDirective(b, 'zh');
    assert.ok(!d.includes('线索链'), '无 clues 时不得出现线索链段落');
    const dOld = buildBranchDirective(normalizeBranchBrief({ ...baseRaw }), 'zh');
    assert.strictEqual(d, dOld);
  });

  it('无 clues 时 validateClueChain 返回空', () => {
    assert.deepStrictEqual(validateClueChain(normalizeBranchBrief(baseRaw)), []);
  });
});

describe('线索链·规范化', () => {
  it('信任度同义词归一、字符串数组按标点切分、超长截断', () => {
    const b = normalizeBranchBrief({
      ...baseRaw,
      clues: [{
        id: '  锈钥匙  ', trust: '真', source: '老管家',
        gainAt: '选择点3，支线B', opens: '隐藏结局1、主线结局',
        requires: '旧照片', exposeAt: '选择点5',
      }],
    });
    const c = b.clues[0];
    assert.strictEqual(c.id, '锈钥匙');
    assert.strictEqual(c.trust, 'true');
    assert.deepStrictEqual(c.gainAt, ['选择点3', '支线B']);
    assert.deepStrictEqual(c.opens, ['隐藏结局1', '主线结局']);
    assert.deepStrictEqual(c.requires, ['旧照片']);
    assert.strictEqual(c.exposeAt, '选择点5');
  });

  it('非法信任度回退 true，非数组非字符串的字段丢弃', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [{ id: 'A', trust: 'wat', gainAt: 42, opens: null }] });
    assert.strictEqual(b.clues[0].trust, 'true');
    assert.deepStrictEqual(b.clues[0].gainAt, []);
    assert.deepStrictEqual(b.clues[0].opens, []);
  });
});

describe('线索链·拦截级校验（high）', () => {
  it('id 重复 → clue_duplicate', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue(), clue({ source: '另一个来源' })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'high');
    assert.ok(types(issues).includes('clue_duplicate'));
  });

  it('无任何可获得处 → clue_unobtainable（悬空线索）', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ gainAt: [] })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'high');
    assert.ok(types(issues).includes('clue_unobtainable'));
  });

  it('假线索没有拆穿点 → clue_false_unexposed', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ trust: 'false', exposeAt: '' })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'high');
    assert.ok(types(issues).includes('clue_false_unexposed'));
  });

  it('前置线索不存在 → clue_chain_broken（门控引用了不存在的线索）', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ requires: ['不存在的线索'] })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'high');
    assert.ok(types(issues).includes('clue_chain_broken'));
  });

  it('前置关系成环 → clue_chain_cycle（永远拿不到）', () => {
    const b = normalizeBranchBrief({
      ...baseRaw,
      clues: [clue({ id: 'A', requires: ['B'] }), clue({ id: 'B', requires: ['A'] })],
    });
    const issues = validateClueChain(b).filter((i) => i.severity === 'high');
    assert.ok(types(issues).includes('clue_chain_cycle'));
  });
});

describe('线索链·提示级校验（mid）', () => {
  it('线索不打开任何门控/结局 → clue_no_gate', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ opens: [] })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'mid');
    assert.ok(types(issues).includes('clue_no_gate'));
  });

  it('半真线索没有揭晓点 → clue_half_unexposed', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ trust: 'half', exposeAt: '' })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'mid');
    assert.ok(types(issues).includes('clue_half_unexposed'));
  });

  it('声称某结局必需却不在 opens 中 → clue_required_unopened', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ requiredFor: ['坏结局1'] })] });
    const issues = validateClueChain(b).filter((i) => i.severity === 'mid');
    assert.ok(types(issues).includes('clue_required_unopened'));
  });

  it('完全合法的线索链 → 无任何 issue', () => {
    const b = normalizeBranchBrief({
      ...baseRaw,
      clues: [
        clue(),
        clue({ id: '假账本', trust: 'false', gainAt: ['选择点2'], opens: ['坏结局1'], exposeAt: '选择点4', requiredFor: ['坏结局1'] }),
      ],
    });
    assert.deepStrictEqual(validateClueChain(b), []);
  });
});

describe('线索链·指令拼装', () => {
  it('有 clues 时输出线索行与线索铁律，真假与拆穿点可见', () => {
    const b = normalizeBranchBrief({
      ...baseRaw,
      clues: [
        clue(),
        clue({ id: '假账本', trust: 'false', source: '秘书故意留在桌上', gainAt: ['选择点2'], opens: ['坏结局1'], exposeAt: '选择点4' }),
      ],
    });
    const d = buildBranchDirective(b, 'zh');
    assert.ok(d.includes('线索链'));
    assert.ok(d.includes('锈钥匙') && d.includes('假账本'));
    assert.ok(d.includes('拆穿') && d.includes('选择点4'));
    assert.ok(d.includes('假线索'));
  });

  it('英文指令含线索链段落', () => {
    const b = normalizeBranchBrief({ ...baseRaw, clues: [clue({ id: 'rusty key', gainAt: ['Choice 3'], opens: ['hidden ending'] })] });
    const d = buildBranchDirective(b, 'en');
    assert.ok(d.includes('CLUE'));
    assert.ok(d.includes('rusty key'));
  });
});
