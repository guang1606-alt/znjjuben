/**
 * v2.363 「冲突密度与升级阶梯」前置教学指令（buildConflictDensityDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - conflict-density-check.ts 的 conflictDensityCheck（v2.116）只在生成后消费：
 *   pipeline 首扫（L2091）/ 修复后重算（L2309）/ high 打回重试（L2370）/
 *   重试 advice 注入（L2567）/ 终稿重算（L3182）。
 * - 证伪面：script-format 只教制片格式；beat-system 教「钩子-冲突-转折-留白」
 *   节奏弧但不给冲突量化口径；skill-pack 只给反转/爽点密度档；conflict-escalation-check
 *   管「烈度曲线是否爬坡」，不教「每集至少几个、分布在哪、最高到哪级、类型别单一」。
 * - 坐实：冲突数量≥3 / 三段分布 / 最高等级≥对峙 / 强度递增 / 类型多样 五类口径
 *   在撰写师首轮与润色师首轮零教学——先写错再打回重写，白付 retry token（v2.157）。
 *
 * 本文件锁八件事：
 * 1. zh 指令含「每集至少 3 个冲突点」硬规则与四级强度阶梯。
 * 2. 量化口径与检测同源：count≥3、强度线 55（对峙）、三段分布、强度递增。
 * 3. 同源自证：探针确实被判 low_density，指令点名同款信号词。
 * 4. 类型多样：情感/利益/权力/身份/生死，禁止单一类型。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文，且含 at least 3 conflicts 与 escalation ladder。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入。
 * 8. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CD = require('../dist/engine/conflict-density-check.js');
const { buildConflictDensityDirective, conflictDensityCheck } = CD;

// 低密度探针：只有一句口角，冲突数远不足 3，最高等级仅口角
const PROBE = [
  '场景1：客厅·夜',
    '李秀兰：你凭什么管我。',
    '张总：我是你爸。',
    '李秀兰：那又怎样。',
    '张总：坐下。',
].join('\n');

// ==================== 1. zh 硬规则 + 四级强度阶梯 ====================

test('zh 指令含每集至少 3 个冲突点与四级强度阶梯', () => {
  assert.strictEqual(typeof buildConflictDensityDirective, 'function', 'buildConflictDensityDirective 必须存在');
  const d = buildConflictDensityDirective('LIVE', 'zh');
  assert.ok(d.includes('至少 3 个冲突点'), '必须教「每集至少 3 个冲突点」');
  for (const k of ['口角', '对峙', '肢体冲突', '生死对抗']) {
    assert.ok(d.includes(k), `必须列出强度阶梯：${k}`);
  }
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：数量≥3、强度线 55、三段分布、强度递增', () => {
  const d = buildConflictDensityDirective('LIVE', 'zh');
  assert.ok(d.includes('30') && d.includes('55') && d.includes('80') && d.includes('95'), '必须写四级强度数值 30/55/80/95');
  assert.ok(d.includes('55'), '必须写「最高冲突等级≥对峙（55）」');
  assert.ok(d.includes('开头') && d.includes('中段') && d.includes('结尾'), '必须写三段分布');
  assert.ok(d.includes('递增') || d.includes('从小到大'), '必须教冲突强度递增');
  assert.ok(d.includes('3 个') || d.includes('三个'), '必须写数量阈值 3');
});

// ==================== 3. 同源自证 ====================

test('同源自证：探针被判 low_density，指令点名同款信号词', () => {
  const res = conflictDensityCheck(PROBE, 'zh');
  assert.ok(res.count < 3, '探针冲突数应不足 3');
  const types = res.issues.map((i) => i.type);
  assert.ok(types.includes('low_density'), '探针应被判 low_density');
  const d = buildConflictDensityDirective('LIVE', 'zh');
  assert.ok(d.includes('吵'), '必须点名口角信号词（与 SIGNALS_ZH 同源）');
  assert.ok(d.includes('一巴掌') || d.includes('架'), '必须点名肢体冲突信号词（与 SIGNALS_ZH 同源）');
  assert.ok(d.includes('枪') || d.includes('刀'), '必须点名生死对抗信号词（与 SIGNALS_ZH 同源）');
});

// ==================== 4. 类型多样 ====================

test('类型多样：教情感/利益/权力/身份/生死混搭，禁止单一类型', () => {
  const d = buildConflictDensityDirective('LIVE', 'zh');
  for (const k of ['情感', '利益', '权力', '身份', '生死']) {
    assert.ok(d.includes(k), `必须列出冲突类型：${k}`);
  }
  assert.ok(d.includes('单一') || d.includes('混搭') || d.includes('混合'), '必须教避免单一类型');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildConflictDensityDirective('LIVE', 'zh');
  const aigc = buildConflictDensityDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildConflictDensityDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，且含 at least 3 conflicts 与 escalation ladder', () => {
  const en = buildConflictDensityDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/at least 3 conflict/i.test(en), '必须教 at least 3 conflicts');
  assert.ok(/verbal/i.test(en) && /confront/i.test(en) && /physical/i.test(en) && /life/i.test(en), '必须列出英文强度阶梯');
  assert.ok(/escalat/i.test(en), '必须教 escalation');
  assert.ok(en.includes('55'), '英文层必须同样给出强度线 55');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildConflictDensityDirective[^}]*\} from '\.\.\/engine\/conflict-density-check'/.test(src),
    '必须从 conflict-density-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/conflictDensityDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'conflict-density-check.ts'), 'utf8');
  assert.ok(engine.includes('export function conflictDensityCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildConflictDensityDirective'), '教学函数必须与检测同文件');
});
