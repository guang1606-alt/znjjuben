'use strict';
// v2.414 exposition-dialogue 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫说话人：台词行 / 共知旧事框架+18或事实12 / 规矩宣讲+15 /
// 去标点计数（英文按词） / 每条 12 分封底 15 / dumpRate / 与 dialogue-water 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/exposition-dialogue.js');

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

const zh = mod.buildExpositionDialogueDirective('LIVE', 'zh');
const en = mod.buildExpositionDialogueDirective('LIVE', 'en');

describe('zh — buildExpositionDialogueDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildExpositionDialogueDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('保姆式对白'), '标题应点明保姆式对白');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildExpositionDialogueDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildExpositionDialogueDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 说话人 1-12 字 + 可选括号 + 冒号，场头不参与', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('1-12 字'), '应给说话人字限');
    assert.ok(line.includes('括号'), '应说明可带括号动作');
    assert.ok(line.includes('场头'), '应说明场头不参与');
  });

  test('共知旧事框架词表', () => {
    const line = lineOf(zh, '框架词：你还记得');
    assert.ok(line.includes('你还记得'), '应列出你还记得');
    assert.ok(line.includes('想当年'), '应列出想当年');
    assert.ok(line.includes('当年要不是'), '应列出当年要不是');
  });

  test('共知旧事阈值 — 长度 ≥18，或事实载荷 + ≥12', () => {
    const line = lineOf(zh, '触发阈值');
    assert.ok(line.includes('≥18 字'), '主阈值应为 18');
    assert.ok(line.includes('≥12 字'), '事实载荷阈值为 12');
    assert.ok(line.includes('硬事实'), '应说明事实载荷');
  });

  test('规矩宣讲框架词表', () => {
    const line = lineOf(zh, '家规');
    assert.ok(line.includes('祖训'), '应列出家规祖训');
    assert.ok(line.includes('行规是'), '应列出行规是');
  });

  test('规矩宣讲阈值 ≥15 字', () => {
    assert.ok(zh.includes('去标点后长度 ≥15 字'), '规矩宣讲阈值应为 15');
  });

  test('长度口径 — 中文去标点，英文按空格分词', () => {
    const line = lineOf(zh, '长度口径');
    assert.ok(line.includes('去标点'), '应说明去标点');
    assert.ok(line.includes('空格分词'), '应说明英文按词数');
    assert.ok(line.includes('16 / 10 / 12'), '应给出英文三档阈值');
  });

  test('同一条台词不重复扣 — 只按首个命中类型记一次', () => {
    assert.ok(zh.includes('不重复扣'), '两类框架同现不应重复计数');
  });

  test('得分公式 — max(15, 100 - 命中条数 × 12)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(15, 100 - 命中条数 × 12)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('dumpRate — 命中条数 ÷ 台词行数', () => {
    const line = lineOf(zh, 'dumpRate');
    assert.ok(line.includes('命中条数 ÷ 台词行数'), 'dumpRate 应为命中/台词行');
  });

  test('改写一 — 共知旧事只在当下冲突里漏一句', () => {
    const line = lineOf(zh, '改写方向一');
    assert.ok(line.includes('一次一个事实'), '应要求一次一个事实');
    assert.ok(line.includes('当下争吵'), '应在当下冲突里露出');
  });

  test('改写二 — 规矩让人物违反/利用/承受时演出来', () => {
    const line = lineOf(zh, '改写方向二');
    assert.ok(line.includes('违反'), '应要求违反规则');
    assert.ok(line.includes('不念条款'), '应禁止念条款');
  });

  test('与 dialogue-water 分界 — 短句水分 vs 成段载荷', () => {
    const line = lineOf(zh, '与 dialogue-water 分界');
    assert.ok(line.includes('短句水分'), '应点明 dialogue-water 管短句水分');
    assert.ok(line.includes('成段事实载荷'), '应点明本引擎管成段载荷');
  });

  test('pipeline 消费 expoHint', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('expoHint'), '应点明注入的提示名');
  });

  test('成稿自查 — 对方本来就知道吗 / 能否放进一次争执', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('对方本来就知道吗'), '应给出共知自查');
    assert.ok(line.includes('一次争执'), '应给出改写去处');
  });
});

describe('en — buildExpositionDialogueDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('两类框架齐全', () => {
    assert.ok(en.includes('shared_memory'), '应含 shared_memory');
    assert.ok(en.includes('rule_dump'), '应含 rule_dump');
  });

  test('英文阈值 — 16 / 10 / 12', () => {
    assert.ok(en.includes('16'), '应含 16');
    assert.ok(en.includes('10 words'), '应含事实载荷 10 词');
    assert.ok(en.includes('12 words'), '应含规矩 12 词');
  });

  test('得分 — max(15, 100 - hits x 12)', () => {
    assert.ok(en.includes('max(15, 100 - hits x 12)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('expoHint'), '应点明提示名');
    assert.equal(mod.buildExpositionDialogueDirective('AIGC', 'en'), en);
    assert.equal(mod.buildExpositionDialogueDirective(undefined, 'en'), en);
  });
});
