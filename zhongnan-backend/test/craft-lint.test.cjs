const test = require('node:test');
const assert = require('node:assert');
const {
  villainLint, fillerLint, novelisticLint, dumbPayoffLint, agencyLint,
  parityLint, directnessLint, firstThreeLint, titleLint, threeQLint, craftLint,
} = require('../dist/engine/craft-lint.js');
const { recommendTrack, OVERSEA_PLAYBOOK, CROSS_CULTURE_PRINCIPLE, perEpisodeThreeQ, TRACK_STRATEGY } = require('../dist/engine/market-playbook.js');

test('villain: 低级骂街反派被识别为P1', () => {
  const r = villainLint('反派歇斯底里破口大骂，嘲讽他穷，叫保安把他赶出去');
  assert.ok(r.hit.length >= 2);
  assert.strictEqual(r.level, 'P1');
  assert.ok(r.score < 70);
});
test('villain: 平静的降维剥夺不报警', () => {
  const r = villainLint('领导轻描淡写把本该属于她的署名权给了别人');
  assert.strictEqual(r.hit.length, 0);
  assert.ok(r.score >= 90);
});
test('novelistic: 小说腔被抓并给可视化改法', () => {
  const r = novelisticLint('他薄唇微勾，眼角闪过三分讥笑四分漫不经心，心中一紧');
  assert.ok(r.hit.length >= 3);
  assert.strictEqual(r.level, 'P1');
  assert.ok(r.advice.includes('镜头'));
});
test('dumbPayoff: 下跪磕头耳光降智套路P1', () => {
  const r = dumbPayoffLint('她下跪磕头求他，对方几个巴掌扇来，还叫保安');
  assert.strictEqual(r.level, 'P1');
});
test('dumbPayoff: 认知打击规则反杀不报P1', () => {
  const r = dumbPayoffLint('她不哭不闹，在复盘会上放出修改记录，用合同条款和证据反将一局');
  assert.notStrictEqual(r.level, 'P1');
  assert.ok(r.score >= 70);
});
test('agency: 老好人只解释忍让无反击=P1', () => {
  const r = agencyLint('她委屈地说，你这样不对，我不与你计较，默默忍让，含泪转身离开');
  assert.strictEqual(r.level, 'P1');
});
test('agency: 当场甩证据反击不报P1', () => {
  const r = agencyLint('她当场甩出证据，反手取消婚约，淡淡开口让所有人后悔');
  assert.notStrictEqual(r.level, 'P1');
});
test('parity: 只压迫不兑付=情绪掉地P1', () => {
  const only = parityLint('她被欺负、被羞辱、被抢功劳、被赶出家门，受尽委屈');
  assert.strictEqual(only.level, 'P1');
  const paid = parityLint('她被欺负被羞辱，后来拿出证据反击，揭穿真相让对方后悔');
  assert.notStrictEqual(paid.level, 'P1');
});
test('directness: 开场模糊铺垫=P1，直接冲突不报警', () => {
  assert.strictEqual(directnessLint('她似乎好像慢慢逐渐了解到一些事情').level, 'P1');
  assert.notStrictEqual(directnessLint('婚礼当天婆婆逼她离婚，妹妹抢了她的位置').level, 'P1');
});
test('firstThree: 三集节奏打分', () => {
  const bad = firstThreeLint(['天气很好，介绍背景', '继续日常', '还是日常']);
  assert.ok(bad.score <= 34);
  const good = firstThreeLint(['她被逼离婚出事', '对方继续加码逼她', '她拿出证据决定反击']);
  assert.strictEqual(good.score, 100);
});
test('title: 散文式标题低分，冲突标题高分', () => {
  assert.ok(titleLint('那些年我们一起走过的漫长而温柔的岁月与时光').score < 60);
  assert.ok(titleLint('重生后我夺回千亿集团').score >= 80);
});
test('threeQ: 缺目标与阻拦被标missing', () => {
  const r = threeQLint('今天天气不错，她出门散步。');
  assert.ok(r.issue.hit.length >= 1);
  const ok = threeQLint('她想要夺回名额，主管百般阻拦，谁知她还藏着一份证据？');
  assert.strictEqual(ok.issue.score, 100);
});
test('craftLint 聚合返回avg与p1清单', () => {
  const r = craftLint({ title: '日常故事', text: '她心中五味杂陈，仿佛一般，眼角闪过三分讥笑，默默忍让，被欺负被羞辱，下跪磕头求他' });
  assert.ok(Array.isArray(r.issues) && r.issues.length >= 5);
  assert.ok(r.p1.length >= 1);
  assert.ok(r.avg >= 0 && r.avg <= 100);
});

test('market: recommendTrack 区分精品/下沉', () => {
  assert.strictEqual(recommendTrack('一场身份错位的高智商商战局中局'), 'premium');
  assert.strictEqual(recommendTrack('婆婆把她赶出家门逼她离婚逆袭打脸'), 'mass');
});
test('market: 两赛道即时/延迟满足', () => {
  assert.strictEqual(TRACK_STRATEGY.mass.gratification, '即时满足');
  assert.strictEqual(TRACK_STRATEGY.premium.gratification, '延迟满足');
});
test('market: 欧美要宿命感竞技虐恋、不要底层打脸', () => {
  assert.ok(/宿命感/.test(OVERSEA_PLAYBOOK.WEST.want));
  assert.ok(OVERSEA_PLAYBOOK.WEST.hotTopics.includes('狼人觉醒'));
});
test('market: 跨文化创新=人设/能力/爽点化', () => {
  assert.ok(CROSS_CULTURE_PRINCIPLE.check('她是女娲后人，用血脉能力压制吸血鬼').isPersonaOrPower);
  assert.ok(!CROSS_CULTURE_PRINCIPLE.check('停下来讲解中国历史').isPersonaOrPower);
});
test('market: 每集三问', () => {
  const q = perEpisodeThreeQ('她想要夺回合同，对手出面阻拦，谁知背后还藏着秘密？');
  assert.deepStrictEqual([q.want, q.block, q.whyNext], [true, true, true]);
});

test('v1.92 craft-lint lang=en：英文检测召回 + 全英文 dim/advice，零中文；默认中文不变', () => {
  const cjk = (o) => /[一-龥]/.test(JSON.stringify(o));
  const bad = 'She explained meekly and said tearfully let it go, forgive him spare him. He was hysterical, screamed you trash, call security, for no reason. A flicker of mockery in his eyes, heart tightened. She seems perhaps maybe slowly. She knelt down please spare me brainless. '.repeat(3);
  const r = craftLint({ title: 'a vague story', text: bad, lang: 'en' });
  assert.ok(!cjk(r.issues), '英文模式不得出现中文');
  const rules = r.issues.map((i) => i.rule);
  assert.ok(rules.includes('villain') && rules.includes('agency') && rules.includes('dumbPayoff'), '英文检测词应召回反派/能动性/降智');
  assert.ok(r.issues.every((i) => /[A-Za-z]/.test(i.dim) && /[A-Za-z]/.test(i.advice)));
  // threeQ 英文路径
  const q = threeQLint('nothing here at all xyz', 'en');
  assert.strictEqual(q.want, false);
  // 默认中文逐字不变
  const z = villainLint('他歇斯底里破口大骂，嘲讽他穷');
  assert.strictEqual(z.dim, '反派高级度');
});
