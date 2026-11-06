'use strict';
// v2.393 timeline-consistency 教学函数同源对齐测试
// 锚点词紧贴引擎源码：severity 类别 + 具体扣分数字 + 触发阈值 + 豁免

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/timeline-consistency-check.js');

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

const zh = mod.buildTimelineConsistencyDirective('LIVE', 'zh');
const en = mod.buildTimelineConsistencyDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildTimelineConsistencyDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildTimelineConsistencyDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildTimelineConsistencyDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildTimelineConsistencyDirective(undefined, 'zh'), zh);
  });

  test('countdown_reversal 倒计时反转 — mid/high + 扣 10 分 + 每多 1 处 +8 分 + 封顶 22 分', () => {
    assert.ok(zh.includes('countdown_reversal'), '应包含 countdown_reversal 类型名');
    const ln = lineOf(zh, 'countdown_reversal');
    assert.ok(ln > 0, '定位 countdown_reversal 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid') && line.includes('high'), `应含 mid 与 high，实际: ${line}`);
    assert.ok(line.includes('扣 10 分'), `应含精确锚点「扣 10 分」，实际: ${line}`);
    assert.ok(line.includes('每多 1 处 +8 分'), `应含「每多 1 处 +8 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 22 分'), `应含「封顶 22 分」，实际: ${line}`);
    assert.ok(line.includes('2 小时'), `应含 2 小时容差，实际: ${line}`);
  });

  test('day_night_mismatch 昼夜打架 — mid + 每场扣 6 分 + 封顶 14 分', () => {
    const ln = lineOf(zh, 'day_night_mismatch');
    assert.ok(ln > 0, '应包含 day_night_mismatch 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('每场扣 6 分'), `应含「每场扣 6 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 14 分'), `应含「封顶 14 分」，实际: ${line}`);
  });

  test('time_skip_stuffing 跳时偷懒 — ≥3 处 low / ≥5 处 mid + 每处扣 2 分 + 封顶 8 分', () => {
    const ln = lineOf(zh, 'time_skip_stuffing');
    assert.ok(ln > 0, '应包含 time_skip_stuffing 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('≥3 处 low'), `应含「≥3 处 low」，实际: ${line}`);
    assert.ok(line.includes('≥5 处 mid'), `应含「≥5 处 mid」，实际: ${line}`);
    assert.ok(line.includes('每处扣 2 分'), `应含「每处扣 2 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 8 分'), `应含「封顶 8 分」，实际: ${line}`);
  });

  test('timeline_squash 关系时长压扁 — mid + 每场扣 8 分 + 封顶 12 分', () => {
    const ln = lineOf(zh, 'timeline_squash');
    assert.ok(ln > 0, '应包含 timeline_squash 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('每场扣 8 分'), `应含「每场扣 8 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 12 分'), `应含「封顶 12 分」，实际: ${line}`);
  });

  test('计时规则 — 按事件名词分表 + 单位换算 1 天=24 / 1 周=168 / 1 个月=720', () => {
    assert.ok(zh.includes('按事件名词'), '应含事件名词分表计时');
    assert.ok(zh.includes('1 天=24'), '应含 1 天=24');
    assert.ok(zh.includes('1 周=168'), '应含 1 周=168');
    assert.ok(zh.includes('1 个月=720'), '应含 1 个月=720');
    assert.ok(zh.includes('容差 2 小时'), '应含容差 2 小时');
  });

  test('跳时规则 — 所有在跑的倒计时同步扣减', () => {
    assert.ok(zh.includes('同步扣减'), '应含「同步扣减」');
  });

  test('正信号 — 标题昼夜标注每场 +1 封顶 +3', () => {
    assert.ok(zh.includes('封顶 +3'), '应含「封顶 +3」');
  });

  test('评分公式 — score = clamp(100 - penalty + bonus, 0, 100)', () => {
    assert.ok(zh.includes('clamp(100 - penalty + bonus, 0, 100)'), '应含完整评分公式');
  });

  test('豁免 — 正文 < 20 字不评 + 满分 100', () => {
    assert.ok(zh.includes('< 20 字'), '应含正文 < 20 字豁免');
    assert.ok(zh.includes('满分 100'), '应含满分 100 说明');
  });
});

// ========== 英文层断言 ==========
describe('en — buildTimelineConsistencyDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 4 个类型名', () => {
    assert.ok(en.includes('countdown_reversal'));
    assert.ok(en.includes('day_night_mismatch'));
    assert.ok(en.includes('time_skip_stuffing'));
    assert.ok(en.includes('timeline_squash'));
  });

  test('countdown_reversal — mid/high + -10 + +8 + cap 22', () => {
    const line = en.split('\n')[lineOf(en, 'countdown_reversal') - 1];
    assert.ok(line.includes('mid') && line.includes('high'), `应含 mid 与 high，实际: ${line}`);
    assert.ok(line.includes('-10'), `应含 -10，实际: ${line}`);
    assert.ok(line.includes('+8'), `应含 +8，实际: ${line}`);
    assert.ok(line.includes('cap 22'), `应含 cap 22，实际: ${line}`);
  });

  test('day_night_mismatch — mid + 6 points per scene + cap 14', () => {
    const line = en.split('\n')[lineOf(en, 'day_night_mismatch') - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('6 points per scene'), `应含 6 points per scene，实际: ${line}`);
    assert.ok(line.includes('cap 14'), `应含 cap 14，实际: ${line}`);
  });

  test('time_skip_stuffing — low/mid + 2 points per line + cap 8', () => {
    const line = en.split('\n')[lineOf(en, 'time_skip_stuffing') - 1];
    assert.ok(line.includes('low') && line.includes('mid'), `应含 low 与 mid，实际: ${line}`);
    assert.ok(line.includes('2 points per line'), `应含 2 points per line，实际: ${line}`);
    assert.ok(line.includes('cap 8'), `应含 cap 8，实际: ${line}`);
  });

  test('timeline_squash — mid + 8 points per scene + cap 12', () => {
    const line = en.split('\n')[lineOf(en, 'timeline_squash') - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('8 points per scene'), `应含 8 points per scene，实际: ${line}`);
    assert.ok(line.includes('cap 12'), `应含 cap 12，实际: ${line}`);
  });
});
