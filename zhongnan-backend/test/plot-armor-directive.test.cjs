/**
 * v2.365 「反派降智 / 主角光环」前置教学指令（buildPlotArmorDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - plot-armor-check.ts 的 plotArmorCheck（v2.141）只在生成后消费：
 *   pipeline 首扫（L2145）/ 修复后重算（L2339）/ high 打回重试（L2424）/
 *   重试 advice 注入（L2727）/ 终稿重算（L3213），另有 structural-rescan 登记。
 * - 证伪面：craft-lint 的 DUMB 只列「强行降智」四个字作为过时爽点词条，
 *   一句话「升级为智商在线·认知打击」；craftWriterBrief / playbook 只讲
 *   「反派要有自洽动机」，均未给出放人/自白/束缚/无伤四类**结构**口径；
 *   villainHint 来自 antagonist-quality（反派画像：缺席/纸老虎/无动机），
 *   与「占优却放人/刀下自白/看守法儿戏/致命无伤」的事件级判定不重叠。
 * - 坐实：四类翻盘漏洞在撰写师首轮与润色师首轮零前置教学——先写错再打回
 *   重写，白付 retry token（v2.157）。
 *
 * 本文件锁八件事：
 * 1. 四类硬伤全列（放人/自白/束缚/光环）并给出可执行替代动作。
 * 2. 量化口径与检测同源：放人 1 处 mid、≥2 处 high；自白 1 处 mid、≥2 处 high；
 *    束缚 1 处 low、≥2 处 mid；光环 1 处 mid、≥2 处 high；2 行/4 行/3 行窗口；
 *    智取每处回补 2 分、最多 6 分。
 * 3. 同源自证：放人探针被判 ≥2 处、severity=high 的 villain_spares_hero，
 *    指令点名同款禁令句式。
 * 4. 边界：反派说破秘密的台词写法归 subtext-check；致命事件后的伤口无痕归场记。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文，含四类英文名与 clever 正信号。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入。
 * 8. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PA = require('../dist/engine/plot-armor-check.js');
const { buildPlotArmorDirective, plotArmorCheck } = PA;

// 放人探针：两场都是「控制态 + 处决命令后 2 行内离场」，应判 2 处 villain_spares_hero（第 2 处 high）
const PROBE = `场景1：仓库
赵天成：把他绑在柱子上。
赵天成：处理掉他。
赵天成：转身就走。
林晚：挣脱了。
场景2：天台
赵天成：把她绑在椅子上。
赵天成：干掉他。
赵天成：扬长而去。`;

// ==================== 1. 四类硬伤 + 可执行替代 ====================

test('zh 指令列全四类硬伤并给出可执行替代', () => {
  assert.strictEqual(typeof buildPlotArmorDirective, 'function', 'buildPlotArmorDirective 必须存在');
  const d = buildPlotArmorDirective('LIVE', 'zh');
  for (const k of ['放人', '自白', '束缚', '光环']) {
    assert.ok(d.includes(k), `必须列出硬伤：${k}`);
  }
  assert.ok(d.includes('盯着执行到底'), '放人必须给可执行替代（盯着执行到底）');
  assert.ok(d.includes('毫发无伤'), '光环必须点名与 MIRACLE_ZH 同源的禁令句式');
  assert.ok(d.includes('真的倒下'), '光环必须给可执行替代（真的倒下）');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：mid/high/low 分级 + 2/4/3 行窗口 + 智取回补', () => {
  const d = buildPlotArmorDirective('LIVE', 'zh');
  assert.ok(d.includes('1 处 mid') && d.includes('2 处及以上 high'), '放人必须写 1 处 mid / ≥2 处 high');
  assert.ok(d.includes('4 行内'), '自白必须写 4 行内脱身窗口');
  assert.ok(d.includes('2 行内'), '放人必须写 2 行内离场窗口');
  assert.ok(d.includes('3 行内'), '光环必须写 3 行内无伤窗口');
  assert.ok(d.includes('1 处 low') && d.includes('2 处及以上 mid'), '束缚必须写 1 处 low / ≥2 处 mid');
  assert.ok(d.includes('回补 2 分') && d.includes('最多 6 分'), '必须教智取回补口径');
});

// ==================== 3. 同源自证 ====================

test('同源自证：放人探针被判 ≥2 处 high，指令点名同款禁令句式', () => {
  const res = plotArmorCheck(PROBE, 'zh');
  assert.ok(res.sparesCount >= 2, '探针应判 ≥2 处占优放人');
  const hit = res.issues.find((i) => i.type === 'villain_spares_hero');
  assert.ok(hit, '必须报 villain_spares_hero');
  assert.strictEqual(hit.severity, 'high', '≥2 处时应为 high');
  const d = buildPlotArmorDirective('LIVE', 'zh');
  assert.ok(d.includes('处理掉他'), '必须点名与 KILLORDER_ZH 同源的禁令句式');
  assert.ok(d.includes('转身就走'), '必须点名与 LEAVE_ZH 同源的禁令句式');
});

// ==================== 4. 边界：与潜台词 / 场记分工 ====================

test('边界：说破秘密的台词归潜台词，事后伤口无痕归场记', () => {
  const d = buildPlotArmorDirective('LIVE', 'zh');
  assert.ok(d.includes('台词潜台词'), '必须显式引用 subtext-check 以避免重复教学');
  assert.ok(d.includes('场记'), '必须显式交代事后伤口无痕归场记一致性');
  assert.ok(d.includes('说完还留了逃脱窗口'), '必须把本清单范围限定在结构窗口');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildPlotArmorDirective('LIVE', 'zh');
  const aigc = buildPlotArmorDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildPlotArmorDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，含四类英文名与 clever 正信号', () => {
  const en = buildPlotArmorDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/villain spares/i.test(en), '必须含 villain spares');
  assert.ok(/monologue/i.test(en), '必须含 monologue');
  assert.ok(/restraint/i.test(en), '必须含 restraint');
  assert.ok(/plot armor/i.test(en), '必须含 plot armor');
  assert.ok(/clever/i.test(en), '必须含 clever 正信号');
  assert.ok(en.includes('2'), '英文层必须同样给出窗口与分级口径');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildPlotArmorDirective[^}]*\} from '\.\.\/engine\/plot-armor-check'/.test(src),
    '必须从 plot-armor-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/plotArmorDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'plot-armor-check.ts'), 'utf8');
  assert.ok(engine.includes('export function plotArmorCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildPlotArmorDirective'), '教学函数必须与检测同文件');
});
