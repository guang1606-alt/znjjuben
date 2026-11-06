'use strict';
// v2.391 scene-padding 教学函数同源对齐测试
// 锚点词紧贴引擎源码：severity 类别 + 具体扣分数字 + 触发阈值 + 豁免
// 所有断言只对中文层（en 层单独断言零 CJK）

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/scene-padding-check.js');

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

const zh = mod.buildScenePaddingDirective('LIVE', 'zh');
const en = mod.buildScenePaddingDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildScenePaddingDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildScenePaddingDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('dead_scene 三无场景 — severity high + 首场扣 18 分 + 封顶 30 分', () => {
    assert.ok(zh.includes('dead_scene'), '应包含 dead_scene 类型名');
    const ln = lineOf(zh, 'dead_scene');
    assert.ok(ln > 0, '定位 dead_scene 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `dead_scene 行应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 18 分'), `dead_scene 行应含精确锚点「扣 18 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 30 分'), `dead_scene 行应含精确锚点「封顶 30 分」，实际: ${line}`);
  });

  test('recap_dump 复述注水 — severity mid + 扣 12 分', () => {
    assert.ok(zh.includes('recap_dump'), '应包含 recap_dump 类型名');
    const ln = lineOf(zh, 'recap_dump');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `recap_dump 行应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 12 分'), `recap_dump 行应含精确锚点「扣 12 分」，实际: ${line}`);
  });

  test('redundant_flashback 闪回注水 — severity low + 扣 8 分', () => {
    assert.ok(zh.includes('redundant_flashback'), '应包含 redundant_flashback 类型名');
    const ln = lineOf(zh, 'redundant_flashback');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `redundant_flashback 行应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 8 分'), `redundant_flashback 行应含精确锚点「扣 8 分」，实际: ${line}`);
  });

  test('slow_open 寒暄开场 — severity mid + 扣 10 分', () => {
    assert.ok(zh.includes('slow_open'), '应包含 slow_open 类型名');
    const ln = lineOf(zh, 'slow_open');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `slow_open 行应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 10 分'), `slow_open 行应含精确锚点「扣 10 分」，实际: ${line}`);
  });

  test('draggy_tail 结尾拖堂 — severity mid + 扣 10 分', () => {
    assert.ok(zh.includes('draggy_tail'), '应包含 draggy_tail 类型名');
    const ln = lineOf(zh, 'draggy_tail');
    assert.ok(ln > 0);
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `draggy_tail 行应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 10 分'), `draggy_tail 行应含精确锚点「扣 10 分」，实际: ${line}`);
  });

  test('dead_scene 触发阈值 — 空转信号 ≥ 2 处', () => {
    const ln = lineOf(zh, 'dead_scene');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('≥ 2 处'), `dead_scene 行应含触发阈值「≥ 2 处」，实际: ${line}`);
  });

  test('recap_dump 触发阈值 — 复述 ≥ 2 处 或 前 5% 出现前情提要', () => {
    const ln = lineOf(zh, 'recap_dump');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('≥ 2 处'), `recap_dump 行应含「≥ 2 处」，实际: ${line}`);
    assert.ok(line.includes('前 5%'), `recap_dump 行应含「前 5%」，实际: ${line}`);
    assert.ok(line.includes('前情提要'), `recap_dump 行应含「前情提要」，实际: ${line}`);
  });

  test('slow_open 触发阈值 — 前 15% 推进 = 0 且空转 ≥ 3 处', () => {
    const ln = lineOf(zh, 'slow_open');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('前 15%'), `slow_open 行应含「前 15%」，实际: ${line}`);
    assert.ok(line.includes('≥ 3 处'), `slow_open 行应含「≥ 3 处」，实际: ${line}`);
  });

  test('评分公式 — score = clamp(100 - penalty, 0, 100)', () => {
    assert.ok(zh.includes('clamp(100 - penalty, 0, 100)'), '应含完整评分公式');
  });

  test('豁免条件 — 正文 < 20 字不评 + 死场正文 < 40 字跳过', () => {
    assert.ok(zh.includes('< 20 字'), '应含正文 < 20 字豁免');
    assert.ok(zh.includes('< 40 字'), '应含死场正文 < 40 字豁免');
  });
});

// ========== 英文层断言 ==========
describe('en — buildScenePaddingDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 5 个类型名', () => {
    assert.ok(en.includes('dead_scene'));
    assert.ok(en.includes('recap_dump'));
    assert.ok(en.includes('redundant_flashback'));
    assert.ok(en.includes('slow_open'));
    assert.ok(en.includes('draggy_tail'));
  });

  test('逐行 severity + 精确扣分（避免 -18 被子串 -8 误命中）', () => {
    const dl = en.split('\n')[lineOf(en, 'dead_scene') - 1];
    assert.ok(dl.includes('high') && dl.includes('-18'), `dead_scene 行应含 high 与 -18，实际: ${dl}`);
    const rl = en.split('\n')[lineOf(en, 'recap_dump') - 1];
    assert.ok(rl.includes('mid') && rl.includes('-12'), `recap_dump 行应含 mid 与 -12，实际: ${rl}`);
    const fl = en.split('\n')[lineOf(en, 'redundant_flashback') - 1];
    assert.ok(fl.includes('low') && fl.includes('-8'), `redundant_flashback 行应含 low 与 -8，实际: ${fl}`);
  });
});
