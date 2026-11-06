'use strict';
// v2.402 dialogue-length 教学函数同源对齐测试
// 锚点词紧贴引擎源码：对白行识别 + 五档长度 + 独白/节奏口径 + 扣分表

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/dialogue-length-score.js');

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

const zh = mod.buildDialogueLengthDirective('LIVE', 'zh');
const en = mod.buildDialogueLengthDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildDialogueLengthDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildDialogueLengthDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('对白长度'), '标题应点明对白长度');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildDialogueLengthDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildDialogueLengthDirective(undefined, 'zh'), zh);
  });

  test('对白行识别口径 — 1-6 字姓名 + 可选（情绪）+ 冒号 + 非空', () => {
    const s = lineOf(zh, '对白行识别');
    assert.ok(s, '应有对白行识别口径行');
    assert.ok(s.includes('1-6'), '姓名长度 1-6');
    assert.ok(s.includes('（情绪）'), '可选情绪括号');
    assert.ok(s.includes('冒号'), '冒号分隔');
  });

  test('动作行排除 — △▲*✦ 四类前缀不计入对白', () => {
    const s = lineOf(zh, '动作行');
    assert.ok(s, '应有动作行排除口径');
    assert.ok(s.includes('△▲*✦'), '四类动作前缀');
  });

  test('英文对白行口径 — 首字母大写 + 至多 15 字母', () => {
    const s = lineOf(zh, '英文对白');
    assert.ok(s, '应有英文对白行口径');
    assert.ok(s.includes('15'), '至多 15 字母');
  });

  test('字数口径 — 中文按汉字数、英文按单词数 ×1.67 四舍五入', () => {
    const s = lineOf(zh, '1.67');
    assert.ok(s, '应有英文换算口径');
    assert.ok(s.includes('四舍五入'), '四舍五入');
    assert.ok(s.includes('汉字'), '中文按汉字');
  });

  test('五档分界 — ≤15 / 16-25 / 26-40 / 41-60 / >60', () => {
    const s = lineOf(zh, '五档分界');
    assert.ok(s, '应有五档分界行');
    const tiers = ['≤15', '16-25', '26-40', '41-60', '>60'];
    for (const t of tiers) assert.ok(s.includes(t), `档位行应包含 ${t}`);
  });

  test('五档名称 — short/medium/long/extra_long/wall', () => {
    const s = lineOf(zh, '五档分界');
    const names = ['short', 'medium', 'long', 'extra_long', 'wall'];
    for (const n of names) assert.ok(s.includes(n), `档位行应包含档位名 ${n}`);
  });

  test('超长定义 — 41-60 与 >60 合计，占比阈值 15% / 30%', () => {
    const s = lineOf(zh, '超长对白占比');
    assert.ok(s, '应有超长占比口径');
    assert.ok(s.includes('15%'), '15% 线');
    assert.ok(s.includes('30%'), '30% 线');
  });

  test('独白戏口径 — 连续 ≥3 条或累计 ≥80 字；严重 ≥4 条或 ≥100 字', () => {
    const s = lineOf(zh, '独白');
    assert.ok(s, '应有独白戏口径');
    assert.ok(s.includes('连续 3 条以上'), '连续 3 条');
    assert.ok(s.includes('累计 80 字以上'), '累计 80 字');
    assert.ok(s.includes('连续 4 条以上'), '严重 4 条');
    assert.ok(s.includes('累计 100 字以上'), '严重 100 字');
  });

  test('节奏口径 — 少于 4 条不判，平均长度差 ≥3 或全短 >80%', () => {
    const s = lineOf(zh, '节奏');
    assert.ok(s, '应有节奏口径');
    assert.ok(s.includes('少于 4 条不判'), '4 条门槛');
    assert.ok(s.includes('平均差 ≥3'), '平均差 ≥3');
    assert.ok(s.includes('>80%'), '全短 80%');
    assert.ok(s.includes('>60%'), '全长 60%');
  });

  test('平均长度门槛 — 恰好 5 条起判，>25 / >20 两档', () => {
    const s = lineOf(zh, '平均对白长度');
    assert.ok(s, '应有平均长度口径');
    assert.ok(s.includes('恰好 5 条起判'), '5 条起判');
    assert.ok(s.includes('>25 为 mid'), '25 字线');
    assert.ok(s.includes('>20 为 low'), '20 字线');
  });

  test('扣分表 — 台词墙 8/条、超长 3/条、平均 10/5、占比 15/8', () => {
    const s = lineOf(zh, '扣分');
    assert.ok(s, '应有扣分行');
    assert.ok(s.includes('台词墙每条扣 8'), '台词墙 8');
    assert.ok(s.includes('超长对白每条扣 3'), '超长 3');
    assert.ok(s.includes('>25 扣 10'), '平均 10');
    assert.ok(s.includes('>20 扣 5'), '平均 5');
    assert.ok(s.includes('>30% 扣 15'), '占比 15');
    assert.ok(s.includes('>15% 扣 8'), '占比 8');
  });

  test('独白与节奏扣分 — 严重 8 / 轻度 4 / 无节奏 8 / 对白过少 5', () => {
    const s = lineOf(zh, '独白扣分');
    assert.ok(s, '应有独白扣分行');
    assert.ok(s.includes('严重独白每处扣 8'), '严重 8');
    assert.ok(s.includes('轻度独白每处扣 4'), '轻度 4');
    assert.ok(s.includes('无节奏扣 8'), '无节奏 8');
    assert.ok(s.includes('对白过少扣 5'), '过少 5');
  });

  test('问题类型名与 severity 齐备', () => {
    const types = [
      'dialogue_wall', 'overlong_ratio_high', 'overlong_ratio_mid',
      'monologue_serious', 'monologue_mild', 'avg_too_long',
      'avg_slightly_long', 'no_rhythm', 'too_few_dialogues',
    ];
    for (const t of types) assert.ok(zh.includes(t), `应包含问题类型 ${t}`);
    assert.ok(zh.includes('high'), 'high severity');
    assert.ok(zh.includes('mid'), 'mid severity');
    assert.ok(zh.includes('low'), 'low severity');
  });

  test('总分规则 — 100 起扣并 clamp 0-100', () => {
    const s = lineOf(zh, '总分');
    assert.ok(s, '应有总分规则');
    assert.ok(s.includes('100'), '满分 100');
    assert.ok(s.includes('clamp'), 'clamp');
  });

  test('成稿自查 — 至少覆盖短句占比、台词墙、独白、超长占比', () => {
    const s = lineOf(zh, '成稿自查');
    assert.ok(s, '应有成稿自查段');
  });
});

// ========== 英文层断言 ==========
describe('en — buildDialogueLengthDirective', () => {
  test('非空且含标题', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    assert.ok(en.toLowerCase().includes('dialogue length'), '标题应点明 dialogue length');
  });

  test('零中文（无 CJK 字符）', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('全部问题类型名与 severity 齐备', () => {
    const types = [
      'dialogue_wall', 'overlong_ratio_high', 'overlong_ratio_mid',
      'monologue_serious', 'monologue_mild', 'avg_too_long',
      'avg_slightly_long', 'no_rhythm', 'too_few_dialogues',
    ];
    for (const t of types) assert.ok(en.includes(t), `应包含 ${t}`);
    assert.ok(en.includes('high') && en.includes('mid') && en.includes('low'), 'severity 齐备');
  });

  test('关键数字锚点 — 15/25/40/60/1.67/80/100/0.15/0.3', () => {
    const nums = ['15', '25', '40', '60', '1.67', '80', '100', '0.15', '0.3'];
    for (const n of nums) assert.ok(en.includes(n), `应包含数字 ${n}`);
  });

  test('format 不门控 — AIGC 与缺省一致', () => {
    assert.equal(mod.buildDialogueLengthDirective('AIGC', 'en'), en);
    assert.equal(mod.buildDialogueLengthDirective(undefined, 'en'), en);
  });
});
