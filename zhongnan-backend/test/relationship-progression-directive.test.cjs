/**
 * v2.366「情感关系递进」前置教学指令（buildRelationshipProgressionDirective）守卫
 *
 * 缺口坐实（先证伪再坐实）：
 * - relationship-progression-check.ts 的 relationshipProgressionCheck（v2.131）只在生成后消费：
 *   pipeline 首扫（L2127）/ 修复后重算（L2331）/ high 打回（L2406）/ 终稿重算（L3205），
 *   另有 structural-rescan 登记（L93）。
 * - 证伪面：romance-craft 只有一句「感情只能一阶一阶升温」且仅在 romance/tender 题材
 *   经 craft-registry 注入，非情感题材的情感副线拿不到；craft-lint / craft-insights /
 *   mode-craft / playbook 均无五类结构与阈值；近邻 instant-love（初见白给）、
 *   convenient-encounter（巧遇）、forced-proximity（困处）都只管相遇/单点，
 *   relationship-ledger（跨集决裂回贴）、pair-bond-ledger（跨集同场保鲜）都管跨集。
 * - 坐实：单集亲密节拍的「铺垫/阻碍/升级」在撰写师首轮与润色师首轮零前置教学——
 *   先写错再打回重写，白付 retry token（v2.157）。
 *
 * 本文件锁八件事：
 * 1. 五类硬伤全列（有名无实/突飞猛进/一路糖水/只暧昧不推进/告知式）并给出可执行替代。
 * 2. 量化口径与检测同源：身份≥2 且亲密0/互动0 → high 扣 22；首个强亲密 >15% 且此前
 *    0 暧昧 → high 扣 20（15% 内开场、±5% 内身份锚点豁免）；强亲密≥2 且阻力0 →
 *    mid 扣 10；心动≥3 且强亲密0 升级0 → mid 扣 12（后 30% 必须给推进）；
 *    告知≥2 且心动<2 → low 扣 8。
 * 3. 同源自证：有名无实探针被判 high decorative_relationship，指令点名同款信号词。
 * 4. 边界：初见白给归秒爱检测；巧遇/困处归相遇与困处；跨集回贴/同场保鲜归账本；
 *    情绪弧光归 arc-tracker；情绪概述归展示而非叙述。
 * 5. LIVE/AIGC 制式分叉；缺省 mode=LIVE。
 * 6. en 层零中文，含五类英文名与统一口径。
 * 7. pipeline 同源 import + 撰写师/润色师两处注入。
 * 8. 教学与检测同文件（同源铁律）。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RP = require('../dist/engine/relationship-progression-check.js');
const { buildRelationshipProgressionDirective, relationshipProgressionCheck } = RP;

// 有名无实探针：夫妻身份被反复提及，但零亲密、零心动、零双人互动
const PROBE = `场景1：客厅
林晚：老公，你回来了。
顾言：嗯。
林晚：老婆，饭在桌上。
顾言：知道了。
林晚：老公，早点睡。
顾言：好。`;

// ==================== 1. 五类硬伤 + 可执行替代 ====================

test('zh 指令列全五类硬伤并给出可执行替代', () => {
  assert.strictEqual(typeof buildRelationshipProgressionDirective, 'function', 'buildRelationshipProgressionDirective 必须存在');
  const d = buildRelationshipProgressionDirective('LIVE', 'zh');
  for (const k of ['有名无实', '突飞猛进', '一路糖水', '只暧昧不推进', '告知式']) {
    assert.ok(d.includes(k), `必须列出硬伤：${k}`);
  }
  assert.ok(d.includes('同框'), '有名无实必须给可执行替代（先让 CP 同框）');
  assert.ok(d.includes('三级台阶'), '突飞猛进必须给可执行替代（三级台阶）');
  assert.ok(d.includes('夹一道阻力'), '一路糖水必须给可执行替代（夹一道阻力）');
  assert.ok(d.includes('后 30%'), '只暧昧不推进必须给时间窗（后 30%）');
  assert.ok(d.includes('翻译成动作'), '告知式必须给可执行替代（旁白翻译成动作）');
});

// ==================== 2. 量化口径与检测同源 ====================

test('量化口径与检测同源：五类阈值 + 扣分 + 豁免', () => {
  const d = buildRelationshipProgressionDirective('LIVE', 'zh');
  assert.ok(d.includes('扣 22') && d.includes('扣 20') && d.includes('扣 10') && d.includes('扣 12') && d.includes('扣 8'),
    '五类扣分必须与检测一致（22/20/10/12/8）');
  assert.ok(d.includes('15%') && d.includes('5%'), '突飞猛进必须写 15% 门槛与 ±5% 身份锚点豁免');
  assert.ok(d.includes('关系身份') && d.includes('≥2'), '有名无实必须写关系身份 ≥2 处');
  assert.ok(d.includes('强亲密') && d.includes('≥2'), '一路糖水必须写强亲密 ≥2 处');
  assert.ok(d.includes('≥3'), '只暧昧不推进必须写心动 ≥3 处');
  assert.ok(d.includes('零关系信号'), '必须交代题材豁免（零关系信号不评判）');
});

// ==================== 3. 同源自证 ====================

test('同源自证：有名无实探针被判 high，指令点名同款信号词', () => {
  const res = relationshipProgressionCheck(PROBE, 'zh');
  assert.strictEqual(res.hasRomanceLine, true, '探针必须识别到情感线');
  const hit = res.issues.find((i) => i.type === 'decorative_relationship');
  assert.ok(hit, '必须报 decorative_relationship');
  assert.strictEqual(hit.severity, 'high', '有名无实应为 high');
  const d = buildRelationshipProgressionDirective('LIVE', 'zh');
  assert.ok(d.includes('老公'), '必须点名与 ANCHOR_ZH 同源的身份词（老公）');
  assert.ok(d.includes('发现自己爱上了她'), '必须点名与 TELL_ZH 同源的旁白宣告');
});

// ==================== 4. 边界：与近邻引擎分工 ====================

test('边界：初见白给/巧遇困处/跨集账本/弧光展示各有归属', () => {
  const d = buildRelationshipProgressionDirective('LIVE', 'zh');
  assert.ok(d.includes('秒爱'), '初见白给必须显式让位给秒爱检测');
  assert.ok(d.includes('巧遇') && d.includes('困处'), '相遇与困处必须显式让位给对应检测');
  assert.ok(d.includes('关系翻转账本'), '跨集决裂回贴必须让位给关系翻转账本');
  assert.ok(d.includes('同场保鲜'), '跨集同场必须让位给关系线保鲜');
  assert.ok(d.includes('情绪弧光'), '情绪连续必须让位给 arc-tracker');
  assert.ok(d.includes('展示而非叙述'), '情绪概述必须让位给展示而非叙述');
});

// ==================== 5. 制式分叉 + 缺省 LIVE ====================

test('LIVE 教 △ 行；AIGC 教「不加 △ +（内心：）」；缺省 LIVE', () => {
  const live = buildRelationshipProgressionDirective('LIVE', 'zh');
  const aigc = buildRelationshipProgressionDirective('AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(!aigc.includes('每个动作独占 △ 行'), 'AIGC 不得沿用 LIVE 版式口径');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildRelationshipProgressionDirective(undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

// ==================== 6. en 层零中文 ====================

test('en 指令零中文，含五类英文名与统一口径', () => {
  const en = buildRelationshipProgressionDirective('LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文');
  assert.ok(/decorative relationship/i.test(en), '必须含 decorative relationship');
  assert.ok(/instant love/i.test(en), '必须含 instant love');
  assert.ok(/sweet without obstacle/i.test(en), '必须含 sweet without obstacle');
  assert.ok(/stagnant romance/i.test(en), '必须含 stagnant romance');
  assert.ok(/told-not-shown/i.test(en), '必须含 told-not-shown');
  assert.ok(en.includes('15%') && en.includes('5%'), '英文层必须同样给出 15% 门槛与 5% 豁免窗口');
  assert.ok(en.includes('22') && en.includes('20') && en.includes('10') && en.includes('12') && en.includes('8'),
    '英文层必须给出同源扣分');
});

// ==================== 7. pipeline 接线 + 同文件同源 ====================

test('pipeline 同源 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildRelationshipProgressionDirective[^}]*\} from '\.\.\/engine\/relationship-progression-check'/.test(src),
    '必须从 relationship-progression-check 同源 import（防口径漂移）',
  );
  const uses = src.match(/relationshipProgressionDirective/g) ?? [];
  assert.ok(uses.length >= 3, '定义 1 处 + 撰写师 1 处 + 润色师 1 处，至少 3 处');
});

test('教学与检测同文件（同源铁律）', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'relationship-progression-check.ts'), 'utf8');
  assert.ok(engine.includes('export function relationshipProgressionCheck'), '检测函数必须仍在同文件');
  assert.ok(engine.includes('export function buildRelationshipProgressionDirective'), '教学函数必须与检测同文件');
});
