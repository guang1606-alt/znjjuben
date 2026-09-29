const test = require('node:test');
const assert = require('node:assert');
const {
  runEpisode, normalizeCuePref, buildEpisodeHookDirective,
} = require('../dist/agents/pipeline.js');
const { planHooks, OPEN_HOOKS, EPISODE_END_HOOKS } = require('../dist/engine/hook-system.js');
const { EngineTier } = require('../dist/config/pricing.js');

function emptyBible() { return { worldview: '', characters: {}, timeline: [], foreshadow: [] }; }
const rng = () => 0.5; // 固定随机，结果可复现

test('normalizeCuePref：缺省补默认、非法枚举回退、未知钩子id剔除、manual键数字化', () => {
  assert.deepStrictEqual(normalizeCuePref().mode, 'auto');
  assert.deepStrictEqual(normalizeCuePref().strength, 'balanced');
  const dirty = normalizeCuePref({
    mode: 'bogus', strength: 'tight',
    preferred: ['open_suspense', 'not_a_hook'], avoid: ['micro_line', 123],
    manual: { '0': 'open_conflict', bad: 'xx' },
  });
  assert.strictEqual(dirty.mode, 'auto', '非法mode回退auto');
  assert.strictEqual(dirty.strength, 'tight');
  assert.deepStrictEqual(dirty.preferred, ['open_suspense'], '未知偏好id被剔除');
  assert.deepStrictEqual(dirty.avoid, ['micro_line'], '非字符串/未知avoid被剔除');
  assert.deepStrictEqual(dirty.manual, { 0: 'open_conflict' }, '合法manual保留、非法项剔除');
});

test('planHooks：每集必有开场钩与集尾卡点，场/微钩按强度布置', () => {
  const plan = planHooks(2, 3, normalizeCuePref({ strength: 'tight' }), rng);
  assert.strictEqual(plan.episodes.length, 2);
  plan.episodes.forEach((ep) => {
    assert.ok(OPEN_HOOKS.some((h) => h.id === ep.openHookId), '开场钩合法');
    assert.ok(EPISODE_END_HOOKS.some((h) => h.id === ep.endHookId), '集尾卡点合法');
    assert.ok(ep.scenes.length === 3);
    ep.scenes.forEach((s) => assert.ok(s.microHookIds.length >= 2, 'tight档每场至少2微钩'));
  });
});

test('用户选择真实生效：preferred 优先、manual 指定位置强制、avoid 禁用与整层禁用兜底', () => {
  const pref = normalizeCuePref({ preferred: ['open_suspense'] });
  const p1 = planHooks(1, 2, pref, rng);
  assert.strictEqual(p1.episodes[0].openHookId, 'open_suspense', '偏好钩子被优先选中');
  const manual = planHooks(1, 2, normalizeCuePref({ mode: 'manual', manual: { 0: 'open_conflict' } }), rng);
  assert.strictEqual(manual.episodes[0].openHookId, 'open_conflict', 'manual逐点指定强制生效');
  // 只留一个微钩可用，结果只能是它
  const allMicro = ['micro_action', 'micro_line', 'micro_atmos', 'micro_emotion', 'micro_gap', 'micro_foreshadow', 'micro_sense', 'micro_chain'];
  const onlyOne = planHooks(1, 1, normalizeCuePref({ avoid: allMicro }), rng);
  onlyOne.episodes[0].scenes.forEach((s) => s.microHookIds.forEach((id) => assert.strictEqual(id, 'micro_minitwist', 'avoid后只剩唯一候选')));
  // 禁掉整层全部：必须回退兜底，绝不产生 undefined（健壮性回归）
  const allAvoid = [...allMicro, 'micro_minitwist'];
  const fallback = planHooks(1, 1, normalizeCuePref({ avoid: allAvoid }), rng);
  fallback.episodes[0].scenes.forEach((s) => s.microHookIds.forEach((id) => assert.ok(typeof id === 'string' && id.startsWith('micro_'), '整层禁用也有确定结果')));
});

test('v2.56 manual 位置键分层命名空间：开场/场末/集尾可分别独立指定，互不串号', () => {
  // 同一集：开场强制 open_conflict、第1场末强制 scene_info_drop、集尾强制 ep_cliff_reveal
  const pref = normalizeCuePref({
    mode: 'manual', strength: 'tight',
    manual: { 0: 'open_conflict', 1000: 'scene_info_drop', 20000: 'ep_cliff_reveal' },
  });
  const plan = planHooks(1, 2, pref, rng);
  const ep = plan.episodes[0];
  assert.strictEqual(ep.openHookId, 'open_conflict');
  assert.strictEqual(ep.scenes[0].endHookId, 'scene_info_drop');
  assert.strictEqual(ep.endHookId, 'ep_cliff_reveal');
  // 旧撞号场景：manual[0] 只作用于开场，不得污染场末/集尾
  assert.notStrictEqual(ep.endHookId, 'open_conflict');
});

test('buildEpisodeHookDirective：四层钩子落成可执行指令，且强调不生硬', () => {
  const plan = planHooks(1, 3, normalizeCuePref(), rng);
  const txt = buildEpisodeHookDirective(plan.episodes[0]);
  assert.ok(txt.includes('开场黄金3秒'), '含开场指令');
  assert.ok(txt.includes('集尾'), '含集尾卡点指令');
  assert.ok(txt.includes('微钩'), '含句子级微钩指令');
  assert.ok(txt.includes('禁止生硬'), '明确反对僵硬堆砌');
});

test('runEpisode 沙盘成稿自带四层钩子计划且无缺失类error，并随结果回传', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {},
    { episodeIndex: 0, episodeCount: 3, hookPref: { strength: 'balanced' }, scenesPerEp: 3 });
  assert.ok(r.hooks, '结果回传hooks');
  assert.ok(r.hooks.plan.openHookId && r.hooks.plan.endHookId, '本集开场/集尾钩齐全');
  assert.ok(r.hooks.plan.scenes.length === 3);
  const fatal = r.hooks.issues.filter((i) => i.level === 'error');
  assert.strictEqual(fatal.length, 0, '无开场/集尾缺失类硬伤');
  assert.ok(r.draft.length > 200, '成稿回归正常，未因接入钩子而破坏');
});

test('runEpisode 沙盘成稿同时自带反转/爽点/情绪节拍计划并回传，情绪有压必有放', async () => {
  const r = await runEpisode(EngineTier.ECONOMY, emptyBible(), '保洁工逆袭', () => {},
    { episodeIndex: 0, episodeCount: 3, beatPref: { strength: 'tight' } });
  assert.ok(r.beats, '结果回传beats');
  assert.ok(r.beats.plan.emotionPath.length === 3, '情绪弧3拍');
  assert.ok(r.beats.plan.payoffIds.length >= 2, 'tight档爽点≥2');
  const fatal = r.beats.issues.filter((i) => i.level === 'error');
  assert.strictEqual(fatal.length, 0, '无“只压不放”等硬伤');
});

test('v2.29 节奏策略数值级硬绑定场景规划：快剪自动多于慢板，显式 scenesPerEp 最高优先', async () => {
  const fast = await runEpisode(EngineTier.ECONOMY, emptyBible(), '战神赘婿打脸逆袭爽剧', () => {},
    { episodeIndex: 0, episodeCount: 1 });
  const slow = await runEpisode(EngineTier.ECONOMY, emptyBible(), '精品文艺电影感慢板', () => {},
    { episodeIndex: 0, episodeCount: 1 });
  assert.ok(fast.hooks.plan.scenes.length > slow.hooks.plan.scenes.length, '快剪场景数 > 慢板');
  const pinned = await runEpisode(EngineTier.ECONOMY, emptyBible(), '战神赘婿打脸逆袭爽剧', () => {},
    { episodeIndex: 0, episodeCount: 1, scenesPerEp: 2 });
  assert.strictEqual(pinned.hooks.plan.scenes.length, 2, '用户显式场景数覆盖节奏策略默认');
});

test('v2.29 情绪策略真实驱动节拍风味：爽感密集→打脸/逆袭/碾压，虐心→催泪/拉扯', async () => {
  const B = require('../dist/engine/beat-system.js');
  const dense = await runEpisode(EngineTier.ECONOMY, emptyBible(), '普通故事', () => {},
    { episodeIndex: 0, episodeCount: 3, emotionStrategy: 'payoff_dense' });
  const angst = await runEpisode(EngineTier.ECONOMY, emptyBible(), '普通故事', () => {},
    { episodeIndex: 0, episodeCount: 3, emotionStrategy: 'angst_tug' });
  const denseFlavors = (dense.beats.plan.payoffIds || []).map((id) => B.payoffFlavorOf(id)).filter(Boolean);
  assert.ok(denseFlavors.some((f) => ['face_slap', 'comeback', 'status_crush', 'truth_justice'].includes(f)), `爽感策略落地为打脸/逆袭/碾压风味，实际 ${denseFlavors}`);
  const angstFlavors = (angst.beats.plan.emotionPath || []).map((id) => B.emotionFlavorOf(id)).filter(Boolean);
  assert.ok(angstFlavors.some((f) => ['tear_angst', 'suspense_tug', 'press_release'].includes(f)), `虐心策略落地为催泪/拉扯情绪，实际 ${angstFlavors}`);
});
