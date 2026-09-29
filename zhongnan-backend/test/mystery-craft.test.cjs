const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/mystery-craft.js');
const T = require('../dist/config/tag-taxonomy.js');
const cjk = (s) => /[一-鿿]/.test(String(s));

test('v2.07 悬疑诡计库：10 类字段完整、id 唯一、英文层零中文', () => {
  assert.strictEqual(M.MYSTERY_TRICKS.length, 10);
  const ids = new Set();
  M.MYSTERY_TRICKS.forEach((m) => {
    ['name', 'nameEn'].forEach((k) => assert.ok(m[k] && m[k].length >= 2, `${m.id}.${k} 不完整`));
    ['principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'].forEach((k) => assert.ok(m[k] && m[k].length > 4, `${m.id}.${k} 不完整`));
    assert.ok(!ids.has(m.id), `重复 id ${m.id}`); ids.add(m.id);
    ['nameEn', 'principleEn', 'techniqueEn', 'riskEn'].forEach((k) => assert.ok(!cjk(m[k]), `${m.id}.${k} 含中文`));
    assert.ok(m.kw.length >= 3);
  });
});

test('v2.07 detectMystery 中英识别；非悬疑不注入', () => {
  assert.ok(M.detectMystery('刑侦破案密室悬疑'));
  assert.ok(M.detectMystery('a detective whodunit murder crime'));
  assert.ok(!M.detectMystery('甜宠恋爱日常'));
  assert.strictEqual(M.buildMysteryDirective('甜宠恋爱', 'zh'), '');
});

test('v2.07 pickMysteryTricks：命中优先、确定性、永不空、不重复不越界', () => {
  const a = M.pickMysteryTricks('密室加不在场证明和罗生门多视角', 3);
  const b = M.pickMysteryTricks('密室加不在场证明和罗生门多视角', 3);
  assert.deepStrictEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.ok(a.some((m) => m.id === 'locked_room'));
  assert.ok(a.some((m) => m.id === 'alibi'));
  assert.strictEqual(a.length, 3);
  assert.strictEqual(M.pickMysteryTricks('', 3).length, 3);
  const big = M.pickMysteryTricks('悬疑', 20);
  assert.strictEqual(big.length, M.MYSTERY_TRICKS.length);
  assert.strictEqual(new Set(big.map((m) => m.id)).size, big.length);
});

test('v2.07 指令含“线索公平”硬底线，英文零中文', () => {
  const zh = M.buildMysteryDirective('悬疑推理高能反转', 'zh');
  assert.ok(zh.includes('线索公平') && zh.includes('反转都必须能从前文推出') && zh.includes('不得临时空降'));
  const en = M.buildMysteryDirective('mystery thriller investigation twist', 'en');
  assert.ok(/fair play/.test(en) && !cjk(en));
});

test('v2.07 悬疑诡计级标签已入树', () => {
  ['不在场证明诡计', '叙述性诡计', '身份替换迷局', '多重反转套娃', '罗生门多视角', '倒计时破案', '伏线公平回收', '安乐椅推理'].forEach((n) => assert.ok(T.findTagByName(n), `缺标签 ${n}`));
});
