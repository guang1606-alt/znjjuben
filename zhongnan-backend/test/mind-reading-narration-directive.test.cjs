'use strict';
// v2.420 mind-reading-narration 教学函数同源对齐测试
// 锚点紧贴引擎源码：非台词叙述行 / 显性内独豁免 / 问句豁免 / 第三人称认知框架 + 抽象结论词 /
// 人称豁免 / 数字·引语·冒号豁免 / 每条 9 分封底 20 / 与 show-dont-tell·subtext-erase·cheat-rule-check 分工

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/mind-reading-narration.js');

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

const zh = mod.buildMindReadingNarrationDirective('LIVE', 'zh');
const en = mod.buildMindReadingNarrationDirective('LIVE', 'en');

describe('zh — buildMindReadingNarrationDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildMindReadingNarrationDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('叙述者读心'), '标题应点明叙述者读心');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildMindReadingNarrationDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildMindReadingNarrationDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫非台词叙述行，场头与台词跳过', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('叙述行'), '应说明只扫叙述行');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
  });

  test('豁免一 — 显性内心独白归 show-dont-tell', () => {
    const line = lineOf(zh, '豁免一');
    assert.ok(line.includes('心想'), '应列出心想');
    assert.ok(line.includes('嘀咕'), '应列出嘀咕');
    assert.ok(line.includes('show-dont-tell'), '应点明归属');
  });

  test('豁免二 — 问号结尾不判', () => {
    const line = lineOf(zh, '豁免二');
    assert.ok(line.includes('问号'), '应说明问句豁免');
  });

  test('口径一 — 第三人称主语 + 认知动词框架', () => {
    const line = lineOf(zh, '口径一');
    assert.ok(line.includes('第三人称'), '应说明第三人称');
    assert.ok(line.includes('认知动词'), '应说明认知动词');
    assert.ok(line.includes('这才'), '应列出时间副词');
    assert.ok(line.includes('意识到'), '应列出意识到');
  });

  test('口径二 — 抽象结论词表', () => {
    const line = lineOf(zh, '口径二');
    assert.ok(line.includes('永远'), '应列出永远');
    assert.ok(line.includes('没有退路'), '应列出没有退路');
    assert.ok(line.includes('一辈子'), '应列出一辈子');
  });

  test('人称豁免 — 我/你/咱开头是画外音不判', () => {
    const line = lineOf(zh, '人称豁免');
    assert.ok(line.includes('我/你/咱'), '应列出一二人称');
    assert.ok(line.includes('画外音'), '应说明画外音');
  });

  test('可验证事实豁免 — 数字 / 引号引语 / 冒号', () => {
    const line = lineOf(zh, '可验证事实豁免');
    assert.ok(line.includes('数字'), '应列出数字');
    assert.ok(line.includes('引号'), '应列出引号引语');
    assert.ok(line.includes('冒号'), '应列出冒号');
  });

  test('命中字段 — line / verb / snippet / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('verb'), '应列出 verb');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('得分公式 — max(20, 100 - 命中条数 × 9)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(20, 100 - 命中条数 × 9)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 具体选择 / 露馅动作 / 对别人说的话', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('签字'), '应给具体选择示例');
    assert.ok(line.includes('手抖'), '应给露馅动作示例');
    assert.ok(line.includes('对别人说的一句话'), '应给台词外化');
  });

  test('与 show-dont-tell 分界 — 它管显性标记，本引擎管自由间接引语', () => {
    const line = lineOf(zh, '与 show-dont-tell 分界');
    assert.ok(line.includes('显性标记'), '应说明它管标记词');
    assert.ok(line.includes('自由间接引语'), '应说明本引擎口径');
  });

  test('与 subtext-erase 分界 — 它必须紧邻台词', () => {
    const line = lineOf(zh, '与 subtext-erase 分界');
    assert.ok(line.includes('紧邻台词'), '应说明它需要台词锚点');
    assert.ok(line.includes('不需要对白锚点'), '应说明本引擎无锚点');
  });

  test('与 cheat-rule-check 分界 — 它查金手指规则', () => {
    const line = lineOf(zh, '与 cheat-rule-check 分界');
    assert.ok(line.includes('金手指'), '应说明它管金手指');
    assert.ok(line.includes('叙述技法'), '应说明本引擎管技法');
  });

  test('pipeline 消费 mindHint + 成稿自查镜头拍得出吗', () => {
    const p = lineOf(zh, 'pipeline 消费');
    assert.ok(p.includes('prePolish'), '应点明 prePolish');
    assert.ok(p.includes('mindHint'), '应点明提示名');
    assert.ok(p.includes('deai'), '应点明 deai 复扫');
    const c = lineOf(zh, '成稿自查');
    assert.ok(c.includes('镜头拍得出来吗'), '应给可拍性自查');
  });
});

describe('en — buildMindReadingNarrationDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('mindReadingNarration'), '应点明同名检测器');
    assert.ok(en.includes('9 points per hit'), '应说明每条 9 分');
  });

  test('得分公式 — max(20, 100 - hits x 9)', () => {
    assert.ok(en.includes('max(20, 100 - hits x 9)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与豁免 — 第三人称 + 认知动词 + 抽象结论 + 人称/事实豁免', () => {
    assert.ok(en.includes('third person subject'), '应说明第三人称');
    assert.ok(en.includes('cognitive verb'), '应说明认知动词');
    assert.ok(en.includes('made up his mind'), '应列出认知动词示例');
    assert.ok(en.includes('abstract verdict word'), '应说明抽象结论词');
    assert.ok(en.includes('no way out'), '应列出结论词示例');
    assert.ok(en.includes('first or second person'), '应说明人称豁免');
    assert.ok(en.includes('Verifiable-fact exemption'), '应说明可验证事实豁免');
    assert.ok(en.includes('subtext-erase'), '应点明邻居分界');
    assert.ok(en.includes('cheat-rule-check'), '应点明邻居分界');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('mindHint'), '应点明提示名');
    assert.equal(mod.buildMindReadingNarrationDirective('AIGC', 'en'), en);
    assert.equal(mod.buildMindReadingNarrationDirective(undefined, 'en'), en);
  });
});
