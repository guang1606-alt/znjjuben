/**
 * v2.90 观众代言官模式适配回归：
 *  · 单条带货/种草（video_short/branded_skit）→ “转化欲评分”文案 + audience 指令含转化评估标准；
 *  · 连续剧模式/默认 → “追更欲评分”文案逐字保留（向后兼容）；
 *  · 英文链路 conversion 文案零中文。
 */
const test = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
const { runEpisode } = require('../dist/agents/pipeline.js');
const { ROLE_DIRECTIVE, ROLE_DIRECTIVE_EN } = require('../dist/engine/playbook.js');
const { EngineTier } = require('../dist/config/pricing.js');

function emptyBible() {
  return { worldview: '', characters: {}, timeline: [], foreshadow: [] };
}
const cjk = (s) => /[一-鿿]/.test(String(s));

test('video_short 模式：观众评分播报为“转化欲评分”而非“追更欲评分”', async () => {
  const events = [];
  await runEpisode(EngineTier.ECONOMY, emptyBible(), '便携榨汁杯带货口播', (e) => events.push(e), { mode: 'video_short' });
  const aud = events.find((e) => e.role === 'audience' && e.status === 'done');
  assert.ok(aud, '存在观众岗 done 事件');
  assert.ok(aud.note.includes('转化欲评分'), `实际 note: ${aud.note}`);
  assert.ok(!aud.note.includes('追更欲评分'), '不得再报追更欲');
});

test('branded_skit 模式同样走转化欲文案；默认（无模式）逐字保留“追更欲评分”', async () => {
  const ev1 = [];
  await runEpisode(EngineTier.ECONOMY, emptyBible(), '剧情软广短剧', (e) => ev1.push(e), { mode: 'branded_skit' });
  assert.ok(ev1.find((e) => e.role === 'audience' && e.status === 'done').note.includes('转化欲评分'));

  const ev2 = [];
  await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', (e) => ev2.push(e), {});
  assert.ok(ev2.find((e) => e.role === 'audience' && e.status === 'done').note.includes('追更欲评分'), '连续剧默认文案不得改变');
});

test('英文链路 video_short：Conversion-intent 文案且零中文', async () => {
  const events = [];
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), 'portable juicer sales pitch', (e) => events.push(e),
    { mode: 'video_short', lang: 'en', episodeCount: 3, episodeIndex: 0 });
  const aud = events.find((e) => e.role === 'audience' && e.status === 'done');
  assert.ok(aud.note.includes('Conversion-intent score'), `实际 note: ${aud.note}`);
  assert.ok(!cjk(aud.note), '英文播报零中文');
  assert.ok(!cjk(JSON.stringify(r.audience)), '英文观众报告零中文');
});

test('audience 岗位指令（中英双语）均注入转化欲评估标准', () => {
  assert.ok(ROLE_DIRECTIVE.audience.includes('转化欲'), '中文指令含转化欲');
  assert.ok(ROLE_DIRECTIVE.audience.includes('小黄车'), '中文指令含行动引导锚点');
  assert.ok(ROLE_DIRECTIVE_EN.audience.includes('conversion intent'), 'EN directive mentions conversion intent');
  assert.ok(!cjk(ROLE_DIRECTIVE_EN.audience), 'EN audience 指令零中文');
});

test('market 评分契约：overall 与六维均为 0-100 整数（防模型塞评语）', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保温杯种草短视频', () => {}, { mode: 'video_short' });
  assert.strictEqual(typeof r.market.overall, 'number', 'overall 必须是数字');
  assert.ok(r.market.overall >= 0 && r.market.overall <= 100, 'overall 在 0-100');
  for (const [k, v] of Object.entries(r.market.scores)) {
    assert.strictEqual(typeof v, 'number', `scores.${k} 必须是数字`);
    assert.ok(v >= 0 && v <= 100, `scores.${k} 在 0-100`);
  }
});
