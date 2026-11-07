'use strict';
// v2.424 effort-gloss 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行并按句切分 / 同句共现 前10字·后26字·英文100字符 /
// 努力词表 / 结果词表 / 一行最多一处 / 裸结果豁免 / 邻居分界 / 倒装允许 / 11 分封底 25

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/effort-gloss.js');

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

const zh = mod.buildEffortGlossDirective('LIVE', 'zh');
const en = mod.buildEffortGlossDirective('LIVE', 'en');

describe('zh — buildEffortGlossDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildEffortGlossDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('努力概述'), '标题应点明努力概述');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildEffortGlossDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildEffortGlossDirective(undefined, 'zh'), zh);
  });

  test('检测范围与句切分 — 场头/台词跳过，按句判定', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词跳过');
    assert.ok(line.includes('句切分'), '应说明按句切分');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
  });

  test('判定口径 — 前 10 字 / 后 26 字 / 英文 100 字符，跨句不算', () => {
    const line = lineOf(zh, '判定口径');
    assert.ok(line.includes('前 10 字'), '应给出前窗口');
    assert.ok(line.includes('后 26 字'), '应给出后窗口');
    assert.ok(line.includes('100 字符'), '应给出英文字符窗口');
    assert.ok(line.includes('跨句不算'), '应说明跨句不判');
  });

  test('努力词表 — 几经周折/好说歹说/软磨硬泡/三寸不烂之舌', () => {
    const line = lineOf(zh, '努力词表');
    assert.ok(line.includes('几经周折'), '应列出几经周折');
    assert.ok(line.includes('好说歹说'), '应列出好说歹说');
    assert.ok(line.includes('软磨硬泡'), '应列出软磨硬泡');
    assert.ok(line.includes('三寸不烂之舌'), '应列出三寸不烂之舌');
  });

  test('结果词表 — 签下/说服/夺回/原谅', () => {
    const line = lineOf(zh, '结果词表');
    assert.ok(line.includes('签下'), '应列出签下');
    assert.ok(line.includes('说服'), '应列出说服');
    assert.ok(line.includes('夺回'), '应列出夺回');
    assert.ok(line.includes('原谅'), '应列出原谅');
  });

  test('一行最多记一处 — 多句命中只取第一处', () => {
    const line = lineOf(zh, '一行最多记一处');
    assert.ok(line.includes('只取第一处'), '应说明取首处');
    assert.ok(line.includes('避免重复扣分'), '应说明防重复扣分');
  });

  test('裸结果豁免 — 无努力词不判', () => {
    const line = lineOf(zh, '裸结果豁免');
    assert.ok(line.includes('她签下了合同'), '应给裸结果示例');
    assert.ok(line.includes('没有努力词'), '应说明豁免条件');
    assert.ok(line.includes('不判'), '应说明不记命中');
  });

  test('邻居分界 — show-dont-tell / timeline-consistency / scene-padding', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('show-dont-tell'), '应点明裸过程短语归属');
    assert.ok(line.includes('timeline-consistency'), '应点明裸时间跳归属');
    assert.ok(line.includes('scene-padding'), '应点明整场空转归属');
  });

  test('倒装允许 — 结果词可在努力词之前', () => {
    const line = lineOf(zh, '倒装允许');
    assert.ok(line.includes('他答应了——好说歹说才有用'), '应给倒装示例');
    assert.ok(line.includes('同一句窗口'), '应说明仍按同句判定');
  });

  test('命中字段 — line / phrase / result / snippet / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('phrase'), '应列出 phrase');
    assert.ok(line.includes('result'), '应列出 result');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('得分公式 — max(25, 100 - 命中条数 × 11)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(25, 100 - 命中条数 × 11)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 挑阻力最大的交锋正面拍', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('把笔放下'), '应给具体动作示例');
    assert.ok(line.includes('把合同推回来'), '应给具体动作示例');
    assert.ok(line.includes('门在面前关上'), '应给具体动作示例');
  });

  test('pipeline 消费 glossHint + deai 0.01 权重', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('glossHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('0.01'), '应点明 deai 权重');
  });

  test('成稿自查 — 观众看过最难的交锋吗', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('最难的交锋'), '应给自查问题');
    assert.ok(line.includes('删结果、补过程'), '应给替代方向');
  });

  test('中英一致 — 英文努力词表覆盖', () => {
    const line = lineOf(zh, '中英一致');
    assert.ok(line.includes('after much effort'), '应列出 after much effort');
    assert.ok(line.includes('managed to convince'), '应列出 managed to convince');
    assert.ok(line.includes('after much persuasion'), '应列出 after much persuasion');
  });
});

describe('en — buildEffortGlossDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('effortGloss'), '应点明同名检测器');
    assert.ok(en.includes('11 points per hit'), '应说明每条 11 分');
  });

  test('得分公式 — max(25, 100 - hits x 11)', () => {
    assert.ok(en.includes('max(25, 100 - hits x 11)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与判定 — 同句共现 / 100 字符 / 豁免与分界', () => {
    assert.ok(en.includes('inside the same sentence'), '应说明同句共现');
    assert.ok(en.includes('100 characters'), '应给英文字符窗口');
    assert.ok(en.includes('Bare-result exemption'), '应说明裸结果豁免');
    assert.ok(en.includes('show-dont-tell'), '应点明裸过程短语归属');
    assert.ok(en.includes('timeline-consistency'), '应点明裸时间跳归属');
    assert.ok(en.includes('scene-padding'), '应点明整场空转归属');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('glossHint'), '应点明提示名');
    assert.equal(mod.buildEffortGlossDirective('AIGC', 'en'), en);
    assert.equal(mod.buildEffortGlossDirective(undefined, 'en'), en);
  });
});
