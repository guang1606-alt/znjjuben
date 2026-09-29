const { describe, it } = require('node:test');
const assert = require('node:assert');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机
const { buildHookMap, formatHookMapLines } = require('../dist/lib/hook-map.js');
const { normalizeCuePref } = require('../dist/agents/pipeline.js');

describe('v2.61 逐集钩子地图', () => {
  it('每集必有开场钩与集尾卡点、计数非负、风味合计自洽', () => {
    const m = buildHookMap(12, 4, normalizeCuePref());
    assert.strictEqual(m.episodes.length, 12);
    let microSum = 0; let sceneSum = 0;
    m.episodes.forEach((e) => {
      assert.ok(e.openId && e.endId && e.openZh && e.endZh && e.openEn && e.endEn);
      assert.ok(e.sceneHookCount >= 0 && e.microCount >= 0);
      const flavorSum = Object.values(e.flavorCounts).reduce((s, x) => s + x, 0);
      assert.strictEqual(flavorSum, e.microCount, '逐集风味计数之和=微钩总数');
      microSum += e.microCount; sceneSum += e.sceneHookCount;
    });
    const totalFlavor = Object.values(m.flavorTotals).reduce((s, x) => s + x, 0);
    assert.strictEqual(totalFlavor, microSum, '全剧风味合计=逐集之和');
    assert.ok(sceneSum > 0);
  });
  it('确定性：同参数两次结果逐字节一致', () => {
    const a = buildHookMap(8, 3, normalizeCuePref({ strength: 'tight' }));
    const b = buildHookMap(8, 3, normalizeCuePref({ strength: 'tight' }));
    assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
    assert.strictEqual(a.strength, 'tight');
  });
  it('不同集数种子不同：开场钩会自然轮换（非全剧一个钩）', () => {
    const m = buildHookMap(16, 4, normalizeCuePref());
    const opens = new Set(m.episodes.map((e) => e.openId));
    const ends = new Set(m.episodes.map((e) => e.endId));
    assert.ok(opens.size >= 2 && ends.size >= 2);
  });
  it('中文行齐全且英文行零中文', () => {
    const m = buildHookMap(6, 4, normalizeCuePref());
    const zh = formatHookMapLines(m, 'zh');
    const en = formatHookMapLines(m, 'en');
    assert.strictEqual(zh.length, 7); // 头 + 6 集
    assert.ok(zh[0].includes('钩子编排') && zh[1].includes('第1集'));
    assert.ok(en[0].includes('Hook map') && en[1].startsWith('E1:'));
    en.forEach((l) => assert.ok(!/[一-鿿]/.test(l), '英文层不得有中文'));
  });
  it('超长剧只列前10后4并给省略说明', () => {
    const m = buildHookMap(40, 4, normalizeCuePref());
    const lines = formatHookMapLines(m, 'zh');
    assert.strictEqual(lines.length, 1 + 10 + 1 + 4);
    assert.ok(lines.some((l) => l.includes('中段26集略')));
    assert.ok(lines[lines.length - 1].includes('第40集'));
  });
  it('场景数被夹到 1-8、集数夹到 1-300', () => {
    const m = buildHookMap(0, 99, normalizeCuePref());
    assert.strictEqual(m.episodeCount, 1);
    assert.ok(m.scenesPerEp >= 1 && m.scenesPerEp <= 8);
  });
});
