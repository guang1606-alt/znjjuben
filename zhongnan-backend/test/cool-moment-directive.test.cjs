'use strict';
// v2.405 cool-moment 教学函数同源对齐测试
// 锚点词紧贴引擎源码：八类信号 + 去重口径 + 五项评估 + 得分公式 + 扣分表

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/cool-moment-score.js');

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

const zh = mod.buildCoolMomentDirective('LIVE', 'zh');
const en = mod.buildCoolMomentDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildCoolMomentDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildCoolMomentDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('爽点密度'), '标题应点明爽点密度');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildCoolMomentDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildCoolMomentDirective(undefined, 'zh'), zh);
  });

  test('扫描单位 — 全文扫描 + 同位置 ±0.02 去重保留最强者', () => {
    const s = lineOf(zh, '扫描单位：');
    assert.ok(s, '应有扫描单位口径');
    assert.ok(s.includes('全文扫描'), '全文扫描');
    assert.ok(s.includes('±0.02'), '去重窗口 ±0.02');
    assert.ok(s.includes('强度最高'), '保留强度最高');
  });

  test('八类信号 — face_slap 95 / counterattack 92 / reveal 88 / flex 85 / punish 82 / protect 80 / wealth 78 / weak 40', () => {
    const s = lineOf(zh, '八类爽点信号：');
    assert.ok(s, '应有八类信号清单');
    const pairs = [
      ['face_slap', '95'], ['counterattack', '92'], ['reveal', '88'], ['flex', '85'],
      ['punish', '82'], ['protect', '80'], ['wealth', '78'], ['weak', '40'],
    ];
    for (const [t, v] of pairs) {
      assert.ok(s.includes(t), `应包含 ${t}`);
      assert.ok(s.includes(t + ' '), `类型名 ${t} 后应有强度`);
      assert.ok(new RegExp(`${t}[^/]*${v}`).test(s), `${t} 强度应为 ${v}`);
    }
    assert.ok(s.includes('打脸爽') && s.includes('逆袭爽') && s.includes('财富炫耀爽'), '中文类型名齐备');
  });

  test('弱爽点降级 — 无强爽点时才计入 weak', () => {
    const s = lineOf(zh, '弱爽点降级：');
    assert.ok(s, '应有弱爽点降级口径');
    assert.ok(s.includes('没有强爽点'), '仅无强爽点时计入');
    assert.ok(s.includes('weak'), 'weak 类型名');
    assert.ok(s.includes('你给我等着'), '反例台词');
  });

  test('三段分布 — <0.33 开头 / <0.66 中段 / 其余结尾', () => {
    const s = lineOf(zh, '三段分布：');
    assert.ok(s, '应有三段分布口径');
    assert.ok(s.includes('0.33'), '开头阈值');
    assert.ok(s.includes('0.66'), '中段阈值');
    assert.ok(s.includes('开头') && s.includes('中段') && s.includes('结尾'), '三段名');
  });

  test('蓄力-爆发 — 憋屈/压抑/忍/屈辱 等信号，先抑后扬', () => {
    const s = lineOf(zh, '蓄力-爆发：');
    assert.ok(s, '应有蓄力口径');
    assert.ok(s.includes('憋屈') && s.includes('压抑'), '蓄力词表');
    assert.ok(s.includes('忍气吞声'), '具体信号');
    assert.ok(s.includes('先抑后扬'), '节奏要求');
  });

  test('多样性 — 类型去重计数', () => {
    const s = lineOf(zh, '多样性：');
    assert.ok(s, '应有多样性口径');
    assert.ok(s.includes('去重'), '类型去重');
    assert.ok(s.includes('一种类型'), '单一类型即单调');
  });

  test('数量硬门槛 — 每集 ≥3；0 个 no_cool_moment / 1-2 个 low_density', () => {
    const s = lineOf(zh, '数量硬门槛：');
    assert.ok(s, '应有数量门槛');
    assert.ok(s.includes('至少 3'), '至少 3 个');
    assert.ok(s.includes('no_cool_moment'), '零爽点类型');
    assert.ok(s.includes('low_density'), '低密度类型');
    assert.ok(s.includes('high'), '两者均为 high');
  });

  test('分布门槛 — 已有 3 个时 2 段为空判 uneven_distribution（mid）', () => {
    const s = lineOf(zh, '分布门槛：');
    assert.ok(s, '应有分布门槛');
    assert.ok(s.includes('3 个'), '触发前提 3 个');
    assert.ok(s.includes('2 段'), '两段为空');
    assert.ok(s.includes('uneven_distribution'), '类型名');
    assert.ok(s.includes('mid'), 'mid 级');
  });

  test('强度门槛 — 强度 ≥80 达 ceil(总数×0.5)，否则 weak_moments（mid）', () => {
    const s = lineOf(zh, '强度门槛：');
    assert.ok(s, '应有强度门槛');
    assert.ok(s.includes('≥80'), '强爽点门槛 80');
    assert.ok(s.includes('ceil'), '向上取整');
    assert.ok(s.includes('×0.5'), '一半占比');
    assert.ok(s.includes('weak_moments'), '类型名');
    assert.ok(s.includes('mid'), 'mid 级');
  });

  test('蓄力门槛 — 已有 3 个时无蓄力判 no_buildup（low）', () => {
    const s = lineOf(zh, '蓄力门槛：');
    assert.ok(s, '应有蓄力门槛');
    assert.ok(s.includes('3 个'), '触发前提');
    assert.ok(s.includes('no_buildup'), '类型名');
    assert.ok(s.includes('low'), 'low 级');
  });

  test('多样性门槛 — 已有 3 个时仅一种类型判 monotone（low）', () => {
    const s = lineOf(zh, '多样性门槛：');
    assert.ok(s, '应有多样性门槛');
    assert.ok(s.includes('一种类型'), '仅一种类型');
    assert.ok(s.includes('monotone'), '类型名');
    assert.ok(s.includes('low'), 'low 级');
  });

  test('得分公式 — min(40, n×13) + 段数×7 + round(占比×20) + 10 + min(10, 类型×2)', () => {
    const s = lineOf(zh, '得分公式：');
    assert.ok(s, '应有得分公式');
    assert.ok(s.includes('min(40'), '数量封顶 40');
    assert.ok(s.includes('×13'), '每个 13 分');
    assert.ok(s.includes('×7'), '每段 7 分');
    assert.ok(s.includes('×20'), '强度 20');
    assert.ok(s.includes('10'), '蓄力 10');
    assert.ok(s.includes('min(10'), '多样性封顶 10');
    assert.ok(s.includes('×2'), '每类 2 分');
  });

  test('扣分表 — high 扣 10 / mid 扣 5 / low 扣 2，总分 clamp(0, 100)', () => {
    const s = lineOf(zh, '扣分表：');
    assert.ok(s, '应有扣分表');
    assert.ok(s.includes('扣 10'), 'high 扣 10');
    assert.ok(s.includes('扣 5'), 'mid 扣 5');
    assert.ok(s.includes('扣 2'), 'low 扣 2');
    assert.ok(s.includes('clamp(0, 100)'), '总分夹取');
  });

  test('问题类型 — 六类齐全且分级正确', () => {
    const s = lineOf(zh, '问题类型：');
    assert.ok(s, '应列问题类型');
    const pairs = [
      ['no_cool_moment', 'high'], ['low_density', 'high'],
      ['uneven_distribution', 'mid'], ['weak_moments', 'mid'],
      ['no_buildup', 'low'], ['monotone', 'low'],
    ];
    for (const [t, sev] of pairs) {
      assert.ok(new RegExp(`${t}（${sev}）`).test(s), `${t} 应为 ${sev}`);
    }
  });

  test('成稿自查 — 数量/强度/分布/蓄力/多样性五项', () => {
    const s = lineOf(zh, '成稿自查：');
    assert.ok(s, '应有成稿自查');
    assert.ok(s.includes('≥3'), '爽点 ≥3');
    assert.ok(s.includes('一半以上'), '强爽点过半');
    assert.ok(s.includes('开头/中段/结尾'), '三段覆盖');
    assert.ok(s.includes('蓄力'), '至少一处蓄力');
    assert.ok(s.includes('两种'), '至少两种类型');
  });
});

// ========== 英文层断言 ==========
describe('en — buildCoolMomentDirective', () => {
  const CJK = /[\u4e00-\u9fa5]/;

  test('函数存在且英文层零中文', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    assert.ok(!CJK.test(en), '英文层不得出现中文');
    assert.ok(en.includes('Cool Moment'), '标题应点明 Cool Moment');
  });

  test('format 不门控 — AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildCoolMomentDirective('AIGC', 'en'), en);
    assert.equal(mod.buildCoolMomentDirective(undefined, 'en'), en);
  });

  test('八类信号与强度齐全', () => {
    const s = lineOf(en, 'Eight signal types');
    assert.ok(s, '应有八类信号清单');
    const pairs = [
      ['face_slap', '95'], ['counterattack', '92'], ['reveal', '88'], ['flex', '85'],
      ['punish', '82'], ['protect', '80'], ['wealth', '78'], ['weak', '40'],
    ];
    for (const [t, v] of pairs) {
      assert.ok(new RegExp(`${t}[^/]*${v}`).test(s), `${t} 强度应为 ${v}`);
    }
  });

  test('关键阈值 — 3 个 / ceil 0.5 / 0.33 / 0.66 / ±0.02', () => {
    assert.ok(zh.includes('至少 3'));
    const density = lineOf(en, 'Hard minimum');
    assert.ok(density.includes('3'), '至少 3 个');
    const strength = lineOf(en, 'Strength gate');
    assert.ok(strength.includes('ceil') && strength.includes('0.5'), '强度过半');
    const dist = lineOf(en, 'Three-segment');
    assert.ok(dist.includes('0.33') && dist.includes('0.66'), '三段阈值');
    const unit = lineOf(en, 'Scan unit');
    assert.ok(unit.includes('0.02'), '去重窗口');
  });

  test('得分公式与扣分表', () => {
    const score = lineOf(en, 'Score formula');
    assert.ok(score.includes('40') && score.includes('13') && score.includes('20') && score.includes('10'), '公式要素');
    const deduct = lineOf(en, 'Deduction table');
    assert.ok(deduct.includes('10') && deduct.includes('5') && deduct.includes('2'), '扣分档位');
    assert.ok(deduct.includes('clamp'), '总分夹取');
  });
});
