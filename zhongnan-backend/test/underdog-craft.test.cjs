const test = require('node:test');
const assert = require('node:assert');
const U = require('../dist/engine/underdog-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.11 爽剧装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(U.UNDERDOG_DEVICES.length, 10);
  const ids = new Set();
  U.UNDERDOG_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.11 detectUnderdog 中英识别；非爽剧不注入', () => {
  assert.ok(U.detectUnderdog('上门赘婿战神归来打脸逆袭'));
  assert.ok(U.detectUnderdog('a hidden boss son-in-law face-slap comeback'));
  assert.ok(!U.detectUnderdog('古风仙侠师徒虐恋'));
  assert.strictEqual(U.buildUnderdogDirective('都市甜宠恋爱', 'zh'), '');
});

test('v2.11 pickUnderdogDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = U.pickUnderdogDevices('马甲隐藏身份、围观震惊、反派boss', 3);
  const b = U.pickUnderdogDevices('马甲隐藏身份、围观震惊、反派boss', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'hidden_identity'));
  assert.ok(a.some((d) => d.id === 'smart_villain'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(U.pickUnderdogDevices('', 3).length, 3);
  const big = U.pickUnderdogDevices('逆袭', 20);
  assert.strictEqual(big.length, U.UNDERDOG_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.11 指令含“压放交替/反派不降智/不美化违法”底线，英文零中文', () => {
  const zh = U.buildUnderdogDirective('逆袭打脸爽剧', 'zh');
  assert.ok(zh.includes('压抑') && zh.includes('降智') && zh.includes('法律'));
  const en = U.buildUnderdogDirective('underdog revenge face-slap power fantasy', 'en');
  assert.ok(/villains stay smart/i.test(en) && /never glorify illegal/i.test(en) && !cjk(en));
});

test('v2.11 爽剧机制标签已入树且全局无重名', () => {
  ['马甲分层揭露', '打脸阶梯递进', '压抑释放节奏', '弱者尊严锚点', '围观见证放大', '羞辱者仰望兑现', '反派逐级加码', '集尾打脸强钩'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
