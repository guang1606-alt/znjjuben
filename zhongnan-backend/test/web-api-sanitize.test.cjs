const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// v2.226 错误信息脱敏回落层：jsonOrThrow 对后端内部裸码（INTERNAL_ERROR / SERVER_BUSY / 无 body 5xx）
// 统一回落本地双语友好文案；e.error 保留原码供调用方分支，业务错误码不受影响。
const source = fs.readFileSync(path.join(__dirname, '../web/api.js'), 'utf8');
function environment(lang) {
  const storage = new Map([['zn_lang', lang]]);
  const context = {
    module: { exports: {} }, AbortController, AbortSignal,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  };
  vm.runInNewContext(source, context, { filename: 'web/api.js' });
  return { Api: context.module.exports, storage };
}
const res = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body))),
});

describe('jsonOrThrow sanitizes internal server codes into friendly text', () => {
  it('500 INTERNAL_ERROR 回落中文友好文案，e.error 保留原码', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(500, { error: 'INTERNAL_ERROR' })).then(() => null, (x) => x);
    assert.ok(e && typeof e.message === 'string'); // vm 跨 realm，Error 原型不同，不测 instanceof
    assert.match(e.message, /服务开小差|请稍后/);
    assert.equal(e.error, 'INTERNAL_ERROR');
    assert.equal(e.httpStatus, 500);
  });

  it('500 无 body 回落中文友好文案并补 e.error=SERVER_BUSY', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(502)).then(() => null, (x) => x);
    assert.match(e.message, /服务开小差|请稍后/);
    assert.equal(e.error, 'SERVER_BUSY');
  });

  it('英文模式下回落英文友好文案', async () => {
    const { Api } = environment('en');
    const e = await Api.jsonOrThrow(res(503, { error: 'INTERNAL_ERROR' })).then(() => null, (x) => x);
    assert.match(e.message, /server|hiccup|retry/i);
    assert.ok(!/服务开小差/.test(e.message));
  });

  it('业务错误码不受影响：400 RATE_LIMITED 仍透传后端 message', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(400, { error: 'RATE_LIMITED', message: '操作太频繁了' })).then(() => null, (x) => x);
    assert.equal(e.message, '操作太频繁了');
    assert.equal(e.error, 'RATE_LIMITED');
  });

  it('IDEMPOTENT_REPLAY 幂等撞车仍展示后端提示', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(409, { error: 'IDEMPOTENT_REPLAY', message: '请求正在处理中，请勿重复提交' })).then(() => null, (x) => x);
    assert.equal(e.message, '请求正在处理中，请勿重复提交');
  });

  it('非 5xx 无 body 仍保留 HTTP 状态码提示（不误伤 4xx）', async () => {
    const { Api } = environment('zh');
    const e = await Api.jsonOrThrow(res(404)).then(() => null, (x) => x);
    assert.equal(e.message, 'HTTP 404');
  });
});
