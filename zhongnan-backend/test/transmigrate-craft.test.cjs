const test = require('node:test');
const assert = require('node:assert');
const X = require('../dist/engine/transmigrate-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.09 穿书装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(X.TRANSMIGRATE_DEVICES.length, 10);
  const ids = new Set();
  X.TRANSMIGRATE_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.09 detectTransmigrate 精准识别穿书/快穿，普通穿越不误判', () => {
  assert.ok(X.detectTransmigrate('穿书成恶毒女配改命'));
  assert.ok(X.detectTransmigrate('快穿任务流小世界'));
  assert.ok(X.detectTransmigrate('reincarnated as the villainess in a novel'));
  assert.ok(!X.detectTransmigrate('穿越古代当王爷'), '普通穿越不等于穿书');
  assert.ok(!X.detectTransmigrate('都市甜宠'));
  assert.strictEqual(X.buildTransmigrateDirective('都市甜宠', 'zh'), '');
});

test('v2.09 pickTransDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = X.pickTransDevices('穿成炮灰加NPC觉醒、脱离条件', 3);
  const b = X.pickTransDevices('穿成炮灰加NPC觉醒、脱离条件', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'cannon_fodder'));
  assert.ok(a.some((d) => d.id === 'npc_awaken'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(X.pickTransDevices('', 3).length, 3);
  const big = X.pickTransDevices('穿书', 20);
  assert.strictEqual(big.length, X.TRANSMIGRATE_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.09 指令含“上帝视角有盲区/改动有后果”底线，英文零中文', () => {
  const zh = X.buildTransmigrateDirective('穿书快穿', 'zh');
  assert.ok(zh.includes('盲区') && zh.includes('连锁后果') && zh.includes('集体降智'));
  const en = X.buildTransmigrateDirective('transmigrated into the novel isekai', 'en');
  assert.ok(/foreknowledge limited/i.test(en) && !cjk(en));
});

test('v2.09 穿书子类型标签已入树', () => {
  ['原著剧情惯性', '原著flag回收', '读者上帝视角', 'NPC觉醒', '穿书脱离条件', '恶毒女配洗白', '替身白月光错位', '快穿小世界结算', '现代知识金手指', '剧情修正力对抗'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
});
