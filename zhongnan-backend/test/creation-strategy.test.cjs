const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/creation-strategy.js');
const D = require('../dist/engine/dialogue.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.28 节奏5策略/台词5策略齐全、字段完整、英文层零中文', () => {
  assert.deepStrictEqual(C.PACE_IDS, ['standard', 'fastcut', 'suspense_burn', 'emotional_wave', 'cinematic']);
  assert.deepStrictEqual(C.DIALOGUE_IDS, ['natural', 'street', 'sharp', 'elegant', 'youthful']);
  C.PACE_STRATEGIES.forEach((s) => {
    ['name', 'nameEn', 'tagline', 'taglineEn', 'fit', 'fitEn', 'directiveZh', 'directiveEn', 'turnCadence', 'turnCadenceEn', 'blankRatio', 'blankRatioEn'].forEach((k) => assert.ok(String(s[k] ?? '').length >= 2, `pace ${s.id}.${k}`));
    assert.ok(Array.isArray(s.scenesPerEp) && s.scenesPerEp[0] >= 1 && s.scenesPerEp[1] >= s.scenesPerEp[0]);
    assert.ok(!cjk(s.nameEn + s.taglineEn + s.fitEn + s.directiveEn + s.turnCadenceEn + s.blankRatioEn), `${s.id} 英文含中文`);
  });
  C.DIALOGUE_STRATEGIES.forEach((s) => {
    ['name', 'nameEn', 'tagline', 'taglineEn', 'fit', 'fitEn', 'directiveZh', 'directiveEn', 'sentence', 'sentenceEn'].forEach((k) => assert.ok(String(s[k] ?? '').length >= 2, `dlg ${s.id}.${k}`));
    assert.ok(['low', 'mid', 'high'].includes(s.colloquial));
    assert.ok(!cjk(s.nameEn + s.taglineEn + s.fitEn + s.directiveEn + s.sentenceEn), `${s.id} 英文含中文`);
  });
});

test('v2.28 台词策略口语档位与 dialogue 引擎一致（street=high / sharp,elegant=low / natural=mid）', () => {
  assert.strictEqual(C.getDialogueStrategy('street').colloquial, 'high');
  assert.strictEqual(C.getDialogueStrategy('sharp').colloquial, 'low');
  assert.strictEqual(C.getDialogueStrategy('elegant').colloquial, 'low');
  assert.strictEqual(C.getDialogueStrategy('youthful').colloquial, 'high');
  assert.strictEqual(C.getDialogueStrategy('natural').colloquial, 'mid');
  // 档位必须是 dialogue 引擎认识的合法值
  C.DIALOGUE_STRATEGIES.forEach((s) => assert.ok(D.COLLOQUIAL[s.colloquial]));
});

test('v2.28 系统智能推荐：题材确定性命中，无信号回退标准/自然', () => {
  assert.strictEqual(C.recommendPace({ text: '刑侦悬疑破案烧脑' }).id, 'suspense_burn');
  assert.strictEqual(C.recommendPace({ text: 'a fast binge revenge action' }).id, 'fastcut');
  assert.strictEqual(C.recommendPace({ tags: ['甜宠', '家庭亲情'] }).id, 'emotional_wave');
  assert.strictEqual(C.recommendPace({ text: '精品电影感文艺' }).id, 'cinematic');
  assert.strictEqual(C.recommendPace({ text: '普通职场' }).id, 'standard');
  assert.strictEqual(C.recommendDialogue({ text: '乡村乡土接地气方言' }).id, 'street');
  assert.strictEqual(C.recommendDialogue({ text: '商战机锋权谋对峙' }).id, 'sharp');
  assert.strictEqual(C.recommendDialogue({ text: '古装历史宫廷' }).id, 'elegant');
  assert.strictEqual(C.recommendDialogue({ text: '校园青春吐槽梗' }).id, 'youthful');
  assert.strictEqual(C.recommendDialogue({ text: '普通故事' }).id, 'natural');
  // 确定性
  assert.strictEqual(C.recommendPace({ text: '谍战' }).id, C.recommendPace({ text: '谍战' }).id);
});

test('v2.28 推荐理由双语：默认标注、英文零中文', () => {
  const d = C.recommendDialogue({ text: '古装' });
  assert.ok(d.reason.includes('克制规整') && d.auto === false);
  const en = C.recommendPace({ text: 'spy crime mystery' });
  assert.ok(/suspense/i.test(en.reasonEn) && !cjk(en.reasonEn));
  const def = C.recommendPace({ text: 'x' });
  assert.ok(def.auto && def.reason.includes('标准张弛'));
});

test('v2.28 用户显式优先 > 系统推荐；非法值回退；校验器守边界', () => {
  assert.strictEqual(C.resolvePaceId('cinematic', { text: '悬疑' }), 'cinematic');
  assert.strictEqual(C.resolvePaceId(undefined, { text: '悬疑' }), 'suspense_burn');
  assert.strictEqual(C.resolvePaceId('bad', { text: '悬疑' }), 'suspense_burn');
  assert.strictEqual(C.resolveDialogueId('street', { text: '古装' }), 'street');
  assert.strictEqual(C.resolveDialogueId(null, { text: '古装' }), 'elegant');
  assert.ok(C.isValidPace('fastcut') && !C.isValidPace('nope'));
  assert.ok(C.isValidDialogue('sharp') && !C.isValidDialogue('nope'));
  assert.strictEqual(C.getPaceStrategy('不存在').id, 'standard');
  assert.strictEqual(C.getDialogueStrategy().id, 'natural');
});

test('v2.28 指令构建：中英双语、含策略名与执行要点', () => {
  const zh = C.paceDirective('fastcut', 'zh');
  assert.ok(zh.includes('快剪强冲') && zh.includes('场景短'));
  const en = C.paceDirective('fastcut', 'en');
  assert.ok(/fast-cut/i.test(en) && !cjk(en));
  const dz = C.dialogueDirective('street', 'zh');
  assert.ok(dz.includes('市井烟火') && dz.includes('不生造方言'));
  const de = C.dialogueDirective('youthful', 'en');
  assert.ok(/meme/i.test(de) && !cjk(de));
});

test('v2.28 listPace/listDialogue 双语说明卡数量一致', () => {
  assert.strictEqual(C.listPace('zh').length, 5);
  assert.strictEqual(C.listDialogue('en').length, 5);
  const en = C.listPace('en')[1];
  assert.ok(!cjk(JSON.stringify(en)) && en.scenesPerEp.length === 2);
});

test('v2.29 情绪/爽点曲线5策略：字段完整、英文零中文、风味id全部合法', () => {
  assert.deepStrictEqual(C.EMOTION_IDS, ['balanced', 'payoff_dense', 'angst_tug', 'sweet_heal', 'twist_puzzle']);
  assert.strictEqual(C.listEmotion('zh').length, 5);
  const B = require('../dist/engine/beat-system.js');
  C.EMOTION_STRATEGIES.forEach((s) => {
    assert.ok(String(s.directiveZh).length > 20 && String(s.directiveEn).length > 20);
    assert.ok(!cjk(s.nameEn + s.taglineEn + s.fitEn + s.directiveEn), `${s.id} 英文含中文`);
    s.payoffFlavors.forEach((f) => assert.ok(B.VALID_PAYOFF_FLAVORS.has(f), `非法爽点风味 ${f}`));
    s.reversalFlavors.forEach((f) => assert.ok(B.VALID_REVERSAL_FLAVORS.has(f), `非法反转风味 ${f}`));
    s.emotionFlavors.forEach((f) => assert.ok(B.VALID_EMOTION_FLAVORS.has(f), `非法情绪风味 ${f}`));
  });
  assert.deepStrictEqual(C.emotionBeatHints('balanced'), { payoffFlavors: [], reversalFlavors: [], emotionFlavors: [] });
  assert.ok(C.emotionBeatHints('payoff_dense').payoffFlavors.includes('face_slap'));
});

test('v2.29 情绪策略确定性推荐 + 用户显式优先 + 非法回退', () => {
  assert.strictEqual(C.recommendEmotion({ text: '虐恋意难平催泪be' }).id, 'angst_tug');
  assert.strictEqual(C.recommendEmotion({ text: '甜宠治愈双向奔赴' }).id, 'sweet_heal');
  assert.strictEqual(C.recommendEmotion({ text: '悬疑反转烧脑推理' }).id, 'twist_puzzle');
  assert.strictEqual(C.recommendEmotion({ text: '战神打脸逆袭爽剧' }).id, 'payoff_dense');
  assert.strictEqual(C.recommendEmotion({ text: '普通日常' }).id, 'balanced');
  assert.strictEqual(C.resolveEmotionId('sweet_heal', { text: '悬疑' }), 'sweet_heal');
  assert.strictEqual(C.resolveEmotionId(undefined, { text: '悬疑反转' }), 'twist_puzzle');
  assert.strictEqual(C.resolveEmotionId('bad', { text: '虐' }), 'angst_tug');
  assert.ok(C.isValidEmotion('balanced') && !C.isValidEmotion('x'));
});

test('v2.29 节奏策略数值区间：快剪>标准>慢板，区间合法且返回副本', () => {
  const fc = C.getPaceStrategyRange('fastcut'), st = C.getPaceStrategyRange('standard'), cm = C.getPaceStrategyRange('cinematic');
  assert.ok(fc[0] >= st[0] && st[0] >= cm[0]);
  [fc, st, cm].forEach((r) => assert.ok(r[0] >= 1 && r[1] >= r[0] && r[1] <= 8));
  const a = C.getPaceStrategyRange('standard'); a[0] = 99;
  assert.strictEqual(C.getPaceStrategyRange('standard')[0], st[0]);
});

test('v2.37 人物与关系第五套策略：5卡齐全、推荐确定性、英文零中文', () => {
  assert.deepStrictEqual(C.CHARACTER_IDS, ['grounded', 'contrast', 'bond_dynamic', 'ensemble', 'growth_arc']);
  assert.strictEqual(C.listCharacter('zh').length, 5);
  assert.strictEqual(C.listCharacter('en').length, 5);
  C.CHARACTER_IDS.forEach((id) => {
    const zh = C.describeCharacter(id, 'zh'), en = C.describeCharacter(id, 'en');
    assert.ok(zh.name && zh.lead && zh.relation && en.name && en.leadEn === undefined && en.lead);
    const dirEn = C.characterDirective(id, 'en');
    assert.ok(!cjk(dirEn), `en directive of ${id} must have no CJK`);
    assert.ok(C.characterDirective(id, 'zh').includes('人物与关系策略'));
  });
  assert.strictEqual(C.resolveCharacterId(undefined, { text: '战神赘婿扮猪吃虎' }), 'contrast');
  assert.strictEqual(C.resolveCharacterId(undefined, { text: '双强欢喜冤家甜宠' }), 'bond_dynamic');
  assert.strictEqual(C.resolveCharacterId(undefined, { text: '三代女性群像' }), 'ensemble');
  assert.strictEqual(C.resolveCharacterId(undefined, { text: '电竞少年热血追梦' }), 'growth_arc');
  assert.strictEqual(C.resolveCharacterId(undefined, { text: '普通都市故事' }), 'grounded');
  assert.strictEqual(C.resolveCharacterId('bad', { text: '虐恋' }), 'bond_dynamic');
  assert.ok(C.isValidCharacter('ensemble') && !C.isValidCharacter('nope'));
  // 确定性：同输入两次一致
  assert.deepStrictEqual(C.recommendCharacter({ text: '家庭群像' }), C.recommendCharacter({ text: '家庭群像' }));
});
