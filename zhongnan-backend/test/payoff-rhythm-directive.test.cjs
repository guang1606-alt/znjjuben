/**
 * v2.374 憋爽节奏前置教学 —— buildPayoffRhythmDirective
 * 缺口：payoffRhythmCheck（v2.130）五类死法检测存在，pipeline 七处消费（含 craftPass 闸门与打回 advice），
 *       但撰写师/润色师首轮零教学。邻近引擎均不覆盖「受压-释放配对/间隔/兑付对等」：
 *       gratificationDirective / humiliationDirective 是跨集台账且只进架构师；
 *       buildUnderdogDirective 仅题材命中且只给定性「1-2 集内释放」；其余三引擎无 build*Directive。
 * 本组用例：双制式可用 + zh 五类阈值全覆盖 + en 零中文。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPayoffRhythmDirective } = require('../dist/engine/payoff-rhythm-check');

// ---------- 1. 缺省参数：中文教学（该检测对 LIVE/AIGC 全量生效） ----------
test('缺省: 不传参时返回中文教学且非空', () => {
  const d = buildPayoffRhythmDirective();
  assert.ok(d.length > 0, '缺省应返回教学（本检测全制式生效）');
  assert.ok(/[\u4e00-\u9fff]/.test(d), '缺省应按 zh 输出');
});

// ---------- 2. LIVE 同样有教学（不是 AIGC 专属） ----------
test('LIVE: 真人稿同样注入憋爽节奏教学', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(d.length > 0, 'LIVE 不应返回空串');
  assert.ok(/憋爽|受压|释放/.test(d), 'LIVE 未教受压-释放节奏');
});

// ---------- 3. zh：只虐不爽 —— ≥4 受压 / 0 释放 / high 30 / 40% ----------
test('zh: 只虐不爽（≥4 受压且 0 释放）high 扣 30、首释放必须在 40% 前', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(/只虐不爽|虐主/.test(d), '未点名只虐不爽');
  assert.ok(/≥4|4 处|四处/.test(d), '未点名受压 ≥4 阈值');
  assert.ok(/0 处释放|零释放|一次都没有/.test(d), '未点名零释放');
  assert.ok(/30/.test(d), '未点名 30 分');
  assert.ok(/40%/.test(d), '未点名 40% 首释放线');
});

// ---------- 4. zh：一路平推 —— 0 受压 / ≥3 释放 / mid 12 ----------
test('zh: 一路平推（0 受压却 ≥3 释放）mid 扣 12', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(/一路平推|平推|白捡/.test(d), '未点名一路平推');
  assert.ok(/0 处受压|零受压|没有受压/.test(d), '未点名零受压');
  assert.ok(/≥3|3 处|三处/.test(d), '未点名释放 ≥3 阈值');
  assert.ok(/12/.test(d), '未点名 12 分');
  assert.ok(/反差|落差|支点/.test(d), '未教爽感来自落差');
});

// ---------- 5. zh：憋太久 —— 40% / 35% 干旱 / high 18 ----------
test('zh: 憋太久（首释放晚于 40% 或最长纯憋段 >35%）high 扣 18', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(/憋太久|干旱/.test(d), '未点名憋太久/干旱');
  assert.ok(/35%/.test(d), '未点名 35% 干旱窗口');
  assert.ok(/18/.test(d), '未点名 18 分');
  assert.ok(/30%|每三成|每 30/.test(d), '未教每 30% 插一次小还手');
});

// ---------- 6. zh：羞辱欠账 —— ≥2 处 / mid 12 / 对等同场合 ----------
test('zh: 羞辱欠账（≥2 处具体羞辱且其后无强释放）mid 扣 12、同场合对等兑付', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(/羞辱欠账|欠账|欠条/.test(d), '未点名羞辱欠账');
  assert.ok(/≥2|2 处|两处/.test(d), '未点名 ≥2 处羞辱阈值');
  assert.ok(/对等/.test(d), '未教对等兑付');
  assert.ok(/同(?:一)?场合|同批观众/.test(d), '未教同场合同批观众兑付');
  assert.ok(/退婚|废物|你配吗|你会后悔|滚出去/.test(d), '未列举具体羞辱词');
});

// ---------- 7. zh：尾段烂尾 —— 后 30% / mid 10 / 明确小胜收尾 ----------
test('zh: 尾段烂尾（后 30% 又受压且无强释放收尾）mid 扣 10', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(/尾段|结尾|最后/.test(d), '未点名尾段');
  assert.ok(/30%/.test(d), '未点名后 30% 窗口');
  assert.ok(/10/.test(d), '未点名 10 分');
  assert.ok(/小胜|明确.*收尾|强反制/.test(d), '未教尾段强释放收尾');
});

// ---------- 8. zh：短稿 <20 字豁免 + 有效周期 20% 铺垫 + 强弱释放区分 ----------
test('zh: 短稿 <20 字豁免；有效憋爽周期需释放前 20% 内有受压；强/弱释放区分', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'zh');
  assert.ok(/20 字|不足 20|短稿/.test(d), '未教短稿豁免');
  assert.ok(/20%/.test(d), '未教释放前 20% 铺垫窗口');
  assert.ok(/强释放/.test(d) && /弱释放/.test(d), '未区分强/弱释放');
  assert.ok(/翻盘|打脸|真相|身份/.test(d), '未列举强释放');
  assert.ok(/反击|报警|证据/.test(d), '未列举弱释放');
});

// ---------- 9. en：零中文 + 五类关键词 ----------
test('en: 零中文，五类死法英文关键词齐备', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), `en 指令混入中文: ${d}`);
  assert.ok(/pure suffering|no release/i.test(d), 'en 未教只虐不爽');
  assert.ok(/unearned win|cheap win|steamroll/i.test(d), 'en 未教一路平推');
  assert.ok(/drought/i.test(d), 'en 未教憋太久');
  assert.ok(/unpaid|owe/i.test(d), 'en 未教羞辱欠账');
  assert.ok(/tail/i.test(d), 'en 未教尾段烂尾');
});

// ---------- 10. en：阈值齐备（30/12/18/12/10 + 40%/35%/30%/20%）----------
test('en: 五档扣分与四个窗口阈值齐备', () => {
  const d = buildPayoffRhythmDirective('LIVE', 'en');
  for (const n of ['30', '12', '18', '10']) assert.ok(d.includes(n), `en 缺扣分 ${n}`);
  for (const p of ['40%', '35%', '30%', '20%']) assert.ok(d.includes(p), `en 缺窗口 ${p}`);
  assert.ok(/strong release/i.test(d), 'en 未区分 strong release');
});
