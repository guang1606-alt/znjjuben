const test = require('node:test');
const assert = require('node:assert');
const G = require('../dist/lib/llm-gateway.js');
const noSleep = async () => {};

test('单次模型成本核算精确（元/百万token→分）', () => {
  // 1M输入@5元 + 1M输出@15元 = 20元 = 2000分
  assert.strictEqual(G.computeModelCostFen(1e6, 1e6, 5, 15), 2000);
  assert.strictEqual(G.computeModelCostFen(0, 0, 5, 15), 0);
  // 小数向上取整，不允许把成本抹零导致亏
  assert.ok(G.computeModelCostFen(1200, 3400, 5, 15) >= 1);
});

test('重试：第3次成功则attempts=3；一直失败则抛最后错误', async () => {
  let n = 0;
  const r = await G.retryWith(async () => { n++; if (n < 3) throw new Error('fail' + n); return 'ok'; }, 3, noSleep);
  assert.strictEqual(r.value, 'ok');
  assert.strictEqual(r.attempts, 3);
  await assert.rejects(G.retryWith(async () => { throw new Error('x'); }, 1, noSleep), /x/);
});

test('主备降级：主不健康选备；全挂抛错不带病放行', () => {
  assert.strictEqual(G.selectProvider([{ name: 'A', healthy: false }, { name: 'B', healthy: true }]).name, 'B');
  assert.strictEqual(G.selectProvider([{ name: 'A', healthy: true }, { name: 'B', healthy: true }]).name, 'A');
  assert.throws(() => G.selectProvider([{ name: 'A', healthy: false }]), /ALL_PROVIDER_DOWN/);
});

test('对用户脱敏：剥离模型/供应商/密钥字段，保留内容与档位', () => {
  const out = G.redactForClient({
    text: '剧本正文', tier: 'standard', costFen: 3,
    model: 'secret-model', provider: 'vendorX', baseUrl: 'https://x', apiKey: 'sk-xxx',
    nested: { model: 'm', ok: 1 },
  });
  assert.strictEqual(out.text, '剧本正文');
  assert.strictEqual(out.tier, 'standard');
  assert.ok(!('model' in out) && !('provider' in out) && !('baseUrl' in out) && !('apiKey' in out));
  assert.ok(!('model' in out.nested) && out.nested.ok === 1);
});

test('多岗位成本台账逐岗累加', () => {
  const l = new G.CostLedger();
  l.add('architect', 1e6, 1e6, 5, 15); // 2000
  l.add('writer', 1e6, 2e6, 5, 15);    // 5+30=3500
  assert.strictEqual(l.totalCostFen, 5500);
  assert.strictEqual(l.totalTokensIn, 2e6);
  assert.strictEqual(l.byRole.writer.calls, 1);
  assert.strictEqual(l.byRole.writer.costFen, 3500);
});

test('网关毛利双保险：售价低于成本×2熔断', () => {
  assert.throws(() => G.assertGatewayMargin(10, 8), /MARGIN_BREACH/);
  assert.doesNotThrow(() => G.assertGatewayMargin(20, 8));
});
