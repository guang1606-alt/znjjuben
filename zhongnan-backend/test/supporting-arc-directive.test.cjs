// v2.380 配角弧光前置教学函数同源测试（TDD 先红）
// 与 src/engine/supporting-arc-check.ts 检测口径 100% 同源
// 三条硬线：static_supporting / abrupt_conversion / no_choice_passive
// + bonus arc 每个回补 2 分封顶 6
// + clamp(100 - penalty + bonus)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSupportingArcDirective } = require('../dist/engine/supporting-arc-check.js');

test('1. 缺省 format=undefined 走 LIVE 门控、缺省 lang=undefined 走 zh 中文层', () => {
  const s = buildSupportingArcDirective();
  assert.ok(s.includes('配角弧光'), '标题应为中文');
  assert.ok(s.includes('static'), '内部关键词应小写');
  assert.ok(s.includes('弧光'), '中文层应出现"弧光"');
});

test('2. LIVE 格式（默认）三条硬线均生效、不设门控（全制式）', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  // 三条硬线的语义锚点（不是仅靠数字，避免同文复用互相掩护）
  assert.ok(s.includes('零变化配角'), 'static 硬线语义锚点');
  assert.ok(s.includes('无铺垫倒戈'), 'abrupt 硬线语义锚点');
  assert.ok(s.includes('全程被动应答'), 'passive 硬线语义锚点');
});

test('3. static_supporting high：≥2 配角全程单一态度，扣 20 分封顶', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  // 语义锚点："≥2 配角" + "扣 20 分"（两处都要命中，防止同文数字掩护）
  assert.ok(s.includes('≥2'), '≥2 配角语义锚点');
  assert.ok(s.includes('扣 20'), '扣 20 分数字锚点');
  assert.ok(s.includes('单一态度'), '单一态度语义锚点');
  // 阈值：≥5 句 + ≥70% 极性占比
  assert.ok(s.includes('5 句'), '触发阈值 5 句锚点');
  assert.ok(s.includes('70%'), '极性占比 70% 锚点');
});

test('4. abrupt_conversion high：≥2 配角无铺垫倒戈，扣 24 分封顶', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  assert.ok(s.includes('无铺垫'), '无铺垫语义锚点');
  assert.ok(s.includes('扣 24'), '扣 24 分数字锚点');
  assert.ok(s.includes('翻转前'), '翻转前语义锚点');
  // 阈值：前段一边倒≥60%≥2行 + 末两句全翻
  assert.ok(s.includes('60%'), '前段一边倒 60% 锚点');
  assert.ok(s.includes('末两句'), '末两句全翻锚点');
});

test('5. no_choice_passive low：全程被动应答无主张，扣 8 分封顶', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  assert.ok(s.includes('被动应答'), '被动应答语义锚点');
  assert.ok(s.includes('扣 8'), '扣 8 分数字锚点');
  assert.ok(s.includes('无主张'), '无主张语义锚点');
  // 阈值：≥4 句 + agency=0 + 短应答比≥75%
  assert.ok(s.includes('4 句'), '触发阈值 4 句锚点');
  assert.ok(s.includes('75%'), '短应答比 75% 锚点');
});

test('6. bonus 口径：arc 有铺垫转变每个配角回补 2 分，封顶 6', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  assert.ok(s.includes('回补 2'), '回补 2 分数字锚点');
  assert.ok(s.includes('封顶 6'), '封顶 6 数字锚点');
  assert.ok(s.includes('有铺垫转变'), '有铺垫转变语义锚点');
});

test('7. 豁免口径：硬对手位（报警/起诉/动手）豁免 static 检测', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  assert.ok(s.includes('豁免'), '豁免语义锚点');
  assert.ok(s.includes('报警'), '报警关键词锚点');
  assert.ok(s.includes('起诉'), '起诉关键词锚点');
});

test('8. 主角识别口径：优先 cast 第一个 key，无 cast 按对白字数最多者', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  assert.ok(s.includes('第一个'), 'cast 第一个 key 锚点');
  assert.ok(s.includes('对白字数'), '对白字数锚点');
});

test('9. 参检配角口径：≥4 句台词、非主角', () => {
  const s = buildSupportingArcDirective('LIVE', 'zh');
  assert.ok(s.includes('≥4 句'), '参检阈值 4 句锚点');
  assert.ok(s.includes('非主角'), '非主角锚点');
});

test('10. en 层零中文，三条英文硬线全部出现', () => {
  const s = buildSupportingArcDirective('LIVE', 'en');
  // 零中文：全串应无 CJK 字符
  const cjk = s.match(/[\u4e00-\u9fa5]/g);
  assert.ok(!cjk, 'en 层零 CJK 字符');
  // 三条硬线英文关键词
  assert.ok(s.includes('one-note'), 'static 英文锚点 one-note');
  assert.ok(s.includes('flips'), 'abrupt 英文锚点 flips');
  assert.ok(s.includes('never makes'), 'passive 英文锚点 never makes');
});

test('11. en 层数字与阈值：20/24/8 扣分 + 60%/70%/75% 阈值 + bonus 2/6', () => {
  const s = buildSupportingArcDirective('LIVE', 'en');
  assert.ok(s.includes('20 points'), 'en static 扣分 20 锚点');
  assert.ok(s.includes('24 points'), 'en abrupt 扣分 24 锚点');
  assert.ok(s.includes('8 points'), 'en passive 扣分 8 锚点');
  assert.ok(s.includes('60%'), 'en abrupt 阈值 60% 锚点');
  assert.ok(s.includes('70%'), 'en static 阈值 70% 锚点');
  assert.ok(s.includes('75%'), 'en passive 阈值 75% 锚点');
  assert.ok(s.includes('+2'), 'en bonus 回补 2 锚点');
});
