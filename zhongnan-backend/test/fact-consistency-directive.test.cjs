/**
 * v2.370 「同槽数值前后矛盾」前置教学指令（buildFactConsistencyDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - fact-consistency-check.ts 的 factConsistencyCheck（v2.351）只在生成后消费：
 *   pipeline 首扫（L2172）/ 修复后随轮重算（L2359）/ advice 注入（L2797）/ 终稿重算（L3233）。
 * - 证伪面：continuity-supervision（v2.139）只管物理状态（伤势/毁物/设备/束缚穿帮），
 *   不管数值；timeline-ledger 只管时刻/日期顺序，检测器显式豁免日历年（归 timeline-ledger）；
 *   邻近 death-ledger 只管死者复活；pipeline 里只有首扫/随轮/终稿/advice 四处生成后消费；
 *   全仓 grep `build*Fact*Directive|factConsistencyDirective` 零命中。
 * - 坐实：五类 UnitClass（amount 金额/age 年龄/duration 时长/people 人数/count 次/名/件）
 *   + 同槽（名词片段 + 量词类）出现 ≥2 个不同归一值 → high fact_number_conflict，
 *   每对 high 扣 22；豁免五类（场标行/第X序数/裸阿拉伯数字/方位短语/日历年 19xx-2099+年）。
 *   撰写师与润色师首轮 prompt 零教学——「借五十万后文变五百万」「25 岁变 30 岁」等
 *   数值穿帮要等全稿写完才会被检测出来，白付 retry token（v2.157）。
 *
 * 本文件锁九件事：
 * 1. 五类 UnitClass 全覆盖 + 量词示例。
 * 2. 量化口径与检测同源：每对 high 扣 22、五大类、名词槽。
 * 3. 同源自证：「借五十万」+「后来变五百万」探针判 high、score=78。
 * 4. 豁免五类（场标/第X序数/裸数字/方位短语/日历年）必须写明。
 * 5. 边界：物理状态穿帮归 continuity-supervision、时间线归 timeline-ledger、字数归 script-format。
 * 6. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 7. en 层零中文，含五类别名与 22 per pair。
 * 8. pipeline 同源 import + ≥3 处引用。
 * 9. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const FC = require('../dist/engine/fact-consistency-check.js');
const { factConsistencyCheck, buildFactConsistencyDirective } = FC;

// 矛盾探针：同槽「借款」金额前后从 50 万变 500 万
// 极短版本必须去掉「那笔」等前缀，否则 zhFragment 的 runM 尾 stop 会把「借款」前的「笔」切掉导致 fragment 漂移
const CONFLICT_ZH = `场景1：办公室
顾言：借款五十万。
△ 三个月后。
顾言：借款五百万。
林晚：什么？！`;

// 序数探针（第X次 → 应豁免）
const ORDINAL_OK = `场景1：办公室
顾言：第一次见面你就说过，第二次我不会再让步。
林晚：第三次呢？
顾言：没有第三次。`;

// 日历年探针（2024→2025 属 timeline-ledger，fact 豁免）
const CAL_OK = `场景1：客厅
顾言：2024 年我们借了 50 万。
林晚：2025 年涨到 60 万。`;

// 方位短语探针（「桌上摆着 50 万」→ 方位短语，不作槽）
const LOC_OK = `场景1：办公室
△ 桌上摆着 50 万现金，是定金。
△ 地上散落着 10 张百元钞。`;

// ==================== 1. 五类 UnitClass 全覆盖 ====================

test('zh 指令覆盖五类 UnitClass 并给量词示例', () => {
  assert.strictEqual(typeof buildFactConsistencyDirective, 'function', 'buildFactConsistencyDirective 必须存在');
  const d = buildFactConsistencyDirective('LIVE', 'zh');
  // 五类
  assert.ok(d.includes('金额') || d.includes('元'), '必须点名 amount 金额类');
  assert.ok(d.includes('岁') || d.includes('年龄'), '必须点名 age 年龄类');
  assert.ok(d.includes('年') || d.includes('个月') || d.includes('天'), '必须点名 duration 时长类');
  assert.ok(d.includes('人') || d.includes('位') || d.includes('人'), '必须点名 people 人数类');
  assert.ok(d.includes('次') || d.includes('件') || d.includes('套'), '必须点名 count 次/件/套类');
});

// ==================== 2. 量化口径同源 ====================

test('量化口径与检测同源：每对 high 扣 22 + 名词槽', () => {
  const d = buildFactConsistencyDirective('LIVE', 'zh');
  assert.ok(d.includes('22'), '必须写扣 22');
  assert.ok(d.includes('名词'), '必须点名名词槽');
  assert.ok(d.includes('量词'), '必须点名量词');
  assert.ok(d.includes('前后'), '必须点名前后矛盾');
});

// ==================== 3. 同源自证 ====================

test('同源自证：借款金额 50 万→500 万探针判 high，指令点名同款槽', () => {
  const r = factConsistencyCheck(CONFLICT_ZH, 'zh');
  assert.strictEqual(r.checked, true, '探针应进入检测');
  assert.strictEqual(r.conflictCount, 1, '应识别出 1 对冲突');
  assert.strictEqual(r.issues[0].severity, 'high', '数值前后矛盾应为 high');
  assert.strictEqual(r.score, 78, '22 分扣一次 → 78 分');
  const d = buildFactConsistencyDirective('LIVE', 'zh');
  assert.ok(d.includes('五十') || d.includes('50万') || d.includes('金额'), '指令必须点名与探针同源的槽（如金额或借款）');
  assert.ok(d.includes('五百万') || d.includes('500万'), '指令必须点名「借 50 万变 500 万」这个典型案例');
});

// ==================== 4. 豁免五类 ====================

test('豁免：第X序数、场标行、裸数字、方位短语、日历年必须写明', () => {
  const d = buildFactConsistencyDirective('LIVE', 'zh');
  assert.ok(d.includes('第') || d.includes('序数'), '必须写明第X序数豁免');
  assert.ok(d.includes('场标') || d.includes('场景'), '必须写明场标行豁免');
  assert.ok(d.includes('裸') || d.includes('无量词'), '必须写明裸阿拉伯数字豁免');
  assert.ok(d.includes('方位') || d.includes('桌上') || d.includes('里面'), '必须写明方位短语豁免');
  assert.ok(d.includes('日历年') || d.includes('19xx') || d.includes('20xx'), '必须写明日历年豁免');
  // 补充：检测本身也不能误判序数探针
  const r = factConsistencyCheck(ORDINAL_OK, 'zh');
  assert.strictEqual(r.conflictCount, 0, '序数探针应被豁免');
  // 日历年探针也应被豁免（归 timeline-ledger 管）
  const r2 = factConsistencyCheck(CAL_OK, 'zh');
  assert.strictEqual(r2.conflictCount, 0, '日历年探针应被豁免');
  // 方位短语探针应被豁免
  const r3 = factConsistencyCheck(LOC_OK, 'zh');
  assert.strictEqual(r3.conflictCount, 0, '方位短语探针应被豁免');
});

// ==================== 5. 边界 ====================

test('边界：物理状态穿帮归 continuity-supervision、时间线归 timeline-ledger、字数归 script-format', () => {
  const d = buildFactConsistencyDirective('LIVE', 'zh');
  assert.ok(d.includes('continuity-supervision') || d.includes('场记连续性') || d.includes('伤势'), '必须划界物理状态归 continuity-supervision');
  assert.ok(d.includes('timeline-ledger') || d.includes('时间线') || d.includes('日期'), '必须划界时间线归 timeline-ledger');
  assert.ok(d.includes('script-format') || d.includes('字数带'), '必须划界字数归 script-format');
});

// ==================== 6. LIVE/AIGC 制式分叉 + 缺省 LIVE ====================

test('LIVE 教「每个数值写进台词/动作」；AIGC 教「正文不加 △」；缺省 LIVE', () => {
  const live = buildFactConsistencyDirective('LIVE', 'zh');
  const aigc = buildFactConsistencyDirective('AIGC', 'zh');
  assert.ok(live.includes('△') || live.includes('台词'), 'LIVE 必须提及 △ 或明确数值落点');
  assert.ok(aigc.includes('不加 △') || aigc.includes('AIGC'), 'AIGC 必须显式提及 AIGC 制式');
  const def = buildFactConsistencyDirective();
  assert.ok(def.includes('△') || def.includes('台词'), '缺省应=LIVE 版式');
});

// ==================== 7. en 零中文 + 5 classes + 22 per pair ====================

test('en 层零中文 + five classes + 22 per pair', () => {
  const d = buildFactConsistencyDirective('LIVE', 'en');
  assert.strictEqual(/[\u4e00-\u9fff]/.test(d), false, 'en 分支零中文');
  for (const k of ['amount', 'age', 'duration', 'people', 'count']) {
    assert.ok(d.includes(k), `必须点名 unit class：${k}`);
  }
  assert.ok(d.includes('22'), '必须写扣 22');
  assert.ok(d.includes('slot') || d.includes('noun'), '必须点名名词槽（slot / noun fragment）');
});

// ==================== 8. pipeline 同源 import + ≥3 处引用 ====================

test('pipeline 同源 import + 三处消费点，指令必须被 pipeline 引用 ≥3 次', () => {
  const pp = fs.readFileSync(path.join(__dirname, '../src/agents/pipeline.ts'), 'utf-8');
  assert.ok(/import\s*\{[^}]*buildFactConsistencyDirective[^}]*\}\s*from\s*'\.\.\/engine\/fact-consistency-check'/.test(pp),
    'pipeline.ts 必须同源 import buildFactConsistencyDirective（与 factConsistencyCheck 同一 import 行）');
  const hits = (pp.match(/buildFactConsistencyDirective|factConsistencyDirective/g) || []).length;
  assert.ok(hits >= 3, `pipeline.ts 中 factConsistencyDirective 引用数应 ≥3，实际 ${hits}`);
});

// ==================== 9. 教学与检测同文件（同源铁律） ====================

test('buildFactConsistencyDirective 与 factConsistencyCheck 必须同文件', () => {
  const fcSrc = fs.readFileSync(path.join(__dirname, '../src/engine/fact-consistency-check.ts'), 'utf-8');
  assert.ok(fcSrc.includes('export function buildFactConsistencyDirective'),
    'buildFactConsistencyDirective 必须在 fact-consistency-check.ts 内（同源铁律）');
});
