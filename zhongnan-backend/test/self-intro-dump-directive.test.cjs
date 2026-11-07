'use strict';
// v2.428 self-intro-dump 教学函数同源对齐测试
// 锚点紧贴引擎源码：姓名×年龄×身份三要素 / 相邻两行打包 / 问号与话者边界 /
// 登记问诊豁免（前 2 行）/ 0-1-≥2 计分 / 一次检定 / 邻居三重分界 / introHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/self-intro-dump.js');

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

const zh = mod.buildSelfIntroDumpDirective ? mod.buildSelfIntroDumpDirective('LIVE', 'zh') : '';
const en = mod.buildSelfIntroDumpDirective ? mod.buildSelfIntroDumpDirective('LIVE', 'en') : '';

describe('zh — buildSelfIntroDumpDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildSelfIntroDumpDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('简历式自我介绍'), '标题应点明简历式自我介绍');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildSelfIntroDumpDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSelfIntroDumpDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 非空行参与，场头跳过，台词同样扫描，不限开场', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('非空行'), '应说明扫描范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词同样扫描');
    assert.ok(line.includes('不限开场'), '应说明全片扫描');
  });

  test('三要素·姓名 — 我叫/我姓/这位是/名片式', () => {
    const line = lineOf(zh, '三要素·姓名');
    assert.ok(line.includes('我叫'), '应列出我叫');
    assert.ok(line.includes('我姓'), '应列出我姓');
    assert.ok(line.includes('这位是'), '应列出这位是');
    assert.ok(line.includes('名片式'), '应说明名片式开场');
  });

  test('三要素·年龄 — 今年/现年/年仅 + N 岁', () => {
    const line = lineOf(zh, '三要素·年龄');
    assert.ok(line.includes('今年'), '应列出今年');
    assert.ok(line.includes('现年'), '应列出现年');
    assert.ok(line.includes('年仅'), '应列出年仅');
    assert.ok(line.includes('N 岁'), '应给岁数格式');
  });

  test('三要素·身份 — 判断动词 + 职业头衔', () => {
    const line = lineOf(zh, '三要素·身份');
    assert.ok(line.includes('是/身为/担任'), '应列出判断动词');
    assert.ok(line.includes('总裁'), '应列出总裁');
    assert.ok(line.includes('助理'), '应列出助理');
    assert.ok(line.includes('千金'), '应列出千金');
  });

  test('跨行打包 — 相邻两行、问号结尾不跨、话者前缀不跨', () => {
    const line = lineOf(zh, '跨行打包');
    assert.ok(line.includes('相邻两行'), '应说明打包距离');
    assert.ok(line.includes('问号结尾'), '应说明提问行不跨');
    assert.ok(line.includes('话者前缀'), '应说明台词边界');
    assert.ok(line.includes('不跨场'), '应说明场头边界');
  });

  test('豁免·登记问答 — 前 2 行内出现问句或冒号结尾', () => {
    const line = lineOf(zh, '豁免·登记问答');
    assert.ok(line.includes('前 2 行'), '应说明回看距离');
    assert.ok(line.includes('问号'), '应说明问句');
    assert.ok(line.includes('冒号'), '应说明冒号结尾');
    assert.ok(line.includes('分字段'), '应说明真实登记场景');
  });

  test('得分 — 0 次 100 / 1 次 75 / ≥2 次 max(25, 100 - n × 25)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次 100'), '应给全清口径');
    assert.ok(line.includes('1 次 75'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 25)'), '应给多次公式');
  });

  test('命中字段 — line / snippet（30 字）/ elements / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('30 字'), '应说明截断长度');
    assert.ok(line.includes('elements'), '应列出 elements');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — exposition-dialogue / info-delivery / show-dont-tell', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('exposition-dialogue'), '应点明已知信息台词归属');
    assert.ok(line.includes('info-delivery'), '应点明外部渠道归属');
    assert.ok(line.includes('show-dont-tell'), '应点明情绪直述归属');
  });

  test('改写方向 — 删履历包，靠工牌/前台呼喊/麻烦带出身份', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('删掉履历包'), '应给保留原则');
    assert.ok(line.includes('工牌'), '应给名字来源');
    assert.ok(line.includes('前台'), '应给呼喊来源');
    assert.ok(line.includes('麻烦'), '应给身份来源');
  });

  test('一次检定 — 相邻两行只记一次，second line 不再重复', () => {
    const line = lineOf(zh, '一次检定');
    assert.ok(line.includes('相邻两行'), '应说明打包范围');
    assert.ok(line.includes('只记一次'), '应说明不重复');
    assert.ok(line.includes('consumed'), '应说明消费标记');
  });

  test('pipeline 消费 introHint + craft/deai 复扫 + 0.01 退役', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('introHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('0.01'), '应点明加权退役');
  });

  test('成稿自查 — 名字与身份是不是挣来的', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('名片'), '应给自查比喻');
    assert.ok(line.includes('麻烦'), '应给身份来源');
  });

  test('中英一致 — 30/48 字符、相邻两行、前 2 行豁免', () => {
    const line = lineOf(zh, '中英一致');
    assert.ok(line.includes('30/48 字符'), '应给截断口径');
    assert.ok(line.includes('相邻两行'), '应给打包口径');
    assert.ok(line.includes('前 2 行'), '应给豁免口径');
  });
});

describe('en — buildSelfIntroDumpDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('三要素与计分口径', () => {
    assert.ok(en.includes('selfIntroDump'), '应点明同名检测器');
    assert.ok(en.includes('name'), '应列出 name');
    assert.ok(en.includes('age'), '应列出 age');
    assert.ok(en.includes('identity'), '应列出 identity');
    assert.ok(en.includes('1 hit = 75'), '应给单次口径');
    assert.ok(en.includes('max(25, 100 - n x 25)'), '应给多次公式');
  });

  test('跨行打包与豁免', () => {
    assert.ok(en.includes('two adjacent lines'), '应说明打包距离');
    assert.ok(en.includes('question mark'), '应说明提问行不跨');
    assert.ok(en.includes('speaker prefix'), '应说明台词边界');
    const exempt = lineOf(en, 'Official-question exemption');
    assert.ok(exempt.includes('previous 2 lines'), '应说明豁免回看距离');
    assert.ok(exempt.includes('official question'), '应说明真实登记场景');
  });

  test('邻居分界与改写方向', () => {
    assert.ok(en.includes('exposition-dialogue'), '应点明已知信息台词归属');
    assert.ok(en.includes('info-delivery'), '应点明外部渠道归属');
    assert.ok(en.includes('show-dont-tell'), '应点明情绪直述归属');
    assert.ok(en.includes('badge'), '应给名字来源');
    assert.ok(en.includes('live trouble'), '应给身份来源');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('introHint'), '应点明提示名');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildSelfIntroDumpDirective('AIGC', 'en'), en);
    assert.equal(mod.buildSelfIntroDumpDirective(undefined, 'en'), en);
  });
});
