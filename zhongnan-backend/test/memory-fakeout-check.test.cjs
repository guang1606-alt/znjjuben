/**
 * v2.144 memory-fakeout-check 单测（闪回/梦境/幻觉结构公平性，中英双语离线启发式）
 * 覆盖：空短文本满分 / 梦醒假反转（跨场、无强戏剧豁免、二次升 high、wake 行不自证入梦）/
 *       幻觉无收束（有收束豁免、无戏剧动作豁免、二次升 mid）/
 *       闪回堆砌（4 段 low、6 段 mid）/ 重复记忆（无新信息报、带新信息豁免、异词根不连坐）/
 *       正信号（markedDream/fairRecall/boundedFlash）/ 裸词防误伤 / 排序 / evidence / 语言隔离
 */
const test = require('node:test');
const assert = require('node:assert');
const { memoryFakeoutCheck } = require('../dist/engine/memory-fakeout-check.js');

const sum = (r) => r.scenes.reduce((a, s) => a + s.flagCount, 0);
const types = (r) => r.issues.map((i) => i.type);
const sevOf = (r, type) => r.issues.filter((i) => i.type === type).map((i) => i.severity);

test('空文本与短文本：满分空对象', () => {
  for (const t of ['', '   \n  \n', '短短十几个字对白']) {
    const r = memoryFakeoutCheck(t, 'zh');
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.issueCount, 0);
    assert.strictEqual(r.scenes.length, 0);
    assert.strictEqual(r.signalCount, 0);
  }
});

test('普通现实稿无记忆类信号：满分放行', () => {
  const t = '第1场 会议室\n顾总把离婚协议推到她面前让她签。\n林晚冷笑一声拿起笔签下名字。\n她转身离开没有回头，背影笔直。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.signalCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('① 跨场无标记假死亡梦醒：mid，fakeoutCount=1', () => {
  const t = '第1场 别墅\n林晚看着丈夫倒在血泊里，胸口插着一把刀。\n她尖叫着扑过去，血染红了她的白裙。\n第2场 卧室\n林晚猛地从梦中惊醒，冷汗浸湿了睡衣，原来是一场梦。\n她大口喘着气，眼前只是熟悉的天花板。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.fakeoutCount, 1);
  assert.deepStrictEqual(sevOf(r, 'dream_fakeout'), ['mid']);
  assert.strictEqual(r.score, 88); // 100-12
  assert.match(r.issues[0].evidence, /^第2场：/);
  assert.strictEqual(sum(r), r.issues.length);
});

test('① 有入梦标记的梦境（睡去→梦中→惊醒）：不报，markedDream=1', () => {
  const t = '第1场 卧室\n林晚连日操劳，沉沉睡去。\n梦里，丈夫倒在血泊里，胸口插着刀。\n第2场\n林晚猛地从梦中惊醒，原来是一场梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.fakeoutCount, 0);
  assert.strictEqual(r.markedDreamCount, 1);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('① 梦醒但之前只演日常小事（无强戏剧事件）：不报假反转', () => {
  const t = '第1场 厨房\n她在厨房煮面，汤洒了出来。\n闹钟在耳边响。\n第2场\n她猛地从梦中醒来，原来是一场梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.fakeoutCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('① 连续两次假反转：第二次升 high，wake 行的“梦中”不自证入梦', () => {
  const t = '第1场\n他中枪倒在血泊里死了。\n她猛地从梦中惊醒，原来是一场梦。\n第3场\n另一个男人坠楼而下，鲜血染红地面。\n她惊得坐直了身体，大口喘息，又是梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.fakeoutCount, 2);
  assert.deepStrictEqual(sevOf(r, 'dream_fakeout').sort(), ['high', 'mid']);
  assert.strictEqual(r.issues[0].severity, 'high'); // 排序 high 在前
});

test('① “昏睡过去→梦中→惊醒”跨场成对：markedDream 计数，无问题', () => {
  const t = '第1场\n林晚昏睡过去。\n梦中，他浑身是血地看着她。\n第2场 深夜\n她猛地从梦中惊醒，冷汗直流。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.fakeoutCount, 0);
  assert.strictEqual(r.markedDreamCount, 1);
});

test('② 幻想段演出强戏剧动作且无回神收束：low', () => {
  const t = '第1场 礼堂\n她幻想着自己当众吻了他，婚礼进行曲响起，他低头吻住她。\n宾客纷纷鼓掌起哄。\n顾承渊的声音从走廊尽头传来。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.hallucinationCount, 1);
  assert.deepStrictEqual(sevOf(r, 'hallucination_unbound'), ['low']);
  assert.strictEqual(r.score, 94);
});

test('② 幻想后有明确回神动作：豁免', () => {
  const t = '第1场 走廊\n她幻想着自己当众吻了他，他低头吻住她。\n她猛地回过神，发现自己还站在走廊里，脸上一热。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.hallucinationCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('② 想象内容无强戏剧动作（想吃大餐）：豁免', () => {
  const t = '第1场\n她幻想着今晚能吃一顿大餐，有鱼有虾还有甜点。\n她揉了揉咕咕叫的肚子。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.hallucinationCount, 0);
  assert.strictEqual(r.score, 100);
});

test('② 第二次幻觉无收束：升 mid（push 上限 2）', () => {
  const t = '第1场\n她幻想着他低头吻住她，两人在婚礼上拥吻。\n音乐响起，没人喊她。\n第2场\n她脑补他当众表白告白，把她搂入怀中深吻。\n四周只有风声。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.hallucinationCount, 2);
  assert.deepStrictEqual(sevOf(r, 'hallucination_unbound').sort(), ['low', 'mid']);
});

test('③ 闪回 4 段：overuse low；每段计 1（反应行不并段）', () => {
  const t = '第1场\n脑海里浮现出车祸现场。\n她摇摇头甩开回忆。\n第二段回忆涌现，那是葬礼上的黑白照片。\n她咬牙。\n记忆深处又是医院走廊的病床。\n她握拳。\n画面一转，那年雨夜的巴掌格外响亮。\n而现在，她睁开眼。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.flashbackCount, 4);
  assert.deepStrictEqual(sevOf(r, 'flashback_overuse'), ['low']);
  assert.strictEqual(r.boundedFlashCount, 1); // 收束只归属最后一段
});

test('③ 闪回 6 段：overuse mid', () => {
  const t = '第1场\n脑海里浮现出车祸。\n她咬牙。\n回忆涌现葬礼遗像。\n她握拳。\n记忆深处是病床。\n她抬头。\n画面一转那年雨夜。\n她闭眼。\n闪回，大火冲天。\n她转身。\n思绪飘回小时候的离婚协议。\n她睁眼。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.flashbackCount, 6);
  assert.deepStrictEqual(sevOf(r, 'flashback_overuse'), ['mid']);
});

test('④ 同一车祸记忆闪回两次且第二次无新信息：repeat mid', () => {
  const t = '第1场\n脑海里浮现出车祸现场，货车冲过来，他推开了她。\n她如今站在墓前。\n第2场\n记忆深处又是那场车祸，雨夜货车刺眼的光。\n她握紧了拳头。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.flashbackCount, 2);
  assert.strictEqual(r.repeatedMemoryKinds, 1);
  assert.deepStrictEqual(sevOf(r, 'flashback_repeat'), ['mid']);
  assert.strictEqual(r.score, 90);
});

test('④ 重复闪回补充真相/新视角：fairRecall 豁免', () => {
  const t = '第1场\n脑海里浮现出车祸现场，货车冲过来。\n第2场\n记忆深处又是那场车祸，这一次她终于看清，原来司机是故意打方向盘的，真相浮出水面。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.fairRecallCount, 1);
  assert.strictEqual(r.repeatedMemoryKinds, 0);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('④ 车祸与葬礼各闪一次（异词根）：不判重复', () => {
  const t = '第1场\n脑海里浮现出车祸现场，货车冲过来。\n她闭眼。\n第2场\n回忆涌现葬礼遗像，黑白照片摆在灵堂。\n她握紧白花。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.repeatedMemoryKinds, 0);
  assert.strictEqual(r.issues.filter((i) => i.type === 'flashback_repeat').length, 0);
});

test('④ 两种记忆各自重复：报 2 条 repeat（push 上限 2）', () => {
  const t = '第1场\n脑海里浮现车祸现场。\n第2场\n记忆深处又是那场车祸，雨夜。\n第3场\n回忆涌现葬礼遗像。\n第4场\n记忆里那场葬礼，灵堂白花。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.repeatedMemoryKinds, 2);
  assert.strictEqual(r.issues.filter((i) => i.type === 'flashback_repeat').length, 2);
  assert.strictEqual(r.score, 75); // -18(repeat cap) -7(overuse 4 段)
});

test('正信号：单段闪回带“画面切回现实”收束：boundedFlash=1 且满分', () => {
  const t = '第1场 墓园\n脑海里浮现出车祸现场，货车冲过来。\n画面切回现实，她站在墓前握紧了花。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.flashbackCount, 1);
  assert.strictEqual(r.boundedFlashCount, 1);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('防误伤：“甩开回忆”的回忆是宾语，不算闪回标记', () => {
  const t = '第1场\n她摇摇头甩开回忆，继续签下手里的合同。\n顾总看着她的动作没有说话。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.flashbackCount, 0);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('防误伤：场标题里的“三年前”是正常时间线起点，不算闪回', () => {
  const t = '第1场 三年前 顾家老宅\n林晚穿着婚纱走进礼堂。\n顾承渊冷冷看着她，一言不发。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.strictEqual(r.flashbackCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('场景旗标自洽：scenes.flagCount 合计 = issues 数（同场多条累加）', () => {
  const t = '第1场\n他中枪倒在血泊里死了。\n她猛地从梦中惊醒，原来是一场梦。\n另一个男人坠楼，鲜血染红。\n她惊得坐直喘息，又是梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.ok(r.issues.length >= 1);
  assert.strictEqual(sum(r), r.issues.length);
  assert.strictEqual(r.scenes.find((s) => s.index === 1).flagCount, r.issues.length);
});

test('排序：high→mid→low，同级按场序；key 唯一', () => {
  const t = '第1场\n脑海里浮现出车祸。\n她咬牙。\n回忆涌现葬礼遗像。\n她握拳。\n记忆深处是病床。\n她抬头。\n画面一转那年雨夜。\n第9场\n他中枪倒在血泊里死了。\n她猛地从梦中惊醒原来是一场梦。\n第10场\n另一个男人坠楼，鲜血染红。\n她惊得坐直喘息，又是梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  const rank = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r.issues.length; i += 1) {
    assert.ok(rank[r.issues[i - 1].severity] <= rank[r.issues[i].severity]);
  }
  const keys = r.issues.map((i) => i.key);
  assert.strictEqual(new Set(keys).size, keys.length);
});

test('advice 与 evidence 均为中文，evidence 带场次前缀', () => {
  const t = '第1场\n他中枪倒在血泊里死了。\n第2场\n她猛地从梦中惊醒，原来是一场梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  for (const it of r.issues) {
    assert.match(it.evidence, /^第\d+场：/);
    assert.ok(it.advice.length >= 12);
    assert.ok(/[一-龥]/.test(it.advice));
  }
});

test('评分始终夹在 0-100（多问题叠加）', () => {
  const t = '第1场\n脑海里浮现出车祸。\n她咬牙。\n回忆涌现葬礼。\n她握拳。\n记忆深处是病床。\n她抬头。\n画面一转那年雨夜。\n她闭眼。\n闪回大火。\n她转身。\n思绪飘回离婚协议。\n第9场\n他中枪倒在血泊里死了。\n她猛地从梦中惊醒原来是一场梦。\n第10场\n另一个男人坠楼鲜血染红。\n她惊得坐直喘息又是梦。';
  const r = memoryFakeoutCheck(t, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100);
});

test('EN 空文本/普通稿：满分', () => {
  assert.strictEqual(memoryFakeoutCheck('', 'en').score, 100);
  const t = 'Scene 1 Office\nHe pushed the contract across the table.\nShe picked up the pen and signed without hesitation.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.signalCount, 0);
});

test('EN ① 跨场无标记假死亡梦醒：mid，evidence 带 Scene 前缀', () => {
  const t = 'Scene 1 Mansion\nHe slumped lifeless on the floor, blood pooled around his chest.\nShe screamed as the knife stood in his ribs.\nScene 2 Bedroom\nShe woke up gasping, in a cold sweat. It was all a dream.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.fakeoutCount, 1);
  assert.deepStrictEqual(sevOf(r, 'dream_fakeout'), ['mid']);
  assert.match(r.issues[0].evidence, /^Scene 2:/);
  assert.ok(/[a-zA-Z]/.test(r.issues[0].advice));
});

test('EN ① 有入梦标记：markedDream=1，无问题', () => {
  const t = 'Scene 1 Bedroom\nShe drifted into a deep sleep.\nIn her dream, he slumped lifeless, blood pooled on the floor.\nScene 2\nShe woke gasping from the nightmare and realized it had only been a dream.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.markedDreamCount, 1);
  assert.strictEqual(r.fakeoutCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('EN ① 梦醒前无强戏剧事件：不报', () => {
  const t = 'Scene 1 Kitchen\nShe spilled the soup while humming a tune.\nScene 2\nShe woke up gasping, it was all a dream.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.fakeoutCount, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('EN ② 幻想无收束且演出亲吻：low；有回神则豁免', () => {
  const bad = 'Scene 1 Hall\nShe pictured herself kissing him at the wedding, and he kissed her deeply.\nThe music swelled around them.\nA voice called from far away.';
  const r1 = memoryFakeoutCheck(bad, 'en');
  assert.strictEqual(r1.hallucinationCount, 1);
  assert.deepStrictEqual(sevOf(r1, 'hallucination_unbound'), ['low']);
  const good = 'Scene 1 Hall\nShe pictured herself kissing him at the wedding.\nShe snapped back to reality, still standing alone in the empty corridor.';
  const r2 = memoryFakeoutCheck(good, 'en');
  assert.strictEqual(r2.hallucinationCount, 0);
});

test('EN ④ 同一车祸记忆重复无新信息：repeat mid', () => {
  const t = 'Scene 1\nThe memory of the car crash surfaced, headlights rushing at her.\nScene 2\nHer mind went back to that day, the car crash and rain on glass.\nShe clenched her fists.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.flashbackCount, 2);
  assert.strictEqual(r.repeatedMemoryKinds, 1);
  assert.deepStrictEqual(sevOf(r, 'flashback_repeat'), ['mid']);
});

test('EN ④ 重复闪回带真相：fairRecall 豁免', () => {
  const t = 'Scene 1\nThe memory of the car crash surfaced in the pouring rain.\nScene 2\nHer mind went back to that day, and only now did she realize the truth — the driver had turned the wheel on purpose.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.fairRecallCount, 1);
  assert.strictEqual(r.repeatedMemoryKinds, 0);
  assert.strictEqual(r.issueCount, 0);
});

test('EN 正信号：Back in the present 收束闪回：boundedFlash=1', () => {
  const t = 'Scene 1 Cemetery\nThe memory of the car crash surfaced in the rain.\nBack in the present, she laid the flowers down gently.';
  const r = memoryFakeoutCheck(t, 'en');
  assert.strictEqual(r.boundedFlashCount, 1);
  assert.strictEqual(r.issueCount, 0);
});

test('语言隔离：中文标记在 en 模式不触发，英文标记在 zh 模式不触发', () => {
  const enText = 'Scene 1 Hall\nShe pictured herself kissing him at the wedding, and he kissed her deeply.\nThe music swelled.\nA voice came from far away.';
  const zhText = '第1场 礼堂\n她幻想着自己当众吻了他，他低头吻住她。\n音乐响起，四周无人。';
  assert.strictEqual(memoryFakeoutCheck(enText, 'zh').issueCount, 0);
  assert.strictEqual(memoryFakeoutCheck(zhText, 'en').issueCount, 0);
  assert.strictEqual(memoryFakeoutCheck(enText, 'en').hallucinationCount, 1);
  assert.strictEqual(memoryFakeoutCheck(zhText, 'zh').hallucinationCount, 1);
});
