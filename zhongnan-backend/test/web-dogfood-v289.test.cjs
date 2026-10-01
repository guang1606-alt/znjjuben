const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// v2.289：localStorage 写失败（Safari 隐私模式/配额满 QuotaExceededError）不得打断会话。
// ①setSession（登录/注册落库）任一 key 写失败即整链 throw——服务端已登录成功，客户端却报错，
//   且 access 已写、user 未写的半截会话使 lastSeenUserJson 失真；
// ②refresh 轮换落库失败被 catch 吞成 null → 全部等待请求落二次 401 → clearSession+跳登录（误登出）。
// 正确语义：写失败降级为内存兜底（本会话页生命周期内可用，不持久化），setSession/续期照常完成。
function installEnv(brokenSet) {
  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      if (brokenSet) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      mem.set(k, String(v));
    },
    removeItem: (k) => mem.delete(k),
  };
  delete require.cache[require.resolve('../web/api.js')];
  return require('../web/api.js');
}

describe('v2.289 存储写失败内存兜底', () => {
  let Api, calls, authRequiredHits;
  beforeEach(() => { calls = []; authRequiredHits = 0; });

  it('登录落库时 setItem 抛 QuotaExceededError：登录照常成功，getToken/getUser 可读（内存兜底）', async () => {
    Api = installEnv(true);
    Api.onAuthRequired(() => { authRequiredHits += 1; });
    global.fetch = async (url) => {
      calls.push(url);
      return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } }); } };
    };
    const data = await Api.auth.login('18891995171', 'x'); // 修复前：此处同步 throw QuotaExceededError
    assert.strictEqual(data.accessToken, 'a1', '登录响应数据照常返回');
    assert.strictEqual(Api.getToken(), 'a1', 'token 可读（内存兜底）');
    assert.strictEqual(Api.getRefreshToken(), 'rt1', 'refresh 可读');
    assert.deepStrictEqual(Api.getUser(), { id: 'u' }, 'user 可读');
    assert.strictEqual(Api.isAuthed(), true);
    // 登录后业务请求带新 token 正常走通
    global.fetch = async (url, opts) => {
      assert.strictEqual(opts.headers.Authorization, 'Bearer a1');
      return { ok: true, status: 200, async text() { return '{"ok":1}'; } };
    };
    const res = await Api.request('/api/auth/me');
    assert.strictEqual(res.status, 200);
  });

  it('refresh 轮换落库失败：续期照常返回新 token，不误清会话不跳登录', async () => {
    Api = installEnv(true);
    Api.onAuthRequired(() => { authRequiredHits += 1; });
    Api.onNetworkError(() => {});
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    let meHits = 0;
    global.fetch = async (url) => {
      if (url.endsWith('/api/auth/refresh')) {
        return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a2', refreshToken: 'rt2' }); } };
      }
      meHits += 1;
      const done = meHits >= 2;
      return { ok: done, status: done ? 200 : 401, async text() { return '{}'; } };
    };
    const res = await Api.request('/api/auth/me');
    assert.strictEqual(res.status, 200, '续期后重试成功（修复前落库 throw→flight null→401→误登出）');
    assert.strictEqual(Api.getToken(), 'a2', '新 token 已生效（内存兜底）');
    assert.strictEqual(Api.getRefreshToken(), 'rt2', '轮换的新 refresh 已生效');
    assert.strictEqual(authRequiredHits, 0, '不得触发跳登录');
  });

  it('存储正常时行为不变：落 localStorage 而非内存兜底，跨重载可持久', async () => {
    Api = installEnv(false);
    global.fetch = async () => ({ ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } }); } });
    await Api.auth.login('18891995171', 'x');
    assert.strictEqual(JSON.parse(global.localStorage.getItem('zn_token')), 'a1', '正常环境仍写 localStorage');
  });
});
