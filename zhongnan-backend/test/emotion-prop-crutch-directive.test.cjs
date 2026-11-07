'use strict';
// v2.432 emotion-prop-crutch 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 五族道具 / A 复用第 3 次起罚 / B 多族连用 /
// rescue 后 2 行 / 只算 charged / 0-1-≥2 计分 / 邻居三分界 / crutchHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/emotion-prop-crutch.js');

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

const zh = mod.buildEmotionPropCrutchDirective ? mod.buildEmotionPropCrutchDirective('LIVE', 'zh') : '';
const en = mod.buildEmotionPropCrutchDirective ? mod.buildEmotionPropCrutchDirective('LIVE', 'en') : '';

describe('zh — buildEmotionPropCrutchDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildEmotionPropCrutchDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('情绪道具拐杖'), '标题应点明情绪道具拐杖');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildEmotionPropCrutchDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildEmotionPropCrutchDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫叙述行，台词/引号起句/场头跳过', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('只扫叙述行'), '应说明只扫叙述行');
    assert.ok(line.includes('台词'), '应说明台词跳过');
    assert.ok(line.includes('引号起句'), '应说明引号起句跳过');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('narrationLines'), '应说明叙述行计数');
  });

  test('道具五族 — smash / drink / rain / tear / grip', () => {
    const line = lineOf(zh, '道具五族');
    assert.ok(line.includes('smash'), '应列出 smash');
    assert.ok(line.includes('drink'), '应列出 drink');
    assert.ok(line.includes('rain'), '应列出 rain');
    assert.ok(line.includes('tear'), '应列出 tear');
    assert.ok(line.includes('grip'), '应列出 grip');
    assert.ok(line.includes('摔砸'), '应给出摔砸语义');
    assert.ok(line.includes('买醉抽烟'), '应给出买醉抽烟语义');
    assert.ok(line.includes('淋雨自虐'), '应给出淋雨自虐语义');
    assert.ok(line.includes('捏碎掐掌'), '应给出捏碎掐掌语义');
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

  test('rescue 两段 — 本句或后 2 行、换场前、具体决定或后果', () => {
    const pass = lineOf(zh, 'rescue 通道');
    assert.ok(pass.includes('本句'), '应说明本句通道');
    assert.ok(pass.includes('后 2 个非空行'), '应说明回看距离');
    assert.ok(pass.includes('换场前'), '应说明换场边界');
    assert.ok(pass.includes('rescued'), '应说明 rescued 标记');
    assert.ok(pass.includes('不扣分'), '应说明不扣分');
    const words = lineOf(zh, 'rescue 词表');
    assert.ok(words.includes('宣布'), '应列出宣布');
    assert.ok(words.includes('报警'), '应列出报警');
    assert.ok(words.includes('叫律师'), '应列出叫律师');
    assert.ok(words.includes('签字'), '应列出签字');
    assert.ok(words.includes('甩出证据'), '应列出甩出证据');
    assert.ok(words.includes('U盘'), '应列出 U盘');
    assert.ok(words.includes('扔还'), '应列出扔还');
    assert.ok(words.includes('再没回头'), '应列出再没回头');
  });

  test('只算 charged — bad = charged 且未 rescued', () => {
    const line = lineOf(zh, '只算 charged');
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

  test('邻居三分界 — reaction-cliche / hollow-action / pathetic-fallacy', () => {
    const face = lineOf(zh, 'reaction-cliche');
    assert.ok(face.includes('面部零件'), '应点明面部零件归属');
    const act = lineOf(zh, 'hollow-action');
    assert.ok(act.includes('单次摔'), '应点明单次摔砸豁免');
    assert.ok(act.includes('同族复用 ≥3 次'), '应点明复用门槛');
    const rain = lineOf(zh, 'pathetic-fallacy');
    assert.ok(rain.includes('拟人'), '应点明拟人归属');
    assert.ok(rain.includes('客观下雨不判'), '应点明客观下雨不判');
  });

  test('单次豁免 — 前两次 / 单次摔砸 / 客观下雨不判', () => {
    const line = lineOf(zh, '单次豁免');
    assert.ok(line.includes('前两次'), '应说明前两次');
    assert.ok(line.includes('单次摔砸'), '应说明单次摔砸');
    assert.ok(line.includes('客观下雨'), '应说明客观下雨');
    assert.ok(line.includes('不做什么'), '应给弱者反应方向');
  });

  test('改写方向 — 让道具动作改变局势或换人物独有反应', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('改变局势'), '应给改局势方向');
    assert.ok(line.includes('甩出证据'), '应给证据方向');
    assert.ok(line.includes('摔还'), '应给戒指摔还方向');
    assert.ok(line.includes('独有'), '应给独有反应方向');
  });

  test('pipeline 消费 crutchHint + craft/deai 复扫 + 仅诊断不计加权', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('crutchHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('不计加权') || line.includes('未进 deai 加权表'), '应点明仅诊断');
  });

  test('成稿自查 — 第三次摔同一个杯子时局势是否更不可逆', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('第三次'), '应给自查次数');
    assert.ok(line.includes('不可逆'), '应给自查标准');
    assert.ok(line.includes('换动作'), '应给替换方向');
  });

  test('中英一致 — 五族 / 两次豁免 / 后 2 行 / 30 字 / charged 口径', () => {
    const line = lineOf(zh, '中英一致');
    assert.ok(line.includes('五族'), '应给族数口径');
    assert.ok(line.includes('两次豁免'), '应给豁免口径');
    assert.ok(line.includes('后 2 行'), '应给 rescue 距离');
    assert.ok(line.includes('30 字'), '应给截断口径');
    assert.ok(line.includes('charged'), '应给计分口径');
  });
});

describe('en — buildEmotionPropCrutchDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('五族词表与计分口径', () => {
    assert.ok(en.includes('emotionPropCrutch'), '应点明同名检测器');
    assert.ok(en.includes('smash'), '应列出 smash');
    assert.ok(en.includes('chain-smoking'), '应列出 chain-smoking');
    assert.ok(en.includes('pouring rain'), '应列出淋雨');
    assert.ok(en.includes('tearing photos'), '应列出撕照片');
    assert.ok(en.includes('white knuckles'), '应列出指节发白');
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

  test('rescue 与 charged 口径', () => {
    const rescue = lineOf(en, 'Rescue:');
    assert.ok(rescue.includes('next 2 non-empty lines'), '应说明回看距离');
    assert.ok(rescue.includes('before the next scene'), '应说明换场边界');
    assert.ok(rescue.includes('rescued'), '应说明 rescued');
    const charged = lineOf(en, 'Charged only');
    assert.ok(charged.includes('bad = charged and not rescued'), '应给出 bad 口径');
    assert.ok(charged.includes('still returned'), '应说明命中可追溯');
  });

  test('邻居 + pipeline 消费 + format 不门控', () => {
    assert.ok(lineOf(en, 'reaction-cliche').includes('facial parts'), '应点明面部零件归属');
    assert.ok(lineOf(en, 'hollow-action').includes('single smash'), '应点明单次摔砸豁免');
    assert.ok(lineOf(en, 'pathetic-fallacy').includes('objective rainfall'), '应点明客观下雨不判');
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('crutchHint'), '应点明提示名');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('craft re-eval'), '应点明 craft 复评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildEmotionPropCrutchDirective('AIGC', 'en'), en);
    assert.equal(mod.buildEmotionPropCrutchDirective(undefined, 'en'), en);
  });
});
