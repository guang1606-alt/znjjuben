/**
 * v2.612 听剧本声线表：允许降级为旁白播放，但必须留痕可归因。
 *
 * 先证伪：/scripts/:id/listen 的 buildVoiceCast 出现意外异常时，空 catch 静默返回
 * cast=null。主朗读稿不受影响、前端回退旁白是合理降级，但分角色声线消失时服务端
 * 没有任何异常线索。修复仅补 logInternal，响应契约不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2612-secret';
process.env.JWT_REFRESH_SECRET = 'v2612-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const voiceCastModule = require('../dist/engine/listen-voice-cast.js');
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

describe('v2.612 听剧本声线表异常必须留痕', { concurrency: 1 }, () => {
  const mem = createMemoryPrisma();
  const uid = 'u_v2612_listen';
  const pid = 'p_v2612_listen';
  const sid = 's_v2612_listen';
  let base, server;
  before(async () => {
    mem._seedUser({ id: uid, level: 'ADVANCED', balance: 500 });
    mem._projects.set(pid, { id: pid, userId: uid, bible: null, format: 'LIVE', title: '声线留痕剧' });
    mem._scripts.push({
      id: sid, projectId: pid, epNo: 1, version: 1, title: '第一集', wordCount: 20, score: 80,
      content: ['第1集 声线留痕', '内景 房间·夜', '林晚：主朗读稿必须正常返回。', '△她转过身去。'].join('\n'),
    });
    ({ base, server } = await listen(createApp({ generate: createGenerateRouter(mem) })));
  });
  after(async () => {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  });

  it('声线表异常：仍 200 返回主朗读稿与 cast=null，并记录原始异常与 generate.listen.voice-cast', async () => {
    const orig = voiceCastModule.buildVoiceCast;
    voiceCastModule.buildVoiceCast = () => { throw new Error('VOICE_CAST_REGRESSION'); };
    const before = mem._accounts.get(uid).balance;
    const stop = captureErrors();
    let r, calls;
    try {
      r = await fetch(`${base}/api/generate/scripts/${sid}/listen`, {
        headers: { Authorization: `Bearer ${signAccess({ sub: uid, level: 'ADVANCED' })}` },
      });
    } finally {
      calls = stop();
      voiceCastModule.buildVoiceCast = orig;
    }
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.scriptId, sid);
    assert.ok(Array.isArray(body.segments) && body.segments.length > 0, '声线表异常不得拖垮主朗读稿');
    assert.strictEqual(body.cast, null, '声线表异常仍按既有契约回退旁白播放');
    assert.strictEqual(mem._accounts.get(uid).balance, before, '听剧本保持零扣费');
    assert.ok(calls.some((c) => c.includes('[generate.listen.voice-cast]')),
      '声线表异常必须留痕 generate.listen.voice-cast；实际：' + calls.join(' | '));
    assert.ok(calls.some((c) => c.includes('VOICE_CAST_REGRESSION')),
      '日志必须保留原始异常，不能只写一句无归因提示；实际：' + calls.join(' | '));
  });
});
