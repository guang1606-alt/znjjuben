'use strict';
// v2.438 cheap-forgiveness 教学函数同源对齐测试
// 锚点紧贴引擎源码：120 行 HARM 窗口 / grave|heavy 分界 / grant|accept|coerce /
// accept 前 6 行 lead-in / coerce 3 行内 accept / 簇去重 ±4 行 /
// 代价窗口 [f-14, f+3] 与五通道 / grave 不可免单 / 加压项 +10 /
// 100 起 heavy -35 grave -45 floor 20 / 命中字段 40 字 /
// 邻居分界 / pipeline 消费 cheapForgiveHint 与成稿自查

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/cheap-forgiveness.js');

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

const zh = mod.buildCheapForgivenessDirective ? mod.buildCheapForgivenessDirective('LIVE', 'zh') : '';
const en = mod.buildCheapForgivenessDirective ? mod.buildCheapForgivenessDirective('LIVE', 'en') : '';

describe('zh — buildCheapForgivenessDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildCheapForgivenessDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 400, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('廉价原谅'), '标题应点明廉价原谅');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致，中英同一套规则', () => {
    assert.equal(mod.buildCheapForgivenessDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildCheapForgivenessDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, 'format 不门控');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
    assert.ok(line.includes('同一套'), '应说明规则跨语言一致');
  });

  test('检测范围 — 赦免点前 120 行窗口，只对 dialogue 台词行配对', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('120 行'), '应给出 HARM 回看窗口');
    assert.ok(line.includes('dialogue'), '应说明台词行语义');
    assert.ok(line.includes('场景头'), '应说明场景头断簇');
  });

  test('重伤判定 — grave / heavy 分界与典型例词', () => {
    const line = lineOf(zh, '重伤判定');
    assert.ok(line.includes('grave'), '应列出 grave');
    assert.ok(line.includes('heavy'), '应列出 heavy');
    assert.ok(line.includes('人命'), '应说明 grave 语义');
    assert.ok(line.includes('背叛'), '应说明 heavy 语义');
  });

  test('赦免点三型 — grant 明示原谅', () => {
    const head = lineOf(zh, '赦免点三型');
    assert.ok(head.includes('grant'), '应列出 grant');
    assert.ok(lineOf(zh, 'accept =').includes('accept'), '应列出 accept');
    assert.ok(lineOf(zh, 'coerce =').includes('coerce'), '应列出 coerce');
    const line = lineOf(zh, 'grant =');
    assert.ok(line.includes('我原谅你'), '应列出我原谅你');
    assert.ok(line.includes('翻篇'), '应列出翻篇');
  });

  test('accept lead-in — 前 6 行内需有道歉/借口/施压/明示原谅', () => {
    const line = lineOf(zh, 'accept =');
    assert.ok(line.includes('前 6 行'), '应给出 lead-in 窗口');
    assert.ok(line.includes('拥抱'), '应说明防日常拥抱误伤');
    assert.ok(line.includes('道歉'), '应列出 lead-in 信号');
  });

  test('coerce — 施压后 3 行内出现 accept 才成立', () => {
    const line = lineOf(zh, 'coerce =');
    assert.ok(line.includes('3 行内'), '应给出 coerce 窗口');
    assert.ok(line.includes('他毕竟是你爸'), '应给出典型施压话术');
    assert.ok(line.includes('走开'), '应说明走开不算和解');
  });

  test('簇去重 — 同一和解簇 ±4 行保留最前点，簇间新重伤切簇', () => {
    const line = lineOf(zh, '簇去重');
    assert.ok(line.includes('±4 行'), '应给出簇宽');
    assert.ok(line.includes('最前'), '应说明保留最前赦免点');
    assert.ok(line.includes('新重伤'), '应说明切簇条件');
  });

  test('代价核验 — 窗口 [f-14, f+3]，consequence / self_liberation 全豁免', () => {
    const line = lineOf(zh, '代价核验');
    assert.ok(line.includes('[f-14, f+3]'), '应给出代价窗口');
    assert.ok(line.includes('consequence'), '应列出 consequence');
    assert.ok(line.includes('self_liberation'), '应列出 self_liberation');
    assert.ok(line.includes('自首'), '应说明 consequence 语义');
    assert.ok(line.includes('放过我自己'), '应说明自我解放');
  });

  test('豁免通道 — time / earned / heavy-only', () => {
    const line = lineOf(zh, '豁免通道');
    assert.ok(line.includes('time'), '应列出 time');
    assert.ok(line.includes('earned'), '应列出 earned');
    assert.ok(line.includes('heavy-only'), '应列出 heavy-only');
    assert.ok(line.includes('≥8 行'), '应给出 earned 间隔');
  });

  test('grave 不可免单 — graveyard 只靠道歉直接判死', () => {
    const line = lineOf(zh, 'grave 不可免单');
    assert.ok(line.includes('graveyard'), '应列出 graveyard');
    assert.ok(line.includes('sorry'), '应说明嘴道歉不够');
    assert.ok(line.includes('冤狱'), '应点明 grave 典型');
  });

  test('加压项 — excuse / pressure / instant 各 +10，不改变豁免', () => {
    const line = lineOf(zh, '加压项');
    assert.ok(line.includes('excuse'), '应列出 excuse');
    assert.ok(line.includes('pressure'), '应列出 pressure');
    assert.ok(line.includes('instant'), '应列出 instant');
    assert.ok(line.includes('+10'), '应说明各加 10 分');
    assert.ok(line.includes('不改变豁免'), '应说明只加重扣分');
  });

  test('计分 — 100 起，heavy -35 / grave -45，floor 20', () => {
    const line = lineOf(zh, '计分');
    assert.ok(line.includes('100 起'), '应给起始分');
    assert.ok(line.includes('heavy −35'), '应给 heavy 扣分');
    assert.ok(line.includes('grave −45'), '应给 grave 扣分');
    assert.ok(line.includes('floor 20'), '应给下限');
  });

  test('命中字段 — harmLine / kind / severity / boosters / snippet 40 字 / rescueLine', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('harmLine'), '应列出 harmLine');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('severity'), '应列出 severity');
    assert.ok(line.includes('boosters'), '应列出 boosters');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('40 字'), '应说明截断长度');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
  });

  test('邻居分界 — relationship-progression / emotional-aftermath / misunderstanding-drag / payoff-rhythm', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('relationship-progression-check'), '应点明恋爱递进');
    assert.ok(line.includes('emotional-aftermath-check'), '应点明情绪余波');
    assert.ok(line.includes('misunderstanding-drag-check'), '应点明误会拖沓');
    assert.ok(line.includes('payoff-rhythm'), '应点明复仇 IOUs');
    assert.ok(line.includes('humiliation-ledger'), '应点明当众受辱台账');
  });

  test('pipeline 消费与成稿自查 — cheapForgiveHint / craft 初评复评 / deai / v2.80 + 兑付方向', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('cheapForgiveHint'), '应说明 prePolish hint');
    assert.ok(line.includes('craft 初评/复评'), '应说明 craft 消费');
    assert.ok(line.includes('deai'), '应说明 deai 重扫');
    assert.ok(line.includes('v2.80'), '应标注引擎版本');
    const check = lineOf(zh, '成稿自查');
    assert.ok(check.includes('付代价'), '应给付代价方向');
    assert.ok(check.includes('分期兑付'), '应给分期兑付方向');
    assert.ok(check.includes('重新挣回'), '应给拒绝后挣回方向');
  });
});

describe('en — buildCheapForgivenessDirective', () => {
  test('en 层存在、返回有效文本且零 CJK', () => {
    assert.equal(typeof mod.buildCheapForgivenessDirective, 'function');
    assert.ok(typeof en === 'string' && en.length > 400, 'en 层应返回有效字符串');
    assert.ok(en.includes('Cheap Forgiveness'), '标题应点明 Cheap Forgiveness');
    assert.ok(en.includes('cheap-forgiveness'), '应与检测器同源');
    assert.ok(!/[一-龥]/.test(en), 'en 层不得出现 CJK');
  });

  test('en 检测与重伤 — 120 lines / grave / heavy / dialogue', () => {
    const scan = lineOf(en, 'Scan range');
    assert.ok(scan.includes('120 lines'), '应给出回看窗口');
    assert.ok(scan.includes('dialogue'), '应说明台词行语义');
    const sev = lineOf(en, 'Severity');
    assert.ok(sev.includes('grave'), '应列出 grave');
    assert.ok(sev.includes('heavy'), '应列出 heavy');
    assert.ok(sev.includes('wrongful imprisonment'), '应说明 grave 语义');
  });

  test('en 三型 — grant / accept / coerce，six lines / three lines', () => {
    const line = lineOf(en, 'Pardon types');
    assert.ok(line.includes('grant'), '应列出 grant');
    assert.ok(line.includes('accept'), '应列出 accept');
    assert.ok(line.includes('coerce'), '应列出 coerce');
    assert.ok(line.includes('six lines'), '应给出 accept lead-in 窗口');
    assert.ok(line.includes('three lines'), '应给出 coerce 窗口');
  });

  test('en 代价 — [f-14, f+3] / self-liberation / eight lines / 35 / 45 / floor 20', () => {
    const cost = lineOf(en, 'Cost check');
    assert.ok(cost.includes('[f-14, f+3]'), '应给出代价窗口');
    assert.ok(cost.includes('consequence'), '应列出 consequence');
    assert.ok(cost.includes('self-liberation'), '应列出 self-liberation');
    const chan = lineOf(en, 'Exemption channels');
    assert.ok(chan.includes('time'), '应列出 time');
    assert.ok(chan.includes('earned'), '应列出 earned');
    assert.ok(chan.includes('eight lines'), '应给出 earned 间隔');
    const score = lineOf(en, 'Scoring');
    assert.ok(score.includes('35'), '应给 heavy 扣分');
    assert.ok(score.includes('45'), '应给 grave 扣分');
    assert.ok(score.includes('floor 20'), '应给下限');
  });

  test('en 字段/邻居/pipeline — harmLine / boosters / 40 characters / cheapForgiveHint', () => {
    const fields = lineOf(en, 'Hit fields');
    assert.ok(fields.includes('harmLine'), '应列出 harmLine');
    assert.ok(fields.includes('boosters'), '应列出 boosters');
    assert.ok(fields.includes('40 characters'), '应说明截断长度');
    assert.ok(fields.includes('rescueLine'), '应列出 rescueLine');
    const nei = lineOf(en, 'Neighbors');
    assert.ok(nei.includes('relationship-progression-check'), '应点明恋爱递进');
    assert.ok(nei.includes('emotional-aftermath-check'), '应点明情绪余波');
    assert.ok(nei.includes('misunderstanding-drag-check'), '应点明误会拖沓');
    assert.ok(nei.includes('payoff-rhythm'), '应点明复仇 IOUs');
    const pipe = lineOf(en, 'Pipeline');
    assert.ok(pipe.includes('cheapForgiveHint'), '应说明 prePolish hint');
  });
});
