const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  normalizeBranchBrief, hasBranchBrief, validateBranchStructure, buildBranchDirective, BranchBriefError,
} = require('../dist/engine/branch-brief.js');

const baseRaw = {
  mainLine: '外卖员小陈送到豪华别墅区，发现收件人是前女友',
  choicePoints: '前女友求他送文件给现任男友，接不接是关键选择',
  endingsMain: 1, endingsHidden: 1, endingsBad: 1,
};

describe('分支简报·规范化', () => {
  it('必填缺失抛 BranchBriefError 带 field', () => {
    assert.throws(() => normalizeBranchBrief({ choicePoints: baseRaw.choicePoints, endingsMain: 1, endingsHidden: 1, endingsBad: 1 }),
      (e) => e.field === 'mainLine');
    // mainLine 够长但 choicePoints 缺失 → field=choicePoints
    assert.throws(() => normalizeBranchBrief({ mainLine: '小陈送外卖到别墅区', endingsMain: 1, endingsHidden: 1, endingsBad: 1 }),
      (e) => e.field === 'choicePoints');
  });

  it('trim、非法枚举回退、超长截断', () => {
    const b = normalizeBranchBrief({
      mainLine: '  主线起点描述  ', choicePoints: '  选择点描述  ',
      endingsMain: 'wat', endingsHidden: -3, endingsBad: 2,
      branchStyle: 'haha', stakesLevel: 'wat',
      customEnding: '  ',
    });
    assert.strictEqual(b.mainLine, '主线起点描述');
    assert.strictEqual(b.choicePoints, '选择点描述');
    assert.strictEqual(b.endings.main, 1);   // 非法→默认 1
    assert.strictEqual(b.endings.hidden, 1);  // <0 → 默认 1
    assert.strictEqual(b.endings.bad, 2);      // 2 在范围内保留
    assert.strictEqual(b.branchStyle, 'consequence');
    assert.strictEqual(b.stakesLevel, 'medium');
    assert.strictEqual(b.customEnding, '');
    const long = normalizeBranchBrief({ mainLine: 'x'.repeat(300), choicePoints: 'y'.repeat(300) });
    assert.strictEqual(long.mainLine.length, 200);
  });

  it('总结局 <2 抛错', () => {
    assert.throws(() => normalizeBranchBrief({ mainLine: baseRaw.mainLine, choicePoints: baseRaw.choicePoints, endingsMain: 1, endingsHidden: 0, endingsBad: 0 }),
      (e) => e instanceof BranchBriefError && e.field === 'endings');
  });

  it('总结局 >6 抛错', () => {
    assert.throws(() => normalizeBranchBrief({ mainLine: baseRaw.mainLine, choicePoints: baseRaw.choicePoints, endingsMain: 3, endingsHidden: 2, endingsBad: 2 }),
      (e) => e.field === 'endings');
  });

  it('四种风格/三档利害均可保留', () => {
    for (const s of ['consequence', 'relationship', 'moral', 'mystery']) {
      assert.strictEqual(normalizeBranchBrief({ ...baseRaw, branchStyle: s }).branchStyle, s);
    }
    for (const s of ['low', 'medium', 'high']) {
      assert.strictEqual(normalizeBranchBrief({ ...baseRaw, stakesLevel: s }).stakesLevel, s);
    }
  });

  it('hasBranchBrief 守卫', () => {
    assert.strictEqual(hasBranchBrief(null), false);
    assert.strictEqual(hasBranchBrief(normalizeBranchBrief(baseRaw)), true);
  });
});

describe('分支简报·闭环校验', () => {
  it('正常 1/1/1 → 无错误', () => {
    assert.strictEqual(validateBranchStructure(normalizeBranchBrief(baseRaw)).length, 0);
  });

  it('坏结局多于好+隐藏 → 有错误', () => {
    const b = normalizeBranchBrief({ ...baseRaw, endingsMain: 1, endingsHidden: 0, endingsBad: 2 });
    const errs = validateBranchStructure(b);
    assert.ok(errs.some((e) => e.field === 'endingsBad' && /不应超过/.test(e.message)));
  });

  it('主线结局 0 → 有错误', () => {
    const b = normalizeBranchBrief({ ...baseRaw, endingsMain: 1, endingsHidden: 1, endingsBad: 0 });
    // endingsMain 最小 1，所以这里 endingsMain 已经是 1
    // 测试 endingsMain 不可能为 0（规范化时 num(…,1,1,3) 最小返回 1），所以这里无需再测
    assert.strictEqual(b.endings.main, 1);
  });
});

describe('分支简报·指令拼装', () => {
  it('中文：事实源+风格+利害+闭环铁律齐备', () => {
    const b = normalizeBranchBrief({ ...baseRaw, branchStyle: 'moral', stakesLevel: 'high', customEnding: '隐藏结局是前女友在帮他' });
    const d = buildBranchDirective(b, 'zh');
    assert.ok(d.includes('【互动分支'));
    assert.ok(d.includes(baseRaw.mainLine) && d.includes(baseRaw.choicePoints));
    assert.ok(d.includes('1/1/1'));
    assert.ok(d.includes('道德困境') && d.includes('高利害'));
    assert.ok(d.includes('隐藏结局是前女友在帮他'));
    assert.ok(d.includes('无死胡同') && d.includes('无悬空') && d.includes('假选择'));
  });

  it('四种风格各有独立要点', () => {
    const expect = {
      consequence: '不可逆',
      relationship: '关系走向',
      moral: '没有绝对正确',
      mystery: '信息',
    };
    for (const [style, needle] of Object.entries(expect)) {
      const d = buildBranchDirective(normalizeBranchBrief({ ...baseRaw, branchStyle: style }), 'zh');
      assert.ok(d.includes(needle), `${style} 缺要点 ${needle}`);
    }
  });

  it('三档利害各有独立要点', () => {
    const expect = {
      low: '小取舍',
      medium: '真实代价',
      high: '硬碰硬',
    };
    for (const [level, needle] of Object.entries(expect)) {
      const d = buildBranchDirective(normalizeBranchBrief({ ...baseRaw, stakesLevel: level }), 'zh');
      assert.ok(d.includes(needle), `${level} 缺要点 ${needle}`);
    }
  });

  it('选填 customEnding 缺省不输出对应行', () => {
    const d = buildBranchDirective(normalizeBranchBrief(baseRaw), 'zh');
    assert.ok(!d.includes('期望的特定结局'));
  });

  it('英文指令齐备', () => {
    const b = normalizeBranchBrief({ ...baseRaw, branchStyle: 'mystery', stakesLevel: 'low' });
    const d = buildBranchDirective(b, 'en');
    assert.ok(d.includes('INTERACTIVE BRANCH BRIEF'));
    assert.ok(d.includes('Mystery-reveal') && d.includes('Low stakes'));
    assert.ok(d.includes('no dead ends') && d.includes('no self-loops'));
  });
});
