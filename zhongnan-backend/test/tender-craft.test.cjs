const test = require('node:test');
const assert = require('node:assert');
const D = require('../dist/engine/tender-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.25 亲情治愈装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(D.TENDER_DEVICES.length, 10);
  const ids = new Set();
  D.TENDER_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.25 detectTender 中英识别萌宝/银发；刑侦不误伤', () => {
  assert.ok(D.detectTender('单亲妈妈带萌宝的治愈日常'));
  assert.ok(D.detectTender('爷爷奶奶隔代带娃、银发养老'));
  assert.ok(D.detectTender('a single dad raising a toddler with grandma'));
  assert.ok(!D.detectTender('刑警法医破案'));
  assert.strictEqual(D.buildTenderDirective('军旅特战', 'zh'), '');
});

test('v2.25 pickTenderDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = D.pickTenderDevices('奶奶带娃、隔代亲情和解与约定', 3);
  const b = D.pickTenderDevices('奶奶带娃、隔代亲情和解与约定', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'elder_dignity'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(D.pickTenderDevices('', 3).length, 3);
  const big = D.pickTenderDevices('萌宝', 20);
  assert.strictEqual(big.length, D.TENDER_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.25 指令含适龄/台阶/不卖惨/错误知识底线，英文零中文', () => {
  const zh = D.buildTenderDirective('萌宝隔代亲情治愈剧', 'zh');
  assert.ok(zh.includes('年龄') && zh.includes('台阶') && zh.includes('卖惨') && zh.includes('错误知识'));
  const en = D.buildTenderDirective('wholesome family drama with toddler and grandparents', 'en');
  assert.ok(/their age/i.test(en) && /graded steps/i.test(en) && !cjk(en));
});

test('v2.25 注册表登记即生效；标签新增萌宝银发子类', () => {
  assert.ok(R.detectCraftStack('萌宝带娃亲情治愈').includes('tender'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['儿童言行适龄', '羁绊分台阶', '小约定温暖回收', '银发再就业'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
