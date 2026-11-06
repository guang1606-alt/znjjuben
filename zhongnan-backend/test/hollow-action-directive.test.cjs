'use strict';
// v2.411 hollow-action 教学函数同源对齐测试
// 锚点紧贴引擎源码：七类整行调度 / 行首 0-6 字 + 水副词 + 长长地 / 能量词豁免 /
// 点头摇头只计重复 / 重复 ≥4 扣 (n-3)×3 / 每条 8 分 / score 公式 / densityPer10 不扣分

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/hollow-action.js');

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

const zh = mod.buildHollowActionDirective('LIVE', 'zh');
const en = mod.buildHollowActionDirective('LIVE', 'en');

describe('zh — buildHollowActionDirective', () => {
  test('函数存在且返回有效教学文本', () => {
    assert.equal(typeof mod.buildHollowActionDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 200, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('空心动作'), '标题应点明空心动作');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildHollowActionDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildHollowActionDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫非台词非场头行，说话人冒号算台词', () => {
    const line = lineOf(zh, '检测范围');
    assert.ok(line.includes('非台词'), '应说明跳过台词行');
    assert.ok(line.includes('场头'), '应说明跳过场头');
    assert.ok(line.includes('1-12 字说话人'), '应给出台词行判定口径');
  });

  test('七类整行调度模板齐全', () => {
    for (const g of ['叹气', '深呼吸', '站起', '坐下', '踱步', '转身', '沉默']) {
      assert.ok(zh.includes(`${g}：`), `应列出${g}类模板`);
    }
  });

  test('行首豁免 — 0-6 字主语/状语 + 水副词 + 可选长长地 + 句末标点可省', () => {
    const line = lineOf(zh, '七类整行调度模板');
    assert.ok(line.includes('0-6 字'), '应说明行首 0-6 字');
    assert.ok(line.includes('缓缓'), '应列出水副词');
    assert.ok(line.includes('长长地'), '应说明可选长长地');
    assert.ok(line.includes('句末标点可省'), '应说明句末标点可省');
  });

  test('强能量词豁免 — 有能量的站起不判空心', () => {
    const line = lineOf(zh, '豁免');
    assert.ok(line.includes('猛地'), '应列出能量词');
    assert.ok(line.includes('夺门'), '应列出能量动作');
    assert.ok(line.includes('不判空心'), '应说明豁免结论');
  });

  test('整行只有调度动作才判空心 — 后面接戏不算', () => {
    const line = lineOf(zh, '只有调度动作');
    assert.ok(line.includes('具体行为'), '应说明接了具体行为不算');
  });

  test('点头/摇头永不判空心，只计重复', () => {
    const line = lineOf(zh, '点头/摇头');
    assert.ok(line.includes('永不判空心'), '点头摇头不应被判空心');
    assert.ok(line.includes('重复'), '应说明只进重复统计');
  });

  test('重复口径 — 同一动作 ≥4 次，扣 (次数 - 3) × 3', () => {
    const line = lineOf(zh, '同一动作');
    assert.ok(line.includes('≥4'), '重复阈值应为 4');
    assert.ok(line.includes('(次数 - 3) × 3'), '扣分应为 (次数 - 3) × 3');
    assert.ok(line.includes('八类'), '应说明八类手势参与计数');
  });

  test('空心行扣分 — 每条 8 分', () => {
    assert.ok(zh.includes('每条 8 分'), '每条空心行扣 8 分');
  });

  test('总分公式 — max(0, 100 - 空心条数 × 8 - 重复扣分)', () => {
    const line = lineOf(zh, '总分');
    assert.ok(line.includes('max(0, 100 - 空心条数 × 8 - 重复扣分)'), '公式应与引擎一致');
    assert.ok(line.includes('空稿 100'), '空稿应为满分');
  });

  test('densityPer10 只作诊断参考，不参与扣分', () => {
    const line = lineOf(zh, 'densityPer10');
    assert.ok(line.includes('不参与扣分'), 'densityPer10 不应扣分');
  });

  test('切句口径 — 按 。！？； 逐句判定', () => {
    const line = lineOf(zh, '切句');
    assert.ok(line.includes('。！？；'), '应给出中文切句符');
  });

  test('分工 — scene-padding / craft-lint / show-dont-tell 不重叠', () => {
    const line = lineOf(zh, '分工');
    assert.ok(line.includes('scene-padding'), '应点明 scene-padding 管注水');
    assert.ok(line.includes('craft-lint'), '应点明 craft-lint 管被动词');
    assert.ok(line.includes('show-dont-tell'), '应点明 show-dont-tell 管情绪标签');
  });

  test('pipeline 消费 — prePolish hollowHint + craft/deai 复评', () => {
    const line = lineOf(zh, 'pipeline 消费');
    assert.ok(line.includes('prePolish'), '应点明 prePolish 消费');
    assert.ok(line.includes('hollowHint'), '应点明注入的提示名');
  });

  test('三选一铁律 — 暴露心理 / 改变关系 / 埋收物件', () => {
    assert.ok(zh.includes('暴露他不想让人看见的心理'), '应含第一条原则');
    assert.ok(zh.includes('埋或收一个具体物件'), '应含第三条原则');
  });

  test('成稿自查 — 删掉后剧情有没有损失', () => {
    const line = lineOf(zh, '成稿自查');
    assert.ok(line.includes('删掉后剧情有没有损失'), '应给出自查问句');
  });
});

describe('en — buildHollowActionDirective', () => {
  test('en 层零中文 CJK', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('七类英文模板齐全', () => {
    for (const g of ['sigh', 'breath', 'stand', 'sit', 'pace', 'turn', 'silence']) {
      assert.ok(en.toLowerCase().includes(g), `en 应列出 ${g}`);
    }
  });

  test('扣分口径 — 每条 8 分 + 重复 (count - 3) x 3', () => {
    assert.ok(en.includes('8 points each'), '每条应扣 8 分');
    assert.ok(en.includes('(count - 3) x 3'), '重复扣分公式应一致');
  });

  test('总分 — max(0, 100 - hollowBeats x 8 - repeatPenalty)', () => {
    assert.ok(en.includes('max(0, 100 - hollowBeats x 8 - repeatPenalty)'), '公式应一致');
  });

  test('pipeline 消费 + format 不门控', () => {
    assert.ok(en.includes('prePolish'), '应点明 prePolish');
    assert.ok(en.includes('hollowHint'), '应点明提示名');
    assert.equal(mod.buildHollowActionDirective('AIGC', 'en'), en);
    assert.equal(mod.buildHollowActionDirective(undefined, 'en'), en);
  });
});
