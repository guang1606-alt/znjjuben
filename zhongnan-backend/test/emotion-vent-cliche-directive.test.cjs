'use strict';
// v2.433 emotion-vent-cliche 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 四族 / A 复用第 3 次起罚 / B 多族连用 /
// rescue 后 2 行且他人心软不算 / 只算 bad / 0-1-≥2 计分 / 邻居三分界 / ventHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/emotion-vent-cliche.js');

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

const zh = mod.buildEmotionVentDirective ? mod.buildEmotionVentDirective('LIVE', 'zh') : '';
const en = mod.buildEmotionVentDirective ? mod.buildEmotionVentDirective('LIVE', 'en') : '';

describe('zh — buildEmotionVentDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildEmotionVentDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('情绪宣泄套路'), '标题应点明情绪宣泄套路');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildEmotionVentDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildEmotionVentDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫叙述行，台词/话者前缀/引号/场头跳过', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('只扫叙述行'), '应说明只扫叙述行');
    assert.ok(line.includes('台词行'), '应说明台词跳过');
    assert.ok(line.includes('话者前缀'), '应说明话者前缀跳过');
    assert.ok(line.includes('引号起句'), '应说明引号起句跳过');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('narrationLines'), '应说明叙述行计数');
  });

  test('四族表 — cry / shout / kneel / selfharm', () => {
    const line = lineOf(zh, '四族表');
    assert.ok(line.includes('cry'), '应列出 cry');
    assert.ok(line.includes('shout'), '应列出 shout');
    assert.ok(line.includes('kneel'), '应列出 kneel');
    assert.ok(line.includes('selfharm'), '应列出 selfharm');
    assert.ok(line.includes('痛哭'), '应给出痛哭语义');
    assert.ok(line.includes('嘶吼'), '应给出嘶吼语义');
    assert.ok(line.includes('跪求'), '应给出跪求语义');
    assert.ok(line.includes('自虐'), '应给出自虐语义');
  });

  test('A 复用判定 — 前两次不罚，第 3 次起 charged', () => {
    const line = lineOf(zh, 'A 复用判定');
    assert.ok(line.includes('第 1、2 次不罚'), '应说明前两次豁免');
    assert.ok(line.includes('第 3 次起'), '应说明第三次起计分');
    assert.ok(line.includes('charged'), '应说明 charged 标记');
  });

  test('B 连用判定 — 同一行 ≥2 个不同族单次即 charged', () => {
    const line = lineOf(zh, 'B 连用判定');
    assert.ok(line.includes('同一行'), '应说明同一行');
    assert.ok(line.includes('≥2 个不同族'), '应说明多族连用');
    assert.ok(line.includes('单次即 charged'), '应说明单次即计分');
  });

  test('rescue 两段 — 本句或后 2 行、换场前、人物自己做出决定', () => {
    const pass = lineOf(zh, 'rescue 通道');
    assert.ok(pass.includes('本句'), '应说明本句通道');
    assert.ok(pass.includes('后 2 个非空行'), '应说明回看距离');
    assert.ok(pass.includes('换场前'), '应说明换场边界');
    assert.ok(pass.includes('人物自己'), '应说明主动决定');
    assert.ok(pass.includes('rescued'), '应说明 rescued 标记');
    const words = lineOf(zh, 'rescue 词表');
    assert.ok(words.includes('擦掉泪拿起电话'), '应列出擦泪接电话');
    assert.ok(words.includes('签字'), '应列出签字');
    assert.ok(words.includes('报警'), '应列出报警');
    assert.ok(words.includes('甩出证据'), '应列出甩出证据');
    assert.ok(words.includes('起身离开'), '应列出起身离开');
    assert.ok(words.includes('再不求他'), '应列出再不求他');
  });

  test('他人心软不算 — 递纸巾/被哄好/哭闹换让步不是 rescue', () => {
    const line = lineOf(zh, '他人心软不算');
    assert.ok(line.includes('递纸巾'), '应点明递纸巾');
    assert.ok(line.includes('被哄好'), '应点明被哄好');
    assert.ok(line.includes('哭闹换来的让步'), '应点明哭闹换让步');
    assert.ok(line.includes('更糟'), '应说明这是更糟的写法');
  });

  test('只算 bad — bad = charged 且未 rescued', () => {
    const line = lineOf(zh, '只算 bad');
    assert.ok(line.includes('charged'), '应说明 charged');
    assert.ok(line.includes('rescued'), '应说明 rescued');
    assert.ok(line.includes('bad'), '应说明 bad 口径');
    assert.ok(line.includes('不扣分'), '应说明未 charged 不扣分');
  });

  test('得分 — 0 次 100 / 1 次 75 / ≥2 次 max(25, 100 - n × 25)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 75'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 25)'), '应给多次公式');
  });

  test('命中与统计字段 — kind / families / snippet / charged / rescueLine / familyCounts', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('repeat'), '应说明 repeat');
    assert.ok(line.includes('chain'), '应说明 chain');
    assert.ok(line.includes('families'), '应列出 families');
    assert.ok(line.includes('phrase'), '应列出 phrase');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('30 字'), '应说明截断长度');
    assert.ok(line.includes('charged'), '应列出 charged');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
    assert.ok(line.includes('reason'), '应列出 reason');
    const stat = lineOf(zh, '统计字段');
    assert.ok(stat.includes('narrationLines'), '应列出 narrationLines');
    assert.ok(stat.includes('familyCounts'), '应列出 familyCounts');
  });

  test('邻居三分界 — reaction-cliche / emotion-prop-crutch / show-dont-tell', () => {
    const micro = lineOf(zh, 'reaction-cliche');
    assert.ok(micro.includes('微反应'), '应点明微反应归属');
    assert.ok(micro.includes('爆发档'), '应点明爆发档归属');
    const prop = lineOf(zh, 'emotion-prop-crutch');
    assert.ok(prop.includes('摔杯'), '应点明道具宣泄归属');
    assert.ok(prop.includes('无道具'), '应点明无道具边界');
    const label = lineOf(zh, 'show-dont-tell');
    assert.ok(label.includes('标签'), '应点明情绪标签归属');
    assert.ok(label.includes('最大档'), '应点明音量档边界');
  });

  test('客观生理不判 — 打哈欠/疼得龇牙/喜极而泣不判', () => {
    const line = lineOf(zh, '客观生理不判');
    assert.ok(line.includes('打哈欠'), '应点明打哈欠');
    assert.ok(line.includes('疼得龇牙'), '应点明疼得龇牙');
    assert.ok(line.includes('喜极而泣'), '应点明喜极而泣');
    assert.ok(line.includes('不判'), '应说明不判');
  });

  test('改写方向 — 每集一次最高档且必须换来不可逆动作', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('每集只准用一次'), '应给限量口径');
    assert.ok(line.includes('不可逆'), '应给不可逆动作');
    assert.ok(line.includes('安静'), '应给安静写法方向');
  });

  test('pipeline 消费 ventHint + 成稿自查', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('ventHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('不计加权') || line.includes('未进 deai 加权表'), '应点明仅诊断');
    const check = lineOf(zh, '成稿自查');
    assert.ok(check.includes('第三次'), '应给自查次数');
    assert.ok(check.includes('选择'), '应给自查标准');
    assert.ok(check.includes('降下来'), '应给替换方向');
  });

  test('中英一致 — 四族 / 两次豁免 / 后 2 行 / 30 字 / charged 口径', () => {
    const line = lineOf(zh, '中英一致');
    assert.ok(line.includes('四族'), '应给族数口径');
    assert.ok(line.includes('两次豁免'), '应给豁免口径');
    assert.ok(line.includes('后 2 行'), '应给 rescue 距离');
    assert.ok(line.includes('30 字'), '应给截断口径');
    assert.ok(line.includes('charged'), '应给计分口径');
  });
});

describe('en — buildEmotionVentDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('四族词表与计分口径', () => {
    assert.ok(en.includes('emotionVentCliche'), '应点明同名检测器');
    assert.ok(en.includes('bursting into tears'), '应列出痛哭');
    assert.ok(en.includes('shrieking'), '应列出尖叫');
    assert.ok(en.includes('kowtowing'), '应列出磕头');
    assert.ok(en.includes('biting her lip'), '应列出咬唇自虐');
    assert.ok(en.includes('1 = 75'), '应给单次口径');
    assert.ok(en.includes('max(25, 100 - n x 25)'), '应给多次公式');
  });

  test('复用与连用 — Repeat rule / Chain rule', () => {
    const repeat = lineOf(en, 'Repeat rule');
    assert.ok(repeat.includes('first two uses'), '应说明前两次豁免');
    assert.ok(repeat.includes('third use'), '应说明第三次起计分');
    assert.ok(repeat.includes('charged'), '应说明 charged');
    const chain = lineOf(en, 'Chain rule');
    assert.ok(chain.includes('two or more different families'), '应说明多族连用');
    assert.ok(chain.includes('first occurrence'), '应说明单次即计分');
  });

  test('rescue / 他人心软不算 / bad 口径', () => {
    const rescue = lineOf(en, 'Rescue:');
    assert.ok(rescue.includes('next 2 non-empty lines'), '应说明回看距离');
    assert.ok(rescue.includes('before the next scene'), '应说明换场边界');
    assert.ok(rescue.includes('rescued'), '应说明 rescued');
    const soft = lineOf(en, 'Someone else softening');
    assert.ok(soft.includes('not rescue'), '应说明他人心软不算');
    assert.ok(soft.includes('tissue'), '应点明递纸巾');
    const bad = lineOf(en, 'Bad only');
    assert.ok(bad.includes('bad = charged and not rescued'), '应给出 bad 口径');
    assert.ok(bad.includes('still returned'), '应说明命中可追溯');
  });

  test('邻居 + pipeline 消费 + format 不门控', () => {
    assert.ok(lineOf(en, 'reaction-cliche').includes('micro facial parts'), '应点明微反应归属');
    assert.ok(lineOf(en, 'emotion-prop-crutch').includes('body venting'), '应点明无道具边界');
    assert.ok(lineOf(en, 'show-dont-tell').includes('volume knob'), '应点明音量档边界');
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('ventHint'), '应点明提示名');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('craft re-eval'), '应点明 craft 复评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildEmotionVentDirective('AIGC', 'en'), en);
    assert.equal(mod.buildEmotionVentDirective(undefined, 'en'), en);
  });
});
