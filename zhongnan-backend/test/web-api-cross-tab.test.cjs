const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// 沙箱环境：提供 addEventListener 以捕获跨标签页 storage 事件监听
function installEnv() {
  const mem = new Map();
  const listeners = [];
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  global.__storageListeners = listeners;
  global.addEventListener = (type, fn) => { if (type === 'storage') listeners.push(fn); };
  global.dispatchEvent = (ev) => listeners.slice().forEach((fn) => fn(ev));
  delete require.cache[require.resolve('../web/api.js')];
  return require('../web/api.js');
}

function storageEvent(key, newValue, oldValue) {
  return { key, newValue, oldValue };
}

describe('跨标签页会话同步（storage 事件）', () => {
  let Api, hooks;
  beforeEach(() => {
    Api = installEnv();
    hooks = { auth: 0, remote: [] };
    Api.onAuthRequired(() => hooks.auth++);
    Api.onSessionRemoteChange((snap) => hooks.remote.push(snap));
  });

  const login = () => Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u1', nickname: '甲' } });

  it('他页登出：清空存储 → 本页立即触发 onAuthRequired 并清登录态', () => {
    login();
    assert.ok(Api.isAuthed());
    // 模拟另一个标签页登出（removeItem 后派发 storage 事件）
    global.localStorage.removeItem('zn_token');
    global.localStorage.removeItem('zn_refresh');
    global.localStorage.removeItem('zn_user');
    global.dispatchEvent(storageEvent('zn_token', null, '"a1"'));
    assert.strictEqual(hooks.auth, 1, '他页登出必须立即通知本页');
    assert.strictEqual(Api.isAuthed(), false, '本页登录态同步清空');
  });

  it('他页登录/换号：user 变化 → 触发 onSessionRemoteChange 并同步登录态', () => {
    login();
    global.localStorage.setItem('zn_token', JSON.stringify('b1'));
    global.localStorage.setItem('zn_refresh', JSON.stringify('rt-b'));
    global.localStorage.setItem('zn_user', JSON.stringify({ id: 'u2', nickname: '乙' }));
    global.dispatchEvent(storageEvent('zn_user', '{"id":"u2"}', '{"id":"u1"}'));
    assert.strictEqual(hooks.remote.length, 1, '他页换号必须通知本页');
    assert.strictEqual(hooks.remote[0].user.id, 'u2');
    assert.strictEqual(hooks.auth, 0, '换号不是登出，不触发 onAuthRequired');
    assert.strictEqual(Api.getUser().id, 'u2', '本页读取到新账号');
  });

  it('他页同账号 token 轮换：user 不变 → 静默，不触发任何钩子', () => {
    login();
    global.localStorage.setItem('zn_token', JSON.stringify('a1-rotated'));
    global.localStorage.setItem('zn_refresh', JSON.stringify('rt1-rotated'));
    global.dispatchEvent(storageEvent('zn_token', '"a1-rotated"', '"a1"'));
    global.dispatchEvent(storageEvent('zn_refresh', '"rt1-rotated"', '"rt1"'));
    assert.strictEqual(hooks.auth, 0);
    assert.strictEqual(hooks.remote.length, 0, '同账号轮换无需打扰');
    assert.strictEqual(Api.getToken(), 'a1-rotated', '本页请求天然直读最新 token');
  });

  it('无关键值变化（其他 storage key）不触发', () => {
    login();
    global.dispatchEvent(storageEvent('other_key', 'x', 'y'));
    assert.strictEqual(hooks.auth, 0);
    assert.strictEqual(hooks.remote.length, 0);
  });
});
