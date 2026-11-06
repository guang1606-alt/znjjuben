'use strict';
// v2.416 emotion-label-dialogue 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫台词行 / 中文 ≤16 字·英文 ≤11 词 / 一二人称报情绪名 /
// 因果事实豁免 / 每条 10 分封底 20 / 与 show-dont-tell·dialogue-ai-taste 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/emotion-label-dialogue.js');

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

const zh = mod.buildEmotionLabelDialogueDirective('LIVE', 'zh');
const en = mod.buildEmotionLabelDialogueDirective('LIVE', 'en');

describe('zh — buildEmotionLabelDialogueDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildEmotionLabelDialogueDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('情绪点名'), '标题应点明情绪点名');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildEmotionLabelDialogueDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildEmotionLabelDialogueDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫台词行，场头与动作行不参与', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('台词行'), '应说明只扫台词行');
    assert.ok(line.includes('1-12 字'), '应说明说话人长度');
    assert.ok(line.includes('场头'), '应说明场头跳过');
  });

  test('长度门槛 — 短台词才判，中文 ≤16 字 / 英文 ≤11 词', () => {
    const line = lineOf(zh, '长度门槛');
    assert.ok(line.includes('≤16 字'), '应说明中文门槛');
    assert.ok(line.includes('≤11 词'), '应说明英文门槛');
    assert.ok(line.includes('长句'), '应说明长句不判');
  });

  test('第一人称词表 — 我 + 程度副词 + 情绪名', () => {
    const line = lineOf(zh, '第一人称');
    assert.ok(line.includes('我现在'), '应列出我现在');
    assert.ok(line.includes('真的'), '应列出真的');
    assert.ok(line.includes('难过'), '应列出难过');
  });

  test('第二人称指控 — 你让我 / 我对你', () => {
    const line = lineOf(zh, '第二人称');
    assert.ok(line.includes('你让我'), '应列出你让我');
    assert.ok(line.includes('我对你'), '应列出我对你');
    assert.ok(line.includes('失望'), '应列出失望');
  });

  test('因果豁免 — 带具体事实落点不判', () => {
    const line = lineOf(zh, '因果事实');
    assert.ok(line.includes('因为'), '应列出因为');
    assert.ok(line.includes('你瞒着'), '应列出你瞒着');
    assert.ok(line.includes('亲子鉴定'), '应列出亲子鉴定');
  });

  test('情绪词表 — 生气 / 心碎 / 心累', () => {
    const line = lineOf(zh, '情绪词表');
    assert.ok(line.includes('生气'), '应列出生气');
    assert.ok(line.includes('心碎'), '应列出心碎');
    assert.ok(line.includes('心累'), '应列出心累');
  });

  test('得分 — 每条 10 分，20 分封底', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中条数 × 10)'), '公式应与检测器一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('一行只记一次 — 多情绪词不重复扣', () => {
    const line = lineOf(zh, '一行只记一次');
    assert.ok(line.includes('首个'), '应说明按首个命中');
    assert.ok(line.includes('一次'), '应说明只扣一次');
  });

  test('诊断字段 — rate 命中条数 ÷ 台词行数，不扣分', () => {
    const line = lineOf(zh, '诊断字段');
    assert.ok(line.includes('rate'), '应列出 rate');
    assert.ok(line.includes('台词行数'), '应说明分母');
    assert.ok(line.includes('不参与扣分'), '应说明不扣分');
  });

  test('改写方向 — 压进具体指控 / 刻薄话 / 动作', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('具体指控'), '应给具体指控');
    assert.ok(line.includes('刻薄话'), '应给刻薄话');
    assert.ok(line.includes('动作'), '应说明用动作承载');
  });

  test('与 show-dont-tell 分界 — 它只管叙述行第三人称', () => {
    const line = lineOf(zh, 'show-dont-tell');
    assert.ok(line.includes('TELL_EMOTION'), '应点明 TELL_EMOTION');
    assert.ok(line.includes('叙述行'), '应说明只管叙述行');
    assert.ok(line.includes('第一/二人称'), '应说明本引擎管台词人称');
  });

  test('与 dialogue-ai-taste 分界 — 排比/金句/书面腔归它', () => {
    const line = lineOf(zh, 'dialogue-ai-taste');
    assert.ok(line.includes('排比'), '应点明排比');
    assert.ok(line.includes('金句'), '应点明金句');
  });

  test('pipeline 消费 — prePolish emoLabelHint + craft/deai 复扫', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('emoLabelHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
  });

  test('成稿自查 — 别写我很失望，写最扎人的那句事实', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('我很失望'), '应给反例');
    assert.ok(line.includes('最扎人的那句事实'), '应给正解');
  });
});

describe('en — buildEmotionLabelDialogueDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('emotionLabelDialogue'), '应点明同名检测器');
    assert.ok(en.includes('10 points'), '应说明每条 10 分');
  });

  test('得分公式 — max(20, 100 - hits x 10)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 10)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与豁免 — 16 字符 / 11 词 / 因果事实', () => {
    assert.ok(en.includes('16 characters'), '应说明中文等价门槛');
    assert.ok(en.includes('11 words'), '应说明英文门槛');
    assert.ok(en.includes('because'), '应列出因果豁免');
    assert.ok(en.includes('first-person'), '应说明第一人称');
    assert.ok(en.includes('second-person'), '应说明第二人称');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('emoLabelHint'), '应点明提示名');
    assert.equal(mod.buildEmotionLabelDialogueDirective('AIGC', 'en'), en);
    assert.equal(mod.buildEmotionLabelDialogueDirective(undefined, 'en'), en);
  });
});
