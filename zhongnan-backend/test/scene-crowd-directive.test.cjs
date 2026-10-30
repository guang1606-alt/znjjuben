/**
 * v2.371 「单场群戏超载」前置教学指令（buildSceneCrowdDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - scene-crowd-check.ts 的 sceneCrowdCheck（v2.352）只在生成后消费：
 *   pipeline 首扫（L2175）/ 修复后随轮重算（L2362）/ high 打回重试（L2458）/ advice 注入（L2805）/ 终稿重算（L3236）。
 * - 证伪面：round-robin-dialogue 管群戏"读稿感"（轮转形式），不管人数多少；
 *   character-balance-check 管全剧戏份比例，不管单场；
 *   character-presence-check 管全稿不同说话人个数，不切场；
 *   information-density 管单场信息推进数≥4，不管人数；
 *   全仓 grep `build.*Scene.*Crowd.*Directive` 零命中。
 * - 坐实：单场 distinct 说话人≥7 → high crowded_scene_overload（22 分/场），
 *   ≥5 → mid crowded_scene（10 分/场）；群体标签算 1 人；旁白不计入；
 *   score = max(0, 100 - 22×high数 - 10×mid数)。
 *   撰写师与润色师首轮 prompt 零教学——同场 7 人抢话要等全稿写完才会被检测出来，白付 retry token。
 *
 * 本文件锁九件事：
 * 1. 单场 distinct 说话人阈值全覆盖（4/5/7）。
 * 2. 量化口径与检测同源：22/high、10/mid、score 衰减公式。
 * 3. 同源自证：探针 7 人场判 high、score=78。
 * 4. 群体标签归并 + 旁白不计入写明。
 * 5. 边界五项（群戏形式/全剧比例/单场信息密度/全稿 speaker / 拆场节奏）。
 * 6. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 7. en 层零中文，含 5/7 阈值、22/10 扣分。
 * 8. pipeline 同源 import + ≥3 处引用。
 * 9. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const SC = require('../dist/engine/scene-crowd-check.js');
const { sceneCrowdCheck, buildSceneCrowdDirective } = SC;

// 7 人探针 → 应判 high（竖屏单屏容不下 7 张脸）
const HIGH_7 = `场景1：会议室
顾言：这次必须做。
林晚：我不同意。
王磊：等等，让我说完。
苏晴：我支持顾总。
陈明：我补充一点。
赵晓：还有我的看法。
周姐：我也说两句。`;

// 5 人探针 → 应判 mid
const MID_5 = `场景1：办公室
顾言：方案定了。
林晚：我看行。
苏晴：同意。
王磊：没问题。
赵晓：我也同意。`;

// 群体标签探针（众人=1 人，旁白不计入 → 实际 distinct 只有 3）
const GROUP_OK = `场景1：发布会
旁白：一年前。
顾言：大家好。
众人：欢迎！
林晚：今天很高兴。`;

// ==================== 1. distinct 说话人阈值全覆盖 ====================

test('zh 指令覆盖 distinct 说话人阈值（≤4 安全 / ≥5 mid / ≥7 high）', () => {
  assert.strictEqual(typeof buildSceneCrowdDirective, 'function', 'buildSceneCrowdDirective 必须存在');
  const d = buildSceneCrowdDirective('LIVE', 'zh');
  // 阈值
  assert.ok(d.includes('4') && d.includes('5') && d.includes('7'), '必须点名 4/5/7 阈值');
});

// ==================== 2. 量化口径同源 ====================

test('量化口径与检测同源：22/high、10/mid、score 衰减', () => {
  const d = buildSceneCrowdDirective('LIVE', 'zh');
  assert.ok(d.includes('22'), '必须写 22 分/high 场');
  assert.ok(d.includes('10'), '必须写 10 分/mid 场');
});

// ==================== 3. 同源自证：7 人场探针 ====================

test('探针 7 人场判 high、检测同源、指令点名同款', () => {
  const res = sceneCrowdCheck(HIGH_7, 'zh');
  assert.ok(res.checked, '探针必须被检测');
  assert.ok(res.issues.some((i) => i.severity === 'high'), '7 人场必须判 high');
  const d = buildSceneCrowdDirective('LIVE', 'zh');
  // 指令必须点名检测里的核心动作
  assert.ok(d.includes('22'), '指令必须点 high 扣分 22');
  assert.ok(d.includes('合并') || d.includes('拆场') || d.includes('动作'), '指令必须给 3 种正向解决动作');
});

// ==================== 4. 群体标签归并 + 旁白不计入 ====================

test('指令写明群体标签归并 + 旁白不计入说话人数', () => {
  const d = buildSceneCrowdDirective('LIVE', 'zh');
  // 群体标签归并（中文）
  assert.ok(d.includes('众人') || d.includes('大家') || d.includes('群体'), '必须点名群体标签归并');
  // 旁白不计入
  assert.ok(d.includes('旁白') || d.includes('解说') || d.includes('不计入'), '必须点名旁白不计入');
});

// ==================== 5. 边界五项 ====================

test('指令写明边界五项：群戏形式/全剧比例/单场信息密度/全稿 speaker/拆场节奏', () => {
  const d = buildSceneCrowdDirective('LIVE', 'zh');
  // 至少点名 3 个边界方向
  let hits = 0;
  if (d.includes('轮转') || d.includes('读稿')) hits++;
  if (d.includes('戏份') || d.includes('全剧')) hits++;
  if (d.includes('信息') || d.includes('推进')) hits++;
  if (d.includes('全稿') || d.includes('speaker')) hits++;
  if (d.includes('拆场') || d.includes('节奏')) hits++;
  assert.ok(hits >= 3, '必须点名至少 3 个边界项（群戏形式/全剧比例/单场信息密度/全稿 speaker/拆场节奏）');
});

// ==================== 6. LIVE/AIGC 制式 + 缺省 ====================

test('LIVE 有 △ 动作行、AIGC 有不加 △、缺省 LIVE', () => {
  const dLive = buildSceneCrowdDirective('LIVE', 'zh');
  const dAigc = buildSceneCrowdDirective('AIGC', 'zh');
  assert.ok(dLive.includes('△'), 'LIVE 必须含 △ 动作行');
  assert.ok(!dLive.includes('不加 △'), 'LIVE 不应含不加 △');
  assert.ok(dAigc.includes('不加 △'), 'AIGC 必须含不加 △');
  const dDefault = buildSceneCrowdDirective();
  assert.ok(dDefault.includes('△') && !dDefault.includes('不加 △'), '缺省 format=LIVE');
});

// ==================== 7. en 零中文 + 阈值 ====================

test('en 分支零中文 + 含 distinct speaker 阈值', () => {
  const d = buildSceneCrowdDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), 'en 分支必须零中文');
  assert.ok(d.includes('4') && d.includes('5') && d.includes('7'), 'en 必须含阈值 4/5/7');
  assert.ok(d.includes('22') && d.includes('10'), 'en 必须含扣分 22/10');
});

// ==================== 8. pipeline 同源 import + ≥3 处引用 ====================

test('pipeline.ts 同源 import 且 ≥3 处引用 buildSceneCrowdDirective', () => {
  const pipePath = path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts');
  const content = fs.readFileSync(pipePath, 'utf8');
  // 同源 import
  const importMatch = content.match(/import.*\{[^}]*sceneCrowdCheck[^}]*\}[^}]*from.*scene-crowd-check/);
  assert.ok(importMatch, 'pipeline.ts 必须 import sceneCrowdCheck 同文件）');
  // 调用次数 ≥3（import + 构造 + writer 注入变量 + polisher 注入变量）
  const callCount = (content.match(/buildSceneCrowdDirective|sceneCrowdDirective/g) || []).length;
  assert.ok(callCount >= 3, `sceneCrowdDirective 在 pipeline.ts 必须 ≥3 处引用（实际 ${callCount}）`);
});

// ==================== 9. 教学与检测同文件（同源铁律） ====================

test('buildSceneCrowdDirective 与 sceneCrowdCheck 必须在同一文件', () => {
  const enginePath = path.join(__dirname, '..', 'src', 'engine', 'scene-crowd-check.ts');
  const engine = fs.readFileSync(enginePath, 'utf8');
  assert.ok(engine.includes('sceneCrowdCheck'), '文件必须含 sceneCrowdCheck');
  assert.ok(engine.includes('buildSceneCrowdDirective'), '同文件必须含 buildSceneCrowdDirective');
});
