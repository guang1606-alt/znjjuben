/**
 * v2.368 「上集钩子被开场一句话消解」前置教学指令（buildCliffhangerDissolveDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - cliffhanger-dissolve-check.ts 的 cliffhangerDissolveCheck（v2.349）只在生成后消费：
 *   pipeline 首扫（L2166）/ 修复后随轮重算（L2353）/ high 触发重试（L2446、L2459）/
 *   重试 advice 注入（L2781）/ 终稿重算（L3227）。
 * - 证伪面：prevEpisodeDirective 只写「集尾钩子要回应或推进」一句泛化承诺；
 *   continuityBrief 的 endingBlock 只透传前集结尾原句；
 *   hookPayoffDirective 只写「本集开场前 1/3 必须正面接住，不许当没发生」，
 *   不点名任何消解锚、不给 300/120 字窗口、不给 strong/soft 分级；
 *   buildEpisodeHookDirective 只管本集结尾抛钩（抛钩端），不管接钩；
 *   memory-fakeout-check 只管同集内「原来是梦」，misunderstanding-drag 只管窗口外拖太久；
 *   全仓无任何 build*Dissolve*Directive。
 * - 坐实：五类消解锚（虚惊/玩笑/表演/试探/道具）+ 300 字窗口 + 120 字反升级豁免
 *   + strong 22 / soft 12 分级，撰写师与润色师首轮零教学——先写错再打回重写，
 *   白付 retry token（v2.157）。
 *
 * 本文件锁八件事：
 * 1. 五类消解锚全列并给出可执行替代（真接 / 升级 / 假化解后立即升级）。
 * 2. 量化口径与检测同源：strong 22 / soft 12、300 字窗口、120 字豁免、<20 字不检测。
 * 3. 同源自证：强钩结尾 + 开场「逗你玩」探针判 high、score 78，指令点名同款锚。
 * 4. 边界：抛钩端 / 兑现记账 / 同集梦醒 / 窗口外误会 / 开场焊点五项分工。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文，含消解锚英文名与分级数字。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入。
 * 8. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CD = require('../dist/engine/cliffhanger-dissolve-check.js');
const { cliffhangerDissolveCheck, buildCliffhangerDissolveDirective } = CD;

// 强钩探针：上集结尾是危机钩（枪口顶额头），≥20 字
const PREV_STRONG = '顾言把枪口顶在林晚额头上，指节发白，扣紧扳机：「最后一次，你签不签？」';
// 开场消解探针：第一句就用「逗你玩」把上集枪口作废
const DISSOLVED = `场景1：客厅
林晚：逗你玩的，我签。
顾言：……
林晚：你别当真。`;
// 假化解真升级探针：消解锚后 120 字内「突然 + 枪口」→ 合法反转
const ESCALATED = `场景1：客厅
林晚：逗你玩的。
突然，枪口转向门口——顾言：别动。`;

// ==================== 1. 五类消解锚 + 可执行替代 ====================

test('zh 指令列全五类消解锚并给出可执行替代', () => {
  assert.strictEqual(typeof buildCliffhangerDissolveDirective, 'function', 'buildCliffhangerDissolveDirective 必须存在');
  const d = buildCliffhangerDissolveDirective('LIVE', 'zh');
  for (const k of ['虚惊一场', '开玩笑', '装的', '试探', '道具枪']) {
    assert.ok(d.includes(k), `必须点名消解锚：${k}`);
  }
  assert.ok(d.includes('真的落地'), '必须给可执行替代（让危机真的落地）');
  assert.ok(d.includes('假化解'), '必须教「假化解真升级」的合法路径');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：strong 22 / soft 12 + 300/120/20 窗口', () => {
  const d = buildCliffhangerDissolveDirective('LIVE', 'zh');
  assert.ok(d.includes('扣 22'), '强钩必须写扣 22');
  assert.ok(d.includes('扣 12'), '软钩必须写扣 12');
  assert.ok(d.includes('正文前 300 字'), '必须写开场正文前 300 字消解窗口');
  assert.ok(d.includes('之后 120 字内'), '必须写锚后 120 字反升级豁免窗口');
  assert.ok(d.includes('20 字'), '必须写前集结尾不足 20 字不检测');
  assert.ok(d.includes('反转') && d.includes('情感'), '必须列全强钩/软钩类型');
});

// ==================== 3. 同源自证 ====================

test('同源自证：强钩探针被判 high/78，指令点名同款消解锚', () => {
  const r = cliffhangerDissolveCheck(PREV_STRONG, DISSOLVED, 'zh');
  assert.strictEqual(r.checked, true, '探针应进入检测');
  assert.strictEqual(r.dissolved, true, '开场的「逗你玩」应被判消解');
  assert.strictEqual(r.prevHookType, 'crisis', '上集结尾应识别为危机钩');
  const hit = r.issues[0];
  assert.strictEqual(hit.severity, 'high', '强钩被消解应为 high');
  assert.strictEqual(r.score, 78, 'high 扣 22 → 78 分');
  assert.ok(r.dissolveAnchor.includes('逗你玩'), '命中锚应是逗你玩');
  const d = buildCliffhangerDissolveDirective('LIVE', 'zh');
  assert.ok(d.includes('逗你玩'), '指令必须点名与 DISSOLVE_ZH 同源的锚');
  assert.ok(d.includes('虚惊一场'), '指令必须点名与 DISSOLVE_ZH 同源的锚');
});

test('假化解真升级探针应走豁免，指令写明 120 字内升级才合法', () => {
  const r = cliffhangerDissolveCheck(PREV_STRONG, ESCALATED, 'zh');
  assert.strictEqual(r.escalateExempt, true, '锚后 120 字内「突然 + 枪口」应豁免');
  assert.strictEqual(r.dissolved, false, '豁免后不应判消解');
  const d = buildCliffhangerDissolveDirective('LIVE', 'zh');
  assert.ok(d.includes('但/然而/突然'), '必须点名与 ESCALATE 同源的转折词');
});

// ==================== 4. 边界五项分工 ====================

test('边界：抛钩端 / 兑现记账 / 同集梦醒 / 窗口外误会 / 开场焊点各自归位', () => {
  const d = buildCliffhangerDissolveDirective('LIVE', 'zh');
  assert.ok(d.includes('cliffhanger-score'), '必须显式划界抛钩端归 cliffhanger-score');
  assert.ok(d.includes('hookPayoffDirective') || d.includes('兑现记账'), '必须显式划界跨集兑现记账');
  assert.ok(d.includes('梦'), '必须显式划界同集梦醒归 memory-fakeout');
  assert.ok(d.includes('误会'), '必须显式划界窗口外误会拖太久');
  assert.ok(d.includes('开场焊点'), '必须显式划界开场人物/词汇承接归 opening-continuity');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildCliffhangerDissolveDirective('LIVE', 'zh');
  const aigc = buildCliffhangerDissolveDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildCliffhangerDissolveDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，含五类消解锚英文名与分级数字', () => {
  const en = buildCliffhangerDissolveDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/false alarm/i.test(en), '必须含 false alarm');
  assert.ok(/just kidding|fooled you|prank/i.test(en), '必须含玩笑类锚');
  assert.ok(/pretend|rehearsal/i.test(en), '必须含表演类锚');
  assert.ok(/prop gun/i.test(en), '必须含道具类锚');
  assert.ok(/fake blood/i.test(en), '必须含道具类锚');
  assert.ok(en.includes('22') && en.includes('12'), '必须给出 strong 22 / soft 12');
  assert.ok(en.includes('300') && en.includes('120'), '必须给出 300/120 窗口');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildCliffhangerDissolveDirective[^}]*\} from '\.\.\/engine\/cliffhanger-dissolve-check'/.test(src),
    '必须从 cliffhanger-dissolve-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/cliffhangerDissolveDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'cliffhanger-dissolve-check.ts'), 'utf8');
  assert.ok(engine.includes('export function cliffhangerDissolveCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildCliffhangerDissolveDirective'), '教学函数必须与检测同文件');
});
