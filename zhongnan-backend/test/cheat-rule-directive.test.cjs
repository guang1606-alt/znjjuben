// v2.385 金手指规则前置教学函数同源测试（TDD 先红）
// 与 src/engine/cheat-rule-check.ts 检测口径 100% 同源
// 五类问题（先用后立规/临时觉醒/零代价万能外挂/许愿机/重生全知）+ 三正信号 + 门控与豁免
// 断言策略：语义锚点定位唯一行后，行内断数字
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCheatRuleDirective } = require('../dist/engine/cheat-rule-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省走 LIVE 与 zh：标题、外挂意象、类型名齐全', () => {
  const s = buildCheatRuleDirective();
  assert.ok(s.includes('金手指规则'), '中文标题');
  assert.ok(s.includes('临时发外挂'), '作者临时发外挂意象');
  assert.ok(s.includes('unestablished_cheat'), '先用后立规类型名');
});

test('2. 题材门控：none 满分 100、system、rebirth 只跑临时觉醒与全知零误差', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '题材门控：');
  assert.ok(line.includes('none'), 'none 门控');
  assert.ok(line.includes('满分 100 放行'), 'none 满分放行');
  assert.ok(line.includes('system'), 'system 门控');
  assert.ok(line.includes('rebirth'), 'rebirth 门控');
  assert.ok(line.includes('只跑②临时觉醒与⑤全知零误差'), 'rebirth 只跑两检');
});

test('3. 先用后立规：严格更早行、1 次 mid、第 2 次起 high、最多 2 条、min(次数×12,24)', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '先用后立规（unestablished_cheat');
  assert.ok(line.includes('严格更早行'), '同行事后补规不算');
  assert.ok(line.includes('第 1 次 mid'), '1 次 mid');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('最多报 2 条'), '最多 2 条');
  assert.ok(line.includes('min(次数×12, 24)'), '扣分 min(次数×12,24)');
});

test('4. 临时觉醒：无规则 mid 起、min(次数×12,22)、有规则无预告 low 每次 5 封顶 8、fairUnlock 正信号', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '临时觉醒（last_minute_unlock');
  assert.ok(line.includes('mid（第 2 次起 high'), '无规则 mid 起 high');
  assert.ok(line.includes('min(次数×12, 22)'), '扣分封顶 22');
  assert.ok(line.includes('每次扣 5 分、封顶 8 分'), '无预告 low 5/次封顶 8');
  assert.ok(line.includes('fairUnlock'), '规则+预告算正信号');
});

test('5. 零代价万能外挂：≥3 次、3-4 次 low 扣 7、≥5 次 mid 扣 12、全文 1 条、代价须晚于动用', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '零代价万能外挂（costless_overuse');
  assert.ok(line.includes('≥3 次'), '动用 ≥3 次');
  assert.ok(line.includes('3-4 次 low 扣 7 分'), '3-4 次 low 扣 7');
  assert.ok(line.includes('≥5 次 mid 扣 12 分'), '≥5 次 mid 扣 12');
  assert.ok(line.includes('全文只报 1 条'), '全文 1 条');
  assert.ok(line.includes('代价行必须有不晚于它的动用'), '代价兑付语义');
});

test('6. 许愿机：无规则同行终结、1 次 mid、第 2 次起 high、min(次数×11,20)', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '许愿机（cheat_solves_all');
  assert.ok(line.includes('第 1 次 mid'), '1 次 mid');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('最多报 2 条'), '最多 2 条');
  assert.ok(line.includes('min(次数×11, 20)'), '扣分封顶 20');
});

test('7. 重生全知：≥3 次、0 处蝴蝶/偏差、low 扣 7、全文 1 条', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '重生全知（flawless_foreknowledge');
  assert.ok(line.includes('≥3 次'), '前世记忆 ≥3 次');
  assert.ok(line.includes('蝴蝶效应/记忆偏差'), '蝴蝶效应与记忆偏差');
  assert.ok(line.includes('low 扣 7 分'), 'low 扣 7');
  assert.ok(line.includes('全文只报 1 条'), '全文 1 条');
});

test('8. 正信号：ruleFirst +2 封顶 6 / costPaid +2 封顶 4 / fairUnlock +2 封顶 4', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '正信号：ruleFirst');
  assert.ok(line.includes('+2 分/次封顶 6 分'), 'ruleFirst +2/次封顶 6');
  assert.ok(line.includes('costPaid'), 'costPaid 正信号');
  assert.ok(line.includes('+2 分/次封顶 4 分'), 'costPaid/fairUnlock +2/次封顶 4');
  assert.ok(line.includes('fairUnlock'), 'fairUnlock 正信号');
});

test('9. 判定顺序：切场→打标→核心规则与重生声明分行→五类判定→high→mid→low、场次、key', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '判定顺序：');
  assert.ok(line.includes('核心规则行与重生声明行'), '核心规则与重生声明分开');
  assert.ok(line.includes('high→mid→low'), 'high→mid→low 排序');
  assert.ok(line.includes('场次'), '再按场次');
  assert.ok(line.includes('key'), '最后按 key');
});

test('10. 评分：clamp(round(100 - 扣分 + 加分),0,100)、无信号满分放行、不足 20 字放行', () => {
  const line = lineOf(buildCheatRuleDirective('LIVE', 'zh'), '评分：');
  assert.ok(line.includes('clamp(round(100 - 扣分 + 加分), 0, 100)'), 'clamp+round 公式');
  assert.ok(line.includes('满分 100 放行'), '无信号满分放行');
  assert.ok(line.includes('不足 20 字'), '不足 20 字放行');
});

test('11. en 层：标题与五类类型名齐全，且零中文', () => {
  const s = buildCheatRuleDirective('LIVE', 'en');
  assert.ok(s.includes('Cheat Rules'), '英文标题');
  assert.ok(s.includes('unestablished_cheat'), 'unestablished_cheat');
  assert.ok(s.includes('last_minute_unlock'), 'last_minute_unlock');
  assert.ok(s.includes('costless_overuse'), 'costless_overuse');
  assert.ok(s.includes('cheat_solves_all'), 'cheat_solves_all');
  assert.ok(s.includes('flawless_foreknowledge'), 'flawless_foreknowledge');
  assert.ok(!/[\u4e00-\u9fa5]/.test(s), 'en 分支不得出现中文');
});

test('12. en 层阈值与门控：-12 封顶 24、3 to 4 uses low -7、5+ mid -12、one report only、全知 -7', () => {
  const s = buildCheatRuleDirective('LIVE', 'en');
  const gate = lineOf(s, 'Gate:');
  assert.ok(gate.includes('system'), 'system 门控');
  assert.ok(gate.includes('rebirth'), 'rebirth 门控');
  const unest = lineOf(s, 'Use before rules (unestablished_cheat');
  assert.ok(unest.includes('-12 points per use capped at 24'), '-12 封顶 24');
  const over = lineOf(s, 'Costless all-purpose cheat');
  assert.ok(over.includes('3 to 4 uses is low, -7 points'), '3 to 4 low -7');
  assert.ok(over.includes('5 or more is mid, -12 points'), '5+ mid -12');
  assert.ok(over.includes('one report only'), 'one report only');
  const fore = lineOf(s, 'Flawless foreknowledge');
  assert.ok(fore.includes('-7 points'), '全知 -7');
});
