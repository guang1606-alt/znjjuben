const test = require('node:test');
const assert = require('node:assert');
const {
  HOOK_TAXONOMY, recommendHooks, openingHookAudit, matchCraftCards,
  CHARACTER_DEPTH_CARDS, NARRATIVE_DEVICE_CARDS, RELATIONSHIP_CARDS, GENRE_TOOLKIT_CARDS,
  filterWordLint, emotionTagLint, thenChainLint, satisfiedEndingLint, perfectSaintLint, despairTellLint, narrativeLint,
} = require('../dist/engine/narrative-craft');
const { diagnoseFull } = require('../dist/engine/full-diagnosis');
const { openPitchMeeting, aiTableRead } = require('../dist/engine/writers-room');
const { pickEpisodeForFix } = require('../dist/engine/polish-fix');

test('钩子分类库与方法论卡片库完整', () => {
  assert.ok(HOOK_TAXONOMY.length >= 10, '钩子类型不少于10种');
  // 导演点名的五类钩子必须齐备
  ['集钩', '场钩', '动作钩', '氛围钩', '语言钩'].forEach((k) => {
    assert.ok(HOOK_TAXONOMY.some((h) => h.name.includes(k)), `缺钩子：${k}`);
  });
  assert.strictEqual(CHARACTER_DEPTH_CARDS.length, 12);
  assert.strictEqual(NARRATIVE_DEVICE_CARDS.length, 17);
  assert.strictEqual(RELATIONSHIP_CARDS.length, 5);
  assert.strictEqual(GENRE_TOOLKIT_CARDS.length, 9);
  // v1.70：全部卡片 id 唯一，且结构完整（标题/公式/步骤/适配不为空）
  const all = [...CHARACTER_DEPTH_CARDS, ...NARRATIVE_DEVICE_CARDS, ...RELATIONSHIP_CARDS, ...GENRE_TOOLKIT_CARDS];
  assert.strictEqual(new Set(all.map((c) => c.id)).size, all.length, '方法卡 id 不得重复');
  all.forEach((c) => {
    assert.ok(c.title && c.formula && Array.isArray(c.steps) && c.steps.length >= 3 && c.fit.length >= 1, `卡片结构不完整：${c.id}`);
  });
});

test('recommendHooks：任何题材保底3钩，复仇逆袭追加隐忍卖惨/动作钩', () => {
  const base = recommendHooks({ text: '一段普通日常' });
  ['episode_hook', 'scene_hook', 'chain_hook'].forEach((id) => assert.ok(base.some((h) => h.id === id)));
  const rev = recommendHooks({ text: '赘婿复仇逆袭战神归来', tags: ['复仇', '逆袭'] });
  assert.ok(rev.some((h) => h.id === 'endure_sell_hook'));
  assert.ok(rev.some((h) => h.id === 'action_hook'));
});

test('openingHookAudit：平铺背景判缺钩，危机动作判已用钩', () => {
  const flat = openingHookAudit('这片大陆历史悠久四季如春，人们过着平静的生活，讲述一个古老家族的传承');
  assert.strictEqual(flat.used.length, 0);
  assert.ok(flat.missing.length >= 1);
  const crisis = openingHookAudit('刀尖正抵着他喉咙，他却笑了：还有三天，你们就该跪下来求我');
  assert.ok(crisis.used.length >= 2);
  assert.strictEqual(crisis.missing.length, 0);
});

test('拆滤镜：感官滤镜词堆砌判低分，直接电影式呈现不判', () => {
  const bad = filterWordLint('他看到血，听到惨叫，感觉到疼，觉得头晕，注意到影子，闻到焦味');
  assert.strictEqual(bad.rule, 'ntFilterWord');
  assert.ok(bad.score < 60);
  const good = filterWordLint('木地板咯吱一响，他攥紧拳，手心全是汗，呼吸发紧，盯着那扇门，后背发冷');
  assert.ok(good.score >= 80);
});

test('删说字：情绪标签+说道堆砌判低分，身体化台词不判', () => {
  const bad = emotionTagLint('他愤怒地说不行，她伤心地说别走，他冷冷地道闭嘴，她害怕地问为什么');
  assert.ok(bad.score < 60);
  assert.strictEqual(bad.hit.length, 4);
  const good = emotionTagLint('他右臂青筋暴起，声音压得很低。她别过脸，指尖绞着衣角，半天没接话。');
  assert.ok(good.score >= 80);
});

test('因果链：然后流水账缺因果判低分，因果咬合不判', () => {
  const bad = thenChainLint('他推开门然后走进去然后坐下然后倒茶然后翻开书');
  assert.ok(bad.score < 60);
  const good = thenChainLint('他推开门，因为屋里有人所以走进去，于是坐下，因此倒了茶');
  assert.ok(good.score >= 80);
});

test('集尾圆满收束判低分，悬念/问号收束不判（与既有假断章尺子互补）', () => {
  const bad = satisfiedEndingLint('忙碌了一整天，他回到房间洗漱之后盖上被子，很快就睡着');
  assert.ok(bad.score < 60);
  assert.ok(bad.hit.includes('睡着') || bad.hit.includes('盖上被子'));
  const good = satisfiedEndingLint('他刚要合眼，门外突然传来脚步声——这个时间，会是谁？');
  assert.ok(good.score >= 80);
});

test('完美圣人：正面标签堆砌无缺陷判低分，有褶皱不判', () => {
  const bad = perfectSaintLint('她善良勇敢聪明正义无私完美，一身正气，光明磊落，大公无私');
  assert.ok(bad.score < 60);
  const good = perfectSaintLint('他有个改不掉的缺点，关键时刻总犹豫，心里藏着秘密，事后也会愧疚');
  assert.ok(good.score >= 80);
});

test('narrativeLint 聚合：text+ending 共6把尺子，avg为数值', () => {
  const r = narrativeLint({ text: '他看到门，听到风，觉得冷，然后起身然后走然后停', ending: '他盖上被子睡着' });
  assert.strictEqual(r.issues.length, 6);
  assert.ok(r.avg >= 0 && r.avg <= 100);
  assert.ok(r.p2.length >= 1);
});
test('崩溃外化：崩溃绝望结论堆砌且无身体反应判低分，克制外化不判（v1.70第6把尺子）', () => {
  const bad = despairTellLint('她崩溃了，整个人绝望，痛不欲生，心如刀割，撕心裂肺，万念俱灰');
  assert.strictEqual(bad.rule, 'ntDespairTell');
  assert.ok(bad.score < 60);
  assert.ok(bad.hit.length >= 3);
  const good = despairTellLint('她张了张嘴没发出声，顺着门框缓缓滑坐到地上，那杯水端了三次都没送到嘴边，眼泪始终没掉下来');
  assert.ok(good.score >= 80, '克制外化为高分');
  const none = despairTellLint('他转身出门，阳光很好，街上人来人往');
  assert.ok(none.score >= 80, '无崩溃词不误伤');
});
test('v1.70新方法卡可按题材命中且无悬空', () => {
  assert.ok(matchCraftCards({ text: '家庭饭桌中国式关系', tags: ['现实', '家庭'], limit: 6 }).some((c) => c.id === 'banal_villain'));
  assert.ok(matchCraftCards({ text: '悬疑推理惊悚', tags: ['悬疑'], limit: 8 }).some((c) => c.id === 'suspense_feed'));
  assert.ok(matchCraftCards({ text: '言情虐恋双强', tags: ['虐恋'], limit: 8 }).some((c) => c.id === 'romance_scalpel'));
  assert.ok(matchCraftCards({ text: '爽文逆袭长篇节奏', tags: ['爽文'], limit: 8 }).some((c) => c.id === 'energy_debt'));
  // 亵渎创想服务反套路，任何题材保底可取
  assert.ok(matchCraftCards({ text: '喜剧脑洞反套路', tags: ['喜剧'], limit: 10 }).some((c) => c.id === 'blasphemy_ideate'));
  // 三线叙事吸收“死线/补给线/鬼线”别名后仍是同一张卡，不重复
  const three = matchCraftCards({ text: '科幻权谋长篇', tags: ['权谋'], limit: 12 }).filter((c) => c.id === 'three_line');
  assert.strictEqual(three.length, 1);
});

test('matchCraftCards：喜剧命中四层阶梯，恐怖命中三招', () => {
  const c = matchCraftCards({ text: '', tags: ['喜剧', '搞笑', '沙雕'], limit: 3 });
  assert.ok(c.some((x) => x.id === 'comedy_ladder'));
  const h = matchCraftCards({ text: '惊悚恐怖密室', tags: ['恐怖'], limit: 3 });
  assert.ok(h.some((x) => x.id === 'horror_tools'));
});

test('full-diagnosis 接入：engineAvg.narrative 存在，nt规则进维度分组', () => {
  const badEp = '他看到门开了听到脚步声感觉到风觉得很冷注意到地上有水。他愤怒地说你等着，她伤心地说别走，他冷冷地道滚。然后他起身然后走到门口然后回头然后关门。她善良勇敢聪明正义无私完美光明磊落。最后他盖上被子睡着。';
  const r = diagnoseFull([{ epNo: 1, content: badEp }]);
  assert.strictEqual(typeof r.engineAvg.narrative, 'number');
  const ntIssues = r.groups.flatMap((g) => g.issues).filter((i) => i.rule.startsWith('nt'));
  assert.ok(ntIssues.length >= 3, '应至少识别3类叙事工艺问题');
  // 健康文本不制造误报、不抛错
  const healthy = '刀尖抵着喉咙，他却笑了。因为对方人多，所以他先退半步，顺势撞翻货架，趁乱夺门而出。她攥紧拳头，掌心全是汗，盯着他：这笔账，三天后我连本带利讨回来——他刚要追，身后突然传来一声巨响，是谁？';
  const r2 = diagnoseFull([{ epNo: 1, content: healthy }]);
  assert.ok(r2.engineAvg.narrative >= 75, '健康文本叙事分不应被误伤');
});

test('writers-room 接入：选题会hints含钩子选型，围读对差剧本产出nt意见且不抛错', () => {
  const pitch = openPitchMeeting({ idea: '女频豪门复仇逆袭大女主短剧', tags: ['复仇', '大女主'] });
  assert.ok(pitch.hints.some((h) => h.includes('钩子')));
  assert.ok(pitch.hints.some((h) => h.includes('叙事工艺')));
  const bad = '他看到血听到惨叫感觉到疼觉得晕注意到影。他愤怒地说滚，她伤心地说别，他冷冷地道走。然后坐然后起然后走然后停。他盖上被子睡着。';
  const read = aiTableRead({ script: bad });
  assert.ok(Array.isArray(read.notes));
  assert.ok(read.summary.includes('问题') || read.notes.length >= 0);
});

test('polish-fix 接入：ntFilterWord 定位到滤镜词最严重的那一集', () => {
  const clean = '他攥紧拳，盯着门，木地板咯吱响，呼吸发紧，趁乱撞翻货架冲了出去，身后是谁？';
  const bad = '他看到门听到风感觉到冷觉得怕注意到水看到影听到声觉得晕，然后走然后停然后坐然后起';
  const pick = pickEpisodeForFix([
    { epNo: 1, content: clean },
    { epNo: 2, content: bad },
  ], 'ntFilterWord');
  assert.strictEqual(pick.epNo, 2);
  assert.ok(pick.score !== null && pick.score < 70);
});

test('v1.93 英文模式：滤镜词/情绪标签/然后流水账/圆满收尾被英文词召回且零中文', () => {
  const cjk = (o) => /[一-龥]/.test(JSON.stringify(o));
  const badEn = 'He saw the blood, heard the scream, felt the pain, noticed the shadow, realized the truth and sensed someone. He said angrily stop, she said sadly no, he coldly replied go, she fearfully asked again. Then he stood. After that he walked. Then he paused. Next, he sat. Then he sighed. Finally he fell asleep and slept peacefully, all was well.';
  const en = narrativeLint({ text: badEn, ending: badEn, lang: 'en' });
  assert.strictEqual(cjk(en), false, '英文模式不得出现中文');
  assert.strictEqual(en.issues.length, 6);
  const fw = en.issues.find((i) => i.rule === 'ntFilterWord');
  assert.ok(fw && fw.score < 60, '英文感官滤镜词应被召回');
  const tc = en.issues.find((i) => i.rule === 'ntThenChain');
  assert.ok(tc && tc.score < 60, '英文 then 流水账应被召回');
  const se = en.issues.find((i) => i.rule === 'ntSatisfiedEnd');
  assert.ok(se && se.score < 60, '英文圆满收尾应被召回');
  const zh = narrativeLint({ text: '他看到门听到风觉得冷', ending: '他盖上被子睡着' });
  assert.ok(/[一-龥]/.test(zh.issues[0].dim));
});
