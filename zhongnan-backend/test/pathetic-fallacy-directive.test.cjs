'use strict';
// v2.422 pathetic-fallacy 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 感知豁免最优先 / 天意代言 / 拟人框架 12 字·24 字符 /
// 直接拟人 12 字·50 字符 / 每条 11 分封底 25 / 与 scene-padding 分工 / fallacyHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/pathetic-fallacy.js');

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

const zh = mod.buildPatheticFallacyDirective('LIVE', 'zh');
const en = mod.buildPatheticFallacyDirective('LIVE', 'en');

describe('zh — buildPatheticFallacyDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildPatheticFallacyDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('环境替演'), '标题应点明环境替演');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildPatheticFallacyDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildPatheticFallacyDirective(undefined, 'zh'), zh);
  });

  test('检测范围与判定顺序 — 只扫叙述行，感知豁免优先且一行最多一条', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词跳过');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
    const order = lineOf(zh, '判定顺序');
    assert.ok(order.includes('感知豁免'), '应说明豁免优先');
    assert.ok(order.includes('天意代言'), '应说明天意顺序');
    assert.ok(order.includes('每行最多记一条'), '应说明单行只记一条');
  });

  test('A·拟人框架 — 12 字 / 英文 24 字符', () => {
    const line = lineOf(zh, 'A·拟人框架');
    assert.ok(line.includes('仿佛'), '应列出框架词');
    assert.ok(line.includes('12 字内'), '应给出中文字距');
    assert.ok(line.includes('24 字符'), '应给出英文字符距');
    assert.ok(line.includes('frame'), '应给出 kind 名');
  });

  test('A·情绪动作词表 — 哭泣/怒吼/怜悯/低语', () => {
    const line = lineOf(zh, 'A·情绪动作词表');
    assert.ok(line.includes('哭泣'), '应列出哭泣');
    assert.ok(line.includes('怒吼'), '应列出怒吼');
    assert.ok(line.includes('怜悯'), '应列出怜悯');
    assert.ok(line.includes('低语'), '应列出低语');
  });

  test('B·直接拟人 — 起点相距 ≤12 字 / 英文 ≤50 字符', () => {
    const line = lineOf(zh, 'B·直接拟人');
    assert.ok(line.includes('无生命主语'), '应说明无生命主语');
    assert.ok(line.includes('≤12 字'), '应给出中文字距');
    assert.ok(line.includes('≤50 字符'), '应给出英文字符距');
    assert.ok(line.includes('direct'), '应给出 kind 名');
  });

  test('B·无生命主语词表 — 雨/风/月光/城市', () => {
    const line = lineOf(zh, 'B·无生命主语词表');
    assert.ok(line.includes('暴雨'), '应列出暴雨');
    assert.ok(line.includes('狂风'), '应列出狂风');
    assert.ok(line.includes('月光'), '应列出月光');
    assert.ok(line.includes('城市'), '应列出城市');
  });

  test('B·情绪动词词表 — 客观搭配不报', () => {
    const line = lineOf(zh, 'B·情绪动词词表');
    assert.ok(line.includes('哀鸣'), '应列出哀鸣');
    assert.ok(line.includes('同情地'), '应列出同情地');
    assert.ok(line.includes('客观物象搭配不报'), '应说明客观搭配豁免');
    assert.ok(line.includes('雷声滚滚'), '应给出客观示例');
  });

  test('C·天意代言 — 8 字窗口与 could not bear to watch', () => {
    const line = lineOf(zh, 'C·天意代言');
    assert.ok(line.includes('老天爷'), '应列出老天爷');
    assert.ok(line.includes('8 字内'), '应给出中文窗口');
    assert.ok(line.includes('could not bear to watch'), '应给出英文示例');
    assert.ok(line.includes('heaven'), '应给出 kind 名');
  });

  test('感知豁免 — 有感知主体即角色视角', () => {
    const line = lineOf(zh, '感知豁免：句子含感知主体');
    assert.ok(line.includes('觉得'), '应列出觉得');
    assert.ok(line.includes('听起来'), '应列出听起来');
    assert.ok(line.includes('角色视角'), '应说明豁免依据');
    assert.ok(line.includes('could hear'), '应给出英文示例');
  });

  test('命中字段 — line / kind / subject / emotion / snippet', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('subject'), '应列出 subject');
    assert.ok(line.includes('emotion'), '应列出 emotion');
    assert.ok(line.includes('snippet'), '应列出 snippet');
  });

  test('得分公式 — max(25, 100 - 命中条数 × 11)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(25, 100 - 命中条数 × 11)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 环境压力替代拟人', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('伞骨被吹折'), '应给具体环境压力示例');
    assert.ok(line.includes('雷声盖住'), '应给声效压力示例');
    assert.ok(line.includes('交给人的动作'), '应指明情绪去处');
  });

  test('与 scene-padding 分界 — 它管结构空转，本引擎管修辞越权', () => {
    const line = lineOf(zh, '与 scene-padding 分界');
    assert.ok(line.includes('结构空转'), '应说明它管什么');
    assert.ok(line.includes('修辞越权'), '应说明本引擎管什么');
    assert.ok(line.includes('保留环境压力'), '应说明改写保留什么');
  });

  test('pipeline 消费 fallacyHint + 三处复扫', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('fallacyHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
  });

  test('成稿自查 — 人在演还是天在演', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('人在演还是天在演'), '应给可拍性自查');
  });
});

describe('en — buildPatheticFallacyDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('patheticFallacy'), '应点明同名检测器');
    assert.ok(en.includes('11 points per hit'), '应说明每条 11 分');
  });

  test('得分公式 — max(25, 100 - hits x 11)', () => {
    assert.ok(en.includes('max(25, 100 - hits x 11)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与判定 — 三类 kind / 感知豁免 / 间距阈值', () => {
    assert.ok(en.includes('kind frame'), '应点明 frame');
    assert.ok(en.includes('kind direct'), '应点明 direct');
    assert.ok(en.includes('kind heaven'), '应点明 heaven');
    assert.ok(en.includes('within 24 characters'), '应给拟人框架窗口');
    assert.ok(en.includes('within 50 characters'), '应给直接拟人阈值');
    assert.ok(en.includes('Perception exemption'), '应说明感知豁免');
    assert.ok(en.includes('scene-padding'), '应点明邻居分界');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('fallacyHint'), '应点明提示名');
    assert.equal(mod.buildPatheticFallacyDirective('AIGC', 'en'), en);
    assert.equal(mod.buildPatheticFallacyDirective(undefined, 'en'), en);
  });
});
