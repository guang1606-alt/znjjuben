const test = require('node:test');
const assert = require('node:assert');
const I = require('../dist/engine/investigation-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.25 刑侦装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(I.INV_DEVICES.length, 10);
  const ids = new Set();
  I.INV_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.25 detectInvestigation 中英识别刑侦法医；甜宠不误伤', () => {
  assert.ok(I.detectInvestigation('刑警队长带法医勘察命案现场'));
  assert.ok(I.detectInvestigation('专案组追凶，尸检锁定证据'));
  assert.ok(I.detectInvestigation('a homicide detective and forensic team at the crime scene'));
  assert.ok(!I.detectInvestigation('都市甜宠恋爱'));
  assert.strictEqual(I.buildInvDirective('校园青春', 'zh'), '');
});

test('v2.25 pickInvDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = I.pickInvDevices('法医尸检与证据链、审讯嫌疑人', 3);
  const b = I.pickInvDevices('法医尸检与证据链、审讯嫌疑人', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'forensic_realism'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(I.pickInvDevices('', 3).length, 3);
  const big = I.pickInvDevices('刑侦', 20);
  assert.strictEqual(big.length, I.INV_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.25 指令含证据链/公平推理/程序正义/不写犯罪教程底线，英文零中文', () => {
  const zh = I.buildInvDirective('刑侦法医破案剧', 'zh');
  assert.ok(zh.includes('证据链') && zh.includes('程序正义') && zh.includes('毁证') && zh.includes('美化罪犯'));
  const en = I.buildInvDirective('police procedural forensic crime drama', 'en');
  assert.ok(/evidence chain/i.test(en) && /actionable/i.test(en) && !cjk(en));
});

test('v2.25 注册表登记即生效；标签新增刑侦法医子类', () => {
  assert.ok(R.detectCraftStack('刑侦法医破案').includes('investigation'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['证据链闭环', '公平推理前置', '程序正义边界', '冷案重启'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
