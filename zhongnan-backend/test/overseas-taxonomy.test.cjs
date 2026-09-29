const test = require('node:test');
const assert = require('node:assert');
const O = require('../dist/config/overseas-taxonomy.js');

test('海外标签：英文名无重复、按海外热度降序、强势赛道在列、国内映射无悬空', () => {
  const ens = O.OVERSEAS_TAGS.map((t) => t.en);
  assert.strictEqual(new Set(ens).size, ens.length, '英文名重复');
  const ranked = O.overseasRank();
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].heat >= ranked[i].heat, '未按海外热度降序');
  ['Werewolf', 'Billionaire', 'Mafia'].forEach((k) =>
    assert.ok(O.OVERSEAS_TAGS.some((t) => t.en.includes(k)), `缺强势赛道 ${k}`));
  assert.deepStrictEqual(O.validateOverseasMapping(), [], '存在悬空的国内映射标签');
});

test('localizeCombo：普适映射 / 文化强绑定替换 / 无法映射保留并提示', () => {
  const r = O.localizeCombo(['复仇虐渣', '上门赘婿', '东北方言喜剧', '某自创标签']);
  const byZh = Object.fromEntries(r.items.map((i) => [i.zh, i]));
  assert.strictEqual(byZh['复仇'].en, 'Revenge');
  assert.ok(r.replaced.some((x) => x.from === '上门赘婿'), '赘婿应被文化替换');
  assert.ok(byZh['隐富丈夫'], '应出现替换后的海外等价标签');
  assert.strictEqual(byZh['某自创标签'].mapped, false);
  assert.ok(r.notes.length >= 2, '应给出文化改写提示');
});

test('reorderForLocale：中文原样；英文把高海外热度标签排前', () => {
  const zh = ['复仇', '某自创'];
  assert.deepStrictEqual(O.reorderForLocale(zh, 'zh'), zh);
  const en = O.reorderForLocale(['某自创', '复仇'], 'en');
  assert.strictEqual(en[0], '复仇');
});

test('smartOverseasCombo：核心/关系/主角三槽位必有、不重复、数量受控、确定性可复现', () => {
  const lcg = (seed) => { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };
  const c = O.smartOverseasCombo({ n: 6, rng: lcg(11) });
  assert.strictEqual(c.length, 6);
  assert.strictEqual(new Set(c.map((t) => t.en)).size, 6);
  ['core', 'relation', 'protagonist'].forEach((slot) =>
    assert.ok(c.some((t) => t.slot === slot), `缺槽位 ${slot}`));
  assert.deepStrictEqual(
    O.smartOverseasCombo({ n: 6, rng: lcg(11) }).map((t) => t.en),
    c.map((t) => t.en),
  );
});

test('overseasBrief：产出可喂架构岗的英文简报，文化替换带提示', () => {
  const b = O.overseasBrief(['复仇虐渣', '上门赘婿']);
  assert.ok(b.lines.some((l) => l.includes('Revenge')));
  assert.ok(b.lines.some((l) => l.includes('Hidden Billionaire Husband')));
  assert.ok(b.notes.some((n) => n.includes('赘婿')));
});
test('v1.96 海外对等：穿书转生/快穿/高概念、喜剧深挖、文旅、戏中戏元叙事齐全且映射真实中文叶', () => {
  const find = (kw) => O.OVERSEAS_TAGS.find((t) => t.en.includes(kw));
  // 穿书/转生/快穿/系统/时间循环/NPC/互换/平行世界/次元壁
  ['Isekai', 'Villainess', 'Cannon Fodder', 'White Moonlight', 'Quick Transmigration',
   'LitRPG', 'Time Loop', 'Self-Aware NPC', 'Body Swap', 'Parallel Worlds', 'Fourth Wall']
    .forEach((kw) => assert.ok(find(kw), `缺穿书/高概念对等标签 ${kw}`));
  // 喜剧机制深挖
  ['Slapstick', 'Fish-out-of-Water', 'Workplace Sitcom', 'Parody', 'Cringe', 'Bickering']
    .forEach((kw) => assert.ok(find(kw), `缺喜剧对等标签 ${kw}`));
  // 文旅
  ['Scenic City', 'Foodie Road', 'Heritage', 'Countryside']
    .forEach((kw) => assert.ok(find(kw), `缺文旅对等标签 ${kw}`));
  // 戏中戏/元叙事/特殊结构
  ['Metafiction', 'Show-Within-a-Show', 'Mockumentary', 'Time-Loop Repeat', 'Interactive Branching']
    .forEach((kw) => assert.ok(find(kw), `缺元叙事对等标签 ${kw}`));
  // 所有新增 mapsToZh 必须回指真实存在的国内叶（无悬空，validateOverseasMapping 已兜底，这里再显式断言一次）
  assert.deepStrictEqual(O.validateOverseasMapping(), []);
});
test('v1.96 多种子智能随机并集可覆盖新方向，且每次保证三槽位、不重复、数量受控', () => {
  const union = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    let s = seed;
    const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const c = O.smartOverseasCombo({ n: 12, rng });
    assert.strictEqual(new Set(c.map((t) => t.en)).size, c.length, '不重复');
    ['core', 'relation', 'protagonist'].forEach((slot) =>
      assert.ok(c.some((t) => t.slot === slot), `每次必保槽位 ${slot}`));
    c.forEach((t) => union.add(t.en));
  }
  ['Isekai: Transmigrated into a Novel', 'Story Within a Story (Metafiction)', 'Slapstick & Absurd Comedy', 'Scenic City Romance']
    .forEach((name) => assert.ok(union.has(name), `随机池应能覆盖 ${name}`));
});
test('v1.96 川渝方言喜剧与东北方言喜剧一样走文化转译，不直译方言梗', () => {
  const r = O.localizeCombo(['川渝方言喜剧']);
  assert.ok(r.replaced.some((x) => x.from === '川渝方言喜剧'), '川渝方言喜剧应文化替换');
  assert.strictEqual(r.items[0].en, 'Slapstick Local Comedy');
});
