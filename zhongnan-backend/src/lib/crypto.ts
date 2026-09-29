/**
 * 对称加密：管理员后台填写的模型 API Key 一律 AES-256-GCM 加密落库，绝不明文保存。
 * 密钥来自环境变量 CONFIG_SECRET。
 * - 生产环境（NODE_ENV=production）未设置时直接 throw 拒绝启动，杜绝使用开发默认密钥导致密文可被猜中。
 * - 开发环境未设置时回退到默认密钥并 warn，便于本地启动。
 */
import crypto from 'crypto';

const isProd = process.env.NODE_ENV === 'production';
const SECRET = process.env.CONFIG_SECRET || (isProd ? '' : 'zhongnan-dev-secret-change-in-production-32b');
if (isProd && !process.env.CONFIG_SECRET) {
  throw new Error('[crypto] CONFIG_SECRET 未设置：生产环境必须配置环境变量 CONFIG_SECRET（≥32 字符随机串），拒绝启动');
}
if (!isProd && !process.env.CONFIG_SECRET) {
  console.warn('⚠️ CONFIG_SECRET 未设置，正在使用开发默认密钥，生产请务必配置');
}
const KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 bytes

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decrypt(payload: string): string {
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return ''; // 解密失败按“未配置”处理，绝不抛堆栈给用户
  }
}

/**
 * 脱敏：只暴露末 4 位，供后台回显核对。
 * v2.55 收紧：原方案首3+末4=7字符外泄，对 32 字符 OpenAI key 暴露 22%，且首3常见 'sk-' 可被推断前缀。
 * 现方案仅末4外泄（12.5%），中段与首段全 •，与 model-config-policy.maskProviders 行为一致。
 */
export function maskKey(s: string): string {
  if (!s) return '';
  if (s.length <= 8) return '••••'; // 短串全遮，避免末4占比过高
  return '••••••' + s.slice(-4);
}
