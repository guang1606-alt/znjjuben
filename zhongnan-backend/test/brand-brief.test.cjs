const { describe, it } = require('node:test');
const assert = require('node:assert');
const B = require('../dist/engine/brand-brief.js');

describe('品牌简报引擎·规范化', () => {
  it('trim + 缺省软性度 balanced + 空字段归一', () => {
    const b = B.normalizeBrandBrief({ brand: '  橘隐 ', sellingPoint: '0糖也有烘焙香  ' });
    assert.strictEqual(b.brand, '橘隐');
    assert.strictEqual(b.sellingPoint, '0糖也有烘焙香');
    assert.strictEqual(b.softness, 'balanced');
    assert.strictEqual(b.product, '');
    assert.strictEqual(B.hasBrandBrief(b), true);
  });
  it('品牌名缺失 / 卖点过短 → BrandBriefError 带 field', () => {
    assert.throws(() => B.normalizeBrandBrief({ brand: ' ', sellingPoint: '好喝' }), (e) => e.name === 'BrandBriefError' && e.field === 'brand');
    assert.throws(() => B.normalizeBrandBrief({ brand: '橘隐', sellingPoint: '香' }), (e) => e.name === 'BrandBriefError' && e.field === 'sellingPoint');
    assert.strictEqual(B.hasBrandBrief(null), false);
  });
  it('非法 softness 回退 balanced，合法档位透传；字段超长截断', () => {
    assert.strictEqual(B.normalizeBrandBrief({ brand: 'x', sellingPoint: '12', softness: 'nope' }).softness, 'balanced');
    assert.strictEqual(B.normalizeBrandBrief({ brand: 'x', sellingPoint: '12', softness: 'direct' }).softness, 'direct');
    const long = B.normalizeBrandBrief({ brand: 'x', sellingPoint: '卖'.repeat(200) });
    assert.ok(long.sellingPoint.length <= 120);
  });
});

describe('品牌简报引擎·广告词合规预检', () => {
  it('命中绝对化/功效/收益词，去重保序', () => {
    const hits = B.scanAdClaims('全网第一好喝，100%不胖，稳赚', 'zh');
    assert.deepStrictEqual(hits, ['全网第一', '100%', '稳赚']);
  });
  it('医疗功效词命中', () => {
    assert.deepStrictEqual(B.scanAdClaims('包治百病根治失眠', 'zh'), ['包治', '根治']);
  });
  it('“她第一次”不误伤（第一必须带限定短语）', () => {
    assert.deepStrictEqual(B.scanAdClaims('她第一次创业，最近店里很忙', 'zh'), []);
  });
  it('英文词表：#1 / risk-free / 100%', () => {
    const hits = B.scanAdClaims('The #1 choice, 100% safe, risk-free returns', 'en');
    assert.ok(hits.includes('#1') && hits.includes('100%') && hits.includes('risk-free'));
  });
  it('scanBrandBrief 只扫品牌字段拼接', () => {
    const b = B.normalizeBrandBrief({ brand: '神药堂', sellingPoint: '根治高血压' });
    assert.deepStrictEqual(B.scanBrandBrief(b, 'zh'), ['根治']);
  });
});

describe('品牌简报引擎·双语指令', () => {
  const b = B.normalizeBrandBrief({
    brand: '橘隐', product: '冷萃乌龙茶', sellingPoint: '0糖也有烘焙香',
    audience: '犯困上班族', memorySymbol: '开罐声「啵」', cta: '评论区领券',
    storyShell: '深夜办公室', softness: 'subtle',
  });
  it('中文指令：逐字品牌名/单一卖点/记忆符号/软性度/合规红线齐备', () => {
    const d = B.buildBrandDirective(b, 'zh');
    assert.ok(d.includes('橘隐') && d.includes('0糖也有烘焙香') && d.includes('开罐声「啵」'));
    assert.ok(d.includes('评论区领券') && d.includes('轻植入'));
    assert.ok(d.includes('唯一核心卖点') && d.includes('合规红线'));
    assert.ok(d.includes('深夜办公室') && d.includes('犯困上班族'));
  });
  it('英文指令零中文关键标签且含品牌名与 softness', () => {
    const d = B.buildBrandDirective(b, 'en');
    assert.ok(d.includes('橘隐') && d.includes('BRANDED-SKIT BRAND BIBLE'));
    assert.ok(d.includes('Subtle placement') && d.includes('single core selling point'));
  });
  it('选填字段缺省时不输出对应行（剧情外壳/人群可空）', () => {
    const d = B.buildBrandDirective(B.normalizeBrandBrief({ brand: '橘隐', sellingPoint: '好喝不胖' }), 'zh');
    assert.ok(!d.includes('目标人群') && !d.includes('剧情外壳'));
    assert.ok(d.includes('橘隐'));
  });
});
