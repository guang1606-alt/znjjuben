/**
 * 信息密度检测器单元测试（v2.123）
 */
const test = require('node:test');
const assert = require('node:assert');
const { informationDensityScore } = require('../dist/engine/information-density-score.js');

// —— 测试剧本 ——
// 中文：信息密集的健康剧本（每场都有信息推进）
const ZH_HEALTHY = `场景一：林晚办公室
林晚：你到底是谁？为什么要接近我？
陆泽：其实我是你父亲派来保护你的人。
林晚：什么？原来你是他的人！
△林晚震惊，后退一步

场景二：咖啡馆
苏婉：我从今以后不再是你的朋友，你背叛了我。
林晚：真相是什么？你为什么要这样？
苏婉：因为你父亲三年前害死了我的家人！

场景三：医院
陆泽：我之所以接近你，是为了查明你父亲的真面目。
林晚：没想到他是这样的人……
苏婉：现在我们要联合起来，目标就是揭穿他。`;

// 中文：水戏过多的剧本（多场无信息推进）
const ZH_WATER = `场景一：办公室
林晚：今天天气真好，我们去外面走走吧。
陆泽：是啊，很不错，确实挺好的。
林晚：中午吃什么？
陆泽：随便吧，我都行的。

场景二：餐厅
林晚：这菜味道不错，挺合我口味。
陆泽：确实挺好吃的，下次再来。
林晚：下次再来吧，可以吗？
陆泽：好的，没问题。

场景三：公园
林晚：散步挺好的，确实不错。
陆泽：是啊很舒服，我也喜欢。
林晚：回去吧，时间不早了。
陆泽：好的，我们走吧。`;

// 中文：信息过载剧本（单场信息过多）
const ZH_OVERLOAD = `场景一：会议室
林晚：其实我是你父亲的人，我之所以接近你是为了保护你，因为三年前他害死了苏婉的家人，现在我们要联合起来揭穿他。
陆泽：没想到真相是这样，原来你才是真正的内鬼，可是我信任了你这么多年！
苏婉：从今以后我们不再是朋友，目标就是让你付出代价！`;

// 中文：开场无信息（钩子区空白）
const ZH_NO_HOOK = `场景一：办公室
林晚：今天天气真好，我们去走走吧。
陆泽：是啊，挺好的。

场景二：餐厅
林晚：这菜不错，挺好吃的。
陆泽：确实挺好吃的，下次再来。

场景三：会议室
林晚：其实我是你父亲的人，为了保护你。
陆泽：原来你是他的人！
苏婉：真相是三年前他害死了我家人。`;

// 中文：末段无信息（高潮区空白）
const ZH_NO_CLIMAX = `场景一：会议室
林晚：其实我是你父亲的人，为了保护你。
陆泽：原来你是他的人！
苏婉：真相是三年前他害死了我家人。

场景二：餐厅
林晚：这菜不错，挺好吃的。
陆泽：确实挺好吃的，下次再来。

场景三：公园
林晚：散步挺好的，确实不错。
陆泽：好的，我们走吧。`;

// 英文：信息密集
const EN_HEALTHY = `Scene 1: Office
Lin: Who are you? Why did you approach me?
Lu: Actually I am sent by your father to protect you.
Lin: What? Turns out you are his man!

Scene 2: Cafe
Su: From now on I am no longer your friend. You betrayed me.
Lin: What is the truth? Why?
Su: Because your father killed my family three years ago!

Scene 3: Hospital
Lu: The reason I approached you is to expose your father.
Lin: I never thought he was such a person.
Su: Now we must cooperate. The goal is to expose him.`;

// 英文：水戏
const EN_WATER = `Scene 1: Office
Lin: The weather is nice today, very nice indeed.
Lu: Yes, very nice, really nice weather.
Lin: What for lunch?
Lu: Anything is fine, I don't mind.

Scene 2: Cafe
Lin: The food is good, very tasty.
Lu: Yes, very tasty, we should come again.
Lin: Let's come again next time.
Lu: Okay, sure.`;

test('中文健康剧本应得高分（≥75）', () => {
  const res = informationDensityScore(ZH_HEALTHY, 'zh');
  assert.ok(res.score >= 75, `expected >=75, got ${res.score}`);
  assert.ok(res.totalInfoPushes >= 6, `expected >=6 pushes, got ${res.totalInfoPushes}`);
  assert.ok(res.waterSceneCount === 0, `water=${res.waterSceneCount}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `unexpected high issues: ${JSON.stringify(highIssues)}`);
});

test('水戏过多应触发 high 级问题', () => {
  const res = informationDensityScore(ZH_WATER, 'zh');
  assert.ok(res.waterSceneCount === 3, `water=${res.waterSceneCount}`);
  assert.ok(res.waterRatio > 0.4, `ratio=${res.waterRatio}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'too_many_water_scenes'));
  assert.ok(res.score < 70, `expected <70, got ${res.score}`);
});

test('信息过载应触发 mid 级问题', () => {
  const res = informationDensityScore(ZH_OVERLOAD, 'zh');
  assert.ok(res.overloadSceneCount >= 1, `overload=${res.overloadSceneCount}`);
  const overloadIssues = res.issues.filter((i) => i.type === 'info_overload');
  assert.ok(overloadIssues.length >= 1);
});

test('钩子区无信息应触发 high 级问题', () => {
  const res = informationDensityScore(ZH_NO_HOOK, 'zh');
  assert.strictEqual(res.hasInfoInFirstThird, false);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_info_in_hook_zone'));
});

test('高潮区无信息应触发 high 级问题', () => {
  const res = informationDensityScore(ZH_NO_CLIMAX, 'zh');
  assert.strictEqual(res.hasInfoInLastThird, false);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_info_in_climax_zone'));
});

test('英文健康剧本应得高分', () => {
  const res = informationDensityScore(EN_HEALTHY, 'en');
  assert.ok(res.score >= 70, `expected >=70, got ${res.score}`);
  assert.ok(res.totalInfoPushes >= 5, `pushes=${res.totalInfoPushes}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length === 0, `unexpected high: ${JSON.stringify(highIssues)}`);
});

test('英文水戏应触发问题', () => {
  const res = informationDensityScore(EN_WATER, 'en');
  assert.ok(res.waterSceneCount >= 1, `water=${res.waterSceneCount}`);
  assert.ok(res.issues.length >= 1, `expected issues, got ${res.issues.length}`);
  assert.ok(res.score < 90, `expected <90, got ${res.score}`);
});

test('信息推进应识别六类', () => {
  const res = informationDensityScore(ZH_HEALTHY, 'zh');
  const types = new Set(res.allHits.map((h) => h.type));
  assert.ok(types.size >= 3, `expected >=3 types, got ${types.size}: ${[...types].join(',')}`);
});

test('信息推进曲线应渐进上升', () => {
  const res = informationDensityScore(ZH_HEALTHY, 'zh');
  assert.ok(res.hasRisingProgression, 'expected rising progression');
});

test('英文层零中文（issue advice 字段不得含中文，当 lang=en）', () => {
  const res = informationDensityScore(EN_WATER, 'en');
  const chineseRe = /[一-鿿]/;
  for (const issue of res.issues) {
    assert.ok(!chineseRe.test(issue.evidence), `evidence 含中文: ${issue.evidence}`);
    assert.ok(!chineseRe.test(issue.advice), `advice 含中文: ${issue.advice}`);
  }
});

test('场景详情应返回完整字段', () => {
  const res = informationDensityScore(ZH_HEALTHY, 'zh');
  assert.ok(res.scenes.length >= 3);
  for (const s of res.scenes) {
    assert.ok(typeof s.index === 'number');
    assert.ok(typeof s.infoCount === 'number');
    assert.ok(typeof s.wordCount === 'number');
    assert.ok(['normal', 'water', 'overload'].includes(s.type));
  }
});

test('信息命中应包含场景序号和类型标签', () => {
  const res = informationDensityScore(ZH_HEALTHY, 'zh');
  assert.ok(res.allHits.length >= 5);
  for (const h of res.allHits) {
    assert.ok(typeof h.sceneIndex === 'number');
    assert.ok(['identity', 'motive', 'truth', 'relation', 'goal', 'reversal', 'evidence'].includes(h.type));
    assert.ok(typeof h.typeLabel === 'string' && h.typeLabel.length > 0);
  }
});

// c213："用证据演出来"的调查戏（录音/转账/空壳公司/抵押/复印件/律师/经侦）
// 曾因只认六类显性关键词被三场全判水戏
test('c213-中文：视听化实证揭示算信息推进，优质调查戏不得误判全场水戏', () => {
  const text = `场景1：老宅·夜
林小凡：我爸的表怎么在你手上？
△她悄悄按下手机录音键。
场景2：操场·日
林小凡：这三年我爸公司的三笔转账，收款人全是空壳公司。
场景3：办公室·日
△合同附件写明抵押物是家里仅剩的房子。
林小凡：我复印了十七份，律师和经侦一人一份。`;
  const res = informationDensityScore(text, 'zh');
  assert.strictEqual(res.totalScenes, 3);
  assert.strictEqual(res.waterSceneCount, 0, `三场都有实证揭示，水戏应为 0，实际 ${res.waterSceneCount}`);
  assert.strictEqual(res.overloadSceneCount, 0, '证据牌逐句摊牌、密度低，高潮场不应误判信息过载');
  assert.ok(res.allHits.some((h) => h.type === 'evidence'), '应存在 evidence 类型信息推进');
});

test('c213-英文：视听化实证揭示算信息推进，调查戏不得误判水戏', () => {
  const text = `SCENE 1: BEDROOM - NIGHT
(Jane presses record on her phone, the red dot blinking.)
JANE: Three transfers from Dad's company went to shell companies. The bank records prove it.
SCENE 2: OFFICE - NIGHT
JANE: A lawyer and the economic crimes unit already have copies.`;
  const res = informationDensityScore(text, 'en');
  assert.strictEqual(res.totalScenes, 2);
  assert.strictEqual(res.waterSceneCount, 0, `两场都有实证揭示，水戏应为 0，实际 ${res.waterSceneCount}`);
  assert.ok(res.allHits.some((h) => h.type === 'evidence'), 'should have evidence-type info pushes');
});
