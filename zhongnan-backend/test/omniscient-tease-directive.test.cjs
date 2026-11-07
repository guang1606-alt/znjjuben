'use strict';
// v2.423 omniscient-tease 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / 判定顺序 C→A→B / 强全知框架 / 弱认知 24 字·30 字符 /
// 悬念空词表 / 具体事实豁免 / 章末定调 / 每条 11 分封底 25 / 与 cliffhanger 分界 / teaseHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/omniscient-tease.js');

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

const zh = mod.buildOmniscientTeaseDirective('LIVE', 'zh');
const en = mod.buildOmniscientTeaseDirective('LIVE', 'en');

describe('zh — buildOmniscientTeaseDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildOmniscientTeaseDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('全知预告'), '标题应点明全知预告');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildOmniscientTeaseDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildOmniscientTeaseDirective(undefined, 'zh'), zh);
  });

  test('检测范围与判定顺序 — 只扫叙述行，C→A→B 且一行最多一条', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词跳过');
    assert.ok(line.includes('narrationLines'), '应说明诊断字段');
    const order = lineOf(zh, '判定顺序');
    assert.ok(order.includes('章末定调'), '应说明 C 先判');
    assert.ok(order.includes('强全知框架'), '应说明 A 次序');
    assert.ok(order.includes('弱认知句'), '应说明 B 次序');
    assert.ok(order.includes('每行最多记一条'), '应说明单行只记一条');
  });

  test('A·强全知框架 — 出现即判并记 omniscient', () => {
    const line = lineOf(zh, 'A·强全知框架');
    assert.ok(line.includes('她不知道的是'), '应列出核心框架');
    assert.ok(line.includes('蒙在鼓里'), '应列出蒙在鼓里');
    assert.ok(line.includes('omniscient'), '应给出 kind 名');
    assert.ok(line.includes('little did she know'), '应给出英文示例');
  });

  test('B·弱认知句 — 24 字窗口 / 英文 30 字符', () => {
    const line = lineOf(zh, 'B·弱认知句');
    assert.ok(line.includes('24 字窗口'), '应给出中文窗口');
    assert.ok(line.includes('30 字符'), '应给出英文字符窗口');
    assert.ok(line.includes('she had no idea'), '应给出英文示例');
    assert.ok(line.includes('悬念空词'), '应说明共现条件');
  });

  test('B·悬念空词表 — 风暴/圈套/等着她/万劫不复', () => {
    const line = lineOf(zh, 'B·悬念空词表');
    assert.ok(line.includes('风暴'), '应列出风暴');
    assert.ok(line.includes('圈套'), '应列出圈套');
    assert.ok(line.includes('等着她'), '应列出等着她');
    assert.ok(line.includes('万劫不复'), '应列出万劫不复');
  });

  test('B·具体事实豁免 — 接具体事实不算预告', () => {
    const line = lineOf(zh, 'B·具体事实豁免');
    assert.ok(line.includes('母亲会来'), '应给可拍事实示例');
    assert.ok(line.includes('密码是错的'), '应给可拍事实示例');
    assert.ok(line.includes('事后反应'), '应说明豁免依据');
  });

  test('C·章末定调 — 命运的齿轮记 tail', () => {
    const line = lineOf(zh, 'C·章末定调');
    assert.ok(line.includes('命运的齿轮'), '应列出命运的齿轮');
    assert.ok(line.includes('这只是个开始'), '应列出这只是个开始');
    assert.ok(line.includes('tail'), '应给出 kind 名');
    assert.ok(line.includes('wheels of fate'), '应给出英文示例');
  });

  test('命中字段 — line / kind / phrase / snippet / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('phrase'), '应列出 phrase');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('得分公式 — max(25, 100 - 命中条数 × 11)，空稿 100', () => {
    const line = lineOf(zh, '得分');
    assert.ok(line.includes('max(25, 100 - 命中条数 × 11)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('改写方向 — 未来时改成正在进行时', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('正在进行时'), '应说明时态替换');
    assert.ok(line.includes('被藏起来的手'), '应给可拍动作示例');
    assert.ok(line.includes('门铃打断'), '应给可拍动作示例');
  });

  test('与 cliffhanger/punchline 分界 — 装置类型词 vs 越权写法', () => {
    const line = lineOf(zh, '分界');
    assert.ok(line.includes('反转装置类型词'), '应说明邻居口径');
    assert.ok(line.includes('叙述者越权'), '应说明本引擎口径');
    assert.ok(line.includes('维度不同'), '应说明维度差异');
  });

  test('pipeline 消费 teaseHint + deai 0.01 权重', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('teaseHint'), '应点明提示名');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('0.01'), '应点明 deai 权重');
  });

  test('成稿自查 — 镜头此刻拍得到吗', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('镜头此刻拍得到吗'), '应给可拍性自查');
    assert.ok(line.includes('现在就能看见的未解动作'), '应给替代方向');
  });

  test('A 词表覆盖 — 她哪里知道 / 浑然不知 / 一无所知 / 此刻的她', () => {
    const line = lineOf(zh, 'A·强全知框架');
    assert.ok(line.includes('她哪里知道'), '应列出她哪里知道');
    assert.ok(line.includes('浑然不知'), '应列出浑然不知');
    assert.ok(line.includes('一无所知'), '应列出一无所知');
    assert.ok(line.includes('此刻的她'), '应列出此刻的她');
  });

  test('C 词表覆盖 — 故事才刚刚开始 / 暴风雨即将来临', () => {
    const line = lineOf(zh, 'C·章末定调');
    assert.ok(line.includes('故事才刚刚开始'), '应列出故事才刚刚开始');
    assert.ok(line.includes('暴风雨即将来临'), '应列出暴风雨即将来临');
    assert.ok(line.includes('what awaited her'), '应列出 what awaited her');
    assert.ok(line.includes('everything was about to change'), '应列出 everything was about to change');
  });
});

describe('en — buildOmniscientTeaseDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('检测器与扣分口径', () => {
    assert.ok(en.includes('omniscientTease'), '应点明同名检测器');
    assert.ok(en.includes('11 points per hit'), '应说明每条 11 分');
  });

  test('得分公式 — max(25, 100 - hits x 11)', () => {
    assert.ok(en.includes('max(25, 100 - hits x 11)'), '公式应一致');
    assert.ok(en.includes('empty draft = 100'), '空稿应为满分');
  });

  test('范围与判定 — 两类 kind / 30 字符窗口 / 事实豁免', () => {
    assert.ok(en.includes('kind omniscient'), '应点明 omniscient');
    assert.ok(en.includes('kind tail'), '应点明 tail');
    assert.ok(en.includes('within 30 characters'), '应给弱认知窗口');
    assert.ok(en.includes('suspense word'), '应说明共现条件');
    assert.ok(en.includes('concrete-fact exemption'), '应说明事实豁免');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('teaseHint'), '应点明提示名');
    assert.equal(mod.buildOmniscientTeaseDirective('AIGC', 'en'), en);
    assert.equal(mod.buildOmniscientTeaseDirective(undefined, 'en'), en);
  });
});
