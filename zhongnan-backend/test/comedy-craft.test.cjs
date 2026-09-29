const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/comedy-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.06 喜剧机制库：10 条机制字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(C.COMEDY_MECHANISMS.length, 10);
  const ids = new Set();
  C.COMEDY_MECHANISMS.forEach((m) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(m[k] && m[k].length >= 2, `${m.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(m[k] && m[k].length > 4, `${m.id}.${k} 不完整`));
    assert.ok(!ids.has(m.id), `重复 id ${m.id}`); ids.add(m.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(m[k]), `${m.id}.${k} 含中文`));
    assert.ok(m.kw.length >= 3);
  });
});

test('v2.06 detectComedy 中英识别；非喜剧不注入', () => {
  assert.ok(C.detectComedy('一个东北方言轻喜剧，沙雕解压'));
  assert.ok(C.detectComedy('a workplace sitcom, funny parody'));
  assert.ok(!C.detectComedy('古装权谋夺嫡'));
  assert.strictEqual(C.buildComedyDirective('古装权谋复仇', 'zh'), '');
});

test('v2.06 pickComedyMechanisms：关键词命中优先、确定性、永不空且不超 n', () => {
  const a = C.pickComedyMechanisms('大型社死现场加 callback 回扣', 3);
  const b = C.pickComedyMechanisms('大型社死现场加 callback 回扣', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id), '同输入确定性');
  assert.ok(a.some((m) => m.id === 'social_death'));
  assert.ok(a.some((m) => m.id === 'callback'));
  assert.ok(a.length === 3);
  const empty = C.pickComedyMechanisms('', 3);
  assert.strictEqual(empty.length, 3, '空输入给通用三件套');
  const big = C.pickComedyMechanisms('喜剧', 20);
  assert.strictEqual(big.length, C.COMEDY_MECHANISMS.length, 'n 超库时不重复、不越界');
  assert.strictEqual(new Set(big.map((m) => m.id)).size, big.length, '机制不重复');
});

test('v2.06 buildComedyDirective 中文含机制与底线要求，英文零中文且声明 COMEDY', () => {
  const zh = C.buildComedyDirective('喜剧，误会连环套，三翻四抖', 'zh');
  assert.ok(zh.includes('喜剧机制') && zh.includes('一场一个主包袱') && zh.includes('不拿弱者开涮'));
  const en = C.buildComedyDirective('comedy sitcom with misunderstanding and rule of three', 'en');
  assert.ok(/COMEDY/.test(en) && !cjk(en));
});

test('v2.06 喜剧机制级标签已入树', () => {
  ['预期违背包袱', '三翻四抖递进', 'CallBack回扣', '一本正经胡说八道', '信息差误会升级', '反差人设对撞', '社死名场面', '包袱节奏留白'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
});
