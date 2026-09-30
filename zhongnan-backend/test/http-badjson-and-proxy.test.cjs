/**
 * v2.218 反向代理真实 IP + 请求体错误契约（HTTP 层端到端）：
 * 1. trust proxy——生产部署在反向代理（nginx/veFaaS 网关）后，req.ip 必须解析 X-Forwarded-For，
 *    否则注册/登录/邀请码三类 IP 维度限流会把全体用户算成同一代理 IP（注册限流 5 个/15min 必误伤）。
 *    默认信任 1 跳代理；客户端伪造的 XFF 前缀被忽略（取倒数第 2 跳，即代理所报真实地址）。
 * 2. 请求体错误契约——POST 坏 JSON 是客户端错误应 400、超限应 413，此前一律落兜底 500 INTERNAL_ERROR。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const app = createApp({ auth: createAuthRouter(createMemoryPrisma()) });
const server = app.listen(0);
test.before(() => new Promise((r) => server.once('listening', r)));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const base = () => `http://127.0.0.1:${server.address().port}`;
const postJSON = (p, body, headers = {}) => fetch(base() + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('坏 JSON 请求体返回 400 而非 500（客户端错误不进 INTERNAL_ERROR）', async () => {
  const r = await postJSON('/api/auth/login', '{"bad json');
  assert.strictEqual(r.status, 400, `坏 JSON 应 400，实际 ${r.status}`);
  const j = await r.json();
  assert.ok(j.error, '错误体必须为 JSON');
  assert.notStrictEqual(j.error, 'INTERNAL_ERROR', '客户端请求体错误不得报 INTERNAL_ERROR');
});

test('超过 12mb 的请求体返回 413 而非 500', async () => {
  const big = JSON.stringify({ pad: 'a'.repeat(13 * 1024 * 1024) });
  const r = await postJSON('/api/auth/login', big);
  assert.strictEqual(r.status, 413, `超限体应 413，实际 ${r.status}`);
});

test('trust proxy：X-Forwarded-For 被解析为真实客户端 IP，不同来源限流互不影响', async () => {
  const reg = (phone, ip) => postJSON('/api/auth/register', { phone, password: 'password123' }, { 'X-Forwarded-For': ip });
  // 来源 A：成功注册 5 个后触顶
  for (let i = 1; i <= 5; i++) {
    const r = await reg(`1381111000${i}`, '9.9.9.1');
    assert.strictEqual(r.status, 200, `来源 A 第 ${i} 个注册应成功`);
  }
  const locked = await reg('13811110006', '9.9.9.1');
  assert.strictEqual(locked.status, 429, '来源 A 第 6 个注册应 429');
  // 来源 B：独立 IP 不受来源 A 锁定影响（若 req.ip 未解析 XFF，这里会误伤 429）
  const ok = await reg('13811110007', '9.9.9.2');
  assert.strictEqual(ok.status, 200, '来源 B 注册不应被来源 A 的锁定影响');
  // 伪造的 XFF 前缀不生效：XFF: fake, 9.9.9.1 应视为 9.9.9.1（已锁定）
  const spoof = await postJSON('/api/auth/register', { phone: '13811110008', password: 'password123' }, { 'X-Forwarded-For': '6.6.6.6, 9.9.9.1' });
  assert.strictEqual(spoof.status, 429, '伪造 XFF 前缀不得绕过来源 A 的锁定');
});
