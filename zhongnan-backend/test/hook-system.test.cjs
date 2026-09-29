const test = require('node:test');
const assert = require('node:assert');
const H = require('../dist/engine/hook-system.js');

test('微钩子9型齐全，开场/集尾/场/微四层都有库', () => {
  assert.strictEqual(H.MICRO_HOOKS.length, 9);
  ['open', 'episode', 'scene', 'micro'].forEach((l) => assert.ok(H.hooksByLayer(l).length > 0));
});

test('每集必有黄金3秒开场钩与集尾卡点', () => {
  const p = H.planHooks(5, 4);
  assert.strictEqual(p.episodes.length, 5);
  p.episodes.forEach((e) => { assert.ok(e.openHookId); assert.ok(e.endHookId); assert.strictEqual(e.scenes.length, 4); });
});

test('集尾卡点相邻不重样（轮换防疲劳）', () => {
  const p = H.planHooks(12, 3, { ...H.DEFAULT_PREF }, () => 0.99);
  for (let i = 1; i < p.episodes.length; i++) assert.notStrictEqual(p.episodes[i].endHookId, p.episodes[i - 1].endHookId);
});

test('强度档位：tight 比 relax 钩子更密', () => {
  const count = (p) => p.episodes.reduce((s, e) => s + e.scenes.reduce((a, sc) => a + sc.microHookIds.length + (sc.endHookId ? 1 : 0), 0), 0);
  const tight = H.planHooks(4, 5, { mode: 'auto', strength: 'tight', preferred: [], avoid: [], manual: {} }, () => 0.5);
  const relax = H.planHooks(4, 5, { mode: 'auto', strength: 'relax', preferred: [], avoid: [], manual: {} }, () => 0.5);
  assert.ok(count(tight) > count(relax));
});

test('manual/hybrid：用户逐点指定被尊重；avoid 类型绝不出现', () => {
  // v2.56 位置键分层命名空间：集尾=20000+集序号
  const pref = { mode: 'manual', strength: 'balanced', preferred: [], avoid: ['ep_cliff_reversal'], manual: { 20000: 'ep_cliff_emotion', 20002: 'ep_cliff_choice' } };
  const p = H.planHooks(4, 3, pref, () => 0.1);
  assert.strictEqual(p.episodes[0].endHookId, 'ep_cliff_emotion');
  assert.strictEqual(p.episodes[2].endHookId, 'ep_cliff_choice');
  p.episodes.forEach((e) => assert.notStrictEqual(e.endHookId, 'ep_cliff_reversal'));
});

test('pickWithPreference：偏好加权优先、冷却期内不连用', () => {
  const cands = H.MICRO_HOOKS;
  const pref = { mode: 'auto', strength: 'balanced', preferred: ['micro_line'], avoid: [], manual: {} };
  const pick = H.pickWithPreference(0, cands, pref, [], () => 0.0);
  assert.strictEqual(pick.id, 'micro_line'); // 偏好命中
  // micro_action cooldown=1，紧邻位置被冷却
  const p2 = H.pickWithPreference(1, cands.filter((h) => h.id === 'micro_action'), { ...H.DEFAULT_PREF }, ['micro_action'], () => 0);
  assert.strictEqual(p2.id, 'micro_action'); // 只有它时放开保底，不返回undefined
});

test('audit 检出：缺集尾、连续空场塌陷、伏笔未兑现', () => {
  const bad = {
    strength: 'balanced', mode: 'auto',
    episodes: [{
      episode: 1, openHookId: 'open_conflict', endHookId: '',
      scenes: [
        { scene: 1, endHookId: undefined, microHookIds: ['micro_foreshadow'] },
        { scene: 2, endHookId: undefined, microHookIds: [] },
        { scene: 3, endHookId: undefined, microHookIds: [] },
      ],
    }],
  };
  const iss = H.auditHooks(bad, false);
  assert.ok(iss.some((i) => i.level === 'error' && i.msg.includes('集尾卡点')));
  assert.ok(iss.some((i) => i.level === 'warning' && i.msg.includes('节奏可能塌陷')));
  assert.ok(iss.some((i) => i.level === 'error' && i.msg.includes('伏笔')));
});

test('健康计划审计基本无 error', () => {
  const p = H.planHooks(6, 4, { ...H.DEFAULT_PREF }, () => 0.5);
  const iss = H.auditHooks(p, true);
  assert.deepStrictEqual(iss.filter((i) => i.level === 'error'), []);
});

// ============ v1.95 钩子体系双语回归 ============
const cjk = (o) => /[一-鿿]/.test(typeof o === 'string' ? o : JSON.stringify(o));
test('29个钩子英文层全覆盖、零中文', () => {
  assert.strictEqual(H.ALL_HOOKS.length, 29);
  H.ALL_HOOKS.forEach((h) => {
    const e = H.describeHook(h.id, 'en');
    assert.ok(e, `missing EN for ${h.id}`);
    assert.ok(!cjk(e.name) && !cjk(e.definition) && !cjk(e.technique) && !cjk(e.example), `CJK leak ${h.id}`);
    assert.ok(Array.isArray(e.bestFor) && e.bestFor.length > 0);
  });
});
test('hooksByLayer/hookName 英文零中文，默认中文逐字不变', () => {
  ['open', 'episode', 'scene', 'micro'].forEach((l) => {
    const en = H.hooksByLayer(l, 'en');
    assert.ok(en.length > 0); assert.ok(!cjk(en), `layer ${l} CJK`);
    const zh = H.hooksByLayer(l);
    assert.ok(cjk(zh[0].name), 'zh default must stay Chinese');
  });
  const id = H.ALL_HOOKS[0].id;
  assert.ok(cjk(H.hookName(id)));
  assert.ok(!cjk(H.hookName(id, 'en')));
});
test('auditHooks 英文问题零中文且语义对应；中文默认不变', () => {
  const bad = { strength: 'balanced', mode: 'auto', episodes: [{ episode: 1, openHookId: '', endHookId: '', scenes: [{ scene: 1, microHookIds: [] }, { scene: 2, microHookIds: [] }] }] };
  const en = H.auditHooks(bad, false, 'en');
  assert.ok(en.length >= 3); assert.ok(!cjk(en));
  assert.ok(en.some((i) => /golden-3-seconds/.test(i.msg)));
  const zh = H.auditHooks(bad, false);
  assert.ok(zh.some((i) => i.msg.includes('开场钩')));
});
test('REVERSAL_TYPES_EN 与中文反转一一对应', () => {
  assert.strictEqual(H.REVERSAL_TYPES_EN.length, H.REVERSAL_TYPES.length);
  H.REVERSAL_TYPES.forEach((z, i) => { assert.ok(!cjk(H.reversalName(z, 'en'))); assert.strictEqual(H.reversalName(z), z); });
});
test('pipeline 钩子指令英文零中文、中文默认保留', () => {
  const P = require('../dist/agents/pipeline.js');
  const p = H.planHooks(2, 3, { ...H.DEFAULT_PREF }, () => 0.5);
  const en = P.buildEpisodeHookDirective(p.episodes[0], 'en');
  assert.ok(!cjk(en)); assert.ok(/golden first-3-seconds/i.test(en));
  const zh = P.buildEpisodeHookDirective(p.episodes[0]);
  assert.ok(cjk(zh)); assert.ok(zh.includes('黄金3秒'));
});

test('v2.01 微钩风味完整覆盖9型且互斥不重不漏', () => {
  const covered = new Set();
  H.MICRO_HOOKS.forEach((h) => { const f = H.hookFlavor(h.id); assert.ok(f, `${h.id} 必须归属某风味`); covered.add(f); });
  assert.strictEqual(H.MICRO_HOOKS.length, 9, '微钩共9型');
  assert.deepStrictEqual([...covered].sort(), [...H.HOOK_FLAVORS].sort(), '六大风味都至少覆盖一型');
});

test('v2.01 风味偏好确定性加权：选语言钩后语言钩占比显著升高但不霸占全部', () => {
  const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const countLine = (pref) => {
    const plan = H.planHooks(30, 6, { ...H.DEFAULT_PREF, strength: 'tight', ...pref }, lcg(12345));
    let total = 0, line = 0;
    plan.episodes.forEach((ep) => ep.scenes.forEach((sc) => sc.microHookIds.forEach((id) => { total += 1; if (id === 'micro_line') line += 1; })));
    return { total, line };
  };
  const base = countLine({});
  const fav = countLine({ microFlavors: ['line'] });
  assert.ok(fav.total > 200 && base.total > 200, '样本量足够');
  assert.ok(fav.line / fav.total > 0.35, `偏好语言钩后占比应明显升高，实得 ${fav.line}/${fav.total}`);
  assert.ok(base.line / base.total < 0.25, '无偏好时语言钩仅约九分之一');
  assert.ok(fav.line < fav.total, '软偏好不霸占全部，仍保留多样性');
});

test('v2.01 风味组被冷却/禁用时安全回退，永不返回空；多风味取并集', () => {
  // 只留 line 风味但禁用 micro_line，应回退到其它风味而非 undefined
  const r1 = H.pickWithPreference(0, H.MICRO_HOOKS, { ...H.DEFAULT_PREF, microFlavors: ['line'], avoid: ['micro_line'] }, [], () => 0.5);
  assert.ok(r1 && r1.id !== 'micro_line');
  const r2 = H.pickWithPreference(1, H.MICRO_HOOKS, { ...H.DEFAULT_PREF, microFlavors: ['action', 'atmos'] }, [], () => 0.01);
  assert.ok(['action', 'atmos'].includes(H.hookFlavor(r2.id)));
});

test('v2.01 风味名双语；指令带风味偏好且英文零中文；normalize 清洗非法风味', () => {
  const P = require('../dist/agents/pipeline.js');
  assert.strictEqual(H.flavorName('line'), '语言钩子');
  assert.strictEqual(H.flavorName('line', 'en'), 'Line hook');
  const plan = H.planHooks(1, 3, { ...H.DEFAULT_PREF, microFlavors: ['line', 'emotion'] }, () => 0.5);
  const en = P.buildEpisodeHookDirective(plan.episodes[0], 'en', ['line', 'emotion']);
  assert.ok(!cjk(en) && /Creator-preferred micro-hook flavor/.test(en));
  const zh = P.buildEpisodeHookDirective(plan.episodes[0], 'zh', ['line']);
  assert.ok(zh.includes('创作者偏好的微钩风味') && zh.includes('语言钩子'));
  const norm = P.normalizeCuePref({ microFlavors: ['line', 'bogus', 'atmos'] });
  assert.deepStrictEqual(norm.microFlavors, ['line', 'atmos']);
});

test('v2.78 手动定点不涟漪：固定第1集开场钩后，其余集与未定点开场钩同源 rng 完全一致', () => {
  const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const mkPlan = (pref) => H.planHooks(6, 4, { ...H.DEFAULT_PREF, strength: 'tight', ...pref }, lcg(987654321));
  const base = mkPlan({});
  const pinnedId = H.OPEN_HOOKS[0].id;
  const manual = mkPlan({ mode: 'manual', manual: { 0: pinnedId } });
  // 定点生效
  assert.strictEqual(manual.episodes[0].openHookId, pinnedId);
  // 其余 5 集所有钩子布置必须与无 manual 时逐字节一致（forced 分支照常消耗 rng）
  for (let e = 1; e < base.episodes.length; e++) {
    assert.deepStrictEqual(manual.episodes[e], base.episodes[e], `第${e + 1}集钩子被定点涟漪扰动`);
  }
  // 第1集除被定点的开场钩外，集尾/场钩也保持同源
  assert.strictEqual(manual.episodes[0].endHookId, base.episodes[0].endHookId);
  assert.deepStrictEqual(manual.episodes[0].scenes, base.episodes[0].scenes);
});
