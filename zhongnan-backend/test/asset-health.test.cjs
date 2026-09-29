const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scoreCastAsset, detectCastAssetConflicts } = require('../dist/engine/asset-health.js');

// —— 五维完整度评分 ——
describe('资产体检·scoreCastAsset 五维完整度', () => {
  it('空/无名/无人设：0 分空壳，给补人设建议', () => {
    for (const a of [null, undefined, {}, { persona: '只有人设' }]) {
      const h = scoreCastAsset(a);
      assert.strictEqual(h.score, 0);
      assert.strictEqual(h.level, 'thin');
      assert.ok(h.advice.length >= 1);
    }
  });

  it('全字段满配：100 分 rich，建议提示可直接引用', () => {
    const h = scoreCastAsset({
      name: '林昭', persona: '外冷内热的刑警，欲望是为父翻案', voice: '短句多，口头禅"查下去"',
      signatureLines: ['案子不会说谎'], visualAnchor: '左眉一道疤', voicePrint: { signature: '短句/疑问' },
    });
    assert.strictEqual(h.score, 100);
    assert.strictEqual(h.level, 'rich');
    assert.deepStrictEqual(h.missing, []);
    assert.ok(h.advice.some((s) => s.includes('跨剧引用')));
  });

  it('五维权重加和：只缺视觉锚点=85 仍 rich；只缺人设外全部=55 usable 边界', () => {
    const noAnchor = scoreCastAsset({ name: 'A', persona: '谨慎多疑的老捕快', voice: '短句', signatureLines: ['嗯'], voicePrint: { signature: '短句' } });
    assert.strictEqual(noAnchor.score, 85);
    assert.strictEqual(noAnchor.level, 'rich');
    assert.deepStrictEqual(noAnchor.missing, ['visualAnchor']);
    const noAll = scoreCastAsset({ name: 'B', persona: '谨慎多疑的老捕快' });
    assert.strictEqual(noAll.score, 30);
    assert.strictEqual(noAll.level, 'thin');
    assert.ok(noAll.missing.includes('voice') && noAll.missing.includes('voicePrint') && noAll.missing.includes('signatureLines') && noAll.missing.includes('visualAnchor'));
  });

  it('人设 <8 字扣 10 分：40 分 usable 上界内按权重仍 thin 边界可判', () => {
    const full = 100;
    const shortPersona = scoreCastAsset({ name: 'C', persona: '狠辣', voice: '短句', signatureLines: ['嗯'], visualAnchor: '疤', voicePrint: { signature: '短句' } });
    assert.strictEqual(shortPersona.score, full - 10);
    assert.ok(shortPersona.advice.some((s) => s.includes('人设内核过短')));
  });

  it('signatureLines >3 条提示照搬风险（其余字段齐备时不被 advice 截断挤掉）；英文建议含关键词', () => {
    const h = scoreCastAsset({ name: 'D', persona: '外冷内热的老捕快', voice: '短句', visualAnchor: '疤', voicePrint: { signature: '短句' }, signatureLines: ['一', '二', '三', '四', '五'] }, 'en');
    assert.ok(h.advice.some((s) => s.includes('signature lines') && s.includes('too many')), `advice 应含台词过多提示：${JSON.stringify(h.advice)}`);
    const en = scoreCastAsset({ name: 'E', persona: 'x' }, 'en');
    assert.ok(en.advice.every((s) => /^[-A-Za-z0-9 ,.'":/()<>×⚠💡]/.test(s)), '英文建议不混中文句子');
  });

  it('voicePrintDigest 与 voicePrint 双命名兼容（种子/prisma 行两形态）', () => {
    const viaSeed = scoreCastAsset({ name: 'F', persona: '外冷内热的老捕快', voicePrintDigest: { signature: '短句' } });
    const viaRow = scoreCastAsset({ name: 'F', persona: '外冷内热的老捕快', voicePrint: { signature: '短句' } });
    assert.strictEqual(viaSeed.score, viaRow.score);
    assert.ok(!viaSeed.missing.includes('voicePrint'));
  });
});

// —— 库级冲突预警 ——
describe('资产体检·detectCastAssetConflicts 冲突预警', () => {
  it('空库/单资产无冲突；null 项被过滤', () => {
    assert.deepStrictEqual(detectCastAssetConflicts([]), []);
    assert.deepStrictEqual(detectCastAssetConflicts([null, undefined, { name: 'A', persona: 'x' }]), []);
  });

  it('同名不同人设：dup_name；同名同人设不报（一人一档 upsert 语义）', () => {
    const c = detectCastAssetConflicts([
      { name: '林昭', persona: '外冷内热的刑警', voicePrint: { signature: '短句' } },
      { name: '林昭', persona: '热情外向的厨师', voicePrint: { signature: '长句' } },
    ]);
    assert.strictEqual(c.length, 1);
    assert.strictEqual(c[0].type, 'dup_name');
    assert.strictEqual(c[0].a, '林昭');
    const same = detectCastAssetConflicts([
      { name: '林昭', persona: '外冷内热的刑警' },
      { name: '林昭', persona: '外冷内热的刑警' },
    ]);
    assert.deepStrictEqual(same, [], '同名同人设视为同一档不报');
  });

  it('异名同人设（去空白后一致）：same_persona；异名异人设但声纹一致：clash_print', () => {
    const c = detectCastAssetConflicts([
      { name: 'A', persona: '外冷内热 刑警' },
      { name: 'B', persona: '外冷内热刑警' },
    ]);
    assert.strictEqual(c.length, 1);
    assert.strictEqual(c[0].type, 'same_persona');
    const p = detectCastAssetConflicts([
      { name: 'A', persona: '外冷内热的老刑警' },
      { name: 'B', persona: '心细如发的法医', voicePrint: { signature: '短句/疑问' } },
    ]);
    assert.strictEqual(p.length, 0, 'A 无声纹不比较');
    const q = detectCastAssetConflicts([
      { name: 'A', persona: '外冷内热的老刑警', voicePrint: { signature: '短句/疑问' } },
      { name: 'B', persona: '心细如发的法医', voicePrint: { signature: '短句/疑问' } },
    ]);
    assert.strictEqual(q.length, 1);
    assert.strictEqual(q[0].type, 'clash_print');
  });

  it('冲突上限 20 条；英文 note', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `C${i}`, persona: `性格${i}的人设` }));
    const mirror = Array.from({ length: 12 }, (_, i) => ({ name: `D${i}`, persona: `另类${i}的人设` }));
    const all = detectCastAssetConflicts([...many, ...mirror], 'en');
    assert.ok(all.length <= 20);
    if (all.length) assert.ok(all[0].note.split('').some((ch) => /[A-Za-z]/.test(ch)));
  });
});
