// v2.384 记忆诈欺结构前置教学函数同源测试（TDD 先红）
// 与 src/engine/memory-fakeout-check.ts 检测口径 100% 同源
// 四类问题（梦醒假反转/幻想无收束/闪回堆砌/重复闪回无新信息）+ 三正信号 + 豁免与继承规则
// 断言策略：先用语义锚点定位唯一行，再在行内断言数字（防同文数字跨行掩护）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMemoryFakeoutDirective } = require('../dist/engine/memory-fakeout-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省 format=undefined 走 LIVE、缺省 lang=undefined 走 zh 中文层', () => {
  const s = buildMemoryFakeoutDirective();
  assert.ok(s.includes('记忆诈欺结构'), '标题应为中文');
  assert.ok(s.includes('dream_fakeout'), '应出现梦醒假反转类型名');
  assert.ok(s.includes('不是诈骗工具'), '中文层应出现诈骗工具意象');
});

test('2. 梦醒假反转：8 行无入梦、10 行强戏剧、1 次 mid 扣 12、第 2 次起 high 封顶 22、最多报 2 条', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '梦醒假反转（dream_fakeout）');
  assert.ok(line.includes('8 行'), '8 行内无入梦标记');
  assert.ok(line.includes('10 行'), '10 行窗口内强戏剧');
  assert.ok(line.includes('第 1 次 mid 扣 12 分'), '1 次 mid 扣 12');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('封顶 22 分'), '扣分封顶 22');
  assert.ok(line.includes('最多报 2 条'), '最多报 2 条');
});

test('3. 幻想无收束：同行及 5 行内无收束、后 3 行内强戏剧、1 次 low 扣 6、第 2 次起 mid 扣 16、最多报 2 条', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '幻想无收束（hallucination_unbound）');
  assert.ok(line.includes('同行及 5 行内'), '同行及 5 行内无收束');
  assert.ok(line.includes('后 3 行内'), '后 3 行内含戏剧动作');
  assert.ok(line.includes('第 1 次 low 扣 6 分'), '1 次 low 扣 6');
  assert.ok(line.includes('第 2 次起 mid 扣 16 分'), '第 2 次起 mid 扣 16');
  assert.ok(line.includes('最多报 2 条'), '最多报 2 条');
});

test('4. 闪回堆砌：≥4 处 low 扣 7、≥6 处 mid 扣 11、全文只报 1 条、行距 ≤1 合并', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '闪回堆砌（flashback_overuse）');
  assert.ok(line.includes('≥4 处 low 扣 7 分'), '≥4 处 low 扣 7');
  assert.ok(line.includes('≥6 处 mid 扣 11 分'), '≥6 处 mid 扣 11');
  assert.ok(line.includes('全文只报 1 条'), '全文只报 1 条');
  assert.ok(line.includes('行距 ≤1'), '同场行距 ≤1 合并为一段');
});

test('5. 重复闪回无新信息：14 类词根、第 2 次起、每种 mid 扣 10、最多报 2 种、封顶 18、指代语行距 ≤10 继承', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '重复闪回无新信息（flashback_repeat）');
  assert.ok(line.includes('14 类词根'), '14 类词根指纹');
  assert.ok(line.includes('第 2 次起'), '第 2 次起判重复');
  assert.ok(line.includes('mid 扣 10 分'), '每种 mid 扣 10');
  assert.ok(line.includes('最多报 2 种'), '最多报 2 种');
  assert.ok(line.includes('封顶 18 分'), '扣分封顶 18');
  assert.ok(line.includes('行距 ≤10'), '指代语行距 ≤10 继承词根');
});

test('6. 正信号：markedDream +2 封顶 4 / fairRecall +2 封顶 4 / boundedFlash +1 封顶 3', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '正信号：markedDream');
  assert.ok(line.includes('+2 分/次封顶 4 分'), 'markedDream/fairRecall +2/次封顶 4');
  assert.ok(line.includes('fairRecall'), 'fairRecall 正信号');
  assert.ok(line.includes('boundedFlash'), 'boundedFlash 正信号');
  assert.ok(line.includes('+1 分/次封顶 3 分'), 'boundedFlash +1/次封顶 3');
  assert.ok(line.includes('前 3 行内最近一段'), '收束行归属前 3 行内最近一段');
});

test('7. 豁免：幻想 5 行内回神豁免、重复闪回有新信息豁免、成对入梦梦醒不判假反转', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '豁免：');
  assert.ok(line.includes('同行或后 5 行内'), '幻想段 5 行内回神豁免');
  assert.ok(line.includes('即豁免'), '收束/新信息出现即豁免');
  assert.ok(line.includes('不判假反转'), '成对入梦梦醒不判假反转');
});

test('8. 判定顺序：切场→打标→闪回段合并→四类判定→按 high→mid→low、场次、key 排序', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '判定顺序：');
  assert.ok(line.includes('切场'), '先按场标切场');
  assert.ok(line.includes('闪回段合并'), '闪回段合并');
  assert.ok(line.includes('high→mid→low'), '按 high→mid→low 排序');
  assert.ok(line.includes('场次'), '再按场次');
  assert.ok(line.includes('key'), '最后按 key');
});

test('9. 评分：clamp(100 - 扣分 + 加分,0,100)、无信号满分放行、空白或不足 20 字放行', () => {
  const line = lineOf(buildMemoryFakeoutDirective('LIVE', 'zh'), '评分：');
  assert.ok(line.includes('clamp(100 - 扣分 + 加分, 0, 100)'), 'clamp 公式');
  assert.ok(line.includes('满分 100 放行'), '无信号满分放行');
  assert.ok(line.includes('不足 20 字'), '空白或不足 20 字放行');
});

test('10. en 层：标题与四类类型名齐全，且零中文', () => {
  const s = buildMemoryFakeoutDirective('LIVE', 'en');
  assert.ok(s.includes('Memory Fake-Out'), '英文标题');
  assert.ok(s.includes('dream_fakeout'), 'dream_fakeout');
  assert.ok(s.includes('hallucination_unbound'), 'hallucination_unbound');
  assert.ok(s.includes('flashback_overuse'), 'flashback_overuse');
  assert.ok(s.includes('flashback_repeat'), 'flashback_repeat');
  assert.ok(!/[\u4e00-\u9fa5]/.test(s), 'en 分支不得出现中文');
});

test('11. en 层阈值：8/10 行、封顶 22、5/3 行、-6/-16、最多 2 条', () => {
  const s = buildMemoryFakeoutDirective('LIVE', 'en');
  const line = lineOf(s, 'Dream fake-out (dream_fakeout)');
  assert.ok(line.includes('8 lines'), '8 lines 无入梦');
  assert.ok(line.includes('10 lines'), '10 lines 强戏剧');
  assert.ok(line.includes('caps at 22 points'), '封顶 22');
  assert.ok(line.includes('at most 2'), '最多 2 条');
  const fantasy = lineOf(s, 'Unbound fantasy (hallucination_unbound)');
  assert.ok(fantasy.includes('within 5 lines'), '5 行内收束');
  assert.ok(fantasy.includes('within the next 3 lines'), '后 3 行戏剧');
  assert.ok(fantasy.includes('-6 points'), 'low -6');
  assert.ok(fantasy.includes('-16 points'), 'mid -16');
});

test('12. en 层豁免与评分：exempt、positive signals、full 100 pass、under 20 characters', () => {
  const s = buildMemoryFakeoutDirective('LIVE', 'en');
  const waiver = lineOf(s, 'Waivers:');
  assert.ok(waiver.includes('exempt'), '豁免可豁免');
  assert.ok(waiver.includes('positive signal'), '成对入梦算正信号');
  const scoring = lineOf(s, 'Scoring:');
  assert.ok(scoring.includes('full 100 pass'), '无信号满分放行');
  assert.ok(scoring.includes('under 20 characters'), '不足 20 字符放行');
});
