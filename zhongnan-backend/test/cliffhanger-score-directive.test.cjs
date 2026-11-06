'use strict';
// v2.399 cliffhanger-score 教学函数同源对齐测试
// 锚点词紧贴引擎源码：结尾窗口 + 七型强度表 + 七类问题扣分 + 两种封顶 + 评分公式

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/cliffhanger-score.js');

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

const zh = mod.buildCliffhangerScoreDirective('LIVE', 'zh');
const en = mod.buildCliffhangerScoreDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildCliffhangerScoreDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildCliffhangerScoreDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildCliffhangerScoreDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildCliffhangerScoreDirective(undefined, 'zh'), zh);
  });

  test('七型强度表 — 95/92/85/75/70/65/30', () => {
    assert.ok(zh.includes('反转钩（95 分）'), '应含反转钩 95');
    assert.ok(zh.includes('危机钩（92 分）'), '应含危机钩 92');
    assert.ok(zh.includes('揭秘钩（85 分）'), '应含揭秘钩 85');
    assert.ok(zh.includes('悬念钩（75 分）'), '应含悬念钩 75');
    assert.ok(zh.includes('情感钩（70 分）'), '应含情感钩 70');
    assert.ok(zh.includes('动作钩（65 分）'), '应含动作钩 65');
    assert.ok(zh.includes('弱钩（30 分）'), '应含弱钩 30');
  });

  test('结尾窗口 — 最后 5 行 + 截 220 字 + 跳过场头剧名页 + 取最高强度', () => {
    const ln = lineOf(zh, '结尾窗口');
    assert.ok(ln > 0, '应含结尾窗口口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('最后 5 行'), `应含最后 5 行，实际: ${line}`);
    assert.ok(line.includes('220 字'), `应含 220 字，实际: ${line}`);
    assert.ok(line.includes('跳过场头/剧名页/集标题/FADE OUT'), `应含跳过非正文行，实际: ${line}`);
    assert.ok(line.includes('最高'), `应含取最高强度，实际: ${line}`);
  });

  test('no_cliffhanger — high + 扣 15 分', () => {
    const ln = lineOf(zh, 'no_cliffhanger');
    assert.ok(ln > 0, '应包含 no_cliffhanger');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 15 分'), `应含「扣 15 分」，实际: ${line}`);
  });

  test('weak_cliffhanger — high + 扣 15 分 + 单个问号省略号不是钩子', () => {
    const ln = lineOf(zh, 'weak_cliffhanger');
    assert.ok(ln > 0, '应包含 weak_cliffhanger');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 15 分'), `应含「扣 15 分」，实际: ${line}`);
    assert.ok(line.includes('单个问号/省略号不是钩子'), `应含弱钩判定，实际: ${line}`);
  });

  test('medium_hook — mid + 扣 5 分 + 情感/动作钩偏软', () => {
    const ln = lineOf(zh, 'medium_hook');
    assert.ok(ln > 0, '应包含 medium_hook');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 5 分'), `应含「扣 5 分」，实际: ${line}`);
    assert.ok(line.includes('偏软'), `应含偏软提示，实际: ${line}`);
  });

  test('plan_misaligned — mid + 扣 5 分 + 前 5 个关键词 + 长度 ≥ 2', () => {
    const ln = lineOf(zh, 'plan_misaligned');
    assert.ok(ln > 0, '应包含 plan_misaligned');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 5 分'), `应含「扣 5 分」，实际: ${line}`);
    assert.ok(line.includes('前 5 个'), `应含前 5 个，实际: ${line}`);
    assert.ok(line.includes('长度 ≥ 2'), `应含长度 ≥ 2，实际: ${line}`);
  });

  test('low_urgency — low + 扣 2 分 + 强度 < 90', () => {
    const ln = lineOf(zh, 'low_urgency');
    assert.ok(ln > 0, '应包含 low_urgency');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 2 分'), `应含「扣 2 分」，实际: ${line}`);
    assert.ok(line.includes('强度 < 90'), `应含强度 < 90，实际: ${line}`);
  });

  test('dream_nullification — high + 扣 15 分 + 总分封顶 40', () => {
    const ln = lineOf(zh, 'dream_nullification');
    assert.ok(ln > 0, '应包含 dream_nullification');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 15 分'), `应含「扣 15 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 40'), `应含封顶 40，实际: ${line}`);
  });

  test('hook_deflated — mid + 扣 5 分 + 强度 ≥ 75 + 封顶 = 强度 − 20', () => {
    const ln = lineOf(zh, 'hook_deflated');
    assert.ok(ln > 0, '应包含 hook_deflated');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 5 分'), `应含「扣 5 分」，实际: ${line}`);
    assert.ok(line.includes('≥ 75'), `应含 ≥ 75，实际: ${line}`);
    assert.ok(line.includes('强度 − 20'), `应含封顶公式，实际: ${line}`);
  });

  test('评分公式 — maxStrength 起算 + high×15/mid×5/low×2 + clamp 与四舍五入', () => {
    assert.ok(zh.includes('maxStrength - high×15 - mid×5 - low×2'), '应含扣分公式');
    assert.ok(zh.includes('clamp(0, 100)'), '应含 clamp');
    assert.ok(zh.includes('四舍五入'), '应含取整口径');
  });

  test('紧迫词表与信号表 — 首尾锚点齐备', () => {
    assert.ok(zh.includes('突然/立刻/马上'), '应含紧迫词表');
    assert.ok(zh.includes('最后一次'), '应含紧迫词表尾项');
    assert.ok(zh.includes('没想到/谁知'), '应含反转信号表');
    assert.ok(zh.includes('枪口/刀刃'), '应含危机信号表');
  });

  test('成稿自查 — 六项可执行口径齐备', () => {
    assert.ok(zh.includes('落在反转（95）或危机（92）'), '应含强度自查');
    assert.ok(zh.includes('绝不单用问号/省略号收尾'), '应含弱钩自查');
    assert.ok(zh.includes('一切结束/尘埃落定'), '应含泄气自查');
    assert.ok(zh.includes('原来是一场梦'), '应含梦境自查');
    assert.ok(zh.includes('补一个紧迫词'), '应含紧迫自查');
    assert.ok(zh.includes('与 outline.cliffhanger 规划关键词对齐'), '应含规划对齐自查');
  });
});

// ========== 英文层断言 ==========
describe('en — buildCliffhangerScoreDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部类型名与 severity', () => {
    for (const t of ['reversal', 'crisis', 'reveal', 'mystery', 'emotional', 'action_cut', 'weak', 'no_cliffhanger', 'weak_cliffhanger', 'medium_hook', 'plan_misaligned', 'low_urgency', 'dream_nullification', 'hook_deflated']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('220 chars'), '应含 220 字窗口');
    assert.ok(en.includes('5 body lines'), '应含最后 5 行');
    assert.ok(en.includes('95'), '应含 95 强度');
    assert.ok(en.includes('92'), '应含 92 强度');
    assert.ok(en.includes('30'), '应含弱钩 30');
    assert.ok(en.includes('15 points'), '应含 15 分');
    assert.ok(en.includes('5 points'), '应含 5 分');
    assert.ok(en.includes('2 points'), '应含 2 分');
    assert.ok(en.includes('capped at 40'), '应含梦境封顶');
    assert.ok(en.includes('minus 20'), '应含泄气封顶');
    assert.ok(en.includes('clamp(0, 100'), '应含 clamp');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildCliffhangerScoreDirective('AIGC', 'en'), en);
    assert.equal(mod.buildCliffhangerScoreDirective(undefined, 'en'), en);
  });
});
