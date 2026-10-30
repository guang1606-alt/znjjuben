/**
 * v2.364 「台词潜台词」前置教学指令（buildSubtextDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - subtext-check.ts 的 subtextCheck（v2.135）只在生成后消费：
 *   pipeline 首扫（L2131）/ 修复后重算（L2331）/ high 打回重试（L2410）/
 *   重试 advice 注入（L2689）/ 终稿重算（L3205）。
 * - 证伪面：mode-craft 只有一句「台词要有潜台词……避免说明性台词」（且
 *   buildModeCraftDirective 无 mode 时返回空串）；show-dont-tell 只禁叙述句直报
 *   情绪，并明确写「台词行括号里的情绪/动作是表演提示，允许保留」——反而容易被
 *   撰写师读成「台词里喊情绪没关系」，与 named_emotion（≥3 处）检测直接相冲；
 *   expoHint / villainHint / subtextEraseHint 都是生成后定向提示，非首轮教学。
 * - 坐实：底牌直给 / 反派自曝 / 知情者科普 / 问答喂信息 / 情绪直报 五类口径
 *   在撰写师首轮与润色师首轮零教学——先写错再打回重写，白付 retry token（v2.157）。
 *
 * 本文件锁八件事：
 * 1. 五类硬伤全列（底牌/反派自曝/知情者/问答/情绪直报），并给出可执行替代动作。
 * 2. 量化口径与检测同源：on-nose 1 处 mid、≥2 处 high；反派 1 处硬伤；
 *    知情者 2 句起报；问答 2 组起报；情绪直报 3 处起报；回避 3 处回补 1 分。
 * 3. 同源自证：底牌探针被判 high 的 on_the_nose_declaration，指令点名同款禁令。
 * 4. 与 show-dont-tell 的边界：台词括号=表演提示允许，台词正文禁喊情绪名。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文，含五类英文名与 deflection 正信号。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入。
 * 8. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SB = require('../dist/engine/subtext-check.js');
const { buildSubtextDirective, subtextCheck } = SB;

// 底牌直给探针：2 句把真实目的/全盘计划念出口，应判 high 的 on_the_nose_declaration
const PROBE = `场景一 密室
赵天成：我告诉你一个秘密，我从来没有告诉过任何人。
林晚：你说。
赵天成：我接近你就是为了拿回赵家的股份。
林晚：你……
赵天成：这一切都是我安排的，连那场车祸也在计划里。
苏晴：你疯了。
赵天成：现在你什么都知道了。
林晚：为什么要告诉我这些。
赵天成：因为你已经没有翻盘的机会了。`;

// ==================== 1. 五类硬伤 + 可执行替代 ====================

test('zh 指令列全五类硬伤并给出可执行替代', () => {
  assert.strictEqual(typeof buildSubtextDirective, 'function', 'buildSubtextDirective 必须存在');
  const d = buildSubtextDirective('LIVE', 'zh');
  for (const k of ['底牌', '反派自曝', '知情者', '问答', '情绪直报']) {
    assert.ok(d.includes(k), `必须列出硬伤：${k}`);
  }
  assert.ok(d.includes('反常动作'), '底牌直给必须给可执行替代（反常动作）');
  assert.ok(d.includes('你猜我为什么留你到现在'), '反派自曝必须给赢家消遣式台词范例');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：1 处 mid / 2 处 high / 2 句 / 2 组 / 3 处 / 回避回补', () => {
  const d = buildSubtextDirective('LIVE', 'zh');
  assert.ok(d.includes('1 处') && d.includes('mid'), '必须写「1 处 = mid」');
  assert.ok(d.includes('2 处') && d.includes('high'), '必须写「≥2 处 = high」');
  assert.ok(d.includes('2 句'), '知情者科普必须写「2 句起报」');
  assert.ok(d.includes('2 组'), '问答喂信息必须写「2 组起报」');
  assert.ok(d.includes('3 处'), '情绪直报必须写「3 处起报」');
  assert.ok(d.includes('回避') && d.includes('3'), '必须教回避正信号与回补口径');
});

// ==================== 3. 同源自证 ====================

test('同源自证：底牌探针被判 high，指令点名同款禁令', () => {
  const res = subtextCheck(PROBE, 'zh');
  assert.ok(res.onTheNoseCount >= 2, '探针底牌直给应≥2 处');
  const hit = res.issues.find((i) => i.type === 'on_the_nose_declaration');
  assert.ok(hit && hit.severity === 'high', '探针应被判 high 的 on_the_nose_declaration');
  const d = buildSubtextDirective('LIVE', 'zh');
  assert.ok(d.includes('我接近你就是为了'), '必须点名与 ON_NOSE_ZH 同源的禁令句式');
  assert.ok(d.includes('这一切都是我安排的'), '必须点名与 ON_NOSE_ZH 同源的禁令句式');
});

// ==================== 4. 与 show-dont-tell 的边界 ====================

test('边界：台词括号是表演提示允许，台词正文禁喊情绪名', () => {
  const d = buildSubtextDirective('LIVE', 'zh');
  assert.ok(d.includes('括号') && d.includes('表演提示'), '必须交代台词括号=表演提示，允许保留');
  assert.ok(d.includes('台词正文'), '必须明确被禁的是台词正文');
  assert.ok(d.includes('展示而非叙述'), '必须显式引用 show-dont-tell 以避免边界误读');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildSubtextDirective('LIVE', 'zh');
  const aigc = buildSubtextDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildSubtextDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，含五类英文名与 deflection 正信号', () => {
  const en = buildSubtextDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/on-the-nose/i.test(en), '必须含 on-the-nose');
  assert.ok(/villain/i.test(en), '必须含 villain exposition');
  assert.ok(/as-you-know/i.test(en), '必须含 as-you-know');
  assert.ok(/q&a/i.test(en), '必须含 Q&A exposition');
  assert.ok(/named emotion/i.test(en), '必须含 named emotion');
  assert.ok(/deflect/i.test(en), '必须含 deflection 正信号');
  assert.ok(en.includes('2'), '英文层必须同样给出 ≥2 / 2 组等口径');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildSubtextDirective[^}]*\} from '\.\.\/engine\/subtext-check'/.test(src),
    '必须从 subtext-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/subtextDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'subtext-check.ts'), 'utf8');
  assert.ok(engine.includes('export function subtextCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildSubtextDirective'), '教学函数必须与检测同文件');
});
