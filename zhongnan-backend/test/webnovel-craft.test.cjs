const test = require('node:test');
const assert = require('node:assert');
const {
  cliffhangerQuality, goldenFingerCost, showByChoice, characterEcosystem,
  backcastOutline, emotionDebtChain, deathEmotion, partnerInCrime, webnovelLint,
} = require('../dist/engine/webnovel-craft.js');
const { GENRE_COMPENSATION, matchGenreByPain, FAMILIAR_TWIST } = require('../dist/engine/genre-compensate.js');

test('流派库覆盖11类且字段完整', () => {
  assert.strictEqual(GENRE_COMPENSATION.length, 11);
  GENRE_COMPENSATION.forEach((g) => assert.ok(g.realityPain && g.compensation && g.coreTechnique && g.shortDramaFit));
});

test('按诉求匹配流派：后悔重来→重生流', () => {
  const r = matchGenreByPain('我想写一个女主后悔爱错人想重来改写遗憾的故事');
  assert.strictEqual(r[0].id, 'rebirth');
});

test('旧瓶新酒：熟悉+反常才通过', () => {
  assert.strictEqual(FAMILIAR_TWIST.check(true, true).ok, true);
  assert.strictEqual(FAMILIAR_TWIST.check(false, true).ok, false);
});

test('断章点：开打前狠话=伪断章 P1；报应前1秒=优', () => {
  const fake = cliffhangerQuality('主角一脚踹开大门，拔剑指着反派大喊：今天就是你的死期！');
  assert.strictEqual(fake.level, 'P1');
  assert.ok(fake.score < 50);
  const real = cliffhangerQuality('反派掏出免死金牌嚣张大笑，主角一言不发一刀劈碎，刀锋直逼眉心，就在这时');
  assert.ok(real.score >= 85);
});

test('金手指：无代价大礼包 P1；带寿命代价通过', () => {
  const bad = goldenFingerCost('主角绑定系统，获得新手大礼包，从此一路开挂');
  assert.strictEqual(bad.level, 'P1');
  const good = goldenFingerCost('系统每次使用都要透支寿命，等价交换，主角在悬崖上走钢丝');
  assert.ok(good.score > bad.score);
});

test('立人：堆形容词无绝境 P1；绝境选择通过', () => {
  const bad = showByChoice('他是个杀伐果断、冷酷无情、不怒自威、气场强大的男人');
  assert.strictEqual(bad.level, 'P1');
  const good = showByChoice('仇人拿刀架在白月光脖子上逼他下跪，他要么断一条胳膊要么看着爱人去死，最终他毫不犹豫一剑斩断退路');
  assert.ok(good.score > bad.score);
});

test('人设铁三角：齐全满分，残缺低分', () => {
  const full = characterEcosystem('跋扈富二代靠关系抢了老实兢兢业业打工人的功劳，主角最终揭穿并连根拔起完成清算');
  assert.strictEqual(full.score, 100);
  const weak = characterEcosystem('主角在花园里喝茶看云');
  assert.ok(weak.score < 70);
});

test('终局倒推：有结局+因果链通过，顺写流水账 P1', () => {
  const good = backcastOutline('大结局主角登顶成为三界共主。为了登顶他必须集齐五剑，需要潜伏魔宗，因为全家被杀所以开局有痛点');
  assert.ok(good.score >= 80);
  const bad = backcastOutline('第一天他出门，然后吃饭，接着逛街，第二天再看看');
  assert.strictEqual(bad.level, 'P1');
});

test('情绪债链：兑付后无更大钩子→提示', () => {
  const ends = emotionDebtChain('主角终于砍死仇人，大仇得报，赢了，故事圆满结束');
  assert.ok(ends.score < 70);
  const roll = emotionDebtChain('他砍死仇人夺回一切，却从仇人怀里摸出密信，背后另有更大的幕后主使');
  assert.ok(roll.score > ends.score);
});

test('死亡催泪：纯血腥 P1；未来债+痕迹债高分', () => {
  const gory = deathEmotion('将军身中数刀、万箭穿心、吐血留下遗言后惨死');
  assert.strictEqual(gory.level, 'P1');
  const tear = deathEmotion('他出征前答应女儿桃花开了就带她放风筝。死后第二天，母亲还是下意识多摆了一副碗筷，再也没有人回答');
  assert.ok(tear.score > gory.score);
});

test('灵魂共犯：花瓶低分，共谋高分', () => {
  const vase = partnerInCrime('女主躲在男主身后说哥哥你好棒我好怕别丢下我');
  assert.ok(vase.score < 60);
  const acc = partnerInCrime('她不问对错，已提前切断敌人退路，两人共享一个秘密，相视一笑');
  assert.ok(acc.score > vase.score);
});

test('聚合 webnovelLint 输出 issues/avg/p1', () => {
  const r = webnovelLint({ text: '主角绑定系统获得新手大礼包，他杀伐果断冷酷无情', ending: '今天就是你的死期' });
  assert.ok(r.issues.length >= 3);
  assert.ok(r.p1.length >= 1);
  assert.ok(r.avg >= 0 && r.avg <= 100);
});

test('v1.93 英文模式：英文差脚本被英文词召回且输出零中文，默认中文维度不变', () => {
  const cjk = (o) => /[一-龥]/.test(JSON.stringify(o));
  const badEn = 'The system gives a starter pack, a free reward obtained for free, no cost, effortlessly gained, handed directly, unlimited points with nothing taken in return. He hides behind her and says you are so amazing, protect me, do not leave me. He kills him, today is the day you die, die now.';
  const en = webnovelLint({ text: badEn, ending: badEn, lang: 'en' });
  assert.strictEqual(cjk(en), false, '英文模式不得出现中文');
  assert.ok(en.issues.length >= 3);
  const gf = en.issues.find((i) => i.rule === 'goldenFinger');
  assert.ok(gf && gf.score < 70, '英文免费金手指应被召回');
  const zh = webnovelLint({ text: '主角绑定系统获得新手大礼包', ending: '今天就是你的死期' });
  assert.ok(/[一-龥]/.test(zh.issues[0].dim));
});
