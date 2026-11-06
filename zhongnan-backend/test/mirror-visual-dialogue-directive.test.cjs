'use strict';
// v2.419 mirror-visual-dialogue 教学函数同源对齐测试
// 锚点紧贴引擎源码：上一非空行基准 / 陈述句门槛 / 眼前框架 / 新信息·长台词豁免 /
// 共享 bigram≥3·实词≥2 且 40% / 每条 12 分封底 20 / 与 action-echo·echo·exposition 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/mirror-visual-dialogue.js');

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

const zh = mod.buildMirrorVisualDialogueDirective('LIVE', 'zh');
const en = mod.buildMirrorVisualDialogueDirective('LIVE', 'en');

describe('zh — buildMirrorVisualDialogueDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildMirrorVisualDialogueDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('台词复述画面'), '标题应点明台词复述画面');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildMirrorVisualDialogueDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildMirrorVisualDialogueDirective(undefined, 'zh'), zh);
  });

  test('比对基准 — 上一非空行，场头清空，带冒号才是台词', () => {
    const line = lineOf(zh, '比对基准');
    assert.ok(line.includes('上一非空行'), '应说明基准是上一非空行');
    assert.ok(line.includes('场头'), '应说明场头清空基准');
    assert.ok(line.includes('带冒号'), '应说明台词判定');
  });

  test('陈述句门槛 — 非问号结尾 / 非祈使 / 非情绪反应', () => {
    const line = lineOf(zh, '陈述句门槛');
    assert.ok(line.includes('问号'), '应说明非问句');
    assert.ok(line.includes('祈使'), '应说明非祈使');
    assert.ok(line.includes('情绪反应'), '应说明非情绪反应');
  });

  test('眼前框架 — 以这/那/桌上/窗外等开头', () => {
    const line = lineOf(zh, '眼前框架');
    assert.ok(line.includes('这'), '应列出这/那类指代');
    assert.ok(line.includes('桌上'), '应列出桌上');
    assert.ok(line.includes('窗外'), '应列出窗外');
  });

  test('新信息豁免 — 因果/时间/计划类词', () => {
    const line = lineOf(zh, '新信息豁免');
    assert.ok(line.includes('因为'), '应列出因为');
    assert.ok(line.includes('明天'), '应列出明天');
    assert.ok(line.includes('合同'), '应列出合同');
  });

  test('长台词豁免 — 中文 >20 字 / 英文 >14 词', () => {
    const line = lineOf(zh, '长台词豁免');
    assert.ok(line.includes('>20 字'), '应给中文长度阈值');
    assert.ok(line.includes('>14 词'), '应给英文长度阈值');
  });

  test('重合阈值 — 中文 bigram ≥3、英文实词 ≥2 且 40%', () => {
    const line = lineOf(zh, '重合阈值');
    assert.ok(line.includes('≥3 个'), '应给中文共享片段阈值');
    assert.ok(line.includes('≥2 个'), '应给英文共享实词阈值');
    assert.ok(line.includes('40%'), '应给英文占比阈值');
  });

  test('命中字段 — line / speaker / narration / dialogue / shared', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('speaker'), '应列出 speaker');
    assert.ok(line.includes('narration'), '应列出 narration');
    assert.ok(line.includes('dialogue'), '应列出 dialogue');
    assert.ok(line.includes('shared'), '应列出 shared');
  });

  test('得分公式 — max(20, 100 - 命中条数 × 12)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中条数 × 12)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('诊断字段 — dialogueLines 不参与扣分', () => {
    const line = lineOf(zh, '诊断字段');
    assert.ok(line.includes('dialogueLines'), '应列出 dialogueLines');
    assert.ok(line.includes('不参与扣分'), '应说明不扣分');
  });

  test('改写方向 — 删掉或换成立场/算计/旧账', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('删掉'), '应给删除策略');
    assert.ok(line.includes('立场'), '应给立场');
    assert.ok(line.includes('旧账'), '应给翻旧账');
  });

  test('与 action-echo-dialogue 分界 — 它管问句/确认句回声动作', () => {
    const line = lineOf(zh, 'action-echo-dialogue');
    assert.ok(line.includes('问句'), '应说明它管问句');
    assert.ok(line.includes('确认句'), '应说明它管确认句');
    assert.ok(line.includes('你居然打我'), '应说明它豁免反应句');
  });

  test('与 echo-dialogue 分界 — 叙述行复述台词，方向相反', () => {
    const line = lineOf(zh, '方向相反');
    assert.ok(line.includes('叙述行复述台词'), '应说明它管旁白复述台词');
    assert.ok(line.includes('本引擎只判台词复述画面'), '应说明本引擎方向');
  });

  test('与 exposition 分界 — 背景旧事 vs 此刻共见画面', () => {
    const line = lineOf(zh, '共知旧事');
    assert.ok(line.includes('背景旧事'), '应说明它管背景旧事');
    assert.ok(line.includes('共见的画面'), '应说明本引擎管此刻画面');
  });

  test('pipeline 消费 mirrorHint + 成稿自查删掉仍不少信息', () => {
    const p = lineOf(zh, 'pipeline 消费');
    assert.ok(p.includes('prePolish'), '应点明 prePolish');
    assert.ok(p.includes('mirrorHint'), '应点明提示名');
    assert.ok(p.includes('creative-batch-rescan'), '应点明批量复扫');
    const c = lineOf(zh, '成稿自查');
    assert.ok(c.includes('删掉'), '应给删除自查');
    assert.ok(c.includes('字幕不是台词'), '应点明字幕与台词之别');
  });
});

describe('en — buildMirrorVisualDialogueDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('mirrorVisualDialogue'), '应点明同名检测器');
    assert.ok(en.includes('12 points per hit'), '应说明每条 12 分');
  });

  test('得分公式 — max(20, 100 - hits x 12)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 12)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与阈值 — bigrams / content words / 40 percent / 20 characters / 14 words', () => {
    assert.ok(en.includes('3 shared character bigrams'), '应给中文共享片段阈值');
    assert.ok(en.includes('2 shared content words'), '应给英文共享实词阈值');
    assert.ok(en.includes('40 percent'), '应给英文占比阈值');
    assert.ok(en.includes('over 20 characters'), '应给中文长度阈值');
    assert.ok(en.includes('over 14 words'), '应给英文长度阈值');
    assert.ok(en.includes('question mark'), '应说明问句豁免');
    assert.ok(en.includes('imperative'), '应说明祈使豁免');
    assert.ok(en.includes('reaction frame'), '应说明情绪反应豁免');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('mirrorHint'), '应点明提示名');
    assert.equal(mod.buildMirrorVisualDialogueDirective('AIGC', 'en'), en);
    assert.equal(mod.buildMirrorVisualDialogueDirective(undefined, 'en'), en);
  });
});
