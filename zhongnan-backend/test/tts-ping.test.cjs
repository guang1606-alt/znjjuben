/**
 * v2.636 语音供应商连通性自检。
 *
 * 缺口：v2.635 已允许后台配置 audio 供应商，但「测试连接」仍复用文本探测，
 * `pingProvider` 对非 text 一律 UNSUPPORTED_MODALITY —— 管理员配完语音 Key 后
 * 没有任何手段确认它是否可用，只能等用户在听剧本页触发失败。
 *
 * 修复：audio 模态改走一次极短合成探测（input=“测试”），
 * 返回 ok/latencyMs/status/message；失败脱敏、不回显密钥；图像/视频仍如实不支持。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'tts-ping-secret';
process.env.JWT_REFRESH_SECRET = 'tts-ping-refresh';
const { createApp } = require('../dist/server/app.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

mem._seedUser({ id: 'admin1', phone: '18891995171', level: 'PRO' });
const H = { Authorization: `Bearer ${signAccess({ sub: 'admin1', level: 'PRO' })}`, 'Content-Type': 'application/json' };
const KEY = 'sk-voice-ping-secret';
let seq = 0;
async function saveProvider(over) {
  const r = await fetch(`${base}/api/admin/model/providers`, {
    method: 'PUT', headers: H,
    body: JSON.stringify({
      name: `语音探测${++seq}`, modality: 'audio', baseUrl: 'https://voice.example.com/v1',
      model: 'tts-1', apiKey: KEY, voice: 'nova', inYuanPerMTok: 0, outYuanPerMTok: 0,
      spendLimitYuan: 0, enabled: true, ...over,
    }),
  });
  const j = await r.json();
  assert.strictEqual(r.status, 200, JSON.stringify(j));
  return j.masked.providers.find((p) => p.name === `语音探测${seq}`);
}
const ping = async (id) => {
  const r = await fetch(`${base}/api/admin/model/providers/${id}/ping`, { method: 'POST', headers: H });
  return { s: r.status, j: await r.json().catch(() => null) };
};
function withTransport(handler) {
  const TTS = require('../dist/lib/tts.js');
  const calls = [];
  TTS.__setTtsTransport(async (url, init) => { calls.push({ url, init }); return handler(url, init); });
  return { calls, restore: () => TTS.__setTtsTransport(null) };
}
const audioResp = (bytes = 'ID3-ping', status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { 'content-type': status >= 300 ? 'application/json' : 'audio/mpeg' },
  buffer: async () => Buffer.from(bytes, 'latin1'),
});

describe('v2.636 语音供应商连通性自检', { concurrency: 1 }, () => {
  it('1) 语音供应商无密钥 → NO_KEY，不触网', async () => {
    const p = await saveProvider({ apiKey: '', enabled: false });
    const t = withTransport(() => { throw new Error('不得触网'); });
    let r;
    try { r = await ping(p.id); } finally { t.restore(); }
    assert.strictEqual(r.s, 200);
    assert.strictEqual(r.j.ok, false);
    assert.strictEqual(r.j.code, 'NO_KEY');
    assert.strictEqual(t.calls.length, 0);
  });

  it('2) 语音供应商可用 → ok，走 /audio/speech 且带 model/voice/input', async () => {
    const p = await saveProvider({});
    const t = withTransport(() => audioResp('ID3-ok'));
    let r;
    try { r = await ping(p.id); } finally { t.restore(); }
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    assert.strictEqual(r.j.ok, true);
    assert.ok(r.j.latencyMs >= 0);
    assert.strictEqual(t.calls.length, 1);
    assert.strictEqual(t.calls[0].url, 'https://voice.example.com/v1/audio/speech');
    assert.strictEqual(t.calls[0].init.headers.Authorization, `Bearer ${KEY}`);
    const body = JSON.parse(t.calls[0].init.body);
    assert.strictEqual(body.model, 'tts-1');
    assert.strictEqual(body.voice, 'nova');
    assert.ok(typeof body.input === 'string' && body.input.length > 0);
  });

  it('3) 语音供应商 401 → PING_FAILED，状态透出且不回显密钥', async () => {
    const p = await saveProvider({});
    const t = withTransport(() => audioResp(`bad key ${KEY}`, 401));
    let r;
    try { r = await ping(p.id); } finally { t.restore(); }
    assert.strictEqual(r.s, 200);
    assert.strictEqual(r.j.ok, false);
    assert.strictEqual(r.j.code, 'PING_FAILED');
    assert.strictEqual(r.j.status, 401);
    assert.ok(!JSON.stringify(r.j).includes(KEY), '探测结果不得回显密钥');
  });

  it('4) 图像供应商仍如实 UNSUPPORTED_MODALITY，且不触网', async () => {
    const p = await saveProvider({ modality: 'image', model: 'img-1' });
    const t = withTransport(() => { throw new Error('不得触网'); });
    let r;
    try { r = await ping(p.id); } finally { t.restore(); }
    assert.strictEqual(r.s, 200);
    assert.strictEqual(r.j.ok, false);
    assert.strictEqual(r.j.code, 'UNSUPPORTED_MODALITY');
    assert.strictEqual(t.calls.length, 0);
  });
});
