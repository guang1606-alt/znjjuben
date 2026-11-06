'use strict';
// v2.408 vague-word 教学函数同源对齐测试
// 锚点词紧贴引擎源码：三类信号词表 + 密度扣分公式 + 只扫叙述行 + pipeline 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/vague-word.js');

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

const zh = mod.buildVagueWordDirective('LIVE', 'zh');
const en = mod.buildVagueWordDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildVagueWordDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildVagueWordDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('模糊词') && zh.includes('空心词'), '标题应点明模糊词/空心词');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildVagueWordDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildVagueWordDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫叙述行，跳过对白行和场头', () => {
    const s = lineOf(zh, '检测范围：');
    assert.ok(s, '应有检测范围口径');
    assert.ok(s.includes('叙述行'), '只扫叙述行');
    assert.ok(s.includes('对白行'), '跳过对白行');
    assert.ok(s.includes('场头'), '跳过场头');
  });

  test('三类模糊词 — hedge 对冲语态 / filler 空心名词 / measure 模糊量词', () => {
    // 三类各占一行，直接搜整个 zh 字符串
    assert.ok(zh.includes('hedge'), '含 hedge');
    assert.ok(zh.includes('对冲语态'), '对冲语态中文名');
    assert.ok(zh.includes('filler'), '含 filler');
    assert.ok(zh.includes('空心名词'), '空心名词中文名');
    assert.ok(zh.includes('measure'), '含 measure');
    assert.ok(zh.includes('模糊量词'), '模糊量词中文名');
  });

  test('hedge 对冲语态 zh 9 个信号词', () => {
    const s = lineOf(zh, 'hedge 对冲语态');
    assert.ok(s, '应有 hedge 细则');
    assert.ok(s.includes('zh 9'), 'hedge zh 9 个');
    assert.ok(s.includes('仿佛'), '含仿佛');
    assert.ok(s.includes('显得'), '含显得');
    assert.ok(s.includes('看起来'), '含看起来');
  });

  test('filler 空心名词 zh 5 个信号词', () => {
    const s = lineOf(zh, 'filler 空心名词');
    assert.ok(s, '应有 filler 细则');
    assert.ok(s.includes('zh 5'), 'filler zh 5 个');
    assert.ok(s.includes('东西'), '含东西');
    assert.ok(s.includes('玩意儿'), '含玩意儿');
  });

  test('measure 模糊量词 zh 10 个信号词', () => {
    const s = lineOf(zh, 'measure 模糊量词');
    assert.ok(s, '应有 measure 细则');
    assert.ok(s.includes('zh 10'), 'measure zh 10 个');
    assert.ok(s.includes('某种'), '含某种');
    assert.ok(s.includes('说不出的'), '含说不出的');
  });

  test('densityPer100 密度公式 — round(总命中数/叙述句数×1000)/10', () => {
    const s = lineOf(zh, '密度公式：');
    assert.ok(s, '应有密度公式');
    assert.ok(s.includes('densityPer100'), '含 densityPer100');
    assert.ok(s.includes('1000'), '× 1000');
    assert.ok(s.includes('10'), '÷ 10');
  });

  test('score 得分公式 — max(0, round(100 - max(0, densityPer100 - 8) × 3.125))', () => {
    const s = lineOf(zh, '得分公式：');
    assert.ok(s, '应有得分公式');
    assert.ok(s.includes('max(0'), '有 max(0');
    assert.ok(s.includes('round(100'), 'round(100');
    assert.ok(s.includes('densityPer100 - 8'), '减 8 阈值');
    assert.ok(s.includes('3.125'), '乘 3.125 斜率');
  });

  test('扣分阈值 — 密度 ≤ 8.0 满分 / > 8 开始扣 / 40 封顶 0', () => {
    const s = lineOf(zh, '密度 ≤ 8.0');
    assert.ok(s, '应有扣分阈值说明');
    assert.ok(s.includes('≤ 8.0'), '含 8.0 满分');
    assert.ok(s.includes('密度 > 8'), '密度 > 8 开始扣');
    assert.ok(s.includes('密度 40'), '密度 40 封顶');
  });

  test('空稿满分 100', () => {
    const s = lineOf(zh, '空稿满分');
    assert.ok(s, '应有空稿口径');
    assert.ok(s.includes('100'), '空稿满分 100');
  });

  test('三类同等权重，不分级', () => {
    const s = lineOf(zh, '同等权重');
    assert.ok(s, '应有权重说明');
    assert.ok(s.includes('同等权重'), '三类同等权重');
    assert.ok(s.includes('不分级'), '不分级');
  });

  test('改写方向 — 删掉对冲/空心/模糊指代，叙述里敢下具体判断和实体', () => {
    const s = lineOf(zh, '改写方向：');
    assert.ok(s, '应有改写方向');
    assert.ok(s.includes('对冲'), '删对冲');
    assert.ok(s.includes('空心'), '删空心');
    assert.ok(s.includes('模糊'), '删模糊');
    assert.ok(s.includes('具体判断'), '敢下具体判断');
  });

  test('pipeline 消费 prePolish — score < 85 时触发定向改写提示', () => {
    const s = lineOf(zh, 'pipeline 消费：');
    assert.ok(s, '应有 pipeline 消费说明');
    assert.ok(s.includes('prePolish'), '含 prePolish');
    assert.ok(s.includes('< 85'), '阈值 85');
    assert.ok(s.includes('定向改写提示'), '定向改写提示');
  });

  test('pipeline 消费 craft/deai 维度把 score 作为质量输入', () => {
    const s = lineOf(zh, 'pipeline 消费：');
    assert.ok(s.includes('craft'), '含 craft 维度');
    assert.ok(s.includes('deai'), '含 deai 维度');
    assert.ok(s.includes('质量输入'), '质量输入');
  });

  test('成稿自查 — 名词/量词具体性 + 三类关键词', () => {
    const s = lineOf(zh, '成稿自查：');
    assert.ok(s, '应有成稿自查');
    assert.ok(s.includes('名词'), '检查名词');
    assert.ok(s.includes('量词'), '检查量词');
    assert.ok(s.includes('具体'), '具体到某个东西/某个数');
    assert.ok(s.includes('似乎'), '检查 hedge 关键词');
  });
});

// ========== 英文层断言 ==========
describe('en — buildVagueWordDirective', () => {
  test('en 层非空 + 零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.ok(!cjk, 'en 层应零中文 CJK');
  });

  test('三类英文关键词 — hedge / filler / measure + 信号词示例', () => {
    assert.ok(en.includes('hedge'), '含 hedge');
    assert.ok(en.includes('filler'), '含 filler');
    assert.ok(en.includes('measure'), '含 measure');
    assert.ok(en.includes('seemed'), 'hedge 示例 seemed');
    assert.ok(en.includes('something'), 'filler 示例 something');
    assert.ok(en.includes('a sense of'), 'measure 示例 a sense of');
  });

  test('密度公式 + 得分公式关键数字 — 8 / 3.125 / 40', () => {
    const formula = en;
    assert.ok(formula.includes('8'), '阈值 8');
    assert.ok(formula.includes('3.125'), '斜率 3.125');
    assert.ok(formula.includes('40'), '封顶 40');
  });

  test('pipeline 消费 — prePolish score < 85 + craft/deai dimensions', () => {
    assert.ok(en.includes('prePolish'), '含 prePolish');
    assert.ok(en.includes('85'), '阈值 85');
    assert.ok(en.includes('craft'), '含 craft');
    assert.ok(en.includes('deai'), '含 deai');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildVagueWordDirective('AIGC', 'en'), en);
    assert.equal(mod.buildVagueWordDirective(undefined, 'en'), en);
  });
});
