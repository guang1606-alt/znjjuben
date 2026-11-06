'use strict';
// v2.417 round-robin-dialogue 教学函数同源对齐测试
// 锚点紧贴引擎源码：单场 ≥5 句·≥3 说话人·轮转前缀 ≥4 / 句长极差 ≤8 字·≤4 词 /
// 零抢话才判 / 每条 14 分封底 20 / 与 dialogue-length-score·character-balance 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/round-robin-dialogue.js');

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

const zh = mod.buildRoundRobinDialogueDirective('LIVE', 'zh');
const en = mod.buildRoundRobinDialogueDirective('LIVE', 'en');

describe('zh — buildRoundRobinDialogueDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildRoundRobinDialogueDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('会议体轮转'), '标题应点明会议体轮转');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildRoundRobinDialogueDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildRoundRobinDialogueDirective(undefined, 'zh'), zh);
  });

  test('触发门槛 — 单场 ≥5 句、≥3 个说话人、轮转前缀 ≥4', () => {
    const line = lineOf(zh, '触发门槛');
    assert.ok(line.includes('≥5 句'), '应说明句数门槛');
    assert.ok(line.includes('≥3 个说话人'), '应说明说话人门槛');
    assert.ok(line.includes('≥4'), '应说明轮转前缀门槛');
  });

  test('轮转定义 — 相邻不重复，一轮说满回头才算续', () => {
    const line = lineOf(zh, '轮转定义');
    assert.ok(line.includes('相邻不重复'), '应说明相邻不重复');
    assert.ok(line.includes('一轮说满'), '应说明一轮说满');
    assert.ok(line.includes('第三人'), '应说明第三人未开口就回头算破');
  });

  test('句长整齐 — 极差 ≤8 字 / ≤4 词', () => {
    const line = lineOf(zh, '句长整齐');
    assert.ok(line.includes('≤8 字'), '应说明中文极差');
    assert.ok(line.includes('≤4 词'), '应说明英文极差');
    assert.ok(line.includes('极差'), '应说明极差口径');
  });

  test('抢话豁免 — 场内出现打断/异口同声就不判', () => {
    const line = lineOf(zh, '抢话豁免');
    assert.ok(line.includes('打断'), '应列出打断');
    assert.ok(line.includes('异口同声'), '应列出异口同声');
    assert.ok(line.includes('零抢话'), '应说明零抢话才是病象');
  });

  test('证据字段 — sceneHeader / turnCount / evidence', () => {
    const line = lineOf(zh, '证据字段');
    assert.ok(line.includes('sceneHeader'), '应列出 sceneHeader');
    assert.ok(line.includes('turnCount'), '应列出 turnCount');
    assert.ok(line.includes('evidence'), '应列出 evidence');
  });

  test('得分 — 每条 14 分，20 分封底', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中场数 × 14)'), '公式应与检测器一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('诊断字段 — sceneCount 不参与扣分', () => {
    const line = lineOf(zh, '诊断字段');
    assert.ok(line.includes('sceneCount'), '应列出 sceneCount');
    assert.ok(line.includes('不参与扣分'), '应说明不扣分');
  });

  test('改写方向 — 压场 / 抢话 / 半句', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('压场'), '应给压场方向');
    assert.ok(line.includes('抢话'), '应给抢话方向');
    assert.ok(line.includes('半句'), '应给半句方向');
  });

  test('与 dialogue-length-score 分界 — 它管全片长短节奏', () => {
    const line = lineOf(zh, 'dialogue-length-score');
    assert.ok(line.includes('长短节奏'), '应点明长短节奏');
    assert.ok(line.includes('多人轮转'), '应说明本引擎管轮转');
  });

  test('与 character-balance 分界 — 它管戏份占比', () => {
    const line = lineOf(zh, 'character-balance');
    assert.ok(line.includes('戏份占比'), '应点明戏份占比');
    assert.ok(line.includes('读稿感'), '应说明本引擎管读稿感');
  });

  test('pipeline 消费 — prePolish roundRobinHint + craft/deai 复扫', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('roundRobinHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
  });

  test('成稿自查 — 群戏不是圆桌会议', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('圆桌会议'), '应给反例');
    assert.ok(line.includes('谁最强势'), '应给自查问题');
  });

  test('短场跳过 — <5 句或 <3 个说话人不判', () => {
    const line = lineOf(zh, '短场跳过');
    assert.ok(line.includes('<5'), '应说明台词句数门槛');
    assert.ok(line.includes('<3'), '应说明说话人门槛');
    assert.ok(line.includes('空稿'), '应说明空稿');
  });

  test('场景切分 — 按场头切场，(开场) 独立判定', () => {
    const line = lineOf(zh, '场景切分');
    assert.ok(line.includes('场头'), '应说明按场头切场');
    assert.ok(line.includes('(开场)'), '应说明开场段命名');
    assert.ok(line.includes('按场计'), '应说明命中按场计');
  });
});

describe('en — buildRoundRobinDialogueDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('roundRobinDialogue'), '应点明同名检测器');
    assert.ok(en.includes('14 points'), '应说明每条 14 分');
  });

  test('得分公式 — max(20, 100 - hits x 14)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 14)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与阈值 — 5 turns / 3 speakers / rotation / 8 characters / 4 words', () => {
    assert.ok(en.includes('at least 5 turns'), '应说明句数门槛');
    assert.ok(en.includes('3 speakers'), '应说明说话人门槛');
    assert.ok(en.includes('strict rotation'), '应说明严格轮转');
    assert.ok(en.includes('8 characters'), '应说明中文极差');
    assert.ok(en.includes('4 words'), '应说明英文极差');
    assert.ok(en.includes('cross-talk'), '应说明抢话豁免');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('roundRobinHint'), '应点明提示名');
    assert.equal(mod.buildRoundRobinDialogueDirective('AIGC', 'en'), en);
    assert.equal(mod.buildRoundRobinDialogueDirective(undefined, 'en'), en);
  });
});
