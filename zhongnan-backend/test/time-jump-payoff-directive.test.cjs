'use strict';
// v2.431 time-jump-payoff 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫含跳转词的行 + 裸跳转次行首句 / 同句共现 / 一行一次 /
// 纯转场与无跳转结果不判 / 0-1-≥2 计分 / 邻居两分界 / jumpHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/time-jump-payoff.js');

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

const zh = mod.buildTimeJumpPayoffDirective ? mod.buildTimeJumpPayoffDirective('LIVE', 'zh') : '';
const en = mod.buildTimeJumpPayoffDirective ? mod.buildTimeJumpPayoffDirective('LIVE', 'en') : '';

describe('zh — buildTimeJumpPayoffDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildTimeJumpPayoffDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('时间跳转兑付'), '标题应点明时间跳转兑付');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildTimeJumpPayoffDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildTimeJumpPayoffDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫含跳转词的行，或裸跳转行的下一非空行首句', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('跳转词'), '应说明跳转词行');
    assert.ok(line.includes('裸跳转'), '应说明裸跳转行');
    assert.ok(line.includes('下一非空行'), '应说明次行首句');
  });

  test('跳转词表 — N 天后 / 次日 / 翌日 / 第二天 / 多年后 / 不知过了多久', () => {
    const line = lineOf(zh, '跳转词：');
    assert.ok(line.includes('天后'), '应列出 N 天后');
    assert.ok(line.includes('次日'), '应列出次日');
    assert.ok(line.includes('翌日'), '应列出翌日');
    assert.ok(line.includes('第二天'), '应列出第二天');
    assert.ok(line.includes('多年后'), '应列出多年后');
    assert.ok(line.includes('不知过了多久'), '应列出不知过了多久');
  });

  test('兑付词表 — 签好 / 撤诉 / 答应 / 原谅 / 复合 / 上市 / 破产 / 易主 / 去世', () => {
    const line = lineOf(zh, '兑付词');
    assert.ok(line.includes('签好'), '应列出签好');
    assert.ok(line.includes('撤诉'), '应列出撤诉');
    assert.ok(line.includes('答应'), '应列出答应');
    assert.ok(line.includes('原谅'), '应列出原谅');
    assert.ok(line.includes('复合'), '应列出复合');
    assert.ok(line.includes('上市'), '应列出上市');
    assert.ok(line.includes('破产'), '应列出破产');
    assert.ok(line.includes('易主'), '应列出易主');
    assert.ok(line.includes('去世'), '应列出去世');
  });

  test('同句共现 — 按句切分，一句内既跳又兑付，一行只记一次', () => {
    const line = lineOf(zh, '同句共现');
    assert.ok(line.includes('按句切分'), '应说明按句切分');
    assert.ok(line.includes('一句内'), '应说明一句内共现');
    assert.ok(line.includes('一行只记一次'), '应说明一行一次');
  });

  test('裸跳转通道 — 整行只有时间词，下一非空行句首 60 字内命中兑付', () => {
    const line = lineOf(zh, '裸跳转通道');
    assert.ok(line.includes('只有时间词'), '应说明裸跳转行');
    assert.ok(line.includes('句首'), '应说明首句窗口');
    assert.ok(line.includes('60 字'), '应说明窗口长度');
  });

  test('纯转场不判 — 三年后她推门走进会议室只换场', () => {
    const line = lineOf(zh, '纯转场');
    assert.ok(line.includes('推门走进会议室'), '应给转场反例');
    assert.ok(line.includes('不判'), '应说明不判');
  });

  test('无跳转结果不判 — 她当场签下协议没有时间词', () => {
    const line = lineOf(zh, '无跳转结果');
    assert.ok(line.includes('当场签下协议'), '应给无跳转反例');
    assert.ok(line.includes('不判'), '应说明不判');
  });

  test('邻居分界 — effort-gloss / timeline-consistency 的 time_skip_stuffing', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('effort-gloss'), '应点明努力蒙太奇归属');
    assert.ok(line.includes('timeline-consistency'), '应点明时间线归属');
    assert.ok(line.includes('time_skip_stuffing'), '应点明裸跳转堆积归属');
  });

  test('命中字段 — line / jump / payoff / snippet / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('jump'), '应列出 jump');
    assert.ok(line.includes('payoff'), '应列出 payoff');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('32 字'), '应说明截断长度');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('得分 — 0 次 100 / 1 次 75 / ≥2 次 max(25, 100 - n × 25)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 75'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 25)'), '应给多次公式');
  });

  test('改写方向 — 把签字/决裂/翻盘那一场正面写出来', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('签字'), '应给签字场景');
    assert.ok(line.includes('决裂'), '应给决裂场景');
    assert.ok(line.includes('翻盘'), '应给翻盘场景');
    assert.ok(line.includes('正面写'), '应说明正面展开');
  });

  test('pipeline 消费 jumpHint + deai 0.01 加权 v2.98 退役', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('jumpHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('v2.98'), '应点明加权退役版本');
    assert.ok(line.includes('退役'), '应说明加权已退役');
  });

  test('成稿自查 — 跳转后第一拍是不是人物在做事', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('跳转后'), '应给自查时点');
    assert.ok(line.includes('人物在做事'), '应给自查标准');
  });

  test('中英一致 — 同句共现 / 裸跳转次行 / 32 字符 / 一行一次', () => {
    const line = lineOf(zh, '中英一致');
    assert.ok(line.includes('同句共现'), '应给共现口径');
    assert.ok(line.includes('裸跳转次行'), '应给裸跳转口径');
    assert.ok(line.includes('32 字符'), '应给截断口径');
    assert.ok(line.includes('一行一次'), '应给一行一次');
  });
});

describe('en — buildTimeJumpPayoffDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('词表与计分口径', () => {
    assert.ok(en.includes('timeJumpPayoff'), '应点明同名检测器');
    assert.ok(en.includes('three days later'), '应列出跳转词');
    assert.ok(en.includes('the next morning'), '应列出次日');
    assert.ok(en.includes('went public'), '应列出兑付词');
    assert.ok(en.includes('1 hit = 75'), '应给单次口径');
    assert.ok(en.includes('max(25, 100 - n x 25)'), '应给多次公式');
  });

  test('同句共现与裸跳转通道', () => {
    const line = lineOf(en, 'Same-clause co-occurrence');
    assert.ok(line.includes('clause'), '应说明按句切分');
    assert.ok(line.includes('one hit per line'), '应说明一行一次');
    const bare = lineOf(en, 'Bare jump');
    assert.ok(bare.includes('next non-empty line'), '应说明次行');
    assert.ok(bare.includes('60 characters'), '应说明窗口长度');
  });

  test('纯转场与无跳转结果不判 + 邻居分界', () => {
    const scene = lineOf(en, 'Scene entry only');
    assert.ok(scene.includes('not judged'), '应说明纯转场不判');
    const noJump = lineOf(en, 'No-jump result');
    assert.ok(noJump.includes('no time phrase'), '应说明无跳转不判');
    const nbr = lineOf(en, 'Neighbour divisions');
    assert.ok(nbr.includes('effort-gloss'), '应点明努力蒙太奇归属');
    assert.ok(nbr.includes('time_skip_stuffing'), '应点明裸跳转堆积归属');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('jumpHint'), '应点明提示名');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('craft re-eval'), '应点明 craft 复评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.ok(en.includes('v2.98'), '应点明加权退役版本');
    assert.equal(mod.buildTimeJumpPayoffDirective('AIGC', 'en'), en);
    assert.equal(mod.buildTimeJumpPayoffDirective(undefined, 'en'), en);
  });
});
