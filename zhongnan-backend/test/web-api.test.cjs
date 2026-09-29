const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// 最小 localStorage / fetch mock
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

describe('前端 API 层鉴权与静默续期', () => {
  let Api, calls;
  beforeEach(() => {
    Api = installEnv(); calls = [];
    global.fetch = async (url, opts) => {
      calls.push([url, opts]);
      // 路由行为由测试内通过 calls 序列自定义
      return global.__route ? global.__route(url, opts, calls.length) : { ok: true, status: 200, async text() { return '{}'; } };
    };
  });

  it('注册成功后持久化 access/refresh/user', async () => {
    global.__route = () => ({ ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', user: { id: 'u', level: 'BASIC' } }); } });
    const d = await Api.auth.register('13800000000', 'password1');
    assert.strictEqual(Api.getToken(), 'a1');
    assert.strictEqual(d.user.level, 'BASIC');
    assert.ok(Api.isAuthed());
  });

  it('业务请求首次 401，用 refresh 换新 token 后自动重试成功', async () => {
    Api.setSession({ accessToken: 'old', refreshToken: 'rt', user: { id: 'u' } });
    let biz = 0;
    global.__route = (url) => {
      if (url === '/api/auth/refresh') return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'new' }); } };
      biz += 1;
      return { ok: biz >= 2, status: biz >= 2 ? 200 : 401, async text() { return biz >= 2 ? JSON.stringify({ ok: 1 }) : '{}'; } };
    };
    const res = await Api.request('/api/generate/projects', { method: 'GET' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(biz, 2);                       // 业务接口被调用两次（首401 + 重试）
    assert.strictEqual(Api.getToken(), 'new');        // 新 token 已落库
    assert.ok(calls.some(([u]) => u === '/api/auth/refresh'));
  });

  it('refresh 也失败 → 清空登录态并抛 AUTH_REQUIRED', async () => {
    Api.setSession({ accessToken: 'old', refreshToken: 'bad' });
    global.__route = () => ({ ok: false, status: 401, async text() { return '{}'; } });
    await assert.rejects(Api.request('/api/generate/projects', { message: 'AUTH_REQUIRED' }));
    assert.strictEqual(Api.isAuthed(), false);
    assert.strictEqual(Api.getToken(), null);
  });

  it('请求自动携带 Authorization 头', async () => {
    Api.setSession({ accessToken: 'tk' });
    global.__route = (u, o) => ({ ok: true, status: 200, async text() { return '{}'; } });
    await Api.request('/api/generate/projects');
    const [, opts] = calls[0];
    assert.strictEqual(opts.headers.Authorization, 'Bearer tk');
  });
});
