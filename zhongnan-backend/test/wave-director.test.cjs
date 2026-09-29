const { describe, it } = require('node:test');
const assert = require('node:assert');
const WD = require('../dist/engine/wave-director.js');
const B = require('../dist/engine/beat-system.js');
const EW = require('../dist/engine/emotion-wave.js');

const cjk = (o) => /[一-鿿]/.test(typeof o === 'string' ? o : JSON.stringify(o));
// 与 pipeline/emotion-wave 同款 mulberry32，用于直接对拍 planBeats
const lcgFactory = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('v2.58 波形意图模板自检', () => {
  it('五种意图全部合法：三拍互异、起承含压抑则合必释放', () => {
    assert.deepStrictEqual(WD.validateWaveIntents(), []);
    assert.strictEqual(WD.WAVE_INTENTS.length, 5);
    const valid = new Set(B.EMOTION_BEATS.map((b) => b.id));
    WD.WAVE_INTENTS.forEach((intent) => {
      const t = WD.WAVE_INTENT_TRIPLES[intent];
      t.forEach((id) => assert.ok(valid.has(id), `${intent} 含非法 id ${id}`));
      assert.strictEqual(new Set(t).size, 3, `${intent} 三拍必须互异`);
      if (B.SUPPRESSION_IDS.has(t[0]) || B.SUPPRESSION_IDS.has(t[1])) assert.ok(B.RELEASE_IDS.has(t[2]));
    });
  });

  it('英文元数据零中文', () => {
    WD.WAVE_INTENTS.forEach((id) => {
      const m = WD.waveIntentMeta(id, 'en');
      assert.ok(!cjk(m.name) && !cjk(m.desc) && !cjk(m.nameEn) && !cjk(m.descEn));
    });
    const r = WD.buildWaveDirector({ episodeCount: 6 }, 'en');
    assert.ok(!cjk(r.note.en));
  });
});

describe('v2.58 planWaveRange 区间连改', () => {
  it('只写 30000 情绪段键，公式 30000+e*3+j，区间外不写', () => {
    const p = WD.planWaveRange({ episodeCount: 20, from: 8, to: 10, intent: 'hype_climb' });
    assert.strictEqual(p.from, 8); assert.strictEqual(p.to, 10);
    assert.deepStrictEqual(p.affectedEps, [8, 9, 10]);
    assert.strictEqual(Object.keys(p.manual).length, 9);
    for (let e = 7; e <= 9; e++) for (let j = 0; j < 3; j++) {
      const key = 30000 + e * 3 + j;
      assert.strictEqual(p.manual[key], WD.WAVE_INTENT_TRIPLES.hype_climb[j]);
      assert.ok(key >= 30000 && key < 40000);
    }
  });

  it('首尾颠倒自动交换；缺省区间=全剧；clamp 到 1..n', () => {
    const swap = WD.planWaveRange({ episodeCount: 10, from: 8, to: 3, intent: 'tender_heal' });
    assert.strictEqual(swap.from, 3); assert.strictEqual(swap.to, 8);
    const all = WD.planWaveRange({ episodeCount: 5, intent: 'press_release' });
    assert.strictEqual(all.from, 1); assert.strictEqual(all.to, 5); assert.strictEqual(all.affectedEps.length, 5);
    const over = WD.planWaveRange({ episodeCount: 4, from: 1, to: 99, intent: 'hype_climb' });
    assert.strictEqual(over.to, 4);
  });

  it('overwritten 只统计被覆盖的既有情绪键', () => {
    const existing = { [30000 + 5 * 3]: 'emo_warmth', [10007]: 'rev_cause' }; // 第6集情绪键+反转键，均在区间外
    const p = WD.planWaveRange({ episodeCount: 20, from: 8, to: 9, intent: 'hype_climb', existingManual: existing });
    assert.strictEqual(p.overwritten, 0); // 既有键不在区间
    const p2 = WD.planWaveRange({ episodeCount: 20, from: 8, to: 9, intent: 'hype_climb', existingManual: { [30000 + 7 * 3]: 'emo_heal' } });
    assert.strictEqual(p2.overwritten, 1);
  });

  it('非法意图直接抛错', () => {
    assert.throws(() => WD.planWaveRange({ episodeCount: 5, intent: 'not_exist' }));
  });
});

describe('v2.58 buildWaveDirector 预览与同源', () => {
  it('确定性：同输入同输出', () => {
    const a = WD.buildWaveDirector({ episodeCount: 12, intent: 'tear_angst', from: 4, to: 6 });
    const b = WD.buildWaveDirector({ episodeCount: 12, intent: 'tear_angst', from: 4, to: 6 });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  });

  it('无意图时只给 before、patch/waveAfter 为 null', () => {
    const r = WD.buildWaveDirector({ episodeCount: 10 });
    assert.ok(r.waveBefore); assert.strictEqual(r.waveAfter, null); assert.strictEqual(r.patch, null);
    assert.strictEqual(r.intents.length, 5);
  });

  it('before 曲线与 buildEmotionWave 同源一致', () => {
    const r = WD.buildWaveDirector({ episodeCount: 15, strength: 'tight' });
    const ref = EW.buildEmotionWave(15, B.normalizeBeatPref({ strength: 'tight' }));
    assert.deepStrictEqual(r.waveBefore.points.map((p) => p.intensity), ref.points.map((p) => p.intensity));
  });

  it('连改只移动区间内集，区间外逐集零涟漪（全部意图×三档强度）', () => {
    for (const strength of ['relax', 'balanced', 'tight']) {
      for (const intent of WD.WAVE_INTENTS) {
        const r = WD.buildWaveDirector({ episodeCount: 30, strength, intent, from: 10, to: 14 });
        const b = r.waveBefore.points.map((p) => p.intensity);
        const a = r.waveAfter.points.map((p) => p.intensity);
        b.forEach((v, i) => { if (i + 1 < 10 || i + 1 > 14) assert.strictEqual(a[i], v, `${strength}/${intent} 涟漪到第${i + 1}集`); });
      }
    }
  });

  it('连改后管线 planBeats 在区间每集精确落模板三拍（含释放分支合拍被尊重）', () => {
    for (const intent of WD.WAVE_INTENTS) {
      const r = WD.buildWaveDirector({ episodeCount: 24, intent, from: 10, to: 14 });
      const pref = B.normalizeBeatPref({ mode: 'hybrid', strength: 'balanced', manual: r.patch.manual });
      for (const ep1 of r.patch.affectedEps) {
        const e = ep1 - 1;
        const plan = B.planBeats(24, pref, lcgFactory(0x5bd1e995 ^ (e * 40503))).episodes[e];
        assert.deepStrictEqual(plan.emotionPath, WD.WAVE_INTENT_TRIPLES[intent], `${intent} 第${ep1}集未精确落模板`);
        // 有压必放硬规则
        const press = plan.emotionPath.some((x) => B.SUPPRESSION_IDS.has(x));
        const release = plan.emotionPath.some((x) => B.RELEASE_IDS.has(x));
        assert.ok(!press || release);
      }
    }
  });

  it('既有 pins 自动转 hybrid 并体现在 before 曲线', () => {
    const pins = { [30000 + 4 * 3]: 'emo_suppress', [30000 + 4 * 3 + 1]: 'emo_tear', [30000 + 4 * 3 + 2]: 'emo_release' };
    const r = WD.buildWaveDirector({ episodeCount: 10, pref: { manual: pins } });
    const ref = EW.buildEmotionWave(10, B.normalizeBeatPref({}));
    assert.notDeepStrictEqual(r.waveBefore.points.map((p) => p.intensity), ref.points.map((p) => p.intensity));
  });

  it('集数 clamp 1-120', () => {
    assert.strictEqual(WD.buildWaveDirector({ episodeCount: 0 }).episodeCount, 1);
    assert.strictEqual(WD.buildWaveDirector({ episodeCount: 999 }).episodeCount, 120);
  });
});
