'use strict';
// v2.427 confrontation-dodge 教学函数同源对齐测试
// 锚点紧贴引擎源码：即将爆发×打断信号同行/下一非空行共现 / 集尾钩子豁免 /
// rescue 6 行内不跨场捡回 / 0-1-≥2 三段计分 / 一场一次 / 邻居三重分界 / dodgeHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/confrontation-dodge.js');

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

const zh = mod.buildConfrontationDodgeDirective ? mod.buildConfrontationDodgeDirective('LIVE', 'zh') : '';
const en = mod.buildConfrontationDodgeDirective ? mod.buildConfrontationDodgeDirective('LIVE', 'en') : '';

describe('zh — buildConfrontationDodgeDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildConfrontationDodgeDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('打断逃场'), '标题应点明打断逃场');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildConfrontationDodgeDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildConfrontationDodgeDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 非空行参与，场头计场景数，台词同样扫描', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('非空行'), '应说明扫描范围');
    assert.ok(line.includes('场头'), '应说明场头计场景数');
    assert.ok(line.includes('台词'), '应说明台词同样扫描');
    assert.ok(line.includes('sceneCount'), '应说明诊断字段');
  });

  test('触发·即将爆发 — 刚要说/话到嘴边/正要摊牌', () => {
    const line = lineOf(zh, '触发·即将爆发');
    assert.ok(line.includes('刚要说'), '应列出刚要说');
    assert.ok(line.includes('话到嘴边'), '应列出话到嘴边');
    assert.ok(line.includes('正要摊牌'), '应列出正要摊牌');
    assert.ok(line.includes('差点说出口'), '应列出差点说出口');
  });

  test('触发·打断信号 — 敲门/门铃/电话响/闯入', () => {
    const line = lineOf(zh, '触发·打断信号');
    assert.ok(line.includes('敲门'), '应列出敲门');
    assert.ok(line.includes('门铃'), '应列出门铃');
    assert.ok(line.includes('电话'), '应列出电话');
    assert.ok(line.includes('闯入'), '应列出闯入');
    assert.ok(line.includes('被打断'), '应列出被打断');
  });

  test('判定距离 — 同行或下一非空行，不跨场', () => {
    const line = lineOf(zh, '判定距离');
    assert.ok(line.includes('同行'), '应说明同行判定');
    assert.ok(line.includes('下一非空行'), '应说明下一非空行');
    assert.ok(line.includes('不跨场'), '应说明不跨场');
  });

  test('rescue 豁免 — 打断后 6 行内、换场前把对话捡回来', () => {
    const line = lineOf(zh, 'rescue 豁免');
    assert.ok(line.includes('6 行内'), '应说明邻域范围');
    assert.ok(line.includes('换场之前'), '应说明换场清空');
    assert.ok(line.includes('rescued'), '应说明豁免标记');
    assert.ok(line.includes('不扣分'), '应说明不扣分');
  });

  test('rescue 词表 — 继续质问/接着说/不依不饶', () => {
    const line = lineOf(zh, 'rescue 词表');
    assert.ok(line.includes('继续质问'), '应列出继续质问');
    assert.ok(line.includes('接着说'), '应列出接着说');
    assert.ok(line.includes('不依不饶'), '应列出不依不饶');
    assert.ok(line.includes('回到正题'), '应列出回到正题');
  });

  test('集尾豁免 — 打断即全稿最后一拍归 cliffhanger', () => {
    const line = lineOf(zh, '集尾豁免');
    assert.ok(line.includes('最后一拍'), '应说明集尾判定');
    assert.ok(line.includes('cliffhanger'), '应说明归属');
    assert.ok(line.includes('不判'), '应说明不扣分');
  });

  test('得分 — 0 次 100 / 1 次 70 / ≥2 次 max(25, 100-(n-1)×30)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 70'), '应给单次提醒口径');
    assert.ok(line.includes('max(25, 100 - (n - 1) × 30)'), '应给结构性逃场公式');
  });

  test('命中字段 — line / imminent / interrupt / snippet / rescued / rescueLine / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('imminent'), '应列出 imminent');
    assert.ok(line.includes('interrupt'), '应列出 interrupt');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — plot-armor / misunderstanding-drag / cliffhanger', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('plot-armor'), '应点明对手给窗口归属');
    assert.ok(line.includes('misunderstanding-drag'), '应点明拒听离场归属');
    assert.ok(line.includes('cliffhanger'), '应点明集尾钩子归属');
  });

  test('改写方向 — 顶回去或新情报当场升级', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('顶回去'), '应给第一方向');
    assert.ok(line.includes('升级'), '应给第二方向');
    assert.ok(line.includes('不能替人物喊停'), '应给禁令');
  });

  test('一场一次 — 真留白只准一次且本场捡回', () => {
    const line = lineOf(zh, '一场一次');
    assert.ok(line.includes('一场只准用一次'), '应给频次上限');
    assert.ok(line.includes('捡回来'), '应给回收要求');
  });

  test('pipeline 消费 dodgeHint + craft/deai 复扫 + 0.01 退役', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('dodgeHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('0.01'), '应点明加权退役');
  });

  test('成稿自查 与 中英一致', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('当场打满'), '应给自查问题');
    assert.ok(line.includes('添柴'), '应给替代方向');
    const parity = lineOf(zh, '中英一致');
    assert.ok(parity.includes('6 行'), '应给 rescue 邻域口径');
    assert.ok(parity.includes('30 字符'), '应给 snippet 口径');
    assert.ok(parity.includes('集尾'), '应给集尾豁免口径');
  });
});

describe('en — buildConfrontationDodgeDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与计分口径', () => {
    assert.ok(en.includes('confrontationDodge'), '应点明同名检测器');
    assert.ok(en.includes('dodgeHint'), '应点明提示名');
    assert.ok(en.includes('1 hit = 70'), '应给单次提醒口径');
    assert.ok(en.includes('max(25, 100 - (n - 1) x 30)'), '应给结构性逃场公式');
  });

  test('判定距离与集尾豁免', () => {
    assert.ok(en.includes('same line or the next non-empty line'), '应说明共现距离');
    assert.ok(en.includes('does not cross a scene'), '应说明不跨场');
    assert.ok(en.includes('last beat of the whole script'), '应说明集尾豁免');
    assert.ok(en.includes('cliffhanger'), '应说明归属');
  });

  test('rescue 6 行与邻居分界', () => {
    assert.ok(en.includes('within the next 6 lines'), '应给邻域范围');
    assert.ok(en.includes('rescued'), '应点明豁免标记');
    assert.ok(en.includes('plot-armor'), '应点明对手给窗口归属');
    assert.ok(en.includes('misunderstanding-drag'), '应点明拒听离场归属');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('craft re-eval'), '应点明 craft 复评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildConfrontationDodgeDirective('AIGC', 'en'), en);
    assert.equal(mod.buildConfrontationDodgeDirective(undefined, 'en'), en);
  });
});
