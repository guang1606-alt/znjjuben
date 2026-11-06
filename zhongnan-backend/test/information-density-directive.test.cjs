'use strict';
// v2.403 information-density 教学函数同源对齐测试
// 锚点词紧贴引擎源码：七类信息 + 水戏/过载 + 三段渐进 + 八类扣分

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/information-density-score.js');

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

const zh = mod.buildInformationDensityDirective('LIVE', 'zh');
const en = mod.buildInformationDensityDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildInformationDensityDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildInformationDensityDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
    assert.ok(zh.includes('信息密度'), '标题应点明信息密度');
  });

  test('format 不门控 — LIVE / AIGC / 缺省输出一致', () => {
    assert.equal(mod.buildInformationDensityDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildInformationDensityDirective(undefined, 'zh'), zh);
  });

  test('场景切分 — script-scenes 单一事实源 / 首场头前散行不计 / 无场头算 1 场', () => {
    const s = lineOf(zh, '场景切分');
    assert.ok(s, '应有场景切分口径');
    assert.ok(s.includes('script-scenes'), '单一事实源');
    assert.ok(s.includes('不计入'), '首场头前散行不计');
    assert.ok(s.includes('1 场'), '无场头算 1 场');
  });

  test('检测范围 — 只扫对白行与动作行，对白 1-6 字姓名，动作 △▲*✦', () => {
    const s = lineOf(zh, '检测范围');
    assert.ok(s, '应有检测范围口径');
    assert.ok(s.includes('1-6'), '姓名 1-6 字');
    assert.ok(s.includes('△▲*✦'), '四类动作前缀');
  });

  test('七类信息 — identity/motive/truth/relation/goal/reversal/evidence', () => {
    const s = lineOf(zh, '七类信息：');
    assert.ok(s, '应有七类信息清单');
    const types = ['identity', 'motive', 'truth', 'relation', 'goal', 'reversal', 'evidence'];
    for (const t of types) assert.ok(s.includes(t), `应包含 ${t}`);
    assert.ok(s.includes('身份揭示') && s.includes('实证揭示'), '中文类型名齐备');
  });

  test('同行计数 — 多类型分别计数、同类型同行只计一次', () => {
    const s = lineOf(zh, '同一行');
    assert.ok(s, '应有同行计数口径');
    assert.ok(s.includes('分别计数'), '多类型分别计数');
    assert.ok(s.includes('只计一次'), '同类型同行只计一次');
  });

  test('场次字数 — 中文汉字数、英文单词数 ×1.67 四舍五入', () => {
    const s = lineOf(zh, '场次字数');
    assert.ok(s, '应有场次字数口径');
    assert.ok(s.includes('汉字'), '中文按汉字');
    assert.ok(s.includes('1.67'), '英文换算');
    assert.ok(s.includes('四舍五入'), '四舍五入');
  });

  test('信息密度值公式 — 推进数 ÷ 字数 × 1000 保留两位小数', () => {
    const s = lineOf(zh, '信息密度值');
    assert.ok(s, '应有密度公式');
    assert.ok(s.includes('÷'), '除法');
    assert.ok(s.includes('1000'), '千字');
    assert.ok(s.includes('两位小数'), '两位小数');
  });

  test('水戏判定 — 单场推进数为 0 即 water', () => {
    const s = lineOf(zh, '水戏判定');
    assert.ok(s, '应有水戏判定');
    assert.ok(s.includes('为 0'), '推进数为 0');
    assert.ok(s.includes('water'), 'water 类型名');
  });

  test('过载判定 — ≥4 条且（密度 ≥30 或 ≤2 行）', () => {
    const s = lineOf(zh, '过载判定');
    assert.ok(s, '应有过载判定');
    assert.ok(s.includes('≥4'), '4 条门槛');
    assert.ok(s.includes('≥30'), '密度 30');
    assert.ok(s.includes('≤2'), '2 行集中');
    assert.ok(s.includes('overload'), 'overload 类型名');
  });

  test('三段切分 — max(1, ceil(总场数 ÷ 3)) 与末 1/3 起点', () => {
    const s = lineOf(zh, '三段切分');
    assert.ok(s, '应有三段切分口径');
    assert.ok(s.includes('max(1, ceil'), '前 1/3 终点公式');
    assert.ok(s.includes('末 1/3 起点'), '末 1/3 起点');
  });

  test('渐进上升 — 后段 ≥ 前段或中段 ≥ 前段，总场数 ≥4 判递减', () => {
    const s = lineOf(zh, '渐进上升');
    assert.ok(s, '应有渐进口径');
    assert.ok(s.includes('后段'), '后段');
    assert.ok(s.includes('中段'), '中段');
    assert.ok(s.includes('≥4'), '总场数门槛');
  });

  test('扣分表 — 水戏占比 15/8、单场水戏 5、过载 3', () => {
    const s = lineOf(zh, '扣分表');
    assert.ok(s, '应有扣分表');
    assert.ok(s.includes('>40% 扣 15'), '高水位 15');
    assert.ok(s.includes('>25% 扣 8'), '中水位 8');
    assert.ok(s.includes('≥15'), '单场水戏字数门槛');
    assert.ok(s.includes('扣 5'), '单场水戏 5');
    assert.ok(s.includes('扣 3'), '过载 3');
  });

  test('区间与总量扣分 — 钩子区 10 / 高潮区 10 / 递减 5 / 总量 8', () => {
    const s = lineOf(zh, '区间与总量扣分');
    assert.ok(s, '应有区间扣分');
    assert.ok(s.includes('前 1/3 无推进扣 10'), '钩子区 10');
    assert.ok(s.includes('末 1/3 无推进扣 10'), '高潮区 10');
    assert.ok(s.includes('下降扣 5'), '递减 5');
    assert.ok(s.includes('扣 8'), '总量 8');
  });

  test('问题类型名与 severity 齐备', () => {
    const types = [
      'too_many_water_scenes', 'water_scene', 'info_overload',
      'no_info_in_hook_zone', 'no_info_in_climax_zone',
      'no_rising_progression', 'low_total_info',
    ];
    for (const t of types) assert.ok(zh.includes(t), `应包含问题类型 ${t}`);
    assert.ok(zh.includes('high'), 'high severity');
    assert.ok(zh.includes('mid'), 'mid severity');
  });

  test('总分规则 — 100 起扣并 clamp 0-100', () => {
    const s = lineOf(zh, '总分');
    assert.ok(s, '应有总分规则');
    assert.ok(s.includes('100'), '满分 100');
    assert.ok(s.includes('clamp'), 'clamp');
  });

  test('成稿自查 — 每场 1 条 / 水戏 <25% / 不挤 2 行 / 首末区有揭示', () => {
    const s = lineOf(zh, '成稿自查');
    assert.ok(s, '应有成稿自查段');
    assert.ok(s.includes('每场至少 1 条'), '每场 1 条');
    assert.ok(s.includes('<25%'), '水戏 <25%');
  });
});

// ========== 英文层断言 ==========
describe('en — buildInformationDensityDirective', () => {
  test('非空且含标题', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
    assert.ok(en.toLowerCase().includes('information density'), '标题应点明 information density');
  });

  test('零中文（无 CJK 字符）', () => {
    assert.ok(!/[\u4e00-\u9fa5]/.test(en), 'en 层不得出现中文');
  });

  test('全部问题类型名与 severity 齐备', () => {
    const types = [
      'too_many_water_scenes', 'water_scene', 'info_overload',
      'no_info_in_hook_zone', 'no_info_in_climax_zone',
      'no_rising_progression', 'low_total_info',
    ];
    for (const t of types) assert.ok(en.includes(t), `应包含 ${t}`);
    assert.ok(en.includes('high') && en.includes('mid'), 'severity 齐备');
  });

  test('关键数字锚点 — 1.67/1000/40%/25%/15/4/30/2/10/5/8/3', () => {
    const nums = ['1.67', '1000', '40%', '25%', '15', '4', '30', '2', '10', '5', '8', '3'];
    for (const n of nums) assert.ok(en.includes(n), `应包含数字 ${n}`);
  });

  test('format 不门控 — AIGC 与缺省一致', () => {
    assert.equal(mod.buildInformationDensityDirective('AIGC', 'en'), en);
    assert.equal(mod.buildInformationDensityDirective(undefined, 'en'), en);
  });
});
