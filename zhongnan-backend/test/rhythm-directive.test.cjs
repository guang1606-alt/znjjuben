'use strict';
// v2.398 rhythm 教学函数同源对齐测试
// 锚点词紧贴引擎源码：四节拍窗口 + 信号表 + 动作行占比区间 + 评分构成 + 不额外扣分

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/rhythm.js');

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

const zh = mod.buildRhythmDirective('LIVE', 'zh');
const en = mod.buildRhythmDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildRhythmDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildRhythmDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildRhythmDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildRhythmDirective(undefined, 'zh'), zh);
  });

  test('flat_open — high + 前 120 字 + 失 20 分', () => {
    const ln = lineOf(zh, 'flat_open');
    assert.ok(ln > 0, '应包含 flat_open 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('前 120 字'), `应含前 120 字，实际: ${line}`);
    assert.ok(line.includes('失 20 分'), `应含「失 20 分」，实际: ${line}`);
  });

  test('no_conflict — high + 对抗信号 ≥ 2 处 + 失 20 分', () => {
    const ln = lineOf(zh, 'no_conflict');
    assert.ok(ln > 0, '应包含 no_conflict 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('≥ 2 处'), `应含 ≥ 2 处，实际: ${line}`);
    assert.ok(line.includes('失 20 分'), `应含「失 20 分」，实际: ${line}`);
  });

  test('no_turn — mid + 全片任意位置 + 失 20 分', () => {
    const ln = lineOf(zh, 'no_turn');
    assert.ok(ln > 0, '应包含 no_turn 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('全片任意位置'), `应含全片任意位置，实际: ${line}`);
    assert.ok(line.includes('失 20 分'), `应含「失 20 分」，实际: ${line}`);
  });

  test('no_blank — mid + 最后 140 字 + 失 20 分', () => {
    const ln = lineOf(zh, 'no_blank');
    assert.ok(ln > 0, '应包含 no_blank 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('最后 140 字'), `应含最后 140 字，实际: ${line}`);
    assert.ok(line.includes('失 20 分'), `应含「失 20 分」，实际: ${line}`);
  });

  test('no_breath — mid + 动作行占比 < 0.15', () => {
    const ln = lineOf(zh, 'no_breath');
    assert.ok(ln > 0, '应包含 no_breath 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('0.15'), `应含 0.15，实际: ${line}`);
    assert.ok(line.includes('全程对词'), `应含全程对词，实际: ${line}`);
  });

  test('over_describe — low + 占比 > 0.7 + 呼吸分只 +8', () => {
    const ln = lineOf(zh, 'over_describe');
    assert.ok(ln > 0, '应包含 over_describe 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('0.7'), `应含 0.7，实际: ${line}`);
    assert.ok(line.includes('+8 分'), `应含 +8 分，实际: ${line}`);
  });

  test('开场窗口 — 跳过场头与剧名页 + 前 6 行拼接后截前 120 字', () => {
    assert.ok(zh.includes('跳过场头与剧名页'), '应含场头跳过');
    assert.ok(zh.includes('前 6 行拼接后截前 120 字'), '应含开场窗口口径');
  });

  test('结尾窗口 — 后 6 行拼接后截后 140 字', () => {
    assert.ok(zh.includes('后 6 行拼接后截后 140 字'), '应含结尾窗口口径');
  });

  test('四张信号表 — 钩子/对抗/转折/留白各含首尾锚点', () => {
    assert.ok(zh.includes('摔/踹/冲/跪/撕'), '应含钩子信号表');
    assert.ok(zh.includes('遗产'), '应含钩子信号表尾项');
    assert.ok(zh.includes('吵/争/骂/怼'), '应含对抗信号表');
    assert.ok(zh.includes('没想到/谁知/就在这时'), '应含转折信号表');
    assert.ok(zh.includes('没再回头/沉默/愣住'), '应含留白信号表');
  });

  test('统计口径 — total = max(1, 台词行 + 动作行) + 占比两位小数', () => {
    assert.ok(zh.includes('total = max(1, 台词行 + 动作行)'), '应含 total 口径');
    assert.ok(zh.includes('两位小数'), '应含占比精度');
    assert.ok(zh.includes('△ 开头计动作行'), '应含动作行判定');
  });

  test('评分构成 — 四节拍各 20 + 呼吸 20/8 + clamp + 问题不额外扣分', () => {
    assert.ok(zh.includes('四节拍各 20 分 + 呼吸 20 分'), '应含评分构成');
    assert.ok(zh.includes('0.15-0.7'), '应含健康区间');
    assert.ok(zh.includes('clamp(0, 100)'), '应含 clamp');
    assert.ok(zh.includes('问题不再额外扣分'), '应含不额外扣分口径');
  });

  test('成稿自查 — 五项可执行口径齐备', () => {
    assert.ok(zh.includes('开场前 120 字内落一个冲突或反常画面'), '应含开场自查');
    assert.ok(zh.includes('至少 2 处对抗'), '应含对抗自查');
    assert.ok(zh.includes('中后段安排一次转折'), '应含转折自查');
    assert.ok(zh.includes('结尾 140 字留钩'), '应含留白自查');
    assert.ok(zh.includes('动作行占比压进 0.15-0.7'), '应含呼吸自查');
  });
});

// ========== 英文层断言 ==========
describe('en — buildRhythmDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部类型名与 severity', () => {
    for (const t of ['flat_open', 'no_conflict', 'no_turn', 'no_blank', 'no_breath', 'over_describe']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('120 chars'), '应含开场窗口');
    assert.ok(en.includes('140 chars'), '应含结尾窗口');
    assert.ok(en.includes('0.15'), '应含呼吸下限');
    assert.ok(en.includes('0.7'), '应含描述上限');
    assert.ok(en.includes('20 points'), '应含节拍分');
    assert.ok(en.includes('8 points'), '应含过描述呼吸分');
    assert.ok(en.includes('max(1'), '应含 total 口径');
    assert.ok(en.includes('clamp'), '应含 clamp');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildRhythmDirective('AIGC', 'en'), en);
    assert.equal(mod.buildRhythmDirective(undefined, 'en'), en);
  });
});
