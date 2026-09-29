const test = require('node:test');
const assert = require('node:assert');
const F = require('../dist/engine/free-novel-sources.js');

test('来源库自检通过、数量充足、覆盖多语言', () => {
  const v = F.validateSources();
  assert.deepStrictEqual(v.errors, []);
  assert.strictEqual(v.ok, true);
  assert.ok(v.count >= 19, `仅${v.count}个来源`);
  ['zh', 'en', 'ja', 'ko', 'es', 'de', 'it'].forEach((l) => assert.ok(v.languages.includes(l), `缺语言${l}`));
});

test('全部https且id/url无重复', () => {
  const list = F.listSources();
  assert.ok(list.every((s) => s.url.startsWith('https://')));
  assert.strictEqual(new Set(list.map((s) => s.id)).size, list.length);
  assert.strictEqual(new Set(list.map((s) => s.url)).size, list.length);
});

test('改编权限与授权类型一致：公版可改编、平台免费区不可默认改编', () => {
  F.listSources().forEach((s) => {
    if (s.license === 'public_domain') assert.strictEqual(s.adapt, true, `${s.name}公版应可改编`);
    if (s.license === 'platform_free') assert.strictEqual(s.adapt, false, `${s.name}平台免费区不可默认改编`);
    assert.ok(s.adaptNote.length > 0);
  });
});

test('按语言筛选：日文命中青空、且结果都含该语言或multi', () => {
  const ja = F.filterByLang('ja');
  assert.ok(ja.some((s) => s.id === 'aozora'));
  assert.ok(!ja.some((s) => s.id === 'standard-ebooks'));
  const zh = F.filterByLang('zh');
  assert.ok(zh.every((s) => s.langs.includes('zh') || s.langs.includes('multi')));
});

test('可直接改编清单全部为公版', () => {
  assert.ok(F.adaptableSources().length >= 8);
  F.adaptableSources().forEach((s) => assert.strictEqual(s.license, 'public_domain'));
});

test('绝不收录盗版/侵权高风险站点', () => {
  F.listSources().forEach((s) => {
    const low = s.url.toLowerCase();
    F.PIRACY_BLACKLIST.forEach((b) => assert.ok(!low.includes(b), `${s.url} 命中盗版词${b}`));
  });
});

test('v2.42 扩充至30个来源且覆盖法/俄/葡/阿新语种', () => {
  const v = F.validateSources();
  assert.strictEqual(v.ok, true);
  assert.ok(v.count >= 30, `v2.42 应不少于30个，实际${v.count}`);
  ['fr', 'ru', 'pt', 'ar'].forEach((l) => assert.ok(v.languages.includes(l), `缺语言${l}`));
  ['gallica', 'feb-web', 'dominiopublico', 'wikisource-ar', 'ctext', 'ndl-dl'].forEach((id) =>
    assert.ok(F.listSources().some((s) => s.id === id), `缺来源${id}`));
});
