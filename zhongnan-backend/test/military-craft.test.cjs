const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/military-craft.js');
const R = require('../dist/engine/craft-registry.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.23 军旅装置库：10 套字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(M.MILITARY_DEVICES.length, 10);
  const ids = new Set();
  M.MILITARY_DEVICES.forEach((d) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(d[k] && d[k].length >= 2, `${d.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(d[k] && d[k].length > 4, `${d.id}.${k} 不完整`));
    assert.ok(!ids.has(d.id), `重复 id ${d.id}`); ids.add(d.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(d[k]), `${d.id}.${k} 含中文`));
    assert.ok(d.kw.length >= 3);
  });
});

test('v2.23 detectMilitary 中英识别军旅/特战；甜宠不误伤', () => {
  assert.ok(M.detectMilitary('特种兵连队执行反恐任务'));
  assert.ok(M.detectMilitary('新兵入伍军营成长'));
  assert.ok(M.detectMilitary('a special forces platoon counter-terror mission'));
  assert.ok(!M.detectMilitary('都市甜宠恋爱'));
  assert.strictEqual(M.buildMilitaryDirective('校园青春', 'zh'), '');
});

test('v2.23 pickMilitaryDevices：命中优先、确定性、永不空、不重复不越界', () => {
  const a = M.pickMilitaryDevices('战术火力压制与战友掩护、任务简报', 3);
  const b = M.pickMilitaryDevices('战术火力压制与战友掩护、任务简报', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((d) => d.id === 'tactical_realism'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(M.pickMilitaryDevices('', 3).length, 3);
  const big = M.pickMilitaryDevices('军旅', 20);
  assert.strictEqual(big.length, M.MILITARY_DEVICES.length);
  assert.strictEqual(new Set(big.map((d) => d.id)).size, big.length);
});

test('v2.23 指令含指挥链/不神剧/不美化战争底线，英文零中文', () => {
  const zh = M.buildMilitaryDirective('现代军旅特战剧', 'zh');
  assert.ok(zh.includes('指挥') && zh.includes('神剧') && zh.includes('涉密') && zh.includes('美化战争'));
  const en = M.buildMilitaryDirective('modern military special forces drama', 'en');
  assert.ok(/chain of command/i.test(en) && /war god/i.test(en) && !cjk(en));
});

test('v2.23 注册表登记即生效；标签新增军旅特战子类', () => {
  assert.ok(R.detectCraftStack('特种兵军旅').includes('military'));
  assert.strictEqual(R.craftEngineCount(), 21);
  const all = T.ALL_TAGS.map((x) => x.name);
  ['战术动作可信', '训练伏笔回收', '家国情具体选择', '抗洪救灾'].forEach((leaf) => assert.ok(all.includes(leaf), `缺标签 ${leaf}`));
});
