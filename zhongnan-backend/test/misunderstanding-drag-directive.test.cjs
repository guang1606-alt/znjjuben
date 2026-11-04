// v2.387 误会拖延前置教学函数同源测试（TDD 先红）
// 与 src/engine/misunderstanding-drag-check.ts 检测口径 100% 同源
// 四类问题（拒绝沟通/误会反复/有嘴不说/偷听定罪）+ resolved 正信号
// 断言策略：语义锚点定位唯一行后，行内断数字
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMisunderstandingDragDirective } = require('../dist/engine/misunderstanding-drag-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省走 LIVE 与 zh：标题、按头误会意象、类型名齐全', () => {
  const s = buildMisunderstandingDragDirective();
  assert.ok(s.includes('误会拖延'), '中文标题');
  assert.ok(s.includes('按头误会'), '按头误会意象');
  assert.ok(s.includes('refusal_to_listen'), '拒绝沟通类型名');
});

test('2. 拒绝沟通：3 行内拒听、当场或下一场澄清不算、1 次 mid 扣 14、第 2 次起 high、封顶 28', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '拒绝沟通（refusal_to_listen');
  assert.ok(line.includes('3 行内'), '3 行内拒听');
  assert.ok(line.includes('当场或紧邻下一场就澄清则不算'), '快速澄清豁免');
  assert.ok(line.includes('第 1 次 mid 扣 14 分'), '1 次 mid 扣 14');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('封顶 28 分'), '扣分封顶 28');
});

test('3. 误会反复：跨 ≥3 场未解、以首次澄清场为界、mid 扣 11、全文 1 条', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '误会反复（misunderstanding_repeat');
  assert.ok(line.includes('≥3 场'), '≥3 场未解');
  assert.ok(line.includes('以首次澄清场为界'), '首次澄清场为界');
  assert.ok(line.includes('mid 扣 11 分'), 'mid 扣 11');
  assert.ok(line.includes('全文只报 1 条'), '全文 1 条');
});

test('4. 有嘴不说：咽话 ≥2 次、low 扣 7、全文 1 条', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '有嘴不说（forced_silence');
  assert.ok(line.includes('≥2 次'), '≥2 次');
  assert.ok(line.includes('low 扣 7 分'), 'low 扣 7');
  assert.ok(line.includes('全文只报 1 条'), '全文 1 条');
});

test('5. 偷听定罪：只听到半句、每处 low 扣 6、最多 2 处、封顶 12', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '偷听定罪（half_truth_conviction');
  assert.ok(line.includes('只听到半句'), '只听到半句');
  assert.ok(line.includes('每处 low 扣 6 分'), '每处 low 扣 6');
  assert.ok(line.includes('最多报 2 处'), '最多 2 处');
  assert.ok(line.includes('封顶 12 分'), '扣分封顶 12');
});

test('6. 正信号 resolved：当场或下一场即澄清 +2/次封顶 6', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '正信号：resolved');
  assert.ok(line.includes('当场或紧邻下一场'), '当场或下一场澄清');
  assert.ok(line.includes('+2 分/次封顶 6 分'), 'resolved +2/次封顶 6');
});

test('7. 判定顺序：切场→逐场提取六类信号→四类判定→high→mid→low、场次', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '判定顺序：');
  assert.ok(line.includes('求解释/拒绝/误会/澄清/咽话/偷听'), '六类信号提取');
  assert.ok(line.includes('high→mid→low'), 'high→mid→low 排序');
  assert.ok(line.includes('场次'), '再按场次');
});

test('8. 评分：clamp(100 - 扣分 + 加分,0,100)、无信号满分放行、不足 20 字放行', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'zh'), '评分：');
  assert.ok(line.includes('clamp(100 - 扣分 + 加分, 0, 100)'), 'clamp 公式');
  assert.ok(line.includes('满分 100 放行'), '无信号满分放行');
  assert.ok(line.includes('不足 20 字'), '不足 20 字放行');
});

test('9. en 层：标题与四类类型名齐全，且零中文', () => {
  const s = buildMisunderstandingDragDirective('LIVE', 'en');
  assert.ok(s.includes('Misunderstanding Drag'), '英文标题');
  assert.ok(s.includes('refusal_to_listen'), 'refusal_to_listen');
  assert.ok(s.includes('misunderstanding_repeat'), 'misunderstanding_repeat');
  assert.ok(s.includes('forced_silence'), 'forced_silence');
  assert.ok(s.includes('half_truth_conviction'), 'half_truth_conviction');
  assert.ok(!/[\u4e00-\u9fa5]/.test(s), 'en 分支不得出现中文');
});

test('10. en 拒绝沟通：within 3 lines、-14 points、capped at 28、2nd hit is high', () => {
  const line = lineOf(buildMisunderstandingDragDirective('LIVE', 'en'), 'Refusal to listen (refusal_to_listen');
  assert.ok(line.includes('within 3 lines'), '3 行内拒听');
  assert.ok(line.includes('-14 points'), '-14');
  assert.ok(line.includes('capped at 28'), '封顶 28');
  assert.ok(line.includes('2nd hit is high'), '第 2 次 high');
});

test('11. en 误会反复与有嘴不说：3+ scenes、-11、one report only、2+ times、-7', () => {
  const s = buildMisunderstandingDragDirective('LIVE', 'en');
  const repeat = lineOf(s, 'Repeated misunderstanding');
  assert.ok(repeat.includes('3 or more scenes'), '≥3 场');
  assert.ok(repeat.includes('-11 points'), '-11');
  assert.ok(repeat.includes('one report only'), 'one report only');
  const silence = lineOf(s, 'Forced silence');
  assert.ok(silence.includes('2 or more times'), '≥2 次');
  assert.ok(silence.includes('-7 points'), '-7');
});

test('12. en 偷听/正信号/评分：-6 each、at most 2、capped at 12、caps at 6、full 100 pass、under 20 characters', () => {
  const s = buildMisunderstandingDragDirective('LIVE', 'en');
  const half = lineOf(s, 'Half-truth conviction');
  assert.ok(half.includes('-6 points each'), '-6 each');
  assert.ok(half.includes('at most 2 reports'), 'at most 2');
  assert.ok(half.includes('capped at 12'), '封顶 12');
  const pos = lineOf(s, 'Positive signal: resolved');
  assert.ok(pos.includes('caps at 6'), 'caps at 6');
  const scoring = lineOf(s, 'Scoring:');
  assert.ok(scoring.includes('full 100 pass'), '无信号满分放行');
  assert.ok(scoring.includes('under 20 characters'), '不足 20 字符放行');
});
