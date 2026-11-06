'use strict';
// v2.392 payoff-curve 教学函数同源对齐测试
// 锚点词紧贴引擎源码：severity 类别 + 具体扣分数字 + 触发阈值 + 豁免

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/payoff-curve-check.js');

try {
  require.resolve(MODULE_PATH);
} catch {
  execSync('npx tsc -p tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
}

const mod = require(MODULE_PATH);

const lineOf = (s, anchor) => {
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchor)) return i + 1;
  }
  return -1;
};

const zh = mod.buildPayoffCurveDirective('LIVE', 'zh');
const en = mod.buildPayoffCurveDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildPayoffCurveDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildPayoffCurveDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('front_loaded_burst 开头就爆 — high + 扣 20 分 + × 1.5 + 差值 > 0.5', () => {
    assert.ok(zh.includes('front_loaded_burst'), '应包含 front_loaded_burst 类型名');
    const ln = lineOf(zh, 'front_loaded_burst');
    assert.ok(ln > 0, '定位 front_loaded_burst 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 20 分'), `应含精确锚点「扣 20 分」，实际: ${line}`);
    assert.ok(line.includes('× 1.5'), `应含「× 1.5」，实际: ${line}`);
    assert.ok(line.includes('> 0.5'), `应含「> 0.5」，实际: ${line}`);
  });

  test('tail_no_payoff 结尾干憋 — high + 扣 22 分 + > 0.3 + = 0', () => {
    assert.ok(zh.includes('tail_no_payoff'), '应包含 tail_no_payoff 类型名');
    const ln = lineOf(zh, 'tail_no_payoff');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 22 分'), `应含精确锚点「扣 22 分」，实际: ${line}`);
    assert.ok(line.includes('> 0.3'), `应含「> 0.3」，实际: ${line}`);
    assert.ok(line.includes('= 0'), `应含「= 0」，实际: ${line}`);
  });

  test('tail_suppression_pileup 蓄力错配 — mid + 扣 15 分 + > 0.5 + × 1.5', () => {
    assert.ok(zh.includes('tail_suppression_pileup'), '应包含 tail_suppression_pileup 类型名');
    const ln = lineOf(zh, 'tail_suppression_pileup');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 15 分'), `应含精确锚点「扣 15 分」，实际: ${line}`);
    assert.ok(line.includes('> 0.5'), `应含「> 0.5」，实际: ${line}`);
    assert.ok(line.includes('× 1.5'), `应含「× 1.5」，实际: ${line}`);
  });

  test('flat_curve 曲线平 — low + 扣 10 分 + > 1.0 + < 0.4', () => {
    assert.ok(zh.includes('flat_curve'), '应包含 flat_curve 类型名');
    const ln = lineOf(zh, 'flat_curve');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 10 分'), `应含精确锚点「扣 10 分」，实际: ${line}`);
    assert.ok(line.includes('> 1.0'), `应含「> 1.0」，实际: ${line}`);
    assert.ok(line.includes('< 0.4'), `应含「< 0.4」，实际: ${line}`);
  });

  test('三段切分 — 前段 0-0.4 / 中段 0.4-0.6 / 后段 0.6-1.0', () => {
    assert.ok(zh.includes('0-0.4'), '应含前段 0-0.4');
    assert.ok(zh.includes('0.4-0.6'), '应含中段 0.4-0.6');
    assert.ok(zh.includes('0.6-1.0'), '应含后段 0.6-1.0');
  });

  test('落差斜率公式 — (后段爽点 - 前段爽点) + (前段蓄力 - 后段蓄力)', () => {
    assert.ok(zh.includes('落差斜率'), '应含「落差斜率」');
    assert.ok(zh.includes('(后段爽点 - 前段爽点)'), '应含斜率前项');
    assert.ok(zh.includes('(前段蓄力 - 后段蓄力)'), '应含斜率后项');
  });

  test('评分公式 — score = clamp(100 - penalty, 0, 100)', () => {
    assert.ok(zh.includes('clamp(100 - penalty, 0, 100)'), '应含完整评分公式');
  });

  test('豁免 — 正文 < 20 字不评 + 满分 100', () => {
    assert.ok(zh.includes('< 20 字'), '应含正文 < 20 字豁免');
    assert.ok(zh.includes('满分 100'), '应含满分 100 说明');
  });
});

// ========== 英文层断言 ==========
describe('en — buildPayoffCurveDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 4 个类型名', () => {
    assert.ok(en.includes('front_loaded_burst'));
    assert.ok(en.includes('tail_no_payoff'));
    assert.ok(en.includes('tail_suppression_pileup'));
    assert.ok(en.includes('flat_curve'));
  });

  test('逐行 severity + 精确扣分（-20 / -22 / -15 / -10）', () => {
    const a = en.split('\n')[lineOf(en, 'front_loaded_burst') - 1];
    assert.ok(a.includes('high') && a.includes('-20'), `front_loaded_burst 行应含 high 与 -20，实际: ${a}`);
    const b = en.split('\n')[lineOf(en, 'tail_no_payoff') - 1];
    assert.ok(b.includes('high') && b.includes('-22'), `tail_no_payoff 行应含 high 与 -22，实际: ${b}`);
    const c = en.split('\n')[lineOf(en, 'tail_suppression_pileup') - 1];
    assert.ok(c.includes('mid') && c.includes('-15'), `tail_suppression_pileup 行应含 mid 与 -15，实际: ${c}`);
    const d = en.split('\n')[lineOf(en, 'flat_curve') - 1];
    assert.ok(d.includes('low') && d.includes('-10'), `flat_curve 行应含 low 与 -10，实际: ${d}`);
  });
});
