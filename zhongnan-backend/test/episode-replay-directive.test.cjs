/**
 * v2.372 「跨集台词复读」前置教学指令（buildEpisodeReplayDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - episode-replay-check.ts 的 episodeReplayCheck（v2.353）只在生成后消费：
 *   pipeline 首扫（L2178）/ 修复后随轮重算（L2365）/ high 纳入闸门重试（L2462/L2467）/ advice 注入（L2813-2816）/ 终稿重算（L3239）。
 * - 证伪面：repetition-check 管集内重复（同句/同情绪/同动作原地打转），不做跨集文本比对；
 *   scene-padding-check 管集内 recap 注水词（前情提要/我不是告诉过你），不比对原文；
 *   cliffhanger-payoff 是反向要求（上集钩子必须在本集复现）；
 *   opening-continuity 管开场块人物与词汇是否接住，不逐句比对台词；
 *   flashback-crutch 管集内闪回搬运；
 *   全仓 grep `build.*Replay.*Directive|ReplayDirective` 零命中。
 * - 坐实：只比对台词行；zh 归一去全部非 CJK/字母/数字、en 小写去非字母数字（标点差异仍判复读）；
 *   zh ≥12 字 / en ≥20 字母才比对；zh ≥30 字 / en ≥50 字母 单条 high（扣 22）、否则 mid（扣 10）；
 *   同一句集内只报一次；prevSummary <20 字或 draft <20 字 checked=false 满分放行。
 *
 * 本文件锁十件事：
 * 1. 长度门槛 12/30（zh）与 20/50（en）写明。
 * 2. 量化口径同源：high 22 / mid 10。
 * 3. 同源自证：探针判 1 high + 1 mid、score=68。
 * 4. 归一化规则：标点差异仍判复读。
 * 5. 短句豁免（「你走吧」<12 字不复读）。
 * 6. 边界五项。
 * 7. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 8. en 层零中文，含 20/50 与 22/10。
 * 9. pipeline 同源 import + ≥3 处引用。
 * 10. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ER = require('../dist/engine/episode-replay-check.js');
const { episodeReplayCheck, buildEpisodeReplayDirective } = ER;

// 上集摘要：两句台词，第一句归一后 ≥30 字（high），第二句 12-29 字（mid）
const PREV = `上一集摘要：
顾言：这份协议我可以签，但公司的股权必须重新分配，我要拿到百分之六十的控制权。
林晚：你做梦，我死也不会同意把父亲留下的东西交给你。`;

const REPLAYED = `场景1：办公室
顾言：这份协议我可以签，但公司的股权必须重新分配，我要拿到百分之六十的控制权。
林晚：你做梦，我死也不会同意把父亲留下的东西交给你。
苏晴：你们别吵了。`;

// 标点差异探针：与上集第一句只差标点
const PUNCT_DRIFT = `场景1：办公室
顾言：这份协议我可以签，但公司的股权必须重新分配。我要拿到百分之六十的控制权！
苏晴：你们别吵了。`;

// 短句探针：上集原话 <12 字，复现是正常节拍
const PREV_SHORT = `上一集摘要：
顾言：你走吧。
林晚：保重。`;
const SHORT_REPLAY = `场景1：门口
顾言：你走吧。
苏晴：我不走。`;

// ==================== 1. 长度门槛 ====================

test('zh 指令写明长度门槛 12/30 字', () => {
  assert.strictEqual(typeof buildEpisodeReplayDirective, 'function', 'buildEpisodeReplayDirective 必须存在');
  const d = buildEpisodeReplayDirective('LIVE', 'zh');
  assert.ok(d.includes('12') && d.includes('30'), '必须点名 12/30 字门槛');
});

// ==================== 2. 量化口径同源 ====================

test('量化口径与检测同源：high 扣 22 / mid 扣 10', () => {
  const d = buildEpisodeReplayDirective('LIVE', 'zh');
  assert.ok(d.includes('22'), '必须写 high 扣 22');
  assert.ok(d.includes('10'), '必须写 mid 扣 10');
});

// ==================== 3. 同源自证 ====================

test('探针判 1 high + 1 mid、score=68、指令点名同款口径', () => {
  const res = episodeReplayCheck(PREV, REPLAYED, 'zh');
  assert.ok(res.checked, '探针必须被检测');
  assert.strictEqual(res.replayCount, 2, '必须报 2 条复读');
  const high = res.issues.filter((i) => i.severity === 'high');
  const mid = res.issues.filter((i) => i.severity === 'mid');
  assert.strictEqual(high.length, 1, '长句必须判 high');
  assert.strictEqual(mid.length, 1, '中句必须判 mid');
  assert.strictEqual(res.score, 68, 'score = 100 - 22 - 10 = 68');
  const d = buildEpisodeReplayDirective('LIVE', 'zh');
  assert.ok(d.includes('22') && d.includes('10'), '指令扣分口径必须同源');
  assert.ok(d.includes('换说法') || d.includes('换说话对象') || d.includes('动作'), '指令必须给三种正向动作');
});

// ==================== 4. 归一化：标点差异仍判复读 ====================

test('标点差异不算改动：归一化后仍是同一句', () => {
  const res = episodeReplayCheck(PREV, PUNCT_DRIFT, 'zh');
  assert.ok(res.replayCount >= 1, '仅改标点也必须判复读');
  const d = buildEpisodeReplayDirective('LIVE', 'zh');
  assert.ok(d.includes('标点') && d.includes('归一'), '指令必须写明标点不算改动');
});

// ==================== 5. 短句豁免 ====================

test('短句豁免：上集原话 <12 字复现不算复读', () => {
  const res = episodeReplayCheck(PREV_SHORT, SHORT_REPLAY, 'zh');
  assert.strictEqual(res.replayCount, 0, '「你走吧」级短句复现必须放行');
  const d = buildEpisodeReplayDirective('LIVE', 'zh');
  assert.ok(d.includes('短句') || d.includes('你走吧'), '指令必须写明短句豁免');
});

// ==================== 6. 边界五项 ====================

test('指令写明边界五项：集内重复/recap 注水/钩子复现/开场承接/闪回搬运', () => {
  const d = buildEpisodeReplayDirective('LIVE', 'zh');
  assert.ok(d.includes('repetition-check'), '必须点名集内重复归 repetition-check');
  assert.ok(d.includes('scene-padding'), '必须点名 recap 注水归 scene-padding');
  assert.ok(d.includes('cliffhanger-payoff'), '必须点名钩子复现归 cliffhanger-payoff');
  assert.ok(d.includes('opening-continuity'), '必须点名开场承接归 opening-continuity');
  assert.ok(d.includes('flashback-crutch'), '必须点名闪回归 flashback-crutch');
});

// ==================== 7. 制式分叉 + 缺省 LIVE ====================

test('LIVE/AIGC 制式分叉，缺省 mode=LIVE', () => {
  const live = buildEpisodeReplayDirective('LIVE', 'zh');
  const aigc = buildEpisodeReplayDirective('AIGC', 'zh');
  assert.notStrictEqual(live, aigc, '两制式必须不同');
  assert.ok(live.includes('△') && !live.includes('不加 △'), 'LIVE 必须有 △ 且不写「不加 △」');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须写明正文不加 △');
  const dflt = buildEpisodeReplayDirective(undefined, 'zh');
  assert.strictEqual(dflt, live, '缺省必须等于 LIVE');
});

// ==================== 8. en 层零中文 ====================

test('en 层零中文，含 20/50 与 22/10', () => {
  const d = buildEpisodeReplayDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), 'en 分支不得含中文');
  assert.ok(d.includes('20') && d.includes('50'), '必须点名 20/50 字母门槛');
  assert.ok(d.includes('22') && d.includes('10'), '必须点名 22/10 扣分');
  const aigc = buildEpisodeReplayDirective('AIGC', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(aigc), 'en AIGC 分支不得含中文');
});

// ==================== 9. pipeline 同源接线 ====================

test('pipeline 同源 import + episodeReplayDirective ≥3 处引用', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  const importLine = src.split('\n').find((l) => l.includes("from '../engine/episode-replay-check'"));
  assert.ok(importLine, 'pipeline 必须有同源 import 行');
  assert.ok(importLine.includes('episodeReplayCheck'), 'import 必须含检测函数');
  assert.ok(importLine.includes('buildEpisodeReplayDirective'), 'import 必须含教学函数');
  const count = (src.match(/buildEpisodeReplayDirective|episodeReplayDirective/g) || []).length;
  assert.ok(count >= 3, `episodeReplayDirective 在 pipeline.ts 必须 ≥3 处引用（实际 ${count}）`);
});

// ==================== 10. 同源铁律 ====================

test('教学与检测同文件（同源铁律）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'episode-replay-check.ts'), 'utf8');
  assert.ok(src.includes('export function episodeReplayCheck'), '检测函数必须在同文件');
  assert.ok(src.includes('export function buildEpisodeReplayDirective'), '教学函数必须在同文件');
});
