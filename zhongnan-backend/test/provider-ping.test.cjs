/**
 * v2.634 供应商密钥连通性自检：保存成功 ≠ 密钥可用。
 *
 * 先证伪：
 *   超管后台 `POST/PUT /api/admin/model/providers` 只校验字段形状并加密落库，
 *   没有任何端点能回答「这把 Key / 这个接入点现在能不能用」。余额探测只覆盖
 *   DeepSeek / Moonshot 两家（`balance-probe.ts`），其余供应商（火山接入点、Qwen、
 *   MiniMax、OpenAI 兼容自建网关）在 Key 申请下来后只能靠真实生成任务试错：
 *   坏 Key 会被 `tryCandidate` 静默降级到备选端点（`fellback` 不下发前端），
 *   管理员看到的是「保存成功」，用户看到的是质量下滑，中间没有任何可归因信号。
 * 修复：新增只读诊断端点 `POST /api/admin/model/providers/:id/ping` 与
 *   `pingProvider()`——用与生成同一条 HTTP 传输（可注入）发一次 1 token 的
 *   OpenAI 兼容探测，回传 ok/latencyMs/status/message，绝不回显密钥、不写
 *   ModelCallLog、不计费；图像供应商协议各异如实返回 UNSUPPORTED_MODALITY。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'ping-test-secret';
process.env.JWT_REFRESH_SECRET = 'ping-test-refresh';
const MP = require('../dist/lib/model-proxy.js');
const { createApp } = require('../dist/server/app.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'admin1', phone: '18891995171', level: 'PRO', isAdmin: false });
mem._seedUser({ id: 'u_norm2', level: 'BASIC' });

const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const put = async (p, uid, level, body) => {
  const r = await fetch(base + p, { method: 'PUT', headers: H(uid, level), body: JSON.stringify(body) });
  return { s: r.status, j: await r.json().catch(() => null) };
};
const post = async (p, uid, level) => {
  const r = await fetch(base + p, { method: 'POST', headers: H(uid, level), body: '{}' });
  return { s: r.status, j: await r.json().catch(() => null) };
};

// 与生成共用同一条传输：注入假响应，确定性区分 200/401/超时，不触网
function withTransport(fn, handler) {
  const calls = [];
  MP.__setHttpTransport(async (url, init) => { calls.push({ url, init }); return handler(url, init); });
  return { calls, restore: () => MP.__setHttpTransport(null) };
}
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) });

const pv = (over = {}) => ({
  name: '火山-文本', modality: 'text', baseUrl: 'https://ark.example.com/api/v3', model: 'ep-2026',
  apiKey: 'sk-live-ping', inYuanPerMTok: 1, outYuanPerMTok: 2, spendLimitYuan: 0, enabled: true, ...over,
});

describe('v2.634 供应商连通性自检', { concurrency: 1 }, () => {
  it('1) 正常：走 /chat/completions、1 token 探测、回传 ok + 延迟，且不回显密钥', async () => {
    const t = withTransport(null, () => resp(200, '{"choices":[{"message":{"content":"pong"}}]}'));
    let out;
    try { out = await MP.pingProvider({ baseUrl: 'https://ark.example.com/api/v3/', model: 'ep-2026', apiKey: 'sk-live-ping', modality: 'text' }); }
    finally { t.restore(); }
    assert.strictEqual(out.ok, true);
    assert.ok(Number.isFinite(out.latencyMs) && out.latencyMs >= 0, '必须回传延迟');
    assert.strictEqual(out.model, 'ep-2026');
    assert.strictEqual(t.calls.length, 1);
    assert.strictEqual(t.calls[0].url, 'https://ark.example.com/api/v3/chat/completions');
    assert.strictEqual(t.calls[0].init.headers.Authorization, 'Bearer sk-live-ping');
    const body = JSON.parse(t.calls[0].init.body);
    assert.strictEqual(body.model, 'ep-2026');
    assert.strictEqual(body.max_tokens, 1, '探测必须限定 1 token，避免自检本身产生费用');
    assert.ok(!JSON.stringify(out).includes('sk-live-ping'), '诊断结果不得回显密钥');
  });

  it('2) 401：如实回传状态码与脱敏后的原因，绝不泄露密钥', async () => {
    const t = withTransport(null, () => resp(401, '{"error":{"message":"invalid api key sk-live-ping"}}'));
    let out;
    try { out = await MP.pingProvider({ baseUrl: 'https://ark.example.com/api/v3', model: 'ep-2026', apiKey: 'sk-live-ping', modality: 'text' }); }
    finally { t.restore(); }
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.code, 'PING_FAILED');
    assert.strictEqual(out.status, 401);
    assert.ok(out.message.includes('401'), '必须带状态码；实际：' + out.message);
    assert.ok(!out.message.includes('sk-live-ping'), '失败原因不得带密钥；实际：' + out.message);
  });

  it('3) 网络异常 / 超时：不抛错，转成可读结论', async () => {
    let t = withTransport(null, () => { throw new Error('ECONNREFUSED'); });
    let out;
    try { out = await MP.pingProvider({ baseUrl: 'https://ark.example.com/api/v3', model: 'ep-2026', apiKey: 'sk', modality: 'text' }); }
    finally { t.restore(); }
    assert.strictEqual(out.ok, false);
    assert.ok(out.message.includes('ECONNREFUSED'));

    t = withTransport(null, () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
    try { out = await MP.pingProvider({ baseUrl: 'https://ark.example.com/api/v3', model: 'ep-2026', apiKey: 'sk', modality: 'text' }); }
    finally { t.restore(); }
    assert.strictEqual(out.ok, false);
    assert.ok(out.message.includes('超时'), '超时必须明确成「超时」；实际：' + out.message);
  });

  it('4) 图像供应商 / 未填密钥：如实拒绝，不发起任何请求', async () => {
    const t = withTransport(null, () => { throw new Error('不应发起请求'); });
    let a; let b;
    try {
      a = await MP.pingProvider({ baseUrl: 'https://img.example.com/v1', model: 'seedream', apiKey: 'sk', modality: 'image' });
      b = await MP.pingProvider({ baseUrl: 'https://ark.example.com/api/v3', model: 'ep-2026', apiKey: '', modality: 'text' });
    } finally { t.restore(); }
    assert.strictEqual(a.code, 'UNSUPPORTED_MODALITY');
    assert.strictEqual(b.code, 'NO_KEY');
    assert.strictEqual(t.calls.length, 0, '无效输入不得触网');
  });

  it('5) 路由：超管 ping 已存供应商 → 200 {ok:true}；新建未填密钥 → NO_KEY', async () => {
    const saved = await put('/api/admin/model/providers', 'admin1', 'PRO', pv());
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const pid = saved.j.masked.providers.find((p) => p.name === '火山-文本').id;
    // 空 key 的新供应商（mergeMaskedKey 只在已有旧 key 时保留，新建空 key 就是真无 key）
    const saved2 = await put('/api/admin/model/providers', 'admin1', 'PRO', pv({ name: '无密钥供应商', apiKey: '', enabled: false }));
    assert.strictEqual(saved2.s, 200, JSON.stringify(saved2.j));
    const pid2 = saved2.j.masked.providers.find((p) => p.name === '无密钥供应商').id;

    const t = withTransport(null, () => resp(200, '{"choices":[]}'));
    let good; let noKey;
    try {
      good = await post(`/api/admin/model/providers/${pid}/ping`, 'admin1', 'PRO');
      noKey = await post(`/api/admin/model/providers/${pid2}/ping`, 'admin1', 'PRO');
    } finally { t.restore(); }
    assert.strictEqual(good.s, 200);
    assert.strictEqual(good.j.ok, true, JSON.stringify(good.j));
    assert.strictEqual(noKey.s, 200);
    assert.strictEqual(noKey.j.code, 'NO_KEY');
  });

  it('6) 路由：普通用户 403、未知供应商 404', async () => {
    assert.strictEqual((await post('/api/admin/model/providers/x/ping', 'u_norm2', 'BASIC')).s, 403);
    assert.strictEqual((await post('/api/admin/model/providers/no-such-id/ping', 'admin1', 'PRO')).s, 404);
  });
});
