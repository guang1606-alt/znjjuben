const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/lib/model-config-policy.js');

function valid(over = {}) {
  return { id: 'p1', name: '火山文本', modality: 'text', baseUrl: 'https://ark.cn/v1', apiKey: 'sk-xxx',
    model: 'doubao-pro', inYuanPerMTok: 5, outYuanPerMTok: 15, enabled: true, ...over };
}

test('供应商校验：缺名/非法URL/缺模型/启用无Key/负单价 均被拦', () => {
  assert.strictEqual(P.validateProvider(valid({ name: '' })).ok, false);
  assert.strictEqual(P.validateProvider(valid({ baseUrl: 'ftp://x' })).ok, false);
  assert.strictEqual(P.validateProvider(valid({ model: '' })).ok, false);
  assert.strictEqual(P.validateProvider(valid({ apiKey: '' })).ok, false);
  assert.strictEqual(P.validateProvider(valid({ inYuanPerMTok: -1 })).ok, false);
  assert.strictEqual(P.validateProvider(valid()).ok, true);
  // 禁用态允许暂无Key（先建后填）
  assert.strictEqual(P.validateProvider(valid({ enabled: false, apiKey: '' })).ok, true);
});

test('新增/覆盖供应商，重名不同id拒绝', () => {
  let l = P.upsertProvider([], valid());
  assert.strictEqual(l.length, 1);
  l = P.upsertProvider(l, valid({ outYuanPerMTok: 20 })); // 同id覆盖
  assert.strictEqual(l.length, 1);
  assert.strictEqual(l[0].outYuanPerMTok, 20);
  assert.throws(() => P.upsertProvider(l, valid({ id: 'p2', name: '火山文本' })), /NAME_DUP/);
  // 无id自动生成
  const l2 = P.upsertProvider([], valid({ id: '' }));
  assert.ok(l2[0].id.startsWith('pv_'));
});

test('删除供应商', () => {
  const l = P.upsertProvider(P.upsertProvider([], valid()), valid({ id: 'p2', name: '另一家' }));
  assert.strictEqual(P.removeProvider(l, 'p1').length, 1);
});

test('岗位路由：命中/未绑定/被禁用/模态不符 行为正确', () => {
  const text = valid();
  const img = valid({ id: 'i1', name: 'GPT-image', modality: 'image', model: 'gpt-image-1' });
  const disabled = valid({ id: 'd1', name: '停用', enabled: false });
  const list = [text, img, disabled];
  assert.strictEqual(P.routeProvider(list, { writer: 'p1' }, 'writer')?.id, 'p1');
  assert.strictEqual(P.routeProvider(list, {}, 'writer'), null);                 // 未绑定→回退
  assert.strictEqual(P.routeProvider(list, { writer: 'd1' }, 'writer'), null);   // 禁用→回退
  assert.strictEqual(P.routeProvider(list, { writer: 'i1' }, 'writer'), null);   // 图片模型不能给创作岗
  assert.strictEqual(P.routeProvider(list, { writer: 'gone' }, 'writer'), null); // 已删→回退
});

test('选 catalog 型号时自动回填单价/baseUrl（单价为 0 才回填，用户手填优先）', () => {
  const cat = { id: 'doubao_seed2pro', vendor: '字节豆包', name: 'Doubao-Seed-2.0-Pro',
    defaultBaseUrl: 'https://ark.cn/v1', inYuanPerMTok: 10, outYuanPerMTok: 30 };
  // 单价为 0 → 回填 catalog 单价
  const e1 = P.enrichProviderFromCatalog(
    { id: 'p1', name: '豆包', modality: 'text', baseUrl: '', apiKey: 'sk-x', model: '', inYuanPerMTok: 0, outYuanPerMTok: 0, enabled: true, catalogId: 'doubao_seed2pro' },
    cat,
  );
  assert.strictEqual(e1.inYuanPerMTok, 10);
  assert.strictEqual(e1.outYuanPerMTok, 30);
  assert.strictEqual(e1.baseUrl, 'https://ark.cn/v1');
  assert.strictEqual(e1.model, 'Doubao-Seed-2.0-Pro'); // model 也回填
  // 用户已填单价 → 不覆盖
  const e2 = P.enrichProviderFromCatalog(
    { id: 'p1', name: '豆包', modality: 'text', baseUrl: 'https://my.proxy/v1', apiKey: 'sk-x', model: 'custom', inYuanPerMTok: 5, outYuanPerMTok: 12, enabled: true, catalogId: 'doubao_seed2pro' },
    cat,
  );
  assert.strictEqual(e2.inYuanPerMTok, 5);
  assert.strictEqual(e2.outYuanPerMTok, 12);
  assert.strictEqual(e2.baseUrl, 'https://my.proxy/v1'); // 用户 baseUrl 优先
  assert.strictEqual(e2.model, 'custom');               // 用户 model 优先
  // 无 catalog → 原样返回
  const e3 = P.enrichProviderFromCatalog(
    { id: 'p1', name: '自建', modality: 'text', baseUrl: 'https://x/v1', apiKey: 'sk-x', model: 'm', inYuanPerMTok: 1, outYuanPerMTok: 2, enabled: true },
    undefined,
  );
  assert.strictEqual(e3.inYuanPerMTok, 1);
});

test('回显脱敏不含明文Key；掩码占位保存时沿用旧Key', () => {
  const m = P.maskProviders([valid({ apiKey: 'sk-secret-1234' })]);
  assert.ok(!m[0].apiKey.includes('secret'));
  assert.ok(m[0].apiKey.endsWith('1234'));
  const old = valid({ apiKey: 'sk-real' });
  const keep = P.mergeMaskedKey(valid({ apiKey: '••••••real' }), old);
  assert.strictEqual(keep.apiKey, 'sk-real');
  const replace = P.mergeMaskedKey(valid({ apiKey: 'sk-new' }), old);
  assert.strictEqual(replace.apiKey, 'sk-new');
});
