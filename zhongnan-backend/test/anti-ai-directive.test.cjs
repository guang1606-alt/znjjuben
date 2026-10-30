/**
 * v2.358 去AI味前置教学指令（buildAntiAiDirective）守卫
 *
 * 缺口坐实（勘察先证伪再坐实）：
 * - playbook.ts 的 AI_CLICHE 词表（28 词 + 2 排比 pattern）此前只被 antiAiScan
 *   用于「生成后 QC + 打回重写理由」（pipeline L1950/2174/3047），撰写师首轮
 *   prompt 零去AI味教学——先错再纠，每轮 retry 白付 token（v2.157 场头前置
 *   教学铁律：前置教学优于事后纠偏）。
 * - 润色师岗位文案只写「禁用 AI_CLICHE 词表」——常量名符号引用，词表内容从未
 *   进入任何 prompt，模型无从知晓禁用什么（教了等于没教）。
 *
 * 本文件锁四件事：
 * 1. zh 指令与 AI_CLICHE.phrases 同源全量（词表改动自动同步教学，禁止截断）。
 * 2. zh 含排比禁令与替代原则（动作/潜台词）；en 零中文且含英文 AI 腔禁令。
 * 3. pipeline 撰写师首轮与润色师两处注入（源码守卫，防接线被悄悄摘掉）。
 * 4. 润色师岗位文案不再出现「AI_CLICHE」常量名符号引用。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PLAYBOOK = require('../dist/engine/playbook.js');
const { AI_CLICHE, ROLE_DIRECTIVE, ROLE_DIRECTIVE_EN, buildAntiAiDirective } = PLAYBOOK;

// ==================== 1. zh 指令：同源全量词条 ====================

test('zh 指令包含 AI_CLICHE.phrases 全量词条（同源编译，禁止截断）', () => {
  assert.strictEqual(typeof buildAntiAiDirective, 'function', 'buildAntiAiDirective 必须存在');
  const d = buildAntiAiDirective('zh');
  assert.ok(AI_CLICHE.phrases.length >= 28, `词表基线 ≥28，实得 ${AI_CLICHE.phrases.length}`);
  const missing = AI_CLICHE.phrases.filter((p) => !d.includes(p));
  assert.deepStrictEqual(missing, [], `指令缺词条：${missing.join('、')}`);
});

test('zh 指令含排比禁令与替代原则（动作/潜台词），且默认 lang=zh', () => {
  const d = buildAntiAiDirective();
  assert.ok(d.includes('排比'), '必须含排比禁令');
  assert.ok(d.includes('潜台词') && d.includes('动作'), '必须教替代原则：动作与潜台词');
  assert.strictEqual(d, buildAntiAiDirective('zh'), '缺省 lang 应等同 zh');
});

// ==================== 2. en 指令：零中文 + 英文 AI 腔禁令 ====================

test('en 指令零中文，且含英文 AI 腔禁用教学与排比禁令', () => {
  const d = buildAntiAiDirective('en');
  assert.ok(!/[一-鿿]/.test(d), 'en 指令必须零中文');
  assert.ok(/parallel/i.test(d), 'en 必须禁 parallel-structure padding');
  assert.ok(/clich|banned|never use/i.test(d), 'en 必须给禁用教学口吻');
  assert.ok(/subtext/i.test(d), 'en 必须教 subtext 替代原则');
});

test('指令确定性：两次调用逐字相等', () => {
  assert.strictEqual(buildAntiAiDirective('zh'), buildAntiAiDirective('zh'));
  assert.strictEqual(buildAntiAiDirective('en'), buildAntiAiDirective('en'));
});

// ==================== 3. pipeline 接线源码守卫 ====================

test('pipeline 接线：buildAntiAiDirective 被 import 且注入撰写师首轮与润色师两处', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'agents', 'pipeline.ts'), 'utf8');
  assert.ok(
    /import\s*\{[^}]*buildAntiAiDirective[^}]*\}\s*from\s*'\.\.\/engine\/playbook'/.test(src),
    'pipeline 必须从 ../engine/playbook import buildAntiAiDirective（同源单文件）',
  );
  const uses = src.match(/antiAiDirective/g) ?? [];
  assert.ok(uses.length >= 3, `antiAiDirective 至少出现 3 次（定义+撰写师+润色师），实得 ${uses.length}`);
});

// ==================== 4. 润色师岗位文案去符号引用 ====================

test('润色师岗位文案不再引用「AI_CLICHE」常量名（词表必须真进 prompt，非符号）', () => {
  assert.ok(!ROLE_DIRECTIVE.polish.includes('AI_CLICHE'), 'zh 润色师文案含常量名符号引用');
  assert.ok(!ROLE_DIRECTIVE_EN.polish.includes('AI_CLICHE'), 'en 润色师文案含常量名符号引用');
});
