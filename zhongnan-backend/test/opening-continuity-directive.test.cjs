/**
 * v2.367「跨集开场焊点」前置教学指令（buildOpeningContinuityDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - opening-continuity-check.ts 的 openingContinuityCheck（v2.80）只在生成后消费：
 *   pipeline 首扫（L2163）/ 修复后逐轮重算（L2350）/ high 打回重试（L2441）/
 *   重试 advice 注入（L2772）/ 终稿重算（L3224），另有 structural-rescan 登记与
 *   generate.ts 整集重写重算（L2304）。
 * - 证伪面：continuity-brief 只把前集结尾原句按引用透传 + 一句「本集开场必须从
 *   此瞬间无缝接起」，没有三类断焊的结构口径与阈值；hook-system 的「集首承接」
 *   只在集钩层讲钩子类型；cliffhanger-dissolve 只管「开场一句话消解上集强钩」的
 *   语义质量；timeline-ledger / location-continuity / episode-replay 各自错位；
 *   全仓 build*Directive 清点无任何开场焊点前置教学。
 * - 坐实：三类断焊（说话人全灭 / 冷开场 / 跳时间）在撰写师首轮与润色师首轮零
 *   前置教学——先写错再打回重写，白付 retry token（v2.157）。
 *
 * 本文件锁八件事：
 * 1. 三类硬伤全列（说话人全灭 / 冷开场 / 跳时间）并给出可执行替代。
 * 2. 量化口径与检测同源：开场块上限 800 字、跳时窗口 300 字、前集结尾有效线
 *    20 字、说话人取末尾 4 位；零重叠 high 扣 18 / 零星重叠 mid 扣 10 / 冷开场
 *    mid 扣 10 / 跳时间 low 扣 5；接住末位说话人 +2、2-gram 重叠 ≥3 +1。
 * 3. 同源自证：说话人全灭探针被判 high speaker_missing，指令点名同款信号词。
 * 4. 边界：接钩质量归 cliffhanger-dissolve、时间锚点归 timeline-ledger、地点归
 *    location-continuity、复读归 episode-replay、钩型归 hook-system 集钩。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文，含三类英文名与正信号。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入。
 * 8. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const OC = require('../dist/engine/opening-continuity-check.js');
const { buildOpeningContinuityDirective, openingContinuityCheck } = OC;

// 说话人全灭探针：前集结尾有台词说话人，本集开场另起炉灶（零词汇重叠）
const PREV = `顾言：你到底还是签了。
林晚：我签了。
顾言：从今天起，你不再是我顾家的人。
△ 他把离婚协议摔在桌上。`;

const OPENING_COLD = `第3集 断线

场景1：出租屋 夜 内
△ 苏晴把行李箱拖进门。
苏晴：房租我明天交。

场景2：楼道 夜 内
△ 灯忽明忽暗。`;

// ==================== 1. 三类硬伤 + 可执行替代 ====================

test('zh 指令列全三类硬伤并给出可执行替代', () => {
  assert.strictEqual(typeof buildOpeningContinuityDirective, 'function', 'buildOpeningContinuityDirective 必须存在');
  const d = buildOpeningContinuityDirective('LIVE', 'zh');
  for (const k of ['说话人全灭', '冷开场', '跳时间']) {
    assert.ok(d.includes(k), `必须列出硬伤：${k}`);
  }
  assert.ok(d.includes('另起炉灶'), '说话人全灭必须给可执行替代（先接话再交代去向）');
  assert.ok(d.includes('同一动作'), '冷开场必须给可执行替代（从同一动作接起）');
  assert.ok(d.includes('收束半句'), '跳时间必须给可执行替代（先给收束半句再跳）');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：窗口 + 分级扣分 + 正信号', () => {
  const d = buildOpeningContinuityDirective('LIVE', 'zh');
  assert.ok(d.includes('18') && d.includes('10') && d.includes('5'), '必须写 high 18 / mid 10 / low 5 扣分');
  assert.ok(d.includes('800 字'), '开场块必须写 800 字上限');
  assert.ok(d.includes('300 字'), '跳时间必须写开场前 300 字窗口');
  assert.ok(d.includes('20 字'), '必须交代前集结尾有效线（不足 20 字不检测）');
  assert.ok(d.includes('4 位'), '说话人必须写取末尾 4 位');
  assert.ok(d.includes('2-gram'), '词汇重叠必须写 2-gram 口径');
  assert.ok(d.includes('≥3'), '必须写重叠 ≥3 处回补 +1');
  assert.ok(d.includes('+2'), '必须写接住末位说话人 +2');
});

// ==================== 3. 同源自证 ====================

test('同源自证：说话人全灭探针被判 high，指令点名同款信号词', () => {
  const res = openingContinuityCheck(PREV, OPENING_COLD, 'zh');
  assert.strictEqual(res.checked, true, '前集结尾 ≥20 字必须真正检测');
  const hit = res.issues.find((i) => i.type === 'speaker_missing');
  assert.ok(hit, '必须报 speaker_missing');
  assert.strictEqual(hit.severity, 'high', '零词汇重叠时说话人全灭应为 high');
  assert.ok(res.overlapCount === 0, '探针开场应与结尾零词汇重叠');
  const d = buildOpeningContinuityDirective('LIVE', 'zh');
  assert.ok(d.includes('说话人'), '必须点名与 extractSpeakers 同源的提取对象');
  assert.ok(d.includes('名字（情绪）'), '必须点名台词行同款格式');
});

// ==================== 4. 边界：与近邻引擎分工 ====================

test('边界：接钩质量/时间锚点/地点/复读/钩型各有归属', () => {
  const d = buildOpeningContinuityDirective('LIVE', 'zh');
  assert.ok(d.includes('接钩质量'), '开场消解上集强钩必须让位给 cliffhanger-dissolve');
  assert.ok(d.includes('时间线账本'), '跨集时间锚点倒流/干旱必须让位给 timeline-ledger');
  assert.ok(d.includes('地点一致性'), '场景地点连续必须让位给 location-continuity');
  assert.ok(d.includes('跨集复读'), '上集原话复述必须让位给 episode-replay');
  assert.ok(d.includes('集钩'), '集首承接的钩子类型必须让位给 hook-system');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildOpeningContinuityDirective('LIVE', 'zh');
  const aigc = buildOpeningContinuityDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildOpeningContinuityDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，含三类英文名与正信号', () => {
  const en = buildOpeningContinuityDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/speaker/i.test(en), '必须含 speaker');
  assert.ok(/cold open/i.test(en), '必须含 cold open');
  assert.ok(/time jump/i.test(en), '必须含 time jump');
  assert.ok(/weld/i.test(en), '必须含 weld');
  assert.ok(/2-gram/i.test(en), '英文层必须同样给出重叠口径');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildOpeningContinuityDirective[^}]*\} from '\.\.\/engine\/opening-continuity-check'/.test(src),
    '必须从 opening-continuity-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/openingContinuityDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'opening-continuity-check.ts'), 'utf8');
  assert.ok(engine.includes('export function openingContinuityCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildOpeningContinuityDirective'), '教学函数必须与检测同文件');
});
