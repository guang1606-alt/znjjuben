'use strict';
// v2.437 villain-overconfession 教学函数同源对齐测试
// 锚点紧贴引擎源码：台词配对检测（probe 短问句 + 下一发言行，允许夹 1 行叙述）/
// kind=confess|freebie / 机密五族 ≥2 且长度达标 / 单族短认放行 /
// 四 rescue 通道（evidence 窗口 ≤4 行且不含 next / deal / trap / legal）/
// 只算 bad / 0-1-≥2 计分（75 / max(25, 100-n*24)）/ 命中字段 snippet 40 字 /
// 邻居分界 / pipeline 消费（villainHint / craft / deai / qcReport villainConf 透出）

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/villain-overconfession.js');

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

const zh = mod.buildVillainOverconfessionDirective ? mod.buildVillainOverconfessionDirective('LIVE', 'zh') : '';
const en = mod.buildVillainOverconfessionDirective ? mod.buildVillainOverconfessionDirective('LIVE', 'en') : '';

describe('zh — buildVillainOverconfessionDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildVillainOverconfessionDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('反派不打自招'), '标题应点明反派不打自招');
  });

  test('format 不门控 — LIVE / AIGC / 缺省一致，中英同一套规则', () => {
    assert.equal(mod.buildVillainOverconfessionDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildVillainOverconfessionDirective(undefined, 'zh'), zh);
    const line = lineOf(zh, '同一套');
    assert.ok(line.includes('同一套'), '应说明规则跨语言一致');
    assert.ok(line.includes('format 不门控'), '应说明 format 不门控');
  });

  test('检测范围 — 同场连续发言内的台词配对，dialogueLines 只计台词行', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('台词配对'), '应说明台词配对');
    assert.ok(line.includes('同场连续发言'), '应说明同场连续发言');
    assert.ok(line.includes('dialogueLines'), '应说明台词行计数');
  });

  test('probe 判定 — 短问句 zh≤24 字 / en≤16 词，指向罪行的空泛质问', () => {
    const line = lineOf(zh, 'probe 判定');
    assert.ok(line.includes('24 字'), '应给出中文阈值');
    assert.ok(line.includes('16 词'), '应给出英文阈值');
    assert.ok(line.includes('空泛'), '应说明不含具体证据');
    assert.ok(line.includes('是不是你'), '应列出典型试探');
  });

  test('confession 定位 — 下一发言行，允许夹 1 行叙述', () => {
    const line = lineOf(zh, 'confession 定位');
    assert.ok(line.includes('下一发言行'), '应说明配对目标');
    assert.ok(line.includes('夹 1 行叙述'), '应说明夹行上限');
    assert.ok(line.includes('场景头'), '应说明场景头断配对');
  });

  test('kind=confess — 承认词 是我 / 我干的 / 没错', () => {
    const line = lineOf(zh, 'kind=confess');
    assert.ok(line.includes('是我'), '应列出是我');
    assert.ok(line.includes('我干的'), '应列出我干的');
    assert.ok(line.includes('没错'), '应列出没错');
  });

  test('kind=freebie — 免费加料框架 我不妨再告诉你 / 让你死个明白', () => {
    const line = lineOf(zh, 'kind=freebie');
    assert.ok(line.includes('我不妨再告诉你'), '应列出我不妨再告诉你');
    assert.ok(line.includes('让你死个明白'), '应列出让你死个明白');
  });

  test('机密五族 — method / accomplice / coldcase / motive / next', () => {
    const line = lineOf(zh, '机密五族');
    assert.ok(line.includes('method'), '应列出 method');
    assert.ok(line.includes('accomplice'), '应列出 accomplice');
    assert.ok(line.includes('coldcase'), '应列出 coldcase');
    assert.ok(line.includes('motive'), '应列出 motive');
    assert.ok(line.includes('next'), '应列出 next');
    assert.ok(line.includes('手法'), '应说明 method 语义');
    assert.ok(line.includes('同伙'), '应说明 accomplice 语义');
    assert.ok(line.includes('下一步'), '应说明 next 语义');
  });

  test('bad 判定 — 机密 ≥2 族且长度达标 zh≥14 字 / en≥9 词', () => {
    const line = lineOf(zh, 'bad 判定');
    assert.ok(line.includes('≥2 族'), '应说明族数门槛');
    assert.ok(line.includes('14 字'), '应给出中文长度阈值');
    assert.ok(line.includes('9 词'), '应给出英文长度阈值');
  });

  test('放行口径 — 单族短认（"是我。你能怎样。"）不罚', () => {
    const line = lineOf(zh, '放行口径');
    assert.ok(line.includes('单族短认'), '应说明放行条件');
    assert.ok(line.includes('你能怎样'), '应给出放行例句');
  });

  test('rescue 四通道 — evidence / deal / trap / legal', () => {
    const line = lineOf(zh, 'rescue 四通道');
    assert.ok(line.includes('evidence'), '应列出 evidence');
    assert.ok(line.includes('deal'), '应列出 deal');
    assert.ok(line.includes('trap'), '应列出 trap');
    assert.ok(line.includes('legal'), '应列出 legal');
    assert.ok(line.includes('交换条件'), '应说明 deal 语义');
    assert.ok(line.includes('诈供'), '应说明 trap 语义');
    assert.ok(line.includes('审讯'), '应说明 legal 语境');
  });

  test('evidence 窗口 — probe 前 ≤4 行已摆证据，且不含 next 族', () => {
    const line = lineOf(zh, 'evidence 窗口');
    assert.ok(line.includes('≤4 行'), '应给出窗口宽度');
    assert.ok(line.includes('不含 next'), '应说明 next 族仍蠢');
    assert.ok(line.includes('被逼到墙角'), '应说明被逼确认合法');
  });

  test('只算 bad — rescued 不进扣分，issues 只列 bad', () => {
    const line = lineOf(zh, '只算 bad');
    assert.ok(line.includes('bad = 未 rescued'), '应说明 bad 口径');
    assert.ok(line.includes('不参与扣分'), '应说明 rescued 豁免');
    assert.ok(line.includes('issues 只列 bad'), '应说明 issues 范围');
  });

  test('得分 — 0 次 100 / 1 次 75 / ≥2 次 max(25, 100 - n × 24)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 75'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 24)'), '应给多次公式');
  });

  test('命中字段 — probeLine / line / speaker / kind / families / snippet 40 字 / rescued / rescueLine', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('probeLine'), '应列出 probeLine');
    assert.ok(line.includes('speaker'), '应列出 speaker');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('families'), '应列出 families');
    assert.ok(line.includes('40 字截断'), '应说明截断');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
  });

  test('邻居分界 — plot-armor / shared_memory / info-delivery / villain-stall / villain-threat', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('plot-armor.monologue_delay'), '应点明 plot-armor');
    assert.ok(line.includes('exposition-dialogue.shared_memory'), '应点明 shared_memory');
    assert.ok(line.includes('info-delivery'), '应点明 info-delivery');
    assert.ok(line.includes('villain-stall'), '应点明 villain-stall');
    assert.ok(line.includes('villain-threat'), '应点明 villain-threat');
    assert.ok(line.includes('主角光环'), '应说明 plot-armor 分工');
  });

  test('pipeline 消费与成稿自查 — villainHint / craft 初评复评 / deai 重扫 / qcReport villainConf 透出', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('villainHint'), '应说明 prePolish hint');
    assert.ok(line.includes('craft 初评/复评'), '应说明 craft 消费');
    assert.ok(line.includes('deai'), '应说明 deai 重扫');
    assert.ok(line.includes('qcReport'), '应说明 qcReport 透出');
    assert.ok(line.includes('villainConf'), '应说明透出字段');
    const check = lineOf(zh, '成稿自查');
    assert.ok(check.includes('抵赖'), '应给改写方向');
    assert.ok(check.includes('证据拍到一件'), '应说明分期兑付');
  });
});

describe('en — buildVillainOverconfessionDirective', () => {
  test('en 层存在、返回有效文本且零 CJK', () => {
    assert.equal(typeof mod.buildVillainOverconfessionDirective, 'function');
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(en.includes('Villain Over-Confession'), '标题应点明 Villain Over-Confession');
    assert.ok(en.includes('villainOverconfession'), '应与检测器同源');
    assert.ok(!/[一-龥]/.test(en), 'en 层不得出现 CJK');
  });

  test('en probe/配对 — vague probe within 16 words / next speaker turn with one narration line allowed', () => {
    const probe = lineOf(en, 'Probe rule:');
    assert.ok(probe.includes('16 English words'), '应给出英文阈值');
    assert.ok(probe.includes('vague'), '应说明空泛质问');
    const pair = lineOf(en, 'Pairing:');
    assert.ok(pair.includes('next speaker turn'), '应说明配对目标');
    assert.ok(pair.includes('one narration line'), '应说明夹行上限');
  });

  test('en 五族与 bad 判定 — five secret families / two or more families / 9 English words', () => {
    const fam = lineOf(en, 'secret families:');
    assert.ok(fam.includes('method'), '应列出 method');
    assert.ok(fam.includes('accomplice'), '应列出 accomplice');
    assert.ok(fam.includes('coldcase'), '应列出 coldcase');
    assert.ok(fam.includes('motive'), '应列出 motive');
    assert.ok(fam.includes('next'), '应列出 next');
    const bad = lineOf(en, 'Bad rule:');
    assert.ok(bad.includes('two or more families'), '应说明族数门槛');
    assert.ok(bad.includes('9 English words'), '应给出长度阈值');
  });

  test('en rescue — evidence window of four lines / no next family / deal / trap / legal', () => {
    const ev = lineOf(en, 'Rescue channels:');
    assert.ok(ev.includes('four lines'), '应给出窗口宽度');
    assert.ok(ev.includes('next'), '应说明 next 族仍蠢');
    assert.ok(ev.includes('deal'), '应列出 deal');
    assert.ok(ev.includes('trap'), '应列出 trap');
    assert.ok(ev.includes('legal'), '应列出 legal');
  });

  test('en 计分/字段/邻居/消费 — 75 / max(25) / 40 characters / villainHint / villainConf', () => {
    const score = lineOf(en, 'Score:');
    assert.ok(score.includes('1 bad = 75'), '应给单次口径');
    assert.ok(score.includes('max(25'), '应给多次公式');
    const fields = lineOf(en, 'Hit fields:');
    assert.ok(fields.includes('probeLine'), '应列出 probeLine');
    assert.ok(fields.includes('40 characters'), '应说明截断');
    const neigh = lineOf(en, 'Neighbours:');
    assert.ok(neigh.includes('plot-armor'), '应点明 plot-armor');
    assert.ok(neigh.includes('shared_memory'), '应点明 shared_memory');
    const pipe = lineOf(en, 'Pipeline:');
    assert.ok(pipe.includes('villainHint'), '应说明 prePolish hint');
    assert.ok(pipe.includes('villainConf'), '应说明 qcReport 透出');
  });
});
