const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  normalizeTrendBrief, hasTrendBrief, scanTrendRisk, buildTrendDirective, TrendBriefError,
} = require('../dist/engine/trend-brief.js');

const baseRaw = { trendName: 'xx话题刷屏', heatCore: '打工人对努力被截胡的集体憋屈，爽点在当场反击' };

describe('热点简报·规范化', () => {
  it('必填缺失抛 TrendBriefError 带 field', () => {
    assert.throws(() => normalizeTrendBrief({ heatCore: baseRaw.heatCore }), (e) => e instanceof TrendBriefError && e.field === 'trendName');
    assert.throws(() => normalizeTrendBrief({ trendName: 'xx' }), (e) => e.field === 'heatCore');
  });

  it('trim、非法枚举回退、超长截断', () => {
    const b = normalizeTrendBrief({
      trendName: '  xx话题  ', heatCore: baseRaw.heatCore,
      trendKind: 'wat', approach: 'haha',
      userAngle: ' a ', avoidElements: '  ',
    });
    assert.strictEqual(b.trendName, 'xx话题');
    assert.strictEqual(b.trendKind, 'social');
    assert.strictEqual(b.approach, 'formula_clone');
    assert.strictEqual(b.userAngle, 'a');
    assert.strictEqual(b.avoidElements, '');
    const long = normalizeTrendBrief({ trendName: 'x'.repeat(100), heatCore: 'y'.repeat(300) });
    assert.strictEqual(long.trendName.length, 60);
    assert.strictEqual(long.heatCore.length, 200);
  });

  it('合法四借法/四类型均可保留', () => {
    for (const approach of ['persona_spin', 'setting_remix', 'formula_clone', 'reversal']) {
      assert.strictEqual(normalizeTrendBrief({ ...baseRaw, approach }).approach, approach);
    }
    for (const trendKind of ['film', 'social', 'festival', 'industry']) {
      assert.strictEqual(normalizeTrendBrief({ ...baseRaw, trendKind }).trendKind, trendKind);
    }
  });

  it('hasTrendBrief 守卫', () => {
    assert.strictEqual(hasTrendBrief(null), false);
    assert.strictEqual(hasTrendBrief(normalizeTrendBrief(baseRaw)), true);
  });
});

describe('热点简报·侵权/舆情风险预检', () => {
  it('手机号/身份证号 → piiBlocks（类别不回原文）', () => {
    const r1 = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, userAngle: '联系当事人 13912345678' }), 'zh');
    assert.deepStrictEqual(r1.piiBlocks, ['手机号']);
    const r2 = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, heatCore: '有人晒出 11010119900307123X 的身份证' }), 'zh');
    assert.ok(r2.piiBlocks.includes('身份证号'));
    assert.strictEqual(r2.level, 'high');
  });

  it('数字串中的连号不误伤（年份/普通编号不触发手机）', () => {
    const r = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, userAngle: '故事发生在 2024 年，编号 10086' }), 'zh');
    assert.strictEqual(r.piiBlocks.length, 0);
  });

  it('灾难悲剧/未定性案件 → 高危信号带 advice（只预警不拦截）', () => {
    const r = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, heatCore: '地震遇难事件后家属的自救' }), 'zh');
    assert.strictEqual(r.piiBlocks.length, 0);
    assert.strictEqual(r.level, 'high');
    assert.ok(r.signals.some((s) => s.type === 'disaster' && /虚构/.test(s.advice)));
    const r2 = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, heatCore: '嫌疑人被捕后网友舆论反转' }), 'zh');
    assert.ok(r2.signals.some((s) => s.type === 'unresolved_case'));
  });

  it('6 字以上直接引用原台词 → direct_quote 信号', () => {
    const r = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, avoidElements: '不用「我命由我不由天」这句' }), 'zh');
    assert.ok(r.signals.some((s) => s.type === 'direct_quote'));
    // 短引号（4字）不算
    const r2 = scanTrendRisk(normalizeTrendBrief({ ...baseRaw, avoidElements: '不用「绝了」' }), 'zh');
    assert.strictEqual(r2.signals.some((s) => s.type === 'direct_quote'), false);
  });

  it('普通无风险简报：level low', () => {
    const r = scanTrendRisk(normalizeTrendBrief(baseRaw), 'zh');
    assert.strictEqual(r.level, 'low');
    assert.strictEqual(r.signals.length, 0);
  });

  it('泛指的「灾难/悲剧/灾后」也须命中（不只具体灾种）', () => {
    const r = scanTrendRisk(normalizeTrendBrief({ trendName: '灾后互助', heatCore: '一场灾难后普通人的互助，不写悲剧本身' }), 'zh');
    assert.strictEqual(r.signals.filter((s) => s.type === 'disaster').length, 1, '同类别只出一条信号');
  });

  it('英文词表与英文引号', () => {
    const r = scanTrendRisk(normalizeTrendBrief({ trendName: 'viral court topic', heatCore: 'the suspect arrested moment and public anger' }), 'en');
    assert.ok(r.signals.some((s) => s.type === 'unresolved_case'));
    const r2 = scanTrendRisk(normalizeTrendBrief({ trendName: 'viral quote', heatCore: 'people keep saying "this is exactly my life right now"' }), 'en');
    assert.ok(r2.signals.some((s) => s.type === 'direct_quote'));
  });
});

describe('热点简报·指令拼装', () => {
  it('中文：事实源+借法+规避+风控齐备，无风险时不出现强制虚构化段', () => {
    const b = normalizeTrendBrief({ ...baseRaw, approach: 'persona_spin', userAngle: '当场提案翻盘', avoidElements: '不用原剧角色名' });
    const d = buildTrendDirective(b, scanTrendRisk(b, 'zh'), 'zh');
    assert.ok(d.includes('【热点追更'));
    assert.ok(d.includes('xx话题刷屏') && d.includes(baseRaw.heatCore));
    assert.ok(d.includes('同人设衍生') && d.includes('名场面'));
    assert.ok(d.includes('当场提案翻盘') && d.includes('不用原剧角色名'));
    assert.ok(d.includes('热度退了剧不废'));
    assert.ok(!d.includes('强制虚构化'));
  });

  it('四借法各有独立指令要点', () => {
    const expect = {
      persona_spin: '不复演名场面',
      setting_remix: '独特情节序列',
      formula_clone: '连续 8 字',
      reversal: '不是苦难',
    };
    for (const [approach, needle] of Object.entries(expect)) {
      const d = buildTrendDirective(normalizeTrendBrief({ ...baseRaw, approach }), null, 'zh');
      assert.ok(d.includes(needle), `${approach} 缺要点 ${needle}`);
    }
  });

  it('高危信号 → 指令含逐条强制虚构化要求', () => {
    const b = normalizeTrendBrief({ ...baseRaw, heatCore: '地震遇难后普通人的互助' });
    const d = buildTrendDirective(b, scanTrendRisk(b, 'zh'), 'zh');
    assert.ok(d.includes('强制虚构化') && d.includes('灾难/悲剧/死亡事件'));
  });

  it('英文指令齐备', () => {
    const b = normalizeTrendBrief({ ...baseRaw, approach: 'reversal' });
    const d = buildTrendDirective(b, null, 'en');
    assert.ok(d.includes('TREND-CHASING BRIEF'));
    assert.ok(d.includes('Approach = reversal') && d.includes('stand on its own'));
  });
});
