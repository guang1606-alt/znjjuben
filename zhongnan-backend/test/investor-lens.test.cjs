const test = require('node:test');
const assert = require('node:assert');
const { investorLens, investorOneLiner, FUNDER_QUESTIONS } = require('../dist/engine/investor-lens');

test('资方视角四维齐备且权重排序：赛道>回收>投流>内容(门槛)', () => {
  const r = investorLens({ text: '一个普通的重生故事，有人设逻辑台词节奏', tags: ['重生'] });
  assert.strictEqual(r.dimensions.length, 4);
  const ids = r.dimensions.map((d) => d.id);
  assert.deepStrictEqual(ids, ['track', 'recoup', 'marketability', 'content']);
  assert.deepStrictEqual(r.dimensions.map((d) => d.rank), [1, 2, 3, 4]);
  const w = r.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(w - 1) < 1e-9, '权重合计为1');
  assert.ok(r.premise.includes('入场券'));
  assert.ok(FUNDER_QUESTIONS.length >= 8);
});

test('好本：有对标+低成本+回款模型+投流抓手 → STRONG 且无否决', () => {
  const r = investorLens({
    text: '重生复仇逆袭爆款对标红果登顶榜单破亿，女性向下沉受众盘，封闭场景室内现代装少量演员成本可控，分账投流ROI回本盈亏平衡回款清晰，前3秒强钩子打脸爽点高能切片付费卡点名场面冲突前置，人设逻辑台词节奏弧光自洽闭环',
    tags: ['重生', '复仇', '逆袭'],
  });
  assert.strictEqual(r.verdict, 'STRONG');
  assert.strictEqual(r.vetoes.length, 0);
  assert.ok(r.overall >= 75);
  // 前三决胜项都应高于内容门槛项，体现“内容不在前三”
  assert.ok(r.dimensions[0].score >= r.dimensions[3].score);
});

test('差本：无对标+高成本无回款+慢热 → PASS 且至少两条一票否决', () => {
  const r = investorLens({
    text: '一个前所未见没人拍过的全新世界观冷门小众实验自嗨故事，大量战争场面古装大场面群演实景拍摄海外取景爆破航拍，慢热铺垫长前三集平文艺片节奏平铺直叙',
  });
  assert.strictEqual(r.verdict, 'PASS');
  assert.ok(r.vetoes.length >= 2, '应触发成本回收与无对标两条否决');
  assert.ok(r.overall < 62);
});

test('政策/尺度风险一票否决，即使其他维度不错也 PASS', () => {
  const r = investorLens({
    text: '爆款对标重生逆袭，封闭场景成本可控分账回本，前3秒强钩子高能切片，但含涉政情节与未成年恋爱擦边软色情设定',
  });
  assert.strictEqual(r.verdict, 'PASS');
  assert.ok(r.vetoes.some((v) => v.includes('政策')));
});

test('空输入不崩，返回中性评估与必问清单', () => {
  const r = investorLens({ text: '', tags: [] });
  assert.ok(r.overall >= 0 && r.overall <= 100);
  assert.ok(Array.isArray(r.pitchTips) && r.pitchTips.length >= 1);
  assert.ok(investorOneLiner(r).includes('资方视角综合'));
});

test('分数恒在0-100，长文本不溢出', () => {
  const big = '对标爆款 '.repeat(500) + ' 大场面 '.repeat(500);
  const r = investorLens({ text: big });
  r.dimensions.forEach((d) => assert.ok(d.score >= 0 && d.score <= 100));
  assert.ok(r.overall >= 0 && r.overall <= 100);
});
