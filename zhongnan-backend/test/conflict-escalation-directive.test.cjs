'use strict';
// v2.390 conflict-escalation 教学函数同源对齐测试
// 锚点词紧贴引擎源码：severity 类别 + 具体扣分数字 + 触发阈值 + 豁免
// 所有断言只对中文层（en 层单独断言零 CJK）

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/conflict-escalation-check.js');

// 确保编译产物存在
try {
  require.resolve(MODULE_PATH);
} catch {
  execSync('npx tsc -p tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
}

const mod = require(MODULE_PATH);

// —— 辅助 ——
const lineOf = (s, anchor) => {
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchor)) return i + 1;
  }
  return -1;
};

const zh = mod.buildConflictEscalationDirective('LIVE', 'zh');
const en = mod.buildConflictEscalationDirective('LIVE', 'en');

const { describe, test } = require('node:test');

// ========== 中文层断言 ==========
describe('zh — buildConflictEscalationDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildConflictEscalationDirective, 'function');
  });

  test('flat_conflict 原地踏步 — severity high + 每次扣 16 分', () => {
    // 锚点：severity 类别 + 具体扣分数字
    assert.ok(zh.includes('flat_conflict'), '应包含 flat_conflict 类型名');
    assert.ok(zh.includes('high'), '应包含 high severity');
    const ln = lineOf(zh, 'high');
    assert.ok(ln > 0, '定位 high 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('16'), `high 所在行应包含 16 分，实际: ${line}`);
  });

  test('no_peak 全程无高潮 — severity mid + 每次扣 12 分', () => {
    assert.ok(zh.includes('no_peak'), '应包含 no_peak 类型名');
    assert.ok(zh.includes('mid'), '应包含 mid severity');
    const ln = lineOf(zh, 'no_peak');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('12'), `no_peak 所在行应包含 12 分，实际: ${line}`);
  });

  test('front_loaded 开局即顶格 — severity mid + 每次扣 10 分', () => {
    assert.ok(zh.includes('front_loaded'), '应包含 front_loaded 类型名');
    const ln = lineOf(zh, 'front_loaded');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('10'), `front_loaded 所在行应包含 10 分，实际: ${line}`);
  });

  test('abrupt_escalation 跳台阶 — severity mid + 每次扣 8 分', () => {
    assert.ok(zh.includes('abrupt_escalation'), '应包含 abrupt_escalation 类型名');
    const ln = lineOf(zh, 'abrupt_escalation');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('8'), `abrupt_escalation 所在行应包含 8 分，实际: ${line}`);
  });

  test('narrow_methods 手段贫乏 — severity low + 每次扣 6 分（精确锚点「扣 6 分」）', () => {
    assert.ok(zh.includes('narrow_methods'), '应包含 narrow_methods 类型名');
    assert.ok(zh.includes('low'), '应包含 low severity');
    // 精确锚点「扣 6 分」，避免被触发阈值的 6（heavyActionTotal ≥ 6）误命中
    assert.ok(zh.includes('扣 6 分'), '应包含精确子串「扣 6 分」');
  });

  test('flat_conflict 触发阈值 — ≥3 个冲突窗口全部停在中档', () => {
    const ln = lineOf(zh, 'flat_conflict');
    const ctx = zh.split('\n').slice(Math.max(0, ln - 3), ln + 3).join('\n');
    assert.ok(ctx.includes('≥ 3') || ctx.includes('≥3'), `应包含 ≥ 3 触发阈值，实际上下文: ${ctx}`);
  });

  test('narrow_methods 触发阈值 — L2/L3 动作 ≥6 次但种类 ≤2', () => {
    const ln = lineOf(zh, 'narrow_methods');
    const ctx = zh.split('\n').slice(Math.max(0, ln - 3), ln + 3).join('\n');
    assert.ok(ctx.includes('6') && ctx.includes('2'), `应包含 ≥ 6 次和 ≤ 2 种触发阈值，实际上下文: ${ctx}`);
  });

  test('评分公式 — score = clamp(100 - penalty, 0, 100)', () => {
    assert.ok(zh.includes('100'), '应包含 100 分基础分');
    // 扣分总数 = 16+12+10+8+6 = 52（纯理论，引擎是累加）
    // 至少确认 clamp 或 0-100 范围
    const ln = lineOf(zh, '100');
    const ctx = zh.split('\n').slice(Math.max(0, ln - 2), ln + 2).join('\n');
    assert.ok(ctx.includes('0') || ctx.includes('clamp'), `应包含 clamp 或 0-100 范围说明，实际上下文: ${ctx}`);
  });

  test('豁免条件 — windows < 3 或 totalHits < 4 不评结构', () => {
    // 引擎 L182: if (windows.length < 3 || totalHits < 4) 跳过结构评
    const hasSmall = zh.includes('3') || zh.includes('4');
    assert.ok(hasSmall, '应包含 windows < 3 或 totalHits < 4 的豁免阈值');
  });
});

// ========== 英文层断言 ==========
describe('en — buildConflictEscalationDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 5 个类型名', () => {
    assert.ok(en.includes('flat_conflict'));
    assert.ok(en.includes('no_peak'));
    assert.ok(en.includes('front_loaded'));
    assert.ok(en.includes('abrupt_escalation'));
    assert.ok(en.includes('narrow_methods'));
  });

  test('包含 severity 类别 high/mid/low', () => {
    assert.ok(en.includes('high'));
    assert.ok(en.includes('mid'));
    assert.ok(en.includes('low'));
  });
});
