/**
 * v2.611 听剧本邻接：允许降级为单集模式，但必须留痕可归因。
 *
 * 先证伪：/scripts/:id/listen 的 buildPlayableEpisodes 查询失败时，空 catch 静默返回
 * prevScriptId/nextScriptId=null、epCount=1。主朗读稿不受影响的降级合理，但用户表现为
 * 「自动连播入口消失」，服务端却没有任何 DB 故障线索。修复仅补 logInternal，响应契约不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2611-secret';
process.env.JWT_REFRESH_SECRET = 'v2611-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

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

describe('v2.611 听剧本邻接构建失败必须留痕', { concurrency: 1 }, () => {
  const mem = createMemoryPrisma();
  const uid = 'u_v2611_listen';
  const pid = 'p_v2611_listen';
  const sid = 's_v2611_listen';
  let base, server;
  before(async () => {
    mem._seedUser({ id: uid, level: 'ADVANCED', balance: 500 });
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE', title: '邻接留痕剧' });
    mem._scripts.push({
      id: sid, projectId: pid, epNo: 1, version: 1, title: '第一集', wordCount: 20, score: 80,
      content: ['第1集 邻接留痕', '内景 房间·夜', '林晚：主朗读稿必须正常返回。', '△她转过身去。'].join('\n'),
    });
    ({ base, server } = await listen(createApp({ generate: createGenerateRouter(mem) })));
  });
  after(async () => {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  });

  it('邻接查询失败：仍 200 返回单集朗读稿，并记录原始异常与 generate.listen.neighbors', async () => {
    const orig = mem.script.findMany;
    mem.script.findMany = async () => { throw new Error('DB_DOWN_PLAYABLE'); };
    const before = mem._accounts.get(uid).balance;
    const stop = captureErrors();
    let r, calls;
    try {
      r = await fetch(`${base}/api/generate/scripts/${sid}/listen`, {
        headers: { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}` },
      });
    } finally {
      calls = stop();
      mem.script.findMany = orig;
    }
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.scriptId, sid);
    assert.ok(Array.isArray(body.segments) && body.segments.length > 0, '邻接失败不得拖垮主朗读稿');
    assert.deepStrictEqual(body.neighbors, {
      prevScriptId: null, nextScriptId: null, epPos: 1, epCount: 1,
    });
    assert.strictEqual(mem._accounts.get(uid).balance, before, '听剧本保持零扣费');
    assert.ok(calls.some((c) => c.includes('[generate.listen.neighbors]')),
      '邻接失败必须留痕 generate.listen.neighbors；实际：' + calls.join(' | '));
    assert.ok(calls.some((c) => c.includes('DB_DOWN_PLAYABLE')),
      '日志必须保留原始异常，不能只写一句无归因提示；实际：' + calls.join(' | '));
  });
});
