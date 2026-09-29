const test = require('node:test');
const assert = require('node:assert');
const pb = require('../dist/engine/playbook.js');

test('创作内核：钩子库/平台/八模式方法论齐全', () => {
  assert.ok(pb.HOOK_TYPES.length >= 6, '黄金三秒钩子≥6型');
  assert.ok(pb.PLATFORMS.length >= 5, '平台尺度库≥5');
  const modes = ['interview', 'adapt', 'tags', 'novel', 'interactive', 'scene', 'hotspot', 'viral_reverse', 'hit_lab', 'long_ip'];
  modes.forEach((m) => assert.ok(pb.MODE_METHOD[m]?.length >= 2, `模式${m}有方法论`));
});

test('六岗位内功指令非空且能注入模式要点', () => {
  ['architect', 'character', 'writer', 'polish', 'compliance', 'market'].forEach((r) => {
    assert.ok(pb.buildRoleDirective(r).length > 20, `岗位${r}有内功`);
  });
  const d = pb.buildRoleDirective('architect', 'interactive');
  assert.ok(d.includes('分支必须闭环'), '互动模式要点被注入');
});

test('去AI化检测：AI腔文本被抓出并判不合格', () => {
  const aiText = '她嘴角勾起一抹弧度，不禁眼底闪过一丝冷意，空气仿佛凝固，时间仿佛静止。';
  const r = pb.antiAiScan(aiText);
  assert.ok(r.hits.includes('嘴角勾起') || r.hits.includes('勾起一抹'));
  assert.ok(r.hitCount >= 3);
  assert.strictEqual(r.pass, false, 'AI腔超标必须不通过');
});

test('去AI化检测：干净口语通过', () => {
  const human = '妈，我回来了。\n她没抬头，手里择着菜：“还知道回来？饭在锅里，自己盛。”';
  const r = pb.antiAiScan(human);
  assert.strictEqual(r.pass, true, '生活化口语应通过');
});

test('双制式字数闸门：区间正确', () => {
  const live = pb.validateEpisodeLength('字'.repeat(900), 'LIVE');
  assert.strictEqual(live.inRange, true);
  const aigcShort = pb.validateEpisodeLength('字'.repeat(900), 'AIGC');
  assert.strictEqual(aigcShort.inRange, false, '900字达不到AIGC下限1200');
  assert.strictEqual(pb.SCRIPT_FORMAT.LIVE.min, 800);
  assert.strictEqual(pb.SCRIPT_FORMAT.AIGC.max, 1500);
});

test('v1.99 七岗位英文系统内功零中文，默认中文逐字不变', () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const roles = ['architect', 'character', 'writer', 'audience', 'polish', 'compliance', 'market'];
  for (const r of roles) {
    assert.ok(!cjk(pb.buildRoleDirective(r, undefined, 'en')), `${r} 英文内功零中文`);
    assert.strictEqual(pb.buildRoleDirective(r), pb.buildRoleDirective(r, undefined, 'zh'), `${r} 默认中文不变`);
  }
  assert.strictEqual(pb.EPISODE_ARC_EN.length, 4);
  assert.ok(pb.EPISODE_ARC_EN.every((x) => !cjk(x)), '英文节奏弧零中文');
});

test('v2.00 八模式方法论英文层零中文，modeTip 随语言切换，中文默认不变', () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const modes = Object.keys(pb.MODE_METHOD);
  assert.strictEqual(modes.length, 10, '八模式+整合工作台+长IP共10条方法论（旧键保留兼容）');
  for (const m of modes) {
    assert.ok(pb.MODE_METHOD_EN[m] && pb.MODE_METHOD_EN[m].length === pb.MODE_METHOD[m].length, `${m} 英文要点条数对齐`);
    assert.ok(!cjk(JSON.stringify(pb.MODE_METHOD_EN[m])), `${m} 英文零中文`);
  }
  const enTip = pb.buildRoleDirective('writer', 'interview', 'en');
  assert.ok(enTip.includes('Mode essentials') && !cjk(enTip), '英文 modeTip 零中文');
  const zhTip = pb.buildRoleDirective('writer', 'interview');
  assert.ok(zhTip.includes('本模式要点'), '中文 modeTip 默认保留');
});
