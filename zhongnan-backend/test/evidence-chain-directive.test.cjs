// v2.386 翻盘证据链前置教学函数同源测试（TDD 先红）
// 与 src/engine/evidence-chain-check.ts 检测口径 100% 同源
// 四类问题（物证无铺垫/证据雨/空口证据/人证空降）+ fairShow 正信号
// 断言策略：语义锚点定位唯一行后，行内断数字
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEvidenceChainDirective } = require('../dist/engine/evidence-chain-check.js');

function lineOf(s, keyword) {
  const line = s.split('\n').find((l) => l.includes(keyword));
  assert.ok(line, `未找到语义锚点「${keyword}」所在行`);
  return line;
}

test('1. 缺省走 LIVE 与 zh：标题、差评意象、类型名齐全', () => {
  const s = buildEvidenceChainDirective();
  assert.ok(s.includes('翻盘证据链'), '中文标题');
  assert.ok(s.includes('证据想要就有'), '证据想要就有差评意象');
  assert.ok(s.includes('unplanted_evidence'), '物证无铺垫类型名');
});

test('2. 物证无铺垫：六类铁证、严格更早行、1 次 mid、第 2 次起 high、最多 2 条、min(次数×12,24)', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '物证无铺垫（unplanted_evidence');
  assert.ok(line.includes('六类铁证'), '六类物证');
  assert.ok(line.includes('严格更早行'), '必须先于出示行');
  assert.ok(line.includes('第 1 次 mid'), '1 次 mid');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('最多报 2 条'), '最多 2 条');
  assert.ok(line.includes('min(次数×12, 24)'), '扣分 min(次数×12,24)');
});

test('3. 证据雨：≥3 种、3 种 low 扣 6、≥4 种 mid 扣 10、全文 1 条', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '证据雨（evidence_overkill');
  assert.ok(line.includes('≥3 种'), '≥3 种起始');
  assert.ok(line.includes('3 种 low 扣 6 分'), '3 种 low 扣 6');
  assert.ok(line.includes('≥4 种 mid 扣 10 分'), '≥4 种 mid 扣 10');
  assert.ok(line.includes('全文只报 1 条'), '全文 1 条');
});

test('4. 空口证据：≥2 次宣称、本集零出示、low 扣 7、全文 1 条', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '空口证据（verbal_evidence_only');
  assert.ok(line.includes('≥2 次'), '≥2 次宣称');
  assert.ok(line.includes('本集却一次都没有真出示'), '零出示');
  assert.ok(line.includes('low 扣 7 分'), 'low 扣 7');
  assert.ok(line.includes('全文只报 1 条'), '全文 1 条');
});

test('5. 人证空降：推门而入/死者复生、此前无安排行、1 次 mid、第 2 次起 high、min(次数×11,20)', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '人证空降（airdropped_witness');
  assert.ok(line.includes('推门而入'), '推门而入');
  assert.ok(line.includes('死者复生'), '死者复生');
  assert.ok(line.includes('此前无'), '此前无安排行');
  assert.ok(line.includes('第 1 次 mid'), '1 次 mid');
  assert.ok(line.includes('第 2 次起 high'), '第 2 次起 high');
  assert.ok(line.includes('min(次数×11, 20)'), '扣分封顶 20');
});

test('6. 正信号 fairShow：铺垫严格早于出示 +2/次封顶 6', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '正信号：fairShow');
  assert.ok(line.includes('严格早于出示行'), '铺垫严格早于出示');
  assert.ok(line.includes('+2 分/次封顶 6 分'), 'fairShow +2/次封顶 6');
});

test('7. 判定顺序：切场→行级打标→四类判定→high→mid→low、场次', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '判定顺序：');
  assert.ok(line.includes('六类出示'), '六类出示打标');
  assert.ok(line.includes('high→mid→low'), 'high→mid→low 排序');
  assert.ok(line.includes('场次'), '再按场次');
});

test('8. 评分：clamp(round(100 - 扣分 + 加分),0,100)、无信号满分放行、不足 20 字放行', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'zh'), '评分：');
  assert.ok(line.includes('clamp(round(100 - 扣分 + 加分), 0, 100)'), 'clamp+round 公式');
  assert.ok(line.includes('满分 100 放行'), '无信号满分放行');
  assert.ok(line.includes('不足 20 字'), '不足 20 字放行');
});

test('9. en 层：标题与四类类型名齐全，且零中文', () => {
  const s = buildEvidenceChainDirective('LIVE', 'en');
  assert.ok(s.includes('Reversal Evidence'), '英文标题');
  assert.ok(s.includes('unplanted_evidence'), 'unplanted_evidence');
  assert.ok(s.includes('evidence_overkill'), 'evidence_overkill');
  assert.ok(s.includes('verbal_evidence_only'), 'verbal_evidence_only');
  assert.ok(s.includes('airdropped_witness'), 'airdropped_witness');
  assert.ok(!/[\u4e00-\u9fa5]/.test(s), 'en 分支不得出现中文');
});

test('10. en 物证无铺垫：strictly earlier、-12 per hit capped at 24、at most 2', () => {
  const line = lineOf(buildEvidenceChainDirective('LIVE', 'en'), 'Unplanted evidence (unplanted_evidence');
  assert.ok(line.includes('strictly earlier'), '必须严格更早');
  assert.ok(line.includes('-12 points per hit capped at 24'), '-12 封顶 24');
  assert.ok(line.includes('at most 2'), '最多 2 条');
});

test('11. en 证据雨与空口：3 kinds low -6、4+ mid -10、one report only、zero times、-7', () => {
  const s = buildEvidenceChainDirective('LIVE', 'en');
  const over = lineOf(s, 'Evidence overkill (evidence_overkill');
  assert.ok(over.includes('3 kinds is low, -6 points'), '3 kinds low -6');
  assert.ok(over.includes('4 or more is mid, -10 points'), '4+ mid -10');
  assert.ok(over.includes('one report only'), 'one report only');
  const verbal = lineOf(s, 'Verbal evidence only');
  assert.ok(verbal.includes('zero times'), '零出示');
  assert.ok(verbal.includes('-7 points'), '-7');
});

test('12. en 人证/正信号/评分：-11 capped 20、caps at 6、full 100 pass、under 20 characters', () => {
  const s = buildEvidenceChainDirective('LIVE', 'en');
  const witness = lineOf(s, 'Airdropped witness');
  assert.ok(witness.includes('-11 per hit capped at 20'), '-11 封顶 20');
  const pos = lineOf(s, 'Positive signal: fairShow');
  assert.ok(pos.includes('caps at 6'), 'fairShow caps at 6');
  const scoring = lineOf(s, 'Scoring:');
  assert.ok(scoring.includes('full 100 pass'), '无信号满分放行');
  assert.ok(scoring.includes('under 20 characters'), '不足 20 字符放行');
});
