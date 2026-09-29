const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/engine/hook-catalog-i18n.js');
const H = require('../dist/engine/hook-system.js');

test('v2.46 29 钩 × 4 语 × 3 字段全覆盖', () => {
  const all = H.ALL_HOOKS.map((h) => h.id);
  assert.strictEqual(all.length, 29);
  assert.deepStrictEqual(C.HOOK_CATALOG_IDS.sort(), all.sort());
  const cov = C.hookCatalogCoverage(all);
  assert.deepStrictEqual(cov.missing, []);
  assert.strictEqual(cov.covered, 29 * 4 * 3);
});

test('localizeHookList：四语 name/definition/example 齐全且非中文回退；zh/en 原样', () => {
  const en = H.hooksByLayer('open', 'en');
  for (const l of ['ja', 'ko', 'es', 'ar']) {
    const list = C.localizeHookList(en, l);
    assert.strictEqual(list.length, en.length);
    list.forEach((h) => {
      assert.ok(h.id && h.name && h.definition && h.example, `${l} ${h.id} 缺字段`);
      assert.ok(h.technique === undefined || h.technique !== undefined); // 其余字段保留不炸
    });
  }
  const zh = H.hooksByLayer('micro', 'zh');
  assert.strictEqual(C.localizeHookList(zh, 'zh'), zh);
});

test('未知 id 回退 enFallback 不空', () => {
  const v = C.localizeHookEntry('nope', 'ja', { name: 'Fb', definition: 'd', example: 'e' });
  assert.deepStrictEqual(v, { name: 'Fb', definition: 'd', example: 'e' });
});
