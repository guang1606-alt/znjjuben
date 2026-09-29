const test = require('node:test');
const assert = require('node:assert');
const Tm = require('../dist/engine/tourism-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.08 文旅融合装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(Tm.TOURISM_DEVICES.length, 10);
  const ids = new Set();
  Tm.TOURISM_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.08 detectTourism 中英识别；非文旅不注入', () => {
  assert.ok(Tm.detectTourism('古镇文旅返乡创业'));
  assert.ok(Tm.detectTourism('a hometown tourism regional drama'));
  assert.ok(!Tm.detectTourism('都市商战复仇'));
  assert.strictEqual(Tm.buildTourismDirective('都市商战', 'zh'), '');
});

test('v2.08 pickTourismDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = Tm.pickTourismDevices('非遗扎染、民宿、景区动线', 3);
  const b = Tm.pickTourismDevices('非遗扎染、民宿、景区动线', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'heritage_trick'));
  assert.ok(a.some((d) => d.id === 'inn_hub'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(Tm.pickTourismDevices('', 3).length, 3);
  const big = Tm.pickTourismDevices('文旅', 20);
  assert.strictEqual(big.length, Tm.TOURISM_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.08 指令含“剧情优先/不拍成宣传片”底线，英文零中文', () => {
  const zh = Tm.buildTourismDirective('文旅推广，城市宣传', 'zh');
  assert.ok(zh.includes('为剧情服务') && zh.includes('不喊宣传口号') && zh.includes('避免刻板印象'));
  const en = Tm.buildTourismDirective('destination marketing tourism showcase', 'en');
  assert.ok(/story and character first/i.test(en) && !cjk(en));
});

test('v2.08 文旅融合标签已入树', () => {
  ['地标入戏情节', '非遗技艺机关', '美食情绪锚点', '方言烟火气', '地方传说新编', '景区动线叙事', '民宿客栈群像', '风物道具伏笔', '返乡创业文旅'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
});
