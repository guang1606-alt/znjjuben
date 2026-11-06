// v2.388 场记连续性前置教学函数同源测试（TDD 先红）
// 与 src/engine/continuity-supervision-check.ts 检测口径 100% 同源
// 四类穿帮（伤势无痕/毁物复原/设备复活/束缚消失）+ 桥接正信号
// 断言策略：语义锚点定位唯一行后，行内断数字
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContinuitySupervisionDirective } = require('../dist/engine/continuity-supervision-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省走 LIVE 与 zh：标题、场记笔意象、类型名齐全', () => {
  const s = buildContinuitySupervisionDirective();
  assert.ok(s.includes('场记连续性'), '中文标题');
  assert.ok(s.includes('场记那支笔'), '场记那支笔意象');
  assert.ok(s.includes('injury_vanish'), '伤势无痕类型名');
});

test('2. 伤势无痕：中刀流血晕倒、1 次 mid、第 2 次起 high、min(次数×12,22)', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '伤势无痕（injury_vanish）');
  assert.ok(line.includes('中刀'), '中刀');
  assert.ok(line.includes('流血'), '流血');
  assert.ok(line.includes('晕倒'), '晕倒');
  assert.ok(line.includes('第 1 次 mid'), '1 次 mid');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('min(次数×12, 22)'), '扣分 min(次数×12,22)');
});

test('3. 毁物复原：撕碎烧毁后完好签字、mid、min(次数×11,20)', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '毁物复原（object_restored）');
  assert.ok(line.includes('撕碎'), '撕碎');
  assert.ok(line.includes('烧毁'), '烧毁');
  assert.ok(line.includes('完好'), '完好使用');
  assert.ok(line.includes('mid 扣 11 分'), 'mid 定级扣 11');
  assert.ok(line.includes('min(次数×11, 20)'), '扣分 min(次数×11,20)');
});

test('4. 设备复活：摔烂没电没收后拨通、首 1 次 low 扣 6、第 2 次起 mid、min(次数×9,16)', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '设备复活（device_resurrection）');
  assert.ok(line.includes('摔烂'), '摔烂');
  assert.ok(line.includes('没电'), '没电');
  assert.ok(line.includes('没收'), '没收');
  assert.ok(line.includes('首 1 次 low 扣 6 分'), '首 1 次 low 扣 6');
  assert.ok(line.includes('第 2 次起 mid'), '第 2 次起 mid');
  assert.ok(line.includes('min(次数×9, 16)'), '扣分 min(次数×9,16)');
});

test('5. 束缚消失：被绑被关后自由行动、第 1-2 次 low、第 3 次起 mid、min(次数×5,12)', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '束缚消失（restraint_vanish）');
  assert.ok(line.includes('被绑'), '被绑');
  assert.ok(line.includes('被关'), '被关');
  assert.ok(line.includes('第 1-2 次 low'), '1-2 次 low');
  assert.ok(line.includes('第 3 次起 mid'), '第 3 次起 mid');
  assert.ok(line.includes('每次扣 5 分'), '每次扣 5 分');
  assert.ok(line.includes('min(次数×5, 12)'), '扣分 min(次数×5,12)');
});

test('6. 桥接正信号：养伤痊愈/跳时/复印件备份/修好换新/挣脱被救 五次 +2 封顶 6', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '正信号 bridged');
  assert.ok(line.includes('痊愈'), '养伤痊愈');
  assert.ok(line.includes('跳时'), '跳时');
  assert.ok(line.includes('复印件'), '复印件备份');
  assert.ok(line.includes('修好'), '修好换新');
  assert.ok(line.includes('挣脱'), '挣脱被救');
  assert.ok(line.includes('+2 分/次封顶 6 分'), 'bridged +2/次封顶 6');
});

test('7. 跳时豁免：只清伤势与束缚，不污染物件与设备', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '跳时豁免');
  assert.ok(line.includes('伤势'), '清伤势');
  assert.ok(line.includes('束缚'), '清束缚');
  assert.ok(line.includes('物件'), '物件不清');
  assert.ok(line.includes('设备'), '设备不清');
  assert.ok(line.includes('不会自愈'), '物理毁坏不会自愈');
});

test('8. 判定顺序：切场→逐行状态机→四类判定→high→mid→low、场次', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '判定顺序：');
  assert.ok(line.includes('状态机'), '状态机推进');
  assert.ok(line.includes('high→mid→low'), 'high→mid→low 排序');
  assert.ok(line.includes('场次'), '再按场次');
});

test('9. 评分：clamp(100 - 扣分 + 加分,0,100)、无状态变更满分放行、不足 20 字放行', () => {
  const line = lineOf(buildContinuitySupervisionDirective('LIVE', 'zh'), '评分：');
  assert.ok(line.includes('clamp(100 - 扣分 + 加分, 0, 100)'), 'clamp 公式');
  assert.ok(line.includes('满分 100 放行'), '无信号满分放行');
  assert.ok(line.includes('不足 20 字'), '不足 20 字放行');
});

test('10. en 层：标题与四类类型名齐全，且零中文', () => {
  const s = buildContinuitySupervisionDirective('LIVE', 'en');
  assert.ok(s.includes('Continuity Supervision'), '英文标题');
  assert.ok(s.includes('injury_vanish'), 'injury_vanish');
  assert.ok(s.includes('object_restored'), 'object_restored');
  assert.ok(s.includes('device_resurrection'), 'device_resurrection');
  assert.ok(s.includes('restraint_vanish'), 'restraint_vanish');
  assert.ok(!/[\u4e00-\u9fa5]/.test(s), 'en 分支不得出现中文');
});

test('11. en 伤势与毁物：-12 capped at 22、2nd hit is high、-11 capped at 20', () => {
  const s = buildContinuitySupervisionDirective('LIVE', 'en');
  const inj = lineOf(s, 'Injury vanish (injury_vanish)');
  assert.ok(inj.includes('-12 points'), '-12');
  assert.ok(inj.includes('capped at 22'), '封顶 22');
  assert.ok(inj.includes('2nd hit is high'), '第 2 次 high');
  const obj = lineOf(s, 'Restored object (object_restored)');
  assert.ok(obj.includes('-11 points'), '-11');
  assert.ok(obj.includes('capped at 20'), '封顶 20');
});

test('12. en 设备/束缚/正信号/评分：6 then -9 capped 16、-5 capped 12、caps at 6、full 100 pass', () => {
  const s = buildContinuitySupervisionDirective('LIVE', 'en');
  const dev = lineOf(s, 'Resurrected device');
  assert.ok(dev.includes('low, -6 points'), '首 1 次 low -6');
  assert.ok(dev.includes('-9 points'), '-9');
  assert.ok(dev.includes('capped at 16'), '封顶 16');
  const res = lineOf(s, 'Vanished restraint');
  assert.ok(res.includes('-5 points'), '-5');
  assert.ok(res.includes('capped at 12'), '封顶 12');
  const pos = lineOf(s, 'Positive signal: bridged');
  assert.ok(pos.includes('caps at 6'), 'caps at 6');
  const scoring = lineOf(s, 'Scoring:');
  assert.ok(scoring.includes('full 100 pass'), '无信号满分放行');
  assert.ok(scoring.includes('under 20 characters'), '不足 20 字符放行');
});
