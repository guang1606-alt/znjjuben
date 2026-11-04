// v2.381 对白功能性前置教学函数同源测试（TDD 先红）
// 与 src/engine/dialogue-functionality-check.ts 检测口径 100% 同源
// 四功能分布 + 八条硬线 + 均衡带 + 偏差扣分
// 断言策略：先用语义锚点定位唯一行，再在行内断言数字（防同文数字跨行掩护）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDialogueFunctionalityDirective } = require('../dist/engine/dialogue-functionality-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省 format=undefined 走 LIVE、缺省 lang=undefined 走 zh 中文层', () => {
  const s = buildDialogueFunctionalityDirective();
  assert.ok(s.includes('对白功能'), '标题应为中文');
  assert.ok(s.includes('plot'), '应出现 plot 函数名');
  assert.ok(s.includes('塑造人物'), '中文层应出现"塑造人物"');
});

test('2. LIVE 格式（默认）八条硬线四类语义锚点均生效、不设门控（全制式）', () => {
  const s = buildDialogueFunctionalityDirective('LIVE', 'zh');
  assert.ok(s.includes('塑造缺失'), 'character 缺失锚点');
  assert.ok(s.includes('信息倾倒'), 'info 过载锚点');
  assert.ok(s.includes('冲突真空'), 'conflict 缺失锚点');
  assert.ok(s.includes('剧情过载'), 'plot 过载锚点');
});

test('3. 塑造缺失：character <10%，high 扣 12 分，每场补 2-3 句', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '塑造缺失');
  assert.ok(line.includes('<10%'), '阈值 <10%');
  assert.ok(line.includes('扣 12'), 'high 扣 12');
  assert.ok(line.includes('2-3 句'), '补 2-3 句');
});

test('4. 信息倾倒：info >35%，high 扣 12 分', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '信息倾倒（info');
  assert.ok(line.includes('>35%'), '阈值 >35%');
  assert.ok(line.includes('扣 12'), 'high 扣 12');
});

test('5. 冲突真空：conflict <10%，high 扣 12 分', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '冲突真空（conflict');
  assert.ok(line.includes('<10%'), '阈值 <10%');
  assert.ok(line.includes('扣 12'), 'high 扣 12');
});

test('6. 剧情过载：plot >70%，mid 扣 5 分，每 5-6 句插 1-2 句', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '剧情过载');
  assert.ok(line.includes('>70%'), '阈值 >70%');
  assert.ok(line.includes('扣 5'), 'mid 扣 5');
  assert.ok(line.includes('5-6 句'), '每 5-6 句');
});

test('7. 单场信息倾倒：单场 >50% 且 ≥3 句，1 场 mid 扣 5 / ≥2 场 high 扣 12', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '单场信息倾倒');
  assert.ok(line.includes('>50%'), '单场阈值 >50%');
  assert.ok(line.includes('≥3 句'), '该场 ≥3 句');
  assert.ok(line.includes('扣 5'), '1 场 mid 扣 5');
  assert.ok(line.includes('扣 12'), '≥2 场 high 扣 12');
});

test('8. 连续冲突真空：≥2 场 <10% 且该场 ≥3 句，mid 扣 5 分', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '连续冲突真空');
  assert.ok(line.includes('≥2 场'), '≥2 场');
  assert.ok(line.includes('<10%'), '该场 <10%');
  assert.ok(line.includes('扣 5'), 'mid 扣 5');
});

test('9. 角色功能单一：>80% 且 ≥5 句，每只扣 3 分（1 只 low / ≥2 只 mid）', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '角色功能单一');
  assert.ok(line.includes('>80%'), '阈值 >80%');
  assert.ok(line.includes('≥5 句'), '该角色 ≥5 句');
  assert.ok(line.includes('扣 3'), '每只扣 3');
});

test('10. 无功能对白过多：other >30%，mid 扣 5 分', () => {
  const line = lineOf(buildDialogueFunctionalityDirective('LIVE', 'zh'), '无功能对白');
  assert.ok(line.includes('>30%'), '阈值 >30%');
  assert.ok(line.includes('扣 5'), 'mid 扣 5');
});

test('11. 均衡带四维区间 + 中心值 + 偏差封顶 40', () => {
  const s = buildDialogueFunctionalityDirective('LIVE', 'zh');
  assert.ok(s.includes('25%~60%'), 'plot 带 25%~60%');
  assert.ok(s.includes('10%~45%'), 'character/conflict 带 10%~45%');
  assert.ok(s.includes('5%~35%'), 'info 带 5%~35%');
  assert.ok(s.includes('42.5%'), 'plot 中心 42.5%');
  assert.ok(s.includes('封顶 40'), '偏差扣分封顶 40');
});

test('12. en 层零中文 + 八条硬线英文锚点 + 数字阈值', () => {
  const s = buildDialogueFunctionalityDirective('LIVE', 'en');
  const cjk = s.match(/[\u4e00-\u9fa5]/g);
  assert.ok(!cjk, 'en 层零 CJK 字符');
  const low = s.toLowerCase();
  assert.ok(low.includes('character-building'), 'character 英文锚点');
  assert.ok(low.includes('info-dump'), 'info-dump 英文锚点');
  assert.ok(low.includes('conflict vacuum') || low.includes('conflict-vacuum'), 'conflict 英文锚点');
  assert.ok(low.includes('plot overload'), 'plot 过载英文锚点');
  assert.ok(low.includes('monotone'), 'monotone 英文锚点');
  assert.ok(low.includes('no-function'), 'no-function 英文锚点');
  assert.ok(s.includes('12 points'), 'high 扣 12 英文');
  assert.ok(s.includes('5 points'), 'mid 扣 5 英文');
  assert.ok(s.includes('3 points'), '单调扣 3 英文');
  assert.ok(s.includes('25%-60%'), 'plot 带英文');
});
