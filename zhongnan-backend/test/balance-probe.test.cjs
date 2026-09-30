const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { probeDeepseekBalance, probeMoonshotBalance } = require('../dist/lib/balance-probe.js');

// 全局 fetch 桩：每个 it 用 __routeFn 自定义返回；用 __throwsFn 抛网络异常
function installFetch() {
  const saved = global.fetch;
  global.fetch = async (url, opts) => {
    if (global.__throwsFn) return global.__throwsFn(url, opts);
    if (global.__routeFn) return global.__routeFn(url, opts);
    return { ok: true, status: 200, async text() { return '{}'; }, async json() { return {}; } };
  };
  return () => { global.fetch = saved; global.__routeFn = null; global.__throwsFn = null; };
}

describe('probeDeepseekBalance', { concurrency: 1 }, () => {
  let restore;
  beforeEach(() => { restore = installFetch(); global.__routeFn = null; global.__throwsFn = null; });
  afterEach(() => restore && restore());

  it('成功解析 deepseek 余额（CNY.total_balance 字符串）', async () => {
    global.__routeFn = (url) => {
      assert.ok(url.includes('api.deepseek.com/user/balance'), '请求 deepseek 余额端点');
      return {
        ok: true, status: 200,
        async json() { return { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '123.45' }] }; },
        async text() { return JSON.stringify({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '123.45' }] }); },
      };
    };
    const r = await probeDeepseekBalance('sk-test');
    assert.strictEqual(r.balanceYuan, 123.45);
    assert.ok(!r.error);
  });

  it('HTTP 401 → balanceYuan=null，error 含 401', async () => {
    global.__routeFn = () => ({ ok: false, status: 401, async text() { return '{"message":"invalid api key"}'; } });
    const r = await probeDeepseekBalance('bad');
    assert.strictEqual(r.balanceYuan, null);
    assert.ok(r.error && r.error.includes('401'));
  });

  it('JSON 异常（balance_infos 缺失）→ null 且带 error', async () => {
    global.__routeFn = () => ({ ok: true, status: 200, async json() { return { is_available: true }; }, async text() { return '{}'; } });
    const r = await probeDeepseekBalance('sk-test');
    assert.strictEqual(r.balanceYuan, null);
    assert.ok(r.error);
  });

  it('网络异常（fetch reject）→ 不抛，返回 error', async () => {
    global.__throwsFn = () => { throw new Error('ECONNRESET'); };
    const r = await probeDeepseekBalance('sk-test');
    assert.strictEqual(r.balanceYuan, null);
    assert.ok(r.error && r.error.includes('ECONNRESET'));
  });

  it('AbortError 超时 → 返回 TIMEOUT 标识', async () => {
    global.__throwsFn = (_url, opts) => {
      // 模拟 AbortController 触发：从 signal 上读 abort 后抛 AbortError
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      throw e;
    };
    const r = await probeDeepseekBalance('sk-test');
    assert.strictEqual(r.balanceYuan, null);
    assert.ok(r.error);
  });
});

describe('probeMoonshotBalance', { concurrency: 1 }, () => {
  let restore;
  beforeEach(() => { restore = installFetch(); global.__routeFn = null; global.__throwsFn = null; });
  afterEach(() => restore && restore());

  it('成功解析 moonshot 余额（data.available_balance 数字）', async () => {
    const payload = { data: { available_balance: 88.88 } };
    global.__routeFn = (url) => {
      assert.ok(url.includes('api.moonshot.cn/v1/users/me/balance'));
      return { ok: true, status: 200, async json() { return payload; }, async text() { return JSON.stringify(payload); } };
    };
    const r = await probeMoonshotBalance('sk-moon');
    assert.strictEqual(r.balanceYuan, 88.88);
    assert.ok(!r.error);
  });

  it('HTTP 401 → null + error', async () => {
    global.__routeFn = () => ({ ok: false, status: 401, async text() { return 'unauthorized'; } });
    const r = await probeMoonshotBalance('bad');
    assert.strictEqual(r.balanceYuan, null);
    assert.ok(r.error && r.error.includes('401'));
  });

  it('JSON 异常（data 缺失）→ null + error', async () => {
    global.__routeFn = () => ({ ok: true, status: 200, async json() { return { foo: 'bar' }; }, async text() { return JSON.stringify({ foo: 'bar' }); } });
    const r = await probeMoonshotBalance('sk-moon');
    assert.strictEqual(r.balanceYuan, null);
    assert.ok(r.error);
  });

  it('available_balance 是 0 也合法（不算失败）', async () => {
    const payload = { data: { available_balance: 0 } };
    global.__routeFn = () => ({ ok: true, status: 200, async json() { return payload; }, async text() { return JSON.stringify(payload); } });
    const r = await probeMoonshotBalance('sk-moon');
    assert.strictEqual(r.balanceYuan, 0);
    assert.ok(!r.error);
  });
});
