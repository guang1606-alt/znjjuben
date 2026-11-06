// v2.389 因果逻辑链前置教学函数同源测试（TDD 先红）
// 与 src/engine/causal-logic-check.ts 检测口径 100% 同源
// 六类问题（巧合过载/巧合解决/机械降神/因果稀薄/誓言烂尾/信息空降）
// 断言策略：语义锚点定位唯一行后，行内断数字
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCausalLogicDirective } = require('../dist/engine/causal-logic-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省走 LIVE 与 zh：标题、逻辑不能放假意象、六类型名齐全', () => {
  const s = buildCausalLogicDirective();
  assert.ok(s.includes('因果逻辑链'), '中文标题');
  assert.ok(s.includes('逻辑不能放假'), '逻辑放假意象');
  assert.ok(s.includes('coincidence_overload'), '巧合过载类型名');
  assert.ok(s.includes('deus_ex_machina'), '机械降神类型名');
});

test('2. 巧合过载：≥3 处、超出 2 处 × 12、high', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '巧合过载（coincidence_overload');
  assert.ok(line.includes('≥3 处'), '≥3 处巧合触发');
  assert.ok(line.includes('超出 2 处每多一处扣 12 分'), '超出 2 处 × 12');
  assert.ok(line.includes('high'), 'severity high');
});

test('3. 巧合解决：尾段 ≥ 60%、巧合 ≥ 1、payoff=0 或 causation ≤ 2、+20、high', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '巧合解决（coincidence_resolution');
  assert.ok(line.includes('尾段'), '尾段判定');
  assert.ok(line.includes('60%'), '60% 位置阈值');
  assert.ok(line.includes('causation ≤ 2'), 'causation ≤ 2 条件');
  assert.ok(line.includes('+20 分'), '巧合解决 +20 分');
  assert.ok(line.includes('high'), 'severity high');
});

test('4. 机械降神：救兵/贵人/援兵 ≥ 1、+25、high、救援必须提前铺垫', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '机械降神（deus_ex_machina');
  assert.ok(line.includes('救兵'), '救兵信号');
  assert.ok(line.includes('贵人'), '贵人信号');
  assert.ok(line.includes('援兵'), '援兵信号');
  assert.ok(line.includes('≥ 1 处'), '≥ 1 处触发');
  assert.ok(line.includes('+25 分'), '机械降神 +25 分');
  assert.ok(line.includes('high'), 'severity high');
});

test('5. 因果稀薄：sudden+seq ≥ 4、ratio < 0.25、+15、mid、健康比 ≥ 0.4', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '因果稀薄（thin_causation');
  assert.ok(line.includes('≥ 4 次'), 'sudden+seq ≥ 4 次');
  assert.ok(line.includes('< 0.25'), 'ratio < 0.25');
  assert.ok(line.includes('+15 分'), '因果稀薄 +15 分');
  assert.ok(line.includes('mid'), 'severity mid');
  assert.ok(line.includes('≥ 0.4'), '健康比 ≥ 0.4');
});

test('6. 誓言烂尾：oath ≥ 2、payoff=0、+10、mid、至少 1 个 oath 驱动行动', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '誓言烂尾（unresolved_oath');
  assert.ok(line.includes('≥ 2 个'), 'oath ≥ 2 个');
  assert.ok(line.includes('payoff = 0'), 'payoff = 0');
  assert.ok(line.includes('+10 分'), '誓言烂尾 +10 分');
  assert.ok(line.includes('mid'), 'severity mid');
});

test('7. 信息空降：unsourced ≥ 2、causation < 2、+10、mid、补获知场景或推理', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '信息空降（unsourced_knowledge');
  assert.ok(line.includes('≥ 2 处'), 'unsourced ≥ 2 处');
  assert.ok(line.includes('< 2'), 'causation < 2');
  assert.ok(line.includes('+10 分'), '信息空降 +10 分');
  assert.ok(line.includes('mid'), 'severity mid');
});

test('8. 判定顺序：六类问题按 high→mid 排序', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '判定顺序：');
  assert.ok(line.includes('巧合过载'), '巧合过载第一');
  assert.ok(line.includes('巧合解决'), '巧合解决第二');
  assert.ok(line.includes('机械降神'), '机械降神第三');
  assert.ok(line.includes('因果稀薄'), '因果稀薄第四');
  assert.ok(line.includes('誓言烂尾'), '誓言烂尾第五');
  assert.ok(line.includes('信息空降'), '信息空降第六');
});

test('9. 评分：clamp(100 - penalty,0,100)、零问题满分 100、无信号满分放行', () => {
  const line = lineOf(buildCausalLogicDirective('LIVE', 'zh'), '评分：');
  assert.ok(line.includes('clamp(100 - penalty, 0, 100)'), 'clamp 公式');
  assert.ok(line.includes('满分 100 放行'), '无信号满分放行');
});

test('10. en 层：标题与六类型名齐全，且零中文', () => {
  const s = buildCausalLogicDirective('LIVE', 'en');
  assert.ok(s.includes('Causal Logic'), '英文标题');
  assert.ok(s.includes('coincidence_overload'), 'coincidence_overload');
  assert.ok(s.includes('coincidence_resolution'), 'coincidence_resolution');
  assert.ok(s.includes('deus_ex_machina'), 'deus_ex_machina');
  assert.ok(s.includes('thin_causation'), 'thin_causation');
  assert.ok(s.includes('unresolved_oath'), 'unresolved_oath');
  assert.ok(s.includes('unsourced_knowledge'), 'unsourced_knowledge');
  assert.ok(!/[\u4e00-\u9fa5]/.test(s), 'en 分支不得出现中文');
});

test('11. en 阈值：-12 per extra、at 60%、+20、+25、+15、+10', () => {
  const s = buildCausalLogicDirective('LIVE', 'en');
  const over = lineOf(s, 'Coincidence overload');
  assert.ok(over.includes('-12 per extra'), '-12 per extra');
  const res = lineOf(s, 'Coincidence resolution');
  assert.ok(res.includes('60%'), '60% tail');
  assert.ok(res.includes('+20 points'), '+20');
  const deus = lineOf(s, 'Deus ex machina');
  assert.ok(deus.includes('+25 points'), '+25');
  const thin = lineOf(s, 'Thin causation');
  assert.ok(thin.includes('< 0.25'), 'ratio < 0.25');
  assert.ok(thin.includes('+15 points'), '+15');
  const oath = lineOf(s, 'Unresolved oath');
  assert.ok(oath.includes('+10 points'), '+10');
  const unsrc = lineOf(s, 'Unsourced knowledge');
  assert.ok(unsrc.includes('+10 points'), '+10');
});

test('12. en 健康比 0.4、至少 1 oath drives action、no causal = 0 penalty', () => {
  const s = buildCausalLogicDirective('LIVE', 'en');
  const thin = lineOf(s, 'Thin causation');
  assert.ok(thin.includes('0.4'), 'healthy ratio 0.4');
  const oath = lineOf(s, 'Unresolved oath');
  assert.ok(oath.includes('at least one oath'), 'at least one oath drives');
  const scoring = lineOf(s, 'Scoring:');
  assert.ok(scoring.includes('full 100 pass'), 'no issue full 100');
});
