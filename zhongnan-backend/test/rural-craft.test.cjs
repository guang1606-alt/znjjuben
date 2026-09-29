const test = require('node:test');
const assert = require('node:assert');
const R0 = require('../dist/engine/rural-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.26 乡村装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(R0.RURAL_DEVICES.length, 10);
  const ids = new Set();
  R0.RURAL_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.26 detectRural 中英识别乡村乡土；都市职场不误伤', () => {
  assert.ok(R0.detectRural('回村种地带乡亲搞合作社致富'));
  assert.ok(R0.detectRural('村支书处理宅基地与征地的事'));
  assert.ok(R0.detectRural('a young woman returns to her rural farming village'));
  assert.ok(!R0.detectRural('都市职场商战'));
  assert.strictEqual(R0.buildRuralDirective('电竞战队', 'zh'), '');
});

test('v2.26 pickRuralDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = R0.pickRuralDevices('种地收成与宗族邻里人情、返乡', 3);
  const b = R0.pickRuralDevices('种地收成与宗族邻里人情、返乡', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'livelihood_engine'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(R0.pickRuralDevices('', 3).length, 3);
  const big = R0.pickRuralDevices('乡村', 20);
  assert.strictEqual(big.length, R0.RURAL_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.26 指令含不丑化/方言查证/生计账/不地域黑底线，英文零中文', () => {
  const zh = R0.buildRuralDirective('乡村乡土年代剧', 'zh');
  assert.ok(zh.includes('丑化') && zh.includes('方言') && zh.includes('生计') && zh.includes('地域黑'));
  const en = R0.buildRuralDirective('rural village hometown drama', 'en');
  assert.ok(/dialect/i.test(en) && /stereotype/i.test(en) && !cjk(en));
});

test('v2.26 注册表登记即生效；标签新增乡村乡土子类', () => {
  assert.ok(R.detectCraftStack('回村创业乡村振兴').includes('rural'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['生计账驱动', '熟人关系网', '根与归属', '乡村电商'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
