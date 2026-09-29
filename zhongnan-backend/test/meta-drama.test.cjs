const test = require('node:test');
const assert = require('node:assert');
const G = require('../dist/engine/genre-compensate.js');
const R = require('../dist/engine/flavor-recommender.js');
const T = require('../dist/config/tag-taxonomy.js');
const O = require('../dist/config/overseas-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.05 戏中戏/元叙事：中文诉求可匹配到 metaDrama 方法论', () => {
  const m = G.matchGenreByPain('戏中戏结构，排练时的争吵其实是真实裂痕，剧本照进现实', 3, 'zh');
  assert.ok(m.some((g) => g.id === 'metaDrama'));
  const meta = G.GENRE_COMPENSATION.find((g) => g.id === 'metaDrama');
  ['realityPain', 'compensation', 'coreTechnique', 'shortDramaFit', 'avoid'].forEach((k) => assert.ok(meta[k] && meta[k].length > 10));
});

test('v2.05 metafiction English pain text matches metaDrama and EN layer has zero CJK', () => {
  const m = G.matchGenreByPain('a story within a story, rehearsal mirrors the truth, the script comes true', 3, 'en');
  assert.ok(m.some((g) => g.id === 'metaDrama'));
  const e = G.GENRE_EN.metaDrama;
  assert.ok(e);
  Object.values(e).forEach((v) => { if (typeof v === 'string') assert.ok(!cjk(v), '英文层不得含中文'); });
});

test('v2.05 题材方法论中英对齐：每个中文流派都有英文层且英文层零中文', () => {
  G.GENRE_COMPENSATION.forEach((g) => {
    const e = G.GENRE_EN[g.id];
    assert.ok(e, `${g.id} 缺英文层`);
    ['name', 'pain', 'comp', 'tech', 'fit', 'avoid'].forEach((k) => assert.ok(e[k] && !cjk(e[k]), `${g.id}.${k} 英文不合法`));
  });
});

test('v2.05 戏中戏细分标签已入树，且海外英文标签可回写', () => {
  ['戏中戏元叙事', '剧中剧反转', '嵌套套层叙事', '剧本照进现实', '片场真假双线', '排练与真相互文', '观众即角色'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const expectZh = ['戏中戏元叙事', '剧中剧反转', '嵌套套层叙事', '剧本照进现实', '片场真假双线', '排练与真相互文', '观众即角色'];
  const meta = O.OVERSEAS_TAGS.filter((t) => t.slot === 'structure' && expectZh.includes(t.zh));
  assert.strictEqual(meta.length, expectZh.length, '海外元叙事结构标签应逐个补齐');
  meta.forEach((t) => assert.ok(!cjk(t.en) && T.findTagByName(t.mapsToZh), `海外标签 ${t.en} 回写失败`));
});

test('v2.05 风味推荐：戏中戏 → 认知/真相反转 + 信息差伏笔微钩 + 揪心悬念', () => {
  const zh = R.recommendFlavorProfile({ tags: ['戏中戏元叙事', '剧中剧反转'] });
  assert.ok(zh.matched.includes('meta'));
  assert.ok(zh.reversalFlavors.includes('cognition_overturn'));
  assert.ok(zh.microFlavors.some((x) => ['gap', 'foreshadow'].includes(x)));
  assert.ok(zh.emotionFlavors.includes('suspense_tug'));
  const en = R.recommendFlavorProfile({ tags: ['Story Within a Story (Metafiction)', 'nested narrative'], locale: 'en' });
  assert.ok(en.matched.includes('meta'));
  en.reasons.forEach((r) => assert.ok(!cjk(r.en)));
});
