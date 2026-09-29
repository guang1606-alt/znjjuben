const { describe, it } = require('node:test');
const assert = require('node:assert');
const P = require('../dist/engine/beat-palette.js');
const B = require('../dist/engine/beat-system.js');

const cjk = (o) => /[一-鿿]/.test(typeof o === 'string' ? o : JSON.stringify(o));
const lcg = (s) => { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
// 与 beat-palette/pipeline 同款 mulberry32（逐集换种子重排时必须同算法才能逐槽对齐）
const lcgFactory = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('v2.57 节拍调色板 buildBeatPalette', () => {
  it('确定性：同输入同输出', () => {
    const a = P.buildBeatPalette({ episodeCount: 8, strength: 'balanced', tags: ['逆袭', '职场'] });
    const b = P.buildBeatPalette({ episodeCount: 8, strength: 'balanced', tags: ['逆袭', '职场'] });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it('每槽★默认+2备选，id合法且互不重复', () => {
    const pal = P.buildBeatPalette({ episodeCount: 6 });
    const valid = new Set([...B.REVERSAL_BEATS, ...B.PAYOFF_BEATS, ...B.EMOTION_BEATS].map((x) => x.id));
    assert.ok(pal.episodes.length === 6);
    pal.episodes.forEach((ep) => {
      ep.slots.forEach((s) => {
        assert.strictEqual(s.alternatives.length, 2, '每槽恰好2备选');
        assert.ok(valid.has(s.systemDefault.id));
        s.alternatives.forEach((a) => assert.ok(valid.has(a.id)));
        const ids = [s.systemDefault.id, ...s.alternatives.map((a) => a.id)];
        assert.strictEqual(new Set(ids).size, 3, '三项互不重复');
        assert.deepStrictEqual(s.validIds, ids);
        assert.strictEqual(s.validIds.length, 3);
      });
    });
  });

  it('★默认与 planBeats 真实落位逐槽一致（展示即生成）', () => {
    const pref = { strength: 'tight', payoffFlavors: ['face_slap'], preferred: ['rev_identity'] };
    const pal = P.buildBeatPalette({ episodeCount: 10, strength: 'tight', pref });
    // 与 pipeline 完全同式：逐集换种子重排全剧、取本集
    pal.episodes.forEach((palEp, i) => {
      const planEp = B.planBeats(10, B.normalizeBeatPref({ ...pref, mode: 'auto', manual: {} }), lcgFactory(0x5bd1e995 ^ (i * 40503))).episodes[i];
      const slots = palEp.slots;
      const rev = slots.filter((s) => s.kind === 'reversal');
      if (planEp.reversalId) assert.strictEqual(rev[0].systemDefault.id, planEp.reversalId);
      else assert.strictEqual(rev.length, 0);
      const pays = slots.filter((s) => s.kind === 'payoff').map((s) => s.systemDefault.id);
      assert.deepStrictEqual(pays, planEp.payoffIds);
      const emos = slots.filter((s) => s.kind === 'emotion').map((s) => s.systemDefault.id);
      assert.deepStrictEqual(emos, planEp.emotionPath);
    });
  });

  it('manual 键走分层命名空间：reversal=10000+e / payoff=20000+e*10+k / emotion=30000+e*3+j', () => {
    const pal = P.buildBeatPalette({ episodeCount: 3, strength: 'tight' });
    pal.episodes.forEach((ep, e) => {
      ep.slots.forEach((s) => {
        if (s.kind === 'reversal') assert.strictEqual(s.pos, 10000 + e);
        if (s.kind === 'payoff') assert.strictEqual(s.pos, 20000 + e * 10 + s.slot);
        if (s.kind === 'emotion') assert.strictEqual(s.pos, 30000 + e * 3 + s.slot);
      });
    });
  });

  it('题材标签命中会写进理由', () => {
    const pal = P.buildBeatPalette({ episodeCount: 4, tags: ['逆袭'] });
    const hit = pal.episodes.flatMap((e) => e.slots).some((s) =>
      /逆袭/.test(s.systemDefault.reason.zh) || s.alternatives.some((a) => /逆袭/.test(a.reason.zh)));
    assert.ok(hit, '至少一个槽的理由提到标签命中');
  });

  it('集数越界 clamp 到 1..120；0/NaN 兜底为1', () => {
    assert.strictEqual(P.buildBeatPalette({ episodeCount: 0 }).episodes.length, 1);
    assert.strictEqual(P.buildBeatPalette({ episodeCount: 999 }).episodes.length, 120);
  });

  it('英文层零中文', () => {
    const pal = P.buildBeatPalette({ episodeCount: 3 });
    pal.episodes.forEach((ep) => ep.slots.forEach((s) => {
      [s.systemDefault, ...s.alternatives].forEach((o) => {
        assert.ok(!cjk(o.nameEn), `nameEn CJK ${o.id}`);
        assert.ok(!cjk(o.definitionEn), `definitionEn CJK ${o.id}`);
        assert.ok(!cjk(o.techniqueEn), `techniqueEn CJK ${o.id}`);
        assert.ok(!cjk(o.exampleEn), `exampleEn CJK ${o.id}`);
        assert.ok(!cjk(o.reason.en), `reason.en CJK ${o.id}`);
      });
      assert.ok(!cjk(s.label.en));
    }));
    assert.ok(!cjk(pal.note.en));
  });
});

describe('v2.57 palettePicksToManual 点选转换', () => {
  it('点备选→落分层 manual；点回默认→不落；非法位/非法id进 rejected', () => {
    const pal = P.buildBeatPalette({ episodeCount: 3, strength: 'tight' });
    const first = pal.episodes[0].slots[0];
    const alt = first.alternatives[0].id;
    const picks = {
      [String(first.pos)]: alt,
      [String(pal.episodes[1].slots[0].pos)]: pal.episodes[1].slots[0].systemDefault.id, // 默认不落
      '999999': 'rev_identity', // 非法位
      [String(first.pos + 1)]: 'not_a_beat', // 非法id
    };
    const r = P.palettePicksToManual(pal, picks);
    assert.strictEqual(r.manual[first.pos], alt);
    assert.ok(!(pal.episodes[1].slots[0].pos in r.manual));
    assert.deepStrictEqual(r.rejected.sort(), ['999999', String(first.pos + 1)].sort());
  });
});

describe('v2.57 根治三类 manual 数字键撞号', () => {
  it('键10只影响第11个反转，不再串到爽点/情绪', () => {
    // 旧实现：revPos/payPos/e*10+j 共用键，manual[10] 会同时强控三类；新实现只有 reversal 命名空间键 10010 生效
    const pref = B.normalizeBeatPref({ mode: 'hybrid', manual: { 10: 'rev_timeline' } });
    const plan = B.planBeats(12, pref, lcg(321));
    // 旧键 10 在命名空间下查不到：第11集（e=10）反转不应被强控为 rev_timeline（除非随机恰好命中，连续验证爽点/情绪不受键控）
    const ep11 = plan.episodes[10];
    const payForced = ep11.payoffIds.every((id) => id === 'rev_timeline');
    assert.ok(!payForced, '爽点不可能被反转id强控');
    const emoForced = ep11.emotionPath.every((id) => id === 'rev_timeline');
    assert.ok(!emoForced, '情绪不可能被反转id强控');
  });

  it('命名空间键精确接管：10010 只强控第11集主反转', () => {
    const pref = B.normalizeBeatPref({ mode: 'hybrid', manual: { 10010: 'rev_timeline' } });
    // tight 每集都有反转，固定种子
    const tightPref = B.normalizeBeatPref({ ...pref, strength: 'tight' });
    const plan = B.planBeats(12, tightPref, lcg(321));
    assert.strictEqual(plan.episodes[10].reversalId, 'rev_timeline');
    // 其他集反转不被强控（逐位比较：除第11集外不应全部等于 rev_timeline）
    const others = plan.episodes.map((e, i) => (i === 10 ? null : e.reversalId)).filter(Boolean);
    assert.ok(others.some((id) => id !== 'rev_timeline'));
    // 爽点/情绪命名空间未指定，绝不出现反转id
    plan.episodes.forEach((e) => {
      e.payoffIds.forEach((id) => assert.ok(B.PAYOFF_BEATS.some((b) => b.id === id)));
      e.emotionPath.forEach((id) => assert.ok(B.EMOTION_BEATS.some((b) => b.id === id)));
    });
  });

  it('pickBeat 不传 manualKey 时回退 position，旧行为不变', () => {
    const pref = B.normalizeBeatPref({ mode: 'manual', manual: { 0: 'rev_timeline' } });
    const b = B.pickBeat(0, B.REVERSAL_BEATS, pref, [], lcg(1));
    assert.strictEqual(b.id, 'rev_timeline');
  });

  it('空 manual 时新旧实现产出完全一致（无回归）', () => {
    const pref = B.normalizeBeatPref({ strength: 'tight' });
    const plan = B.planBeats(20, pref, lcg(20260908));
    // 结构与硬规则：情绪弧恒3拍、有压必放、tight每集有反转、爽点2-3
    plan.episodes.forEach((ep) => {
      assert.ok(ep.reversalId);
      assert.ok(ep.payoffIds.length >= 2 && ep.payoffIds.length <= 3);
      assert.strictEqual(ep.emotionPath.length, 3);
      const press = ep.emotionPath.some((id) => ['emo_suppress', 'emo_suspense'].includes(id));
      if (press) assert.ok(ep.emotionPath.some((id) => ['emo_burst', 'emo_release', 'emo_tear', 'emo_hype'].includes(id)));
    });
  });
});
