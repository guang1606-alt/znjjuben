'use strict';
// v2.430 empty-threat 教学函数同源对齐测试
// 锚点紧贴引擎源码：台词叙述都扫 / 威胁套话词表 / 本句后果与后 2 行动手 rescue /
// 一行多短语多条 / 只算未兑现 / 0-1-≥2 计分 / 邻居三分界 / threatHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/empty-threat.js');

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

const zh = mod.buildEmptyThreatDirective ? mod.buildEmptyThreatDirective('LIVE', 'zh') : '';
const en = mod.buildEmptyThreatDirective ? mod.buildEmptyThreatDirective('LIVE', 'en') : '';

describe('zh — buildEmptyThreatDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildEmptyThreatDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('空口威胁'), '标题应点明空口威胁');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildEmptyThreatDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildEmptyThreatDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 台词与叙述都扫，场头跳过并计场次', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('台词'), '应说明台词扫描');
    assert.ok(line.includes('叙述'), '应说明叙述扫描');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('sceneCount'), '应说明场次计数');
  });

  test('威胁套话词表 — 你给我等着 / 走着瞧 / 你会后悔 / 付出代价 / 你完了', () => {
    const line = lineOf(zh, '威胁套话');
    assert.ok(line.includes('你给我等着'), '应列出你给我等着');
    assert.ok(line.includes('走着瞧'), '应列出走着瞧');
    assert.ok(line.includes('你会后悔'), '应列出你会后悔');
    assert.ok(line.includes('付出代价'), '应列出付出代价');
    assert.ok(line.includes('你完了'), '应列出你完了');
    assert.ok(line.includes('好果子吃'), '应列出好果子吃');
    assert.ok(line.includes('迟早'), '应列出迟早');
  });

  test('本句后果 rescue — 具体后果同屏，记 rescued 不扣分', () => {
    const line = lineOf(zh, '本句后果');
    assert.ok(line.includes('现在就'), '应列出现在就');
    assert.ok(line.includes('当场'), '应列出当场');
    assert.ok(line.includes('冻结'), '应列出冻结');
    assert.ok(line.includes('净身出户'), '应列出净身出户');
    assert.ok(line.includes('取消婚礼'), '应列出取消婚礼');
    assert.ok(line.includes('不扣分'), '应说明不扣分');
  });

  test('动手 rescue — 后 2 个非空行内、换场即止的立刻行动', () => {
    const line = lineOf(zh, '动手 rescue');
    assert.ok(line.includes('后 2 个非空行'), '应说明回看距离');
    assert.ok(line.includes('换场即止'), '应说明换场边界');
    assert.ok(line.includes('挥手'), '应列出挥手');
    assert.ok(line.includes('保镖'), '应列出保镖');
    assert.ok(line.includes('耳光'), '应列出耳光');
    assert.ok(line.includes('掏出手机'), '应列出掏出手机');
  });

  test('一行多短语 — 同一行命中多个套话各记一条', () => {
    const line = lineOf(zh, '一行多短语');
    assert.ok(line.includes('多个'), '应说明多短语');
    assert.ok(line.includes('各记一条'), '应说明逐条记录');
    assert.ok(line.includes('hits'), '应说明落在 hits');
  });

  test('只算未兑现 — rescued 命中不进扣分', () => {
    const line = lineOf(zh, '只算未兑现');
    assert.ok(line.includes('rescued'), '应说明 rescued');
    assert.ok(line.includes('不计'), '应说明不参与扣分');
    assert.ok(line.includes('issues'), '应说明 issues 只含未兑现');
  });

  test('得分 — 0 次 100 / 1 次 75 / ≥2 次 max(25, 100 - n × 25)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 75'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 25)'), '应给多次公式');
  });

  test('命中字段 — line / phrase / snippet / rescued / rescueLine / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('phrase'), '应列出 phrase');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('30 字'), '应说明中文截断');
    assert.ok(line.includes('48 字符'), '应说明英文截断');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — villain-threat / confrontation-dodge / antagonist-quality', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('villain-threat'), '应点明跨集威胁账本归属');
    assert.ok(line.includes('confrontation-dodge'), '应点明外部打断归属');
    assert.ok(line.includes('antagonist-quality'), '应点明反派质量归属');
  });

  test('单场判定 — 只在本场找兑现，不跨集不查下一集', () => {
    const line = lineOf(zh, '单场判定');
    assert.ok(line.includes('本场'), '应说明本场范围');
    assert.ok(line.includes('不跨集'), '应说明不跨集');
  });

  test('改写方向 — 当场动手或写死后果与死线', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('当场'), '应给当场动手方向');
    assert.ok(line.includes('死线'), '应给死线方向');
    assert.ok(line.includes('具体后果'), '应给具体后果');
  });

  test('pipeline 消费 threatHint + craft/deai 复扫 + 仅诊断不计加权', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('threatHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('不计加权'), '应点明仅诊断');
  });

  test('成稿自查 — 狠话之后有没有人真的动', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('狠话'), '应给自查对象');
    assert.ok(line.includes('动手'), '应给自查标准');
  });

  test('中英一致 — 台词叙述都扫 / 后 2 行 / 一行多短语 / 30/48 字符', () => {
    const line = lineOf(zh, '中英一致');
    assert.ok(line.includes('台词叙述都扫'), '应给扫描口径');
    assert.ok(line.includes('后 2 行'), '应给 rescue 距离');
    assert.ok(line.includes('一行多短语'), '应给多条口径');
    assert.ok(line.includes('30/48 字符'), '应给截断口径');
  });
});

describe('en — buildEmptyThreatDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('威胁词表与计分口径', () => {
    assert.ok(en.includes('emptyThreat'), '应点明同名检测器');
    assert.ok(en.includes('you will regret this'), '应列出威胁套话');
    assert.ok(en.includes('mark my words'), '应列出 mark my words');
    assert.ok(en.includes('this is not over'), '应列出 this is not over');
    assert.ok(en.includes('1 hit = 75'), '应给单次口径');
    assert.ok(en.includes('max(25, 100 - n x 25)'), '应给多次公式');
  });

  test('rescue 两通道 — 本句后果与后 2 行动手', () => {
    const inline = lineOf(en, 'Inline payoff');
    assert.ok(inline.includes('right now'), '应列出现在就');
    assert.ok(inline.includes('freeze'), '应列出冻结');
    const rescue = lineOf(en, 'Action rescue');
    assert.ok(rescue.includes('next 2 non-empty lines'), '应说明回看距离');
    assert.ok(rescue.includes('stops at the next scene'), '应说明换场即止');
    assert.ok(rescue.includes('guards'), '应列出保镖');
  });

  test('邻居分界与一行多短语', () => {
    const line = lineOf(en, 'Neighbour divisions');
    assert.ok(line.includes('villain-threat'), '应点明跨集账本归属');
    assert.ok(line.includes('confrontation-dodge'), '应点明外部打断归属');
    assert.ok(line.includes('antagonist-quality'), '应点明反派质量归属');
    assert.ok(en.includes('multiple phrase matches'), '应说明一行多短语');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('threatHint'), '应点明提示名');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('craft re-eval'), '应点明 craft 复评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildEmptyThreatDirective('AIGC', 'en'), en);
    assert.equal(mod.buildEmptyThreatDirective(undefined, 'en'), en);
  });
});
