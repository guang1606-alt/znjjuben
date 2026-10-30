/**
 * v2.362 「场景目的效率」前置教学指令（buildScenePurposeDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - scene-purpose-check.ts 的 scenePurposeCheck（v2.137）只在生成后消费：
 *   pipeline 首扫（L2130）/ high 打回重试（L2409）/ 重试 advice 注入（L2696）。
 * - 证伪面：script-format 只教「3-4 个场景、每场景约 250 字」的制片格式；
 *   beat-system 教节拍不教「每场只打一件事」；buildPurposeGateDirective 是
 *   按 mode 的深度档目的闸门（且只 depth 档启用），不覆盖场景经济学。
 * - 坐实：一场多目的稀释 / 跨场重复目的 / 目的迟到 / 软收尾四类在撰写师
 *   首轮与润色师首轮零教学——先写错再打回重写，白付 retry token（v2.157）。
 *
 * 本文件锁七件事：
 * 1. zh 指令含「一场只打一拳」硬规则与五个目的簇。
 * 2. 量化口径与检测同源：6-13 行短场 ≥3 簇、55% 迟到线、末 25%/30%。
 * 3. 同源自证：探针确实被判 multi_purpose_scene + weak_exit，指令点名同款信号词。
 * 4. 重复目的：必须有升级（第一次听说→第二次亲眼看见）。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入；教学与检测同文件。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SP = require('../dist/engine/scene-purpose-check.js');
const { buildScenePurposeDirective, scenePurposeCheck } = SP;

const PROBE = [
  '场景1：客厅·夜',
  '张总：你好，好久不见。',
  '李秀兰：当年的事，我一直没敢告诉你。',
  '张总：你凭什么管我？',
  '李秀兰：我决定了，离婚。',
  '张总：其实我喜欢你。',
  '李秀兰：原来你早就知道真相。',
  '场景2：门口·夜',
  '张总：遗嘱的事，我全告诉你。',
  '李秀兰：你说吧。',
  '张总：那年的事，是我安排的。',
  '李秀兰：我不信。',
  '张总：爱信不信，慢走，不送。',
  '李秀兰：改天再聊。',
].join('\n');

// ==================== 1. zh 硬规则 + 五个目的簇 ====================

test('zh 指令含一场只打一拳与五个目的簇', () => {
  assert.strictEqual(typeof buildScenePurposeDirective, 'function', 'buildScenePurposeDirective 必须存在');
  const d = buildScenePurposeDirective('LIVE', 'zh');
  assert.ok(d.includes('一场只打一拳'), '必须教「一场只打一拳」');
  assert.ok(d.includes('只留一个结果'), '必须给「只留一个结果」的自问法');
  for (const k of ['交代背景', '正面冲突', '决定行动', '情感推进', '反转揭晓']) {
    assert.ok(d.includes(k), `必须列出目的簇：${k}`);
  }
  assert.ok(d.includes('主次分明'), '必须教同时推进时也要一条线压过另一条');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：短场 3 簇、55% 迟到线、末 25%/30%', () => {
  const d = buildScenePurposeDirective('LIVE', 'zh');
  assert.ok(d.includes('6-13 行'), '必须写明短场行数区间（检测条件 <14 行）');
  assert.ok(d.includes('三个以上目的') || d.includes('≥3'), '必须写「一场撞三个以上目的」');
  assert.ok(d.includes('55%'), '必须写目的迟到线 55%');
  assert.ok(d.includes('前 3 行') || d.includes('前三行'), '必须给可执行的进戏速度（前三行）');
  assert.ok(d.includes('25%') && d.includes('30%'), '必须写软收尾末 25% / 落地末 30%');
});

// ==================== 3. 同源自证 ====================

test('同源自证：探针被判多目的稀释与软收尾，指令点名同款信号词', () => {
  const res = scenePurposeCheck(PROBE, 'zh');
  assert.ok(res.multiPurposeCount >= 1, '探针第 1 场应被判 multi_purpose_scene');
  assert.ok(res.weakExitCount >= 1, '探针第 2 场应被判 weak_exit');
  const types = res.issues.map((i) => i.type);
  assert.ok(types.includes('multi_purpose_scene'));
  assert.ok(types.includes('weak_exit'));
  const d = buildScenePurposeDirective('LIVE', 'zh');
  assert.ok(d.includes('慢走'), '必须点名软收尾信号词（与 EXIT 词表同源）');
  assert.ok(d.includes('改天再聊'), '必须点名软收尾信号词（与 EXIT 词表同源）');
});

// ==================== 4. 重复目的必须有升级 ====================

test('重复目的：教「删前场合并」或「第二场带新代价升级」', () => {
  const d = buildScenePurposeDirective('LIVE', 'zh');
  assert.ok(d.includes('重复不是回响'), '必须点破重复目的的本质');
  assert.ok(d.includes('亲眼看见'), '必须给出升级示例');
  assert.ok(d.includes('证据'), '必须给出升级示例（证据砸脸）');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildScenePurposeDirective('LIVE', 'zh');
  const aigc = buildScenePurposeDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('△ 行独占') && !aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildScenePurposeDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，且含 one scene one punch 与英文簇名', () => {
  const en = buildScenePurposeDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/one scene, one punch/i.test(en), '必须教 one scene one punch');
  assert.ok(/exposition/i.test(en) && /confrontation/i.test(en) && /reveal/i.test(en), '必须列出英文簇名');
  assert.ok(en.includes('55%'), '英文层必须同样给出 55% 迟到线');
  assert.ok(/see you|goodbye|another time/i.test(en), '英文层必须点名软收尾信号词');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildScenePurposeDirective[^}]*\} from '\.\.\/engine\/scene-purpose-check'/.test(src),
    '必须从 scene-purpose-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/scenePurposeDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'scene-purpose-check.ts'), 'utf8');
  assert.ok(engine.includes('export function scenePurposeCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildScenePurposeDirective'), '教学函数必须与检测同文件');
});
