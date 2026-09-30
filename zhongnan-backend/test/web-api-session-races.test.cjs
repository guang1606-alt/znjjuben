const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../web/api.js'), 'utf8');
const sessionA = { accessToken: 'access-a', refreshToken: 'refresh-a', user: { id: 'a' } };
const sessionB = { accessToken: 'access-b', refreshToken: 'refresh-b', user: { id: 'b' } };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(status, data = {}) {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data) };
}
function environment(route, options = {}) {
  const storage = new Map(), calls = [], timers = new Map();
  let nextTimer = 0;
  const context = {
    module: { exports: {} }, AbortController, AbortSignal: options.fallbackSignal ? {} : AbortSignal,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    fetch: (url, opts) => { calls.push({ url, opts }); return route(url, opts, calls.length); },
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(source, context, { filename: 'web/api.js' });
  const Api = context.module.exports;
  Api.setSession(sessionA);
  const hooks = { auth: 0, network: 0, busy: 0 };
  Api.onAuthRequired(() => hooks.auth++);
  Api.onNetworkError(() => hooks.network++);
  Api.onServerBusy(() => hooks.busy++);
  return {
    Api, calls, timers, hooks, storage,
    fireTimer(ms) {
      const entry = [...timers].find(([, timer]) => timer.ms === ms);
      assert.ok(entry, `expected ${ms}ms timer`);
      timers.delete(entry[0]); entry[1].callback();
    },
  };
}
async function flush() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
function keepB(env) {
  assert.equal(env.Api.getToken(), 'access-b');
  assert.equal(env.Api.getUser().id, 'b');
  assert.equal(JSON.parse(env.storage.get('zn_refresh')), 'refresh-b');
  assert.deepEqual(env.hooks, { auth: 0, network: 0, busy: 0 });
}
function expectSessionChange(promise) {
  return assert.rejects(promise, (error) => error.code === 'SESSION_CHANGED' && error.name === 'AbortError');
}

describe('API requests stay bound to the initiating login session', () => {
  it('late A 401 cannot refresh or replay an A POST with B credentials', async () => {
    const first = deferred();
    const env = environment((url) => url === '/api/auth/refresh'
      ? Promise.resolve(response(200, { accessToken: 'refreshed' }))
      : env.calls.length === 1 ? first.promise : Promise.resolve(response(200)));
    const pending = expectSessionChange(env.Api.request('/write', { method: 'POST', body: '{"projectId":"a"}' }));
    env.Api.setSession(sessionB); first.resolve(response(401));
    await pending;
    assert.equal(env.calls.length, 1); keepB(env);
  });

  for (const status of [200, 401]) {
    it(`late A refresh ${status} cannot overwrite or clear B`, async () => {
      const refresh = deferred();
      const env = environment((url) => url === '/api/auth/refresh' ? refresh.promise : Promise.resolve(response(401)));
      const pending = expectSessionChange(env.Api.request('/write', { method: 'POST', body: '{}' }));
      await flush();
      assert.equal(JSON.parse(env.calls[1].opts.body).refreshToken, 'refresh-a');
      env.Api.setSession(sessionB); refresh.resolve(response(status, { accessToken: 'late-access-a' }));
      await pending;
      assert.equal(env.calls.length, 2); keepB(env);
    });
  }

  it('switch during refresh JSON parsing cannot publish the old access token', async () => {
    const body = deferred();
    const env = environment((url) => Promise.resolve(url === '/api/auth/refresh'
      ? { ok: true, status: 200, text: () => body.promise } : response(401)));
    const pending = expectSessionChange(env.Api.request('/write', { method: 'POST', body: '{}' }));
    await flush(); env.Api.setSession(sessionB);
    body.resolve(JSON.stringify({ accessToken: 'late-access-a' }));
    await pending; assert.equal(env.calls.length, 2); keepB(env);
  });

  it('a late successful response is not delivered to a different account', async () => {
    const first = deferred(), env = environment(() => first.promise);
    const pending = expectSessionChange(env.Api.request('/private'));
    env.Api.setSession(sessionB); first.resolve(response(200, { private: 'a' }));
    await pending; keepB(env);
  });

  it('jsonOrThrow rejects A data that finishes parsing after switching to B', async () => {
    const body = deferred();
    const env = environment(() => Promise.resolve({ ...response(200), text: () => body.promise }));
    const res = await env.Api.request('/private');
    const pending = expectSessionChange(env.Api.jsonOrThrow(res));
    env.Api.setSession(sessionB); body.resolve(JSON.stringify({ secret: 'a' }));
    await pending; keepB(env);
  });

  for (const failure of ['network', 'server']) {
    it(`a ${failure} retry stops when the login changes during backoff`, async () => {
      const env = environment(() => env.calls.length === 1
        ? failure === 'network' ? Promise.reject(new TypeError('offline')) : Promise.resolve(response(503))
        : Promise.resolve(response(200)));
      const pending = expectSessionChange(env.Api.request('/private'));
      await flush(); env.Api.setSession(sessionB); env.fireTimer(220);
      await pending; assert.equal(env.calls.length, 1); keepB(env);
    });
  }

  it('logout then login with identical tokens still cancels the old request', async () => {
    const first = deferred(), env = environment(() => first.promise);
    const pending = expectSessionChange(env.Api.request('/private'));
    env.Api.clearSession(); env.Api.setSession(sessionA); first.resolve(response(200));
    await pending; assert.equal(env.Api.getToken(), 'access-a'); assert.equal(env.hooks.auth, 0);
  });

  it('detects a different account written to shared storage by another tab', async () => {
    const first = deferred(), env = environment(() => first.promise);
    const pending = expectSessionChange(env.Api.request('/private'));
    env.storage.set('zn_token', JSON.stringify(sessionB.accessToken));
    env.storage.set('zn_refresh', JSON.stringify(sessionB.refreshToken));
    env.storage.set('zn_user', JSON.stringify(sessionB.user));
    first.resolve(response(401)); await pending; assert.equal(env.calls.length, 1); keepB(env);
  });

  it('without a refresh token, an external access token replacement cancels the old request', async () => {
    const first = deferred(), env = environment(() => first.promise);
    env.Api.clearSession(); env.Api.setSession({ accessToken: 'access-a' });
    const pending = expectSessionChange(env.Api.request('/private'));
    env.storage.set('zn_token', JSON.stringify('access-b')); first.resolve(response(401));
    await pending; assert.equal(env.calls.length, 1); assert.equal(env.Api.getToken(), 'access-b');
    assert.equal(env.hooks.auth, 0);
  });

  it('another same-session refresh does not cancel a concurrent successful request', async () => {
    const first = deferred();
    const env = environment((url, opts, count) => count === 1 ? first.promise : Promise.resolve(url === '/api/auth/refresh'
      ? response(200, { accessToken: 'new-access-a' }) : response(count === 2 ? 401 : 200)));
    const concurrent = env.Api.request('/slow');
    assert.equal((await env.Api.request('/expired')).status, 200);
    first.resolve(response(200)); assert.equal((await concurrent).status, 200);
    assert.equal(env.Api.getToken(), 'new-access-a'); assert.equal(env.hooks.auth, 0);
  });

  it('two concurrent refreshes belonging to one login share a single flight', async () => {
    const refresh = deferred(), attempts = new Map();
    const env = environment((url) => {
      if (url === '/api/auth/refresh') return refresh.promise;
      const count = (attempts.get(url) || 0) + 1; attempts.set(url, count);
      return Promise.resolve(response(count === 1 ? 401 : 200));
    });
    const first = env.Api.request('/one'), second = env.Api.request('/two');
    await flush();
    assert.equal(env.calls.filter((c) => c.url === '/api/auth/refresh').length, 1, '并发 401 必须共享同一次续期调用');
    refresh.resolve(response(200, { accessToken: 'fresh-a' }));
    assert.equal((await second).status, 200);
    assert.equal((await first).status, 200);
    assert.equal(env.Api.getToken(), 'fresh-a');
    assert.equal(env.Api.getUser().id, 'a');
    assert.equal(attempts.get('/one'), 2); assert.equal(attempts.get('/two'), 2);
    assert.equal(env.hooks.auth, 0);
  });

  it('a late final 401 from A replay cannot clear B', async () => {
    const replay = deferred();
    const env = environment((url, opts, count) => count === 3 ? replay.promise : Promise.resolve(url === '/api/auth/refresh'
      ? response(200, { accessToken: 'new-access-a' }) : response(401)));
    const pending = expectSessionChange(env.Api.request('/write', { method: 'POST', body: '{}' }));
    await flush(); assert.equal(env.calls.length, 3);
    env.Api.setSession(sessionB); replay.resolve(response(401)); await pending; keepB(env);
  });

  it('same-session refresh still retries the original request with its new access token', async () => {
    const env = environment((url, opts, call) => Promise.resolve(url === '/api/auth/refresh'
      ? response(200, { accessToken: 'new-access-a' }) : response(call === 1 ? 401 : 200)));
    assert.equal((await env.Api.request('/private', { method: 'POST', body: '{}' })).status, 200);
    assert.equal(env.calls[0].opts.headers.Authorization, 'Bearer access-a');
    assert.equal(env.calls[2].opts.headers.Authorization, 'Bearer new-access-a');
    assert.equal(env.Api.getToken(), 'new-access-a'); assert.equal(env.Api.getUser().id, 'a');
    assert.deepEqual(env.hooks, { auth: 0, network: 0, busy: 0 });
  });

  it('same-session invalid refresh still clears authentication once', async () => {
    const env = environment(() => Promise.resolve(response(401)));
    await assert.rejects(env.Api.request('/private'), { code: 'AUTH_REQUIRED' });
    assert.equal(env.Api.isAuthed(), false); assert.equal(env.Api.getUser(), null);
    assert.equal(env.hooks.auth, 1);
  });
});

describe('authentication attempts cannot overwrite a newer user choice', () => {
  for (const olderMethod of ['login', 'register']) {
    for (const newerMethod of ['login', 'register']) {
      it(`late ${olderMethod} A cannot overwrite newer ${newerMethod} B`, async () => {
        const oldResponse = deferred();
        const env = environment((url, opts, count) => count === 1 ? oldResponse.promise : Promise.resolve(response(200, sessionB)));
        env.Api.clearSession();
        const oldAttempt = expectSessionChange(env.Api.auth[olderMethod]('phone-a', 'password-a'));
        assert.equal((await env.Api.auth[newerMethod]('phone-b', 'password-b')).user.id, 'b');
        oldResponse.resolve(response(200, sessionA)); await oldAttempt;
        keepB(env); assert.equal(env.calls.length, 2);
      });
    }
  }

  it('an older attempt cannot log in even while the newest attempt is still pending', async () => {
    const oldResponse = deferred(), newResponse = deferred();
    const env = environment((url, opts, count) => count === 1 ? oldResponse.promise : newResponse.promise);
    env.Api.clearSession();
    const oldAttempt = expectSessionChange(env.Api.auth.login('phone-a', 'password-a'));
    const newAttempt = env.Api.auth.login('phone-b', 'password-b');
    oldResponse.resolve(response(200, sessionA)); await oldAttempt;
    assert.equal(env.Api.isAuthed(), false);
    newResponse.resolve(response(200, sessionB)); await newAttempt; keepB(env);
  });

  for (const method of ['login', 'register']) {
    it(`logout cancels a pending ${method} instead of signing back in`, async () => {
      const pendingResponse = deferred(), env = environment(() => pendingResponse.promise);
      const pending = expectSessionChange(env.Api.auth[method]('phone-a', 'password-a'));
      env.Api.auth.logout(); pendingResponse.resolve(response(200, sessionA)); await pending;
      assert.equal(env.Api.isAuthed(), false); assert.equal(env.Api.getUser(), null);
      assert.deepEqual(env.hooks, { auth: 0, network: 0, busy: 0 });
    });
  }

  it('an authentication body completing after a session replacement cannot commit', async () => {
    const body = deferred();
    const env = environment(() => Promise.resolve({ ...response(200), text: () => body.promise }));
    const pending = expectSessionChange(env.Api.auth.login('phone-a', 'password-a'));
    await flush(); env.Api.setSession(sessionB); body.resolve(JSON.stringify(sessionA));
    await pending; keepB(env);
  });

  it('a failed latest attempt does not revive an older successful attempt', async () => {
    const oldResponse = deferred();
    const env = environment((url, opts, count) => count === 1 ? oldResponse.promise
      : Promise.resolve(response(401, { error: 'INVALID_CREDENTIALS' })));
    env.Api.clearSession();
    const oldAttempt = expectSessionChange(env.Api.auth.login('phone-a', 'password-a'));
    await assert.rejects(env.Api.auth.login('phone-b', 'wrong'), { message: 'INVALID_CREDENTIALS' });
    oldResponse.resolve(response(200, sessionA)); await oldAttempt;
    assert.equal(env.Api.isAuthed(), false);
  });

  it('an old network failure is reported as cancellation after a newer login', async () => {
    const oldResponse = deferred();
    const env = environment((url, opts, count) => count === 1 ? oldResponse.promise : Promise.resolve(response(200, sessionB)));
    const oldAttempt = expectSessionChange(env.Api.auth.login('phone-a', 'password-a'));
    await env.Api.auth.login('phone-b', 'password-b');
    oldResponse.reject(new TypeError('offline')); await oldAttempt; keepB(env);
  });
});

describe('API cancellation and retry safety', () => {
  for (const fallbackSignal of [false, true]) {
    it(`caller abort still reaches an SSE body after response headers (${fallbackSignal ? 'fallback' : 'native'})`, async () => {
      const env = environment(() => Promise.resolve({ ...response(200), body: {} }), { fallbackSignal });
      const ctrl = new AbortController();
      await env.Api.request('/stream', { method: 'POST', body: '{}', signal: ctrl.signal });
      const transportSignal = env.calls[0].opts.signal;
      assert.equal(transportSignal.aborted, false); assert.equal(env.timers.size, 0);
      ctrl.abort(); assert.equal(transportSignal.aborted, true);
    });
  }

  it('intentional cancellation before headers does not retry or trigger a network toast', async () => {
    const ctrl = new AbortController();
    const env = environment((url, opts) => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
    }));
    const pending = assert.rejects(env.Api.request('/private', { signal: ctrl.signal }), { name: 'AbortError' });
    ctrl.abort(); await pending;
    assert.equal(env.calls.length, 1); assert.equal(env.hooks.network, 0); assert.equal(env.timers.size, 0);
  });

  it('an already cancelled request does not reach fetch', async () => {
    const ctrl = new AbortController(); ctrl.abort();
    const env = environment(() => Promise.resolve(response(200)));
    await assert.rejects(env.Api.request('/private', { signal: ctrl.signal }), { name: 'AbortError' });
    assert.equal(env.calls.length, 0); assert.equal(env.hooks.network, 0);
  });

  it('cancelling while refresh is pending stops the refresh and preserves login', async () => {
    const ctrl = new AbortController();
    const env = environment((url, opts) => url === '/api/auth/refresh'
      ? new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true }))
      : Promise.resolve(response(401)));
    const pending = assert.rejects(env.Api.request('/private', { signal: ctrl.signal }), { name: 'AbortError' });
    await flush(); assert.equal(env.calls.length, 2);
    ctrl.abort(); await pending;
    assert.equal(env.calls[1].opts.signal.aborted, true); assert.equal(env.Api.getToken(), 'access-a');
    assert.deepEqual(env.hooks, { auth: 0, network: 0, busy: 0 });
  });

  it('timeout 0 keeps streaming requests unlimited and preserves caller cancellation', async () => {
    const ctrl = new AbortController(), env = environment(() => Promise.resolve(response(200)));
    await env.Api.rawFetch('/stream', { signal: ctrl.signal, timeout: 0 });
    assert.equal(env.calls[0].opts.signal, ctrl.signal);
    assert.equal(env.timers.size, 0);
  });

  it('real transport timeouts remain TIMEOUT errors and notify once', async () => {
    const env = environment((url, opts) => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
    }));
    const pending = assert.rejects(env.Api.request('/write', { method: 'POST', body: '{}', timeout: 123 }), { code: 'TIMEOUT' });
    env.fireTimer(123); await pending;
    assert.equal(env.hooks.network, 1); assert.equal(env.calls.length, 1); assert.equal(env.timers.size, 0);
  });

  for (const failure of ['network', 'server']) {
    it(`a bodyless POST is never repeated after ${failure} failure`, async () => {
      const env = environment(() => failure === 'network' ? Promise.reject(new TypeError('offline')) : Promise.resolve(response(503)));
      const operation = env.Api.request('/charge', { method: 'POST' });
      if (failure === 'network') await assert.rejects(operation, { code: 'NETWORK_ERR' });
      else assert.equal((await operation).status, 503);
      assert.equal(env.calls.length, 1); assert.equal(env.timers.size, 0);
    });
  }
});
