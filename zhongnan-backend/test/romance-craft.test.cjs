const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/engine/romance-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.10 情感装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(R.ROMANCE_DEVICES.length, 10);
  const ids = new Set();
  R.ROMANCE_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.10 detectRomance 中英识别；非情感剧不注入', () => {
  assert.ok(R.detectRomance('先婚后爱甜宠暗恋'));
  assert.ok(R.detectRomance('a sweet romance romcom love story'));
  assert.ok(!R.detectRomance('刑侦破案悬疑'));
  assert.strictEqual(R.buildRomanceDirective('刑侦破案', 'zh'), '');
});

test('v2.10 pickRomanceDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = R.pickRomanceDevices('极限拉扯、吃醋、破镜重圆复合', 3);
  const b = R.pickRomanceDevices('极限拉扯、吃醋、破镜重圆复合', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'push_pull'));
  assert.ok(a.some((d) => d.id === 'jealous_bound'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(R.pickRomanceDevices('', 3).length, 3);
  const big = R.pickRomanceDevices('恋爱', 20);
  assert.strictEqual(big.length, R.ROMANCE_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.10 指令含“不跳步/误会不过夜/不把控制当深情”底线，英文零中文', () => {
  const zh = R.buildRomanceDirective('甜宠虐恋言情', 'zh');
  assert.ok(zh.includes('一阶一阶') && zh.includes('PUA') && zh.includes('尊重意愿'));
  const en = R.buildRomanceDirective('romance love story couple', 'en');
  assert.ok(/one visible rung/i.test(en) && /never frame control/i.test(en) && !cjk(en));
});

test('v2.10 情感节拍标签已入树且全局无重名', () => {
  ['心动阶梯递进', '极限拉扯', '误会不过夜', '暗恋视角差', '糖刀配比', '虐点三拍', '肢体微进度', 'HE情绪兑付', '破镜重圆修复'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
