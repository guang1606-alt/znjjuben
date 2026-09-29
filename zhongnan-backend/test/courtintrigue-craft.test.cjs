const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/courtintrigue-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.13 宅斗宫斗装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(C.COURT_DEVICES.length, 10);
  const ids = new Set();
  C.COURT_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.13 detectCourt 中英识别；现代职场不注入', () => {
  assert.ok(C.detectCourt('将门嫡女宅斗宫斗权谋复仇'));
  assert.ok(C.detectCourt('a period court intrigue harem politics revenge of the legitimate daughter'));
  assert.ok(!C.detectCourt('现代都市职场恋爱'));
  assert.strictEqual(C.buildCourtDirective('现代职场商战', 'zh'), '');
});

test('v2.13 pickCourtDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = C.pickCourtDevices('证据人证物证反杀、蛰伏隐忍、嫡庶礼制', 3);
  const b = C.pickCourtDevices('证据人证物证反杀、蛰伏隐忍、嫡庶礼制', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'evidence_counter'));
  assert.ok(a.some((d) => d.id === 'forbearance'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(C.pickCourtDevices('', 3).length, 3);
  const big = C.pickCourtDevices('宅斗', 20);
  assert.strictEqual(big.length, C.COURT_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.13 指令含“证据链/反派不降智/反雌竞/不歌颂糟粕”底线，英文零中文', () => {
  const zh = C.buildCourtDirective('宅斗宫斗权谋复仇', 'zh');
  assert.ok(zh.includes('证据链') && zh.includes('不降智') && zh.includes('雌竞') && zh.includes('封建'));
  const en = C.buildCourtDirective('period court intrigue harem politics revenge', 'en');
  assert.ok(/evidence chain/i.test(en) && /stays smart/i.test(en) && !cjk(en));
});

test('v2.13 权谋机制标签已入树且全局无重名', () => {
  ['势力关系棋盘', '信息差设局', '证据链反杀', '蛰伏蓄力', '绵里藏针对白', '女性同盟群像', '复仇账本清算', '礼制规则博弈', '胜负有代价'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
  const names = T.ALL_TAGS.filter((t) => t.level === 3).map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, '全局叶子重名');
});
