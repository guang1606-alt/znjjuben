'use strict';
// v2.396 character-logic 教学函数同源对齐测试
// 锚点词紧贴引擎源码：五类 severity + 精确扣分 18/9/4 + 阈值 + 豁免 + 自查口径

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/character-logic.js');

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

const zh = mod.buildCharacterLogicDirective('LIVE', 'zh');
const en = mod.buildCharacterLogicDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildCharacterLogicDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildCharacterLogicDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildCharacterLogicDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildCharacterLogicDirective(undefined, 'zh'), zh);
  });

  test('missing 悬空人物 — high + 扣 18 分 + 完全未出场', () => {
    assert.ok(zh.includes('missing'), '应包含 missing 类型名');
    const ln = lineOf(zh, 'missing 悬空人物');
    assert.ok(ln > 0, '定位 missing 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 18 分'), `应含「扣 18 分」，实际: ${line}`);
    assert.ok(line.includes('完全未出场'), `应含完全未出场，实际: ${line}`);
  });

  test('background 背景板 — mid + 扣 9 分 + 只被提及 + 零台词', () => {
    const ln = lineOf(zh, 'background 背景板');
    assert.ok(ln > 0, '应包含 background 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 9 分'), `应含「扣 9 分」，实际: ${line}`);
    assert.ok(line.includes('只在动作/叙述里被提及'), `应含只被提及，实际: ${line}`);
    assert.ok(line.includes('一句台词都没有'), `应含零台词，实际: ${line}`);
  });

  test('voice_break 人设崩塌 — mid + 扣 9 分 + 寡言 > 30 字 + 粗犷书面词表', () => {
    const ln = lineOf(zh, 'voice_break 人设崩塌');
    assert.ok(ln > 0, '应包含 voice_break 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 9 分'), `应含「扣 9 分」，实际: ${line}`);
    assert.ok(line.includes('寡言/少言/沉默/话少'), `应含寡言标签，实际: ${line}`);
    assert.ok(line.includes('> 30 字'), `应含 30 字阈值，实际: ${line}`);
    assert.ok(line.includes('粗犷/市井/大老粗/口语/接地气'), `应含粗犷标签，实际: ${line}`);
    assert.ok(line.includes('因此/然而/不仅'), `应含书面词示例，实际: ${line}`);
  });

  test('emotion_jump 情绪硬切 — low + 扣 4 分 + 正负极硬切 + 0 极性沿用上一非 0', () => {
    const ln = lineOf(zh, 'emotion_jump 情绪硬切');
    assert.ok(ln > 0, '应包含 emotion_jump 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 4 分'), `应含「扣 4 分」，实际: ${line}`);
    assert.ok(line.includes('正负极'), `应含正负极，实际: ${line}`);
    assert.ok(zh.includes('笑/喜/开心'), '应含正极词示例');
    assert.ok(zh.includes('怒/哭/吼'), '应含负极词示例');
    assert.ok(zh.includes('沿用上一个非 0 极性'), '应含 0 极性参照规则');
  });

  test('tool_support 单句龙套 — low + 扣 4 分 + 工具名表 + 只有 1 句 + △ 动作行', () => {
    const ln = lineOf(zh, 'tool_support 单句龙套');
    assert.ok(ln > 0, '应包含 tool_support 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 4 分'), `应含「扣 4 分」，实际: ${line}`);
    assert.ok(line.includes('路人/服务员/前台'), `应含工具名表，实际: ${line}`);
    assert.ok(zh.includes('只有 1 句台词'), '应含单句条件');
    assert.ok(zh.includes('△ 动作行'), '应含动作行判定');
  });

  test('扣分表 — high 18 / mid 9 / low 4 + max(0, 100 - 扣分) + 无 bonus', () => {
    assert.ok(zh.includes('high 18 分 / mid 9 分 / low 4 分'), '应含三分档扣分表');
    assert.ok(zh.includes('max(0, 100 - 扣分)'), '应含完整评分公式');
    assert.ok(zh.includes('无 bonus'), '应明确无 bonus');
  });

  test('台词提取口径 — 2-6 字符姓名 + （情绪）+ 冒号 + △/场头不计', () => {
    assert.ok(zh.includes('行首 2-6 字符姓名'), '应含姓名长度口径');
    assert.ok(zh.includes('（情绪）'), '应含括号情绪');
    assert.ok(zh.includes('△ 开头与场头行不计台词'), '应含排除规则');
  });

  test('无 cast 豁免 — 五类不触发 + 满分 100 + 有卡零台词仍报 missing/background', () => {
    assert.ok(zh.includes('无 cast 时五类都不触发'), '应含无卡豁免');
    assert.ok(zh.includes('满分 100'), '应含满分放行');
    assert.ok(zh.includes('有 cast 但正文无对白时 missing/background 仍然报'), '应含零台词边界');
  });

  test('成稿自查 — 五条可执行口径齐备', () => {
    assert.ok(zh.includes('每个主要角色至少一句台词'), '应含出场自查');
    assert.ok(zh.includes('寡言者一句不超过 30 字'), '应含寡言自查');
    assert.ok(zh.includes('粗犷者不用书面连接词'), '应含粗犷自查');
    assert.ok(zh.includes('情绪翻转前补一个动作或停顿'), '应含情绪自查');
    assert.ok(zh.includes('工具名角色单句必须配自己的动作'), '应含龙套自查');
  });
});

// ========== 英文层断言 ==========
describe('en — buildCharacterLogicDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 5 个类型名与 severity', () => {
    for (const t of ['missing', 'background', 'voice_break', 'emotion_jump', 'tool_support']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('18 points'), '应含 18 分');
    assert.ok(en.includes('9 points'), '应含 9 分');
    assert.ok(en.includes('4 points'), '应含 4 分');
    assert.ok(en.includes('max(0, 100 - penalty)'), '应含评分公式');
    assert.ok(en.includes('> 30 chars'), '应含 30 字阈值');
    assert.ok(en.includes('full 100'), '应含满分放行');
  });
});
