'use strict';
// v2.421 crowd-reaction 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 群体主语+反应同行共现 / 成语独立成句 / rescue 2 行窗口 /
// 每条未挽救 12 分封底 25 / 与 payoff-taxonomy·hollow-action 分工 / format 权重 0.05

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/crowd-reaction.js');

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

const zh = mod.buildCrowdReactionDirective('LIVE', 'zh');
const en = mod.buildCrowdReactionDirective('LIVE', 'en');

describe('zh — buildCrowdReactionDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildCrowdReactionDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('群体反应'), '标题应点明群体反应');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildCrowdReactionDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildCrowdReactionDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫叙述/动作行，场头与台词跳过', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('叙述'), '应说明只扫叙述行');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
  });

  test('口径一 — 群体主语 + 群体反应同行共现，字距阈值', () => {
    const line = lineOf(zh, '口径一');
    assert.ok(line.includes('群体主语'), '应说明群体主语');
    assert.ok(line.includes('群体反应'), '应说明群体反应');
    assert.ok(line.includes('≤14 字'), '应给出中文字距阈值');
    assert.ok(line.includes('≤60 字符'), '应给出英文字符阈值');
  });

  test('群体主语词表 — 众人/全场/所有人/大家', () => {
    const line = lineOf(zh, '群体主语词表');
    assert.ok(line.includes('众人'), '应列出众人');
    assert.ok(line.includes('全场'), '应列出全场');
    assert.ok(line.includes('所有人'), '应列出所有人');
    assert.ok(line.includes('大家'), '应列出大家');
  });

  test('群体反应词表 — 哗然/愣住/议论纷纷/鸦雀无声', () => {
    const line = lineOf(zh, '群体反应词表');
    assert.ok(line.includes('哗然'), '应列出哗然');
    assert.ok(line.includes('愣住'), '应列出愣住');
    assert.ok(line.includes('议论纷纷'), '应列出议论纷纷');
    assert.ok(line.includes('鸦雀无声'), '应列出鸦雀无声');
  });

  test('口径二 — 成语独立成句也记一条', () => {
    const line = lineOf(zh, '口径二');
    assert.ok(line.includes('成语'), '应说明成语口径');
    assert.ok(line.includes('无需群体主语'), '应说明无需群体主语');
    assert.ok(line.includes('面面相觑'), '应列出成语示例');
  });

  test('rescue 豁免 — 命中后 2 行内落到具体个体不扣分', () => {
    const line = lineOf(zh, 'rescue 豁免');
    assert.ok(line.includes('2 行内'), '应说明 2 行窗口');
    assert.ok(line.includes('不跨场'), '应说明不跨场');
    assert.ok(line.includes('不扣分'), '应说明不扣分');
  });

  test('rescue 动作词表 — 攥/握/后退/撞翻', () => {
    const line = lineOf(zh, 'rescue 动作词表');
    assert.ok(line.includes('攥'), '应列出攥');
    assert.ok(line.includes('后退'), '应列出后退');
    assert.ok(line.includes('撞翻'), '应列出撞翻');
  });

  test('命中字段 — line / crowd / reaction / snippet / rescued', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('crowd'), '应列出 crowd');
    assert.ok(line.includes('reaction'), '应列出 reaction');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('rescued'), '应列出 rescued');
  });

  test('得分公式 — max(25, 100 - 未挽救命中数 × 12)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(25, 100 - 未挽救命中数 × 12)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 挑一个人给他具体生理动作', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('最该有反应'), '应给出挑选原则');
    assert.ok(line.includes('攥皱请帖'), '应给具体动作示例');
  });

  test('与 payoff-taxonomy 分界 — 它只认 7 个爽点短语，本引擎扫全场景且认 rescue', () => {
    const line = lineOf(zh, '与 payoff-taxonomy 分界');
    assert.ok(line.includes('7 个固定短语'), '应说明它的范围');
    assert.ok(line.includes('所有场景'), '应说明本引擎范围');
    assert.ok(line.includes('rescue'), '应说明本引擎认挽救');
  });

  test('与 hollow-action 分界 — 它管个体无功能动作，本引擎管没有个体', () => {
    const line = lineOf(zh, '与 hollow-action 分界');
    assert.ok(line.includes('无功能动作'), '应说明它管什么');
    assert.ok(line.includes('根本没有个体'), '应说明本引擎管什么');
  });

  test('pipeline 消费 crowdHint + 评分权重 0.05', () => {
    const p = lineOf(zh, 'pipeline 消费');
    assert.ok(p.includes('prePolish'), '应点明 prePolish');
    assert.ok(p.includes('crowdHint'), '应点明提示名');
    assert.ok(p.includes('deai'), '应点明 deai 复扫');
    const w = lineOf(zh, '评分权重');
    assert.ok(w.includes('0.05'), '应给出 format 权重');
  });

  test('成稿自查 — 导演能拍谁的脸', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('拍谁的脸'), '应给可拍性自查');
  });
});

describe('en — buildCrowdReactionDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('crowdReaction'), '应点明同名检测器');
    assert.ok(en.includes('12 points per un-rescued hit'), '应说明每条 12 分');
  });

  test('得分公式 — max(25, 100 - un-rescued hits x 12)', () => {
    assert.ok(en.includes('max(25, 100 - un-rescued hits x 12)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与豁免 — crowd subject / reaction / rescue / 邻居分界', () => {
    assert.ok(en.includes('crowd subject'), '应说明群体主语');
    assert.ok(en.includes('crowd reaction'), '应说明群体反应');
    assert.ok(en.includes('within 14 characters'), '应给中文字距阈值');
    assert.ok(en.includes('60 characters in English'), '应给英文字符阈值');
    assert.ok(en.includes('Rescue exemption'), '应说明 rescue 豁免');
    assert.ok(en.includes('2 lines'), '应说明 2 行窗口');
    assert.ok(en.includes('collective gasp'), '应列出成语示例');
    assert.ok(en.includes('payoff-taxonomy'), '应点明邻居分界');
    assert.ok(en.includes('hollow-action'), '应点明邻居分界');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('crowdHint'), '应点明提示名');
    assert.ok(en.includes('0.05 weight'), '应点明 format 权重');
    assert.equal(mod.buildCrowdReactionDirective('AIGC', 'en'), en);
    assert.equal(mod.buildCrowdReactionDirective(undefined, 'en'), en);
  });
});
