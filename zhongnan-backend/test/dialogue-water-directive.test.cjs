/**
 * v2.361 「台词信息密度」前置教学指令（buildDialogueWaterDirective）守卫
 *
 * 缺口坐实（勘察先证伪再坐实）：
 * - dialogue-water-check.ts 的 dialogueWaterCheck 检测五类水分台词（寒暄 / 不推进 /
 *   重复已知 / 过长铺垫 / 无功能），v2.115 起只在生成后 QC 三处扫描 + 重试 advice
 *   （pipeline L2557 dialogueWaterAdvice）+ fix-playbook 事后修复清单里消费。
 * - 撰写师首轮 prompt 零「台词必须有用」教学：buildVoiceDirective 只教口语化
 *   （允许断句/口头语/不完美），script-format ④ 只教「单句≤30字」，creation-strategy
 *   的台词策略仅 sharp 一档提到「删掉一切废话」——五类水分本身无任何首轮教学，
 *   只能先写错再打回重写（v2.157 前置教学铁律）。
 * - en 层同样缺失；且 LIVE（△ 动作行）与 AIGC（流畅自然段、不加 △、内心（内心：…））
 *   版式哲学相反，教学必须按制式分发。
 *
 * 本文件锁七件事：
 * 1. zh 指令覆盖 dialogueWaterCheck 五类检测与四条量化阈值（同源同文件）。
 * 2. 同源自证：检测器探针确实报 greeting / repeat，指令点名同款信号词。
 * 3. 制式分叉：LIVE 教 △ 动作行；AIGC 教「不加 △」+（内心：…）。
 * 4. 短促冲突爆点（滚/闭嘴/放手等）显式列为例外，防与检测器 emotionWords 打架。
 * 5. en 层零中文且含五类英文禁令 + 阈值。
 * 6. pipeline 接线：撰写师首轮 + 润色师两处注入，且同源 import。
 * 7. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DW = require('../dist/engine/dialogue-water-check.js');
const { buildDialogueWaterDirective, dialogueWaterCheck } = DW;

// ==================== 1. zh 指令：五类检测 + 量化阈值同源 ====================

test('zh 指令覆盖 dialogueWaterCheck 五类水分（寒暄/不推进/重复/铺垫/无功能）', () => {
  assert.strictEqual(typeof buildDialogueWaterDirective, 'function', 'buildDialogueWaterDirective 必须存在');
  const d = buildDialogueWaterDirective('LIVE', 'zh');
  assert.ok(d.includes('寒暄'), '必须教「寒暄型」');
  assert.ok(d.includes('不推进') || d.includes('闲聊'), '必须教「不推进型」');
  assert.ok(d.includes('复述') || d.includes('重复'), '必须教「重复已知信息」');
  assert.ok(d.includes('铺垫'), '必须教「过长铺垫」');
  assert.ok(d.includes('无功能'), '必须教「无功能台词」');
  // 四项功能判定与检测器 advice 同款口径
  for (const k of ['推进剧情', '塑造人物', '制造冲突', '传递信息']) {
    assert.ok(d.includes(k), `缺功能判定口径「${k}」`);
  }
});

test('zh 指令阈值与检测器同源（25% 水分率 / 2 句寒暄 / 30% 无功能）', () => {
  const d = buildDialogueWaterDirective('LIVE', 'zh');
  assert.ok(/25%/.test(d), '水分率阈值必须与检测器 mid 线（>25%）对齐');
  assert.ok(/30%/.test(d), '无功能台词阈值必须与检测器 low 线（>30%）对齐');
  assert.ok(d.includes('2 句') || d.includes('两句'), '寒暄阈值必须与检测器（>2 句）对齐');
});

// ==================== 2. 同源自证：检测器探针 ====================

test('同源自证：检测器探针报 greeting/repeat，指令点名同款信号词', () => {
  const probe = dialogueWaterCheck('张总：你好。\n李四：我告诉你了。\n张总：那就签吧。', 'zh');
  const types = probe.hits.map((h) => h.waterType);
  assert.ok(types.includes('greeting'), '检测器应报 greeting');
  assert.ok(types.includes('repeat'), '检测器应报 repeat');
  const d = buildDialogueWaterDirective('LIVE', 'zh');
  assert.ok(d.includes('你好'), '缺寒暄同源示例「你好」');
  assert.ok(d.includes('我告诉过你'), '缺重复同源示例「我告诉过你」');
});

// ==================== 3. 制式分叉：LIVE △ vs AIGC 流畅自然段 ====================

test('LIVE 教 △ 动作行；AIGC 教「不加 △」且内心只走（内心：…）', () => {
  const live = buildDialogueWaterDirective('LIVE', 'zh');
  const aigc = buildDialogueWaterDirective('AIGC', 'zh');
  assert.ok(live.includes('每个动作独占 △ 行'), 'LIVE 必须教 △ 独占一行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得教 LIVE 的 △ 独占行（版式哲学相反）');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例括号');
  assert.strictEqual(buildDialogueWaterDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 4. 短促冲突爆点是例外 ====================

test('短促冲突爆点（滚/闭嘴/放手）显式例外，不与检测器 emotionWords 打架', () => {
  const d = buildDialogueWaterDirective('LIVE', 'zh');
  assert.ok(d.includes('滚') && d.includes('闭嘴'), '必须点名短促爆点示例');
  assert.ok(d.includes('例外'), '必须显式标注例外');
});

// ==================== 5. en 层：零中文 ====================

test('en 指令零中文，且含五类英文禁令与阈值', () => {
  const d = buildDialogueWaterDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(d), 'en 指令必须零中文');
  assert.ok(/greeting/i.test(d), 'en 必须禁 greeting-only lines');
  assert.ok(/advance the plot|story/i.test(d), 'en 必须教「推进剧情」');
  assert.ok(/build character|character/i.test(d), 'en 必须教「塑造人物」');
  assert.ok(/create conflict|conflict/i.test(d), 'en 必须教「制造冲突」');
  assert.ok(/repeating|repeat|already/i.test(d), 'en 必须禁「重复已知信息」');
  assert.ok(/setup/i.test(d), 'en 必须禁「过长铺垫」');
  assert.ok(/25%/i.test(d) && /30%/i.test(d), 'en 必须给 25%/30% 阈值');
  assert.ok(/△/.test(d), 'en 必须教 △ 动作行');
  assert.ok(/flowing prose/i.test(d) && /\(inner:/.test(d), 'en 必须给 AIGC 流畅本 + (inner: …) 口径');
});

// ==================== 6. pipeline 接线源码守卫 ====================

test('pipeline 接线：同源 import，撰写师首轮 + 润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /from '\.\.\/engine\/dialogue-water-check'/.test(src) && /buildDialogueWaterDirective/.test(src),
    'pipeline 必须从 ../engine/dialogue-water-check import buildDialogueWaterDirective（同源单文件）',
  );
  const uses = src.match(/waterDirective/g) ?? [];
  assert.ok(uses.length >= 3, `waterDirective 至少出现 3 次（定义+撰写师+润色师），实得 ${uses.length}`);
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'dialogue-water-check.ts'), 'utf8');
  assert.ok(engine.includes('export function dialogueWaterCheck'), '检测器必须在 dialogue-water-check.ts');
  assert.ok(engine.includes('export function buildDialogueWaterDirective'), '教学必须在同一文件（同源铁律）');
});
