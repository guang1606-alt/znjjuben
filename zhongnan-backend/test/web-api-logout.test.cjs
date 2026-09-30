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

describe('前端 logout：先吊销后清本地', () => {
  let Api, calls;
  beforeEach(() => {
    Api = installEnv(); calls = [];
    global.fetch = async (url, opts) => {
      calls.push([url, opts]);
      return global.__route ? global.__route(url, opts, calls.length) : { ok: true, status: 200, async text() { return '{}'; } };
    };
  });

  it('logout 通知后端吊销 refreshToken，并清空本地登录态', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    global.__route = (url) => {
      if (url === '/api/auth/logout') return { ok: true, status: 200, async text() { return JSON.stringify({ ok: true }); } };
      return { ok: true, status: 200, async text() { return '{}'; } };
    };
    await Api.auth.logout();
    const lc = calls.find(([u]) => u === '/api/auth/logout');
    assert.ok(lc, '必须调用后端吊销端点');
    assert.strictEqual(JSON.parse(lc[1].body).refreshToken, 'rt1');
    assert.strictEqual(Api.isAuthed(), false, '本地登录态已清空');
    assert.strictEqual(Api.getRefreshToken(), null);
  });

  it('后端吊销失败（网络异常）不阻塞本地登出', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    global.__route = (url) => {
      if (url === '/api/auth/logout') return Promise.reject(new TypeError('offline'));
      return { ok: true, status: 200, async text() { return '{}'; } };
    };
    await Api.auth.logout();
    assert.strictEqual(Api.isAuthed(), false);
    assert.strictEqual(Api.getToken(), null);
  });
});
