'use strict';
// v2.425 reaction-cliche 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行并按句切分 / 连缀 ≥2 / 词表 / 全片复用 ≥3 / 超量 ×3 扣分 /
// 每条 12 分封底 25 / 单次豁免 / 全片口径 / 邻居三重分界 / reactionHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/reaction-cliche.js');

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

const zh = mod.buildReactionClicheDirective('LIVE', 'zh');
const en = mod.buildReactionClicheDirective('LIVE', 'en');

describe('zh — buildReactionClicheDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildReactionClicheDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('面部反应公式'), '标题应点明面部反应公式');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildReactionClicheDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildReactionClicheDirective(undefined, 'zh'), zh);
  });

  test('检测范围与句切分 — 场头/台词跳过', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词跳过');
    assert.ok(line.includes('句切分'), '应说明按句切分');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
  });

  test('A·反应连缀 — 同句 ≥2 个不同反应词', () => {
    const line = lineOf(zh, 'A·反应连缀');
    assert.ok(line.includes('≥2'), '应给出连缀阈值');
    assert.ok(line.includes('chain'), '应给出 kind 名');
    assert.ok(line.includes('单个反应词不判'), '应说明单次不判');
    assert.ok(line.includes('emotion-craft'), '应点明正向证据归属');
  });

  test('A·标配反应词表 — 瞳孔一缩/咬唇/脸色一沉/脸色标签', () => {
    const line = lineOf(zh, 'A·标配反应词表');
    assert.ok(line.includes('瞳孔一缩'), '应列出瞳孔一缩');
    assert.ok(line.includes('咬唇'), '应列出咬唇');
    assert.ok(line.includes('脸色一沉'), '应列出脸色一沉');
    assert.ok(line.includes('脸色标签'), '应列出脸色标签');
  });

  test('B·万能复用 — 全片 ≥3 次且 line 记 0', () => {
    const line = lineOf(zh, 'B·万能复用');
    assert.ok(line.includes('≥3'), '应给出复用阈值');
    assert.ok(line.includes('line 记为 0'), '应说明 repeat 行号');
    assert.ok(line.includes('恰好 2 次不罚'), '应说明 2 次豁免');
  });

  test('B·复用扣分 — (出现次数 - 2) × 3', () => {
    const line = lineOf(zh, 'B·复用扣分');
    assert.ok(line.includes('overusedTokens'), '应点明复用语料字段');
    assert.ok(line.includes('（出现次数 - 2）× 3'), '应给出超量公式');
    assert.ok(line.includes('每条 12 分'), '应说明与连缀叠加');
  });

  test('得分公式 — max(25, 100 - chain × 12 - 复用罚分)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(25, 100 - chain 条数 × 12 - 复用超量罚分)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('命中字段 — line / kind / tokens / snippet / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('tokens'), '应列出 tokens');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — crowd-reaction / hollow-action / emotion-craft', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('crowd-reaction'), '应点明群体反应归属');
    assert.ok(line.includes('hollow-action'), '应点明身体调度归属');
    assert.ok(line.includes('emotion-craft'), '应点明单个外化归属');
  });

  test('改写方向 — 一个生理瞬间 + 动作决定', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('一个最贴此人物的生理瞬间'), '应给保留原则');
    assert.ok(line.includes('动作决定'), '应说明接动作');
    assert.ok(line.includes('把什么藏起来'), '应给具体动作示例');
  });

  test('人物专属身体 — 不同人物不同身体语言', () => {
    const line = lineOf(zh, '人物专属身体');
    assert.ok(line.includes('老江湖'), '应给人物类型示例');
    assert.ok(line.includes('上位者'), '应给人物类型示例');
    assert.ok(line.includes('有人动脸、有人动手'), '应说明身体分工');
  });

  test('单次豁免 — 只出现 1 次不记', () => {
    const line = lineOf(zh, '单次豁免');
    assert.ok(line.includes('只出现 1 次'), '应说明单次');
    assert.ok(line.includes('正当外化'), '应说明豁免依据');
    assert.ok(line.includes('不记 chain 也不记 repeat'), '应说明两类都不记');
  });

  test('全片口径 — 跨场景累计', () => {
    const line = lineOf(zh, '全片口径');
    assert.ok(line.includes('全片统计'), '应说明统计范围');
    assert.ok(line.includes('跨场景累计'), '应说明跨场景累计');
  });

  test('pipeline 消费 reactionHint + deai 加权退役', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('reactionHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('0.01'), '应点明加权退役');
  });

  test('成稿自查 — 换成另一个人还成立吗', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('换成另一个人还成立吗'), '应给自查问题');
    assert.ok(line.includes('只有他会做的那一个动作'), '应给替代方向');
  });
});

describe('en — buildReactionClicheDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('reactionCliche'), '应点明同名检测器');
    assert.ok(en.includes('12 points per chain'), '应说明每条连缀 12 分');
    assert.ok(en.includes('3 per overused occurrence'), '应说明超量每条 3 分');
  });

  test('得分公式 — max(25, 100 - chains x 12 - repeat penalty)', () => {
    assert.ok(en.includes('max(25, 100 - chains x 12 - repeat penalty)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与判定 — 连缀 ≥2 / 复用 ≥3 / 邻居分界', () => {
    assert.ok(en.includes('two or more different stock reaction tokens'), '应给连缀阈值');
    assert.ok(en.includes('three or more times'), '应给复用阈值');
    assert.ok(en.includes('crowd-reaction'), '应点明群体反应归属');
    assert.ok(en.includes('hollow-action'), '应点明身体调度归属');
    assert.ok(en.includes('emotion-craft'), '应点明单个外化归属');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('reactionHint'), '应点明提示名');
    assert.equal(mod.buildReactionClicheDirective('AIGC', 'en'), en);
    assert.equal(mod.buildReactionClicheDirective(undefined, 'en'), en);
  });
});
