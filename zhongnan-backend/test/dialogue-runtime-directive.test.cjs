/**
 * v2.369 「台词朗读时长超单集预算」前置教学指令（buildDialogueRuntimeDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - dialogue-runtime-check.ts 的 dialogueRuntimeCheck（v2.350）只在生成后消费：
 *   pipeline 首扫（L2169）/ 修复后随轮重算（L2356）/ high 触发重试（L2450）/
 *   重试 advice 注入（L2789-2792）/ 终稿重算（L3230）。
 * - 证伪面：scriptFormatDirective 只给字数带（LIVE 800-1000 / AIGC 1200-1500）
 *   与每场约 250 字，不提朗读秒数、不提只算台词行、不提单集时长预算；
 *   dialogueDirective 只管口语风格与句长，不管集总时长；
 *   aigc-screenplay 的 18-28% 是画面/台词配比，不是时长约束；
 *   estimateSpeechSeconds 只服务 /listen 端点，零进生成管线；
 *   全仓无任何 build*Runtime*Directive。
 * - 坐实：台词段合计朗读秒数 vs 单集预算（LIVE 90 秒 / AIGC 时长×60×0.9）
 *   + 85% 贴近 / >100% 超支分级，撰写师与润色师首轮零教学——先写超支再打回，
 *   白付 retry token（v2.157）。
 *
 * 本文件锁九件事：
 * 1. 计数口径（只算台词行）与压回预算的可执行动作。
 * 2. 量化口径与检测同源：4.3 字/秒、2.6 词/秒、0.35/0.15 秒停顿、90 秒、×60×0.9、85%。
 * 3. 同源自证：台词塞满探针判 high 且 spokenSeconds>budget，指令点名同款预算。
 * 4. 分级：85%-100% mid / >100% high。
 * 5. 边界：字数带 / 发声比 / 单句长度 / 台词风格 / 单集预算五项分工。
 * 6. LIVE/AIGC 制式分叉；缺省格式=LIVE。
 * 7. en 层零中文，含量化数字与替代动作。
 * 8. pipeline 同源 import + 撰写师/润色师两处注入。
 * 9. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RT = require('../dist/engine/dialogue-runtime-check.js');
const { dialogueRuntimeCheck, buildDialogueRuntimeDirective } = RT;

// 超支探针：9 句长台词塞满单集（汉字 ≈430，朗读 ≈100 秒 > LIVE 90 秒预算）
const HEAVY = `场景1：会议室
顾言：这份协议我已经看过了，条款一条条都在算计我，你让我在这样的纸上签字，是不是觉得我顾家没人了？
林晚：顾总，合同是双方律师逐条谈下来的，每个数字都有依据，您现在推翻全部条款，等于是把三个月的谈判全部作废。
顾言：三个月？你们三个月谈的就是怎么把我架空，把顾氏的现金流抽干，你以为我看不出来你们在等什么？
林晚：我们没有等任何东西，账目、报表、凭证全部摆在这里，您随时可以让审计进场，一笔一笔地查。
顾言：审计？审计的人是不是早就被你们买通了，我签字之后，顾氏就是我亲手送出去的嫁妆？
林晚：您如果坚持这样想，那今天确实没什么可谈的，我回去向董事会如实汇报您的态度。
顾言：汇报？你去汇报的时候，记得告诉他们，我顾言这辈子不会在任何一份要我命的文件上签字。
林晚：那就请顾总准备好迎接董事会的决议，以及随之而来的一切后果。
顾言：后果？我早就准备好了，就等着看你们这出戏怎么收场，看看谁先撑不住。
林晚：顾总，董事会明天上午九点开会，您今晚还有一整夜的时间重新考虑，别把话说死了。
顾言：不必等明天，现在就把我这句话记下来，顾氏的每一分钱，都轮不到你们来安排。`;

// ==================== 1. 计数口径 + 可执行替代 ====================

test('zh 指令交代只算台词行，并给出压回预算的可执行动作', () => {
  assert.strictEqual(typeof buildDialogueRuntimeDirective, 'function', 'buildDialogueRuntimeDirective 必须存在');
  const d = buildDialogueRuntimeDirective('LIVE', 'zh');
  assert.ok(d.includes('只累计台词行'), '必须写明只累计台词行');
  assert.ok(d.includes('△ 动作行'), '必须写明 △ 动作行不计入朗读');
  assert.ok(d.includes('场头'), '必须写明场头不计入朗读');
  assert.ok(d.includes('合并同类表态'), '必须给可执行替代（合并同类表态）');
  assert.ok(d.includes('转给 △ 动作行'), '必须给可执行替代（信息转给动作行）');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：4.3/2.6 语速 + 0.35/0.15 停顿 + 90 秒 / ×60×0.9 / 85%', () => {
  const d = buildDialogueRuntimeDirective('LIVE', 'zh');
  assert.ok(d.includes('4.3 字/秒'), '必须写汉字 4.3 字/秒');
  assert.ok(d.includes('2.6 词/秒'), '必须写英文 2.6 词/秒');
  assert.ok(d.includes('0.35 秒'), '必须写句末标点 0.35 秒');
  assert.ok(d.includes('0.15 秒'), '必须写句中停顿 0.15 秒');
  assert.ok(d.includes('单集 90 秒'), '必须写 LIVE 单集 90 秒预算');
  assert.ok(d.includes('×60×0.9'), '必须写 AIGC 预算口径 durationMin×60×0.9');
  assert.ok(d.includes('85%'), '必须写贴近上限阈值 85%');
});

// ==================== 3. 同源自证 ====================

test('同源自证：台词塞满探针判 high 且 spokenSeconds>budget，指令点名同款预算', () => {
  const r = dialogueRuntimeCheck(HEAVY, 'LIVE', 'zh', 1);
  assert.strictEqual(r.checked, true, '探针应进入检测');
  assert.strictEqual(r.severity, 'high', '超支探针应判 high');
  assert.ok(r.spokenSeconds > r.budgetSeconds, `spokenSeconds ${r.spokenSeconds} 应超过预算 ${r.budgetSeconds}`);
  assert.strictEqual(r.budgetSeconds, 90, 'LIVE 预算应为 90 秒');
  const d = buildDialogueRuntimeDirective('LIVE', 'zh');
  assert.ok(d.includes('单集 90 秒'), '指令预算必须与检测同源（90 秒）');
});

test('AIGC 预算随成片时长：缺省 1 分钟 = 54 秒', () => {
  const r = dialogueRuntimeCheck(HEAVY, 'AIGC', 'zh', 1);
  assert.strictEqual(r.budgetSeconds, 54, 'AIGC 1 分钟预算应为 54 秒（×60×0.9）');
  const d = buildDialogueRuntimeDirective('AIGC', 'zh');
  assert.ok(d.includes('54 秒'), '指令必须点名 AIGC 缺省 54 秒');
});

// ==================== 4. 分级 ====================

test('分级：85%-100% 报 mid，>100% 报 high', () => {
  const d = buildDialogueRuntimeDirective('LIVE', 'zh');
  assert.ok(d.includes('85%-100%'), '必须写贴近上限区间 85%-100%');
  assert.ok(d.includes('mid'), '必须写贴近上限报 mid');
  assert.ok(d.includes('>100%'), '必须写超支区间 >100%');
  assert.ok(d.includes('high'), '必须写超支报 high');
});

// ==================== 5. 边界五项分工 ====================

test('边界：字数带 / 发声比 / 单句长度 / 台词风格 / 单集预算各自归位', () => {
  const d = buildDialogueRuntimeDirective('LIVE', 'zh');
  assert.ok(d.includes('script-format'), '必须显式划界字数带归 script-format');
  assert.ok(d.includes('aigc-screenplay'), '必须显式划界发声比归 aigc-screenplay');
  assert.ok(d.includes('dialogue-length-score'), '必须显式划界单句长度');
  assert.ok(d.includes('台词风格'), '必须显式划界口语风格归台词风格策略');
  assert.ok(d.includes('单集预算'), '必须声明只管台词秒数 vs 单集预算');
});

// ==================== 6. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教台词与 △ 交替；AIGC 教「不加 △」；缺省 LIVE', () => {
  const live = buildDialogueRuntimeDirective('LIVE', 'zh');
  const aigc = buildDialogueRuntimeDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行交替');
  assert.ok(!live.includes('不加 △'), 'LIVE 不得沿用 AIGC 口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.strictEqual(buildDialogueRuntimeDirective(undefined, 'zh'), live, '缺省格式应为 LIVE');
});

// ==================== 7. en 层零中文 ====================

test('en 指令零中文，含量化数字与替代动作', () => {
  const en = buildDialogueRuntimeDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(en.includes('4.3'), '必须含 4.3 chars/second');
  assert.ok(en.includes('2.6'), '必须含 2.6 words/second');
  assert.ok(en.includes('0.35') && en.includes('0.15'), '必须含 0.35/0.15 秒停顿');
  assert.ok(en.includes('90'), '必须含 LIVE 90 seconds');
  assert.ok(en.includes('85%') && en.includes('100%'), '必须含 85% / 100% 分级');
  assert.ok(en.includes('54'), '必须含 AIGC 54 秒缺省');
  assert.ok(/triangle action lines/i.test(en), '必须教 △ 动作行不计入朗读');
});

// ==================== 8. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildDialogueRuntimeDirective[^}]*\} from '\.\.\/engine\/dialogue-runtime-check'/.test(src),
    '必须从 dialogue-runtime-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/dialogueRuntimeDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'dialogue-runtime-check.ts'), 'utf8');
  assert.ok(engine.includes('export function dialogueRuntimeCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildDialogueRuntimeDirective'), '教学函数必须与检测同文件');
});
