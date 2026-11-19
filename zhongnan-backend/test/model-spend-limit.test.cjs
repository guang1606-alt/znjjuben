const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const MP = require('../dist/lib/model-proxy.js');
const SL = require('../dist/lib/spend-limit.js');
const P = require('../dist/config/pricing.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const ENV_KEYS = [
  'MODEL_TEXT_ECONOMY_KEY', 'MODEL_GATEWAY_BASE_URL', 'MODEL_TEXT_ECONOMY_SPEND_LIMIT_YUAN',
  'MODEL_IMAGE_STANDARD_KEY', 'MODEL_IMAGE_GATEWAY_BASE_URL', 'MODEL_IMAGE_STANDARD_SPEND_LIMIT_YUAN',
  'REQUIRE_REAL_MODEL',
];

function control(mem, over = {}) {
  SL.__setSpendControlForTest({ prisma: mem, enabled: true, totalLimitYuan: 1, ...over });
}
function okResp(content = '正文', usage = { prompt_tokens: 100, completion_tokens: 50 }) {
  return { ok: true, status: 200, text: async () => '', json: async () => ({ choices: [{ message: { content } }], usage }) };
}
function badResp(status) {
  return { ok: false, status, text: async () => `err-${status}`, json: async () => ({}) };
}
function budget(mem, id) {
  return mem.modelSpendBudget.findUnique({ where: { id } });
}

afterEach(() => {
  SL.__setSpendControlForTest(null);
  MP.__setProviderSource(null);
  MP.__setHttpTransport(null);
  MP.__resetModelHealth();
  for (const k of ENV_KEYS) delete process.env[k];
});

test('同一 Key 已有台账后再次预留：只做条件扣减，不因建行冲突 fail-closed', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 2 });
  const r1 = await SL.reserveModelSpend({ apiKey: 'sk-dup', keyLimitYuan: 1, reserveFen: 50 });
  assert.ok(r1);
  const r2 = await SL.reserveModelSpend({ apiKey: 'sk-dup', keyLimitYuan: 1, reserveFen: 20 });
  assert.ok(r2, '第二个预留必须成功，不能因预算行已存在而 UNAVAILABLE');
  await assert.rejects(
    SL.reserveModelSpend({ apiKey: 'sk-dup', keyLimitYuan: 1, reserveFen: 40 }),
    /MODEL_SPEND_LIMIT_KEY/,
  );
  await SL.settleModelSpend(r1, 0);
  await SL.settleModelSpend(r2, 0);
  const key = await mem.modelSpendBudget.findMany();
  assert.equal(key.length, 2, '只有 total 与一条 Key 分账');
  for (const b of key) {
    assert.equal(b.reservedFen, 0);
    assert.equal(b.spentFen, 0);
    assert.equal(b.availableFen, b.limitFen);
  }
  assert.equal((await budget(mem, 'total')).limitFen, 200);
});

test('限额总阀关闭：不建台账，维持原有真实调用', async () => {
  const mem = createMemoryPrisma();
  control(mem, { enabled: false, totalLimitYuan: 0 });
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-off';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://off.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => okResp());
  const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p', { maxTokens: 20 });
  assert.equal(r.text, '正文');
  assert.equal(await budget(mem, 'total'), null);
});

test('总额度不足：零 HTTP 请求并明确拒绝', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 0 });
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-total';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://total.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let hits = 0;
  MP.__setHttpTransport(async () => { hits++; return okResp(); });
  await assert.rejects(
    MP.callText(P.EngineTier.ECONOMY, 'writer', 'p', { maxTokens: 100 }),
    /MODEL_SPEND_LIMIT_TOTAL/,
  );
  assert.equal(hits, 0);
});

test('单 Key 额度不足：该候选零请求，错误不伪装成供应商故障', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 100 });
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-key-cap';
  process.env.MODEL_TEXT_ECONOMY_SPEND_LIMIT_YUAN = '0.01';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://key-cap.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let hits = 0;
  MP.__setHttpTransport(async () => { hits++; return okResp(); });
  await assert.rejects(
    MP.callText(P.EngineTier.ECONOMY, 'writer', 'p', { maxTokens: 10000 }),
    /MODEL_SPEND_LIMIT_KEY/,
  );
  assert.equal(hits, 0);
});

test('成功调用按实际成本结算，在途预留归零并返还差额', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 5 });
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-settle';
  process.env.MODEL_TEXT_ECONOMY_SPEND_LIMIT_YUAN = '5';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://settle.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => okResp('正文', { prompt_tokens: 1000, completion_tokens: 50_000 }));
  const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p', { maxTokens: 100_000 });
  assert.equal(r.costFen, 11);
  for (const id of ['total', 'key']) {
    const row = id === 'total' ? await budget(mem, 'total') : (await mem.modelSpendBudget.findMany()).find((x) => x.id.startsWith('key_'));
    assert.equal(row.spentFen, 11);
    assert.equal(row.reservedFen, 0);
    assert.equal(row.availableFen, 489);
  }
});

test('失败尝试释放预留，重试后台账无在途、无消费', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 1 });
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-release';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://release.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => badResp(503));
  await assert.rejects(MP.callText(P.EngineTier.ECONOMY, 'writer', 'p', { maxTokens: 20 }));
  const total = await budget(mem, 'total');
  assert.equal(total.spentFen, 0);
  assert.equal(total.reservedFen, 0);
  assert.equal(total.availableFen, 100);
});

test('两个并发预留不能同时越过同一总额度', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 1 });
  const results = await Promise.allSettled([
    SL.reserveModelSpend({ apiKey: 'sk-a', keyLimitYuan: 0, reserveFen: 60 }),
    SL.reserveModelSpend({ apiKey: 'sk-b', keyLimitYuan: 0, reserveFen: 60 }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const total = await budget(mem, 'total');
  assert.equal(total.reservedFen, 60);
  assert.equal(total.availableFen, 40);
});

test('图片同样受总额硬阀门约束，超额零请求', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 0 });
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-image-cap';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://image-cap.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let hits = 0;
  MP.__setHttpTransport(async () => { hits++; return okResp(); });
  await assert.rejects(MP.callImage(P.EngineTier.STANDARD, '海报', 1), /MODEL_SPEND_LIMIT_TOTAL/);
  assert.equal(hits, 0);
});

test('图片成功按实际张数结算，在途预留归零', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 1 });
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-image-settle';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://image-settle.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => ({
    ok: true, status: 200, text: async () => '',
    json: async () => ({ data: [{ url: 'https://cdn.local/1.png' }] }),
  }));
  const r = await MP.callImage(P.EngineTier.STANDARD, '海报', 1);
  assert.equal(r.images.length, 1);
  const total = await budget(mem, 'total');
  assert.equal(total.spentFen, 10);
  assert.equal(total.reservedFen, 0);
  assert.equal(total.availableFen, 90);
});

// v2.564 用量可见性：后台只有「限额」输入框时，额度耗尽前管理员看不到已用/在途/可用，
// 只能等用户报「生成失败」才发现。台账是真正决定放行的依据，读数必须与它同源。
test('用量读数：未建台账返回 null，不把「从未记账」伪装成零额度', async () => {
  const mem = createMemoryPrisma();
  assert.equal(await SL.readSpendUsage(mem), null);
});

test('用量读数：预留计入在途、结算计入已用，且能看出分了几个 Key 账本', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 2 });
  const r = await SL.reserveModelSpend({ apiKey: 'sk-usage', keyLimitYuan: 1, reserveFen: 30 });
  let u = await SL.readSpendUsage(mem);
  assert.equal(u.limitYuan, 2);
  assert.equal(u.reservedYuan, 0.3);
  assert.equal(u.availableYuan, 1.7);
  assert.equal(u.spentYuan, 0);
  assert.equal(u.keyCount, 1, '单 Key 限额 > 0 时必须能看出分了几个 Key 账本');
  assert.ok(u.updatedAt, '界面需要展示最近一次记账时间');
  await SL.settleModelSpend(r, 12);
  u = await SL.readSpendUsage(mem);
  assert.equal(u.reservedYuan, 0);
  assert.equal(u.spentYuan, 0.12);
  assert.equal(u.availableYuan, 1.88);
});

// v2.565 供应商级用量：后台给每个供应商配了单 Key 限额，却看不到这只 Key 花了多少，
// 等于配了也管不了。按 Key 分账回读，只回金额、不回指纹。
test('Key 分账读数：只回 Key 行，空 Key 不产生身份', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 1 });
  await SL.reserveModelSpend({ apiKey: 'sk-pv-a', keyLimitYuan: 2, reserveFen: 40 });
  const kid = SL.spendKeyId('sk-pv-a');
  assert.ok(kid && kid.startsWith('key_'));
  assert.equal(SL.spendKeyId('   '), null);
  const map = await SL.readKeySpendUsage(mem);
  assert.deepEqual(Object.keys(map), [kid], 'total 行不得混进 Key 分账');
  assert.equal(map[kid].limitYuan, 2);
  assert.equal(map[kid].reservedYuan, 0.4);
  assert.equal(map[kid].availableYuan, 1.6);
  assert.equal(map[kid].spentYuan, 0);
});

// v2.566 粘贴 Key 常带首尾空白：空白参与 SHA-256 会衍生出第二本分账，
// 后台按 Key 回读时永远配不上，供应商卡片永远显示「尚未产生消费」。
test('Key 首尾空白不影响分账身份：带空白的 Key 与干净 Key 落到同一本账', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 2 });
  await SL.reserveModelSpend({ apiKey: '  sk-ws\t\n', keyLimitYuan: 1, reserveFen: 10 });
  const kid = SL.spendKeyId('sk-ws');
  const map = await SL.readKeySpendUsage(mem);
  assert.deepEqual(Object.keys(map), [kid], '空白 Key 不得孤立成第二本账，否则卡片永远显示尚未产生消费');
  assert.equal(map[kid].reservedYuan, 0.1);
});

test('供应商卡片回带 Key 用量：已用/可用可见，且不下发指纹', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
  assert.match(app, /p\.spendUsage/);
  assert.match(app, /c\.spendUsage/);
  assert.match(app, /尚未产生消费/);
  assert.match(app, /已用 \$\{spendYuanText/);
});

test('超管后台展示用量：已用/在途/可用 + 用尽警告（不再只有输入框）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
  assert.match(html, /id="admSpendUsage"/);
  assert.match(app, /renderSpendUsage\(r && r\.usage, c\)/);
  assert.match(app, /usage\.reservedYuan/);
  assert.match(app, /usage\.availableYuan/);
  assert.match(app, /台账限额/);
  assert.match(app, /已用尽：真实调用会被拒绝/);
});

test('图片失败重试耗尽后释放全部预留，不产生消费', async () => {
  const mem = createMemoryPrisma();
  control(mem, { totalLimitYuan: 1 });
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-image-fail';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://image-fail.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => badResp(503));
  await assert.rejects(MP.callImage(P.EngineTier.STANDARD, '海报', 1));
  const total = await budget(mem, 'total');
  assert.equal(total.spentFen, 0);
  assert.equal(total.reservedFen, 0);
  assert.equal(total.availableFen, 100);
});
