/**
 * v2.359 「展示而非叙述」前置教学指令（buildShowDontTellDirective）守卫
 *
 * 缺口坐实（勘察先证伪再坐实）：
 * - show-dont-tell.ts 的 showDontTellScan 检测五类「小说腔」（直接说情绪 / 总结
 *   代替场景 / 抽象形容 / 内心独白 / 连续纯叙述），占 format 维度 20% 权重，
 *   历史上只在生成后 QC 与重试 advice 消费（pipeline L2535 sdtAdvice）。
 * - 撰写师首轮 prompt 零「Show, don't tell」教学：LIVE 版式只教「不得连续 3 行
 *   无 △ 纯叙述」（仅覆盖第 5 类），直接说情绪/总结/抽象形容/内心独白四类全靠
 *   事后打回——先错再纠，白付整轮 retry token（v2.157 前置教学铁律）。
 * - 英文层同样缺失；且 AIGC 制式「正文不加 △、内心走（内心：…）」与 LIVE 版式
 *   哲学相反，教学必须按制式分发，否则教出与版式打架的指令。
 *
 * 本文件锁六件事：
 * 1. zh 指令与 showDontTellScan 五类检测一一对应（同源同文件）。
 * 2. 同源具体信号：抽象形容/总结/内心独白的禁用示例与检测词库同款。
 * 3. 制式分叉：LIVE 教 △ 动作行；AIGC 教「不加 △」且内心只走（内心：…）。
 * 4. 台词行「（情绪/动作）」括号属表演提示允许，防与版式要求自相矛盾。
 * 5. en 层零中文且含五类英文禁令。
 * 6. pipeline 接线源码守卫：撰写师首轮 + 润色师两处注入，且从同源文件 import。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SDT = require('../dist/engine/show-dont-tell.js');
const { buildShowDontTellDirective, showDontTellScan } = SDT;

// ==================== 1. zh 指令：与五类检测一一对应 ====================

test('zh 指令覆盖 showDontTellScan 五类检测（情绪/总结/抽象/内心/纯叙述）', () => {
  assert.strictEqual(typeof buildShowDontTellDirective, 'function', 'buildShowDontTellDirective 必须存在');
  const d = buildShowDontTellDirective('LIVE', 'zh');
  assert.ok(d.includes('情绪'), '必须教「直接说情绪」');
  assert.ok(d.includes('总结'), '必须教「总结代替场景」');
  assert.ok(d.includes('抽象'), '必须教「抽象形容」');
  assert.ok(d.includes('内心'), '必须教「内心独白」');
  assert.ok(d.includes('纯叙述'), '必须教「连续纯叙述」');
  assert.ok(d.includes('动作'), '必须教替代原则：情绪落成可见动作');
});

test('zh 指令与检测词典同源（感到/心里很/聊了很久/心想/抽象形容示例）', () => {
  const d = buildShowDontTellDirective('LIVE', 'zh');
  // 与 TELL_EMOTION_ZH / SUMMARY_ZH / INNER_MONO_ZH / ABSTRACT_ADJ_ZH 同款信号
  assert.ok(d.includes('感到很'), '缺「感到很+情绪」同源示例');
  assert.ok(d.includes('心里很'), '缺「心里很+情绪」同源示例');
  assert.ok(d.includes('聊了很久'), '缺「他们聊了很久」同源示例');
  assert.ok(d.includes('心想'), '缺「心想」同源示例');
  assert.ok(d.includes('美丽的') && d.includes('神秘的'), '缺抽象形容同源示例');
  // 同源自证：喂一个应触发样本，检测器确实报出这些问题类型
  const probe = showDontTellScan('他感到很生气，心里很慌。他们聊了很久。她心想，这条裙子真美丽。他还记得那天。', 'zh');
  const types = probe.issues.map((i) => i.type);
  assert.ok(types.includes('tell_emotion'), '检测器应报 tell_emotion');
  assert.ok(types.includes('inner_monologue'), '检测器应报 inner_monologue');
});

// ==================== 2. 制式分叉：LIVE △ vs AIGC 流畅自然段 ====================

test('LIVE 教 △ 动作行；AIGC 教「不加 △」且内心只走（内心：…）', () => {
  const live = buildShowDontTellDirective('LIVE', 'zh');
  const aigc = buildShowDontTellDirective('AIGC', 'zh');
  assert.ok(live.includes('每个动作独占 △ 行'), 'LIVE 必须教 △ 独占一行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得教 LIVE 的 △ 独占行（两种版式哲学相反）');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例括号');
  assert.strictEqual(buildShowDontTellDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

test('台词行「（情绪/动作）」括号明确列为表演提示例外（不与版式打架）', () => {
  const d = buildShowDontTellDirective('LIVE', 'zh');
  assert.ok(d.includes('表演提示'), '必须说明台词行括号是给演员的表演提示');
  assert.ok(d.includes('例外'), '必须显式标注例外');
  assert.ok(d.includes('（情绪/动作）'), '必须点名台词行的情绪/动作括号形态');
});

// ==================== 3. en 层：零中文 ====================

test('en 指令零中文，且含五类英文禁令', () => {
  const d = buildShowDontTellDirective('LIVE', 'en');
  assert.ok(!/[一-鿿]/.test(d), 'en 指令必须零中文');
  assert.ok(/show,?\s*don'?t tell/i.test(d), 'en 必须点名 Show, don’t tell');
  assert.ok(/name an emotion|felt angry/i.test(d), 'en 必须禁「直接说情绪」');
  assert.ok(/summarize a scene|talked for a while/i.test(d), 'en 必须禁「总结代替场景」');
  assert.ok(/abstract adjectives|beautiful/i.test(d), 'en 必须禁「抽象形容」');
  assert.ok(/inner[- ]monologue/i.test(d), 'en 必须禁「内心独白」');
  assert.ok(/△/.test(d) && /3 consecutive/i.test(d), 'en 必须教 △ 动作行与连续纯叙述上限');
  assert.ok(/(inner: …)/.test(d), 'en 必须给 AIGC 的 (inner: …) 例外口径');
});

// ==================== 4. pipeline 接线源码守卫 ====================

test('pipeline 接线：从 show-dont-tell 同源 import，且注入撰写师首轮与润色师', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /from '\.\.\/engine\/show-dont-tell'/.test(src) && /buildShowDontTellDirective/.test(src),
    'pipeline 必须从 ../engine/show-dont-tell import buildShowDontTellDirective（同源单文件）',
  );
  const uses = src.match(/sdtDirective/g) ?? [];
  assert.ok(uses.length >= 3, `sdtDirective 至少出现 3 次（定义+撰写师+润色师），实得 ${uses.length}`);
  // 同源自证：教学函数与检测器同文件
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'show-dont-tell.ts'), 'utf8');
  assert.ok(engine.includes('export function showDontTellScan'), '检测器必须在 show-dont-tell.ts');
  assert.ok(engine.includes('export function buildShowDontTellDirective'), '教学必须在同一文件（同源铁律）');
});
