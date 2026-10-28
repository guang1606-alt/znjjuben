/**
 * v2.328 意图路由：自然语言 → 9 种创作模式（零 LLM、确定性、可解释）
 * 覆盖：中文/英文/混合、等级可用性、名场面轨道、低置信澄清、自动别名
 */
const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/intent-router.js');
const { MemberLevel } = require('../dist/config/pricing.js');

const route = (brief, opts = {}) => R.routeIntent({ brief, ...opts });

test('短视频口播 → video_short，高置信', () => {
  const r = route('做个30秒抖音带货口播，前三秒要抓人，结尾有转化钩子', { level: MemberLevel.ADVANCED });
  assert.strictEqual(r.mode, 'video_short');
  assert.ok(r.confidence >= 0.6, `置信度应偏高，实际 ${r.confidence}`);
  assert.strictEqual(r.needsClarify, false);
});

test('电影长片三幕 → film（专业级）', () => {
  const r = route('写一部120分钟的电影长片，三幕结构，犯罪惊悚', { level: MemberLevel.PRO });
  assert.strictEqual(r.mode, 'film');
});

test('小说/同人/续写 → adapt（小说已并入改编）', () => {
  const r = route('把这本小说改成竖屏短剧，走同人续写线', { level: MemberLevel.BASIC });
  assert.strictEqual(r.mode, 'adapt');
});

test('热搜借势 → hot', () => {
  const r = route('追一下微博热搜，借势做个热点剧', { level: MemberLevel.ADVANCED });
  assert.strictEqual(r.mode, 'hot');
});

test('互动分支多结局 → interactive', () => {
  const r = route('做一个互动剧，有分支和多结局，玩家的选择决定结局', { level: MemberLevel.BASIC });
  assert.strictEqual(r.mode, 'interactive');
});

test('拆解爆款批量换皮 → hit_lab 且走爆款逆向轨道', () => {
  const r = route('拆解这部剧的爆款结构，批量换皮出新本', { level: MemberLevel.PRO });
  assert.strictEqual(r.mode, 'hit_lab');
  assert.strictEqual(r.track, 'hit_reverse');
  assert.match(R.describeRoute(r), /爆款逆向批量/);
});

test('名场面拓展 → hit_lab 且默认名场面轨道', () => {
  const r = route('围绕这个名场面往前铺因、往后延果', { level: MemberLevel.ADVANCED });
  assert.strictEqual(r.mode, 'hit_lab');
  assert.strictEqual(r.track, 'signature_scene');
});

test('爆款逆向轨道为专业版：高级用户自动降级名场面并说明', () => {
  const r = route('拆解这部剧的爆款结构，批量换皮出新本', { level: MemberLevel.ADVANCED });
  assert.strictEqual(r.mode, 'hit_lab');
  assert.strictEqual(r.track, 'signature_scene');
  assert.ok(r.reasons.some((x) => x.includes('专业版')));
});

test('多季长系列 → long_ip', () => {
  const r = route('做一部多季长系列，第一季就要埋跨季伏笔，世界观要立住', { level: MemberLevel.PRO });
  assert.strictEqual(r.mode, 'long_ip');
});

test('模糊短句 → interview 并标记需要澄清', () => {
  const r = route('还没想好', { level: MemberLevel.BASIC });
  assert.strictEqual(r.mode, 'interview');
  assert.strictEqual(r.needsClarify, true);
  assert.ok(r.reasons.some((x) => x.includes('采访式创作')));
});

test('零信号 + FREE：不硬猜高等级模式，落到标签创建并需澄清', () => {
  const r = route('', { level: MemberLevel.FREE });
  assert.strictEqual(r.mode, 'tag');
  assert.strictEqual(r.confidence, 0);
  assert.strictEqual(r.needsClarify, true);
});

test('等级不足时不推荐高等级模式，并如实说明更强的被锁候选', () => {
  const r = route('做个30秒抖音带货口播，前三秒要抓人', { level: MemberLevel.FREE });
  assert.notStrictEqual(r.mode, 'video_short');
  assert.ok(r.reasons.some((x) => x.includes('短视频') && x.includes('ADVANCED')), r.reasons.join('|'));
});

test('英文 brief 同样可路由', () => {
  const r = route('I want a 30s TikTok voiceover with a strong hook for my brand', { level: MemberLevel.ADVANCED });
  assert.strictEqual(r.mode, 'video_short');
});

test('结构化标签参与打分：标签多时 tag 进入候选', () => {
  const r = route('帮我出个本', { level: MemberLevel.FREE, tags: ['逆袭', '都市', '复仇'] });
  assert.strictEqual(r.mode, 'tag');
});

test('同一输入结果完全确定（可回归）', () => {
  const a = route('把这部小说改编成短剧，做续写', { level: MemberLevel.BASIC });
  const b = route('把这部小说改编成短剧，做续写', { level: MemberLevel.BASIC });
  assert.deepStrictEqual(a, b);
});

test('自动模式别名可识别，普通模式不误判', () => {
  ['auto', 'AUTO', 'smart', 'recommend', ' auto '].forEach((x) => assert.strictEqual(R.isAutoMode(x), true));
  ['film', 'tags', 'video_short', ''].forEach((x) => assert.strictEqual(R.isAutoMode(x), false));
});
