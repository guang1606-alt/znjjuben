const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/engine/spy-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.21 谍战装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(S.SPY_DEVICES.length, 10);
  const ids = new Set();
  S.SPY_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.21 detectSpy 中英识别潜伏/卧底/接头；甜宠不误伤', () => {
  assert.ok(S.detectSpy('民国潜伏在军统的地下党'));
  assert.ok(S.detectSpy('卧底特务接头暗号情报站'));
  assert.ok(S.detectSpy('an undercover mole in a wartime spy ring'));
  assert.ok(!S.detectSpy('都市甜宠撒糖恋爱'));
  assert.strictEqual(S.buildSpyDirective('校园青春暗恋', 'zh'), '');
});

test('v2.21 pickSpyDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = S.pickSpyDevices('审讯博弈与内鬼疑云、阵营反转', 3);
  const b = S.pickSpyDevices('审讯博弈与内鬼疑云、阵营反转', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'interrogation_chess'));
  assert.ok(a.some((d) => d.id === 'mole_paranoia'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(S.pickSpyDevices('', 3).length, 3);
  const big = S.pickSpyDevices('谍战', 20);
  assert.strictEqual(big.length, S.SPY_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.21 指令含历史立场/不降智/公平伏笔底线，英文零中文', () => {
  const zh = S.buildSpyDirective('民国谍战潜伏剧', 'zh');
  assert.ok(zh.includes('降智') && zh.includes('历史') && zh.includes('伏笔') && zh.includes('信仰'));
  const en = S.buildSpyDirective('period espionage undercover thriller', 'en');
  assert.ok(/history/i.test(en) && /fair-play/i.test(en) && /cover/i.test(en) && !cjk(en));
});

test('v2.21 注册表单点登记即全窗口生效；标签新增谍战潜伏子类', () => {
  assert.ok(R.detectCraftStack('民国谍战潜伏').includes('spy'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['身份面具双层', '审讯双向博弈', '情报伏笔回收', '电报密码战'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 837);
});
