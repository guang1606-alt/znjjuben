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
/** 单次合成文本上限：约一集中文朗读稿，超限如实拒绝而不是静默截断 */
export const TTS_MAX_CHARS = 4000;

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

/** 选中一个可用语音供应商：启用 + 有 Key + 有模型 + http(s) 端点 */
export function pickAudioProvider(list: ProviderEntry[]): ProviderEntry | null {
  const p = list.find((x) => x.modality === 'audio' && x.enabled
    && !!(x.apiKey || '').trim() && !!(x.model || '').trim()
    && /^https?:\/\/.+/i.test(x.baseUrl || ''));
  return p || null;
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

/* ---------------- 进程内缓存 + 每日额度 ---------------- */
interface CacheEntry { b64: string; format: string; voice: string; chars: number }
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;
const quota = new Map<string, { day: string; n: number }>();
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

/** 消耗一次真实合成额度；返回 false 表示已超额（缓存命中不调用本函数） */
function consumeQuota(userId?: string): boolean {
  if (!userId || dailyLimit <= 0) return true;
  const day = dayKey();
  const cur = quota.get(userId);
  if (!cur || cur.day !== day) { quota.set(userId, { day, n: 1 }); return true; }
  if (cur.n >= dailyLimit) return false;
  cur.n += 1;
  return true;
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
  provider: ProviderEntry;
  text: string;
  format?: string;
  /** 由调用方提供的脚本维度缓存键；缺省按文本哈希 */
  cacheKey?: string;
  /** 传入则启用每日额度（C 端调用必须传） */
  userId?: string;
}

export async function synthesizeSpeech(input: SynthesizeInput): Promise<TtsResult> {
  const text = String(input.text || '').trim();
  const format = (TTS_FORMATS as string[]).includes(String(input.format)) ? String(input.format) as TtsFormat : TTS_DEFAULT_FORMAT;
  const voice = (input.provider.voice || '').trim() || TTS_DEFAULT_VOICE;
  const chars = text.length;

  if (!text) return { ok: false, code: 'TTS_EMPTY', message: '没有可合成的朗读文本' };
  if (chars > TTS_MAX_CHARS) {
    return { ok: false, code: 'TTS_TEXT_TOO_LONG', message: `单次合成上限 ${TTS_MAX_CHARS} 字，请分集播放` };
  }

  const p = input.provider;
  const base = (p.baseUrl || '').trim().replace(/\/+$/, '');
  const key = createHash('sha256')
    .update([p.id, p.model, voice, format, input.cacheKey || createHash('sha256').update(text).digest('hex')].join('\u0000'))
    .digest('hex');

  const hit = cacheGet(key);
  if (hit) return { ok: true, audioBase64: hit.b64, format: hit.format, voice: hit.voice, chars: hit.chars, cached: true };

  if (!consumeQuota(input.userId)) {
    return { ok: false, code: 'TTS_DAILY_LIMIT', message: '今日云端语音次数已用完，可改用浏览器朗读或明日再试' };
  }

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

    cachePut(key, { b64, format, voice, chars });
    return { ok: true, audioBase64: b64, format, voice, chars, cached: false };
  } catch (e) {
    logInternal(e, 'tts.synthesize');
    const raw = redact((e as { message?: string })?.message ?? String(e), p.apiKey);
    return { ok: false, code: 'TTS_FAILED', message: `语音服务不可用${raw ? '：' + raw : ''}` };
  }
}
