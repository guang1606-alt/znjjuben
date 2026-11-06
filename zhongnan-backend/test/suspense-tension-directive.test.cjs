'use strict';
// v2.404 suspense-tension 教学函数同源对齐测试
// 锚点词紧贴引擎源码：六类信号 + 张力三维 + 曲线形态 + 八类扣分

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/suspense-tension-curve.js');

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

const zh = mod.buildSuspenseTensionDirective('LIVE', 'zh');
const en = mod.buildSuspenseTensionDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildSuspenseTensionDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildSuspenseTensionDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('悬念张力'), '标题应点明悬念张力');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildSuspenseTensionDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSuspenseTensionDirective(undefined, 'zh'), zh);
  });

  test('场景切分 — script-scenes 单一事实源 / 首场头前散行不计 / 无场头算 1 场', () => {
    const s = lineOf(zh, '场景切分');
    assert.ok(s, '应有场景切分口径');
    assert.ok(s.includes('script-scenes'), '单一事实源');
    assert.ok(s.includes('不计入'), '首场头前散行不计');
    assert.ok(s.includes('1 场'), '无场头算 1 场');
  });

  test('检测单位 — 按场统计整场正文', () => {
    const s = lineOf(zh, '检测单位');
    assert.ok(s, '应有检测单位口径');
    assert.ok(s.includes('按场统计'), '按场统计');
    assert.ok(s.includes('整场正文'), '整场正文');
  });

  test('六类信号 — question/unknown/threat/time_pressure/reversal_foreshadow/mystery', () => {
    const s = lineOf(zh, '六类信号：');
    assert.ok(s, '应有六类信号清单');
    const types = ['question', 'unknown', 'threat', 'time_pressure', 'reversal_foreshadow', 'mystery'];
    for (const t of types) assert.ok(s.includes(t), `应包含 ${t}`);
    assert.ok(s.includes('问号悬念') && s.includes('神秘描述'), '中文类型名齐备');
  });

  test('信号权重 — 10/10/9/8/7/6', () => {
    const s = lineOf(zh, '信号权重');
    assert.ok(s, '应有信号权重');
    assert.ok(s.includes('question 10'), 'question 10');
    assert.ok(s.includes('reversal_foreshadow 9'), 'reversal 9');
    assert.ok(s.includes('threat 8'), 'threat 8');
    assert.ok(s.includes('time_pressure 7'), 'time 7');
    assert.ok(s.includes('mystery 6'), 'mystery 6');
  });

  test('问号悬念门槛 — 只认 WH 疑问词 + 问号，日常问句不算', () => {
    const s = lineOf(zh, 'WH 疑问词');
    assert.ok(s, '应有问号门槛');
    assert.ok(s.includes('为什么') && s.includes('难道'), 'WH 词表');
    assert.ok(s.includes('中午吃什么'), '日常问句反例');
  });

  test('单场张力三维 — 数量 5/条封顶 40、密度 ×2 封顶 40、多样性 4/类封顶 24', () => {
    const s = lineOf(zh, '单场张力');
    assert.ok(s, '应有张力公式');
    assert.ok(s.includes('每条 5 分'), '数量 5 分');
    assert.ok(s.includes('封顶 40'), '封顶 40');
    assert.ok(s.includes('× 2'), '密度 ×2');
    assert.ok(s.includes('封顶 24'), '多样性 24');
    assert.ok(s.includes('100'), '总分封顶 100');
  });

  test('场字数 — 汉字数 / 单词数 ×1.67 四舍五入 / 0 字张力 0', () => {
    const s = lineOf(zh, '场字数：');
    assert.ok(s, '应有场字数口径');
    assert.ok(s.includes('1.67'), '英文换算');
    assert.ok(s.includes('四舍五入'), '四舍五入');
    assert.ok(s.includes('0 时张力直接 0'), '零字归零');
  });

  test('连续平铺 — 连续 3 场极差 <10', () => {
    const s = lineOf(zh, '连续平铺');
    assert.ok(s, '应有连续平铺口径');
    assert.ok(s.includes('3 场'), '3 场');
    assert.ok(s.includes('<10'), '极差 <10');
    assert.ok(s.includes('flat_stretch'), 'flat_stretch 类型名');
  });

  test('曲线形态 — <15 flat / >40 且反向 jumpy / rising / falling / wave', () => {
    const s = lineOf(zh, '曲线形态：');
    assert.ok(s, '应有形态判定');
    assert.ok(s.includes('<15'), '极差 15');
    assert.ok(s.includes('>40'), '单步 40');
    for (const shape of ['flat', 'jumpy', 'rising', 'falling', 'wave']) {
      assert.ok(s.includes(shape), `应包含形态 ${shape}`);
    }
  });

  test('开场悬念 — 前 1-2 场任一场 ≥40', () => {
    const s = lineOf(zh, '开场悬念');
    assert.ok(s, '应有开场口径');
    assert.ok(s.includes('1-2'), '前 1-2 场');
    assert.ok(s.includes('≥40'), '40 门槛');
  });

  test('收尾悬念 — 末场 ≥50', () => {
    const s = lineOf(zh, '收尾悬念');
    assert.ok(s, '应有收尾口径');
    assert.ok(s.includes('≥50'), '50 门槛');
  });

  test('扣分表 — 8/15/12/12/15/5/8/8', () => {
    const s = lineOf(zh, '扣分表');
    assert.ok(s, '应有扣分表');
    assert.ok(s.includes('扣 8'), '信号过少 8');
    assert.ok(s.includes('扣 15'), '平铺 15');
    assert.ok(s.includes('扣 12'), '首尾各 12');
    assert.ok(s.includes('扣 5'), 'jumpy 5');
    assert.ok(s.includes('<20'), '极差 20');
  });

  test('问题类型名与 severity 齐备', () => {
    const types = [
      'low_total_signals', 'flat_stretch', 'weak_opening', 'weak_ending',
      'flat_curve', 'jumpy_curve', 'falling_curve', 'low_range',
    ];
    for (const t of types) assert.ok(zh.includes(t), `应包含问题类型 ${t}`);
    assert.ok(zh.includes('high'), 'high severity');
    assert.ok(zh.includes('mid'), 'mid severity');
  });

  test('总分规则 — 100 起扣并 clamp 0-100', () => {
    const s = lineOf(zh, '总分');
    assert.ok(s, '应有总分规则');
    assert.ok(s.includes('100'), '满分 100');
    assert.ok(s.includes('clamp'), 'clamp');
  });

  test('成稿自查 — 首场 ≥40 / 末场 ≥50 / 极差 ≥20', () => {
    const s = lineOf(zh, '成稿自查');
    assert.ok(s, '应有成稿自查段');
    assert.ok(s.includes('≥40'), '首场 40');
    assert.ok(s.includes('≥50'), '末场 50');
    assert.ok(s.includes('≥20'), '极差 20');
  });
});

// ========== 英文层断言 ==========
describe('en — buildSuspenseTensionDirective', () => {
  test('非空且含标题', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    assert.ok(en.toLowerCase().includes('suspense tension'), '标题应点明 suspense tension');
  });

  test('零中文（无 CJK 字符）', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('全部问题类型名与 severity 齐备', () => {
    const types = [
      'low_total_signals', 'flat_stretch', 'weak_opening', 'weak_ending',
      'flat_curve', 'jumpy_curve', 'falling_curve', 'low_range',
    ];
    for (const t of types) assert.ok(en.includes(t), `应包含 ${t}`);
    assert.ok(en.includes('high') && en.includes('mid'), 'severity 齐备');
  });

  test('关键数字锚点 — 10/9/8/7/6/1000/1.67/40/50/15/12/5/20/100', () => {
    const nums = ['10', '9', '8', '7', '6', '1000', '1.67', '40', '50', '15', '12', '5', '20', '100'];
    for (const n of nums) assert.ok(en.includes(n), `应包含数字 ${n}`);
  });

  test('format 不门控 — AIGC 与缺省一致', () => {
    assert.equal(mod.buildSuspenseTensionDirective('AIGC', 'en'), en);
    assert.equal(mod.buildSuspenseTensionDirective(undefined, 'en'), en);
  });
});
