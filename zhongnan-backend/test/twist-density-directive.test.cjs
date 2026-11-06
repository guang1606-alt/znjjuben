'use strict';
// v2.401 twist-density 教学函数同源对齐测试
// 锚点词紧贴引擎源码：七型强度 + 逐行去重/小反转抑制 + 三段分布 + 七类扣分

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/twist-density-score.js');

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

const zh = mod.buildTwistDensityDirective('LIVE', 'zh');
const en = mod.buildTwistDensityDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildTwistDensityDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildTwistDensityDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildTwistDensityDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildTwistDensityDirective(undefined, 'zh'), zh);
  });

  test('七型强度 — 90/85/80/75/70/65/60/35 逐型对齐', () => {
    const cases = [
      ['identity 身份反转（90）'],
      ['alignment 立场反转（85）'],
      ['status 状态反转（80）'],
      ['moral 道德反转（75）'],
      ['relationship 关系反转（70）'],
      ['information 信息反转（65）'],
      ['fate 命运反转（60）'],
      ['minor 小反转（35）'],
    ];
    for (const [anchor] of cases) {
      assert.ok(zh.includes(anchor), `应包含 ${anchor}`);
    }
  });

  test('统计口径 — 跳过非正文行 + 场头单一事实源', () => {
    assert.ok(zh.includes('跳过空行、场头、剧名页、集标题与 FADE OUT'), '应含跳过非正文行');
    assert.ok(zh.includes('script-scenes 单一事实源'), '应含场头单一事实源');
  });

  test('逐行去重 — 同一行取最强 + 小反转抑制', () => {
    const ln = lineOf(zh, '小反转仅在该行');
    assert.ok(ln > 0, '应含小反转抑制规则');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('只取强度最高的一个'), `应含取最强，实际: ${line}`);
    assert.ok(line.includes('强度 ≥ 60'), `应含 60 阈值，实际: ${line}`);
  });

  test('位置三段 — head/mid/tail 0.33/0.67 + clamp', () => {
    const ln = lineOf(zh, '位置 =');
    assert.ok(ln > 0, '应含位置口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('首次出现的字符偏移'), `应含首次偏移，实际: ${line}`);
    assert.ok(line.includes('clamp 到 0-1'), `应含 clamp，实际: ${line}`);
    assert.ok(line.includes('head < 0.33'), `应含 head 阈值，实际: ${line}`);
    assert.ok(line.includes('mid < 0.67'), `应含 mid 阈值，实际: ${line}`);
    assert.ok(line.includes('tail ≥ 0.67'), `应含 tail 阈值，实际: ${line}`);
  });

  test('聚合口径 — weakRatio 两位小数 + avgStrength 四舍五入 + 高潮反转 0.7/80', () => {
    const ln = lineOf(zh, 'weakRatio =');
    assert.ok(ln > 0, '应含 weakRatio 口径');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('强度 < 60'), `应含弱反转阈值，实际: ${line}`);
    assert.ok(line.includes('两位小数'), `应含两位小数，实际: ${line}`);
    assert.ok(line.includes('四舍五入'), `应含四舍五入，实际: ${line}`);
    assert.ok(zh.includes('位置 ≥ 0.7'), '应含高潮反转位置阈值');
    assert.ok(zh.includes('≥ 80'), '应含高潮反转强度阈值');
  });

  test('no_twist — high 扣 60', () => {
    const ln = lineOf(zh, 'no_twist');
    assert.ok(ln > 0, '应包含 no_twist');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 60'), `应含扣 60，实际: ${line}`);
    assert.ok(line.includes('零反转'), `应含触发条件，实际: ${line}`);
  });

  test('twist_insufficient — high 扣 30（仅 1 个）', () => {
    const ln = lineOf(zh, 'twist_insufficient');
    assert.ok(ln > 0, '应包含 twist_insufficient');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('扣 30'), `应含扣 30，实际: ${line}`);
    assert.ok(line.includes('仅 1 个'), `应含触发条件，实际: ${line}`);
  });

  test('twist_thin — mid 扣 15（仅 2 个）', () => {
    const ln = lineOf(zh, 'twist_thin');
    assert.ok(ln > 0, '应包含 twist_thin');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('扣 15'), `应含扣 15，实际: ${line}`);
    assert.ok(line.includes('仅 2 个'), `应含触发条件，实际: ${line}`);
  });

  test('twist_monotone 与 twist_backloaded — mid 各扣 15/10', () => {
    const mono = zh.split('\n')[lineOf(zh, 'twist_monotone') - 1];
    assert.ok(mono.includes('mid'), `monotone 应含 mid，实际: ${mono}`);
    assert.ok(mono.includes('扣 15'), `monotone 应含扣 15，实际: ${mono}`);
    assert.ok(mono.includes('类型多样性 < 2'), `monotone 应含多样性阈值，实际: ${mono}`);

    const back = zh.split('\n')[lineOf(zh, 'twist_backloaded') - 1];
    assert.ok(back.includes('mid'), `backloaded 应含 mid，实际: ${back}`);
    assert.ok(back.includes('扣 10'), `backloaded 应含扣 10，实际: ${back}`);
    assert.ok(back.includes('开头 + 中段反转数 < 1'), `backloaded 应含触发条件，实际: ${back}`);
  });

  test('twist_weak_heavy 与 no_climax_twist — low 各扣 10/5', () => {
    const weak = zh.split('\n')[lineOf(zh, 'twist_weak_heavy') - 1];
    assert.ok(weak.includes('low'), `weak_heavy 应含 low，实际: ${weak}`);
    assert.ok(weak.includes('扣 10'), `weak_heavy 应含扣 10，实际: ${weak}`);
    assert.ok(weak.includes('> 50%'), `weak_heavy 应含 50% 阈值，实际: ${weak}`);

    const climax = zh.split('\n')[lineOf(zh, 'no_climax_twist') - 1];
    assert.ok(climax.includes('low'), `no_climax 应含 low，实际: ${climax}`);
    assert.ok(climax.includes('扣 5'), `no_climax 应含扣 5，实际: ${climax}`);
    assert.ok(climax.includes('结尾段'), `no_climax 应含结尾段，实际: ${climax}`);
  });

  test('总分 — 只扣不加 + clamp(0, 100) + count=0 不叠加', () => {
    assert.ok(zh.includes('只扣不加'), '应含只扣不加');
    assert.ok(zh.includes('反转再多也不罚'), '应含多反转不罚');
    assert.ok(zh.includes('clamp(0, 100)'), '应含 clamp');
    assert.ok(zh.includes('count 为 0 只走 no_twist 分支'), '应含 count=0 独占分支');
  });

  test('成稿自查 — 五条可执行口径齐备', () => {
    assert.ok(zh.includes('单集至少 3 个反转'), '应含密度自查');
    assert.ok(zh.includes('至少混用 2 种反转类型'), '应含多样性自查');
    assert.ok(zh.includes('开头或中段必须埋 1 个反转'), '应含分布自查');
    assert.ok(zh.includes('弱反转占比压到 50% 以下'), '应含弱反转自查');
    assert.ok(zh.includes('后 30% 留一个强度 ≥ 80 的高潮反转'), '应含高潮自查');
  });
});

// ========== 英文层断言 ==========
describe('en — buildTwistDensityDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部类型名与 severity', () => {
    for (const t of ['identity', 'alignment', 'status', 'moral', 'relationship', 'information', 'fate', 'minor', 'no_twist', 'twist_insufficient', 'twist_thin', 'twist_monotone', 'twist_backloaded', 'twist_weak_heavy', 'no_climax_twist']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('seven issue types'), '应含七类问题');
    assert.ok(en.includes('90'), '应含 90 强度');
    assert.ok(en.includes('85'), '应含 85 强度');
    assert.ok(en.includes('35'), '应含 35 强度');
    assert.ok(en.includes('60 points'), '应含扣 60');
    assert.ok(en.includes('30 points'), '应含扣 30');
    assert.ok(en.includes('15 points'), '应含扣 15');
    assert.ok(en.includes('10 points'), '应含扣 10');
    assert.ok(en.includes('5 points'), '应含扣 5');
    assert.ok(en.includes('0.33'), '应含三段阈值');
    assert.ok(en.includes('0.67'), '应含三段阈值');
    assert.ok(en.includes('0.7'), '应含高潮位置');
    assert.ok(en.includes('50%'), '应含弱反转阈值');
    assert.ok(en.includes('clamp(0, 100'), '应含 clamp');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildTwistDensityDirective('AIGC', 'en'), en);
    assert.equal(mod.buildTwistDensityDirective(undefined, 'en'), en);
  });
});
