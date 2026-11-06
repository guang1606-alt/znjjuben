'use strict';
// v2.400 scene-density 教学函数同源对齐测试
// 锚点词紧贴引擎源码：场景切分/类型判定 + 五维评分档位 + 十类问题阈值 + 情绪极性

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/scene-density-score.js');

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

const zh = mod.buildSceneDensityDirective('LIVE', 'zh');
const en = mod.buildSceneDensityDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildSceneDensityDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildSceneDensityDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildSceneDensityDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSceneDensityDirective(undefined, 'zh'), zh);
  });

  test('五维分值 — 25/25/20/15/15', () => {
    assert.ok(zh.includes('场景数（25 分）'), '应含场景数 25');
    assert.ok(zh.includes('长度均衡（25 分）'), '应含长度均衡 25');
    assert.ok(zh.includes('对白/动作比（20 分）'), '应含对白动作比 20');
    assert.ok(zh.includes('场景质量（15 分）'), '应含场景质量 15');
    assert.ok(zh.includes('跨场情绪推进（15 分）'), '应含情绪推进 15');
  });

  test('场景数档位 — 3-5 得 25 / 2 或 6 得 18 / 1 或 7 得 10 / 其余 5', () => {
    const ln = lineOf(zh, '3-5 场得 25');
    assert.ok(ln > 0, '应含场景数档位');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('2 或 6 场得 18'), `应含 2/6 场 18 分，实际: ${line}`);
    assert.ok(line.includes('1 或 7 场得 10'), `应含 1/7 场 10 分，实际: ${line}`);
    assert.ok(line.includes('其余得 5'), `应含其余 5 分，实际: ${line}`);
  });

  test('长度均衡 — count<2 得 0 + 变异系数四档 0.3/0.5/0.8', () => {
    const ln = lineOf(zh, '变异系数 cv');
    assert.ok(ln > 0, '应含变异系数口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('count < 2'), `应含单场 0 分，实际: ${line}`);
    assert.ok(line.includes('cv ≤ 0.3 得 25'), `应含 0.3 档，实际: ${line}`);
    assert.ok(line.includes('≤ 0.5 得 18'), `应含 0.5 档，实际: ${line}`);
    assert.ok(line.includes('≤ 0.8 得 10'), `应含 0.8 档，实际: ${line}`);
    assert.ok(line.includes('其余得 5'), `应含其余 5 分，实际: ${line}`);
  });

  test('对白/动作比 — 0.3-0.7 均衡场 + 20×占比四舍五入', () => {
    const ln = lineOf(zh, '单场 dialogueRatio');
    assert.ok(ln > 0, '应含均衡场口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('0.3-0.7'), `应含 0.3-0.7 区间，实际: ${line}`);
    assert.ok(line.includes('20 × 均衡场数 ÷ 场景数'), `应含占比公式，实际: ${line}`);
    assert.ok(line.includes('四舍五入'), `应含四舍五入，实际: ${line}`);
  });

  test('场景质量 — 15 − 问题场数×5 + 最低 0', () => {
    const ln = lineOf(zh, '问题场数');
    assert.ok(ln > 0, '应含问题场数口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('15 - 问题场数'), `应含 15 分扣减，实际: ${line}`);
    assert.ok(line.includes('× 5'), `应含每场 5 分，实际: ${line}`);
    assert.ok(line.includes('最低 0'), `应含下限，实际: ${line}`);
  });

  test('跨场情绪推进 — ≥2 种非中性极性得 15 否则 5', () => {
    const ln = lineOf(zh, '非中性情绪极性');
    assert.ok(ln > 0, '应含情绪推进口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('≥ 2 种'), `应含 2 种阈值，实际: ${line}`);
    assert.ok(line.includes('得 15'), `应含 15 分，实际: ${line}`);
    assert.ok(line.includes('否则得 5'), `应含否则 5 分，实际: ${line}`);
  });

  test('场景类型判定顺序 — fragment → static → dragging + 末场豁免 static', () => {
    const ln = lineOf(zh, '场景类型判定顺序');
    assert.ok(ln > 0, '应含判定顺序');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('fragment'), `应含 fragment，实际: ${line}`);
    assert.ok(line.includes('static'), `应含 static，实际: ${line}`);
    assert.ok(line.includes('dragging'), `应含 dragging，实际: ${line}`);
    assert.ok(line.includes('有效行 < 3 且字数 < 50'), `应含碎片阈值，实际: ${line}`);
    assert.ok(line.includes('非末场、冲突 0 处、有效行 ≥ 4'), `应含静态阈值，实际: ${line}`);
    assert.ok(line.includes('占全文 > 40% 且冲突 < 2 处'), `应含拖沓阈值，实际: ${line}`);
    assert.ok(line.includes('末场允许低冲突，不判 static'), `应含末场豁免，实际: ${line}`);
  });

  test('统计口径 — 字号 1.67/汉字数 + 冲突按行计 + 场头单一事实源', () => {
    const wc = zh.split('\n')[lineOf(zh, '英文按单词数') - 1];
    assert.ok(wc.includes('× 1.67'), `应含英文 1.67 系数，实际: ${wc}`);
    assert.ok(wc.includes('四舍五入'), `应含四舍五入，实际: ${wc}`);
    assert.ok(zh.includes('中文按汉字数'), '应含中文汉字口径');
    const cf = zh.split('\n')[lineOf(zh, '一行命中多个关键词') - 1];
    assert.ok(cf.includes('仍只计 1 处'), `应含按行计，实际: ${cf}`);
    assert.ok(zh.includes('script-scenes 单一事实源'), '应含场头单一事实源');
    assert.ok(zh.includes('整篇视作 1 场'), '应含无场头兜底');
  });

  test('十类问题 — severity 与阈值逐条对齐', () => {
    const cases = [
      ['single_scene', 'high', '仅 1 场'],
      ['too_few_scenes', 'mid', '仅 2 场'],
      ['too_many_scenes', 'mid', '超过 7 场'],
      ['too_many_static', 'high', '≥ 2 个'],
      ['has_static', 'mid', '恰 1 个'],
      ['too_many_fragments', 'mid', '≥ 2 个'],
      ['dragging_scene', 'mid', '≥ 1 个'],
      ['length_imbalance', 'mid', '> 60%'],
      ['no_emotion_progression', 'mid', '≥ 3 但全片只有 1 种'],
      ['dialogue_wall', 'low', '> 0.85'],
    ];
    for (const [type, sev, cond] of cases) {
      const ln = lineOf(zh, type);
      assert.ok(ln > 0, `应包含 ${type}`);
      const line = zh.split('\n')[ln - 1];
      assert.ok(line.includes(sev), `${type} 应含 ${sev}，实际: ${line}`);
      assert.ok(line.includes(cond), `${type} 应含「${cond}」，实际: ${line}`);
    }
  });

  test('情绪极性词表 — 正负极首尾锚点齐备', () => {
    assert.ok(zh.includes('正极 笑/喜'), '应含正极词表');
    assert.ok(zh.includes('碾压'), '应含正极词表尾项');
    assert.ok(zh.includes('负极 怒/哭'), '应含负极词表');
    assert.ok(zh.includes('绝望/崩'), '应含负极词表尾项');
    assert.ok(zh.includes('正负计数相等记中性 0'), '应含中性判定');
  });

  test('评分汇总 — 五维相加后 clamp(0, 100)', () => {
    assert.ok(zh.includes('五维相加'), '应含汇总口径');
    assert.ok(zh.includes('clamp(0, 100)'), '应含 clamp');
  });

  test('成稿自查 — 五条可执行口径齐备', () => {
    assert.ok(zh.includes('每场承载一个明确节拍'), '应含切场自查');
    assert.ok(zh.includes('变异系数 cv ≤ 0.3 最稳'), '应含长度自查');
    assert.ok(zh.includes('对白占比留在 0.3-0.7'), '应含对白比自查');
    assert.ok(zh.includes('除末场外每场至少落 1 处冲突'), '应含冲突自查');
    assert.ok(zh.includes('正负至少各落一场'), '应含情绪推进自查');
  });
});

// ========== 英文层断言 ==========
describe('en — buildSceneDensityDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部类型名与 severity', () => {
    for (const t of ['single_scene', 'too_few_scenes', 'too_many_scenes', 'too_many_static', 'has_static', 'too_many_fragments', 'dragging_scene', 'length_imbalance', 'no_emotion_progression', 'dialogue_wall']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('10 issue types'), '应含十类问题');
    assert.ok(en.includes('3-5 scenes'), '应含理想场景数');
    assert.ok(en.includes('25 points'), '应含 25 分');
    assert.ok(en.includes('20 points'), '应含 20 分');
    assert.ok(en.includes('15 points'), '应含 15 分');
    assert.ok(en.includes('0.3-0.7'), '应含对白比区间');
    assert.ok(en.includes('0.3'), '应含均衡档');
    assert.ok(en.includes('0.5'), '应含均衡档');
    assert.ok(en.includes('0.8'), '应含均衡档');
    assert.ok(en.includes('0.85'), '应含台词墙阈值');
    assert.ok(en.includes('40%'), '应含拖沓占比');
    assert.ok(en.includes('60%'), '应含最长场占比');
    assert.ok(en.includes('1.67'), '应含英文语速系数');
    assert.ok(en.includes('clamp(0, 100'), '应含 clamp');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildSceneDensityDirective('AIGC', 'en'), en);
    assert.equal(mod.buildSceneDensityDirective(undefined, 'en'), en);
  });
});
