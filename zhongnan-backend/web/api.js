/* 前端 API 层：token 持久化、自动带鉴权、access 过期时用 refresh 静默续期并重试一次。
 * v2.186 安全 + 响应加固：AbortController 超时、5xx 单次退避重试、AUTH_REQUIRED 全局钩子、网络/超时友好提示。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Api = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = { access: 'zn_token', refresh: 'zn_refresh', user: 'zn_user' };
  // 默认 30s 超时；长任务（生成/导出）由调用方传更长的 timeout
  const DEFAULT_TIMEOUT = 30000;
  // 5xx 重试退避（仅对幂等 GET / 网络错误重试，POST 不重试避免双扣费）
  const RETRY_BACKOFF_MS = 220;

  // 全局钩子：app.js 启动时注册，遇 AUTH_REQUIRED 自动跳登录、遇网络错误统一 toast
  const hooks = {
    onAuthRequired: null,        // () => void  鉴权失效时触发（由 app.js 跳登录页）
    onNetworkError: null,        // (err, path) => void  网络异常/超时时触发（由 app.js 弹 toast）
    onServerBusy: null,          // (res, path) => void  5xx 服务器忙
  };

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
    del(k) { localStorage.removeItem(k); },
  };
  function getToken() { return store.get(K.access); }
  function getUser() { return store.get(K.user); }
  function setSession({ accessToken, refreshToken, user }) {
    if (accessToken) store.set(K.access, accessToken);
    if (refreshToken) store.set(K.refresh, refreshToken);
    if (user) store.set(K.user, user);
  }
  function clearSession() { [K.access, K.refresh, K.user].forEach((k) => store.del(k)); }
  function isAuthed() { return !!getToken(); }

  // 带超时的 fetch：默认 30s，超时抛 TIMEOUT，触发 onNetworkError 钩子
  function fetchWithTimeout(path, opts, timeoutMs) {
    const t = timeoutMs || opts.timeout || DEFAULT_TIMEOUT;
    if (t <= 0) return fetch(path, opts); // 0 = 不超时（用于 SSE/长任务）
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), t);
    return fetch(path, Object.assign({}, opts, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  }

  async function raw(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const tk = getToken(); if (tk) headers.Authorization = 'Bearer ' + tk;
    return fetchWithTimeout(path, Object.assign({}, opts, { headers }), opts.timeout);
  }

  // 网络错误分类：超时 / 中断 / DNS 失败
  function isNetworkErr(e) {
    return e && (e.name === 'AbortError' || e.name === 'TypeError' || e.code === 'NETWORK_ERR');
  }
  function makeNetErr(path, e) {
    const err = new Error(e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERR');
    err.code = err.message; err.path = path; err.cause = e;
    return err;
  }

  // 401 → 用 refresh 换新 access 重试一次；仍失败则清登录态并抛 AUTH_REQUIRED
  async function request(path, opts = {}) {
    let res;
    try {
      res = await raw(path, opts);
    } catch (e) {
      // GET 类（无 body）+ 网络错误：单次退避重试一次（应对瞬时抖动）
      if (!opts.body && isNetworkErr(e)) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        try { res = await raw(path, opts); }
        catch (e2) { const ne = makeNetErr(path, e2); if (hooks.onNetworkError) try { hooks.onNetworkError(ne, path); } catch {} throw ne; }
      } else {
        const ne = makeNetErr(path, e);
        if (hooks.onNetworkError) try { hooks.onNetworkError(ne, path); } catch {}
        throw ne;
      }
    }

    // 401 → refresh 重试一次
    if (res.status === 401) {
      const rt = store.get(K.refresh);
      if (rt) {
        try {
          const rr = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
          if (rr.ok) {
            const txt = await rr.text();
            let d = null;
            try { d = txt ? JSON.parse(txt) : null; } catch { /* 网关返回非 JSON 时不得把整个请求链打崩 */ }
            if (d && d.accessToken) { store.set(K.access, d.accessToken); res = await raw(path, opts); }
          }
        } catch (e) { /* refresh 网络错误吞掉，落到下面 401 清登录态 */ }
      }
    }

    // 5xx 服务器忙：触发钩子（不重试 POST，避免双扣费）
    if (res.status >= 500 && res.status < 600 && !opts.body) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      try { res = await raw(path, opts); }
      catch (e) { /* 重试失败保留原 5xx res，下面 jsonOrThrow 会抛 */ }
      if (res.status >= 500 && hooks.onServerBusy) {
        try { hooks.onServerBusy(res, path); } catch {}
      }
    }

    if (res.status === 401) {
      clearSession();
      if (hooks.onAuthRequired) try { hooks.onAuthRequired(); } catch {}
      const e = new Error('AUTH_REQUIRED'); e.code = 'AUTH_REQUIRED'; throw e;
    }
    return res;
  }
  async function jsonOrThrow(res) {
    const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch {}
    if (!res.ok) {
      // 幂等撞车展示后端中文提示；其余错误仍以 error 码为 message，保留 e.error/e.code 供分支判断
      const friendly = d && d.error === 'IDEMPOTENT_REPLAY' ? (d.message || d.error)
        : (d && (d.error || d.message))
          || (res.status >= 500 ? 'SERVER_BUSY' : res.status >= 400 ? ('HTTP ' + res.status) : 'UNKNOWN');
      const e = new Error(friendly); if (d) Object.assign(e, d); e.httpStatus = res.status; throw e;
    }
    return d;
  }

  const auth = {
    async register(phone, password, inviteCode) {
      const body = { phone, password }; if (inviteCode) body.inviteCode = inviteCode;
      const res = await raw('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
      const d = await jsonOrThrow(res); setSession(d); return d;
    },
    async login(phone, password) {
      const res = await raw('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      const d = await jsonOrThrow(res); setSession(d); return d;
    },
    logout() { clearSession(); },
  };

  return {
    getToken, getUser, setSession, clearSession, isAuthed,
    request, jsonOrThrow, auth,
    // 钩子注册（app.js 启动时调用）
    onAuthRequired(fn) { hooks.onAuthRequired = fn; },
    onNetworkError(fn) { hooks.onNetworkError = fn; },
    onServerBusy(fn) { hooks.onServerBusy = fn; },
    // 直接 fetch（不带鉴权，少数特殊场景如 SSE 用）
    rawFetch: fetchWithTimeout,
    DEFAULT_TIMEOUT,
  };
});
