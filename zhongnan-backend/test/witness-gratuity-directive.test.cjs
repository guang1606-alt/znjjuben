'use strict';
// v2.440 witness-gratuity 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫台词 / 同人合并 turn / zh 12 字 en 10 词 / 第一人称排除 /
// 第三人称必含 / ≥2 族且含 deed|evidence / 五族 / 前 10 后 3 行成本窗口 /
// 五豁免 + reluctance 仅 2 族 / 加压 bundle|volunteer|emptyAsk /
// 计分 -28 / bundle -6 / volunteer -4 / floor 20 / 命中字段 40 字 /
// 邻居四分界 / pipeline 消费 gratuityHint / 成稿自查 / en 零 CJK

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/witness-gratuity.js');

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

const zh = mod.buildWitnessGratuityDirective ? mod.buildWitnessGratuityDirective('LIVE', 'zh') : '';
const en = mod.buildWitnessGratuityDirective ? mod.buildWitnessGratuityDirective('LIVE', 'en') : '';

describe('zh — buildWitnessGratuityDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildWitnessGratuityDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 400, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('情报套餐'), '标题应点明情报套餐');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致', () => {
    assert.equal(mod.buildWitnessGratuityDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildWitnessGratuityDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, 'format 不门控');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
    assert.ok(line.includes('同一套'), '应说明规则跨格式一致');
  });

  test('检测范围 — 只扫台词 / 同人合并 / 长度门槛', () => {
    const line = lineOf(zh, '检测范围：');
    assert.ok(line.includes('只扫台词'), '应只扫台词行');
    assert.ok(line.includes('同人连续发言'), '应合并同人连续发言');
    assert.ok(line.includes('12 字'), '中文长度门槛 12 字');
    assert.ok(line.includes('10 词'), '英文长度门槛 10 词');
    assert.ok(line.includes('空行'), '空行不断 turn');
    assert.ok(line.includes('场头'), '场头断 turn');
  });

  test('第一人称认罪 — 排除并归 villain-overconfession', () => {
    const line = lineOf(zh, '第一人称');
    assert.ok(line.includes('villain-overconfession'), '应点名 villain-overconfession');
    assert.ok(line.includes('排除'), '应说明第一人称认罪排除');
  });

  test('第三人称 — 必须指认加害者', () => {
    const line = lineOf(zh, '第三人称指认');
    assert.ok(line.includes('必须'), '应说明必须含第三人称');
    assert.ok(line.includes('加害'), '应说明指向加害者');
  });

  test('套餐判定 — ≥2 族且必含 deed 或 evidence', () => {
    const line = lineOf(zh, '套餐判定：');
    assert.ok(line.includes('≥2 类'), '应 ≥2 类情报族');
    assert.ok(line.includes('deed'), '应含 deed');
    assert.ok(line.includes('evidence'), '应含 evidence');
    assert.ok(line.includes('必须'), '应说明二者必含其一');
  });

  test('五族齐备 — deed/evidence/whenWhere/next/accomplice', () => {
    const line = lineOf(zh, '五族：');
    for (const k of ['deed', 'evidence', 'whenWhere', 'next', 'accomplice']) {
      assert.ok(line.includes(k), `应列出 ${k}`);
    }
  });

  test('取证成本核验 — 前 10 行 + 后 3 行窗口', () => {
    const line = lineOf(zh, '取证成本核验：');
    assert.ok(line.includes('前 10 行'), '应扫 turn 前 10 行');
    assert.ok(line.includes('后 3 行'), '应扫 turn 后 3 行');
  });

  test('豁免通道 — motive/extract/promise/duty/riskAfter 任一成立', () => {
    const line = lineOf(zh, '豁免通道：');
    for (const k of ['motive', 'extract', 'promise', 'duty', 'riskAfter']) {
      assert.ok(line.includes(k), `应列出豁免 ${k}`);
    }
    assert.ok(line.includes('任一'), '应说明任一成立即豁免');
  });

  test('reluctance 例外 — 仅 2 族小漏口豁免，大套餐不豁免', () => {
    const line = lineOf(zh, 'reluctance');
    assert.ok(line.includes('2 族'), 'reluctance 仅 2 族豁免');
    assert.ok(line.includes('大套餐'), '大套餐不豁免');
  });

  test('廉价加压 — bundle/volunteer/emptyAsk 不改豁免', () => {
    const line = lineOf(zh, '廉价加压');
    assert.ok(line.includes('bundle'), '应列出 bundle');
    assert.ok(line.includes('volunteer'), '应列出 volunteer');
    assert.ok(line.includes('emptyAsk'), '应列出 emptyAsk');
    assert.ok(line.includes('不改变豁免'), '应说明加压不改豁免');
    assert.ok(line.includes('前 6 行'), 'volunteer/emptyAsk 前 6 行窗口');
  });

  test('计分 — 100 起 -28 / bundle -6 / volunteer -4 / floor 20', () => {
    const line = lineOf(zh, '计分：');
    assert.ok(line.includes('-28'), '每未豁免 hit -28');
    assert.ok(line.includes('-6'), 'bundle -6');
    assert.ok(line.includes('-4'), 'volunteer -4');
    assert.ok(line.includes('20'), '应给出封底');
  });

  test('命中字段 — 全字段与 40 字截断', () => {
    const line = lineOf(zh, '命中字段：');
    for (const k of ['line', 'endLine', 'speaker', 'families', 'prompted', 'boosters', 'snippet', 'rescued', 'rescueLine', 'reason']) {
      assert.ok(line.includes(k), `应列出字段 ${k}`);
    }
    assert.ok(line.includes('40 字'), 'snippet 应 40 字截断');
  });

  test('邻居分界 — villain-overconfession / eavesdrop-dump / info-delivery / exposition-dialogue', () => {
    const line = lineOf(zh, '邻居分界：');
    for (const k of ['villain-overconfession', 'eavesdrop-dump', 'info-delivery', 'exposition-dialogue']) {
      assert.ok(line.includes(k), `应点名 ${k}`);
    }
  });

  test('pipeline 消费 — gratuityHint 双注入', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('gratuityHint'), '应说明注入 gratuityHint');
    assert.ok(line.includes('撰写师'), '应说明撰写师首轮可见');
    assert.ok(line.includes('润色师'), '应说明润色师首轮可见');
  });

  test('pipeline 接线 — import/构造/两处注入齐备', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(path.join(ROOT, 'src/agents/pipeline.ts'), 'utf8');
    const importLine = lineOf(src, 'buildWitnessGratuityDirective');
    assert.ok(importLine.includes('witness-gratuity'), '应从 witness-gratuity 导入');
    assert.ok(src.includes('const witnessGratuityDirective = buildWitnessGratuityDirective('), '应有构造调用');
    const injections = src.split('${witnessGratuityDirective}').length - 1;
    assert.equal(injections, 2, '撰写师与润色师应各注入一次');
  });

  test('成稿自查 — 分批吐口、每次付代价', () => {
    const line = lineOf(zh, '成稿自查：');
    assert.ok(line.includes('分批'), '应要求分批吐口');
    assert.ok(line.includes('付代价'), '应要求每次付代价');
    assert.ok(line.includes('一条'), '应要求只给当下必需的一条');
  });
});

describe('en — buildWitnessGratuityDirective', () => {
  test('返回有效英文教学文本且零 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 400, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fff]/.test(en), 'en 层不得出现中文');
    assert.ok(en.includes('intel bundle'), '标题应点明 intel bundle');
  });

  test('检测范围 — dialogue only / 12 characters / 10 words', () => {
    const line = lineOf(en, 'Scope:');
    assert.ok(line.includes('dialogue'), '只扫台词');
    assert.ok(line.includes('12 characters'), '中文门槛 12 字');
    assert.ok(line.includes('10 words'), '英文门槛 10 词');
    assert.ok(line.includes('same speaker'), '同人连续发言合并');
  });

  test('五族与套餐 — deed/evidence 必含其一', () => {
    const line = lineOf(en, 'Families:');
    for (const k of ['deed', 'evidence', 'whenWhere', 'next', 'accomplice']) {
      assert.ok(line.includes(k), `应列出 ${k}`);
    }
    const rule = lineOf(en, 'Bundle rule:');
    assert.ok(rule.includes('two'), '应 ≥2 族');
    assert.ok(rule.includes('deed') || rule.includes('evidence'), '应说明必须含 deed 或 evidence');
  });

  test('豁免与 reluctance — 五通道 + 仅两族', () => {
    const line = lineOf(en, 'Rescue:');
    for (const k of ['motive', 'extract', 'promise', 'duty', 'riskAfter']) {
      assert.ok(line.includes(k), `应列出 ${k}`);
    }
    const rel = lineOf(en, 'Reluctance exception:');
    assert.ok(rel.includes('two families'), 'reluctance 仅两族豁免');
    assert.ok(rel.includes('larger bundle') || rel.includes('bundle'), '大套餐不豁免');
  });

  test('计分与窗口 — -28 / -6 / -4 / floor 20 / ten lines', () => {
    const scoring = lineOf(en, 'Scoring:');
    assert.ok(scoring.includes('-28'), '每 hit -28');
    assert.ok(scoring.includes('-6'), 'bundle -6');
    assert.ok(scoring.includes('-4'), 'volunteer -4');
    assert.ok(scoring.includes('floor 20'), '封底 20');
    const window = lineOf(en, 'Rescue window:');
    assert.ok(window.includes('ten lines'), '前 10 行窗口');
    assert.ok(window.includes('three lines'), '后 3 行窗口');
  });
});
