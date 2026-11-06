'use strict';
// v2.406 punchline-density 教学函数同源对齐测试
// 锚点词紧贴引擎源码：九类信号 + 去重口径 + 六项评估 + 得分公式 + 扣分表

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/punchline-density-score.js');

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

const zh = mod.buildPunchlineDensityDirective('LIVE', 'zh');
const en = mod.buildPunchlineDensityDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildPunchlineDensityDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildPunchlineDensityDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('金句密度'), '标题应点明金句密度');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildPunchlineDensityDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildPunchlineDensityDirective(undefined, 'zh'), zh);
  });

  test('检测范围 — 只扫对白行，场头/标题/△动作行排除', () => {
    const s = lineOf(zh, '检测范围：');
    assert.ok(s, '应有检测范围口径');
    assert.ok(s.includes('对白行'), '只扫对白行');
    assert.ok(s.includes('1-6 字'), '角色名长度');
    assert.ok(s.includes('场头'), '场头排除');
    assert.ok(s.includes('△'), '动作行排除');
  });

  test('位置口径 — 行号/总行数两位小数，三段 0.33/0.66', () => {
    const s = lineOf(zh, '位置口径：');
    assert.ok(s, '应有位置口径');
    assert.ok(s.includes('两位小数'), '两位小数');
    assert.ok(s.includes('0.33'), '开头阈值');
    assert.ok(s.includes('0.66'), '中段阈值');
  });

  test('九类信号 — reversal 95 / declarative 90 / contrast 85 / resolution 80 / threat 75 / question 70 / parallel 65 / metaphor 60 / weak 35', () => {
    const s = lineOf(zh, '九类金句信号：');
    assert.ok(s, '应有九类信号清单');
    const pairs = [
      ['reversal', '95'], ['declarative', '90'], ['contrast', '85'], ['resolution', '80'],
      ['threat', '75'], ['question', '70'], ['parallel', '65'], ['metaphor', '60'], ['weak', '35'],
    ];
    for (const [t, v] of pairs) {
      assert.ok(s.includes(t), `应包含 ${t}`);
      assert.ok(new RegExp(`${t}[^/]*${v}`).test(s), `${t} 强度应为 ${v}`);
    }
    assert.ok(s.includes('反转点睛') && s.includes('强势宣言') && s.includes('灵魂拷问'), '中文类型名齐备');
  });

  test('去重口径 — 同一对白多类型取最强，位置差 <0.005 且同说话人', () => {
    const s = lineOf(zh, '去重口径：');
    assert.ok(s, '应有去重口径');
    assert.ok(s.includes('取最强'), '保留最强');
    assert.ok(s.includes('0.005'), '去重窗口');
    assert.ok(s.includes('同一说话人'), '同说话人');
  });

  test('弱金句降级 — 同对白已命中强类型则 weak 不计', () => {
    const s = lineOf(zh, '弱金句降级：');
    assert.ok(s, '应有弱金句降级口径');
    assert.ok(s.includes('已命中'), '已命中强类型');
    assert.ok(s.includes('不计入'), '不计入');
    assert.ok(s.includes('走着瞧'), '弱金句示例');
  });

  test('数量门槛 — 0 no_punchline / 1 low_density（high）/ 2 insufficient_density（mid）/ ≥3 满分', () => {
    const s = lineOf(zh, '数量门槛：');
    assert.ok(s, '应有数量门槛');
    assert.ok(s.includes('0 个'), '零个');
    assert.ok(s.includes('no_punchline'), '零个类型');
    assert.ok(s.includes('low_density'), '一个类型');
    assert.ok(s.includes('insufficient_density'), '两个类型');
    assert.ok(s.includes('至少 2'), '及格线 2');
    assert.ok(s.includes('3 个'), '优秀线 3');
  });

  test('强度门槛 — 已有 2 个时最高 <80 判 weak_punchline（mid）', () => {
    const s = lineOf(zh, '强度门槛：');
    assert.ok(s, '应有强度门槛');
    assert.ok(s.includes('最高'), '看最高强度');
    assert.ok(s.includes('<80'), '门槛 80');
    assert.ok(s.includes('weak_punchline'), '类型名');
    assert.ok(s.includes('mid'), 'mid 级');
  });

  test('分布门槛 — 已有 2 个时 2 段为空判 uneven_distribution（mid）', () => {
    const s = lineOf(zh, '分布门槛：');
    assert.ok(s, '应有分布门槛');
    assert.ok(s.includes('2 段'), '两段为空');
    assert.ok(s.includes('uneven_distribution'), '类型名');
    assert.ok(s.includes('mid'), 'mid 级');
  });

  test('多样性门槛 — 已有 3 个时仅一种类型判 monotone（low）', () => {
    const s = lineOf(zh, '多样性门槛：');
    assert.ok(s, '应有多样性门槛');
    assert.ok(s.includes('一种类型'), '仅一种类型');
    assert.ok(s.includes('monotone'), '类型名');
    assert.ok(s.includes('low'), 'low 级');
  });

  test('结尾高潮 — 已有 2 个时结尾段无 ≥80 金句判 no_climax_punch（mid）', () => {
    const s = lineOf(zh, '结尾高潮：');
    assert.ok(s, '应有结尾高潮口径');
    assert.ok(s.includes('≥80'), '强度门槛');
    assert.ok(s.includes('no_climax_punch'), '类型名');
    assert.ok(s.includes('mid'), 'mid 级');
  });

  test('弱金句占比 — 已有 2 个时 weak 超过一半判 too_many_weak（low）', () => {
    const s = lineOf(zh, '弱金句占比：');
    assert.ok(s, '应有弱金句占比口径');
    assert.ok(s.includes('一半'), '超过一半');
    assert.ok(s.includes('too_many_weak'), '类型名');
    assert.ok(s.includes('low'), 'low 级');
  });

  test('得分公式 — min(35, n×12) + round(最高/95×25) + 段数×5 + min(10, 类型×2) + 15', () => {
    const s = lineOf(zh, '得分公式：');
    assert.ok(s, '应有得分公式');
    assert.ok(s.includes('min(35'), '数量封顶 35');
    assert.ok(s.includes('×12'), '每个 12 分');
    assert.ok(s.includes('/95'), '强度基数 95');
    assert.ok(s.includes('×25'), '强度 25');
    assert.ok(s.includes('×5'), '每段 5 分');
    assert.ok(s.includes('min(10'), '多样性封顶 10');
    assert.ok(s.includes('×2'), '每类 2 分');
    assert.ok(s.includes('15'), '结尾高潮 15');
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
      ['no_punchline', 'high'], ['low_density', 'high'],
      ['insufficient_density', 'mid'], ['weak_punchline', 'mid'],
      ['uneven_distribution', 'mid'], ['no_climax_punch', 'mid'],
      ['monotone', 'low'], ['too_many_weak', 'low'],
    ];
    for (const [t, sev] of pairs) {
      assert.ok(new RegExp(`${t}（${sev}）`).test(s), `${t} 应为 ${sev}`);
    }
  });

  test('成稿自查 — 数量/强度/分布/结尾/弱金句/多样性六项', () => {
    const s = lineOf(zh, '成稿自查：');
    assert.ok(s, '应有成稿自查');
    assert.ok(s.includes('≥3'), '金句 ≥3');
    assert.ok(s.includes('≥80'), '强金句门槛');
    assert.ok(s.includes('开头/中段/结尾'), '三段覆盖');
    assert.ok(s.includes('结尾段'), '结尾段有点睛');
    assert.ok(s.includes('一半'), '弱金句不过半');
    assert.ok(s.includes('两种'), '至少两种类型');
  });
});

// ========== 英文层断言 ==========
describe('en — buildPunchlineDensityDirective', () => {
  const CJK = /[\u4e00-\u9fa5]/;

  test('函数存在且英文层零中文', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    assert.ok(!CJK.test(en), '英文层不得出现中文');
    assert.ok(en.includes('Punchline Density'), '标题应点明 Punchline Density');
  });

  test('format 不门控 — AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildPunchlineDensityDirective('AIGC', 'en'), en);
    assert.equal(mod.buildPunchlineDensityDirective(undefined, 'en'), en);
  });

  test('九类信号与强度齐全', () => {
    const s = lineOf(en, 'Nine signal types');
    assert.ok(s, '应有九类信号清单');
    const pairs = [
      ['reversal', '95'], ['declarative', '90'], ['contrast', '85'], ['resolution', '80'],
      ['threat', '75'], ['question', '70'], ['parallel', '65'], ['metaphor', '60'], ['weak', '35'],
    ];
    for (const [t, v] of pairs) {
      assert.ok(new RegExp(`${t}[^/]*${v}`).test(s), `${t} 强度应为 ${v}`);
    }
  });

  test('关键阈值 — 2/3 个 / 80 / 0.33/0.66 / 0.005 / 一半', () => {
    const count = lineOf(en, 'Count gate');
    assert.ok(count.includes('2') && count.includes('3'), '及格 2 优秀 3');
    const strength = lineOf(en, 'Strength gate');
    assert.ok(strength.includes('80'), '强度门槛');
    const dist = lineOf(en, 'Position');
    assert.ok(dist.includes('0.33') && dist.includes('0.66'), '三段阈值');
    const dedup = lineOf(en, 'Dedup');
    assert.ok(dedup.includes('0.005'), '去重窗口');
    const weak = lineOf(en, 'Weak ratio');
    assert.ok(weak.includes('half'), '弱金句过半');
  });

  test('得分公式与扣分表', () => {
    const score = lineOf(en, 'Score formula');
    assert.ok(score.includes('35') && score.includes('12') && score.includes('95') && score.includes('25'), '公式要素');
    assert.ok(score.includes('15'), '结尾高潮分');
    const deduct = lineOf(en, 'Deduction table');
    assert.ok(deduct.includes('10') && deduct.includes('5') && deduct.includes('2'), '扣分档位');
    assert.ok(deduct.includes('clamp'), '总分夹取');
  });
});
