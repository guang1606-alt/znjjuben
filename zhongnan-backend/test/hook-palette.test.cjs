const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/engine/hook-palette.js');
const HS = require('../dist/engine/hook-system.js');
const STRAT = require('../dist/engine/hook-strategy.js');

const LAYER_IDS = {
  open: new Set(HS.OPEN_HOOKS.map((h) => h.id)),
  end: new Set(HS.EPISODE_END_HOOKS.map((h) => h.id)),
  scene: new Set(HS.SCENE_HOOKS.map((h) => h.id)),
};

test('调色板：确定性——同输入两次结果完全一致', () => {
  const a = P.buildHookPalette({ episodeCount: 3, scenesPerEp: 4, tags: ['复仇', '逆袭'] });
  const b = P.buildHookPalette({ episodeCount: 3, scenesPerEp: 4, tags: ['复仇', '逆袭'] });
  assert.deepStrictEqual(a, b);
});

test('调色板：位置编号与 planHooks 一致（open=集序号、scene=ep*100+s、end=集序号），场末牵引随强度', () => {
  const bal = P.buildHookPalette({ episodeCount: 2, scenesPerEp: 4, strategy: 'balanced' });
  assert.strictEqual(bal.strength, 'balanced');
  const kinds = bal.positions.map((p) => p.kind);
  // 每集 open/end 各一；balanced 奇数索引场(s=1,3)有场末牵引
  assert.strictEqual(kinds.filter((k) => k === 'open').length, 2);
  assert.strictEqual(kinds.filter((k) => k === 'end').length, 2);
  assert.strictEqual(kinds.filter((k) => k === 'scene').length, 4);
  const scenePos = bal.positions.filter((p) => p.kind === 'scene').map((p) => p.pos);
  assert.deepStrictEqual(scenePos, [1001, 1003, 1101, 1103]);
  const tight = P.buildHookPalette({ episodeCount: 1, scenesPerEp: 4, strategy: 'dense' });
  assert.strictEqual(tight.positions.filter((p) => p.kind === 'scene').length, 4); // tight 每场都有
  const relax = P.buildHookPalette({ episodeCount: 1, scenesPerEp: 4, strategy: 'premium' });
  assert.strictEqual(relax.positions.filter((p) => p.kind === 'scene').length, 1); // relax 仅末场
});

test('调色板：默认与备选都是本层合法 id，默认=最高分，备选不重复', () => {
  const pal = P.buildHookPalette({ episodeCount: 4, scenesPerEp: 3, tags: ['悬疑'] });
  pal.positions.forEach((p) => {
    const ok = LAYER_IDS[p.kind];
    assert.ok(ok.has(p.systemDefault.id), `默认 ${p.systemDefault.id} 不属于 ${p.kind} 层`);
    p.alternatives.forEach((a) => assert.ok(ok.has(a.id)));
    const ids = [p.systemDefault.id, ...p.alternatives.map((a) => a.id)];
    assert.strictEqual(new Set(ids).size, ids.length, '默认与备选不得重复');
    assert.deepStrictEqual(p.validIds, ids);
    assert.ok(p.systemDefault.reason.zh && p.systemDefault.reason.en);
  });
});

test('调色板：英文理由零中文，六风味齐备', () => {
  const pal = P.buildHookPalette({ episodeCount: 2, scenesPerEp: 2 });
  assert.strictEqual(pal.microFlavors.length, 6);
  pal.positions.forEach((p) => {
    assert.ok(!/[一-鿿]/.test(p.systemDefault.reason.en), '英文理由含中文');
    p.alternatives.forEach((a) => assert.ok(!/[一-鿿]/.test(a.reason.en)));
    assert.ok(!/[一-鿿]/.test(p.label.en));
  });
});

test('调色板：策略偏好进入默认——强钩密集流首集开场默认落在策略 preferred', () => {
  const pal = P.buildHookPalette({ episodeCount: 1, scenesPerEp: 1, strategy: 'dense' });
  const open = pal.positions.find((p) => p.kind === 'open');
  assert.ok(STRAT.getHookStrategy('dense').preferred.includes(open.systemDefault.id));
});

test('调色板：题材标签命中加分，悬疑标签下集尾默认优先揭秘/反转类', () => {
  const pal = P.buildHookPalette({ episodeCount: 6, scenesPerEp: 2, tags: ['悬疑', '刑侦'] });
  const ends = pal.positions.filter((p) => p.kind === 'end').map((p) => p.systemDefault.id);
  assert.ok(ends.some((id) => ['ep_cliff_reveal', 'ep_cliff_reversal', 'ep_cliff_newperson', 'ep_cliff_danger'].includes(id)));
});

test('调色板：用户点选转 manual，非法位/非法 id 被拒，与默认相同不落 manual', () => {
  const pal = P.buildHookPalette({ episodeCount: 2, scenesPerEp: 2 });
  const open0 = pal.positions.find((p) => p.pos === 0 && p.kind === 'open');
  const alt = open0.alternatives[0].id;
  const end0 = pal.positions.find((p) => p.kind === 'end' && p.ep === 1);
  const picks = {
    [String(open0.pos)]: alt,                       // 合法改选
    [String(end0.pos)]: end0.systemDefault.id,     // 与默认相同 → 不落
    999: 'open_conflict',                          // 非法位置
    [String(open0.pos + 1)]: 'micro_action',       // id 不属于该层白名单
  };
  const r = P.palettePicksToManual(pal, picks);
  assert.strictEqual(r.manual[open0.pos], alt);
  assert.ok(!(end0.pos in r.manual));
  assert.deepStrictEqual(r.rejected.sort(), ['1', '999']);
});

test('调色板：集数/场次越界自动 clamp，不报错', () => {
  const pal = P.buildHookPalette({ episodeCount: 9999, scenesPerEp: 99 });
  assert.strictEqual(pal.positions.filter((p) => p.kind === 'open').length, 120);
  const one = P.buildHookPalette({ episodeCount: 0, scenesPerEp: 0 });
  assert.strictEqual(one.positions.filter((p) => p.kind === 'open').length, 1);
});
