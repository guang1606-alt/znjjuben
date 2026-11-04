// v2.383 情绪余波连续性前置教学函数同源测试（TDD 先红）
// 与 src/engine/emotional-aftermath-check.ts 检测口径 100% 同源
// 三类问题（秒清零/丧亲无消化/鸡汤秒治愈）+ 三正信号 + 三豁免 + 聚类与贴尾规则
// 断言策略：先用语义锚点定位唯一行，再在行内断言数字（防同文数字跨行掩护）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEmotionalAftermathDirective } = require('../dist/engine/emotional-aftermath-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省 format=undefined 走 LIVE、缺省 lang=undefined 走 zh 中文层', () => {
  const s = buildEmotionalAftermathDirective();
  assert.ok(s.includes('情绪余波连续性'), '标题应为中文');
  assert.ok(s.includes('instant_reset'), '应出现秒清零类型名');
  assert.ok(s.includes('情绪不能'), '中文层应出现三行清零意象');
});

test('2. 情绪秒清零：10 行窗口、1 次 mid 扣 12、第 2 次起 high 封顶 22、最多报 2 条', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '情绪秒清零（instant_reset）');
  assert.ok(line.includes('10 行'), '10 行窗口');
  assert.ok(line.includes('扣 12 分'), '1 次扣 12 分');
  assert.ok(line.includes('mid'), '1 次为 mid');
  assert.ok(line.includes('high'), '第 2 次起为 high');
  assert.ok(line.includes('封顶 22 分'), '封顶 22 分');
  assert.ok(line.includes('最多报 2 条'), '最多报 2 条');
});

test('3. 丧亲无消化：≥8 行、mid 扣 14、全文只报 1 条、贴结尾不苛求', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '丧亲无消化（unprocessed_loss）');
  assert.ok(line.includes('≥8 行'), '至少 8 行正文');
  assert.ok(line.includes('扣 14 分'), 'mid 扣 14 分');
  assert.ok(line.includes('只报 1 条'), '全文只报 1 条');
  assert.ok(line.includes('不苛求'), '贴结尾不苛求');
});

test('4. 鸡汤秒治愈：4 行内劝慰、3 行内振作、low 扣 6、第 2 次起 mid 扣 14、同场连续崩溃只算 1 次', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '鸡汤秒治愈（quick_comfort）');
  assert.ok(line.includes('4 行内'), '4 行内出现劝慰');
  assert.ok(line.includes('3 行内'), '3 行内立刻振作');
  assert.ok(line.includes('扣 6 分'), '1 次 low 扣 6');
  assert.ok(line.includes('扣 14 分'), '第 2 次起 mid 扣 14');
  assert.ok(line.includes('行距 ≤3'), '同场连续崩溃行距 ≤3');
});

test('5. 正信号：griefCarry +2 封顶 4 / timeHeal +1 封顶 2 / healthyComfort +1 封顶 2', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '正信号：griefCarry');
  assert.ok(line.includes('+2 分/次'), 'griefCarry +2/次');
  assert.ok(line.includes('封顶 4 分'), 'griefCarry 封顶 4');
  assert.ok(line.includes('+1 分/次'), 'timeHeal/healthyComfort +1/次');
  assert.ok(line.includes('封顶 2 分'), 'timeHeal/healthyComfort 封顶 2');
  assert.ok(line.includes('隔 6 行'), 'healthyComfort 隔 6 行以上');
});

test('6. 豁免一：装死/演戏/排练/梦境在锚点 ±1 行内整个事件豁免', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '豁免一');
  assert.ok(line.includes('装死'), '装死豁免');
  assert.ok(line.includes('演戏'), '演戏豁免');
  assert.ok(line.includes('梦境'), '梦境豁免');
  assert.ok(line.includes('±1 行'), '锚点 ±1 行');
});

test('7. 豁免二/排除项：恶意笑与苦笑/含泪笑不算情绪恢复', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '豁免二/排除项');
  assert.ok(line.includes('冷笑'), '恶意笑锚点');
  assert.ok(line.includes('苦笑'), '苦笑锚点');
  assert.ok(line.includes('含泪笑'), '含泪笑锚点');
  assert.ok(line.includes('不算情绪恢复'), '明确排除语义');
});

test('8. 豁免三：创伤事件行距 ≤2 相邻行合并为同一锚点', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '豁免三');
  assert.ok(line.includes('行距 ≤2'), '聚类行距 ≤2');
  assert.ok(line.includes('合并'), '合并语义');
  assert.ok(line.includes('同一锚点'), '同一锚点');
});

test('9. 判定顺序：先按场标切场，问题按 high→mid→low、场次、key 排序', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '判定顺序');
  assert.ok(line.includes('先按场标切场'), '先切场');
  assert.ok(line.includes('high→mid→low'), '严重度排序');
  assert.ok(line.includes('key'), 'key 兜底排序');
});

test('10. 评分口径：clamp(100 - 扣分 + 加分, 0, 100)，无创伤满分、空白或不足 20 字满分放行', () => {
  const line = lineOf(buildEmotionalAftermathDirective('LIVE', 'zh'), '评分：score');
  assert.ok(line.includes('clamp(100 - 扣分 + 加分, 0, 100)'), '评分公式');
  assert.ok(line.includes('满分 100'), '无创伤满分');
  assert.ok(line.includes('20 字'), '不足 20 字满分');
});

test('11. 三类问题各带可执行处理动作', () => {
  const zh = buildEmotionalAftermathDirective('LIVE', 'zh');
  assert.ok(lineOf(zh, '情绪秒清零（instant_reset）').includes('补一个克制的余波节拍'), '秒清零处理动作');
  assert.ok(lineOf(zh, '丧亲无消化（unprocessed_loss）').includes('补一个悼念节拍'), '丧亲处理动作');
  assert.ok(lineOf(zh, '鸡汤秒治愈（quick_comfort）').includes('让劝慰被顶回来'), '鸡汤处理动作');
});

test('12. en 层零中文 + 三类英文锚点 + 正信号 + 数字阈值', () => {
  const s = buildEmotionalAftermathDirective('LIVE', 'en');
  const cjk = s.match(/[\u4e00-\u9fa5]/g);
  assert.ok(!cjk, 'en 层零 CJK 字符');
  const low = s.toLowerCase();
  assert.ok(low.includes('instant reset'), 'instant_reset 英文锚点');
  assert.ok(low.includes('unprocessed loss'), 'unprocessed_loss 英文锚点');
  assert.ok(low.includes('one-line cure'), 'quick_comfort 英文锚点');
  assert.ok(low.includes('griefcarry'), 'griefCarry 英文锚点');
  assert.ok(low.includes('timeheal'), 'timeHeal 英文锚点');
  assert.ok(low.includes('healthycomfort'), 'healthyComfort 英文锚点');
  assert.ok(s.includes('-12 points'), '1 次扣 12 英文');
  assert.ok(s.includes('-14 points'), '扣 14 英文');
  assert.ok(s.includes('-6 points'), '扣 6 英文');
  assert.ok(s.includes('caps at 22'), '封顶 22 英文');
});
