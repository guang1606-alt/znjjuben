/**
 * 火山引擎 TOS（对象存储）轻量上传器
 * ------------------------------------------------------------------
 *  · 走 TOS 的 S3 兼容 REST API，用 Node 内置 crypto 做 SigV4 签名，零额外依赖；
 *  · 未配置 TOS_* 环境变量时直接返回原图地址（不影响本地/未上云场景）；
 *  · 仅用于把图片模型返回的临时 URL / base64 转存为永久可访问的 TOS 对象。
 *
 * 环境变量：
 *   TOS_REGION          如 cn-beijing
 *   TOS_BUCKET          桶名
 *   TOS_ACCESS_KEY_ID   AK
 *   TOS_ACCESS_KEY_SECRET SK
 *   TOS_ENDPOINT        可选，默认 tos-${TOS_REGION}.volces.com
 */
import crypto from 'crypto';

const REGION = process.env.TOS_REGION || '';
const BUCKET = process.env.TOS_BUCKET || '';
const AK = process.env.TOS_ACCESS_KEY_ID || '';
const SK = process.env.TOS_ACCESS_KEY_SECRET || '';
const ENDPOINT = process.env.TOS_ENDPOINT || (REGION ? `tos-${REGION}.volces.com` : '');

export function tosEnabled(): boolean {
  return !!(REGION && BUCKET && AK && SK);
}

/**
 * 本桶对象域名（运行时读取环境变量，便于测试与本进程内配置变更即时生效）。
 * v2.559：/media/:id?download=1 需要判断外链是否为本桶对象——只对自己的对象做字节代理，
 * 避免站内路由被当成任意 URL 代理（SSRF 面）。
 */
export function tosObjectHost(): string {
  const region = process.env.TOS_REGION || '';
  const bucket = process.env.TOS_BUCKET || '';
  const endpoint = process.env.TOS_ENDPOINT || (region ? `tos-${region}.volces.com` : '');
  return bucket && endpoint ? `${bucket}.${endpoint}` : '';
}

export function isOwnTosObjectUrl(urlOrKey: string): boolean {
  const host = tosObjectHost();
  if (!host) return false;
  try { return new URL(urlOrKey).host === host; } catch { return false; }
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
function sha256hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** 下载远程图片或解码 base64 data URI，返回二进制 Buffer 与 MIME */
export async function fetchImageBytes(input: string, timeoutMs = 5000): Promise<{ buf: Buffer; mime: string }> {
  if (input.startsWith('data:')) {
    const m = input.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('invalid data URI');
    return { buf: Buffer.from(m[2], 'base64'), mime: m[1] || 'image/png' };
  }
  const resp = await fetch(input, { signal: AbortSignal.timeout(timeoutMs) });
  if (!resp.ok) throw new Error(`fetch image failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get('content-type') || 'image/png';
  return { buf, mime };
}

/**
 * 删除 TOS 对象（v2.544）：删除海报时同步清掉云上文件，避免「配额显示已释放、云上仍占空间」的名实不符。
 * 仅接受本桶地址；未配置 TOS / 非本桶 / 解析失败一律静默返回 false，不阻断删除。
 */
export async function deleteTosObject(urlOrKey: string): Promise<boolean> {
  if (!tosEnabled() || !urlOrKey) return false;
  let key = '';
  try {
    const u = new URL(urlOrKey);
    if (u.host !== `${BUCKET}.${ENDPOINT}`) return false; // 外链不是我们的对象，不越权删除
    key = decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch {
    key = String(urlOrKey).replace(/^\/+/, '');
  }
  if (!key) return false;
  try { await deleteObject(key); return true; }
  catch (e) { console.error('[tos] delete failed:', (e as Error).message); return false; }
}

/** SigV4 签名 DELETE 对象 */
async function deleteObject(key: string): Promise<void> {
  const host = `${BUCKET}.${ENDPOINT}`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const emptyHash = sha256hex('');

  const canonicalHeaders = `host:${host}\nx-tos-content-sha256:${emptyHash}\nx-tos-date:${amzDate}\n`;
  const signedHeaders = 'host;x-tos-content-sha256;x-tos-date';
  const canonicalRequest = ['DELETE', `/${key}`, '', canonicalHeaders, signedHeaders, emptyHash].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/tos/request`;
  const stringToSign = ['TOS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac(SK, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, 'tos');
  const kSigning = hmac(kService, 'request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const resp = await fetch(`https://${host}/${key}`, {
    method: 'DELETE',
    headers: {
      'host': host,
      'x-tos-content-sha256': emptyHash,
      'x-tos-date': amzDate,
      'authorization': `TOS4-HMAC-SHA256 Credential=${AK}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  // 404 视为已删除（幂等），其余非 2xx 抛错由调用方降级
  if (!resp.ok && resp.status !== 404) throw new Error(`TOS DELETE failed ${resp.status}`);
}

/** SigV4 签名 PUT 上传到 TOS */
async function putObject(key: string, buf: Buffer, mime: string): Promise<string> {
  const host = `${BUCKET}.${ENDPOINT}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(buf);

  const canonicalHeaders = `content-type:${mime}\nhost:${host}\nx-tos-content-sha256:${payloadHash}\nx-tos-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-tos-content-sha256;x-tos-date';
  const canonicalRequest = ['PUT', `/${key}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/tos/request`;
  const stringToSign = ['TOS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n');

  const kDate = hmac(SK, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, 'tos');
  const kSigning = hmac(kService, 'request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  const authorization = `TOS4-HMAC-SHA256 Credential=${AK}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}/${key}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': mime,
      'host': host,
      'x-tos-content-sha256': payloadHash,
      'x-tos-date': amzDate,
      'authorization': authorization,
    },
    body: new Uint8Array(buf),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`TOS PUT failed ${resp.status}: ${text.slice(0, 200)}`);
  }
  return `https://${host}/${key}`;
}

/**
 * 把图片转存到 TOS：成功返回永久地址与字节信息（供调用方落元数据/记账），失败返回 null。
 * v2.541：失败不再回退原图地址——模型临时链接会过期，「转存失败」当下看不出来、
 * 几天后海报全变裂图。由调用方决定回退（落库持久化），保证已生成的图永远打得开。
 * v2.542：返回 size/mime，TOS 模式也能在「我的海报」列表与存储用量里被看见。
 */
export async function uploadImageToTos(input: string, keyPrefix = 'poster'): Promise<{ url: string; size: number; mime: string } | null> {
  if (!tosEnabled()) return null;
  try {
    const { buf, mime } = await fetchImageBytes(input);
    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
    const key = `${keyPrefix}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    return { url: await putObject(key, buf, mime), size: buf.length, mime };
  } catch (e) {
    console.error('[tos] upload failed, will fallback to db persistence:', (e as Error).message);
    return null;
  }
}
