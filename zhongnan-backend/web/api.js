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
  // 跨标签页同步参照：本页最后确认过的 user JSON（storage 事件据此区分「他页换号」与「同账号轮换」）
  let lastSeenUserJson = null;
  let sessionVersion = 0;
  let authAttemptVersion = 0;
  const responseSessions = new WeakMap();
  function getToken() { return store.get(K.access); }
  function getUser() { return store.get(K.user); }
  function getRefreshToken() { return store.get(K.refresh); }
  function setSession({ accessToken, refreshToken, user }) {
    sessionVersion++;
    if (accessToken) store.set(K.access, accessToken);
    if (refreshToken) store.set(K.refresh, refreshToken);
    if (user) store.set(K.user, user);
    lastSeenUserJson = JSON.stringify(getUser());
  }
  function clearSession() {
    sessionVersion++;
    [K.access, K.refresh, K.user].forEach((k) => store.del(k));
    lastSeenUserJson = null;
  }
  function isAuthed() { return !!getToken(); }

  function sessionSnapshot() {
    return { version: sessionVersion, access: getToken(), refresh: store.get(K.refresh), user: JSON.stringify(getUser()) };
  }
  function sessionChangedError() {
    const err = new Error('SESSION_CHANGED'); err.code = 'SESSION_CHANGED'; err.name = 'AbortError'; return err;
  }
  function sessionMatches(snapshot) {
    // 同一账号并发续期允许 access 变化；登录/退出代次和持久化身份仍须一致。
    // 轮换（同一账号 refresh token 合法更新 rt1→rt2）不视为会话切换：只比对「有无 refresh」状态——
    // 换号由 user 比对兜底，登出由「快照有而当前无」捕获。
    const accessChangedWithoutRefresh = !snapshot.refresh && getToken() !== snapshot.access;
    const refreshPresenceChanged = !!snapshot.refresh !== !!store.get(K.refresh);
    return sessionVersion === snapshot.version && !refreshPresenceChanged &&
      JSON.stringify(getUser()) === snapshot.user && !accessChangedWithoutRefresh;
  }
  function assertSameSession(snapshot) {
    if (!sessionMatches(snapshot)) throw sessionChangedError();
  }

  function abortError() {
    const err = new Error('ABORTED'); err.name = 'AbortError'; err.code = 'ABORTED'; return err;
  }

  // 带超时的 fetch：默认 30s，超时抛 TIMEOUT，触发 onNetworkError 钩子
  async function fetchWithTimeout(path, opts = {}, timeoutMs) {
    const t = timeoutMs ?? opts.timeout ?? DEFAULT_TIMEOUT;
    if (opts.signal && opts.signal.aborted) return Promise.reject(abortError());
    if (t <= 0) return fetch(path, opts); // 0 = 不超时（用于 SSE/长任务）
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, t);
    let signal = ctrl.signal;
    if (opts.signal) {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
        signal = AbortSignal.any([opts.signal, ctrl.signal]);
      } else {
        // 不能在收到响应头时移除监听：SSE 的 body 仍须响应调用方取消。
        opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
      }
    }
    try { return await fetch(path, Object.assign({}, opts, { signal })); }
    catch (e) { if (timedOut) { const err = new Error('TIMEOUT'); err.code = 'TIMEOUT'; throw err; } throw e; }
    finally { clearTimeout(timer); }
  }

  async function raw(path, opts = {}, token = getToken()) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetchWithTimeout(path, Object.assign({}, opts, { headers }), opts.timeout);
  }

  // 网络错误分类：超时 / 中断 / DNS 失败
  function isNetworkErr(e) {
    return e && (e.name === 'AbortError' || e.name === 'TypeError' || e.code === 'NETWORK_ERR' || e.code === 'TIMEOUT');
  }
  function makeNetErr(path, e) {
    const err = new Error(e.code === 'TIMEOUT' || e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERR');
    err.code = err.message; err.path = path; err.cause = e;
    return err;
  }

  // 401 → 用 refresh 换新 access 重试一次；仍失败则清登录态并抛 AUTH_REQUIRED
  // /refresh 单飞：并发 401 共享同一次续期（配合后端轮换的一次性消费语义，避免并发重复调用被判重放）。
  // 同一账号在途共享；跨账号（user 不同）各开各的 flight。
  // v2.288 flight 取消语义=持有者组合：续期是所有并发 401 请求的共享操作，不属于任一发起者——
  // ①旧契约（v2.186，web-api-session-races）：唯一持有者 abort 时连其 refresh 一起取消（随后
  //   ensureActive 把结果转 AbortError，不清会话不跳登录）；
  // ②新修：持有者中只要还有一个未取消（无 signal 的 GET 视为不可取消），flight 继续——否则长任务
  //   POST（生成剧集，唯一传 signal 的调用点）在 refresh 在途被「停止」abort，会把共享 flight 的
  //   并发 GET 连累成二次 401→清会话跳登录；
  // ③全部持有者均 abort 时才中止 flight。timeout 不继承任一业务请求，续期统一走默认 30s 预算。
  let refreshFlight = null; // { key, promise, done, ctrl, holders }
  function joinRefreshFlight(flight, signal) {
    if (!signal) { flight.holders.push(null); return; } // null=无 signal 持有者：永不要求取消
    if (signal.aborted) { flight.holders.push({ dead: true }); reevalRefreshFlight(flight); return; }
    const holder = { dead: false };
    holder.onAbort = () => { holder.dead = true; reevalRefreshFlight(flight); };
    signal.addEventListener('abort', holder.onAbort, { once: true });
    flight.holders.push(holder);
  }
  function reevalRefreshFlight(flight) {
    if (flight.done || flight.ctrl.signal.aborted) return;
    const anyAlive = flight.holders.some((h) => h === null || !h.dead);
    if (!anyAlive) flight.ctrl.abort();
  }
  function refreshSession(snapshot, opts) {
    const rtNow = store.get(K.refresh);
    if (!rtNow) return Promise.resolve(null);
    const key = snapshot.user || '';
    if (refreshFlight && !refreshFlight.done && refreshFlight.key === key) {
      joinRefreshFlight(refreshFlight, opts && opts.signal);
      return refreshFlight.promise;
    }
    const flight = { key, promise: null, done: false, ctrl: new AbortController(), holders: [] };
    joinRefreshFlight(flight, opts && opts.signal);
    flight.promise = (async () => {
      try {
        const rr = await fetchWithTimeout('/api/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rtNow }), signal: flight.ctrl.signal,
        });
        if (!rr || !rr.ok) return null;
        const txt = await rr.text();
        let d = null;
        try { d = txt ? JSON.parse(txt) : null; } catch { /* 网关返回非 JSON 时不得把整个请求链打崩 */ }
        if (!d || !d.accessToken) return null;
        // 迟到的旧会话响应不得写入 store（期间可能已登出/换号，B 的登录态不可被 A 的响应覆盖）
        if (!sessionMatches(snapshot)) return null;
        store.set(K.access, d.accessToken);
        if (d.refreshToken) store.set(K.refresh, d.refreshToken); // 轮换：持久化新 refreshToken（旧值即刻作废）
        return d;
      } catch { return null; } // refresh 网络错误吞掉，调用方落到 401 清登录态
      finally { flight.done = true; }
    })();
    refreshFlight = flight;
    return flight.promise;
  }

  // 跨标签页会话同步：storage 事件只在「其他标签页」修改时触发（同页写入不触发，天然区分本页操作）。
  // 他页登出 → 立即清本页登录态并触发 onAuthRequired（sessionVersion++ 使在途请求全部 SESSION_CHANGED）；
  // 他页登录/换号 → 触发 onSessionRemoteChange（app.js 刷新用户态；未挂钩子则下次请求自然适配）；
  // 他页同账号 token 轮换（J 轮轮换机制的伴生场景）→ 静默：本页请求直读最新 token，无需打扰。
  function bindCrossTabSync() {
    if (typeof addEventListener !== 'function') return; // 非浏览器环境（node 测试/SSR）直接跳过
    addEventListener('storage', (e) => {
      if (!e || (e.key !== K.access && e.key !== K.refresh && e.key !== K.user)) return;
      if (!getToken() && !getRefreshToken() && !getUser()) {
        if (lastSeenUserJson === null) return; // 本页本就未登录，无需重复通知
        clearSession(); // 幂等清理（保证 version 递增使在途请求失效）
        try { if (hooks.onAuthRequired) hooks.onAuthRequired(); } catch {}
        return;
      }
      const userJson = JSON.stringify(getUser());
      if (userJson !== lastSeenUserJson) {
        lastSeenUserJson = userJson;
        if (userJson && userJson !== 'null') {
          try { if (hooks.onSessionRemoteChange) hooks.onSessionRemoteChange({ user: getUser() }); } catch {}
        }
      }
    });
  }
  bindCrossTabSync();

  async function request(path, opts = {}) {
    const session = sessionSnapshot();
    const mayRetry = !opts.body && ['GET', 'HEAD'].includes((opts.method || 'GET').toUpperCase());
    function ensureActive() {
      assertSameSession(session);
      if (opts.signal && opts.signal.aborted) throw abortError();
    }
    function networkFailure(e) {
      ensureActive();
      const ne = makeNetErr(path, e);
      if (hooks.onNetworkError) try { hooks.onNetworkError(ne, path); } catch {}
      throw ne;
    }
    let res;
    try {
      res = await raw(path, opts, session.access);
    } catch (e) {
      // GET 类（无 body）+ 网络错误：单次退避重试一次（应对瞬时抖动）
      ensureActive();
      if (mayRetry && isNetworkErr(e)) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        ensureActive();
        try { res = await raw(path, opts, getToken()); }
        catch (e2) { networkFailure(e2); }
      } else {
        networkFailure(e);
      }
    }
    ensureActive();

    // 401 → 单飞 refresh（并发共享一次），成功后用 store 最新 token 重试一次
    if (res.status === 401) {
      const d = await refreshSession(session, opts);
      ensureActive();
      if (d) {
        res = await raw(path, opts, getToken());
        ensureActive();
      }
    }
    ensureActive();

    // 5xx 服务器忙：触发钩子（不重试 POST，避免双扣费）
    if (res.status >= 500 && res.status < 600 && mayRetry) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      ensureActive();
      try { res = await raw(path, opts, getToken()); }
      catch (e) { /* 重试失败保留原 5xx res，下面 jsonOrThrow 会抛 */ }
      ensureActive();
      if (res.status >= 500 && hooks.onServerBusy) {
        try { hooks.onServerBusy(res, path); } catch {}
      }
    }

    if (res.status === 401) {
      ensureActive();
      clearSession();
      if (hooks.onAuthRequired) try { hooks.onAuthRequired(); } catch {}
      const e = new Error('AUTH_REQUIRED'); e.code = 'AUTH_REQUIRED'; throw e;
    }
    responseSessions.set(res, session);
    return res;
  }
  // v2.226 错误信息脱敏回落层：后端内部裸码（INTERNAL_ERROR / SERVER_BUSY / 无 body 的 5xx）不再直达用户，
  // 统一回落本地双语友好文案；e.error 保留原码、e.httpStatus 保留状态码，调用方分支判断不受影响。
  function znLangEn() {
    try { return (typeof localStorage !== 'undefined' && localStorage.getItem('zn_lang')) === 'en'; }
    catch { return false; }
  }
  function serverFailText(en) { return en ? 'Server hiccup — please try again later.' : '服务开小差了，请稍后重试'; }

  async function jsonOrThrow(res) {
    const session = responseSessions.get(res);
    if (session) assertSameSession(session);
    const t = await res.text();
    if (session) assertSameSession(session);
    let d = null; try { d = t ? JSON.parse(t) : null; } catch {}
    if (!res.ok) {
      const isServerFail = res.status >= 500;
      const rawCode = (d && (d.error || d.message)) || null;
      // 幂等撞车展示后端中文提示；内部裸码回落友好文案；其余错误仍以 error 码为 message
      const internalCode = d && (d.error === 'INTERNAL_ERROR' || d.error === 'SERVER_BUSY');
      const noBody5xx = isServerFail && !rawCode;
      const friendly = d && d.error === 'IDEMPOTENT_REPLAY' ? (d.message || d.error)
        : (internalCode || noBody5xx) ? serverFailText(znLangEn())
          : rawCode || (res.status >= 500 ? 'SERVER_BUSY' : res.status >= 400 ? ('HTTP ' + res.status) : 'UNKNOWN');
      const e = new Error(friendly); if (d) Object.assign(e, d); e.httpStatus = res.status;
      if (isServerFail && !e.error) e.error = 'SERVER_BUSY'; // 无 body 时也保证 e.error 原码可分支
      throw e;
    }
    return d;
  }

  async function authenticate(path, body) {
    const attempt = ++authAttemptVersion;
    const session = sessionSnapshot();
    function ensureCurrentAttempt() {
      assertSameSession(session);
      if (attempt !== authAttemptVersion) throw sessionChangedError();
    }
    let data;
    try {
      const res = await raw(path, { method: 'POST', body: JSON.stringify(body) }, session.access);
      ensureCurrentAttempt();
      data = await jsonOrThrow(res);
      ensureCurrentAttempt();
    } catch (e) { ensureCurrentAttempt(); throw e; }
    // 登录/注册共用代次：只有最后发起的操作可以写入会话，退出同样使旧操作失效。
    setSession(data);
    return data;
  }

  const auth = {
    async register(phone, password, inviteCode) {
      const body = { phone, password }; if (inviteCode) body.inviteCode = inviteCode;
      return authenticate('/api/auth/register', body);
    },
    async login(phone, password) {
      return authenticate('/api/auth/login', { phone, password });
    },
    async logout() {
      // 登出即吊销：先清本地（立即生效），再通知后端作废 refresh token（fire-and-forget，失败由 TTL 自然过期兜底）
      const rt = getRefreshToken();
      clearSession();
      if (rt) {
        try {
          await fetchWithTimeout('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }), timeout: 5000 });
        } catch { /* 后端不可达不阻塞本地登出 */ }
      }
    },
    async changePassword(currentPassword, newPassword) {
      // v2.214 自助改密：后端复用统一密码策略；成功后由调用方清会话强制重新登录
      const res = await request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      return jsonOrThrow(res);
    },
  };

  return {
    getToken, getUser, getRefreshToken, setSession, clearSession, isAuthed,
    request, jsonOrThrow, auth,
    // 钩子注册（app.js 启动时调用）
    onAuthRequired(fn) { hooks.onAuthRequired = fn; },
    onNetworkError(fn) { hooks.onNetworkError = fn; },
    onServerBusy(fn) { hooks.onServerBusy = fn; },
    // 他页登录/换号通知（跨标签页同步）
    onSessionRemoteChange(fn) { hooks.onSessionRemoteChange = fn; },
    // 直接 fetch（不带鉴权，少数特殊场景如 SSE 用）
    rawFetch: fetchWithTimeout,
    DEFAULT_TIMEOUT,
  };
});
