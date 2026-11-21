/**
 * v2.637 语音供应商故障转移。
 *
 * 缺口：文本链路有「岗位路由 → 档位 → 供应商池 Top3」的故障转移，
 * 但 v2.635 的 TTS 只取第一个可用 audio 供应商：首选 401/5xx/超时即整条失败，
 * 即使后台还配了健康的备选语音供应商也用不上。
 *
 * 修复：按供应商池顺序最多尝试 3 家；401/403/429/5xx/超时切下一家，
 * 400 等请求级错误不换（换一家同样会失败）；全部失败才返回 TTS_FAILED；
 * 缓存键与供应商无关，故障转移后的结果同样可复用。
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const provider = (id, key, extra = {}) => ({
  id, name: id, modality: 'audio', baseUrl: `https://${id}.example.com/v1`,
  apiKey: key, model: 'tts-1', voice: 'alloy', inYuanPerMTok: 0, outYuanPerMTok: 0,
  spendLimitYuan: 0, enabled: true, ...extra,
});
const audioResp = (bytes = 'ID3-ok', status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { 'content-type': status >= 300 ? 'application/json' : 'audio/mpeg' },
  buffer: async () => Buffer.from(bytes, 'latin1'),
});
function withTransport(handler) {
  const TTS = require('../dist/lib/tts.js');
  const calls = [];
  TTS.__setTtsTransport(async (url, init) => { calls.push({ url, init }); return handler(url, init); });
  return { calls, restore: () => TTS.__setTtsTransport(null) };
}

describe('v2.637 语音供应商故障转移', { concurrency: 1 }, () => {
  beforeEach(() => require('../dist/lib/tts.js').__resetTtsState());

  it('1) 首选 500 → 自动切到第二家并成功', async () => {
    const TTS = require('../dist/lib/tts.js');
    const t = withTransport((url) => (url.includes('down.example.com') ? audioResp('boom', 500) : audioResp('ID3-backup')));
    let r;
    try {
      r = await TTS.synthesizeSpeech({
        providers: [provider('down', 'sk-down'), provider('backup', 'sk-backup')],
        text: '第一集 测试正文', format: 'mp3', cacheKey: 's1|1|hash|zh',
      });
    } finally { t.restore(); }
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(Buffer.from(r.audioBase64, 'base64').toString('latin1'), 'ID3-backup');
    assert.strictEqual(t.calls.length, 2);
    assert.strictEqual(t.calls[1].init.headers.Authorization, 'Bearer sk-backup');
    assert.ok(!JSON.stringify(r).includes('sk-down'));
    assert.ok(!JSON.stringify(r).includes('sk-backup'));
  });

  it('2) 两家都 401 → 全部失败才返回 TTS_FAILED，且不泄露密钥', async () => {
    const TTS = require('../dist/lib/tts.js');
    const t = withTransport(() => audioResp('invalid key', 401));
    let r;
    try {
      r = await TTS.synthesizeSpeech({
        providers: [provider('a', 'sk-a'), provider('b', 'sk-b')],
        text: '正文', format: 'mp3', cacheKey: 's2|1|hash|zh',
      });
    } finally { t.restore(); }
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'TTS_FAILED');
    assert.strictEqual(r.status, 401);
    assert.strictEqual(t.calls.length, 2);
    assert.ok(!JSON.stringify(r).includes('sk-a'));
    assert.ok(!JSON.stringify(r).includes('sk-b'));
  });

  it('3) 首选 400（请求级错误）→ 不换供应商，直接失败', async () => {
    const TTS = require('../dist/lib/tts.js');
    const t = withTransport(() => audioResp('bad voice', 400));
    let r;
    try {
      r = await TTS.synthesizeSpeech({
        providers: [provider('a', 'sk-a'), provider('b', 'sk-b')],
        text: '正文', format: 'mp3', cacheKey: 's3|1|hash|zh',
      });
    } finally { t.restore(); }
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'TTS_FAILED');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(t.calls.length, 1, '400 不换供应商');
  });

  it('4) 首选网络异常/超时 → 切下一家成功', async () => {
    const TTS = require('../dist/lib/tts.js');
    const t = withTransport((url) => {
      if (url.includes('timeout.example.com')) throw new Error('TTS_TIMEOUT');
      return audioResp('ID3-after-timeout');
    });
    let r;
    try {
      r = await TTS.synthesizeSpeech({
        providers: [provider('timeout', 'sk-t'), provider('healthy', 'sk-h')],
        text: '正文', format: 'mp3', cacheKey: 's4|1|hash|zh',
      });
    } finally { t.restore(); }
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(t.calls.length, 2);
    assert.strictEqual(Buffer.from(r.audioBase64, 'base64').toString('latin1'), 'ID3-after-timeout');
  });

  it('5) 缓存键与供应商无关：故障转移后的结果可被另一顺序命中', async () => {
    const TTS = require('../dist/lib/tts.js');
    const t = withTransport(() => audioResp('ID3-cache-cross'));
    let a; let b;
    try {
      a = await TTS.synthesizeSpeech({
        providers: [provider('a', 'sk-a'), provider('b', 'sk-b')],
        text: '正文', format: 'mp3', cacheKey: 's5|1|hash|zh',
      });
      b = await TTS.synthesizeSpeech({
        providers: [provider('b', 'sk-b'), provider('a', 'sk-a')],
        text: '正文', format: 'mp3', cacheKey: 's5|1|hash|zh',
      });
    } finally { t.restore(); }
    assert.strictEqual(a.ok, true);
    assert.strictEqual(a.cached, false);
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.cached, true, '同内容同格式必须跨供应商复用缓存');
    assert.strictEqual(t.calls.length, 1);
  });
});
