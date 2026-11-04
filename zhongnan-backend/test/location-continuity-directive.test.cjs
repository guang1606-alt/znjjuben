// v2.382 空间位移连续性前置教学函数同源测试（TDD 先红）
// 与 src/engine/location-continuity-check.ts 检测口径 100% 同源
// 三类问题（跨城瞬移/同场瞬移/内外景矛盾）+ 双重正信号 + 五条豁免
// 断言策略：先用语义锚点定位唯一行，再在行内断言数字（防同文数字跨行掩护）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLocationContinuityDirective } = require('../dist/engine/location-continuity-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省 format=undefined 走 LIVE、缺省 lang=undefined 走 zh 中文层', () => {
  const s = buildLocationContinuityDirective();
  assert.ok(s.includes('空间位移连续性'), '标题应为中文');
  assert.ok(s.includes('instant_travel'), '应出现跨城瞬移类型名');
  assert.ok(s.includes('人物不能'), '中文层应出现量子跃迁意象');
});

test('2. 跨城瞬移：1 次 mid 扣 12 分，第 2 次起 high，封顶 22 分', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '跨城瞬移（instant_travel）');
  assert.ok(line.includes('扣 12 分'), '1 次扣 12 分');
  assert.ok(line.includes('mid'), '1 次为 mid');
  assert.ok(line.includes('high'), '第 2 次起为 high');
  assert.ok(line.includes('22 分'), '封顶 22 分');
});

test('3. 同场瞬移：行距 ≤6，1 次 low 扣 6 分，第 2 次起 mid 扣 14 分', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '同场瞬移（location_jump）');
  assert.ok(line.includes('≤6'), '行距 ≤6');
  assert.ok(line.includes('扣 6 分'), '1 次扣 6 分');
  assert.ok(line.includes('low'), '1 次为 low');
  assert.ok(line.includes('扣 14 分'), '第 2 次起扣 14 分');
  assert.ok(line.includes('mid'), '第 2 次起为 mid');
});

test('4. 内外景矛盾：每处 low 扣 5 分，封顶 10 分', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '内外景矛盾（set_conflict）');
  assert.ok(line.includes('扣 5 分'), '每处扣 5 分');
  assert.ok(line.includes('封顶 10 分'), '封顶 10 分');
  assert.ok(line.includes('low'), '严重度为 low');
});

test('5. 正信号：fairTravel +2/对封顶 4；transition +1/次封顶 3', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '正信号：fairTravel');
  assert.ok(line.includes('+2 分/对'), 'fairTravel +2/对');
  assert.ok(line.includes('封顶 4 分'), 'fairTravel 封顶 4');
  assert.ok(line.includes('+1 分/次'), 'transition +1/次');
  assert.ok(line.includes('封顶 3 分'), 'transition 封顶 3');
});

test('6. 豁免一：时间跳变 / 交通桥接计入 fairTravel，不判跨城瞬移', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '豁免一');
  assert.ok(line.includes('次日'), '时间跳变锚点');
  assert.ok(line.includes('三天后'), '时间跳变锚点');
  assert.ok(line.includes('飞机'), '交通桥接锚点');
  assert.ok(line.includes('高铁'), '交通桥接锚点');
  assert.ok(line.includes('fairTravel'), '归入 fairTravel');
});

test('7. 豁免二：在场途中场标（飞机上/高铁上/车里/途中）豁免跨城对', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '豁免二');
  assert.ok(line.includes('飞机上'), '在途锚点');
  assert.ok(line.includes('高铁上'), '在途锚点');
  assert.ok(line.includes('车里'), '在途锚点');
  assert.ok(line.includes('豁免'), '明确豁免语义');
});

test('8. 豁免三：否定短语撤掉对应室内类（家门口/公司门口/医院门口/校门口）', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '豁免三');
  assert.ok(line.includes('家门口'), 'home 否定');
  assert.ok(line.includes('公司门口'), 'office 否定');
  assert.ok(line.includes('医院门口'), 'hospital 否定');
  assert.ok(line.includes('校门口'), 'school 否定');
});

test('9. 豁免四：隔窗观望不算身处室外', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '豁免四');
  assert.ok(line.includes('窗外'), '隔窗锚点');
  assert.ok(line.includes('隔着窗'), '隔窗锚点');
  assert.ok(line.includes('玻璃后'), '隔窗锚点');
  assert.ok(line.includes('不判内外景矛盾'), '明确豁免语义');
});

test('10. 豁免五：行距 >6 不判同场瞬移；转场词锚点重置空间', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '豁免五');
  assert.ok(line.includes('>6'), '行距 >6 豁免');
  assert.ok(line.includes('转场词'), '转场词重置');
  assert.ok(line.includes('走出'), '转场词锚点');
  assert.ok(line.includes('切到'), '转场词锚点');
});

test('11. 判定顺序与每场最多 1 对同场矛盾 + 排序 high→mid→low', () => {
  const line = lineOf(buildLocationContinuityDirective('LIVE', 'zh'), '判定顺序');
  assert.ok(line.includes('每场最多报 1 对'), '每场最多 1 对');
  assert.ok(line.includes('high→mid→low'), '排序 high→mid→low');
  assert.ok(line.includes('切场'), '先切场');
});

test('12. en 层零中文 + 三类英文锚点 + 数字阈值', () => {
  const s = buildLocationContinuityDirective('LIVE', 'en');
  const cjk = s.match(/[\u4e00-\u9fa5]/g);
  assert.ok(!cjk, 'en 层零 CJK 字符');
  const low = s.toLowerCase();
  assert.ok(low.includes('instant travel'), 'instant_travel 英文锚点');
  assert.ok(low.includes('location jump'), 'location_jump 英文锚点');
  assert.ok(low.includes('set conflict'), 'set_conflict 英文锚点');
  assert.ok(low.includes('fairtravel'), 'fairTravel 英文锚点');
  assert.ok(s.includes('-12 points'), '1 次扣 12 英文');
  assert.ok(s.includes('-6 points'), '同场扣 6 英文');
  assert.ok(s.includes('-5 points'), '内外景扣 5 英文');
  assert.ok(s.includes('caps at 22'), '封顶 22 英文');
  assert.ok(s.includes('caps at 10'), '封顶 10 英文');
});
