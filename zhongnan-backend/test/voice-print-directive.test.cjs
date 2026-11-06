'use strict';
// v2.397 voice-print 教学函数同源对齐测试
// 锚点词紧贴引擎源码：样本门槛 + 七维指纹 + 相似度四段权重 + 三档扣分 + 整体同质化

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/voice-print.js');

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

const zh = mod.buildVoicePrintDirective('LIVE', 'zh');
const en = mod.buildVoicePrintDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildVoicePrintDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildVoicePrintDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildVoicePrintDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildVoicePrintDirective(undefined, 'zh'), zh);
  });

  test('样本门槛 — 台词 ≥ 2 句才参与两两比对 + < 2 句 low 扣 1 分', () => {
    assert.ok(zh.includes('台词 ≥ 2 句'), '应含参与门槛');
    const ln = lineOf(zh, 'voice_thin_sample');
    assert.ok(ln > 0, '应包含 voice_thin_sample 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 1 分'), `应含「扣 1 分」，实际: ${line}`);
    assert.ok(line.includes('< 2 句'), `应含 < 2 句，实际: ${line}`);
  });

  test('七维指纹 — 平均句长 + ≤ 8 字短句 + ≥ 30 字长句 + 问叹占比', () => {
    assert.ok(zh.includes('avgLen'), '应含平均句长字段');
    assert.ok(zh.includes('≤ 8 字'), '应含短句阈值');
    assert.ok(zh.includes('≥ 30 字'), '应含长句阈值');
    assert.ok(zh.includes('含「？」或「?」'), '应含疑问句口径');
    assert.ok(zh.includes('含「！」或「!」'), '应含感叹句口径');
  });

  test('语气词与书面词 — 26 个语气词 + 29 个书面词同源', () => {
    assert.ok(zh.includes('26 个高频语气词'), '应含语气词数量');
    assert.ok(zh.includes('啊/呢/吧/呗/嘛'), '应含语气词表');
    assert.ok(zh.includes('惹'), '应含语气词表尾项');
    assert.ok(zh.includes('书面词命中'), '应含书面词维度');
    assert.ok(zh.includes('然而/因此/此外'), '应含书面词表示例');
    assert.ok(zh.includes('显而易见'), '应含书面词表尾段');
  });

  test('相似度公式 — 四段权重 25/40/25/10', () => {
    assert.ok(zh.includes('句长分×25%'), '应含句长权重');
    assert.ok(zh.includes('四个句式分均值×40%'), '应含句式权重');
    assert.ok(zh.includes('语气词分×25%'), '应含语气词权重');
    assert.ok(zh.includes('书面词分×10%'), '应含书面词权重');
  });

  test('相似度分项 — 句长每差 1 字扣 4 分 + 占比差 × 150 + Jaccard + 书面词差 × 10', () => {
    const ln = lineOf(zh, '句长分 = max(0, 100 - 平均句长差');
    assert.ok(ln > 0, '应含句长分公式');
    assert.ok(zh.split('\n')[ln - 1].includes('× 4'), '句长分应含 × 4');
    assert.ok(zh.includes('占比差 × 150'), '应含句式分公式');
    assert.ok(zh.includes('Jaccard'), '应含语气词 Jaccard');
    assert.ok(zh.includes('双方都没有语气词时记 100'), '应含空集满分边界');
    assert.ok(zh.includes('书面词命中差 × 10'), '应含书面词分公式');
  });

  test('high 档 — 相似度 > 85 + 每个角色对扣 15 分', () => {
    const ln = lineOf(zh, 'voice_homogeneous_pair');
    assert.ok(ln > 0, '应包含 voice_homogeneous_pair 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('> 85'), `应含 > 85，实际: ${line}`);
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 15 分'), `应含「扣 15 分」，实际: ${line}`);
  });

  test('mid 档 — > 70 且 ≤ 85 + 每个角色对扣 5 分', () => {
    const ln = lineOf(zh, '≤ 85');
    assert.ok(ln > 0, '应含 mid 区间');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('> 70'), `应含 > 70，实际: ${line}`);
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 5 分'), `应含「扣 5 分」，实际: ${line}`);
  });

  test('整体同质化 — 3 个及以上角色两两 > 85 + 再扣 15 分', () => {
    const ln = lineOf(zh, 'voice_homogeneous_all');
    assert.ok(ln > 0, '应包含 voice_homogeneous_all 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('3 个及以上'), `应含 3 个及以上，实际: ${line}`);
    assert.ok(line.includes('> 85'), `应含 > 85，实际: ${line}`);
    assert.ok(line.includes('再扣 15 分'), `应含「再扣 15 分」，实际: ${line}`);
  });

  test('总分公式与重写闸门 — max(0, min(100, …)) + 任一 high 触发重写', () => {
    assert.ok(zh.includes('max(0, min(100, 100 - high×15 - mid×5 - low×1))'), '应含完整评分公式');
    assert.ok(zh.includes('任一 high 触发重写'), '应含重写闸门');
  });

  test('台词提取口径 — 2-6 字符姓名 + （情绪）+ 冒号 + △/场头不计', () => {
    assert.ok(zh.includes('2-6 字符姓名'), '应含姓名长度口径');
    assert.ok(zh.includes('（情绪）'), '应含括号情绪');
    assert.ok(zh.includes('△ 与场头不计'), '应含排除规则');
  });

  test('邻居边界 — 不查人设崩塌/不查书面腔本身', () => {
    assert.ok(zh.includes('不查单角色人设崩塌'), '应声明与 character-logic 的边界');
    assert.ok(zh.includes('也不查书面腔本身'), '应声明与 dialogue 的边界');
  });

  test('成稿自查 — 四项拉开 + 换角测试 + 声音跨场稳定', () => {
    assert.ok(zh.includes('换另一个角色说'), '应含换角自检');
    assert.ok(zh.includes('≤ 8 字短促') || zh.includes('一个 ≤ 8 字'), '应含句长拉开示例');
    assert.ok(zh.includes('一个几乎不用'), '应含语气词拉开示例');
    assert.ok(zh.includes('跨场稳定'), '应含习惯稳定性要求');
  });
});

// ========== 英文层断言 ==========
describe('en — buildVoicePrintDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部类型名与 severity', () => {
    for (const t of ['voice_homogeneous_pair', 'voice_homogeneous_all', 'voice_thin_sample']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('15 points'), '应含 15 分');
    assert.ok(en.includes('5 points'), '应含 5 分');
    assert.ok(en.includes('1 point'), '应含 1 分');
    assert.ok(en.includes('85'), '应含 85 阈值');
    assert.ok(en.includes('70'), '应含 70 阈值');
    assert.ok(en.includes('8 chars'), '应含短句阈值');
    assert.ok(en.includes('30 chars'), '应含长句阈值');
    assert.ok(en.includes('25%'), '应含句长权重');
    assert.ok(en.includes('40%'), '应含句式权重');
    assert.ok(en.includes('10%'), '应含书面词权重');
    assert.ok(en.includes('Jaccard'), '应含语气词算法');
    assert.ok(en.includes('2 dialogue lines'), '应含样本门槛');
    assert.ok(en.includes('max(0, min(100'), '应含评分公式');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildVoicePrintDirective('AIGC', 'en'), en);
    assert.equal(mod.buildVoicePrintDirective(undefined, 'en'), en);
  });
});
