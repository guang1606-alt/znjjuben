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

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
function sha256hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** 下载远程图片或解码 base64 data URI，返回二进制 Buffer 与 MIME */
async function fetchImage(input: string): Promise<{ buf: Buffer; mime: string }> {
  if (input.startsWith('data:')) {
    const m = input.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('invalid data URI');
    return { buf: Buffer.from(m[2], 'base64'), mime: m[1] || 'image/png' };
  }
  const resp = await fetch(input);
  if (!resp.ok) throw new Error(`fetch image failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const mime = resp.headers.get('content-type') || 'image/png';
  return { buf, mime };
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
 * 把图片转存到 TOS，返回永久 URL。
 * 未配置 TOS 时原样返回 input（不阻断业务）。
 */
export async function uploadImageToTos(input: string, keyPrefix = 'poster'): Promise<string> {
  if (!tosEnabled()) return input;
  try {
    const { buf, mime } = await fetchImage(input);
    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
    const key = `${keyPrefix}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    return await putObject(key, buf, mime);
  } catch (e) {
    console.error('[tos] upload failed, fallback to original URL:', (e as Error).message);
    return input; // 上传失败回退原图，不让业务失败
  }
}
