'use strict';
// v2.426 atmosphere-tell 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 主体+结论 12 字 / 时间停摆 / 情绪弥漫 /
// rescue 同行或 2 行内豁免 / 未挽救每条 12 分封底 25 / 一句一判 / 邻居三重分界 / atmosphereHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/atmosphere-tell.js');

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

const zh = mod.buildAtmosphereTellDirective('LIVE', 'zh');
const en = mod.buildAtmosphereTellDirective('LIVE', 'en');

describe('zh — buildAtmosphereTellDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildAtmosphereTellDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('气氛直述'), '标题应点明气氛直述');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildAtmosphereTellDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildAtmosphereTellDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 场头/台词跳过，其余计入 narrationLines', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('叙述/动作行'), '应说明扫描范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词跳过');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
  });

  test('A·主体+结论 — 气氛主体后 12 字内出现情绪结论', () => {
    const line = lineOf(zh, 'A·主体+结论');
    assert.ok(line.includes('气氛/氛围/空气/场面'), '应列出气氛主体');
    assert.ok(line.includes('12 字内'), '应给出共现窗口');
    assert.ok(line.includes('情绪结论'), '应点明结论词');
  });

  test('A·情绪结论词表 — 尴尬/剑拔弩张/凝固', () => {
    const line = lineOf(zh, 'A·情绪结论词表');
    assert.ok(line.includes('尴尬'), '应列出尴尬');
    assert.ok(line.includes('剑拔弩张'), '应列出剑拔弩张');
    assert.ok(line.includes('凝固'), '应列出凝固');
    assert.ok(line.includes('僵住'), '应列出僵住');
  });

  test('B·时间停摆 — 时间/空气 + 仿佛 + 静止', () => {
    const line = lineOf(zh, 'B·时间停摆');
    assert.ok(line.includes('时间/空气'), '应列出时间主体');
    assert.ok(line.includes('仿佛'), '应列出副词');
    assert.ok(line.includes('静止'), '应列出停摆词');
    assert.ok(line.includes('凝滞'), '应列出凝滞');
  });

  test('C·情绪弥漫 — 沉默/尴尬 + 在… + 蔓延/弥漫', () => {
    const line = lineOf(zh, 'C·情绪弥漫');
    assert.ok(line.includes('沉默'), '应列出沉默');
    assert.ok(line.includes('恐慌'), '应列出恐慌');
    assert.ok(line.includes('蔓延'), '应列出蔓延');
    assert.ok(line.includes('弥散'), '应列出弥散');
  });

  test('rescue 豁免 — 同行逗号后或 2 行内具体动作/开口', () => {
    const line = lineOf(zh, 'rescue 豁免');
    assert.ok(line.includes('同行'), '应说明同行判定');
    assert.ok(line.includes('2 行内'), '应说明邻域范围');
    assert.ok(line.includes('不跨场'), '应说明换场清空');
    assert.ok(line.includes('rescued'), '应说明豁免标记');
  });

  test('rescue 动作词表 — 端起/清了清嗓子/叹气', () => {
    const line = lineOf(zh, 'rescue 动作词表');
    assert.ok(line.includes('端起'), '应列出端起');
    assert.ok(line.includes('清了清嗓子'), '应列出清了清嗓子');
    assert.ok(line.includes('叹气'), '应列出叹气');
    assert.ok(line.includes('放下'), '应列出放下');
  });

  test('得分 — max(25, 100 - 未挽救命中数 × 12)，空稿 100', () => {
    const line = lineOf(zh, '得分：score');
    assert.ok(line.includes('max(25, 100 - 未挽救命中数 × 12)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
    assert.ok(line.includes('换场清空 rescue 邻域'), '应说明换场清空');
  });

  test('命中字段 — line / subject / mood / snippet / rescued / rescueLine / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('subject'), '应列出 subject');
    assert.ok(line.includes('mood'), '应列出 mood');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — pathetic-fallacy / crowd-reaction / show-dont-tell', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('pathetic-fallacy'), '应点明天气景物归属');
    assert.ok(line.includes('crowd-reaction'), '应点明群体静默归属');
    assert.ok(line.includes('show-dont-tell'), '应点明人物情绪直述归属');
  });

  test('改写方向 — 删结论 + 最不自在那个人的具体动作', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('删掉结论'), '应给保留原则');
    assert.ok(line.includes('最不自在'), '应给人物选取');
    assert.ok(line.includes('端起茶杯又放下'), '应给具体动作示例');
  });

  test('一句一判 与 中英同口径', () => {
    const one = lineOf(zh, '一句一判');
    assert.ok(one.includes('多个气氛主体'), '应说明多主体合并');
    assert.ok(one.includes('只记一条'), '应说明不重复扣分');
    const parity = lineOf(zh, '中英一致');
    assert.ok(parity.includes('未挽救 ×12'), '应给扣分口径');
    assert.ok(parity.includes('rescue 2 行'), '应给邻域口径');
    assert.ok(parity.includes('40 字符'), '应给英文窗口');
  });

  test('pipeline 消费 atmosphereHint + craft/deai 复扫 + 0.01 退役', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('atmosphereHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('0.01'), '应点明加权退役');
  });

  test('成稿自查 — 导演能拍什么', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('导演能拍什么'), '应给自查问题');
    assert.ok(line.includes('换成某个人的一个小动作'), '应给替代方向');
  });
});

describe('en — buildAtmosphereTellDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('atmosphereTell'), '应点明同名检测器');
    assert.ok(en.includes('12 points per unrescued hit'), '应说明每条未挽救 12 分');
    assert.ok(en.includes('floor 25'), '应说明封底');
  });

  test('得分公式 — max(25, 100 - unrescued hits x 12)', () => {
    assert.ok(en.includes('max(25, 100 - unrescued hits x 12)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与判定 — 40 characters / rescued / 2 lines / 邻居分界', () => {
    assert.ok(en.includes('narration and action lines only'), '应说明扫描范围');
    assert.ok(en.includes('within 40 characters'), '应给英文共现窗口');
    assert.ok(en.includes('rescued'), '应点明豁免标记');
    assert.ok(en.includes('next 2 lines'), '应给邻域范围');
    assert.ok(en.includes('pathetic-fallacy'), '应点明天气景物归属');
    assert.ok(en.includes('crowd-reaction'), '应点明群体静默归属');
    assert.ok(en.includes('show-dont-tell'), '应点明人物情绪直述归属');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('atmosphereHint'), '应点明提示名');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildAtmosphereTellDirective('AIGC', 'en'), en);
    assert.equal(mod.buildAtmosphereTellDirective(undefined, 'en'), en);
  });
});
