'use strict';
// v2.435 eavesdrop-dump 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 位置帧+路径帧 / 21 类机密词 / repeat 第 2 次起 /
// package ≥2 类且够长单次即罚 / ±2 行 rescue / 0-1-≥2 计分 / 命中字段 /
// 邻居三分界 / 消费与自查

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/eavesdrop-dump.js');

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

const zh = mod.buildEavesdropDirective ? mod.buildEavesdropDirective('LIVE', 'zh') : '';
const en = mod.buildEavesdropDirective ? mod.buildEavesdropDirective('LIVE', 'en') : '';

describe('zh — buildEavesdropDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildEavesdropDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('撞听秘密'), '标题应点明撞听秘密');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致，中英同一套规则', () => {
    assert.equal(mod.buildEavesdropDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildEavesdropDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, '同一套帧');
    assert.ok(line.includes('同一套帧'), '应说明规则跨语言一致');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
  });

  test('检测范围 — 只扫叙述行，台词行与场头跳过', () => {
    const line = lineOf(zh, '检测范围：只扫叙述行');
    assert.ok(line.includes('台词行'), '应说明台词行跳过');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('narrationLines'), '应说明叙述行计数');
  });

  test('位置帧 — 藏身位与听觉动词同行短窗口共现', () => {
    const line = lineOf(zh, '位置帧：');
    assert.ok(line.includes('门外'), '应列出门外');
    assert.ok(line.includes('拐角'), '应列出拐角');
    assert.ok(line.includes('虚掩的门'), '应列出虚掩的门');
    assert.ok(line.includes('听见'), '应列出听见');
    assert.ok(line.includes('传来'), '应列出传来');
    assert.ok(line.includes('同一行'), '应说明同行共现');
    assert.ok(line.includes('门外下雨了'), '应给出反例');
  });

  test('路径帧 — 路过/走到 + 房间词 + 听见，同样只认同行', () => {
    const line = lineOf(zh, '路径帧');
    assert.ok(line.includes('路过'), '应列出路过');
    assert.ok(line.includes('刚走到'), '应列出刚走到');
    assert.ok(line.includes('书房'), '应列出书房');
    assert.ok(line.includes('听见'), '应列出听见');
    assert.ok(line.includes('同一行'), '应说明同行');
  });

  test('秘密内容 — 21 类机密词，可延至紧邻下一非空行', () => {
    const line = lineOf(zh, '秘密内容：');
    assert.ok(line.includes('紧邻下一非空行'), '应说明可延至下一行');
    assert.ok(line.includes('场头即止'), '应说明场头边界');
    assert.ok(line.includes('21 类'), '应说明类别数');
    assert.ok(line.includes('亲子鉴定'), '应列出亲子鉴定');
    assert.ok(line.includes('股权'), '应列出股权');
    assert.ok(line.includes('证据'), '应列出证据');
    assert.ok(line.includes('怀孕'), '应列出怀孕');
  });

  test('repeat 判定 — 全片第一次不罚，第 2 次起 charged，按 hits 累计', () => {
    const line = lineOf(zh, 'repeat 判定');
    assert.ok(line.includes('第一次撞听'), '应说明第一次');
    assert.ok(line.includes('合法手法'), '应说明合法手法');
    assert.ok(line.includes('第 2 次起'), '应说明第 2 次起');
    assert.ok(line.includes('hits 累计'), '应说明按 hits 累计');
  });

  test('package 判定 — ≥2 类且够长，单次即 charged', () => {
    const line = lineOf(zh, 'package 判定');
    assert.ok(line.includes('≥2 类'), '应说明类别门槛');
    assert.ok(line.includes('22 字'), '应给出中文长度阈值');
    assert.ok(line.includes('16 词'), '应给出英文长度阈值');
    assert.ok(line.includes('单次即 charged'), '应说明单次即罚');
    assert.ok(line.includes('产品说明书'), '应给出症状比喻');
  });

  test('charged 合并 — package 首犯即罚，plain 从第 2 次罚', () => {
    const line = lineOf(zh, 'charged 合并');
    assert.ok(line.includes('package'), '应说明 package');
    assert.ok(line.includes('≥1 条 hit'), '应说明 hit 累计');
    assert.ok(line.includes('首犯就罚'), '应说明套餐首犯');
    assert.ok(line.includes('第 2 次罚'), '应说明普通撞听');
  });

  test('rescued 通道 — ±2 行内的布置/风险/留证信号', () => {
    const line = lineOf(zh, 'rescued 通道');
    assert.ok(line.includes('±2 行'), '应给出窗口');
    assert.ok(line.includes('屏住呼吸'), '应列出屏住呼吸');
    assert.ok(line.includes('蹲守'), '应列出蹲守');
    assert.ok(line.includes('差点被发现'), '应列出差点被发现');
    assert.ok(line.includes('按下录音'), '应列出按下录音');
  });

  test('rescue 口径 — 有成本或被利用才算戏', () => {
    const line = lineOf(zh, 'rescue 口径');
    assert.ok(line.includes('提前布置'), '应列出提前布置');
    assert.ok(line.includes('差点暴露'), '应列出差点暴露');
    assert.ok(line.includes('冒险录音'), '应列出冒险录音');
    assert.ok(line.includes('零布置零风险'), '应说明白捡口径');
    assert.ok(line.includes('才是病'), '应点明病根');
  });

  test('只算 bad — rescued 不进扣分，issues 只列 bad', () => {
    const line = lineOf(zh, '只算 bad');
    assert.ok(line.includes('charged 且未 rescued'), '应说明 bad 口径');
    assert.ok(line.includes('不参与扣分'), '应说明 rescued 豁免');
    assert.ok(line.includes('issues 只列 bad'), '应说明 issues 范围');
  });

  test('得分 — 0 次 100 / 1 次 78 / ≥2 次 max(25, 100 - n × 24)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 78'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 24)'), '应给多次公式');
  });

  test('命中字段 — line / kind / snippet 36 字 / events / charged / rescued / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('repeat|package'), '应列出 kind 取值');
    assert.ok(line.includes('36 字截断'), '应说明截断');
    assert.ok(line.includes('events'), '应列出 events');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — causal-logic / info-delivery / exposition-dialogue', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('causal-logic'), '应点明 causal-logic');
    assert.ok(line.includes('info-delivery'), '应点明 info-delivery');
    assert.ok(line.includes('exposition-dialogue'), '应点明 exposition-dialogue');
    assert.ok(line.includes('as you know'), '应说明已知背景台词');
    assert.ok(line.includes('第三者在场'), '应说明本引擎独占场景');
  });

  test('pipeline 消费与成稿自查 — eavesdropHint、v2.99 退役仅诊断、批量重扫', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('eavesdropHint'), '应说明 prePolish hint');
    assert.ok(line.includes('craft 初评/复评'), '应说明 craft 消费');
    assert.ok(line.includes('v2.99'), '应说明退役版本');
    assert.ok(line.includes('已退役'), '应说明仅诊断');
    assert.ok(line.includes('creative-batch-rescan'), '应说明批量重扫');
    const check = lineOf(zh, '成稿自查');
    assert.ok(check.includes('走到门口就听见'), '应给自查例句');
    assert.ok(check.includes('半句黑话'), '应给改写方向');
  });
});

describe('en — buildEavesdropDirective', () => {
  test('en 层存在、返回有效文本且零 CJK', () => {
    assert.equal(typeof mod.buildEavesdropDirective, 'function');
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(en.includes('Eavesdrop'), '标题应点明 Eavesdrop');
    assert.ok(en.includes('eavesdropDump'), '应与检测器同源');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现 CJK');
  });

  test('en 范围与位置帧 — narration only / outside the door / same line', () => {
    const scope = lineOf(en, 'Scope:');
    assert.ok(scope.includes('narration lines only'), '应说明只扫叙述行');
    assert.ok(scope.includes('speaker lines'), '应说明台词行跳过');
    assert.ok(scope.includes('scene headers'), '应说明场头跳过');
    const frame = lineOf(en, 'Position frame:');
    assert.ok(frame.includes('outside the door'), '应列出门外');
    assert.ok(frame.includes('half-open'), '应列出虚掩的门');
    assert.ok(frame.includes('same line'), '应说明同行共现');
  });

  test('en 秘密与套餐 — 21 categories / paternity / 16 words / product manual', () => {
    const secret = lineOf(en, 'Secret content:');
    assert.ok(secret.includes('21 categories'), '应说明类别数');
    assert.ok(secret.includes('paternity'), '应列出亲子鉴定');
    assert.ok(secret.includes('shares'), '应列出股权');
    const pkg = lineOf(en, 'Package rule:');
    assert.ok(pkg.includes('two or more'), '应说明类别门槛');
    assert.ok(pkg.includes('16 English words'), '应给出长度阈值');
    assert.ok(pkg.includes('product manual'), '应给出症状比喻');
  });

  test('en repeat/rescue — first overheard / from the second / held her breath / hit record', () => {
    const rep = lineOf(en, 'Repeat rule:');
    assert.ok(rep.includes('first overheard'), '应说明第一次');
    assert.ok(rep.includes('from the second'), '应说明第 2 次起');
    assert.ok(rep.includes('running hit count'), '应说明 hit 累计');
    const rescue = lineOf(en, 'Rescue window:');
    assert.ok(rescue.includes('2 lines'), '应给出窗口');
    assert.ok(rescue.includes('held her breath'), '应列出屏住呼吸');
    assert.ok(rescue.includes('staked out'), '应列出蹲守');
    assert.ok(rescue.includes('hit record'), '应列出录音');
  });

  test('en 计分/字段/邻居/消费 — 78 / max(25) / 36 characters / v2.99', () => {
    const score = lineOf(en, 'Score:');
    assert.ok(score.includes('1 bad = 78'), '应给单次口径');
    assert.ok(score.includes('max(25, 100 - n x 24)'), '应给多次公式');
    const fields = lineOf(en, 'Hit fields:');
    assert.ok(fields.includes('36 characters'), '应说明截断');
    const nb = lineOf(en, 'Neighbours:');
    assert.ok(nb.includes('causal-logic'), '应点明 causal-logic');
    assert.ok(nb.includes('info-delivery'), '应点明 info-delivery');
    assert.ok(nb.includes('exposition-dialogue'), '应点明 exposition-dialogue');
    const pipe = lineOf(en, 'Pipeline:');
    assert.ok(pipe.includes('eavesdropHint'), '应说明 hint');
    assert.ok(pipe.includes('v2.99'), '应说明退役版本');
    assert.ok(pipe.includes('batch-rescan'), '应说明批量重扫');
  });
});
