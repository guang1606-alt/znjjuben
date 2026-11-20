/**
 * v2.623 预留释放失败不得吞掉真实调用失败
 *
 * 证伪背景：tryCandidate / tryImageCandidate 的 finally 里，释放预留（settle(...,0)）失败时
 * 直接 `failure = e` 覆盖原失败。对外行为（优先上抛结算错误）是刻意的——释放失败不能继续重试，
 * 否则可能重复预留超出限额——但原供应商失败因此不再出现在任何日志里：
 * 线上只看到「消费限额结算失败」，无法判断当时到底是 5xx、超时还是空响应。
 *
 * 本文件锁定：覆盖行为保持不变，但覆盖前必须先把原失败写入 [model.release]。
 */
const test = require('node:test');
const assert = require('node:assert');

const spend = require('../dist/lib/spend-limit.js');
const mc = require('../dist/lib/model-config.js');
const mp = require('../dist/lib/model-proxy.js');
const { EngineTier } = require('../dist/config/pricing.js');

const orig = {
  reserve: spend.reserveModelSpend, settle: spend.settleModelSpend,
  resolveText: mc.resolveText, resolveImage: mc.resolveImage,
};

function captureErr(fn) {
  const logs = [];
  const origErr = console.error;
  console.error = (...args) => { logs.push(args.map((a) => (a instanceof Error && a.stack ? a.stack : String(a))).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ r, err: null, logs }), (err) => ({ r: null, err, logs }))
    .finally(() => { console.error = origErr; });
}

function stub(textProviderOnly, transport) {
  spend.reserveModelSpend = async () => ({ stub: true });
  mc.resolveText = async () => null;
  mc.resolveImage = async () => null;
  mp.__setProviderSource(async () => ({
    providers: [{
      id: 'p1', name: 'stub', modality: textProviderOnly ? 'text' : 'image', enabled: true,
      apiKey: 'k-stub', baseUrl: 'https://stub.invalid/v1', model: 'm-stub',
      inYuanPerMTok: 1, outYuanPerMTok: 1, spendLimitYuan: 0,
    }],
    routing: {},
  }));
  mp.__setHttpTransport(transport);
}

test.afterEach(() => {
  spend.reserveModelSpend = orig.reserve;
  spend.settleModelSpend = orig.settle;
  mc.resolveText = orig.resolveText;
  mc.resolveImage = orig.resolveImage;
  mp.__setProviderSource(null);
  mp.__setHttpTransport(null);
});

test('文本：释放失败仍优先上抛（行为不变），但原供应商失败必须先写 [model.release]', async () => {
  stub(true, async () => ({ ok: false, status: 500, text: async () => 'PROVIDER_DOWN_V2623', json: async () => ({}) }));
  spend.settleModelSpend = async (_r, fen) => { if (fen === 0) throw new Error('RELEASE_BOOM_V2623'); };
  const { err, logs } = await captureErr(() => mp.callText(EngineTier.ECONOMY, 'audience', '你好'));
  assert.ok(err instanceof Error);
  assert.match(err.message, /RELEASE_BOOM_V2623/, '释放失败优先上抛的既有语义不变');
  const hit = logs.find((l) => l.includes('[model.release]'));
  assert.ok(hit, '覆盖原失败前必须留痕');
  assert.ok(hit.includes('PROVIDER_DOWN_V2623'), '被覆盖的原供应商失败必须进日志，否则只剩结算话术');
});

test('图片：同样不得吞掉原调用失败', async () => {
  stub(false, async () => ({ ok: false, status: 500, text: async () => 'IMAGE_PROVIDER_DOWN_V2623', json: async () => ({}) }));
  spend.settleModelSpend = async (_r, fen) => { if (fen === 0) throw new Error('IMAGE_RELEASE_BOOM_V2623'); };
  const { err, logs } = await captureErr(() => mp.callImage(EngineTier.ECONOMY, '一只猫'));
  assert.ok(err instanceof Error);
  assert.match(err.message, /IMAGE_RELEASE_BOOM_V2623/);
  const hit = logs.find((l) => l.includes('[model.release]'));
  assert.ok(hit && hit.includes('IMAGE_TRANSIENT_HTTP_500'), '图片链路同样必须保留原失败');
});

test('释放成功时不得产生 [model.release] 噪音', async () => {
  stub(true, async () => ({
    ok: true, status: 200,
    text: async () => '',
    json: async () => ({ choices: [{ message: { content: '正常正文' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
  }));
  spend.settleModelSpend = async () => {};
  const { err, logs } = await captureErr(() => mp.callText(EngineTier.ECONOMY, 'audience', '你好'));
  assert.strictEqual(err, null, `不应失败：${err && err.message}`);
  assert.ok(!logs.some((l) => l.includes('[model.release]')), '正常结束不应写降级日志');
});
