const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../dist/config/modes');
const P = require('../dist/agents/pipeline');

// v2.331：v2.329 把互动剧/短视频/软广/电影/长系列从「模式」下沉为「剧本类型」，
// 新路径（8 模式 + 类型）不再经过 LEGACY_CRAFT_KEY；此处守住「类型补位方法论」，
// 保证新老两条路径拿到同等工艺，内核创作能力不被入口重组削弱。

test('scriptTypeCraftKeyOf：下沉为类型的形态仍指回各自方法论', () => {
  assert.equal(M.scriptTypeCraftKeyOf('short_video'), 'video_short');
  assert.equal(M.scriptTypeCraftKeyOf('ad_script'), 'video_short');
  assert.equal(M.scriptTypeCraftKeyOf('promo_script'), 'video_short');
  assert.equal(M.scriptTypeCraftKeyOf('interactive_drama'), 'interactive');
  // v2.332 互动影游：独立方法论（多选项/支线/线索链/路线门控），不复用互动剧
  assert.equal(M.scriptTypeCraftKeyOf('interactive_game'), 'interactive_game');
  assert.equal(M.scriptTypeCraftKeyOf('feature_film'), 'film');
  assert.equal(M.scriptTypeCraftKeyOf('long_series'), 'long_ip');
  // 与模式方法论同源的形态不重复登记（真人短剧/AIGC/电视剧共用模式方法论）
  for (const none of ['live_action_drama', 'aigc_drama', 'tv_series', '', null, undefined, 'nope']) {
    assert.equal(M.scriptTypeCraftKeyOf(none), undefined, `${none} 不应有独立方法论`);
  }
});

test('spark + 广告/短视频类型：补回 3 秒钩子·每镜口播·CTA 方法论', () => {
  const ad = P.buildTypeCraftDirective('ad_script', 'adapt', 1, 10, 'zh');
  assert.match(ad, /爆款短视频脚本模式/);
  assert.match(ad, /3 秒钩子/);
  assert.match(ad, /≤20 字/);
  assert.match(ad, /主行动/);
  const softAd = P.buildTypeCraftDirective('ad_script', 'adapt', 1, 10, 'zh');
  assert.match(softAd, /品牌是解题者不是主角/, '软广子轨道随类型补位');
  const en = P.buildTypeCraftDirective('short_video', 'hit_lab', 1, 10, 'en');
  assert.match(en, /VIRAL SHORT-VIDEO/);
  assert.match(en, /CTA/);
  assert.equal(/[\u4e00-\u9fa5]/.test(en), false, '英文指令不混中文');
});

test('tag + 互动剧类型：补回真选择·分支闭环方法论', () => {
  const zh = P.buildTypeCraftDirective('interactive_drama', 'tag', 1, 10, 'zh');
  assert.match(zh, /互动短剧模式/);
  assert.match(zh, /真选择/);
  assert.match(zh, /分支必须闭环/);
  const en = P.buildTypeCraftDirective('interactive_drama', 'tag', 1, 10, 'en');
  assert.match(en, /INTERACTIVE SHORT-DRAMA/);
});

test('v2.332 tag + 互动影游类型：补回多选项·线索链·路线门控方法论', () => {
  const zh = P.buildTypeCraftDirective('interactive_game', 'tag', 1, 10, 'zh');
  assert.match(zh, /互动影游模式/);
  assert.match(zh, /线索/);
  assert.match(zh, /路线门控/);
  assert.match(zh, /支线/);
  assert.match(zh, /选择即状态/);
  const en = P.buildTypeCraftDirective('interactive_game', 'tag', 1, 10, 'en');
  assert.match(en, /INTERACTIVE FILM-GAME/);
  assert.match(en, /clue/i);
  assert.equal(/[\u4e00-\u9fa5]/.test(en), false, '英文指令不混中文');
});

test('persona + 电影类型：补回三幕片段定位（按集序推导幕次）', () => {
  const first = P.buildTypeCraftDirective('feature_film', 'persona', 1, 40, 'zh');
  assert.match(first, /本片段三幕定位/);
  assert.match(first, /第一幕/);
  const climax = P.buildTypeCraftDirective('feature_film', 'persona', 30, 40, 'zh');
  assert.match(climax, /第三幕/);
});

test('multiverse + 长系列类型：补回跨季连续性方法论', () => {
  const zh = P.buildTypeCraftDirective('long_series', 'multiverse', 1, 12, 'zh');
  assert.ok(zh.length > 0, '长系列类型必须有跨季方法论');
  assert.equal(P.buildTypeCraftDirective('long_series', 'multiverse', 1, 12, 'en').includes('【'), false);
});

test('历史项目不双注入：模式 key 已是该形态时返回空串', () => {
  assert.equal(P.buildTypeCraftDirective('short_video', 'video_short', 1, 10, 'zh'), '');
  assert.equal(P.buildTypeCraftDirective('ad_script', 'video_short', 1, 10, 'zh'), '');
  assert.equal(P.buildTypeCraftDirective('interactive_drama', 'interactive', 1, 10, 'zh'), '');
  assert.equal(P.buildTypeCraftDirective('feature_film', 'film', 5, 40, 'zh'), '');
  assert.equal(P.buildTypeCraftDirective('long_series', 'long_ip', 1, 10, 'zh'), '');
});

test('无类型 / 共用方法论的形态：不产生额外指令', () => {
  assert.equal(P.buildTypeCraftDirective(undefined, 'tag', 1, 10, 'zh'), '');
  assert.equal(P.buildTypeCraftDirective('live_action_drama', 'interview', 1, 10, 'zh'), '');
  assert.equal(P.buildTypeCraftDirective('tv_series', 'hot', 1, 10, 'zh'), '');
});
