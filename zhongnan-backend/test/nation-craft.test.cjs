const test = require('node:test');
const assert = require('node:assert');
const N = require('../dist/engine/nation-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.30 国运秘境装置库：10套字段完整、id唯一、英文层零中文', () => {
  assert.strictEqual(N.NATION_DEVICES.length, 10);
  const ids = new Set();
  N.NATION_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.30 detectNation 中英识别国运/秘境/全民觉醒；其他题材不误伤', () => {
  assert.ok(N.detectNation('国运绑定，全民觉醒，选手进秘境副本'));
  assert.ok(N.detectNation('a national fortune secret realm global arena story'));
  assert.ok(!N.detectNation('都市甜宠恋爱'));
  assert.ok(!N.detectNation('古装宅斗'));
  assert.strictEqual(N.buildNationDirective('职场升职记', 'zh'), '');
});

test('v2.30 pickNationDevices：命中优先、确定性、兜底三件套、不重复不越界', () => {
  const a = N.pickNationDevices('国运直播，副本解谜通关', 3);
  const b = N.pickNationDevices('国运直播，副本解谜通关', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  // 无命中也必须有通用三件套兜底
  const empty = N.pickNationDevices('', 3).map((x) => x.id);
  ['realm_rules', 'national_binding', 'secret_realm_puzzle'].forEach((id) => assert.ok(empty.includes(id), `兜底缺 ${id}`));
  assert.strictEqual(a.length, 3);
  const big = N.pickNationDevices('国运', 20);
  assert.strictEqual(big.length, N.NATION_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.30 指令含规则不反悔/数值对账/虚构对手国/不煽动仇恨等硬底线，英文零中文', () => {
  const zh = N.buildNationDirective('国运秘境剧', 'zh');
  assert.ok(zh.includes('规则') && zh.includes('账') && zh.includes('虚构') && zh.includes('仇恨'));
  const en = N.buildNationDirective('national fortune secret realm drama', 'en');
  assert.ok(/rule/i.test(en) && /fictional/i.test(en) && !cjk(en));
});

test('v2.30 注册表登记即生效（第21套）；标签新增国运秘境子类16叶', () => {
  assert.ok(R.detectCraftStack('国运秘境全民觉醒').includes('nation'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['副本规则即引擎', '国运联动结算', '文化根脉解题', '候补选手逆袭'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 980);
});
