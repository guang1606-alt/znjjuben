'use strict';
// v2.409 scene-emotion-flat 教学函数同源对齐测试
// 锚点紧贴引擎源码：场景切分 / 只扫对白 / ≥3 句门槛 / 正负中三价 / 0.8 单极 / 60+20 扣分

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/scene-emotion-flat.js');

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

const zh = mod.buildSceneEmotionFlatDirective('LIVE', 'zh');
const en = mod.buildSceneEmotionFlatDirective('LIVE', 'en');

describe('zh — buildSceneEmotionFlatDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildSceneEmotionFlatDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('场景情绪平'), '标题应点明场景情绪平');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildSceneEmotionFlatDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSceneEmotionFlatDirective(undefined, 'zh'), zh);
  });

  test('场景切分口径 — 按场头切、首个场头前算「(开场)」、无场头整篇 1 场', () => {
    const s = lineOf(zh, '场景切分：');
    assert.ok(s, '应有场景切分口径');
    assert.ok(s.includes('场头'), '按场头切分');
    assert.ok(s.includes('(开场)'), '首个场头前算 (开场)');
    assert.ok(s.includes('无场头'), '无场头情形');
    assert.ok(s.includes('1 场'), '整篇算 1 场');
  });

  test('检测范围 — 只扫对白行，动作行与空白行不计', () => {
    const s = lineOf(zh, '检测范围：');
    assert.ok(s, '应有检测范围');
    assert.ok(s.includes('对白行'), '只扫对白行');
    assert.ok(s.includes('1-12 字说话人'), '对白行识别口径');
    assert.ok(s.includes('动作行'), '动作行不计');
    assert.ok(s.includes('空白行'), '空白行不计');
  });

  test('判定门槛 — 单场 ≥3 句才判，不足直接跳过', () => {
    const s = lineOf(zh, '判定门槛：');
    assert.ok(s, '应有判定门槛');
    assert.ok(s.includes('≥3 句'), '≥3 句门槛');
    assert.ok(s.includes('跳过'), '不足 3 句跳过');
    assert.ok(s.includes('不算平'), '跳过不算平');
  });

  test('情绪三价 — 先负后正，负价优先', () => {
    const s = lineOf(zh, '情绪三价：');
    assert.ok(s, '应有三价口径');
    assert.ok(s.includes('先判负价'), '先判负价');
    assert.ok(s.includes('再判正价'), '再判正价');
    assert.ok(s.includes('中性'), '剩下算中性');
    assert.ok(s.includes('负价优先'), '负价优先');
  });

  test('正价词 zh 17 个', () => {
    const s = lineOf(zh, '正价词（zh 17）');
    assert.ok(s, '应有正价词表');
    assert.ok(s.includes('zh 17'), '正价词 zh 17 个');
  });

  test('正价词表关键例词 — 开心 / 温暖 / 满足', () => {
    const s = lineOf(zh, '正价词');
    assert.ok(s.includes('开心'), '含开心');
    assert.ok(s.includes('温暖'), '含温暖');
    assert.ok(s.includes('满足'), '含满足');
  });

  test('负价词 zh 17 个', () => {
    const s = lineOf(zh, '负价词（zh 17）');
    assert.ok(s, '应有负价词表');
    assert.ok(s.includes('zh 17'), '负价词 zh 17 个');
  });

  test('负价词表关键例词 — 愤怒 / 绝望 / 惨', () => {
    const s = lineOf(zh, '负价词');
    assert.ok(s.includes('愤怒'), '含愤怒');
    assert.ok(s.includes('绝望'), '含绝望');
    assert.ok(s.includes('惨'), '含惨');
  });

  test('平场第一类 all-neutral — 全场零情绪词，nonNeu = 0', () => {
    const s = lineOf(zh, '平场两类：');
    assert.ok(s, '应有平场两类说明');
    assert.ok(s.includes('all-neutral'), '含 all-neutral');
    assert.ok(s.includes('nonNeu = 0'), '全中性 nonNeu = 0');
    assert.ok(s.includes('零情绪词'), '零情绪词');
  });

  test('平场第二类 single-valence — 同价占比 ≥ 0.8，max(pos, neg) / nonNeu', () => {
    const s = lineOf(zh, '平场两类：');
    assert.ok(s.includes('single-valence'), '含 single-valence');
    assert.ok(s.includes('≥ 0.8'), '阈值 0.8');
    assert.ok(s.includes('max(pos, neg) / nonNeu'), '单极比值公式');
  });

  test('得分公式 — max(0, round(100 - flatRatio × 60 - allNeutralRatio × 20))', () => {
    const s = lineOf(zh, '得分公式：');
    assert.ok(s, '应有得分公式');
    assert.ok(s.includes('max(0'), '含 max(0');
    assert.ok(s.includes('round(100'), 'round(100');
    assert.ok(s.includes('flatRatio × 60'), '平场占比 × 60');
    assert.ok(s.includes('allNeutralRatio × 20'), '全中性占比 × 20');
  });

  test('口径说明 — 两个占比分母均为总场数，总场数为 0 按 1 计，空稿满分 100', () => {
    const s = lineOf(zh, '口径说明：');
    assert.ok(s, '应有口径说明');
    assert.ok(s.includes('flatRatio = 平场数 ÷ 总场数'), 'flatRatio 定义');
    assert.ok(s.includes('allNeutralRatio = 全中性场数 ÷ 总场数'), 'allNeutralRatio 定义');
    assert.ok(s.includes('总场数为 0 时按 1 计'), '总场数 0 按 1');
    assert.ok(s.includes('空稿满分 100'), '空稿满分 100');
  });

  test('改写方向 — 全中性场加具体情绪反应/正负对撞，单极场加反向情绪', () => {
    const s = lineOf(zh, '改写方向：');
    assert.ok(s, '应有改写方向');
    assert.ok(s.includes('全中性场'), '全中性场处理');
    assert.ok(s.includes('正负情绪对撞'), '正负对撞');
    assert.ok(s.includes('单极场'), '单极场处理');
    assert.ok(s.includes('反向情绪'), '反向情绪');
  });

  test('pipeline 消费 — prePolish 注入修复提示，dialogue 维度 0.0549 权重', () => {
    const s = lineOf(zh, 'pipeline 消费：');
    assert.ok(s, '应有 pipeline 消费说明');
    assert.ok(s.includes('prePolish'), '含 prePolish');
    assert.ok(s.includes('定向修复提示'), '定向修复提示');
    assert.ok(s.includes('dialogue 维度'), 'dialogue 维度');
    assert.ok(s.includes('0.0549'), '权重 0.0549');
  });

  test('成稿自查 — ≥3 句 / 全无情绪词 / 一边倒 ≥80%', () => {
    const s = lineOf(zh, '成稿自查：');
    assert.ok(s, '应有成稿自查');
    assert.ok(s.includes('≥3 句'), '查 ≥3 句');
    assert.ok(s.includes('全无情绪词'), '查全无情绪词');
    assert.ok(s.includes('≥80%'), '查一边倒 80%');
  });
});

describe('en — buildSceneEmotionFlatDirective', () => {
  test('en 层非空 + 零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.ok(!cjk, 'en 层应零中文 CJK');
  });

  test('en 词表计数 — en 13 正价 / en 14 负价 + 关键例词', () => {
    assert.ok(en.includes('Positive words (en 13)'), '正价词 en 13');
    assert.ok(en.includes('Negative words (en 14)'), '负价词 en 14');
    assert.ok(en.includes('happy'), '正价例词 happy');
    assert.ok(en.includes('despair'), '负价例词 despair');
  });

  test('en 门槛与两类平场 — at least 3 dialogue lines / all-neutral / single-valence / 0.8', () => {
    assert.ok(en.includes('at least 3 dialogue lines'), '≥3 句门槛');
    assert.ok(en.includes('all-neutral'), '含 all-neutral');
    assert.ok(en.includes('single-valence'), '含 single-valence');
    assert.ok(en.includes('0.8'), '阈值 0.8');
  });

  test('en 得分公式 — max(0, round(100 - flatRatio x 60 - allNeutralRatio x 20))', () => {
    assert.ok(en.includes('flatRatio x 60'), '平场占比 × 60');
    assert.ok(en.includes('allNeutralRatio x 20'), '全中性占比 × 20');
    assert.ok(en.includes('empty draft = 100'), '空稿满分 100');
  });

  test('en pipeline 消费 0.0549 + format 不门控', () => {
    assert.ok(en.includes('0.0549'), '权重 0.0549');
    assert.equal(mod.buildSceneEmotionFlatDirective('AIGC', 'en'), en);
    assert.equal(mod.buildSceneEmotionFlatDirective(undefined, 'en'), en);
  });
});
