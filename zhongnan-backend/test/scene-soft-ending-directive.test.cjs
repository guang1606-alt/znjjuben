'use strict';
// v2.415 scene-soft-ending 教学函数同源对齐测试
// 锚点紧贴引擎源码：只查非末场内场 / 单场 <3 行跳过 / 需先有高能 / 末拍非台词 /
// 软词表 / 强能量与钩子豁免 / 每条 9 分封底 20 / 与 scene-padding·cliffhanger·hollow-action 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/scene-soft-ending.js');

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

const zh = mod.buildSceneSoftEndingDirective('LIVE', 'zh');
const en = mod.buildSceneSoftEndingDirective('LIVE', 'en');

describe('zh — buildSceneSoftEndingDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildSceneSoftEndingDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('场景软收尾'), '标题应点明场景软收尾');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildSceneSoftEndingDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSceneSoftEndingDirective(undefined, 'zh'), zh);
  });

  test('检测对象 — 只查内场，末场归 cliffhanger，单场 <3 行跳过', () => {
    const line = lineOf(zh, '检测对象');
    assert.ok(line.includes('末场'), '应说明跳过末场');
    assert.ok(line.includes('<3'), '应说明单场少于 3 行跳过');
    assert.ok(line.includes('cliffhanger'), '应点明末场归 cliffhanger');
  });

  test('背景条件 — 场内有高能信号才谈泄气', () => {
    const line = lineOf(zh, '高能信号');
    assert.ok(line.includes('摔'), '应列出摔类高能词');
    assert.ok(line.includes('亲子鉴定'), '应列出物证类高能词');
    assert.ok(line.includes('没提过气'), '应说明无高能不判');
  });

  test('末拍口径 — 最后一个非空行，台词收尾不判', () => {
    const line = lineOf(zh, '末拍口径');
    assert.ok(line.includes('最后'), '应说明取最后一个非空行');
    assert.ok(line.includes('台词'), '应说明末拍是台词不判');
    assert.ok(line.includes('倒数第二行'), '应说明合并前一行判定');
  });

  test('软收尾词表 — 必须带沉默/转身/叹气质感', () => {
    const line = lineOf(zh, '软收尾词表');
    assert.ok(line.includes('叹气'), '应列出叹气');
    assert.ok(line.includes('背影消失'), '应列出背影消失');
    assert.ok(line.includes('裸「走」'), '应说明裸走不算');
  });

  test('豁免一 — 强能量动作不算泄气', () => {
    const line = lineOf(zh, '强能量动作');
    assert.ok(line.includes('摔门'), '应列出摔门');
    assert.ok(line.includes('拂袖'), '应列出拂袖');
  });

  test('豁免二 — 末拍带钩子/决定/新信息不判', () => {
    const line = lineOf(zh, '钩子');
    assert.ok(line.includes('问号'), '应说明问号算钩子');
    assert.ok(line.includes('最后通牒'), '应列出最后通牒');
  });

  test('得分 — 每条 9 分，20 分封底', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中场数 × 9)'), '公式应与检测器一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 硬切在物证/未答的问题/新威胁/半截动作', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('硬切'), '应给硬切方向');
    assert.ok(line.includes('物证'), '应点明落在物证');
  });

  test('与 scene-padding 分工 — 末段岁月静好归它', () => {
    const line = lineOf(zh, 'scene-padding');
    assert.ok(line.includes('draggyTail'), '应点明 draggyTail');
    assert.ok(line.includes('15%'), '应说明末段 15%');
  });

  test('与 cliffhanger 分工 — 只管全集最后一场', () => {
    const line = lineOf(zh, 'cliffhanger 只管');
    assert.ok(line.includes('最后一场'), '应说明 cliffhanger 管最后一场');
    assert.ok(line.includes('跳过末场'), '应说明本引擎跳过末场');
  });

  test('与 hollow-action 分界 — 它管场内密度，本引擎管末拍落点', () => {
    const line = lineOf(zh, 'hollow-action');
    assert.ok(line.includes('空心动作'), '应点明空心动作');
    assert.ok(line.includes('末拍落点'), '应说明本引擎只看末拍落点');
  });

  test('诊断字段 — sceneCount / checkedScenes 不扣分', () => {
    const line = lineOf(zh, '诊断字段');
    assert.ok(line.includes('sceneCount'), '应列出 sceneCount');
    assert.ok(line.includes('checkedScenes'), '应列出 checkedScenes');
    assert.ok(line.includes('不参与扣分'), '应说明不扣分');
  });

  test('pipeline 消费 — prePolish softEndHint + craft/deai 复扫', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('softEndHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
  });

  test('成稿自查 — 本场最后一个画面是什么', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('最后一个画面'), '应给自查问题');
    assert.ok(line.includes('叹息'), '应点明叹息式散场');
  });
});

describe('en — buildSceneSoftEndingDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('sceneSoftEnding'), '应点明同名检测器');
    assert.ok(en.includes('9 points'), '应说明每条 9 分');
  });

  test('得分公式 — max(20, 100 - hits x 9)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 9)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与豁免 — 非末场 + 3 行 + 高能 + 强能量/钩子', () => {
    assert.ok(en.includes('non-final scenes'), '应说明只查非末场');
    assert.ok(en.includes('3 lines'), '应说明单场 3 行门槛');
    assert.ok(en.includes('energy'), '应说明需先有高能');
    assert.ok(en.includes('strong-energy'), '应说明强能量豁免');
    assert.ok(en.includes('hook'), '应说明钩子豁免');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('softEndHint'), '应点明提示名');
    assert.equal(mod.buildSceneSoftEndingDirective('AIGC', 'en'), en);
    assert.equal(mod.buildSceneSoftEndingDirective(undefined, 'en'), en);
  });
});
