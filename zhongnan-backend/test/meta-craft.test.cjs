const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/meta-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.24 元叙事装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(M.META_DEVICES.length, 10);
  const ids = new Set();
  M.META_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.24 detectMeta 中英识别戏中戏；普通题材不误伤', () => {
  assert.ok(M.detectMeta('这是一个戏中戏结构，台上台下两条线'));
  assert.ok(M.detectMeta('话剧社排练，戏里戏外真假难分'));
  assert.ok(M.detectMeta('a play within a play, actors putting on a play'));
  assert.ok(!M.detectMeta('都市甜宠恋爱日常'));
  assert.strictEqual(M.buildMetaDirective('军旅特战', 'zh'), '');
});

test('v2.24 pickMetaDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = M.pickMetaDevices('排练时道具穿层、双层镜像互文', 3);
  const b = M.pickMetaDevices('排练时道具穿层、双层镜像互文', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'prop_crossing'));
  assert.ok(a.some((d) => d.id === 'mirror_structure'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(M.pickMetaDevices('', 3).length, 3);
  const big = M.pickMetaDevices('戏中戏', 20);
  assert.strictEqual(big.length, M.META_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.24 指令含层级清晰/转层信号/主题归一/不照搬真剧目底线，英文零中文', () => {
  const zh = M.buildMetaDirective('戏中戏元叙事短剧', 'zh');
  assert.ok(zh.includes('现实层') && zh.includes('转层信号') && zh.includes('主题') && zh.includes('照搬'));
  const en = M.buildMetaDirective('a meta narrative play within a play', 'en');
  assert.ok(/two layers/i.test(en) && /theme/i.test(en) && !cjk(en));
});

test('v2.24 结构型引擎可与题材引擎叠加；标签新增元叙事戏中戏子类', () => {
  const stack = R.detectCraftStack('一个戏中戏结构的悬疑短剧，剧团排练暗藏真凶');
  assert.ok(stack.includes('meta'));
  assert.ok(stack.includes('mystery'), '结构型应与题材型同时命中、可叠加');
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['双层地图清晰', '嵌套高潮同频', '转层信号统一', '假戏真做'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
