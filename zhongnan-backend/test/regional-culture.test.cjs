const test = require('node:test');
const assert = require('node:assert');
const R = require('../dist/config/regional-culture.js');

test('地域卡：覆盖主要地域、字段完整、每卡都有反刻板禁忌', () => {
  assert.ok(R.REGION_CARDS.length >= 10);
  R.REGION_CARDS.forEach((c) => {
    ['traits', 'particles', 'lifeDetails', 'scenes', 'relations', 'taboos', 'fitGenres'].forEach((k) =>
      assert.ok(Array.isArray(c[k]) && c[k].length >= 2, `${c.name}.${k} 不完整`));
    assert.ok(c.speechStyle.length > 5, `${c.name} 缺语言风格`);
    assert.ok(c.taboos.length >= 1, `${c.name} 必须有创作禁忌防刻板`);
  });
});

test('地域推断：名称/别名/自由文本命中，未知安全返回空', () => {
  assert.strictEqual(R.getRegionCard('东北').name, '东北');
  assert.strictEqual(R.getRegionCard('哈尔滨').name, '东北');
  assert.strictEqual(R.matchRegion('我是辽宁沈阳的').name, '东北');
  assert.strictEqual(R.getRegionCard('川渝').name, '川渝');
  assert.strictEqual(R.getRegionCard('未知星球'), undefined);
  assert.strictEqual(R.regionalBrief('未知星球'), '');
});

test('地域简报：含性格/语言/细节/禁忌，可直接喂人设岗', () => {
  const b = R.regionalBrief('成都');
  assert.ok(b.includes('川渝'));
  ['语言', '生活细节', '禁忌'].forEach((k) => assert.ok(b.includes(k), `缺${k}`));
});
