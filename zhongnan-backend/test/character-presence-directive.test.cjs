'use strict';
// v2.395 character-presence 教学函数同源对齐测试
// 锚点词紧贴引擎源码：三类 severity + 精确扣分/封顶数字 + 归属顺序 + 豁免 + 正信号

const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { describe, test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'dist/engine/character-presence-check.js');

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

const zh = mod.buildCharacterPresenceDirective('LIVE', 'zh');
const en = mod.buildCharacterPresenceDirective('LIVE', 'en');

// ========== 中文层断言 ==========
describe('zh — buildCharacterPresenceDirective', () => {
  test('函数存在且签名正确', () => {
    assert.equal(typeof mod.buildCharacterPresenceDirective, 'function');
    assert.ok(typeof zh === 'string' && zh.length > 100, 'zh 层应返回有效字符串');
  });

  test('format 不门控 — LIVE 与 AIGC 输出一致', () => {
    assert.equal(mod.buildCharacterPresenceDirective('AIGC', 'zh'), zh);
    assert.equal(mod.buildCharacterPresenceDirective(undefined, 'zh'), zh);
  });

  test('ghost_speech 离场幽灵 — 首次 mid/其后 high + 扣 12 分 + 扣 10 分 + 封顶 22 分 + 每场每角色 1 次', () => {
    assert.ok(zh.includes('ghost_speech'), '应包含 ghost_speech 类型名');
    const ln = lineOf(zh, 'ghost_speech');
    assert.ok(ln > 0, '定位 ghost_speech 所在行');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('首次 mid'), `应含「首次 mid」，实际: ${line}`);
    assert.ok(line.includes('第 2 次起 high'), `应含「第 2 次起 high」，实际: ${line}`);
    assert.ok(line.includes('扣 12 分'), `应含「扣 12 分」，实际: ${line}`);
    assert.ok(line.includes('扣 10 分'), `应含「扣 10 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 22 分'), `应含「封顶 22 分」，实际: ${line}`);
    assert.ok(line.includes('每场每角色只算 1 次'), `应含消费规则，实际: ${line}`);
  });

  test('dead_alive 亡者复活 — high + 每条扣 18 分 + 封顶 24 分 + 每个死者只报 1 条', () => {
    const ln = lineOf(zh, 'dead_alive');
    assert.ok(ln > 0, '应包含 dead_alive 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('high'), `应含 high，实际: ${line}`);
    assert.ok(line.includes('每条扣 18 分'), `应含「每条扣 18 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 24 分'), `应含「封顶 24 分」，实际: ${line}`);
    assert.ok(line.includes('每个死者只报 1 条'), `应含单死者去重，实际: ${line}`);
  });

  test('phantom_call 断线幽灵 — 首次 low/其后 mid + 1 处扣 7 分 + ≥2 处扣 13 分 + 封顶 13 分 + 3 行窗口 + ≥2 角色', () => {
    const ln = lineOf(zh, 'phantom_call');
    assert.ok(ln > 0, '应包含 phantom_call 类型名');
    const line = zh.split('\n')[ln - 1];
    assert.ok(line.includes('首次 low'), `应含「首次 low」，实际: ${line}`);
    assert.ok(line.includes('第 2 次起 mid'), `应含「第 2 次起 mid」，实际: ${line}`);
    assert.ok(line.includes('1 处扣 7 分'), `应含「1 处扣 7 分」，实际: ${line}`);
    assert.ok(line.includes('≥2 处扣 13 分'), `应含「≥2 处扣 13 分」，实际: ${line}`);
    assert.ok(line.includes('封顶 13 分'), `应含「封顶 13 分」，实际: ${line}`);
    assert.ok(line.includes('3 行窗口'), `应含 3 行窗口，实际: ${line}`);
    assert.ok(line.includes('≥2 个不同角色'), `应含双角色条件，实际: ${line}`);
  });

  test('归属顺序 — 死亡词前 6 字符/致死动作前 8 或后 4 + 最近 2 行 + 台词宣告不归属', () => {
    assert.ok(zh.includes('死亡词前 6 字符'), '应含死亡词前 6 字符');
    assert.ok(zh.includes('前 8 字符或后 4 字符'), '应含致死动作前后窗');
    assert.ok(zh.includes('最近 2 行'), '应含说话人回退');
    assert.ok(zh.includes('台词宣告死亡不归属'), '应含台词宣告豁免');
  });

  test('强离场词表与否定 — 摔门而去/夺门而出 + 没走/别走 + 可反悔台词不算', () => {
    assert.ok(zh.includes('摔门而去/夺门而出'), '应含强离场示例');
    assert.ok(zh.includes('没走/别走'), '应含离场否定词');
    assert.ok(zh.includes('可反悔台词不算'), '应含可反悔台词边界');
  });

  test('正信号 — 回归动作清除本场 + 每对 +2 分 + 封顶 +4 分', () => {
    assert.ok(zh.includes('去而复返'), '应含回归示例');
    assert.ok(zh.includes('推门而入'), '应含推门而入');
    assert.ok(zh.includes('清除本场全部未闭合离场'), '应含清除语义');
    assert.ok(zh.includes('每对 +2 分'), '应含 +2 分/对');
    assert.ok(zh.includes('封顶 +4 分'), '应含封顶 +4');
  });

  test('死亡否定 — 假死/装死/诈死 + 垂死/濒死 + 死里逃生 均不算', () => {
    assert.ok(zh.includes('假死/装死/诈死'), '应含假死类否定');
    assert.ok(zh.includes('垂死/濒死'), '应含濒死类否定');
    assert.ok(zh.includes('死里逃生'), '应含死里逃生否定');
  });

  test('生还豁免 — 抢救过来/竟然没死 + 死亡行之后、再次开口之前', () => {
    assert.ok(zh.includes('抢救过来'), '应含抢救生还示例');
    assert.ok(zh.includes('竟然没死'), '应含未死反转示例');
    assert.ok(zh.includes('死亡行之后、再次开口之前'), '应含豁免时间窗');
  });

  test('通话三段 — 语境词 / 挂断否定 / 重拨豁免 / 通话特征词', () => {
    assert.ok(zh.includes('打电话/拨通'), '应含通话语境词');
    assert.ok(zh.includes('没挂/不肯挂'), '应含挂断否定词');
    assert.ok(zh.includes('重新打来/又打来'), '应含重拨词');
    assert.ok(zh.includes('电话/手机/那头'), '应含通话特征词');
  });

  test('豁免与边界 — 正文 < 20 字 + 满分 100 + 离场只同场追究 + 跨场由场头调度', () => {
    assert.ok(zh.includes('正文 < 20 字'), '应含短正文豁免');
    assert.ok(zh.includes('满分 100'), '应含满分放行');
    assert.ok(zh.includes('离场幽灵只在同场追究'), '应含同场边界');
    assert.ok(zh.includes('跨场默认由场头重新调度'), '应含跨场调度');
  });

  test('评分公式 — clamp(round(100 - penalty + bonus), 0, 100) + 证据上限 2 条但按实际次数扣分', () => {
    assert.ok(zh.includes('clamp(round(100 - penalty + bonus), 0, 100)'), '应含完整评分公式');
    assert.ok(zh.includes('每类最多推 2 条'), '应含证据上限');
    assert.ok(zh.includes('扣分按实际发生次数计算'), '应含扣分计数口径');
  });
});

// ========== 英文层断言 ==========
describe('en — buildCharacterPresenceDirective', () => {
  test('返回非空字符串', () => {
    assert.ok(typeof en === 'string' && en.length > 100, 'en 层应返回有效字符串');
  });

  test('零 CJK 中文字符', () => {
    const cjk = en.match(/[\u4e00-\u9fa5]/g);
    assert.equal(cjk, null, `en 层不应含中文，发现: ${cjk}`);
  });

  test('包含全部 3 个类型名与 severity', () => {
    for (const t of ['ghost_speech', 'dead_alive', 'phantom_call']) {
      assert.ok(en.includes(t), `en 层应包含 ${t}`);
    }
    assert.ok(en.includes('high'), 'en 层应含 high');
    assert.ok(en.includes('mid'), 'en 层应含 mid');
    assert.ok(en.includes('low'), 'en 层应含 low');
  });

  test('关键数字锚点与中文层同源', () => {
    assert.ok(en.includes('12 points'), '应含 ghost 首条 12 分');
    assert.ok(en.includes('10 points'), '应含 ghost 追加 10 分');
    assert.ok(en.includes('capped at 22'), '应含 ghost 封顶 22');
    assert.ok(en.includes('18 points'), '应含 dead 每条 18 分');
    assert.ok(en.includes('capped at 24'), '应含 dead 封顶 24');
    assert.ok(en.includes('7 points'), '应含 call 单处 7 分');
    assert.ok(en.includes('13 points'), '应含 call 多处 13 分');
    assert.ok(en.includes('capped at 13'), '应含 call 封顶 13');
    assert.ok(en.includes('3 lines'), '应含 3 行窗口');
    assert.ok(en.includes('+2 per pair'), '应含回归 +2/对');
    assert.ok(en.includes('capped at +4'), '应含回归封顶 +4');
    assert.ok(en.includes('< 20 chars'), '应含短正文豁免');
    assert.ok(en.includes('full 100'), '应含满分放行');
  });
});
