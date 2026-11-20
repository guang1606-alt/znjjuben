/**
 * v2.610 公开读接口：降级可以，但必须留痕可归因。
 *
 * 先证伪：
 *  1) `src/routes/updates.ts` /updates/latest 与 /updates/since 把 announcement 表读失败
 *     降级成「无公告 + 回退版本号 / 空列表」。降级本身合理（首页轮询不该 500），但零日志——
 *     DB 故障期间超管发布的新公告对全站不可见，运维与超管都拿不到任何线索。
 *  2) `src/routes/media.ts` /media/:id 主 catch 直接 500 INTERNAL_ERROR，同样无日志：
 *     用户看到「图片打不开」，服务端却没有任何可归因记录。
 * 修复：三处补 `logInternal`，对外状态码与响应形状完全不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
process.env.JWT_ACCESS_SECRET = 'v2610-secret';
process.env.JWT_REFRESH_SECRET = 'v2610-refresh';
const { createApp } = require('../dist/server/app.js');
const { createUpdatesRouter } = require('../dist/routes/updates.js');
const { createMediaRouter } = require('../dist/routes/media.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return () => { console.error = orig; return calls; };
}
async function listen(app) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

describe('v2.610 公开读/媒体读失败必须留痕', { concurrency: 1 }, () => {
  const mem = createMemoryPrisma();
  let base, server, mediaBase, mediaServer;
  before(async () => {
    ({ base, server } = await listen(createApp({ updates: createUpdatesRouter(mem) })));
    const m = express();
    m.use('/media', createMediaRouter(mem));
    ({ base: mediaBase, server: mediaServer } = await listen(m));
  });
  after(async () => {
    server.closeAllConnections?.(); mediaServer.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    await new Promise((r) => mediaServer.close(r));
  });

  it('1) /updates/latest 读失败：仍 200 降级，但留痕 updates.latest', async () => {
    const orig = mem.announcement.findMany;
    mem.announcement.findMany = async () => { throw new Error('DB_DOWN_ANNOUNCEMENT'); };
    const stop = captureErrors();
    let status, body;
    try {
      const r = await fetch(base + '/api/updates/latest');
      status = r.status; body = await r.json();
    } finally {
      const calls = stop();
      mem.announcement.findMany = orig;
      assert.ok(calls.some((c) => c.includes('[updates.latest]')),
        '公告读失败必须留痕 updates.latest；实际：' + calls.join(' | '));
    }
    assert.strictEqual(status, 200);
    assert.strictEqual(body.announcement, null);
    assert.ok(typeof body.version === 'string' && body.version.length > 0);
  });

  it('2) /updates/since 读失败：仍 200 空列表，但留痕 updates.since', async () => {
    const orig = mem.announcement.findMany;
    mem.announcement.findMany = async () => { throw new Error('DB_DOWN_ANNOUNCEMENT'); };
    const stop = captureErrors();
    let status, body;
    try {
      const r = await fetch(base + '/api/updates/since?version=2.0.0');
      status = r.status; body = await r.json();
    } finally {
      const calls = stop();
      mem.announcement.findMany = orig;
      assert.ok(calls.some((c) => c.includes('[updates.since]')),
        '增量公告读失败必须留痕 updates.since；实际：' + calls.join(' | '));
    }
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.items, []);
  });

  it('3) /media/:id 读失败：仍 500，但必须留痕 media.asset.serve', async () => {
    const orig = mem.mediaAsset.findUnique;
    mem.mediaAsset.findUnique = async () => { throw new Error('DB_DOWN_MEDIA'); };
    const stop = captureErrors();
    let status, body;
    try {
      const r = await fetch(mediaBase + '/media/m_v2610');
      status = r.status; body = await r.json();
    } finally {
      const calls = stop();
      mem.mediaAsset.findUnique = orig;
      assert.ok(calls.some((c) => c.includes('[media.asset.serve]')),
        '媒体读 500 必须留痕 media.asset.serve；实际：' + calls.join(' | '));
    }
    assert.strictEqual(status, 500);
    assert.strictEqual(body.error, 'INTERNAL_ERROR');
  });
});
