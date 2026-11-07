'use strict';
// v2.434 action-echo-dialogue 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫台词行+紧邻叙述行 / 长台词豁免 / 三型 /
// 中文强宽家族+±10 cue / 假朋友 / 道具映射 / 全片第 2 次起 charged /
// rescue 双通道 / 0-1-≥2 计分 / 命中字段 / 邻居三分界 / 消费与自查

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/action-echo-dialogue.js');

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

const zh = mod.buildActionEchoDirective ? mod.buildActionEchoDirective('LIVE', 'zh') : '';
const en = mod.buildActionEchoDirective ? mod.buildActionEchoDirective('LIVE', 'en') : '';

describe('zh — buildActionEchoDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildActionEchoDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('动作回声'), '标题应点明动作回声');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致，中英同一套规则', () => {
    assert.equal(mod.buildActionEchoDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildActionEchoDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, '同一套家族');
    assert.ok(line.includes('同一套家族'), '应说明家族规则跨语言一致');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
  });

  test('检测范围与长台词豁免 — 只扫台词行、紧邻叙述行、换场清空；22 字 / 16 词放行', () => {
    const scope = lineOf(zh, '检测范围：只扫台词行');
    assert.ok(scope.includes('只扫台词行'), '应说明只扫台词行');
    assert.ok(scope.includes('话者 ≤4 字'), '应说明话者识别');
    assert.ok(scope.includes('紧跟在一条叙述行之后'), '应说明紧邻叙述行');
    assert.ok(scope.includes('换场'), '应说明换场');
    assert.ok(scope.includes('lastNarration'), '应说明换场清空字段');
    const long = lineOf(zh, '长台词豁免');
    assert.ok(long.includes('22 字'), '应给出中文阈值');
    assert.ok(long.includes('16 词'), '应给出英文阈值');
    assert.ok(long.includes('放行'), '应说明放行');
  });

  test('三型回声 — question / confirm / prop，前者需同族落地', () => {
    const line = lineOf(zh, '三型回声');
    assert.ok(line.includes('question'), '应列出 question');
    assert.ok(line.includes('confirm'), '应列出 confirm');
    assert.ok(line.includes('prop'), '应列出 prop');
    assert.ok(line.includes('首个句段含问号'), '应说明问号口径');
    assert.ok(line.includes('≤12 字'), '应说明确认句阈值');
    assert.ok(line.includes('同一个'), '应说明同族要求');
  });

  test('question 型 — 问号后接要价仍算，句首主语引导', () => {
    const line = lineOf(zh, 'question 型');
    assert.ok(line.includes('问号后接要价仍算回声问'), '应说明要价不豁免问号');
    assert.ok(line.includes('句首为主语引导'), '应说明主语引导');
    assert.ok(line.includes('你/你们/他/她/我们'), '应列出主语');
    assert.ok(line.includes('竟然'), '应列出强调副词');
    assert.ok(line.includes('上一拍叙述行确实落地同族动作'), '应说明同族落地');
  });

  test('中文动作家族 — 11 强家族 + 8 宽家族', () => {
    const line = lineOf(zh, '中文动作家族');
    assert.ok(line.includes('strike 打/扇/抽/捶/砸'), '应列出 strike');
    assert.ok(line.includes('tear 撕/扯'), '应列出 tear');
    assert.ok(line.includes('throw 扔/摔'), '应列出 throw');
    assert.ok(line.includes('remove 摘'), '应列出 remove');
    assert.ok(line.includes('强家族'), '应说明强家族');
    assert.ok(line.includes('宽家族'), '应说明宽家族');
    assert.ok(line.includes('takeaway 带走'), '应列出 takeaway');
    assert.ok(line.includes('sue 告'), '应列出 sue');
  });

  test('宽家族 cue — ±10 字窗口带物理/决裂语境', () => {
    const line = lineOf(zh, '宽家族：叙述行必须');
    assert.ok(line.includes('±10 字窗口'), '应给出窗口宽度');
    assert.ok(line.includes('当场/戒指/合同'), '应列出语境词');
    assert.ok(line.includes('公章/账户'), '应列出决裂语境词');
    assert.ok(line.includes('否则不算落地'), '应说明不落地');
  });

  test('假朋友排除 — 打电话/推门/亲自/离开/告诉', () => {
    const line = lineOf(zh, '假朋友排除');
    assert.ok(line.includes('打电话'), '应列出打电话');
    assert.ok(line.includes('推门'), '应列出推门');
    assert.ok(line.includes('亲自'), '应列出亲自');
    assert.ok(line.includes('离开'), '应列出离开');
    assert.ok(line.includes('告诉'), '应列出告诉');
    assert.ok(line.includes('真实动作'), '应说明需真实动作');
  });

  test('道具映射 — 离婚协议/辞职信/传票/亲子鉴定', () => {
    const line = lineOf(zh, '道具映射');
    assert.ok(line.includes('离婚协议'), '应列出离婚协议');
    assert.ok(line.includes('辞职信'), '应列出辞职信');
    assert.ok(line.includes('传票'), '应列出传票');
    assert.ok(line.includes('亲子鉴定'), '应列出亲子鉴定');
    assert.ok(line.includes('prop 型'), '应说明归入 prop');
  });

  test('charged 判定 — 全片第一次不罚，第 2 次起 charged，非同族第 3 次', () => {
    const line = lineOf(zh, 'charged 判定');
    assert.ok(line.includes('全片第一次回声'), '应说明第一次');
    assert.ok(line.includes('合法节拍'), '应说明合法节拍');
    assert.ok(line.includes('第 2 次起'), '应说明第 2 次起');
    assert.ok(line.includes('整片累计'), '应说明整片累计');
    assert.ok(line.includes('不是同族第 3 次'), '应点明与同族第 3 次不同');
  });

  test('rescue 本句 — 画面之外的新信息，只复述才是病', () => {
    const line = lineOf(zh, 'rescue·本句');
    assert.ok(line.includes('画面之外的新信息'), '应说明新信息');
    assert.ok(line.includes('律师'), '应列出律师');
    assert.ok(line.includes('净身出户'), '应列出净身出户');
    assert.ok(line.includes('抚养权'), '应列出抚养权');
    assert.ok(line.includes('只复述才是病'), '应说明判定口径');
  });

  test('rescue 下一非空行 — 换场即止的立刻落实决定', () => {
    const line = lineOf(zh, 'rescue·下一非空行');
    assert.ok(line.includes('下一条非空行'), '应说明回看距离');
    assert.ok(line.includes('换场即止'), '应说明换场边界');
    assert.ok(line.includes('拿起电话'), '应列出拿起电话');
    assert.ok(line.includes('当场签'), '应列出当场签');
    assert.ok(line.includes('头也不回'), '应列出头也不回');
  });

  test('得分 — 0 次 100 / 1 次 80 / ≥2 次 max(30, 100 - n × 22)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 80'), '应给单次口径');
    assert.ok(line.includes('max(30, 100 - n × 22)'), '应给多次公式');
    assert.ok(line.includes('charged 且未 rescued'), '应说明 bad 口径');
  });

  test('命中字段 — line / speaker / kind / action / 双 30 字 / charged / rescued / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('speaker'), '应列出 speaker');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('action'), '应列出 action');
    assert.ok(line.includes('narration'), '应列出 narration');
    assert.ok(line.includes('30 字截断'), '应说明截断');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('issues 只列 bad'), '应说明 issues 口径');
  });

  test('邻居分界 — mirror-visual / echo-dialogue / empty-threat', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('mirror-visual'), '应点明 mirror-visual');
    assert.ok(line.includes('echo-dialogue'), '应点明 echo-dialogue');
    assert.ok(line.includes('empty-threat'), '应点明 empty-threat');
    assert.ok(line.includes('方向相反'), '应说明与 echo-dialogue 方向相反');
    assert.ok(line.includes('正交'), '应说明与 empty-threat 正交');
  });

  test('pipeline 消费 — actionEchoHint、craft、v2.105 退役仅诊断、批量重扫', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('actionEchoHint'), '应说明 prePolish hint');
    assert.ok(line.includes('craft 初评/复评'), '应说明 craft 消费');
    assert.ok(line.includes('v2.105'), '应说明退役版本');
    assert.ok(line.includes('已退役'), '应说明仅诊断');
    assert.ok(line.includes('creative-batch-rescan'), '应说明批量重扫');
    const check = lineOf(zh, '成稿自查');
    assert.ok(check.includes('你打我？'), '应给自查例句');
    assert.ok(check.includes('删掉确认句'), '应给修改动作');
  });
});

describe('en — buildActionEchoDirective', () => {
  test('en 层存在、返回有效文本且零 CJK', () => {
    assert.equal(typeof mod.buildActionEchoDirective, 'function');
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(en.includes('Action-Echo'), '标题应点明 Action-Echo');
    assert.ok(en.includes('actionEchoDialogue'), '应与检测器同源');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现 CJK');
  });

  test('en 范围与长台词豁免 — dialogue lines only / 16 words / scene header', () => {
    const scope = lineOf(en, 'Scope:');
    assert.ok(scope.includes('dialogue lines only'), '应说明只扫台词行');
    assert.ok(scope.includes('next scene header clears lastNarration'), '应说明换场清空');
    assert.ok(scope.includes('blank lines do not'), '应说明空白行不清空');
    const long = lineOf(en, 'Long-line pass');
    assert.ok(long.includes('16 words'), '应给出英文阈值');
    assert.ok(long.includes('skipped'), '应说明放行');
  });

  test('en 家族与宽家族 — strong/weak + 40 characters cue + false friends', () => {
    const fam = lineOf(en, 'English families');
    assert.ok(fam.includes('strike/tear/throw/push/kiss/burn/strangle/bite/drag/grab'), '应列出强家族');
    assert.ok(fam.includes('kneel/lock/leave/divorce/cancel/sign/take'), '应列出宽家族');
    assert.ok(fam.includes('40 characters'), '应给出窗口宽度');
    assert.ok(fam.includes('across the face'), '应列出语境词');
    const fake = lineOf(en, 'False friends');
    assert.ok(fake.includes('phone call'), '应列出 phone call');
    assert.ok(fake.includes('pushed the door open'), '应列出推门假朋友');
    assert.ok(fake.includes('left the room'), '应列出离开假朋友');
    assert.ok(fake.includes('told'), '应列出 told');
  });

  test('en 三型与道具 — subject opener / 8 words or fewer / prop mapping', () => {
    const kinds = lineOf(en, 'Three kinds:');
    assert.ok(kinds.includes('question'), '应列出 question');
    assert.ok(kinds.includes('confirm'), '应列出 confirm');
    assert.ok(kinds.includes('prop'), '应列出 prop');
    const rules = lineOf(en, 'English rules:');
    assert.ok(rules.includes('subject opener'), '应说明主语引导');
    assert.ok(rules.includes('8 words or fewer'), '应说明确认句阈值');
    assert.ok(rules.includes('actually/really/did/just'), '应列出确认副词');
    const prop = lineOf(en, 'Prop mapping');
    assert.ok(prop.includes('divorce papers'), '应列出离婚协议');
    assert.ok(prop.includes('resignation letter'), '应列出辞职信');
    assert.ok(prop.includes('paternity test'), '应列出亲子鉴定');
  });

  test('en charged/rescue/计分/邻居 — first echo / from the second / 80 / max(30, 100 - n x 22)', () => {
    const charged = lineOf(en, 'Charged rule:');
    assert.ok(charged.includes('first echo'), '应说明第一次');
    assert.ok(charged.includes('from the second'), '应说明第 2 次起');
    assert.ok(charged.includes('script-wide count'), '应说明整片累计');
    const rescue = lineOf(en, 'Rescue in the line');
    assert.ok(rescue.includes('lawyer'), '应列出 lawyer');
    assert.ok(rescue.includes('custody'), '应列出 custody');
    assert.ok(rescue.includes('tomorrow'), '应列出 tomorrow');
    const next = lineOf(en, 'Rescue on the next line');
    assert.ok(next.includes('picked up the phone'), '应列出拿起电话');
    assert.ok(next.includes('without looking back'), '应列出头也不回');
    const score = lineOf(en, 'Score:');
    assert.ok(score.includes('0 bad = 100'), '应给全清口径');
    assert.ok(score.includes('1 bad = 80'), '应给单次口径');
    assert.ok(score.includes('max(30, 100 - n x 22)'), '应给多次公式');
    const nb = lineOf(en, 'Neighbours:');
    assert.ok(nb.includes('mirror-visual'), '应点明 mirror-visual');
    assert.ok(nb.includes('echo-dialogue'), '应点明 echo-dialogue');
    assert.ok(nb.includes('empty-threat'), '应点明 empty-threat');
  });
});
