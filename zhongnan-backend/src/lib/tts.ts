/**
 * v2.635 云端语音合成（TTS）链路。
 *
 * 设计口径：
 *  - 只认后台供应商池里 modality='audio' 且已启用、有 Key/模型/端点的供应商；
 *    没有就如实返回 TTS_NOT_CONFIGURED，绝不伪造音频。
 *  - 走 OpenAI 兼容 `POST {baseUrl}/audio/speech`，body 固定 model/voice/input/response_format。
 *  - 失败一律脱敏为 TTS_FAILED，响应与日志都不回显供应商密钥。
 *  - 进程内 LRU 缓存（20 条 / 32MB 上限），同脚本同版本同内容同格式不重复计费；
 *    只有真正命中供应商的请求才消耗每用户每日次数（默认 30 次，防成本失控）。
 *  - 本模块不直接接触 HTTP：默认走 node:http(s)，测试可注入确定性传输。
 */
import { createHash } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { ProviderEntry } from './model-config-policy';
import { logInternal } from './http-errors';

export type TtsFormat = 'mp3' | 'wav' | 'opus' | 'aac' | 'flac' | 'pcm';
export const TTS_FORMATS: TtsFormat[] = ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'];
export const TTS_DEFAULT_FORMAT: TtsFormat = 'mp3';
export const TTS_DEFAULT_VOICE = 'alloy';
/** 单段合成文本上限；长集由路由按句边界拆成多段顺序播放 */
export const TTS_MAX_CHARS = 4000;

/**
 * 将长朗读稿拆成供应商可接收的分段。
 * 优先在句末/换行处收段；单个句子本身超限时才硬切，绝不静默丢字。
 */
export function splitTtsText(input: string, maxChars = TTS_MAX_CHARS): string[] {
  const text = String(input || '').trim();
  if (!text) return [];
  const max = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : TTS_MAX_CHARS;
  const sentences = text.split(/(?<=[。！？!?；;\n])/).map((x) => x.trim()).filter(Boolean);
  const parts: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > max) {
      if (current) { parts.push(current); current = ''; }
      parts.push(rest.slice(0, max));
      rest = rest.slice(max).trimStart();
    }
    if (!rest) continue;
    if (!current) current = rest;
    else if (current.length + 1 + rest.length <= max) current += `\n${rest}`;
    else { parts.push(current); current = rest; }
  }
  if (current) parts.push(current);
  return parts;
}

const CACHE_MAX_ENTRIES = 20;
const CACHE_MAX_BYTES = 32 * 1024 * 1024;
const QUOTA_DEFAULT_LIMIT = 30;
const REQUEST_TIMEOUT_MS = 60_000;
const RESPONSE_MAX_BYTES = 16 * 1024 * 1024;

export type TtsErrorCode = 'TTS_EMPTY' | 'TTS_TEXT_TOO_LONG' | 'TTS_FAILED' | 'TTS_DAILY_LIMIT';
export interface TtsResult {
  ok: boolean;
  code?: TtsErrorCode;
  status?: number;
  message?: string;
  audioBase64?: string;
  format?: string;
  voice?: string;
  chars?: number;
  cached?: boolean;
}

/** 可用语音供应商：启用 + 有 Key + 有模型 + http(s) 端点，按池顺序返回 */
export function listAudioProviders(list: ProviderEntry[]): ProviderEntry[] {
  return list.filter((x) => x.modality === 'audio' && x.enabled
    && !!(x.apiKey || '').trim() && !!(x.model || '').trim()
    && /^https?:\/\/.+/i.test(x.baseUrl || ''));
}

/** 选中第一个可用语音供应商（展示用，如 /listen 的 ttsReady） */
export function pickAudioProvider(list: ProviderEntry[]): ProviderEntry | null {
  return listAudioProviders(list)[0] || null;
}

/** 缓存键的脚本维度：脚本 id + 版本 + 正文哈希 + 语言；供应商/模型/音色/格式在合成时再拼一层 */
export function ttsCacheKey(input: { scriptId: string; version: number | string; text: string; lang: 'zh' | 'en' }): string {
  const h = createHash('sha256').update(String(input.text || '')).digest('hex').slice(0, 24);
  return `${input.scriptId}|${input.version}|${h}|${input.lang}`;
}

/* ---------------- 可注入传输 ---------------- */
export interface TtsRawResp {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  buffer: () => Promise<Buffer>;
}
export type TtsTransport = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; timeoutMs: number },
) => Promise<TtsRawResp>;

// eslint-disable-next-line @typescript-eslint/naming-convention
let __transport: TtsTransport | null = null;
export function __setTtsTransport(t: TtsTransport | null) { __transport = t; }

function defaultTransport(url: string, init: { method: string; headers: Record<string, string>; body: string; timeoutMs: number }): Promise<TtsRawResp> {
  return new Promise<TtsRawResp>((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return reject(new Error('TTS_UNSUPPORTED_PROTOCOL'));
    const transport = u.protocol === 'http:' ? http : https;
    const req = transport.request(u, { method: init.method, headers: init.headers, timeout: init.timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > RESPONSE_MAX_BYTES) { req.destroy(new Error('TTS_RESPONSE_TOO_LARGE')); return; }
        chunks.push(c);
      });
      res.on('end', () => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : String(v);
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          headers,
          buffer: async () => Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('TTS_TIMEOUT')));
    req.write(init.body);
    req.end();
  });
}

/* ---------------- 供应商连通性自检（管理后台「测试连接」） ---------------- */
const PING_TIMEOUT_MS = 15_000;
export interface TtsPingResult {
  ok: boolean;
  code?: 'NO_KEY' | 'PING_FAILED';
  status?: number;
  latencyMs?: number;
  model?: string;
  message: string;
}

export async function pingTtsProvider(input: { baseUrl: string; apiKey: string; model: string; voice?: string }): Promise<TtsPingResult> {
  const key = (input.apiKey || '').trim();
  if (!key) return { ok: false, code: 'NO_KEY', message: '该语音供应商尚未保存密钥，请先填写并保存后再测试' };
  const base = (input.baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return { ok: false, code: 'PING_FAILED', message: '供应商未配置接口地址（baseUrl）' };
  const model = (input.model || '').trim();
  if (!model) return { ok: false, code: 'PING_FAILED', message: '语音供应商未配置模型名' };
  const voice = (input.voice || '').trim() || TTS_DEFAULT_VOICE;
  const started = Date.now();
  try {
    const transport = __transport ?? defaultTransport;
    const resp = await transport(`${base}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, voice, input: '测试', response_format: 'mp3' }),
      timeoutMs: PING_TIMEOUT_MS,
    });
    const buf = await resp.buffer();
    const latencyMs = Date.now() - started;
    if (!resp.ok) {
      const detail = redact(buf.toString('utf8'), key);
      return { ok: false, code: 'PING_FAILED', status: resp.status, latencyMs, message: `接口返回 ${resp.status}${detail ? '：' + detail : ''}` };
    }
    const ctype = (resp.headers['content-type'] || '').toLowerCase();
    let hasAudio = buf.length > 0;
    if (ctype.includes('json')) {
      try {
        const j = JSON.parse(buf.toString('utf8')) as { audio?: string; data?: string; audio_base64?: string };
        hasAudio = !!(j.audio || j.data || j.audio_base64);
      } catch { hasAudio = false; }
    }
    if (!hasAudio) return { ok: false, code: 'PING_FAILED', status: resp.status, latencyMs, message: '接口连通但未返回音频数据' };
    return { ok: true, status: resp.status, latencyMs, model, message: '连接正常，已返回音频' };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    const raw = redact((e as { message?: string })?.message ?? String(e), key);
    const msg = name === 'AbortError' || /MODEL_TIMEOUT|TTS_TIMEOUT|ETIMEDOUT|timeout/i.test(raw)
      ? `请求超时（${Math.round(PING_TIMEOUT_MS / 1000)} 秒未响应）`
      : `连接失败${raw ? '：' + raw : ''}`;
    return { ok: false, code: 'PING_FAILED', latencyMs: Date.now() - started, message: msg };
  }
}

/* ---------------- 进程内缓存 + 每日额度 ---------------- */
interface CacheEntry { b64: string; format: string; voice: string; chars: number }
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;
const quota = new Map<string, { day: string; n: number; keys: Set<string> }>();
let dailyLimit = QUOTA_DEFAULT_LIMIT;

/** 测试钩子：清空缓存/额度并恢复默认每日上限 */
export function __resetTtsState() {
  cache.clear();
  cacheBytes = 0;
  quota.clear();
  dailyLimit = QUOTA_DEFAULT_LIMIT;
}
/** 测试钩子：调整每日上限（<=0 视为不限） */
export function __setTtsDailyLimit(n: number) { dailyLimit = Number.isFinite(n) ? Math.floor(n) : QUOTA_DEFAULT_LIMIT; }

/** 北京时间的自然日键：额度按国内用户习惯的零点重置，而不是 UTC 08:00 */
function dayKey(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 消耗一次真实合成额度；同一 quotaKey 的后续分段不重复计次（缓存命中不调用本函数） */
function consumeQuota(userId?: string, quotaKey?: string): { ok: boolean; charged: boolean } {
  if (!userId || dailyLimit <= 0) return { ok: true, charged: false };
  const day = dayKey();
  let cur = quota.get(userId);
  if (!cur || cur.day !== day) {
    cur = { day, n: 0, keys: new Set<string>() };
    quota.set(userId, cur);
  }
  const key = String(quotaKey || '');
  if (key && cur.keys.has(key)) return { ok: true, charged: false };
  if (cur.n >= dailyLimit) return { ok: false, charged: false };
  cur.n += 1;
  if (key) cur.keys.add(key);
  return { ok: true, charged: true };
}

/**
 * v2.643 失败退还：预扣的额度在整轮合成彻底失败时还回去。
 * 否则「供应商 502/断网、用户没听到任何声音」也会白白消耗当天次数，
 * 与「只有真正命中供应商并产出音频才计次」的承诺名实不符。
 * 只退本次真正扣过的那一笔（charged），已被同 quotaKey 去重放行的请求不受影响。
 */
function refundQuota(userId?: string, quotaKey?: string) {
  if (!userId || dailyLimit <= 0) return;
  const cur = quota.get(userId);
  if (!cur || cur.day !== dayKey()) return;
  if (cur.n > 0) cur.n -= 1;
  const key = String(quotaKey || '');
  if (key) cur.keys.delete(key);
}

function cacheGet(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  // LRU：命中后移到队尾
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cachePut(key: string, entry: CacheEntry) {
  const size = entry.b64.length;
  if (size > CACHE_MAX_BYTES) return;
  const old = cache.get(key);
  if (old) { cacheBytes -= old.b64.length; cache.delete(key); }
  while ((cache.size >= CACHE_MAX_ENTRIES || cacheBytes + size > CACHE_MAX_BYTES) && cache.size) {
    const oldestKey = cache.keys().next().value as string;
    const oldest = cache.get(oldestKey);
    if (oldest) cacheBytes -= oldest.b64.length;
    cache.delete(oldestKey);
  }
  cache.set(key, entry);
  cacheBytes += size;
}

function redact(text: string, key: string): string {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (key) s = s.split(key).join('***');
  return s.slice(0, 160);
}

/* ---------------- 合成 ---------------- */
export interface SynthesizeInput {
  /** 按优先级排列的候选语音供应商（路由层按池顺序最多取 3 家） */
  providers: ProviderEntry[];
  text: string;
  format?: string;
  /** 由调用方提供的脚本维度缓存键；缺省按文本哈希 */
  cacheKey?: string;
  /** 传入则启用每日额度（C 端调用必须传） */
  userId?: string;
  /** 同一次整集播放链路的额度键：各分段只计一次；缺省保持逐次合成计额 */
  quotaKey?: string;
}

/** 请求级错误（如 400 音色/参数不合法）换供应商同样会失败，不重试 */
function isRequestLevelError(status?: number): boolean {
  return status === 400;
}

async function tryProvider(p: ProviderEntry, text: string, format: TtsFormat): Promise<TtsResult> {
  const voice = (p.voice || '').trim() || TTS_DEFAULT_VOICE;
  const base = (p.baseUrl || '').trim().replace(/\/+$/, '');
  const transport = __transport ?? defaultTransport;
  try {
    const resp = await transport(`${base}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: p.model, voice, input: text, response_format: format }),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    const buf = await resp.buffer();
    if (!resp.ok) {
      const detail = redact(buf.toString('utf8'), p.apiKey);
      return { ok: false, code: 'TTS_FAILED', status: resp.status, message: `语音服务返回 ${resp.status}${detail ? '：' + detail : ''}` };
    }
    const ctype = (resp.headers['content-type'] || '').toLowerCase();
    let b64 = '';
    if (ctype.includes('json')) {
      const parsed = JSON.parse(buf.toString('utf8')) as { audio?: string; data?: string; audio_base64?: string };
      b64 = parsed.audio || parsed.data || parsed.audio_base64 || '';
    } else {
      b64 = buf.toString('base64');
    }
    if (!b64) return { ok: false, code: 'TTS_FAILED', status: resp.status, message: '语音服务未返回音频数据' };
    return { ok: true, audioBase64: b64, format, voice, chars: text.length, cached: false };
  } catch (e) {
    logInternal(e, 'tts.synthesize');
    const raw = redact((e as { message?: string })?.message ?? String(e), p.apiKey);
    return { ok: false, code: 'TTS_FAILED', message: `语音服务不可用${raw ? '：' + raw : ''}` };
  }
}

export async function synthesizeSpeech(input: SynthesizeInput): Promise<TtsResult> {
  const text = String(input.text || '').trim();
  const format = (TTS_FORMATS as string[]).includes(String(input.format)) ? String(input.format) as TtsFormat : TTS_DEFAULT_FORMAT;
  const chars = text.length;

  if (!text) return { ok: false, code: 'TTS_EMPTY', message: '没有可合成的朗读文本' };
  if (chars > TTS_MAX_CHARS) {
    return { ok: false, code: 'TTS_TEXT_TOO_LONG', message: `单次合成上限 ${TTS_MAX_CHARS} 字，请分集播放` };
  }

  const candidates = listAudioProviders(input.providers || []).slice(0, 3);
  if (!candidates.length) return { ok: false, code: 'TTS_FAILED', message: '没有可用的语音供应商' };

  // 缓存键与供应商无关：故障转移后产出的音频同样可复用，避免换家后重复计费
  const key = createHash('sha256')
    .update([format, input.cacheKey || createHash('sha256').update(text).digest('hex')].join('\u0000'))
    .digest('hex');

  const hit = cacheGet(key);
  if (hit) return { ok: true, audioBase64: hit.b64, format: hit.format, voice: hit.voice, chars: hit.chars, cached: true };

  const q = consumeQuota(input.userId, input.quotaKey);
  if (!q.ok) {
    return { ok: false, code: 'TTS_DAILY_LIMIT', message: '今日云端语音次数已用完，可改用浏览器朗读或明日再试' };
  }

  let last: TtsResult = { ok: false, code: 'TTS_FAILED', message: '语音服务不可用' };
  for (const p of candidates) {
    const r = await tryProvider(p, text, format);
    if (r.ok) {
      cachePut(key, { b64: r.audioBase64!, format, voice: r.voice!, chars });
      return r;
    }
    last = r;
    if (isRequestLevelError(r.status)) break;
  }
  if (q.charged) refundQuota(input.userId, input.quotaKey);
  return last;
}
