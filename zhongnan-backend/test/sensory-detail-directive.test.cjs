'use strict';
// v2.410 sensory-detail 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 五感词表 / 词种计数 / 断句 ≥4 / 覆盖 60 + 密度 40 + ×120

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/sensory-detail.js');

try {
  require.resolve(MODULE_PATH);
} catch {
  execSync('npx tsc -p tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
}

const mod = require(MODULE_PATH);

const lineOf = (s, anchor) => {
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchor)) return lines[i];
  }
  return '';
};

const zh = mod.buildSensoryDetailDirective('LIVE', 'zh');
const en = mod.buildSensoryDetailDirective('LIVE', 'en');

describe('zh — buildSensoryDetailDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildSensoryDetailDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('感官细节'), '标题应点明感官细节');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildSensoryDetailDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSensoryDetailDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫叙述行，跳过场头与台词行', () => {
    const s = lineOf(zh, '检测范围：');
    assert.ok(s, '应有检测范围');
    assert.ok(s.includes('只扫叙述行'), '只扫叙述行');
    assert.ok(s.includes('场头'), '跳过场头');
    assert.ok(s.includes('台词行'), '跳过台词行');
    assert.ok(s.includes('1-12 字说话人'), '台词行识别口径');
  });

  test('括号动作行算叙述 + 剥掉首尾符号', () => {
    const s = lineOf(zh, '检测范围：');
    assert.ok(s.includes('括号动作行'), '括号动作行算叙述');
    assert.ok(s.includes('行首'), '剥掉行首');
    assert.ok(s.includes('行尾'), '剥掉行尾');
  });

  test('五感维度齐全 — sight/sound/touch/smell/taste 五个英文键', () => {
    assert.ok(zh.includes('视觉 sight'), '含 sight');
    assert.ok(zh.includes('听觉 sound'), '含 sound');
    assert.ok(zh.includes('触觉 touch'), '含 touch');
    assert.ok(zh.includes('嗅觉 smell'), '含 smell');
    assert.ok(zh.includes('味觉 taste'), '含 taste');
  });

  test('视觉例词 — 光 / 刺眼 / 斑驳 / 轮廓', () => {
    const s = lineOf(zh, '视觉 sight');
    assert.ok(s.includes('光'), '含光');
    assert.ok(s.includes('刺眼'), '含刺眼');
    assert.ok(s.includes('斑驳'), '含斑驳');
    assert.ok(s.includes('轮廓'), '含轮廓');
  });

  test('听觉例词 — 嗡 / 咔 / 砰 / 呜咽 / 呼啸', () => {
    const s = lineOf(zh, '听觉 sound');
    assert.ok(s.includes('嗡'), '含嗡');
    assert.ok(s.includes('咔'), '含咔');
    assert.ok(s.includes('砰'), '含砰');
    assert.ok(s.includes('呜咽'), '含呜咽');
    assert.ok(s.includes('呼啸'), '含呼啸');
  });

  test('触觉例词 — 烫 / 粗糙 / 黏 / 硌', () => {
    const s = lineOf(zh, '触觉 touch');
    assert.ok(s.includes('烫'), '含烫');
    assert.ok(s.includes('粗糙'), '含粗糙');
    assert.ok(s.includes('黏'), '含黏');
    assert.ok(s.includes('硌'), '含硌');
  });

  test('嗅觉与味觉例词 — 霉 / 呛 / 涩 / 味蕾', () => {
    const smell = lineOf(zh, '嗅觉 smell');
    const taste = lineOf(zh, '味觉 taste');
    assert.ok(smell.includes('霉'), '嗅觉含霉');
    assert.ok(smell.includes('呛'), '嗅觉含呛');
    assert.ok(taste.includes('涩'), '味觉含涩');
    assert.ok(taste.includes('味蕾'), '味觉含味蕾');
  });

  test('计数口径 — 每个词表词只计 1 次，按命中词种数', () => {
    const s = lineOf(zh, '计数口径：');
    assert.ok(s, '应有计数口径');
    assert.ok(s.includes('只计 1 次'), '只计 1 次');
    assert.ok(s.includes('词种数'), '按词种数');
    assert.ok(s.includes('不按出现次数'), '不按出现次数');
  });

  test('断句口径 — 。！？!?；; 与换行，长度 ≥4，句数 0 按 1', () => {
    const s = lineOf(zh, '断句口径：');
    assert.ok(s, '应有断句口径');
    assert.ok(s.includes('。！？!?；;'), '切句符集');
    assert.ok(s.includes('长度 ≥4'), '长度 ≥4');
    assert.ok(s.includes('句数为 0 时按 1 计'), '句数 0 按 1');
  });

  test('覆盖分 60 — 视觉 12 + 每个非视觉维度 12', () => {
    const s = lineOf(zh, '覆盖分（60）：');
    assert.ok(s, '应有覆盖分');
    assert.ok(s.includes('视觉命中给 12'), '视觉 12');
    assert.ok(s.includes('每命中一个再给 12'), '每个非视觉 12');
    assert.ok(s.includes('听/触/嗅/味'), '四个非视觉维度');
  });

  test('非视觉密度分 40 — min(40, round(nonVisualCount ÷ 句数 × 120))', () => {
    const s = lineOf(zh, '非视觉密度分（40）：');
    assert.ok(s, '应有密度分');
    assert.ok(s.includes('min(40'), '封顶 40');
    assert.ok(s.includes('÷ 叙述句数'), '除以叙述句数');
    assert.ok(s.includes('× 120'), '乘 120');
    assert.ok(s.includes('每 3 句有 1 个'), '每 3 句 1 个满分');
  });

  test('总分公式 — clamp(覆盖分 + 密度分, 0, 100)，空稿 100', () => {
    const s = lineOf(zh, '总分 = clamp');
    assert.ok(s, '应有总分公式');
    assert.ok(s.includes('覆盖分 + 密度分'), '覆盖分 + 密度分');
    assert.ok(s.includes('0, 100'), 'clamp(0, 100)');
    assert.ok(s.includes('空稿满分 100'), '空稿满分 100');
  });

  test('分工 — narrative-craft 删滤镜词、本引擎加直接意象、show-dont-tell 管情绪直说', () => {
    const s = lineOf(zh, '分工：');
    assert.ok(s, '应有分工说明');
    assert.ok(s.includes('narrative-craft'), '含 narrative-craft');
    assert.ok(s.includes('滤镜词'), '滤镜词');
    assert.ok(s.includes('加直接意象'), '加直接意象');
    assert.ok(s.includes('show-dont-tell'), '含 show-dont-tell');
  });

  test('pipeline 消费 — prePolish 缺非视觉维度时注入补写提示，craft/deai 复评', () => {
    const s = lineOf(zh, 'pipeline 消费：');
    assert.ok(s, '应有 pipeline 消费');
    assert.ok(s.includes('prePolish'), '含 prePolish');
    assert.ok(s.includes('非视觉维度缺失'), '缺失触发');
    assert.ok(s.includes('感官补写提示'), '补写提示');
    assert.ok(s.includes('craft/deai'), 'craft/deai 复评');
  });

  test('成稿自查 — 环境声 / 温度质感 / 气味味道 / 具体名词动词', () => {
    const s = lineOf(zh, '成稿自查：');
    assert.ok(s, '应有成稿自查');
    assert.ok(s.includes('环境声'), '查环境声');
    assert.ok(s.includes('温度或质感'), '查温度质感');
    assert.ok(s.includes('气味或味道'), '查气味味道');
    assert.ok(s.includes('名词+动词'), '具体名词+动词');
  });
});

describe('en — buildSensoryDetailDirective', () => {
  test('en 层非空 + 零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.ok(!cjk, 'en 层应零中文 CJK');
  });

  test('en 五感维度与例词', () => {
    assert.ok(en.includes('sight:'), '含 sight');
    assert.ok(en.includes('sound:'), '含 sound');
    assert.ok(en.includes('touch:'), '含 touch');
    assert.ok(en.includes('smell:'), '含 smell');
    assert.ok(en.includes('taste:'), '含 taste');
    assert.ok(en.includes('silhouette'), '视觉例词 silhouette');
    assert.ok(en.includes('metallic'), '味觉例词 metallic');
  });

  test('en 覆盖 60 + 密度 40 + ×120', () => {
    assert.ok(en.includes('Coverage score (60)'), '覆盖分 60');
    assert.ok(en.includes('Non-visual density score (40)'), '密度分 40');
    assert.ok(en.includes('x 120'), '乘 120');
    assert.ok(en.includes('every 3 sentences'), '每 3 句满分');
  });

  test('en 计分与断句口径 — length >= 4 / empty draft = 100 / clamp', () => {
    assert.ok(en.includes('length >= 4'), '长度 >= 4');
    assert.ok(en.includes('empty draft = 100'), '空稿 100');
    assert.ok(en.includes('Final score = clamp'), '总分 clamp');
    assert.ok(en.includes('counts once per dimension'), '词种计数');
  });

  test('en pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('Pipeline consumption'), '含 pipeline consumption');
    assert.ok(en.includes('prePolish'), '含 prePolish');
    assert.equal(mod.buildSensoryDetailDirective('AIGC', 'en'), en);
    assert.equal(mod.buildSensoryDetailDirective(undefined, 'en'), en);
  });
});
