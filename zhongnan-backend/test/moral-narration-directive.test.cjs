'use strict';
// v2.429 moral-narration 教学函数同源对齐测试
// 锚点紧贴引擎源码：只扫叙述行 / A 领悟宣告 + B 格言起句 / 一行一次 /
// rescue 后 2 个非空行 / 0-1-≥2 计分（只算未兑现）/ 邻居四重分界 / moralHint 消费

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/moral-narration.js');

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

const zh = mod.buildMoralNarrationDirective ? mod.buildMoralNarrationDirective('LIVE', 'zh') : '';
const en = mod.buildMoralNarrationDirective ? mod.buildMoralNarrationDirective('LIVE', 'en') : '';

describe('zh — buildMoralNarrationDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildMoralNarrationDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('道理升华旁白'), '标题应点明道理升华旁白');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildMoralNarrationDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildMoralNarrationDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 非空行参与，场头跳过，台词与引号起句整行跳过', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('非空行'), '应说明扫描范围');
    assert.ok(line.includes('场头'), '应说明场头跳过');
    assert.ok(line.includes('台词'), '应说明台词整行跳过');
    assert.ok(line.includes('引号'), '应说明引号起句跳过');
    assert.ok(line.includes('narrationLines'), '应说明叙述行计数');
  });

  test('判定 A·领悟宣告 — 领悟动词 + 抽象道理名词同屏', () => {
    const line = lineOf(zh, '判定 A');
    assert.ok(line.includes('明白'), '应列出明白');
    assert.ok(line.includes('懂得'), '应列出懂得');
    assert.ok(line.includes('看透'), '应列出看透');
    assert.ok(line.includes('心软'), '应列出心软');
    assert.ok(line.includes('婚姻'), '应列出婚姻');
    assert.ok(line.includes('人性'), '应列出人性');
  });

  test('判定 B·格言起句 — 原来从来都是 / 这就是 / 世人都说', () => {
    const line = lineOf(zh, '判定 B');
    assert.ok(line.includes('原来'), '应列出原来');
    assert.ok(line.includes('从来都是'), '应列出从来都是');
    assert.ok(line.includes('不过是'), '应列出不过是');
    assert.ok(line.includes('这就是'), '应列出这就是');
    assert.ok(line.includes('世人都说'), '应列出世人都说');
  });

  test('判定顺序 — 先 A 后 B，一行只记一次', () => {
    const line = lineOf(zh, '判定顺序');
    assert.ok(line.includes('先'), '应说明先查 A');
    assert.ok(line.includes('格言起句'), '应说明 A 不中才查 B');
    assert.ok(line.includes('只记一次'), '应说明一行一次');
  });

  test('同句共现 — 信号与抽象名词同一行，跨行不合并', () => {
    const line = lineOf(zh, '同句共现');
    assert.ok(line.includes('同一行'), '应说明同行共现');
    assert.ok(line.includes('跨行不合并'), '应说明不跨行合并');
  });

  test('rescue 豁免 — 后 2 个非空行内、换场之前的具体决断动作', () => {
    const line = lineOf(zh, 'rescue 豁免');
    assert.ok(line.includes('后 2 个非空行'), '应说明回看距离');
    assert.ok(line.includes('换场'), '应说明换场边界');
    assert.ok(line.includes('拉黑'), '应列出拉黑');
    assert.ok(line.includes('摔门'), '应列出摔门');
    assert.ok(line.includes('不扣分'), '应说明兑现后不扣分');
  });

  test('rescue 边界 — 空行跳过、场头中止、话者行跳过', () => {
    const line = lineOf(zh, 'rescue 边界');
    assert.ok(line.includes('空行'), '应说明空行跳过');
    assert.ok(line.includes('场头'), '应说明场头中止');
    assert.ok(line.includes('话者行'), '应说明话者行跳过');
  });

  test('得分 — 0 次未兑现 100 / 1 次 75 / ≥2 次 max(25, 100 - n × 25)', () => {
    const line = lineOf(zh, '得分：');
    assert.ok(line.includes('0 次'), '应给全清口径');
    assert.ok(line.includes('1 次 75'), '应给单次口径');
    assert.ok(line.includes('max(25, 100 - n × 25)'), '应给多次公式');
    assert.ok(line.includes('未 rescued'), '应说明只算未兑现');
  });

  test('命中字段 — line / kind / phrase / snippet / rescued / rescueLine / reason', () => {
    const line = lineOf(zh, '命中字段');
    assert.ok(line.includes('line'), '应列出 line');
    assert.ok(line.includes('kind'), '应列出 kind');
    assert.ok(line.includes('realization'), '应列出 realization');
    assert.ok(line.includes('aphorism'), '应列出 aphorism');
    assert.ok(line.includes('phrase'), '应列出 phrase');
    assert.ok(line.includes('snippet'), '应列出 snippet');
    assert.ok(line.includes('30 字'), '应说明截断长度');
    assert.ok(line.includes('rescued'), '应列出 rescued');
    assert.ok(line.includes('rescueLine'), '应列出 rescueLine');
    assert.ok(line.includes('reason'), '应列出 reason');
  });

  test('邻居分界 — omniscient-tease / show-dont-tell / scene-soft-ending / wake-up-call', () => {
    const line = lineOf(zh, '邻居分界');
    assert.ok(line.includes('omniscient-tease'), '应点明全知预告归属');
    assert.ok(line.includes('show-dont-tell'), '应点明情绪直述归属');
    assert.ok(line.includes('scene-soft-ending'), '应点明末拍泄气归属');
    assert.ok(line.includes('wake-up-call'), '应点明台词说教归属');
  });

  test('具体事实豁免 — 只有事实没有抽象道理词不判', () => {
    const line = lineOf(zh, '具体事实豁免');
    assert.ok(line.includes('原来他早就出轨了'), '应给事实反例');
    assert.ok(line.includes('抽象道理'), '应说明缺抽象词不判');
  });

  test('改写方向 — 删掉金句，翻译成拉黑/摔门/摘戒指的动作', () => {
    const line = lineOf(zh, '改写方向');
    assert.ok(line.includes('删掉金句'), '应给删除原则');
    assert.ok(line.includes('拉黑'), '应给动作示例一');
    assert.ok(line.includes('摔门'), '应给动作示例二');
    assert.ok(line.includes('摘戒指'), '应给动作示例三');
    assert.ok(line.includes('动作点题'), '应说明动作替代旁白');
  });

  test('pipeline 消费 moralHint + craft/deai 复扫 + 仅诊断不计加权', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish');
    assert.ok(line.includes('moralHint'), '应点明提示名');
    assert.ok(line.includes('craft 初评'), '应点明 craft 初评');
    assert.ok(line.includes('craft 复评'), '应点明 craft 复评');
    assert.ok(line.includes('deai'), '应点明 deai 复扫');
    assert.ok(line.includes('不计加权'), '应点明仅诊断');
  });

  test('成稿自查 + 中英一致 — 替观众总结人生 / 30/48 字符 / 后 2 行', () => {
    const selfCheck = lineOf(zh, '成稿自查');
    assert.ok(selfCheck.includes('替观众总结人生'), '应给自查提问');
    const parity = lineOf(zh, '中英一致');
    assert.ok(parity.includes('只扫叙述行'), '应给扫描口径');
    assert.ok(parity.includes('后 2 行'), '应给 rescue 口径');
    assert.ok(parity.includes('30/48 字符'), '应给截断口径');
  });
});

describe('en — buildMoralNarrationDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(typeof en === 'string' && en.length > 200, 'en 层应返回有效字符串');
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('两通道与计分口径', () => {
    assert.ok(en.includes('moralNarration'), '应点明同名检测器');
    assert.ok(en.includes('realization'), '应列出 realization');
    assert.ok(en.includes('aphorism'), '应列出 aphorism');
    assert.ok(en.includes('1 hit = 75'), '应给单次口径');
    assert.ok(en.includes('max(25, 100 - n x 25)'), '应给多次公式');
    assert.ok(en.includes('unrescued'), '应说明只算未兑现');
  });

  test('rescue 与具体事实豁免', () => {
    const rescue = lineOf(en, 'Rescue exemption');
    assert.ok(rescue.includes('next 2 non-empty lines'), '应说明回看距离');
    assert.ok(rescue.includes('before the next scene'), '应说明换场边界');
    assert.ok(rescue.includes('blocked'), '应列出具体动作');
    const factual = lineOf(en, 'Factual discovery');
    assert.ok(factual.includes('no abstract'), '应说明缺抽象词不判');
  });

  test('邻居分界与改写方向', () => {
    const line = lineOf(en, 'Neighbour divisions');
    assert.ok(line.includes('omniscient-tease'), '应点明全知预告归属');
    assert.ok(line.includes('show-dont-tell'), '应点明情绪直述归属');
    assert.ok(line.includes('scene-soft-ending'), '应点明末拍泄气归属');
    assert.ok(line.includes('wake-up-call'), '应点明台词说教归属');
    assert.ok(en.includes('action'), '应给动作替代方向');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('moralHint'), '应点明提示名');
    assert.ok(en.includes('craft initial'), '应点明 craft 初评');
    assert.ok(en.includes('craft re-eval'), '应点明 craft 复评');
    assert.ok(en.includes('deai'), '应点明 deai 复扫');
    assert.equal(mod.buildMoralNarrationDirective('AIGC', 'en'), en);
    assert.equal(mod.buildMoralNarrationDirective(undefined, 'en'), en);
  });
});
