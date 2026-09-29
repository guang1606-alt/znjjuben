const test = require('node:test');
const assert = require('node:assert');
const A = require('../dist/engine/apocalypse-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.22 末世装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(A.APOCALYPSE_DEVICES.length, 10);
  const ids = new Set();
  A.APOCALYPSE_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.22 detectApocalypse 中英识别末世/丧尸/废土；甜宠不误伤', () => {
  assert.ok(A.detectApocalypse('全球丧尸灾变后的末世求生'));
  assert.ok(A.detectApocalypse('废土幸存者避难所'));
  assert.ok(A.detectApocalypse('a zombie outbreak post-apocalyptic wasteland survival'));
  assert.ok(!A.detectApocalypse('都市甜宠撒糖'));
  assert.strictEqual(A.buildApocalypseDirective('校园青春暗恋', 'zh'), '');
});

test('v2.22 pickApocalypseDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = A.pickApocalypseDevices('避难所安全假象里的稀缺物资与道德两难', 3);
  const b = A.pickApocalypseDevices('避难所安全假象里的稀缺物资与道德两难', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'safe_illusion'));
  assert.ok(a.some((d) => d.id === 'scarcity_engine'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(A.pickApocalypseDevices('', 3).length, 3);
  const big = A.pickApocalypseDevices('末世', 20);
  assert.strictEqual(big.length, A.APOCALYPSE_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.22 指令含设定自洽/资源对账/不血腥/希望锚点底线，英文零中文', () => {
  const zh = A.buildApocalypseDirective('末世废土丧尸剧', 'zh');
  assert.ok(zh.includes('自洽') && zh.includes('对账') && zh.includes('血腥') && zh.includes('希望'));
  const en = A.buildApocalypseDirective('post-apocalyptic zombie wasteland', 'en');
  assert.ok(/self-consistent/i.test(en) && /non-graphic/i.test(en) && /hope anchor/i.test(en) && !cjk(en));
});

test('v2.22 注册表单点登记即全窗口生效；标签新增末世废土子类', () => {
  assert.ok(R.detectCraftStack('末世丧尸废土求生').includes('apocalypse'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['末世设定圣经', '稀缺资源驱动', '希望锚点牵引', '重生回末日前'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
