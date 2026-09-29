const { describe, it } = require('node:test');
const assert = require('node:assert');
const B = require('../dist/engine/beat-system.js');

// 固定 rng，保证可复现
let seed = 12345;
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

describe('节拍工程：类型库完整', () => {
  it('反转8/爽点10/情绪8，字段齐全', () => {
    assert.strictEqual(B.REVERSAL_BEATS.length, 8);
    assert.strictEqual(B.PAYOFF_BEATS.length, 10);
    assert.strictEqual(B.EMOTION_BEATS.length, 8);
    for (const b of [...B.REVERSAL_BEATS, ...B.PAYOFF_BEATS, ...B.EMOTION_BEATS]) {
      assert.ok(b.id && b.name && b.definition && b.technique && b.example, '字段齐全');
    }
  });
});

describe('normalizeBeatPref 清洗', () => {
  it('空输入回退 auto/balanced', () => {
    const p = B.normalizeBeatPref(null);
    assert.strictEqual(p.mode, 'auto'); assert.strictEqual(p.strength, 'balanced');
    assert.deepStrictEqual(p.preferred, []); assert.deepStrictEqual(p.avoid, []);
  });
  it('非法枚举/未知id剔除，manual键转数字', () => {
    const p = B.normalizeBeatPref({ mode: 'xxx', strength: 'tight', preferred: ['pay_faceslap', 'not_exist'], avoid: ['rev_identity'], manual: { '2': 'emo_tear', 'bad': 'x' } });
    assert.strictEqual(p.mode, 'auto');
    assert.strictEqual(p.strength, 'tight');
    assert.deepStrictEqual(p.preferred, ['pay_faceslap']);
    assert.deepStrictEqual(p.avoid, ['rev_identity']);
    assert.deepStrictEqual(p.manual, { 2: 'emo_tear' });
  });
});

describe('planBeats 强度密度与情绪弧', () => {
  it('tight 每集有反转、爽点2-3；relax 反转稀疏、爽点0-1', () => {
    const tight = B.planBeats(9, B.normalizeBeatPref({ strength: 'tight' }), rng);
    assert.strictEqual(tight.episodes.length, 9);
    assert.ok(tight.episodes.every((e) => !!e.reversalId), 'tight每集有反转');
    assert.ok(tight.episodes.every((e) => e.payoffIds.length >= 2 && e.payoffIds.length <= 3));
    const relax = B.planBeats(9, B.normalizeBeatPref({ strength: 'relax' }), rng);
    const revCount = relax.episodes.filter((e) => e.reversalId).length;
    assert.ok(revCount <= 4 && revCount >= 2, `relax反转稀疏(${revCount})`);
    assert.ok(relax.episodes.every((e) => e.payoffIds.length <= 1));
  });
  it('情绪弧3拍、首尾不同型、有压必有放', () => {
    const plan = B.planBeats(12, B.normalizeBeatPref({ strength: 'balanced' }), rng);
    const press = new Set(['emo_suppress', 'emo_suspense']);
    const release = new Set(['emo_burst', 'emo_release', 'emo_tear', 'emo_hype']);
    for (const ep of plan.episodes) {
      assert.strictEqual(ep.emotionPath.length, 3);
      assert.notStrictEqual(ep.emotionPath[0], ep.emotionPath[2], '首尾不同型');
      if (ep.emotionPath.some((x) => press.has(x))) assert.ok(ep.emotionPath.some((x) => release.has(x)), '有压必有放');
    }
  });
});

describe('pickBeat 偏好/禁用/指定/兜底', () => {
  it('preferred 优先、avoid 不出现', () => {
    const pref = B.normalizeBeatPref({ mode: 'auto', preferred: ['pay_sweet'], avoid: B.PAYOFF_BEATS.map((b) => b.id).filter((id) => id !== 'pay_sweet') });
    for (let i = 0; i < 10; i++) {
      const b = B.pickBeat(i, B.PAYOFF_BEATS, pref, [], rng);
      assert.strictEqual(b.id, 'pay_sweet');
    }
  });
  it('整层全 avoid 时兜底不返回 undefined', () => {
    const pref = B.normalizeBeatPref({ avoid: B.PAYOFF_BEATS.map((b) => b.id) });
    const b = B.pickBeat(0, B.PAYOFF_BEATS, pref, [], rng);
    assert.ok(b && b.id);
  });
  it('manual 指定位置生效', () => {
    const pref = B.normalizeBeatPref({ mode: 'manual', manual: { 0: 'rev_timeline' } });
    const b = B.pickBeat(0, B.REVERSAL_BEATS, pref, [], rng);
    assert.strictEqual(b.id, 'rev_timeline');
  });
});

describe('auditBeats 审计', () => {
  it('只压不放判 error；同型相邻反转 warning', () => {
    const bad = {
      strength: 'balanced', mode: 'auto',
      episodes: [
        { episode: 1, reversalId: 'rev_identity', payoffIds: ['pay_faceslap'], emotionPath: ['emo_suppress', 'emo_suspense', 'emo_warmth'] },
        { episode: 2, reversalId: 'rev_identity', payoffIds: ['pay_karma'], emotionPath: ['emo_burst', 'emo_release', 'emo_heal'] },
      ],
    };
    const issues = B.auditBeats(bad);
    assert.ok(issues.some((i) => i.level === 'error' && i.msg.includes('只压抑不释放')));
    assert.ok(issues.some((i) => i.level === 'warning' && i.msg.includes('相邻反转同型')));
  });
});

describe('buildBeatDirective 指令文本', () => {
  it('含反转/爽点/情绪曲线且禁止机械打卡', () => {
    const plan = B.planBeats(3, B.normalizeBeatPref({ strength: 'tight' }), rng);
    const txt = B.buildBeatDirective(plan.episodes[0]);
    assert.ok(txt.includes('情绪曲线'));
    assert.ok(txt.includes('爽点'));
    assert.ok(txt.includes('禁止'));
  });
});

// ============ v1.95 节拍体系双语回归 ============
const cjk = (o) => /[一-鿿]/.test(typeof o === 'string' ? o : JSON.stringify(o));
describe('v1.95 节拍英文层', () => {
  const all = [...B.BEAT_LIBRARY.reversal, ...B.BEAT_LIBRARY.payoff, ...B.BEAT_LIBRARY.emotion];
  it('26个节拍英文层全覆盖、零中文', () => {
    assert.strictEqual(all.length, 26);
    all.forEach((b) => {
      const e = B.localizeBeat(b, 'en');
      assert.ok(!cjk(e.name) && !cjk(e.definition) && !cjk(e.technique) && !cjk(e.example), `CJK ${b.id}`);
      assert.ok(!e.bestFor.some(cjk), `bestFor CJK ${b.id}`);
    });
  });
  it('buildBeatDirective/auditBeats 英文零中文，中文默认不变', () => {
    const plan = B.planBeats(3, B.normalizeBeatPref({ strength: 'tight' }), rng);
    const en = B.buildBeatDirective(plan.episodes[0], 'en');
    assert.ok(!cjk(en)); assert.ok(/emotional curve/i.test(en));
    const zh = B.buildBeatDirective(plan.episodes[0]);
    assert.ok(cjk(zh));
    const bad = { strength: 'tight', mode: 'auto', episodes: [{ episode: 1, reversalId: 'rev_identity', payoffIds: [], emotionPath: ['emo_suppress', 'emo_suppress', 'emo_suppress'] }] };
    const issEn = B.auditBeats(bad, 'en');
    assert.ok(issEn.length > 0 && !cjk(issEn));
  });
});

describe('v2.02 爽点风味轴', () => {
  it('10型爽点不重不漏归入5风味', () => {
    const seen = new Set();
    B.PAYOFF_BEATS.forEach((b) => { const f = B.payoffFlavorOf(b.id); assert.ok(f, `${b.id} 必须归属风味`); seen.add(f); });
    assert.strictEqual(B.PAYOFF_BEATS.length, 10);
    assert.deepStrictEqual([...seen].sort(), [...B.PAYOFF_FLAVORS].sort());
  });
  it('风味软加权：选打脸现报后占比显著升高但不霸占，反转/情绪不受影响', () => {
    const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
    const stat = (pref) => {
      const plan = B.planBeats(40, { ...{ mode: 'auto', strength: 'tight', preferred: [], avoid: [], manual: {} }, ...pref }, lcg(777));
      let pay = 0, fs = 0;
      plan.episodes.forEach((ep) => ep.payoffIds.forEach((id) => { pay += 1; if (B.payoffFlavorOf(id) === 'face_slap') fs += 1; }));
      return { pay, fs };
    };
    const base = stat({});
    const fav = stat({ payoffFlavors: ['face_slap'] });
    assert.ok(base.pay > 50 && fav.pay > 50, '样本量足够');
    assert.ok(fav.fs / fav.pay > 0.5, `打脸风味占比应过半，实得 ${fav.fs}/${fav.pay}`);
    assert.ok(base.fs / base.pay < 0.35, '无偏好时打脸系约五分之二以下');
    assert.ok(fav.fs < fav.pay, '软偏好不霸占全部');
  });
  it('风味组被禁用时安全回退；多风味取并集', () => {
    const base = { mode: 'auto', strength: 'tight', preferred: [], avoid: [], manual: {} };
    const r1 = B.pickBeat(0, B.PAYOFF_BEATS, { ...base, payoffFlavors: ['face_slap'], avoid: ['pay_faceslap', 'pay_karma'] }, [], () => 0.5);
    assert.ok(r1 && B.payoffFlavorOf(r1.id) !== 'face_slap');
    const r2 = B.pickBeat(1, B.PAYOFF_BEATS, { ...base, payoffFlavors: ['truth_justice', 'sweet_warm'] }, [], () => 0.01);
    assert.ok(['truth_justice', 'sweet_warm'].includes(B.payoffFlavorOf(r2.id)));
  });
  it('风味名双语；指令带风味段且英文零中文；normalize 清洗非法值', () => {
    assert.strictEqual(B.payoffFlavorName('face_slap'), '打脸现报');
    assert.ok(/Face-slap/.test(B.payoffFlavorName('face_slap', 'en')));
    const ep = { episode: 1, payoffIds: ['pay_faceslap'], emotionPath: ['emo_suppress', 'emo_burst', 'emo_release'] };
    const en = B.buildBeatDirective(ep, 'en', { payoffFlavors: ['face_slap'] });
    assert.ok(!cjk(en) && /Creator-preferred payoff flavor/.test(en));
    const zh = B.buildBeatDirective(ep, 'zh', { payoffFlavors: ['face_slap'] });
    assert.ok(zh.includes('创作者偏好的爽点风味') && zh.includes('打脸现报'));
    const norm = B.normalizeBeatPref({ payoffFlavors: ['face_slap', 'bogus', 'sweet_warm'] });
    assert.deepStrictEqual(norm.payoffFlavors, ['face_slap', 'sweet_warm']);
  });
});

describe('v2.03 反转/情绪风味轴', () => {
  it('8型反转不重不漏归4风味、8型情绪不重不漏归5风味', () => {
    const rs = new Set(); B.REVERSAL_BEATS.forEach((b) => { const f = B.reversalFlavorOf(b.id); assert.ok(f); rs.add(f); });
    assert.strictEqual(B.REVERSAL_BEATS.length, 8);
    assert.deepStrictEqual([...rs].sort(), [...B.REVERSAL_FLAVORS].sort());
    const es = new Set(); B.EMOTION_BEATS.forEach((b) => { const f = B.emotionFlavorOf(b.id); assert.ok(f); es.add(f); });
    assert.strictEqual(B.EMOTION_BEATS.length, 8);
    assert.deepStrictEqual([...es].sort(), [...B.EMOTION_FLAVORS].sort());
  });
  it('反转风味软加权：选真相因果后占比明显升高但不霸占', () => {
    const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
    const stat = (pref) => { const plan = B.planBeats(60, { mode: 'auto', strength: 'tight', preferred: [], avoid: [], manual: {}, ...pref }, lcg(4242)); let t = 0, x = 0; plan.episodes.forEach((ep) => { if (ep.reversalId) { t++; if (B.reversalFlavorOf(ep.reversalId) === 'truth_cause') x++; } }); return { t, x }; };
    const base = stat({}), fav = stat({ reversalFlavors: ['truth_cause'] });
    assert.ok(base.t > 30 && fav.t > 30);
    assert.ok(fav.x / fav.t > 0.5, `真相因果反转占比应过半，实得 ${fav.x}/${fav.t}`);
    assert.ok(base.x / base.t < 0.5);
    assert.ok(fav.x < fav.t, '不霸占全部');
  });
  it('情绪风味软加权不破坏“有压必放”硬规则（审计无 error）', () => {
    const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
    const plan = B.planBeats(40, { mode: 'auto', strength: 'tight', preferred: [], avoid: [], manual: {}, emotionFlavors: ['tender_heal'] }, lcg(99));
    const issues = B.auditBeats(plan);
    assert.ok(!issues.some((i) => i.level === 'error'), '任何情绪风味偏好下都不得出现只压不放');
    // 温情治愈风味占比应高于无偏好（情绪三拍中更容易出现）
    let t = 0, h = 0; plan.episodes.forEach((ep) => ep.emotionPath.forEach((id) => { t++; if (B.emotionFlavorOf(id) === 'tender_heal') h++; }));
    assert.ok(h / t > 0.2, `温情治愈占比应抬升，实得 ${h}/${t}`);
  });
  it('三类风味互不串扰；指令三语段齐全且英文零中文；normalize 清洗', () => {
    const base = { mode: 'auto', strength: 'balanced', preferred: [], avoid: [], manual: {} };
    // 反转风味只影响 reversal 候选，不影响 payoff
    const pay = B.pickBeat(0, B.PAYOFF_BEATS, { ...base, reversalFlavors: ['truth_cause'] }, [], () => 0.01);
    assert.ok(pay.kind === 'payoff');
    const ep = { episode: 1, reversalId: 'rev_timeline', payoffIds: ['pay_truth'], emotionPath: ['emo_suppress', 'emo_burst', 'emo_release'] };
    const en = B.buildBeatDirective(ep, 'en', { payoffFlavors: ['truth_justice'], reversalFlavors: ['truth_cause'], emotionFlavors: ['press_release'] });
    assert.ok(!cjk(en));
    assert.ok(/payoff flavor/.test(en) && /reversal flavor/.test(en) && /emotion flavor/.test(en));
    const zh = B.buildBeatDirective(ep, 'zh', { reversalFlavors: ['truth_cause'], emotionFlavors: ['press_release'] });
    assert.ok(zh.includes('反转风味') && zh.includes('情绪风味'));
    const norm = B.normalizeBeatPref({ reversalFlavors: ['truth_cause', 'nope'], emotionFlavors: ['hype_burn'] });
    assert.deepStrictEqual(norm.reversalFlavors, ['truth_cause']);
    assert.deepStrictEqual(norm.emotionFlavors, ['hype_burn']);
  });
});
