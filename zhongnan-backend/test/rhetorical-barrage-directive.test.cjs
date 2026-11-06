'use strict';
// v2.418 rhetorical-barrage 教学函数同源对齐测试
// 锚点紧贴引擎源码：单句 ≥3 问号 + 框架词 / 链式 ≥3 问句 + 夹 1 句短回应(≤8 字·≤5 词) + 上限 6 /
// 两口径独立 / 每条 12 分封底 20 / 与 dialogue-pingpong·self-pity-litany 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/rhetorical-barrage.js');

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

const zh = mod.buildRhetoricalBarrageDirective('LIVE', 'zh');
const en = mod.buildRhetoricalBarrageDirective('LIVE', 'en');

describe('zh — buildRhetoricalBarrageDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildRhetoricalBarrageDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('反问连珠'), '标题应点明反问连珠');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildRhetoricalBarrageDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildRhetoricalBarrageDirective(undefined, 'zh'), zh);
  });

  test('场景切分 — 按场头切场，(开场) 独立判定，命中按处计', () => {
    const line = lineOf(zh, '场景切分');
    assert.ok(line.includes('场头'), '应说明按场头切场');
    assert.ok(line.includes('(开场)'), '应说明开场段命名');
    assert.ok(line.includes('按处计'), '应说明命中按处计');
  });

  test('检测范围 — 说话人 1-12 字 + 可选括号 + 冒号，场头不参与', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('1-12 字'), '应给说话人字限');
    assert.ok(line.includes('括号'), '应说明可带括号动作');
    assert.ok(line.includes('场头'), '应说明场头不参与');
  });

  test('口径一 — 单句 ≥3 问号且含框架词', () => {
    const line = lineOf(zh, '口径一');
    assert.ok(line.includes('≥3 个问号'), '应给单句问号门槛');
    assert.ok(line.includes('框架词'), '应要求框架词');
    assert.ok(line.includes('记一条'), '应说明命中记一条');
  });

  test('口径二 — 同人 ≥3 问句，夹 1 句短回应，上限 6 句', () => {
    const line = lineOf(zh, '口径二');
    assert.ok(line.includes('≥3 句'), '应给链式句数门槛');
    assert.ok(line.includes('≤8 字'), '应给中文短回应阈值');
    assert.ok(line.includes('≤5 词'), '应给英文短回应阈值');
    assert.ok(line.includes('上限 6 句'), '应给链条上限');
  });

  test('框架词中文 — 凭什么 / 有什么资格 / 你管得着', () => {
    const line = lineOf(zh, '框架词（中文）');
    assert.ok(line.includes('凭什么'), '应列出凭什么');
    assert.ok(line.includes('有什么资格'), '应列出有什么资格');
    assert.ok(line.includes('你管得着'), '应列出你管得着');
  });

  test('框架词英文 — who do you think / how dare / since when', () => {
    const line = lineOf(zh, '框架词（英文）');
    assert.ok(line.includes('who do you think'), '应列出 who do you think');
    assert.ok(line.includes('how dare'), '应列出 how dare');
    assert.ok(line.includes('since when'), '应列出 since when');
  });

  test('两口径独立 — 互不排斥，可各记一条', () => {
    const line = lineOf(zh, '两口径独立');
    assert.ok(line.includes('互不排斥'), '应说明两口径独立');
    assert.ok(line.includes('各记一条'), '应说明可叠加计分');
  });

  test('短场跳过 — 无台词行不判，空稿 100', () => {
    const line = lineOf(zh, '短场跳过');
    assert.ok(line.includes('没有台词行'), '应说明无台词不判');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('命中字段 — sceneHeader / speaker / startLine / questionCount / evidence', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('sceneHeader'), '应列出 sceneHeader');
    assert.ok(line.includes('speaker'), '应列出 speaker');
    assert.ok(line.includes('startLine'), '应列出 startLine');
    assert.ok(line.includes('questionCount'), '应列出 questionCount');
    assert.ok(line.includes('evidence'), '应列出 evidence');
  });

  test('得分公式 — max(20, 100 - 命中处数 × 12)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中处数 × 12)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('诊断字段 — dialogueLines 不参与扣分', () => {
    const line = lineOf(zh, '诊断字段');
    assert.ok(line.includes('dialogueLines'), '应列出 dialogueLines');
    assert.ok(line.includes('不参与扣分'), '应说明不扣分');
  });

  test('改写方向 — 只留最狠一问，每问钉新事实', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('最狠的那一问'), '应给保留策略');
    assert.ok(line.includes('新事实'), '应要求事实增量');
    assert.ok(line.includes('删掉'), '应给删除策略');
  });

  test('两条分界 — dialogue-pingpong 管接球链、self-pity-litany 管向内自怜', () => {
    const p = lineOf(zh, 'dialogue-pingpong');
    assert.ok(p.includes('跨说话人'), '应说明它管跨说话人');
    assert.ok(p.includes('不接球'), '应说明反问算健康不接球');
    assert.ok(p.includes('同一人'), '应说明本引擎管同一人');
    const s = lineOf(zh, 'self-pity-litany');
    assert.ok(s.includes('自怜'), '应说明它管自怜');
    assert.ok(s.includes('向外攻击'), '应说明本引擎管向外攻击');
  });

  test('pipeline 消费 barrageHint + 成稿自查问号数', () => {
    const p = lineOf(zh, 'pipeline 消费');
    assert.ok(p.includes('prePolish'), '应点明 prePolish');
    assert.ok(p.includes('barrageHint'), '应点明提示名');
    assert.ok(p.includes('deai'), '应点明 deai 复扫');
    const c = lineOf(zh, '成稿自查');
    assert.ok(c.includes('几个问号'), '应给问号计数自查');
    assert.ok(c.includes('气势不是戏'), '应点明气势不是戏');
  });
});

describe('en — buildRhetoricalBarrageDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('rhetoricalBarrage'), '应点明同名检测器');
    assert.ok(en.includes('12 points per hit'), '应说明每条 12 分');
  });

  test('得分公式 — max(20, 100 - hits x 12)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 12)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与阈值 — 3 question marks / 8 characters / 5 words / capped at 6', () => {
    assert.ok(en.includes('3 or more question marks'), '应给单句问号门槛');
    assert.ok(en.includes('3 or more question-bearing lines'), '应给链式句数门槛');
    assert.ok(en.includes('8 characters or fewer'), '应给中文短回应阈值');
    assert.ok(en.includes('5 words or fewer'), '应给英文短回应阈值');
    assert.ok(en.includes('capped at 6 lines'), '应给链条上限');
    assert.ok(en.includes('frame phrase'), '应要求框架词');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('barrageHint'), '应点明提示名');
    assert.equal(mod.buildRhetoricalBarrageDirective('AIGC', 'en'), en);
    assert.equal(mod.buildRhetoricalBarrageDirective(undefined, 'en'), en);
  });
});
