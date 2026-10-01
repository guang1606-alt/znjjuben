const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// v2.290 dogfood 第二十八轮：storage 事件 × memStore 降级交叉面
// 缺口1：他页 localStorage.clear()（key=null）被忽略——降级页 memStore 里的活会话+refreshToken
//        会把用户刚清掉的会话「复活」；非降级页也无登出同步。
// 缺口2：降级页他页同账号轮换 token 后，本页 getToken 仍读 memStore 旧值 → 401 → 用废 rt 续期被拒 → 误踢下线。
// 修法：storage 事件命中的 key（clear 时三键）先 memStore.delete 失效副本，再走原有判断。

// 沙箱：quotaFailed=true 时 setItem 抛 QuotaExceededError（模拟配额满/隐私模式写失败降级）；
// __lsMap 直改用于模拟「另一个标签页」的写入/清空（他页不受本页降级影响）。
function installEnv({ quotaFailed = false } = {}) {
  const mem = new Map();
  const listeners = [];
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      if (quotaFailed) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      mem.set(k, String(v));
    },
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  global.__lsMap = mem;
  global.addEventListener = (type, fn) => { if (type === 'storage') listeners.push(fn); };
  global.dispatchEvent = (ev) => listeners.slice().forEach((fn) => fn(ev));
  delete require.cache[require.resolve('../web/api.js')];
  return require('../web/api.js');
}

describe('v2.290 storage 事件 × memStore 降级交叉面', () => {
  let Api, hooks;
  beforeEach(() => {
    hooks = { auth: 0, remote: [] };
  });
  const bind = () => {
    Api.onAuthRequired(() => hooks.auth++);
    Api.onSessionRemoteChange((snap) => hooks.remote.push(snap));
  };

  it('缺口2：降级页他页同账号轮换 → 本页 memStore 副本失效，直读新 token，不打扰', () => {
    Api = installEnv({ quotaFailed: true });
    bind();
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u1' } });
    assert.strictEqual(Api.getToken(), 'a1', '降级环境会话在 memStore');
    assert.strictEqual(global.__lsMap.has('zn_token'), false, 'localStorage 写失败无落盘');
    // 他页（未降级）轮换：localStorage 写入新值并派事件
    global.__lsMap.set('zn_token', JSON.stringify('a2'));
    global.__lsMap.set('zn_refresh', JSON.stringify('rt2'));
    global.dispatchEvent({ key: 'zn_token', newValue: '"a2"', oldValue: '"a1"' });
    global.dispatchEvent({ key: 'zn_refresh', newValue: '"rt2"', oldValue: '"rt1"' });
    assert.strictEqual(Api.getToken(), 'a2', 'memStore 旧副本必须失效，直读他页轮换后的新 token');
    assert.strictEqual(Api.getRefreshToken(), 'rt2', 'refresh 同步轮换，避免用废 rt 续期被踢下线');
    assert.strictEqual(hooks.auth, 0, '同账号轮换不触发登出');
    assert.strictEqual(hooks.remote.length, 0, '同账号轮换不触发换号通知');
  });

  it('缺口1：他页 clear()（key=null）→ 非降级页同步登出', () => {
    Api = installEnv();
    bind();
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u1' } });
    assert.ok(Api.isAuthed());
    global.__lsMap.clear();
    global.dispatchEvent({ key: null, newValue: null, oldValue: null });
    assert.strictEqual(hooks.auth, 1, 'clear() 是显式清站点数据，必须按登出同步本页');
    assert.strictEqual(Api.isAuthed(), false);
  });

  it('缺口1+2 叠加：降级页他页 clear() → memStore 会话一并清除，不得复活', () => {
    Api = installEnv({ quotaFailed: true });
    bind();
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u1' } });
    assert.ok(Api.isAuthed(), '降级环境 memStore 会话有效');
    global.__lsMap.clear();
    global.dispatchEvent({ key: null, newValue: null, oldValue: null });
    assert.strictEqual(hooks.auth, 1, 'clear() 必须击穿 memStore 降级副本');
    assert.strictEqual(Api.isAuthed(), false, '会话不得残留');
    assert.strictEqual(Api.getRefreshToken(), null, 'refreshToken 不得残留——否则下次 401 会把已清会话复活');
  });

  it('防过度失效：降级页他页仅改 zn_user → token 的 memStore 副本不受影响，换号通知照常', () => {
    Api = installEnv({ quotaFailed: true });
    bind();
    Api.setSession({ accessToken: 'a1', refreshToken: 'rt1', user: { id: 'u1', nickname: '甲' } });
    // 他页仅更新 user（如改昵称），token 仍只存在于本页 memStore
    global.__lsMap.set('zn_user', JSON.stringify({ id: 'u1', nickname: '甲改' }));
    global.dispatchEvent({ key: 'zn_user', newValue: '{"id":"u1","nickname":"甲改"}', oldValue: '{"id":"u1","nickname":"甲"}' });
    assert.strictEqual(Api.getToken(), 'a1', 'token 只在 memStore，按 key 精准失效不得误伤');
    assert.strictEqual(Api.getRefreshToken(), 'rt1');
    assert.strictEqual(Api.getUser().nickname, '甲改', 'user 副本失效后读到他页新值');
    assert.strictEqual(hooks.remote.length, 1, 'user 变化照常通知');
    assert.strictEqual(hooks.auth, 0, '非登出');
  });
});
