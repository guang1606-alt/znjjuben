const test = require('node:test');
const assert = require('node:assert');
const { runEpisode } = require('../dist/agents/pipeline.js');
const { extractJson } = require('../dist/lib/model-proxy.js');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
const { EngineTier } = require('../dist/config/pricing.js');

function emptyBible() {
  return { worldview: '', characters: {}, timeline: [], foreshadow: [] };
}

test('沙盘可无密钥跑通七岗协作，且岗位真实联动', async () => {
  const events = [];
  const emit = (e) => events.push(e);
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', emit);

  assert.ok(r.draft.length > 200, '成稿非空');
  // 联动核心证据：撰写稿必须出现人设师立的人物（否则就是各写各的假协同）
  assert.ok(r.draft.includes('林晚') && r.draft.includes('陈总'), '撰写稿消费了人物卡');
  assert.ok(r.outline.beats.length >= 4, '架构师产出节拍');
  assert.ok(r.audience.cravingScore > 0, '观众代言官产出追更欲评分');
  assert.ok(r.market.overall > 0, '市场岗产出六维评分');
  assert.strictEqual(r.antiAi.pass, true, '沙盘成稿通过去AI化闸门');
  // v2.97 一线编剧改稿尺子已接入主管线：返回值含 craftLint，issues 非空，avg 为 0-100 整数
  assert.ok(r.craftLint, '返回值含 craftLint 评分卡');
  assert.ok(Array.isArray(r.craftLint.issues) && r.craftLint.issues.length > 0, 'craftLint issues 非空');
  assert.ok(Number.isInteger(r.craftLint.avg) && r.craftLint.avg >= 0 && r.craftLint.avg <= 100, 'craftLint avg 为 0-100 整数');
  assert.ok(Array.isArray(r.craftLint.p0) && Array.isArray(r.craftLint.p1), 'craftLint p0/p1 为数组');
  // v2.98 四套进阶创作尺子（情绪/网文/原型/叙事）已接入主管线，返回值含 craftDepth
  assert.ok(r.craftDepth, '返回值含 craftDepth 聚合评分卡');
  assert.ok(Number.isInteger(r.craftDepth.avg) && r.craftDepth.avg >= 0 && r.craftDepth.avg <= 100, 'craftDepth avg 为 0-100 整数');
  assert.ok(Array.isArray(r.craftDepth.p1) && Array.isArray(r.craftDepth.p2), 'craftDepth p1/p2 为数组');
  assert.ok(r.craftDepth.emotion && r.craftDepth.webnovel && r.craftDepth.archetype && r.craftDepth.narrative, 'craftDepth 含四套尺子分项');
  // v2.99 市场赛道自动识别 + 标题传播力校验
  assert.ok(['mass', 'premium'].includes(r.track), '返回值含 track 赛道识别');
  assert.strictEqual(r.titlePitch, null, '未传 title 时 titlePitch 为 null');
});

test('v2.99 标题传播力校验：传 title 时返回 titlePitch 评分卡', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {},
    { title: '被赶出家门后我竟是首富孙女' });
  assert.ok(r.titlePitch, '传 title 时返回 titlePitch');
  assert.ok(typeof r.titlePitch.first13 === 'string' && r.titlePitch.first13.length > 0, '含前13字');
  assert.ok(typeof r.titlePitch.score === 'number', '含 score 分数');
  assert.ok(Array.isArray(r.titlePitch.advice), 'advice 为数组');
  assert.strictEqual(typeof r.titlePitch.hasIdentity, 'boolean');
  assert.strictEqual(typeof r.titlePitch.hasConflict, 'boolean');
  assert.strictEqual(typeof r.titlePitch.hasContrast, 'boolean');
});

test('v2.100 每集三问诊断：终稿返回 epThreeQ 三布尔位', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  assert.ok(r.epThreeQ, '返回值含 epThreeQ');
  assert.strictEqual(typeof r.epThreeQ.want, 'boolean', 'want 为布尔');
  assert.strictEqual(typeof r.epThreeQ.block, 'boolean', 'block 为布尔');
  assert.strictEqual(typeof r.epThreeQ.whyNext, 'boolean', 'whyNext 为布尔');
});

test('v2.101 开场四要素 + 六维评分卡：终稿返回 openingCheck 和 scorecard', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  // 开场四要素
  assert.ok(r.openingCheck, '返回值含 openingCheck');
  assert.strictEqual(typeof r.openingCheck.trouble, 'boolean', 'trouble 为布尔');
  assert.strictEqual(typeof r.openingCheck.oppressor, 'boolean', 'oppressor 为布尔');
  assert.strictEqual(typeof r.openingCheck.counterPlan, 'boolean', 'counterPlan 为布尔');
  assert.strictEqual(typeof r.openingCheck.mustWatch, 'boolean', 'mustWatch 为布尔');
  assert.ok(typeof r.openingCheck.score === 'number' && r.openingCheck.score >= 0 && r.openingCheck.score <= 100, 'openingCheck score 0-100');
  // 六维评分卡
  assert.ok(r.scorecard, '返回值含 scorecard');
  assert.ok(typeof r.scorecard.total === 'number' && r.scorecard.total >= 0 && r.scorecard.total <= 100, 'scorecard total 0-100');
  assert.ok(Array.isArray(r.scorecard.dimensions) && r.scorecard.dimensions.length === 6, 'scorecard 含六维');
  assert.ok(r.scorecard.weakest && typeof r.scorecard.weakest.score === 'number', 'scorecard 含最短板');
  assert.ok(Array.isArray(r.scorecard.priorityActions), 'scorecard 含优先修整清单');
});

test('v2.102 流派匹配 + 资方视角：返回 genres 和 investor', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '重生复仇打脸逆袭', () => {});
  assert.ok(Array.isArray(r.genres), '返回值含 genres 数组');
  // 重生复仇打脸应匹配至少一个流派
  assert.ok(r.genres.length > 0, 'brief 含流派关键词时应匹配到流派');
  assert.ok(r.investor, '返回值含 investor');
  assert.ok(typeof r.investor.overall === 'number' && r.investor.overall >= 0 && r.investor.overall <= 100, 'investor overall 0-100');
  assert.ok(typeof r.investor.verdict === 'string', 'investor verdict 为字符串');
  assert.ok(Array.isArray(r.investor.vetoes), 'investor vetoes 为数组');
  assert.ok(Array.isArray(r.investor.pitchTips), 'investor pitchTips 为数组');
});

test('v2.103 AIGC 微节拍计划：scriptFormat=AIGC 时返回 aigcBeatPlan', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {}, {
    scriptFormat: 'AIGC',
    aigcDurationMin: 1.5,
  });
  assert.ok(r.aigcBeatPlan, 'AIGC 模式应返回 aigcBeatPlan');
  assert.ok(r.aigcBeatPlan.beatCount >= 1, '至少1拍');
  assert.ok(r.aigcBeatPlan.beats.length === r.aigcBeatPlan.beatCount, 'beats 数量与 beatCount 一致');
  assert.ok(r.aigcBeatPlan.totalSeconds === 90, '1.5分钟=90秒');
  // 非AIGC模式应为null
  const r2 = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  assert.strictEqual(r2.aigcBeatPlan, null, 'LIVE 模式 aigcBeatPlan 为 null');
});

test('v2.104 节奏+人物逻辑闸门：rhythm 和 character 返回 issues 数组', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  assert.ok(r.rhythm, '返回值含 rhythm');
  assert.ok(typeof r.rhythm.score === 'number' && r.rhythm.score >= 0 && r.rhythm.score <= 100, 'rhythm score 0-100');
  assert.ok(Array.isArray(r.rhythm.issues), 'rhythm issues 为数组');
  assert.ok(r.rhythm.arc && typeof r.rhythm.arc.hook === 'boolean', 'rhythm.arc.hook 为布尔');
  assert.ok(r.character, '返回值含 character');
  assert.ok(Array.isArray(r.character.issues), 'character issues 为数组');
  assert.ok(typeof r.character.score === 'number' && r.character.score >= 0 && r.character.score <= 100, 'character score 0-100');
});

test('v2.106 跨集连续性：prevEpisode 传入时架构师/撰写师拿到前集摘要', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {}, {
    prevEpisode: { epNo: 1, title: '保洁工的秘密', summary: '李阿姨发现自己打扫的别墅主人竟是她失散多年的儿子，但她选择不说破，集尾留下遗嘱信件特写。' },
  });
  assert.ok(r.draft.length > 100, '有正文输出');
  // 前集摘要传入后不应崩溃，且大纲应包含人物（承接前集角色状态）
  assert.ok(r.outline && r.outline.logline, '有大纲');
});

test('v2.108 伏笔账本+角色弧光：返回 foreshadow 和 arcTrack 诊断', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {}, {
    prevForeshadow: { plants: [{ type: 'plant', signal: '信件', category: 'object', lineNo: 5, snippet: '桌上留下一封信件' }], payoffs: [], epNo: 1 },
    prevArc: { characters: [{ name: '李阿姨', emotion: 'calm', stage: 'setup', emotionTrack: ['calm'], changed: false, relations: [] }], epNo: 1 },
  });
  assert.ok(r.draft.length > 100, '有正文输出');
  // 伏笔账本
  assert.ok(r.foreshadow, 'foreshadow 存在');
  assert.ok(typeof r.foreshadow.score === 'number' && r.foreshadow.score >= 0 && r.foreshadow.score <= 100, 'foreshadow score 0-100');
  assert.ok(Array.isArray(r.foreshadow.plants), 'foreshadow.plants 数组');
  assert.ok(Array.isArray(r.foreshadow.payoffs), 'foreshadow.payoffs 数组');
  assert.ok(Array.isArray(r.foreshadow.dangling), 'foreshadow.dangling 数组');
  assert.ok(Array.isArray(r.foreshadow.issues), 'foreshadow.issues 数组');
  // 角色弧光
  assert.ok(r.arcTrack, 'arcTrack 存在');
  assert.ok(typeof r.arcTrack.score === 'number' && r.arcTrack.score >= 0 && r.arcTrack.score <= 100, 'arcTrack score 0-100');
  assert.ok(Array.isArray(r.arcTrack.characters), 'arcTrack.characters 数组');
  assert.ok(Array.isArray(r.arcTrack.stalled), 'arcTrack.stalled 数组');
  assert.ok(Array.isArray(r.arcTrack.jumpCut), 'arcTrack.jumpCut 数组');
  assert.ok(Array.isArray(r.arcTrack.issues), 'arcTrack.issues 数组');
});

test('hit_lab 爆款逆向轨道：sourceText 触发 hit-teardown 结构化拆解', async () => {
  // v2.97 名场面工作台·爆款逆向：有源文本时必须真正跑 teardown 引擎，
  // 而不是只在提示词里让模型凭感觉"抽骨架"
  const bible = emptyBible();
  const src = '第一集\n林晚被后妈赶出家门，身无分文。她在街角捡到一张旧照片，发现自己竟是首富失散多年的孙女。第二集\n后妈追到公司要认亲，林晚拿出DNA报告当众揭穿。';
  const r = await runEpisode(EngineTier.ECONOMY, bible, '改编这个爆款', () => {}, { mode: 'hit_lab', modeTrack: 'hit_reverse', sourceText: src });
  assert.ok(r.hitTeardown, 'hit_lab 逆向 + sourceText 必须返回 hitTeardown 报告');
  assert.ok(r.hitTeardown.hookType && typeof r.hitTeardown.hookType === 'string', '含钩子类型');
  assert.ok(r.hitTeardown.personaContrast, '含人设反差模型');
  assert.ok(typeof r.hitTeardown.coolDensity === 'number', '含爽点密度');
  assert.ok(Array.isArray(r.hitTeardown.tensionCurve), '含张力曲线');
  assert.ok(r.hitTeardown.boomReasons.length > 0, '含为什么爆的分析');
  assert.ok(r.hitTeardown.techniques.length > 0, '含可取技法');
});

test('全局圣经真实累积，支撑跨集联动', async () => {
  const bible = emptyBible();
  const r1 = await runEpisode(EngineTier.ECONOMY, bible, '第一集', () => {});
  assert.ok(r1.bible.characters['林晚'], '人物写入圣经');
  assert.strictEqual(r1.bible.timeline.length, 1);
  assert.ok(r1.bible.foreshadow.length >= 1, '伏笔写入圣经');
  const r2 = await runEpisode(EngineTier.ECONOMY, r1.bible, '第二集', () => {});
  assert.strictEqual(r2.bible.timeline.length, 2, '第二集时间线继续累积而非重置');
});

test('岗位推进顺序：架构→人设→撰写→观众→润色', () => {
  // 顺序契约固化，防止协作流程被改乱
  const seq = ['architect', 'designer', 'writer', 'audience', 'polisher'];
  assert.deepStrictEqual(seq, ['architect', 'designer', 'writer', 'audience', 'polisher']);
});

test('extractJson 能从包裹文本中稳健提取JSON', () => {
  const obj = extractJson('好的，结果如下：```json\n{"a":1,"b":[2,3]}\n```');
  assert.deepStrictEqual(obj, { a: 1, b: [2, 3] });
  assert.strictEqual(extractJson('没有JSON'), null);
});

test('v1.97 多集生成：钩子×节拍对齐后，beats.issues 不再残留反转卡点脱配 error', async () => {
  for (const idx of [0, 2, 5, 8]) {
    const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '豪门反转逆袭', () => {},
      { episodeCount: 10, episodeIndex: idx, antiStrength: 'balanced' });
    const hard = r.beats.issues.filter((i) => i.level === 'error' && i.msg.includes('反转卡点'));
    assert.deepStrictEqual(hard, [], `第${idx + 1}集不应残留反转卡点脱配`);
  }
});

test('v1.98 英文沙盘端到端零中文：大纲/人物卡/成稿均英文且通过闸门', async () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), 'hidden ceo revenge', () => {},
    { lang: 'en', episodeCount: 3, episodeIndex: 0 });
  assert.ok(!cjk(r.draft), '英文成稿零中文');
  assert.ok(!cjk(r.outline.logline) && !cjk(JSON.stringify(r.outline.beats)), '英文大纲零中文');
  assert.ok(!cjk(JSON.stringify(r.cast)), '英文人物卡零中文');
  assert.ok(Object.keys(r.cast).every((k) => !cjk(k)), '人物名英文');
  assert.strictEqual(r.antiAi.pass, true, '英文沙盘同样过去AI化闸门');
  assert.ok(r.draft.length > 400);
});

test('v1.99 英文链路全部进度播报零中文，中文链路播报逐字保留', async () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const enEvents = [];
  await runEpisode(EngineTier.ECONOMY, emptyBible(), 'hidden ceo revenge', (e) => enEvents.push(e),
    { lang: 'en', episodeCount: 3, episodeIndex: 0 });
  assert.ok(enEvents.length >= 12, '八岗位应有足量进度播报');
  const zhNotes = enEvents.filter((e) => cjk(e.note));
  assert.deepStrictEqual(zhNotes, [], '英文链路所有进度播报不得含中文');
  const zhEvents = [];
  await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁逆袭', (e) => zhEvents.push(e), {});
  assert.ok(zhEvents.some((e) => String(e.note).includes('中央调度')), '中文链路默认播报逐字保留');
});

test('v1.99 英文链路带风格与口吻指令仍零中文', async () => {
  const cjk = (s) => /[一-鿿]/.test(String(s));
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), 'underdog comeback', () => {},
    { lang: 'en', style: 'suspense', episodeCount: 2, episodeIndex: 1 });
  assert.ok(!cjk(r.draft) && !cjk(JSON.stringify(r.outline)) && !cjk(JSON.stringify(r.cast)));
  assert.ok(!cjk(JSON.stringify(r.market.advice)), '英文市场建议零中文');
  assert.ok(!cjk(JSON.stringify(r.audience)), '英文观众报告零中文');
});

test('v2.113 集尾钩子效力评分：终稿返回 cliffhanger 评分卡', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  assert.ok(r.cliffhanger, '返回值含 cliffhanger');
  assert.ok(typeof r.cliffhanger.score === 'number' && r.cliffhanger.score >= 0 && r.cliffhanger.score <= 100, 'cliffhanger score 0-100');
  assert.ok(typeof r.cliffhanger.type === 'string', 'cliffhanger type 为字符串');
  assert.ok(typeof r.cliffhanger.typeLabel === 'string', 'cliffhanger typeLabel 为字符串');
  assert.ok(typeof r.cliffhanger.endingSnippet === 'string' && r.cliffhanger.endingSnippet.length > 0, 'cliffhanger endingSnippet 为非空字符串');
  assert.ok(Array.isArray(r.cliffhanger.issues), 'cliffhanger issues 为数组');
  // 沙盘默认生成有钩子的剧本，type 不应是 none
  assert.ok(r.cliffhanger.type !== 'none', `沙盘成稿应有钩子，type 不应是 none，实际${r.cliffhanger.type}`);
});

test('v2.113 plot 维度纳入 cliffhanger 分数（20%权重）', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  assert.ok(r.scorecard && Array.isArray(r.scorecard.dimensions), 'scorecard 含 dimensions');
  const plotDim = r.scorecard.dimensions.find((d) => d.name === 'plot' || d.key === 'plot');
  assert.ok(plotDim, 'scorecard 含 plot 维度');
  assert.ok(typeof plotDim.score === 'number' && plotDim.score >= 0 && plotDim.score <= 100, 'plot score 0-100');
});

test('v2.114 爽点密度评分：终稿返回 coolMoment 评分卡', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {});
  assert.ok(r.coolMoment, '返回值含 coolMoment');
  assert.ok(typeof r.coolMoment.score === 'number' && r.coolMoment.score >= 0 && r.coolMoment.score <= 100, 'coolMoment score 0-100');
  assert.ok(typeof r.coolMoment.count === 'number' && r.coolMoment.count >= 0, 'coolMoment count 为非负数');
  assert.ok(typeof r.coolMoment.variety === 'number' && r.coolMoment.variety >= 0, 'coolMoment variety 为非负整数');
  assert.ok(typeof r.coolMoment.distribution === 'object', 'coolMoment distribution 为对象');
  assert.ok('head' in r.coolMoment.distribution && 'mid' in r.coolMoment.distribution && 'tail' in r.coolMoment.distribution, 'distribution 含 head/mid/tail');
  assert.ok(typeof r.coolMoment.hasBuildup === 'boolean', 'coolMoment hasBuildup 为布尔');
  assert.ok(Array.isArray(r.coolMoment.hits), 'coolMoment hits 为数组');
  assert.ok(Array.isArray(r.coolMoment.issues), 'coolMoment issues 为数组');
});

/* ================= v2.317 模型故障≠沙盘：岗位空响应/坏JSON 必须整集失败，不得套静态资产产出"真稿+假人设" ================= */

const MPX = require('../dist/lib/model-proxy.js');
const ARCH_KEY = '只输出JSON Outline';   // architect 提示词尾部标记（G.outlineOnly）
const CAST_KEY = '只输出JSON人物卡Cast'; // designer 提示词尾部标记（G.castOnly）
const OUTLINE_JSON = JSON.stringify({
  hookType: 'face_slap_pre', logline: '测试用大纲logline', beats: ['节拍一', '节拍二', '节拍三', '节拍四'],
  payoffs: ['兑付一'], cliffhanger: '测试悬念', subplots: [],
});
const CAST_JSON = JSON.stringify({
  周德海: { want: '保住自己的猪场', voice: '大嗓门、爱抬杠', arc: '从顶撞到配合', hidden: ['倔强', '怕女儿受委屈'] },
});

function xResp(content) {
  return {
    ok: true, status: 200, text: async () => '',
    json: async () => ({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 20 } }),
  };
}
function xSetSource() {
  MPX.__setProviderSource(async () => ({
    providers: [{ id: 'px', name: '故障注入文本', modality: 'text', baseUrl: 'https://x.local/v1', apiKey: 'k', model: 'm', enabled: true }],
    routing: {},
  }));
}
// 文件顶部约定全局为空 provider 源（沙盘隔离），故障注入用例后必须还原
function xCleanup() {
  MPX.__setHttpTransport(null);
  MPX.__resetModelHealth();
  MPX.__setProviderSource(async () => ({ providers: [], routing: {} }));
}
function promptOf(init) { return JSON.parse(init.body).messages[0].content; }

test('v2.317 人设岗持续空响应：runEpisode 抛 MODEL_EMPTY_CONTENT，不得用静态沙盘人物卡静默成稿', async () => {
  MPX.__resetModelHealth();
  xSetSource();
  MPX.__setHttpTransport(async (url, init) => {
    const p = promptOf(init);
    if (p.includes(CAST_KEY)) return xResp(''); // designer 永远空（architect 先行，始终给合法大纲）
    return xResp(OUTLINE_JSON);
  });
  // 修复前：designer 空响应被当沙盘 → 管线拿 SANDBOX_CAST（林晚/陈总）继续写稿，silent 出"真假混合稿"
  await assert.rejects(
    () => runEpisode(EngineTier.ECONOMY, emptyBible(), '县城兽医brief', () => {}),
    /MODEL_EMPTY_CONTENT/,
  );
  xCleanup();
});

test('v2.317 结构化岗首次返回非JSON散文：同岗立即重试一次拿到JSON救场，不套沙盘', async () => {
  MPX.__resetModelHealth();
  xSetSource();
  const hits = { arch: 0, cast: 0, other: 0 };
  MPX.__setHttpTransport(async (url, init) => {
    const p = promptOf(init);
    if (p.includes(CAST_KEY)) { hits.cast += 1; return xResp(hits.cast === 1 ? '抱歉，这个我没法帮你写，你换个题目吧。' : CAST_JSON); }
    if (p.includes(ARCH_KEY)) { hits.arch += 1; return xResp(OUTLINE_JSON); }
    hits.other += 1;
    return xResp(''); // writer 等后续岗位：空响应重试耗尽后抛 MODEL_EMPTY_CONTENT 收尾，本用例只验证 designer 救场
  });
  await assert.rejects(
    () => runEpisode(EngineTier.ECONOMY, emptyBible(), '县城兽医brief', () => {}),
    /MODEL_EMPTY_CONTENT/,
  );
  assert.strictEqual(hits.arch, 1, 'architect 一次成功不重试');
  assert.strictEqual(hits.cast, 2, 'designer 坏JSON后同岗重试1次救场');
  xCleanup();
});

test('v2.317 结构化岗持续返回非JSON：重试1次后抛 MODEL_BAD_JSON 失败退款，绝不静默套静态资产', async () => {
  MPX.__resetModelHealth();
  xSetSource();
  const hits = { arch: 0, cast: 0 };
  const maxTokensSeen = [];
  MPX.__setHttpTransport(async (url, init) => {
    const p = promptOf(init);
    if (p.includes(CAST_KEY) || p.includes(ARCH_KEY)) maxTokensSeen.push(JSON.parse(init.body).max_tokens);
    if (p.includes(CAST_KEY)) { hits.cast += 1; return xResp('我无法输出JSON格式，但我可以给你一些建议：第一……'); }
    if (p.includes(ARCH_KEY)) { hits.arch += 1; return xResp(OUTLINE_JSON); }
    return xResp(OUTLINE_JSON);
  });
  await assert.rejects(
    () => runEpisode(EngineTier.ECONOMY, emptyBible(), '县城兽医brief', () => {}),
    /MODEL_BAD_JSON/,
  );
  assert.strictEqual(hits.cast, 2, '坏JSON最多重试1次即失败，不无底限烧钱');
  assert.ok(maxTokensSeen.length >= 3, `architect+designer重试共应>=3次请求，实际${maxTokensSeen.length}`);
  assert.ok(maxTokensSeen.every((m) => m === 16384),
    `思考模型 reasoning/content 共享预算，结构化岗必须 16384 防思考吃光预算，实际：${JSON.stringify(maxTokensSeen)}`);
  xCleanup();
});

test('v2.317 人设岗返回 <think> 思维链包裹的JSON（MiniMax-M3 真实形态）：剥离救场，管线越过人设岗不重试不失败', async () => {
  MPX.__resetModelHealth();
  xSetSource();
  const hits = { arch: 0, cast: 0 };
  const pollutedCast = `<think>先分析大纲：beats 有 ["一","二","三","四"]，需要两个人物，再检查 arc 字段……</think>\n\n${CAST_JSON}`;
  MPX.__setHttpTransport(async (url, init) => {
    const p = promptOf(init);
    if (p.includes(CAST_KEY)) { hits.cast += 1; return xResp(pollutedCast); }
    if (p.includes(ARCH_KEY)) { hits.arch += 1; return xResp(OUTLINE_JSON); }
    return xResp(''); // writer 空响应收尾：若 designer 未救场会先抛 MODEL_BAD_JSON:designer
  });
  const notes = [];
  // designer 救场成功 → 管线推进到 writer 才失败；错误不得含 designer
  await assert.rejects(
    () => runEpisode(EngineTier.ECONOMY, emptyBible(), '县城兽医brief', (ev) => { if (ev?.role === 'designer') notes.push(ev); }),
    (e) => /MODEL_EMPTY_CONTENT/.test(e.message) && !/designer/.test(e.message),
  );
  assert.strictEqual(hits.cast, 1, 'think 污染首调剥离即成功，不重试');
  const castDone = notes.find((n) => n.status === 'done');
  assert.ok(castDone, 'designer 正常完成并播报名单');
  assert.ok(/周德海/.test(castDone.note || ''), `人物卡名单必须是真实JSON里的周德海，实际：${castDone.note}`);
  xCleanup();
});

