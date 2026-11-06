'use strict';
// v2.412 info-delivery 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 三要素同现 / 渠道三类 / 投递标记 / 事件词 /
// 窗口 zh 34 en 120 / 主动取证豁免 / 物件-纸人-群体-电话四重分工 / 25 分封底

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/info-delivery.js');

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

const zh = mod.buildInfoDeliveryDirective('LIVE', 'zh');
const en = mod.buildInfoDeliveryDirective('LIVE', 'en');

describe('zh — buildInfoDeliveryDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildInfoDeliveryDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('被动信息投喂'), '标题应点明被动信息投喂');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildInfoDeliveryDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildInfoDeliveryDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫叙述行，1-4 字说话人算台词', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('只扫叙述行'), '应说明只扫叙述行');
    assert.ok(line.includes('1-4 字'), '应给出台词行说话人字限');
  });

  test('三要素必须同现 — 缺一不判', () => {
    assert.ok(zh.includes('三要素'), '应点明三要素');
    assert.ok(zh.includes('缺一不判'), '应说明缺一不判');
    assert.ok(zh.includes('渠道') && zh.includes('投递标记') && zh.includes('事件词'), '三要素应齐全');
  });

  test('渠道三类 — 装置 / 广播 / 他人来报', () => {
    assert.ok(zh.includes('手机'), '应列出手机类渠道');
    assert.ok(zh.includes('新闻'), '应列出新闻广播渠道');
    assert.ok(zh.includes('汇报'), '应列出他人来报渠道');
  });

  test('内容投递标记词表', () => {
    const line = lineOf(zh, '内容投递标记');
    assert.ok(line.includes('写着'), '应列出写着');
    assert.ok(line.includes('播报'), '应列出播报');
    assert.ok(line.includes('发来'), '应列出发来');
  });

  test('剧情事件词表 — 只投事件不投寒暄', () => {
    const line = lineOf(zh, '剧情事件词');
    assert.ok(line.includes('病危'), '应列出病危');
    assert.ok(line.includes('合同'), '应列出合同');
    assert.ok(line.includes('亲子鉴定'), '应列出亲子鉴定');
  });

  test('窗口口径 — 中文命中点前 8 字到后 34 字', () => {
    const line = lineOf(zh, '中文渠道命中点');
    assert.ok(line.includes('前 8 字'), '应说明前 8 字');
    assert.ok(line.includes('34 字'), '应给出中文窗口 34');
  });

  test('窗口口径 — 英文 120 字符', () => {
    assert.ok(zh.includes('120 字符'), '应给出英文窗口 120');
  });

  test('主动取证豁免 — 信息是抢来的不算', () => {
    const line = lineOf(zh, '主动取证');
    assert.ok(line.includes('抢过'), '应列出抢过');
    assert.ok(line.includes('设局'), '应列出设局');
    assert.ok(line.includes('不算投喂'), '应说明豁免结论');
  });

  test('物件豁免 — 未接来电归 cliffhanger', () => {
    const line = lineOf(zh, '只给物件');
    assert.ok(line.includes('未接来电'), '应举未接来电');
    assert.ok(line.includes('cliffhanger'), '应说明归 cliffhanger');
  });

  test('纸片人豁免 — 当面送情报归 supporting-character', () => {
    const line = lineOf(zh, '纸片人');
    assert.ok(line.includes('supporting-character'), '应说明归 supporting-character');
  });

  test('群体转述归 crowd-reaction', () => {
    const line = lineOf(zh, '群体');
    assert.ok(line.includes('crowd-reaction'), '应说明归 crowd-reaction');
  });

  test('单边电话复读归 phone-relay，本引擎不判台词', () => {
    const line = lineOf(zh, '单边电话');
    assert.ok(line.includes('phone-relay'), '应说明归 phone-relay');
  });

  test('与空心动作分界 — 整行调度 vs 渠道送礼', () => {
    const line = lineOf(zh, '空心');
    assert.ok(line.includes('hollow-action'), '应点明 hollow-action 分工');
    assert.ok(line.includes('整行只有'), '应说明本引擎不判整行调度');
  });

  test('得分公式 — max(25, 100 - 命中条数 × 11)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(25, 100 - 命中条数 × 11)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('pipeline 消费 deliveryHint + 成稿自查', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('deliveryHint'), '应点明注入的提示名');
    assert.ok(zh.includes('还是等来的'), '应给出成稿自查问句');
  });
});

describe('en — buildInfoDeliveryDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('三要素英文齐全', () => {
    assert.ok(en.includes('channel'), '应含 channel');
    assert.ok(en.includes('content marker'), '应含 content marker');
    assert.ok(en.includes('event word'), '应含 event word');
  });

  test('窗口 — 8 before，34/120 after', () => {
    assert.ok(en.includes('8 chars before'), '应说明前 8 字符');
    assert.ok(en.includes('34 chars after'), '应给出 34');
    assert.ok(en.includes('120'), '应给出英文窗口 120');
  });

  test('得分 — max(25, 100 - hits x 11)', () => {
    assert.ok(en.includes('max(25, 100 - hits x 11)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('deliveryHint'), '应点明提示名');
    assert.equal(mod.buildInfoDeliveryDirective('AIGC', 'en'), en);
    assert.equal(mod.buildInfoDeliveryDirective(undefined, 'en'), en);
  });
});
