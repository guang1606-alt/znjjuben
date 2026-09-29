const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/multi-version.js');

test('生成前：正交创作种子三维互不重复', () => {
  const seeds = M.pickDiverseSeeds(3);
  assert.strictEqual(seeds.length, 3);
  assert.strictEqual(new Set(seeds.map((s) => s.archetype)).size, 3);
  assert.strictEqual(new Set(seeds.map((s) => s.conflict)).size, 3);
  assert.strictEqual(new Set(seeds.map((s) => s.turn)).size, 3);
  assert.ok(seeds.every((s) => s.directive.includes('差异化定位')));
});

test('种子在库容量内严格正交（8版主角原型全不同）', () => {
  const seeds = M.pickDiverseSeeds(8);
  assert.strictEqual(new Set(seeds.map((s) => s.archetype)).size, 8);
});

test('生成后：高度雷同的两版被判伪多版本', () => {
  const r = M.diversityAudit([
    { id: 1, logline: '全职太太被丈夫抛弃后逆袭打脸夺回一切', archetype: '落魄原配', conflictTags: ['婚姻背叛', '尊严羞辱'], plotTags: ['逆袭', '打脸'] },
    { id: 2, logline: '全职太太遭丈夫背叛之后一路逆袭狠狠打脸', archetype: '落魄原配', conflictTags: ['婚姻背叛', '尊严羞辱'], plotTags: ['逆袭', '打脸', '复仇'] },
  ]);
  assert.strictEqual(r.pseudoVersion, true);
  assert.ok(r.issues.some((i) => i.severity === 'high'));
  assert.ok(r.score < 80);
});

test('生成后：真正不同的版本通过、无硬伤', () => {
  const r = M.diversityAudit([
    { id: 1, logline: '全职太太被丈夫抛弃后逆袭夺回公司', archetype: '落魄原配', conflictTags: ['婚姻背叛'], plotTags: ['逆袭', '商战'] },
    { id: 2, logline: '外卖小哥意外救下集团董事长继承百亿家业', archetype: '市井小人物', conflictTags: ['身份错位'], plotTags: ['认亲', '隐藏富豪'] },
    { id: 3, logline: '女法医凭一具旧案尸骨翻查十年前真凶', archetype: '天才少女', conflictTags: ['生死危机'], plotTags: ['查案', '反转'] },
  ]);
  assert.strictEqual(r.pairs, 3);
  assert.strictEqual(r.issues.some((i) => i.severity === 'high'), false);
  assert.strictEqual(r.score, 100);
});

test('梗概文本几乎照抄→文本相似维度抓出', () => {
  const r = M.diversityAudit([
    { id: 'A', logline: '一个普通女孩在大城市打拼最终收获事业与爱情的温暖故事', conflictTags: ['职场'], plotTags: ['成长'] },
    { id: 'B', logline: '一个普通女孩在大城市打拼最后收获事业与爱情的温暖故事呀', conflictTags: ['亲情'], plotTags: ['治愈'] },
  ]);
  assert.ok(r.issues.some((i) => i.dimension === 'logline' && i.severity === 'high'));
});

test('v1.89 lang=en：正交种子与体检建议输出英文；默认中文不变', () => {
  const seeds = M.pickDiverseSeeds(2, 'en');
  assert.ok(/[A-Za-z]/.test(seeds[0].archetype));
  assert.ok(!/[一-龥]/.test(JSON.stringify(seeds)));
  const rep = M.diversityAudit([
    { id: 1, logline: 'a betrayed wife returns as a hidden tycoon to reclaim everything', archetype: 'X', conflictTags: ['betrayal'], plotTags: ['revenge'] },
    { id: 2, logline: 'a betrayed spouse comes back as a secret magnate for payback', archetype: 'X', conflictTags: ['betrayal'], plotTags: ['revenge'] },
  ], 'en');
  assert.ok(rep.issues.length > 0);
  assert.ok(!/[一-龥]/.test(JSON.stringify(rep.issues)));
  const zh = M.pickDiverseSeeds(1);
  assert.strictEqual(zh[0].archetype, '落魄原配');
});
