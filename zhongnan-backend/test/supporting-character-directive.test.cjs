'use strict';
// v2.394 supporting-character 教学函数同源对齐测试
// 锚点词紧贴引擎源码：五类 severity + 精确扣分/封顶数字 + 触发阈值 + 互斥链 + 豁免

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/supporting-character-check.js');

try {
  require.resolve(MODULE_PATH);
} catch {
  execSync('npx tsc -p tsconfig.json', { cwd: ROOT, stdio: 'inherit' });
}

const mod = require(MODULE_PATH);

const lineOf = (s, anchor) => {
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchor)) return i + 1;
  }
  return -1;
};

const zh = mod.buildSupportingCharacterDirective('LIVE', 'zh');
const en = mod.buildSupportingCharacterDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildSupportingCharacterDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildSupportingCharacterDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildSupportingCharacterDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildSupportingCharacterDirective(undefined, 'zh'), zh);
  });

  test('echo_sidekick 捧哏 — high + 16 分起 + 每多 1 个配角 +4 分 + 封顶 24 分 + ≥60%', () => {
    assert.ok(zh.includes('echo_sidekick'), '应包含 echo_sidekick 类型名');
    const ln = lineOf(zh, 'echo_sidekick');
    assert.ok(ln > 0, '定位 echo_sidekick 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('16 分起'), `应含精确锚点「16 分起」，实际: ${line}`);
    assert.ok(line.includes('每多 1 个配角 +4 分'), `应含「每多 1 个配角 +4 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 24 分'), `应含「封顶 24 分」，实际: ${line}`);
    assert.ok(line.includes('≥60%'), `应含反应句占比 ≥60%，实际: ${line}`);
    assert.ok(line.includes('≥4 句'), `应含 ≥4 句门槛，实际: ${line}`);
  });

  test('info_dispenser 信息播报员 — mid + 每只扣 10 分 + 封顶 16 分 + ≥2 句且 ≥40%', () => {
    const ln = lineOf(zh, 'info_dispenser');
    assert.ok(ln > 0, '应包含 info_dispenser 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('每只扣 10 分'), `应含「每只扣 10 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 16 分'), `应含「封顶 16 分」，实际: ${line}`);
    assert.ok(line.includes('≥2 句'), `应含播报句 ≥2，实际: ${line}`);
    assert.ok(line.includes('≥40%'), `应含占比 ≥40%，实际: ${line}`);
  });

  test('desireless_supporter 无欲望保姆 — mid + 每只扣 8 分 + 封顶 14 分 + ≥30%/≥40%', () => {
    const ln = lineOf(zh, 'desireless_supporter');
    assert.ok(ln > 0, '应包含 desireless_supporter 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('mid'), `应含 mid，实际: ${line}`);
    assert.ok(line.includes('每只扣 8 分'), `应含「每只扣 8 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 14 分'), `应含「封顶 14 分」，实际: ${line}`);
    assert.ok(line.includes('≥30%'), `应含反应占比 ≥30%，实际: ${line}`);
    assert.ok(line.includes('≥40%'), `应含服务占比 ≥40%，实际: ${line}`);
  });

  test('praise_chorus 夸夸群像 — low + 扣 6 分 + ≥2 人各夸 ≥1 句/总≥3 句/单人≥3 句', () => {
    const ln = lineOf(zh, 'praise_chorus');
    assert.ok(ln > 0, '应包含 praise_chorus 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('扣 6 分'), `应含「扣 6 分」，实际: ${line}`);
    assert.ok(line.includes('≥2 人各夸 ≥1 句'), `应含群像条件，实际: ${line}`);
    assert.ok(line.includes('总夸奖 ≥3 句'), `应含总量条件，实际: ${line}`);
    assert.ok(line.includes('单人 ≥3 句'), `应含单人条件，实际: ${line}`);
  });

  test('offstage_mouthpiece 只动嘴 — low + 每只扣 4 分 + 封顶 8 分 + 零提及 + 功能句占比 ≥60%', () => {
    const ln = lineOf(zh, 'offstage_mouthpiece');
    assert.ok(ln > 0, '应包含 offstage_mouthpiece 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('low'), `应含 low，实际: ${line}`);
    assert.ok(line.includes('每只扣 4 分'), `应含「每只扣 4 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 8 分'), `应含「封顶 8 分」，实际: ${line}`);
    assert.ok(line.includes('零提及'), `应含动作行零提及，实际: ${line}`);
    assert.ok(line.includes('≥60%'), `应含功能句占比 ≥60%，实际: ${line}`);
  });

  test('参检口径 — ≥3 句/1-2 句归 character-balance/cast 首位/台词最多者', () => {
    assert.ok(zh.includes('非主角且 ≥3 句对白'), '应含参检配角门槛');
    assert.ok(zh.includes('1-2 句龙套归 character-balance-check 管'), '应含龙套归属');
    assert.ok(zh.includes('cast 人设卡第一个 key'), '应含主角优先级');
    assert.ok(zh.includes('台词数最多者'), '应含无卡回退');
  });

  test('互斥链 — echo 优先于 info/desireless + offstage 独立可叠加', () => {
    assert.ok(zh.includes('echo 优先于 info/desireless'), '应含互斥链');
    assert.ok(zh.includes('offstage 独立维度'), '应含独立叠加维度');
  });

  test('评分公式 — clamp(100 - penalty, 0, 100) + 无 bonus', () => {
    assert.ok(zh.includes('clamp(100 - penalty, 0, 100)'), '应含完整评分公式');
    assert.ok(zh.includes('无 bonus'), '应明确无正信号 bonus');
  });

  test('豁免 — 正文 < 20 字 + 对白 < 6 句 + 说话人 < 2 人 → 满分 100', () => {
    assert.ok(zh.includes('正文 < 20 字'), '应含短正文豁免');
    assert.ok(zh.includes('对白 < 6 句'), '应含对白量豁免');
    assert.ok(zh.includes('说话人 < 2 人'), '应含单角色豁免');
    assert.ok(zh.includes('满分 100'), '应含满分放行');
  });

  test('信号词表 — 欲望/服务/播报/夸奖 各留示例', () => {
    assert.ok(zh.includes('我要/我想/我决定'), '应含自我欲望示例');
    assert.ok(zh.includes('我帮你/我陪你'), '应含服务句示例');
    assert.ok(zh.includes('告诉你个消息'), '应含信息播报示例');
    assert.ok(zh.includes('不愧是'), '应含夸奖示例');
  });
});

// ========== 英文层断言 ==========
describe('en — buildSupportingCharacterDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 5 个类型名', () => {
    for (const t of ['echo_sidekick', 'info_dispenser', 'desireless_supporter', 'praise_chorus', 'offstage_mouthpiece']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
  });

  test('关键扣分/封顶数字与中文层同源', () => {
    assert.ok(en.includes('16'), '应含 echo 起始 16 分');
    assert.ok(en.includes('capped at 24'), '应含 echo 封顶 24');
    assert.ok(en.includes('10 points'), '应含 info 每只 10 分');
    assert.ok(en.includes('capped at 16'), '应含 info 封顶 16');
    assert.ok(en.includes('8 points'), '应含 desireless 每只 8 分');
    assert.ok(en.includes('capped at 14'), '应含 desireless 封顶 14');
    assert.ok(en.includes('6 points'), '应含 praise 扣 6 分');
    assert.ok(en.includes('4 points'), '应含 offstage 每只 4 分');
    assert.ok(en.includes('capped at 8'), '应含 offstage 封顶 8');
  });
});
