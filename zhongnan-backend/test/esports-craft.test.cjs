const test = require('node:test');
const assert = require('node:assert');
const E = require('../dist/engine/esports-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.23 电竞装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(E.ESPORTS_DEVICES.length, 10);
  const ids = new Set();
  E.ESPORTS_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.23 detectEsports 中英识别电竞/体育竞技；古装不误伤', () => {
  assert.ok(E.detectEsports('职业战队冲击联赛冠军决赛'));
  assert.ok(E.detectEsports('篮球运动员青训联赛'));
  assert.ok(E.detectEsports('an esports team grand final and a basketball championship'));
  assert.ok(!E.detectEsports('古装宫斗权谋'));
  assert.strictEqual(E.buildEsportsDirective('家庭婆媳', 'zh'), '');
});

test('v2.23 pickEsportsDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = E.pickEsportsDevices('逆风翻盘的关键操作与团队配合', 3);
  const b = E.pickEsportsDevices('逆风翻盘的关键操作与团队配合', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'comeback_curve'));
  assert.ok(a.some((d) => d.id === 'team_position'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(E.pickEsportsDevices('', 3).length, 3);
  const big = E.pickEsportsDevices('电竞', 20);
  assert.strictEqual(big.length, E.ESPORTS_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.23 指令含规则可信/翻盘台阶/反假赛底线，英文零中文', () => {
  const zh = E.buildEsportsDirective('电竞战队决赛剧', 'zh');
  assert.ok(zh.includes('赛制') && zh.includes('翻盘') && zh.includes('假赛') && zh.includes('防沉迷'));
  const en = E.buildEsportsDirective('esports team tournament final', 'en');
  assert.ok(/comeback/i.test(en) && /match-fixing/i.test(en) && !cjk(en));
});

test('v2.23 注册表登记即生效；标签新增电竞竞技子类', () => {
  assert.ok(R.detectCraftStack('电竞战队决赛').includes('esports'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['逆风翻盘曲线', '版本战术博弈', '梦想有价兑现', '让一追三'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
  assert.ok(T.leafCount() >= 964);
});
