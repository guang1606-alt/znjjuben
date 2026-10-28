/**
 * v2.329 三维创作结构测试：模式（8）× 剧本类型（10，v2.332 新增互动影游）× 输出语言（10）
 * 重点覆盖三件事：
 *  1) 8 模式注册表与四档会员可见性（成本分层：tag / +3 / +3 / +1）
 *  2) scriptType / language 分级与历史映射（旧项目打开不降级）
 *  3) craftKeyOf / isSourceTextMode 兼容铁律（旧方法论 key 一字不改）
 */
const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/config/modes.js');
const IR = require('../dist/engine/intent-router.js');
const MC = require('../dist/engine/mode-craft.js');

test('8 模式注册表：id 不重复、四档可见性 1/4/7/8', () => {
  const ids = M.CREATION_MODES.map((m) => m.id);
  assert.deepStrictEqual([...new Set(ids)], ids, '模式 id 不得重复');
  assert.strictEqual(ids.length, 8);
  assert.deepStrictEqual(
    ids.slice().sort(),
    ['diary', 'duel', 'hot', 'interview', 'multiverse', 'persona', 'spark', 'tag'].sort(),
  );
  assert.strictEqual(M.modesForLevel('FREE').length, 1);
  assert.strictEqual(M.modesForLevel('BASIC').length, 4);
  assert.strictEqual(M.modesForLevel('ADVANCED').length, 7);
  assert.strictEqual(M.modesForLevel('PRO').length, 8);
  // 每个模式都有中英名/描述/成本提示，前端无需再硬编码文案
  for (const m of M.CREATION_MODES) {
    assert.ok(m.name && m.nameEn && m.desc && m.descEn, `${m.id} 缺中英文案`);
  }
});

test('10 种剧本类型分级：FREE 1 / BASIC 5 / ADVANCED 8 / PRO 10', () => {
  assert.strictEqual(M.SCRIPT_TYPES.length, 10);
  assert.strictEqual(M.scriptTypesForLevel('FREE').length, 1);
  assert.strictEqual(M.scriptTypesForLevel('BASIC').length, 5);
  assert.strictEqual(M.scriptTypesForLevel('ADVANCED').length, 8);
  assert.strictEqual(M.scriptTypesForLevel('PRO').length, 10);
  assert.strictEqual(M.scriptTypeAvailable('live_action_drama', 'FREE'), true);
  assert.strictEqual(M.scriptTypeAvailable('aigc_drama', 'FREE'), false);
  assert.strictEqual(M.scriptTypeAvailable('aigc_drama', 'BASIC'), true);
  assert.strictEqual(M.scriptTypeAvailable('tv_series', 'BASIC'), false);
  assert.strictEqual(M.scriptTypeAvailable('feature_film', 'ADVANCED'), false);
  assert.strictEqual(M.scriptTypeAvailable('feature_film', 'PRO'), true);
  assert.strictEqual(M.scriptTypeUnlockLevel('feature_film'), 'PRO');
  assert.strictEqual(M.scriptTypeUnlockLevel('ad_script'), 'BASIC');
  // v2.332 互动影游：与互动剧同档（高级），不增加模型调用次数
  assert.strictEqual(M.scriptTypeAvailable('interactive_game', 'BASIC'), false);
  assert.strictEqual(M.scriptTypeAvailable('interactive_game', 'ADVANCED'), true);
  assert.strictEqual(M.scriptTypeUnlockLevel('interactive_game'), 'ADVANCED');
  // 别名归一
  assert.strictEqual(M.canonicalScriptTypeId('movie'), 'feature_film');
  assert.strictEqual(M.canonicalScriptTypeId('manju'), 'aigc_drama');
  assert.strictEqual(M.canonicalScriptTypeId('fmv'), 'interactive_game');
  assert.strictEqual(M.canonicalScriptTypeId('interactive_film'), 'interactive_game');
  assert.strictEqual(M.canonicalScriptTypeId('interactive'), 'interactive_drama');
  assert.strictEqual(M.canonicalScriptTypeId('unknown'), undefined);
});

test('10 种输出语言分级：FREE 2 / BASIC 6 / ADVANCED 10，别名可归一', () => {
  assert.strictEqual(M.OUTPUT_LANGUAGES.length, 10);
  assert.strictEqual(M.languagesForLevel('FREE').length, 2);
  assert.strictEqual(M.languagesForLevel('BASIC').length, 6);
  assert.strictEqual(M.languagesForLevel('ADVANCED').length, 10);
  assert.strictEqual(M.languageAvailable('en', 'FREE'), true);
  assert.strictEqual(M.languageAvailable('ja', 'FREE'), false);
  assert.strictEqual(M.languageAvailable('ja', 'BASIC'), true);
  assert.strictEqual(M.languageAvailable('th', 'BASIC'), false);
  assert.strictEqual(M.languageAvailable('th', 'ADVANCED'), true);
  assert.strictEqual(M.languageUnlockLevel('ar'), 'ADVANCED');
  assert.strictEqual(M.canonicalLanguageCode('jp'), 'ja');
  assert.strictEqual(M.canonicalLanguageCode('chinese'), 'zh');
  assert.strictEqual(M.canonicalLanguageCode('latin'), undefined, '拉丁语不进正式位');
});

test('历史 id → (mode, scriptType, track) 全量解析，旧项目不降级', () => {
  const cases = [
    ['adapt', 'spark', 'live_action_drama', 'material_rewrite'],
    ['novel', 'spark', 'live_action_drama', 'material_rewrite'],
    ['hit_lab', 'spark', 'live_action_drama', 'signature_scene'],
    ['scene', 'spark', 'live_action_drama', 'signature_scene'],
    ['reverse', 'spark', 'live_action_drama', 'hit_reverse'],
    ['viral_reverse', 'spark', 'live_action_drama', 'hit_reverse'],
    ['video_short', 'spark', 'short_video', 'material_rewrite'],
    ['shortvideo', 'spark', 'short_video', 'material_rewrite'],
    ['branded_skit', 'spark', 'ad_script', 'material_rewrite'],
    ['softad', 'spark', 'ad_script', 'material_rewrite'],
    ['interactive', 'tag', 'interactive_drama', undefined],
    ['long_ip', 'multiverse', 'long_series', undefined],
    ['longip', 'multiverse', 'long_series', undefined],
    ['film', 'persona', 'feature_film', undefined],
    ['mature_x', 'persona', 'feature_film', undefined],
    ['xscript', 'persona', 'feature_film', undefined],
  ];
  for (const [raw, mode, scriptType, track] of cases) {
    const r = M.resolveCreationMode(raw);
    assert.ok(r, `${raw} 必须可解析`);
    assert.strictEqual(r.mode, mode, `${raw} → mode`);
    assert.strictEqual(r.scriptType, scriptType, `${raw} → scriptType`);
    assert.strictEqual(r.track, track, `${raw} → track`);
    assert.strictEqual(r.legacy, true, `${raw} 应标记 legacy`);
    assert.strictEqual(M.isLegacyMode(raw), true);
  }
  // 新 id 不是 legacy
  assert.strictEqual(M.isLegacyMode('duel'), false);
  assert.strictEqual(M.resolveCreationMode('duel').legacy, false);
  // 无法识别的 id
  assert.strictEqual(M.resolveCreationMode('not_a_mode'), undefined);
  assert.strictEqual(M.canonicalModeId('not_a_mode'), undefined);
});

test('craftKeyOf：旧方法论 key 一字不改，spark 按轨道回落 adapt/hit_lab', () => {
  assert.strictEqual(M.craftKeyOf('novel'), 'adapt', '小说压缩与改编共用方法论（门禁仍按 raw 单独管）');
  assert.strictEqual(M.craftKeyOf('scene'), 'hit_lab');
  assert.strictEqual(M.craftKeyOf('viral_reverse'), 'hit_lab');
  assert.strictEqual(M.craftKeyOf('softad'), 'video_short');
  assert.strictEqual(M.craftKeyOf('branded_skit'), 'video_short');
  assert.strictEqual(M.craftKeyOf('interactive'), 'interactive');
  assert.strictEqual(M.craftKeyOf('long_ip'), 'long_ip');
  assert.strictEqual(M.craftKeyOf('film'), 'film');
  assert.strictEqual(M.craftKeyOf('mature_x'), 'film');
  assert.strictEqual(M.craftKeyOf('spark', 'material_rewrite'), 'adapt');
  assert.strictEqual(M.craftKeyOf('spark', 'signature_scene'), 'hit_lab');
  assert.strictEqual(M.craftKeyOf('spark', 'hit_reverse'), 'hit_lab');
  assert.strictEqual(M.craftKeyOf('spark'), 'adapt', '缺省轨道按素材改编');
  assert.strictEqual(M.craftKeyOf('duel'), 'duel');
  assert.strictEqual(M.craftKeyOf('multiverse'), 'multiverse');
  assert.strictEqual(M.craftKeyOf(''), '');
});

test('isSourceTextMode：素材改编/名场面/逆向需原文闸门，其余模式不误判', () => {
  assert.strictEqual(M.isSourceTextMode('adapt'), true);
  assert.strictEqual(M.isSourceTextMode('novel'), true);
  assert.strictEqual(M.isSourceTextMode('hit_lab'), true);
  assert.strictEqual(M.isSourceTextMode('spark', 'material_rewrite'), true);
  assert.strictEqual(M.isSourceTextMode('spark', 'signature_scene'), true);
  assert.strictEqual(M.isSourceTextMode('spark', 'hit_reverse'), true);
  assert.strictEqual(M.isSourceTextMode('hot'), false);
  assert.strictEqual(M.isSourceTextMode('diary'), false);
  assert.strictEqual(M.isSourceTextMode('duel'), false);
  assert.strictEqual(M.isSourceTextMode('multiverse'), false);
});

test('resolveProjectAxes：旧项目缺类型/语言时按历史映射兜底，语言缺省中文', () => {
  assert.deepStrictEqual(M.resolveProjectAxes({ mode: 'film' }), {
    mode: 'persona', scriptType: 'feature_film', language: 'zh', legacy: true,
  });
  assert.deepStrictEqual(M.resolveProjectAxes({ mode: 'softad' }), {
    mode: 'spark', scriptType: 'ad_script', language: 'zh', legacy: true,
  });
  // 显式类型/语言优先
  assert.deepStrictEqual(M.resolveProjectAxes({ mode: 'tag', scriptType: 'tv_series', language: 'ko' }), {
    mode: 'tag', scriptType: 'tv_series', language: 'ko', legacy: false,
  });
  // 未知 mode 不崩、类型仍可显式指定
  assert.deepStrictEqual(M.resolveProjectAxes({ mode: 'bogus', scriptType: 'short_video' }), {
    mode: undefined, scriptType: 'short_video', language: 'zh', legacy: false,
  });
});

test('创作方法论：8 模式各自有中英指令，且成品仍受版式/字数闸门约束', () => {
  for (const id of ['tag', 'interview', 'diary', 'spark', 'hot', 'persona', 'duel', 'multiverse']) {
    const zh = MC.buildModeCraftDirective(id, 'zh');
    const en = MC.buildModeCraftDirective(id, 'en');
    assert.ok(zh.length > 20, `${id} 中文方法论缺失`);
    assert.ok(en.length > 20, `${id} 英文方法论缺失`);
  }
  assert.ok(MC.buildModeCraftDirective('duel', 'zh').includes('双人对撞') || MC.buildModeCraftDirective('duel', 'zh').includes('立场'));
  assert.ok(MC.buildModeCraftDirective('multiverse', 'zh').includes('分叉'));
  // 旧 spark 轨道仍拿到旧方法论（不丢能力）
  assert.ok(MC.buildModeCraftDirective('spark', 'zh', 'material_rewrite').length > 20);
  assert.ok(MC.buildHitLabDirective('spark', 'signature_scene', 'zh').includes('名场面'));
  assert.ok(MC.buildHitLabDirective('spark', 'hit_reverse', 'zh').includes('爆款逆向'));
  assert.strictEqual(MC.buildHitLabDirective('duel', undefined, 'zh'), '', '非名场面轨道不得注入');
  // Method Trace 覆盖新五模式
  for (const id of ['diary', 'spark', 'persona', 'duel', 'multiverse']) {
    assert.ok(MC.buildMethodTraceDirective(id, 'zh', 'balanced').includes('本集创作方法论'), `${id} 缺 Method Trace`);
  }
});

test('意图路由：一句话能识别双人对撞/世界线/日记/角色自述', () => {
  const r1 = IR.routeIntent({ brief: '双人对撞，两个立场死磕对峙，谁也不肯先退', level: 'ADVANCED' });
  assert.strictEqual(r1.mode, 'duel');
  const r2 = IR.routeIntent({ brief: '平行时空：如果他那天没有上那辆车，另一种可能是怎样', level: 'PRO' });
  assert.strictEqual(r2.mode, 'multiverse');
  const r3 = IR.routeIntent({ brief: '我把这三年的日记整理一下，想改成剧本', level: 'BASIC' });
  assert.strictEqual(r3.mode, 'diary');
  assert.strictEqual(r3.gate, 'diary_authorize', '日记式必须显式授权后才可梳理');
  const r4 = IR.routeIntent({ brief: '让反派角色自述，用自己的口吻讲完这个故事', level: 'ADVANCED' });
  assert.strictEqual(r4.mode, 'persona');
  // 等级不足时灵感式轨道降级为素材改编（不 403、不静默丢失）
  const r5 = IR.routeIntent({ brief: '把这部爆款短剧逆向拆解，批量出新本', level: 'BASIC' });
  assert.strictEqual(r5.mode, 'spark');
  assert.strictEqual(r5.track, 'material_rewrite');
  // 确认闸门：灵感式必须带 gate
  const r6 = IR.routeIntent({ brief: '我只有一个灵感：电梯里的人都在说谎', level: 'BASIC' });
  assert.strictEqual(r6.mode, 'spark');
  assert.strictEqual(r6.gate, 'spark_confirm');
});
