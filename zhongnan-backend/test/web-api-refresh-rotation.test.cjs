const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// 最小 localStorage / fetch mock（与 web-api.test.cjs 同模式）
function installEnv() {
  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  delete require.cache[require.resolve('../web/api.js')];
  return require('../web/api.js');
}

describe('前端 refresh 轮换与单飞', () => {
  let Api, calls;
  beforeEach(() => {
    Api = installEnv(); calls = [];
    global.fetch = async (url, opts) => {
      calls.push([url, opts]);
      return global.__route ? global.__route(url, opts, calls.length) : { ok: true, status: 200, async text() { return '{}'; } };
    };
  });

  const refreshCalls = () => calls.filter(([u]) => u === '/api/auth/refresh');

  it('轮换持久化：refresh 响应的新 refreshToken 被存储，下次续期自动使用新值', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    let biz = 0;
    global.__route = (url) => {
      if (url === '/api/auth/refresh') return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a2', refreshToken: 'rt2' }); } };
      biz += 1;
      const ok = biz === 2; // 首击 401，重试 200
      return { ok, status: ok ? 200 : 401, async text() { return JSON.stringify({ ok: 1 }); } };
    };
    await Api.request('/api/x', {}); // 401 → refresh 轮换 → 重试 200
    assert.strictEqual(Api.getToken(), 'a2');
    assert.strictEqual(Api.getRefreshToken(), 'rt2', '轮换后的新 refreshToken 必须落库');
    assert.strictEqual(JSON.parse(refreshCalls()[0][1].body).refreshToken, 'rt1');
    // 第二次请求再遇 401 时，续期必须用 rt2
    global.__route = (url) => {
      if (url === '/api/auth/refresh') return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a3', refreshToken: 'rt3' }); } };
      return { ok: false, status: 401, async text() { return '{}'; } };
    };
    const err = await Api.request('/api/x', {}).then(() => null, (e) => e);
    assert.strictEqual(err && err.code, 'AUTH_REQUIRED');
    assert.strictEqual(JSON.parse(refreshCalls()[1][1].body).refreshToken, 'rt2', '第二次续期应使用轮换后的新 refreshToken');
  });

  it('单飞：并发 401 只发起一次 /refresh，两个请求都重试成功', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    let biz = 0;
    global.__route = (url) => {
      if (url === '/api/auth/refresh') {
        return new Promise((res) => setTimeout(() => res({ ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a2', refreshToken: 'rt2' }); } }), 30));
      }
      biz += 1;
      const done = biz > 2; // 前两次各 401（两个请求各首击一次），之后重试成功
      return { ok: done, status: done ? 200 : 401, async text() { return JSON.stringify({ ok: 1 }); } };
    };
    const [r1, r2] = await Promise.all([Api.request('/api/x1', {}), Api.request('/api/x2', {})]);
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(refreshCalls().length, 1, '并发 401 必须共享同一次 /refresh 调用');
    assert.strictEqual(Api.getRefreshToken(), 'rt2');
  });

  it('兼容旧响应格式：refresh 不带 refreshToken 时保留原值', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    let biz = 0;
    global.__route = (url) => {
      if (url === '/api/auth/refresh') return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a2' }); } };
      biz += 1;
      const ok = biz === 2;
      return { ok, status: ok ? 200 : 401, async text() { return '{}'; } };
    };
    await Api.request('/api/x', {}); // 401 → refresh（无 rt 字段）→ 重试 200
    assert.strictEqual(Api.getToken(), 'a2');
    assert.strictEqual(Api.getRefreshToken(), 'rt1', '旧格式响应不得清除/覆盖原 refresh');
  });
});
