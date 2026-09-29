const test = require('node:test');
const assert = require('node:assert');
const N = require('../dist/engine/narrative-orchestrator.js');

test('蓝图：每集场景齐全、都有开场钩与集尾卡点', () => {
  const bp = N.buildBlueprint(6, 4);
  assert.strictEqual(bp.episodes.length, 6);
  bp.episodes.forEach((e) => { assert.strictEqual(e.beats.length, 4); assert.ok(e.openHookId); assert.ok(e.endHookId); });
});

test('情绪波形有起伏：正常蓝图不出现"连续平铺"警告、无error', () => {
  const bp = N.buildBlueprint(10, 5, { ...N.DEFAULT_NARRATIVE }, () => 0.5);
  const iss = N.auditBlueprint(bp);
  assert.ok(!iss.some((i) => i.msg.includes('情绪强度连续平铺')));
  assert.deepStrictEqual(iss.filter((i) => i.level === 'error'), []);
});

test('集尾是反转断点时，该集必须真有反转内容（钩子与剧情协同）', () => {
  const prefs = {
    ...N.DEFAULT_NARRATIVE, density: 'sparse',
    hook: { mode: 'manual', strength: 'balanced', preferred: [], avoid: [], manual: Object.fromEntries([...Array(8)].map((_, i) => [20000 + i, 'ep_cliff_reversal'])) },
  };
  const bp = N.buildBlueprint(8, 4, prefs, () => 0.5);
  bp.episodes.forEach((e) => assert.ok(e.hasReversal, `第${e.episode}集缺反转`));
});

test('爽点密度：dense 明显多于 sparse', () => {
  const sum = (bp) => bp.episodes.reduce((s, e) => s + e.payoffCount, 0);
  const dense = N.buildBlueprint(10, 5, { ...N.DEFAULT_NARRATIVE, density: 'dense' }, () => 0.5);
  const sparse = N.buildBlueprint(10, 5, { ...N.DEFAULT_NARRATIVE, density: 'sparse' }, () => 0.5);
  assert.ok(sum(dense) > sum(sparse));
});

test('avoid 的爽点类型绝不出现', () => {
  const prefs = { ...N.DEFAULT_NARRATIVE, density: 'dense', payoff: { mode: 'auto', strength: 'balanced', preferred: [], avoid: ['po_faceSlap'], manual: {} } };
  const bp = N.buildBlueprint(10, 5, prefs, () => 0.3);
  bp.episodes.forEach((e) => e.beats.forEach((b) => assert.notStrictEqual(b.payoffId, 'po_faceSlap')));
});

test('架构岗/撰写岗指令：含标签简报、开场集尾，且明确禁止把术语写进正文', () => {
  const bp = N.buildBlueprint(3, 4, { ...N.DEFAULT_NARRATIVE }, () => 0.5);
  const arch = N.renderForArchitect(bp, '【题材品类】悬疑推理');
  assert.ok(arch.includes('悬疑推理'));
  assert.ok(arch.includes('开场钩'));
  const w = N.renderForWriter(bp.episodes[0]);
  assert.ok(w.includes('开场钩') && w.includes('集尾卡点'));
  assert.ok(w.includes('严禁把'));
});

test('audit 手工构造：连续3场同唤醒度=平铺警告；反转断点无反转=error；连续3集无爽点=warning', () => {
  const beat = (arousal) => ({ scene: 1, microHookIds: [], emotionId: 'x', arousal });
  const bp = {
    density: 'sparse', strength: 'balanced',
    hookPlan: { episodes: [], strength: 'balanced', mode: 'auto' },
    episodes: [
      { episode: 1, openHookId: 'o', endHookId: 'e', hasReversal: false, payoffCount: 0, beats: [beat(2), beat(2), beat(2)] },
      { episode: 2, openHookId: 'o', endHookId: 'e', hasReversal: false, payoffCount: 0, beats: [beat(1)] },
      { episode: 3, openHookId: 'o', endHookId: 'ep_cliff_reversal', hasReversal: false, payoffCount: 0, beats: [beat(1)] },
    ],
  };
  const iss = N.auditBlueprint(bp);
  assert.ok(iss.some((i) => i.msg.includes('情绪强度连续平铺')));
  assert.ok(iss.some((i) => i.level === 'error' && i.msg.includes('反转内容')));
  assert.ok(iss.some((i) => i.msg.includes('没有爽点')));
});

test('情绪→情感驱动：爽点密集却无关系沉淀=警告；含治愈/关系揭晓则不报', () => {
  const build = (withFeeling) => {
    const bp = N.buildBlueprint(3, 3);
    const beat = (i, over = {}) => ({ scene: i, microHookIds: [], endHookId: 'e', emotionId: 'em_rage', arousal: 3, payoffId: 'po_faceSlap', ...over });
    bp.episodes = [0, 1, 2].map((e) => ({
      episode: e + 1, openHookId: 'o', endHookId: 'e', hasReversal: false, payoffCount: 3,
      beats: [beat(1), beat(2, withFeeling ? { emotionId: 'em_heal', arousal: 1, payoffId: undefined } : {}), beat(3)],
    }));
    return N.auditBlueprint(bp);
  };
  assert.ok(build(false).some((i) => i.msg.includes('情感关系沉淀')));
  assert.ok(!build(true).some((i) => i.msg.includes('情感关系沉淀')));
});

// ================= v1.97 钩子×节拍 跨模块对齐与质检 =================
const H = require('../dist/engine/hook-system.js');
const B = require('../dist/engine/beat-system.js');
const lcg = (s) => { let x = s; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; };
const balancedPref = { mode: 'auto', strength: 'balanced', preferred: [], avoid: [] };

test('v1.97 审计：集尾反转卡点却无反转节拍=error（中英文对应，英文零中文）', () => {
  const hp = H.planHooks(6, 3, H.DEFAULT_PREF, lcg(4));
  const bp = B.planBeats(6, balancedPref, lcg(40));
  hp.episodes[1].endHookId = 'ep_cliff_reversal'; bp.episodes[1].reversalId = undefined;
  const zh = N.auditNarrativeCoherence(hp, bp, 'zh');
  const en = N.auditNarrativeCoherence(hp, bp, 'en');
  assert.ok(zh.some((i) => i.level === 'error' && i.msg.includes('反转卡点')));
  const hit = en.find((i) => i.level === 'error');
  assert.ok(hit && /reversal cliff/i.test(hit.msg));
  const cjk = (s) => /[一-鿿]/.test(s);
  en.forEach((i) => assert.ok(!cjk(i.msg) && !cjk(i.fix) && !cjk(i.at), '英文质检零中文'));
});

test('v1.97 对齐器：反转卡点脱配被确定性补齐，补齐后审计无 error、不与近邻同型', () => {
  let fixed = 0;
  for (let s = 1; s <= 60; s++) {
    const hp = H.planHooks(10, 3, H.DEFAULT_PREF, lcg(s));
    const bp = B.planBeats(10, { ...balancedPref, strength: 'relax' }, lcg(s * 7 + 3));
    const before = N.auditNarrativeCoherence(hp, bp, 'zh').filter((i) => i.level === 'error').length;
    const { alignedEpisodes } = N.alignBeatsToHooks(hp, bp, lcg(s * 13 + 1));
    fixed += alignedEpisodes.length;
    const after = N.auditNarrativeCoherence(hp, bp, 'zh').filter((i) => i.level === 'error').length;
    assert.strictEqual(after, 0, '对齐后不应再有反转卡点脱配');
    if (before > 0) assert.ok(alignedEpisodes.length > 0, '存在脱配时对齐器必须补齐');
    for (let i = 1; i < bp.episodes.length; i++) {
      const a = bp.episodes[i - 1].reversalId, b = bp.episodes[i].reversalId;
      assert.ok(!(a && b && a === b), '补齐反转不与紧邻同型');
    }
  }
  assert.ok(fixed > 0, '多组随机中应确实发生过补齐（证明脱配真实存在）');
});

test('v1.97 本集纠正指令：脱配时给指令、正常集为空串，且双语', () => {
  const hp = H.planHooks(5, 3, H.DEFAULT_PREF, lcg(8));
  const bp = B.planBeats(5, balancedPref, lcg(80));
  hp.episodes[2].endHookId = 'ep_cliff_reversal'; bp.episodes[2].reversalId = undefined;
  const zh = N.episodeCoherenceNote(hp.episodes[2], bp.episodes[2], 'zh');
  const en = N.episodeCoherenceNote(hp.episodes[2], bp.episodes[2], 'en');
  assert.ok(zh.includes('反转卡点') && en.includes('reversal cliff'));
  assert.strictEqual(N.episodeCoherenceNote(hp.episodes[0], bp.episodes[0], 'zh'), '');
});

test('v1.97 情感沉淀：全剧≥6爽点且零关系沉淀=warning，补一个治愈/真相即不报', () => {
  const mk = () => ({
    episodes: [0, 1, 2, 3].map((e) => ({ episode: e + 1, reversalId: 'rev_identity', payoffIds: ['pay_faceslap', 'pay_crush'], emotionPath: ['emo_burst', 'emo_release', 'emo_hype'] })),
    strength: 'tight', mode: 'auto',
  });
  const hp = { episodes: [1, 2, 3, 4].map((e) => ({ episode: e, openHookId: 'o', scenes: [], endHookId: 'ep_cliff_danger' })), strength: 'tight', mode: 'auto' };
  const noFeeling = mk();
  assert.ok(N.auditNarrativeCoherence(hp, noFeeling, 'zh').some((i) => i.msg.includes('爽完即忘')));
  const withFeeling = mk(); withFeeling.episodes[0].emotionPath[0] = 'emo_heal';
  assert.ok(!N.auditNarrativeCoherence(hp, withFeeling, 'zh').some((i) => i.msg.includes('爽完即忘')));
});
