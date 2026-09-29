const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/engine/sisterhood-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.26 女性群像装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(S.SISTERHOOD_DEVICES.length, 10);
  const ids = new Set();
  S.SISTERHOOD_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.26 detectSisterhood 中英识别女性群像；男频不误伤', () => {
  assert.ok(S.detectSisterhood('女性群像剧，姐妹互助创业'));
  assert.ok(S.detectSisterhood('girls help girls 女性友谊'));
  assert.ok(S.detectSisterhood('a women ensemble sisterhood story'));
  assert.ok(!S.detectSisterhood('男频玄幻升级打怪'));
  assert.strictEqual(S.buildSisterhoodDirective('军旅特战', 'zh'), '');
});

test('v2.26 pickSisterhoodDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = S.pickSisterhoodDevices('女性群像互助、姐妹结盟与女性友谊', 3);
  const b = S.pickSisterhoodDevices('女性群像互助、姐妹结盟与女性友谊', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'ensemble_balance'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(S.pickSisterhoodDevices('', 3).length, 3);
  const big = S.pickSisterhoodDevices('女性群像', 20);
  assert.strictEqual(big.length, S.SISTERHOOD_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.26 指令含群像/拒绝雌竞/合法求助/不踩男捧女底线，英文零中文', () => {
  const zh = S.buildSisterhoodDirective('女性群像互助剧', 'zh');
  assert.ok(zh.includes('弧') && zh.includes('雌竞') && zh.includes('合法求助') && zh.includes('踩男性'));
  const en = S.buildSisterhoodDirective('women ensemble sisterhood drama', 'en');
  assert.ok(/ensemble/i.test(en) && /zero-sum/i.test(en) && !cjk(en));
});

test('v2.26 注册表登记即生效；标签新增女性群像子类', () => {
  assert.ok(R.detectCraftStack('女性群像姐妹互助').includes('sisterhood'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['群像戏份均衡', '互助分台阶', '拒绝零和雌竞', '她力量成长'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
