const test = require('node:test');
const assert = require('node:assert');
const F = require('../dist/engine/family-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.15 家庭伦理装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(F.FAMILY_DEVICES.length, 10);
  const ids = new Set();
  F.FAMILY_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.15 detectFamily 中英识别；甜宠/职场不注入', () => {
  assert.ok(F.detectFamily('家庭伦理婆媳养老年代剧'));
  assert.ok(F.detectFamily('a family saga about in-laws and eldercare'));
  assert.ok(!F.detectFamily('都市甜宠恋爱'));
  assert.strictEqual(F.buildFamilyDirective('职场商战', 'zh'), '');
});

test('v2.15 pickFamilyDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = F.pickFamilyDevices('饭桌团圆饭上的隐忍与总爆发、和解', 3);
  const b = F.pickFamilyDevices('饭桌团圆饭上的隐忍与总爆发、和解', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'family_stage'));
  assert.ok(a.some((d) => d.id === 'suppress_burst'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(F.pickFamilyDevices('', 3).length, 3);
  const big = F.pickFamilyDevices('家庭', 20);
  assert.strictEqual(big.length, F.FAMILY_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.15 指令含“代际不脸谱化/不美化愚孝家暴/去狗血/年代考据/和解不绑架”底线，英文零中文', () => {
  const zh = F.buildFamilyDirective('家庭伦理婆媳年代', 'zh');
  assert.ok(zh.includes('脸谱化') && zh.includes('家暴') && zh.includes('狗血') && zh.includes('考据') && zh.includes('原谅'));
  const en = F.buildFamilyDirective('family drama mother-in-law era', 'en');
  assert.ok(/understandable stances/i.test(en) && /anachronism/i.test(en) && !cjk(en));
});

test('v2.15 家庭机制标签已入树且全局无重名', () => {
  ['积怨旧账层层翻', '代际立场双面', '烟火日常承载', '血缘与个体边界', '被亲人误解翻案', '饭桌群像冲突', '和解分步有代价', '隐忍到总爆发', '去狗血现实冲突'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
