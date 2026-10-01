const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// v2.288：refresh 单飞 flight 不得绑定发起业务请求的 AbortSignal/timeout。
// 生成剧集（长任务 POST，唯一传 signal 的调用点 app.js L6099）若以 401 发起续期，
// 用户点「停止生成」abort 时，共享同一 flight 的并发 GET 会被连累：refresh 被 abort →
// flight 吞错返回 null → GET 落到二次 401 → clearSession + onAuthRequired（停止任务却登出）。
// 续期是全局凭证操作，生命周期独立于任一业务请求：refresh fetch 不传 signal/timeout（默认 30s 兜底）。
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

function abortErr() { const e = new Error('The operation was aborted.'); e.name = 'AbortError'; return e; }

describe('v2.288 refresh flight 与业务 signal 解耦', () => {
  let Api, calls, authRequiredHits;
  beforeEach(() => {
    Api = installEnv(); calls = []; authRequiredHits = 0;
    Api.onAuthRequired(() => { authRequiredHits += 1; });
    Api.onNetworkError(() => {});
    global.fetch = (url, opts = {}) => new Promise((resolve, reject) => {
      calls.push([url, opts]);
      // 对齐浏览器：aborted signal 立即/在途 reject
      if (opts.signal) {
        if (opts.signal.aborted) return reject(abortErr());
        opts.signal.addEventListener('abort', () => reject(abortErr()), { once: true });
      }
      const delay = url.endsWith('/api/auth/refresh') ? 50 : 1;
      setTimeout(() => {
        try { resolve(global.__route(url, opts)); } catch (e) { reject(e); }
      }, delay);
    });
  });

  it('flight 共享期间发起方 abort：业务 POST 得 AbortError，共享 GET 续期成功 200，不清会话不跳登录', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    const hits = { gen: 0, me: 0 };
    global.__route = (url) => {
      if (url.endsWith('/api/auth/refresh')) {
        return { ok: true, status: 200, async text() { return JSON.stringify({ accessToken: 'a2', refreshToken: 'rt2' }); } };
      }
      if (url.endsWith('/api/generate/episodes')) { hits.gen += 1; return { ok: false, status: 401, async text() { return '{}'; } }; }
      if (url.endsWith('/api/auth/me')) {
        hits.me += 1;
        const done = hits.me >= 2; // 首击 401（共享 flight），refresh 后重试 200
        return { ok: done, status: done ? 200 : 401, async text() { return JSON.stringify({ ok: 1 }); } };
      }
      return { ok: true, status: 200, async text() { return '{}'; } };
    };

    const ctrl = new AbortController();
    const pA = Api.request('/api/generate/episodes', { method: 'POST', body: '{}', signal: ctrl.signal, timeout: 999 })
      .then((r) => ({ kind: 'res', status: r.status }), (e) => ({ kind: 'err', name: e.name, code: e.code }));
    const pB = Api.request('/api/auth/me', {})
      .then((r) => ({ kind: 'res', status: r.status }), (e) => ({ kind: 'err', code: e.code }));
    await new Promise((r) => setTimeout(r, 20)); // 两 401 均已返回、共享同一在途 flight
    ctrl.abort(); // 用户点「停止生成」
    const [A, B] = await Promise.all([pA, pB]);

    assert.strictEqual(A.kind, 'err', 'POST 被取消须 reject');
    assert.strictEqual(A.name, 'AbortError', 'POST 得到取消语义（不是 AUTH_REQUIRED）');
    assert.strictEqual(B.kind, 'res', '共享 GET 不得被连累失败');
    assert.strictEqual(B.status, 200, '共享 GET 续期后重试成功');
    assert.strictEqual(authRequiredHits, 0, '业务 abort 绝不触发跳登录');
    assert.ok(Api.getToken(), '会话不得被 clearSession');
    assert.strictEqual(Api.getToken(), 'a2', '续期成功的新 token 正常落库');

    // 硬锚点：refresh 请求不得继承业务 signal（fetchWithTimeout 会注入内部超时 signal，
    // 故断言非同一对象且业务 abort 后仍未中止），也不继承业务 timeout
    const refreshOpts = calls.filter(([u]) => u.endsWith('/api/auth/refresh')).map(([, o]) => o);
    assert.strictEqual(refreshOpts.length, 1, '单飞：仅一次 /refresh');
    assert.ok(refreshOpts[0].signal, 'refresh 走 fetchWithTimeout 的内部超时 signal');
    assert.notStrictEqual(refreshOpts[0].signal, ctrl.signal, 'refresh signal 不得是业务 signal');
    assert.strictEqual(refreshOpts[0].signal.aborted, false, '业务 abort 后 refresh signal 不联动中止');
    assert.strictEqual(refreshOpts[0].timeout, undefined, 'refresh 不继承业务 timeout（用默认 30s）');
  });

  it('两个带 signal 持有者：仅一个 abort 不取消 flight，全部 abort 才取消，均保登录不跳登录', async () => {
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u' } });
    global.__route = (url) => {
      if (url.endsWith('/api/auth/refresh')) return new Promise(() => {}); // 永不返回，只等 flight abort
      return { ok: false, status: 401, async text() { return '{}'; } };
    };
    const c1 = new AbortController();
    const c2 = new AbortController();
    const p1 = Api.request('/api/generate/episodes', { method: 'POST', body: '{}', signal: c1.signal })
      .then((r) => ({ kind: 'res', status: r.status }), (e) => ({ kind: 'err', name: e.name }));
    const p2 = Api.request('/api/auth/me', { signal: c2.signal })
      .then((r) => ({ kind: 'res', status: r.status }), (e) => ({ kind: 'err', name: e.name }));
    await new Promise((r) => setTimeout(r, 20));
    const flightSignal = () => calls.filter(([u]) => u.endsWith('/api/auth/refresh'))[0][1].signal;
    assert.strictEqual(flightSignal().aborted, false);

    let p1Settled = false;
    p1.then(() => { p1Settled = true; });
    c1.abort();
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(flightSignal().aborted, false, '仍有健康持有者（c2），flight 继续');
    assert.strictEqual(p1Settled, false, 'p1 等待共享 flight，不因其自身 abort 提前结束');

    c2.abort();
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.strictEqual(flightSignal().aborted, true, '全部持有者取消 → flight 中止');
    assert.strictEqual(r1.kind, 'err'); assert.strictEqual(r1.name, 'AbortError');
    assert.strictEqual(r2.kind, 'err'); assert.strictEqual(r2.name, 'AbortError');
    assert.strictEqual(authRequiredHits, 0);
    assert.strictEqual(Api.getToken(), 'a1', 'flight 被取消不清会话（ensureActive 先于二次 401）');
    assert.strictEqual(calls.filter(([u]) => u.endsWith('/api/auth/refresh')).length, 1, '单飞：仅一次 /refresh');
  });
});
