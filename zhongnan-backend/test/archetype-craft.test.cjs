const test = require('node:test');
const assert = require('node:assert');
const {
  archetypeLint, matchArchetype, villainCheapLint, systemGachaLint, flatOpeningLint,
  saintMaryLint, subtextLint, staticPortraitLint, hystericalLint,
  PROTAG_ARCHETYPES, VILLAIN_ARCHETYPES, SYSTEM_MECHANICS,
} = require('../dist/engine/archetype-craft');
const { diagnoseFull } = require('../dist/engine/full-diagnosis');
const { openPitchMeeting } = require('../dist/engine/writers-room');

test('原型库完整：6主角/6反派/5系统机制', () => {
  assert.strictEqual(PROTAG_ARCHETYPES.length, 6);
  assert.strictEqual(VILLAIN_ARCHETYPES.length, 6);
  assert.strictEqual(SYSTEM_MECHANICS.length, 5);
});

test('matchArchetype：女频复仇命中大女主/修罗，系统文给机制建议', () => {
  const m1 = matchArchetype({ text: '女频豪门重生复仇，女主被背叛后强势回归', tags: ['复仇'] });
  assert.ok(m1.protag.some((p) => p.id === 'iron_queen' || p.id === 'asura_with_heart'));
  assert.ok(m1.villain.length >= 0);
  const m2 = matchArchetype({ text: '都市系统流金手指面板升级', tags: ['系统'] });
  assert.ok(m2.system.length >= 1);
  const m3 = matchArchetype({ text: '一段完全无关的日常描述' });
  assert.strictEqual(m3.system.length, 0);
});

test('反派廉价化：嘴臭送经验判P1低分，优雅高智商不判', () => {
  const bad = villainCheapLint('你个穷逼废物，给我上，哈哈哈，打死他，臭东西滚出去');
  assert.strictEqual(bad.level, 'P1');
  assert.ok(bad.score < 50);
  const good = villainCheapLint('他平静地倒了杯茶，欣赏你的才华，为了世界新秩序，你今天必须死');
  assert.notStrictEqual(good.level, 'P1');
  assert.ok(good.score >= 80);
});

test('系统小卖部：明码标价无成瘾机制判P1，盲盒/代价不判，非系统文中立', () => {
  const bad = systemGachaLint('系统提示任务完成奖励500积分，他去商城用积分兑换并购买了一把剑，立即获得装备');
  assert.strictEqual(bad.level, 'P1');
  assert.ok(bad.score < 50);
  const good = systemGachaLint('系统不给神器，只给一次随机抽奖，概率未知，而且使用有反噬代价');
  assert.notStrictEqual(good.level, 'P1');
  assert.ok(good.score >= 80);
  const none = systemGachaLint('今天天气很好，两个人去公园散步聊天');
  assert.strictEqual(none.score, 80);
});

test('开篇：前500字堆背景无危机判P1，开局即绝境不判', () => {
  const bad = flatOpeningLint('这片大陆上有一个古老家族，据说是世界传说，宗门记载着王朝历史，世代沿袭的背景');
  assert.strictEqual(bad.level, 'P1');
  assert.ok(bad.score < 50);
  const good = flatOpeningLint('他跪在死牢里，刀架在脖子上，三天后问斩，债主逼上门羞辱他');
  assert.notStrictEqual(good.level, 'P1');
  assert.ok(good.score >= 85);
});

test('圣母强行和解：复仇语境下原谅判P1', () => {
  const bad = saintMaryLint('她被背叛和羞辱，最后却心软选择原谅他，说了句算了吧');
  assert.strictEqual(bad.level, 'P1');
  assert.ok(bad.score < 50);
  const good = saintMaryLint('她冷静收集证据，一步步布局夺回属于自己的公司，绝不回头');
  assert.notStrictEqual(good.level, 'P1');
});

test('台词潜台词：直白情报问答低分，动作沉默承载高分', () => {
  const bad = subtextLint('你听我解释，我告诉你真相，你知道吗，难道你不知道我多辛苦');
  assert.ok(bad.score < 55);
  const good = subtextLint('她没抬头，顿了顿给他倒水，沉默片刻后冷笑，把话岔开');
  assert.ok(good.score >= 80);
});

test('静态外貌：堆形容词低分，命运细节高分', () => {
  const bad = staticPortraitLint('他剑眉星目、俊美无双、绝世容颜、完美无瑕，五官精致');
  assert.ok(bad.score < 55);
  const good = staticPortraitLint('他右手虎口有一层树皮般的老茧，阴雨天旧伤会微微颤抖');
  assert.ok(good.score >= 80);
});

test('情绪爆发：工整控诉低分，生理/反常克制高分', () => {
  const bad = hystericalLint('儿子死了，她哭喊为什么，老天爷你不公平，你还我儿子啊');
  assert.ok(bad.score < 55);
  const good = hystericalLint('弟弟死了，他什么都没说，蹲下盯着地上的鞋，双手颤抖得握不住水杯');
  assert.ok(good.score >= 80);
  const none = hystericalLint('两人一起吃了顿平静的晚饭');
  assert.strictEqual(none.score, 80);
});

test('archetypeLint 聚合：text 输入产出7把尺子与均分/P1', () => {
  const r = archetypeLint({ text: '一段普通文本，主角走在路上，和朋友打招呼。' });
  assert.strictEqual(r.issues.length, 7);
  assert.ok(r.avg >= 0 && r.avg <= 100);
  assert.ok(Array.isArray(r.p1));
});

test('集成诊断：坏文本的 at* 问题进入 topFixes，engineAvg 带 archetype', () => {
  const badEp = '这片大陆上有一个古老家族，据说是世界传说，宗门记载王朝历史世代背景。'
    + '反派跳出来骂：你个穷逼废物，给我上，哈哈哈打死他。'
    + '系统提示任务完成奖励500积分，他去商城积分兑换购买一把剑获得装备。'
    + '他剑眉星目俊美无双绝世容颜完美无瑕。你听我解释我告诉你你知道吗。';
  const d = diagnoseFull([{ epNo: 1, title: '第一集', content: badEp }]);
  assert.ok(typeof d.engineAvg.archetype === 'number');
  assert.ok(d.topFixes.some((f) => f.rule.startsWith('at')));
});

test('集成选题会：复仇系统题材 hints 注入原型与系统机制建议', () => {
  const p = openPitchMeeting({ idea: '女频复仇系统流，女主被豪门背叛后靠面板逆袭', tags: ['复仇', '系统', '豪门'] });
  assert.ok(p.hints.some((h) => h.includes('主角原型')));
  assert.ok(p.hints.some((h) => h.includes('系统') ));
});

test('v1.93 英文模式：廉价反派/系统小卖部被英文词召回且零中文，默认中文维度不变', () => {
  const cjk = (o) => /[一-龥]/.test(JSON.stringify(o));
  const badEn = 'On this continent an ancient clan, it is said in legend, for generations the sect dynasty history is recorded as background. The villain yells: you trash, you loser, get him, all at once, hahaha, beat him. System quest reward obtained, points exchange shop purchase, quest reward obtained, deducted points and redeem gear. He is gorgeous with peerless beauty and flawless exquisite features. Let me explain, you know what, I’m telling you.';
  const en = archetypeLint({ text: badEn, opening: badEn, lang: 'en' });
  assert.strictEqual(cjk(en), false, '英文模式不得出现中文');
  const cheap = en.issues.find((i) => i.rule === 'atVillainCheap');
  assert.ok(cheap && cheap.level === 'P1', '英文嘴臭廉价反派应判 P1');
  const shop = en.issues.find((i) => i.rule === 'atSystemShop');
  assert.ok(shop && shop.level === 'P1', '英文系统小卖部应判 P1');
  const zh = archetypeLint({ text: '一段普通文本，主角走在路上。', opening: '他走在路上。' });
  assert.ok(/[一-龥]/.test(zh.issues[0].dim));
});
