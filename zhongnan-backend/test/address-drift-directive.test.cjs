/**
 * v2.360 「台词标签唯一」前置教学指令（buildAddressDriftDirective）守卫
 *
 * 缺口坐实（勘察先证伪再坐实）：
 * - address-drift-check.ts 的 addressDriftCheck（v2.354）只做生成后检测：
 *   同一角色用「张总/张建国/建国」多个台词标签 → 配音 speakerSheet 与 AIGC
 *   角色表按标签拆声部，一个人被当成三个人配三种声音；pipeline 仅在润色/L1
 *   重试时消费 driftAdvice（L2795），撰写师首轮 prompt 零教学。
 * - 证伪面：script-format（只教「角色名：台词」语法）、character-presence-check
 *   （只数 distinct 标签）、dialogue-name-call（只管台词里叫对方）、character-logic
 *   （管悬空/背景板）均不覆盖「同一角色标签必须固定」；grep 全 engine 仅
 *   address-drift-check 自身出现「称谓」口径 → 真实缺口。
 * - 教学必须按 LIVE/AIGC 制式分发（LIVE 动作独占 △ 行；AIGC 正文不加 △、
 *   内心只走（内心：…）），否则与版式哲学打架（v2.157 铁律）。
 *
 * 本文件锁六件事：
 * 1. zh 指令含「一人一标签」硬规则与人物卡正名清单（消费 cast 逐名）。
 * 2. 与检测同源：同一份混标签稿确实被 addressDriftCheck 判 drift。
 * 3. 制式分叉：LIVE 教 △ 行不参与标签判断；AIGC 教「不加 △」+（内心：…）。
 * 4. 台词内称呼对方（「张总，您……」）明确不受限（防教学过度约束）。
 * 5. en 层零中文（中文正名不进 en 指令）。
 * 6. 空 cast 返回空串；pipeline 撰写师 + 润色师两处注入且从同源文件 import。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const AD = require('../dist/engine/address-drift-check.js');
const { buildAddressDriftDirective, addressDriftCheck } = AD;

const CAST = {
  张建国: { persona: '地产老板', voice: '低沉短句' },
  李秀兰: { persona: '护士长', voice: '快而软' },
};

// ==================== 1. zh 指令：硬规则 + 人物卡正名 ====================

test('zh 指令含一人一标签硬规则，并逐一列出人物卡正名', () => {
  assert.strictEqual(typeof buildAddressDriftDirective, 'function', 'buildAddressDriftDirective 必须存在');
  const d = buildAddressDriftDirective(CAST, 'LIVE', 'zh');
  assert.ok(d.includes('只用一个台词标签'), '必须教「每个角色全稿只用一个台词标签」');
  assert.ok(d.includes('人物卡正名'), '必须教「优先人物卡正名」');
  assert.ok(d.includes('张建国') && d.includes('李秀兰'), '必须逐个列出 cast 正名，供撰写师照抄标签');
  assert.ok(d.includes('冒号前'), '必须点明检测只认冒号前的标签');
  assert.ok(d.includes('群体') && d.includes('旁白'), '必须写明群体/旁白标签豁免（与检测同源）');
  assert.ok(d.includes('张总'), '必须举出同源混标签示例（张总/建国/张建国）');
});

test('与 addressDriftCheck 同源：同一混标签稿确实被判 address_drift', () => {
  const draft = [
    '△ 张建国把合同摔在桌上。',
    '张总：签了它，你的科室明年预算翻倍。',
    '李秀兰：我不签。',
    '建国：你一个护士长，扛得住？',
    '李秀兰：扛不住也得扛。',
    '张建国：那你就等着被调走。',
  ].join('\n');
  const res = addressDriftCheck(CAST, draft, 'zh');
  assert.strictEqual(res.checked, true, 'cast 非空且稿长足够时必须检查');
  assert.ok(res.driftCount >= 1, '张总/建国两个变体标签应被判漂移');
  assert.ok(res.issues.some((i) => i.type === 'address_drift' || i.type === 'address_drift_severe'));
  // 同源自证：正名稿不报
  const clean = draft.replace(/^张总：/m, '张建国：').replace(/^建国：/m, '张建国：');
  assert.strictEqual(addressDriftCheck(CAST, clean, 'zh').driftCount, 0, '统一标签后不得再报漂移');
});

// ==================== 2. 制式分叉 + 台词内称呼豁免 ====================

test('LIVE 教 △ 行不参与标签判断；AIGC 教「不加 △」且内心只走（内心：…）', () => {
  const live = buildAddressDriftDirective(CAST, 'LIVE', 'zh');
  const aigc = buildAddressDriftDirective(CAST, 'AIGC', 'zh');
  assert.ok(live.includes('△'), 'LIVE 必须交代 △ 动作行');
  assert.ok(live.includes('不参与唯一性判断'), 'LIVE 必须说明场头/△ 行不进标签判断');
  assert.ok(aigc.includes('不加 △'), 'AIGC 必须明说正文不加 △');
  assert.ok(aigc.includes('（内心：'), 'AIGC 必须教内心走（内心：…）惯例');
  assert.strictEqual(buildAddressDriftDirective(CAST, undefined, 'zh'), live, '缺省 mode 应为 LIVE');
});

test('台词里称呼对方不受限，只约束冒号前标签', () => {
  const d = buildAddressDriftDirective(CAST, 'LIVE', 'zh');
  assert.ok(d.includes('称呼对方'), '必须说明台词内称呼不受限');
  assert.ok(d.includes('不受限'), '必须显式写出不受限边界，防教学过度约束');
});

// ==================== 3. en 层零中文 ====================

test('en 指令零中文，且含一人一标签英文禁令', () => {
  const en = buildAddressDriftDirective(CAST, 'LIVE', 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 指令不得含任何中文（含 cast 中文正名）');
  assert.ok(/one speaker label per character/i.test(en), '必须教一人一标签');
  assert.ok(en.includes('Mr. Zhang') && en.includes('Jianguo'), '必须给出混标签反例');
  const enCast = { 'Zhang Jianguo': { persona: 'landlord', voice: 'low' }, 'Li Xiulan': { persona: 'nurse', voice: 'soft' } };
  const en2 = buildAddressDriftDirective(enCast, 'AIGC', 'en');
  assert.ok(en2.includes('Zhang Jianguo') && en2.includes('Li Xiulan'), '英文正名必须进 en 指令');
  assert.ok(!/[\u4e00-\u9fff]/.test(en2), '英文 cast 场景同样零中文');
});

test('空 cast 返回空串，不留悬空标题', () => {
  assert.strictEqual(buildAddressDriftDirective({}, 'LIVE', 'zh'), '');
  assert.strictEqual(buildAddressDriftDirective({}, 'AIGC', 'en'), '');
});

// ==================== 4. pipeline 接线源码守卫 ====================

test('pipeline 从同源文件 import，撰写师与润色师两处注入', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import \{[^}]*buildAddressDriftDirective[^}]*\} from '\.\.\/engine\/address-drift-check'/.test(src),
    '必须从 address-drift-check 同源 import（防口径漂移）',
  );
  const injected = src.split('${sdtDirective}\\n${addressDriftDirective}').length - 1;
  assert.strictEqual(injected, 2, '撰写师首轮 + 润色师首轮各注入一次');
});
