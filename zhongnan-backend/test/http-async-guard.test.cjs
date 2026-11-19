/**
 * v2.567 异步路由兜底：Express 4 不会把 async 处理器的 reject 转发给错误中间件，
 * 少写 try/catch 的接口在数据库抖动时会永久挂起（前端一直转圈），而不是明确 500。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../dist/server/app.js');
const express = require('express');

const r = express.Router();
r.get('/_guard/boom', async () => { throw new Error('db down'); });
r.get('/_guard/sync', () => { throw new Error('sync boom'); });
r.get('/_guard/ok', (_req, res) => res.json({ ok: true }));
// preErrorRouter 挂在静态/壳路由之前，才能验证「拒绝透传到终局错误中间件」
const app = createApp({}, r);

let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((res) => server.close(res));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const call = async (p) => {
  const res = await fetch(base + p, { signal: AbortSignal.timeout(3000) });
  return { s: res.status, j: await res.json().catch(() => null) };
};

describe('异步路由兜底（不得挂起请求）', { concurrency: 1 }, () => {
  it('async 处理器 reject：明确 500 JSON，而不是一直挂着', async () => {
    const { s, j } = await call('/_guard/boom');
    assert.strictEqual(s, 500);
    assert.strictEqual(j.error, 'INTERNAL_ERROR');
  });
  it('同步 throw 仍由 Express 捕获回 500（回归）', async () => {
    assert.strictEqual((await call('/_guard/sync')).s, 500);
  });
  it('正常处理器不受包裹影响', async () => {
    const { s, j } = await call('/_guard/ok');
    assert.strictEqual(s, 200);
    assert.deepStrictEqual(j, { ok: true });
  });
});
