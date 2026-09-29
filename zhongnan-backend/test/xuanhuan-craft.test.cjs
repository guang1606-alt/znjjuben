const test = require('node:test');
const assert = require('node:assert');
const X = require('../dist/engine/xuanhuan-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.17 玄幻升级装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(X.XUAN_DEVICES.length, 10);
  const ids = new Set();
  X.XUAN_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.17 detectXuan 中英识别修仙/异世界；都市职场不注入', () => {
  assert.ok(X.detectXuan('男频修仙筑基金丹渡劫飞升'));
  assert.ok(X.detectXuan('a xianxia cultivation progression fantasy with a sect'));
  assert.ok(X.detectXuan('isekai power fantasy leveling'));
  assert.ok(!X.detectXuan('都市职场恋爱'));
  assert.strictEqual(X.buildXuanDirective('家庭婆媳', 'zh'), '');
});

test('v2.17 pickXuanDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = X.pickXuanDevices('境界突破天劫心魔，打脸扮猪吃虎', 3);
  const b = X.pickXuanDevices('境界突破天劫心魔，打脸扮猪吃虎', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'breakthrough_cost'));
  assert.ok(a.some((d) => d.id === 'face_slap_cadence'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(X.pickXuanDevices('', 3).length, 3);
  const big = X.pickXuanDevices('修仙', 20);
  assert.strictEqual(big.length, X.XUAN_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.17 指令含“战力不崩坏/金手指有代价/道心责任/控数值通胀”底线，英文零中文', () => {
  const zh = X.buildXuanDirective('玄幻修仙升级', 'zh');
  assert.ok(zh.includes('吃书') && zh.includes('代价') && zh.includes('道心') && zh.includes('通胀'));
  const en = X.buildXuanDirective('xianxia cultivation power fantasy', 'en');
  assert.ok(/consistent/i.test(en) && /dao-heart/i.test(en) && /numerical inflation/i.test(en) && !cjk(en));
});

test('v2.17 玄幻机制标签已入树且全局无重名', () => {
  ['境界阶梯对照', '突破代价与瓶颈', '金手指规则限制', '战力标尺一致', '机缘多方争夺', '宗门势力生态', '打脸铺垫节奏', '道心心性考验', '设定自洽圣经', '升级爽点兑付'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
