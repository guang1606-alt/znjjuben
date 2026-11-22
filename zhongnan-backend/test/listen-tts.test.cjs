/**
 * v2.635 听剧本云端语音（TTS）链路骨架。
 *
 * 先证伪：
 *   `listenEntitleNote()` 明确承诺「真人语音播放走后台配置的 TTS 服务」，
 *   `/scripts/:id/listen` 也一直回传 `ttsReady`，但：
 *     · 供应商池 Modality 只有 text/image/video，音频供应商根本无处配置；
 *     · 没有任何合成端点，`ttsReady` 硬编码 false；
 *     · 真实音频只在浏览器 speechSynthesis 完成，云端真人声线是空承诺。
 * 修复：
 *   · 供应商池新增 audio 模态（可带 voice 音色）+ 后台 zod 放行；
 *   · 新增 `POST /api/generate/scripts/:id/listen/tts`：权益/归属/正文闸门与 /listen 同口径，
 *     未配置 audio 供应商时如实 503 TTS_NOT_CONFIGURED，绝不伪造音频；
 *   · 成功返回 base64 音频，按脚本版本/内容哈希进程内缓存，同参二次调用不重复计费；
 *   · 供应商失败脱敏为 502 TTS_FAILED，响应 JSON 全程不回显密钥。
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'tts-test-secret';
process.env.JWT_REFRESH_SECRET = 'tts-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { createAdminModelRouter } = require('../dist/routes/admin-model.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem), adminModel: createAdminModelRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const AUDIO_KEY = 'sk-audio-live-secret';
const TEXT_KEY = 'sk-text-must-not-leak';

mem._seedUser({ id: 'admin1', phone: '18891995171', level: 'PRO', isAdmin: false });
mem._seedUser({ id: 'u_basic', level: 'BASIC' });
mem._seedUser({ id: 'u_free', level: 'FREE' });
mem._seedUser({ id: 'u_other', level: 'BASIC' });
mem._projects.set('p_basic', { id: 'p_basic', userId: 'u_basic', title: '测试项目', status: 'draft' });
mem._projects.set('p_other', { id: 'p_other', userId: 'u_other', title: '他人项目', status: 'draft' });
const CONTENT = ['第1集 雨夜', '内景 咖啡馆 夜', '林晚：你终于来了。', '△ 她抬头看向门口，雨声渐急。'].join('\n');
mem._scripts.push({ id: 's_full', projectId: 'p_basic', epNo: 1, version: 1, title: '雨夜', content: CONTENT });
mem._scripts.push({ id: 's_empty', projectId: 'p_basic', epNo: 2, version: 1, title: '空集', content: '' });
mem._scripts.push({ id: 's_other', projectId: 'p_other', epNo: 1, version: 1, title: '他人集', content: CONTENT });
const LONG_CONTENT = Array.from({ length: 260 }, (_, i) => `△ 雨夜第${i + 1}段，林晚沿着旧街向前走，听见身后传来急促脚步。`).join('\n');
mem._scripts.push({ id: 's_long', projectId: 'p_basic', epNo: 3, version: 1, title: '长集', content: LONG_CONTENT });

const H = (uid, level) => ({ Authorization: `Bearer ${signAccess({ sub: uid, level })}`, 'Content-Type': 'application/json' });
const ttsPost = async (sid, uid, level, body = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer ${signAccess({ sub: uid, level })}`;
  const r = await fetch(`${base}/api/generate/scripts/${sid}/listen/tts`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { s: r.status, j: await r.json().catch(() => null) };
};
let pvSeq = 0;
const putProvider = async (over) => {
  const r = await fetch(`${base}/api/admin/model/providers`, {
    method: 'PUT',
    headers: H('admin1', 'PRO'),
    body: JSON.stringify({
      name: `云语音${++pvSeq}`, modality: 'audio', baseUrl: 'https://tts.example.com/v1', model: 'tts-1',
      apiKey: AUDIO_KEY, voice: 'alloy', inYuanPerMTok: 0, outYuanPerMTok: 0, spendLimitYuan: 0, enabled: true, ...over,
    }),
  });
  return { s: r.status, j: await r.json().catch(() => null) };
};

// 可注入传输：确定性区分 200/401/500，不触网
function withTransport(handler) {
  const TTS = require('../dist/lib/tts.js');
  const calls = [];
  TTS.__setTtsTransport(async (url, init) => { calls.push({ url, init }); return handler(url, init); });
  return { calls, restore: () => TTS.__setTtsTransport(null) };
}
const audioResp = (bytes = 'ID3-fake-mp3', status = 200, headers = { 'content-type': 'audio/mpeg' }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers,
  buffer: async () => Buffer.from(bytes, 'latin1'),
});

describe('v2.635 听剧本云端语音 TTS', { concurrency: 1 }, () => {
  beforeEach(() => {
    const TTS = require('../dist/lib/tts.js');
    TTS.__resetTtsState();
  });

  it('1) 未登录 → 401', async () => {
    const r = await ttsPost('s_full', null, null);
    assert.strictEqual(r.s, 401);
  });

  it('2) FREE 会员 → 403 ASSISTANT_LEVEL_REQUIRED', async () => {
    const r = await ttsPost('s_full', 'u_free', 'FREE');
    assert.strictEqual(r.s, 403);
    assert.strictEqual(r.j.error, 'ASSISTANT_LEVEL_REQUIRED');
  });

  it('3) 非本人剧本 → 403，且不触网', async () => {
    const t = withTransport(() => { throw new Error('不得触网'); });
    try {
      const r = await ttsPost('s_other', 'u_basic', 'BASIC');
      assert.strictEqual(r.s, 403);
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  it('4) 无可朗读正文 → 400', async () => {
    const t = withTransport(() => { throw new Error('不得触网'); });
    try {
      const r = await ttsPost('s_empty', 'u_basic', 'BASIC');
      assert.strictEqual(r.s, 400);
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  it('5) 未配置 audio 供应商 → 503 TTS_NOT_CONFIGURED，绝不伪造音频', async () => {
    const t = withTransport(() => { throw new Error('不得触网'); });
    try {
      const r = await ttsPost('s_full', 'u_basic', 'BASIC');
      assert.strictEqual(r.s, 503);
      assert.strictEqual(r.j.error, 'TTS_NOT_CONFIGURED');
      assert.ok(!r.j.audioBase64, '未配置时不得返回任何音频');
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  it('6) 文本供应商不得被当成 TTS：仍 503，且不触网', async () => {
    const saved = await putProvider({ name: '文本供应商X', modality: 'text', model: 'gpt-x', apiKey: TEXT_KEY });
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const t = withTransport(() => { throw new Error('不得触网'); });
    try {
      const r = await ttsPost('s_full', 'u_basic', 'BASIC');
      assert.strictEqual(r.s, 503);
      assert.strictEqual(r.j.error, 'TTS_NOT_CONFIGURED');
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  it('7) 成功合成 → 200，走 /audio/speech、带 model/voice/input，且不回显任何密钥', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const t = withTransport(() => audioResp('ID3-voice-bytes'));
    let r;
    try { r = await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'mp3' }); }
    finally { t.restore(); }

    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    assert.ok(r.j.audioBase64, '必须返回 base64 音频');
    assert.strictEqual(Buffer.from(r.j.audioBase64, 'base64').toString('latin1'), 'ID3-voice-bytes');
    assert.strictEqual(r.j.format, 'mp3');
    assert.strictEqual(r.j.voice, 'alloy');
    assert.ok(r.j.chars > 0);
    assert.strictEqual(r.j.cached, false);

    assert.strictEqual(t.calls.length, 1);
    assert.strictEqual(t.calls[0].url, 'https://tts.example.com/v1/audio/speech');
    assert.strictEqual(t.calls[0].init.headers.Authorization, `Bearer ${AUDIO_KEY}`);
    const body = JSON.parse(t.calls[0].init.body);
    assert.strictEqual(body.model, 'tts-1');
    assert.strictEqual(body.voice, 'alloy');
    assert.strictEqual(body.response_format, 'mp3');
    assert.ok(typeof body.input === 'string' && body.input.length > 0, '必须发送朗读文本');

    const wire = JSON.stringify(r.j);
    assert.ok(!wire.includes(AUDIO_KEY), '响应不得回显语音供应商密钥');
    assert.ok(!wire.includes(TEXT_KEY), '响应不得回显其它供应商密钥');
  });

  it('8) 同参二次调用 → cached:true，传输只调用一次', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const t = withTransport(() => audioResp('ID3-cache-me'));
    let a; let b;
    try {
      a = await ttsPost('s_full', 'u_basic', 'BASIC');
      b = await ttsPost('s_full', 'u_basic', 'BASIC');
    } finally { t.restore(); }
    assert.strictEqual(a.s, 200);
    assert.strictEqual(a.j.cached, false);
    assert.strictEqual(b.s, 200);
    assert.strictEqual(b.j.cached, true);
    assert.strictEqual(b.j.audioBase64, a.j.audioBase64);
    assert.strictEqual(t.calls.length, 1, '缓存命中不得重复请求供应商');
  });

  it('9) 供应商 401/500 → 502 TTS_FAILED，脱敏且不返回音频', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    let t = withTransport(() => audioResp(`invalid key ${AUDIO_KEY}`, 401, { 'content-type': 'application/json' }));
    let r1;
    try { r1 = await ttsPost('s_full', 'u_basic', 'BASIC'); } finally { t.restore(); }
    assert.strictEqual(r1.s, 502);
    assert.strictEqual(r1.j.error, 'TTS_FAILED');
    assert.ok(!r1.j.audioBase64);
    assert.ok(!JSON.stringify(r1.j).includes(AUDIO_KEY), '失败原因不得带密钥');

    t = withTransport(() => audioResp('boom', 500, { 'content-type': 'text/plain' }));
    let r2;
    try { r2 = await ttsPost('s_full', 'u_basic', 'BASIC'); } finally { t.restore(); }
    assert.strictEqual(r2.s, 502);
    assert.strictEqual(r2.j.error, 'TTS_FAILED');
  });

  it('10) 每日调用上限：未命中缓存的超额请求 → 429 TTS_DAILY_LIMIT', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const TTS = require('../dist/lib/tts.js');
    TTS.__setTtsDailyLimit(2);
    const t = withTransport(() => audioResp('ID3-quota'));
    let outs;
    try {
      // 三种不同输出格式 → 三个不同缓存键，各触发一次真实合成，第 3 次超额
      outs = [
        await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'mp3' }),
        await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'wav' }),
        await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'opus' }),
      ];
    } finally { t.restore(); }
    assert.strictEqual(outs[0].s, 200, JSON.stringify(outs[0].j));
    assert.strictEqual(outs[1].s, 200, JSON.stringify(outs[1].j));
    assert.strictEqual(outs[2].s, 429);
    assert.strictEqual(outs[2].j.error, 'TTS_DAILY_LIMIT');
    assert.strictEqual(t.calls.length, 2);
  });

  it('11) 非法 format → 400，不触网', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const t = withTransport(() => { throw new Error('不得触网'); });
    try {
      const r = await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'exe' });
      assert.strictEqual(r.s, 400);
      assert.strictEqual(t.calls.length, 0);
    } finally { t.restore(); }
  });

  it('12) 后台供应商池接受 audio 模态与音色；回显仍脱敏', async () => {
    const saved = await putProvider({ name: '音色校验', voice: 'nova' });
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const p = saved.j.masked.providers.find((x) => x.name === '音色校验');
    assert.ok(p, '必须能在供应商池看到 audio 供应商');
    assert.strictEqual(p.modality, 'audio');
    assert.strictEqual(p.voice, 'nova');
    assert.ok(p.apiKey.includes('•'), '回显必须脱敏');
  });

  it('13) v2.640 分段器按句边界控制上限，超长句硬切且不丢正文', () => {
    const TTS = require('../dist/lib/tts.js');
    const text = '第一句。第二句！第三句？第四句；第五句。\n第六句。';
    const parts = TTS.splitTtsText(text, 10);
    assert.ok(parts.length > 1);
    assert.ok(parts.every((x) => x.length <= 10), JSON.stringify(parts));
    assert.strictEqual(parts.join('').replace(/\s/g, ''), text.replace(/\s/g, ''), '分段不得丢字或改字');
    const hard = TTS.splitTtsText('长'.repeat(25), 10);
    assert.deepStrictEqual(hard.map((x) => x.length), [10, 10, 5]);
    assert.strictEqual(hard.join(''), '长'.repeat(25));
  });

  it('14) v2.640 长集不再 400：逐段返回 part/parts/hasMore，供应商输入均不超限', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const t = withTransport(() => audioResp('ID3-long-part'));
    const responses = [];
    try {
      const first = await ttsPost('s_long', 'u_basic', 'BASIC', { format: 'mp3', part: 0 });
      assert.strictEqual(first.s, 200, JSON.stringify(first.j));
      assert.strictEqual(first.j.part, 0);
      assert.ok(first.j.parts >= 2, JSON.stringify(first.j));
      assert.strictEqual(first.j.hasMore, true);
      responses.push(first);
      for (let part = 1; part < first.j.parts; part++) {
        const r = await ttsPost('s_long', 'u_basic', 'BASIC', { format: 'mp3', part });
        assert.strictEqual(r.s, 200, JSON.stringify(r.j));
        assert.strictEqual(r.j.part, part);
        assert.strictEqual(r.j.parts, first.j.parts);
        assert.strictEqual(r.j.hasMore, part + 1 < first.j.parts);
        responses.push(r);
      }
    } finally { t.restore(); }
    assert.strictEqual(t.calls.length, responses[0].j.parts);
    for (const call of t.calls) {
      const body = JSON.parse(call.init.body);
      assert.ok(body.input.length > 0 && body.input.length <= 4000, `分段长度越界：${body.input.length}`);
    }
    assert.ok(responses.every((r) => r.j.totalChars > 4000));
  });

  it('15) v2.640 同一集同一格式的全部分段只消耗一次每日额度', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const TTS = require('../dist/lib/tts.js');
    TTS.__setTtsDailyLimit(1);
    const t = withTransport(() => audioResp('ID3-long-quota'));
    try {
      const first = await ttsPost('s_long', 'u_basic', 'BASIC', { format: 'mp3', part: 0 });
      assert.strictEqual(first.s, 200, JSON.stringify(first.j));
      for (let part = 1; part < first.j.parts; part++) {
        const r = await ttsPost('s_long', 'u_basic', 'BASIC', { format: 'mp3', part });
        assert.strictEqual(r.s, 200, `第 ${part} 段不应重复计额度：${JSON.stringify(r.j)}`);
      }
      const other = await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'mp3' });
      assert.strictEqual(other.s, 429, '另一集仍应受每日一次上限约束');
      assert.strictEqual(other.j.error, 'TTS_DAILY_LIMIT');
    } finally { t.restore(); }
  });

  it('16) v2.640 非法 part（负数/小数/越界）→ 400 TTS_PART_INVALID，不触网', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const t = withTransport(() => { throw new Error('不得触网'); });
    try {
      for (const part of [-1, 0.5, 999]) {
        const r = await ttsPost('s_long', 'u_basic', 'BASIC', { format: 'mp3', part });
        assert.strictEqual(r.s, 400, JSON.stringify(r.j));
        assert.strictEqual(r.j.error, 'TTS_PART_INVALID');
      }
    } finally { t.restore(); }
    assert.strictEqual(t.calls.length, 0);
  });

  it('17) v2.643 合成整体失败不消耗每日额度：502 之后仍能正常合成', async () => {
    const saved = await putProvider({});
    assert.strictEqual(saved.s, 200, JSON.stringify(saved.j));
    const TTS = require('../dist/lib/tts.js');
    TTS.__setTtsDailyLimit(1);
    // 第一次：供应商整体不可用 → 502。用户没听到任何声音，不该扣掉当天唯一一次额度
    let t = withTransport(() => audioResp('upstream down', 500, { 'content-type': 'text/plain' }));
    let fail;
    try { fail = await ttsPost('s_full', 'u_basic', 'BASIC', { format: 'mp3' }); } finally { t.restore(); }
    assert.strictEqual(fail.s, 502, JSON.stringify(fail.j));
    assert.strictEqual(fail.j.error, 'TTS_FAILED');
    // 第二次：换一集（配额键不同）真实合成；若失败那次已占额度，这里会 429
    const okT = withTransport(() => audioResp('ID3-after-failure'));
    let ok;
    try { ok = await ttsPost('s_long', 'u_basic', 'BASIC', { format: 'mp3', part: 0 }); } finally { okT.restore(); }
    assert.strictEqual(ok.s, 200, `失败请求不应扣额度：${JSON.stringify(ok.j)}`);
    assert.ok(ok.j.audioBase64, '成功后必须拿到音频');
  });
});
