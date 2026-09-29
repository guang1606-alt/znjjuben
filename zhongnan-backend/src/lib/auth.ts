import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

/**
 * JWT 密钥取值（签发与校验唯一来源，middleware 也必须复用这里，禁止两处各写默认值）。
 * 安全铁律：NODE_ENV=production 时必须显式配置长度≥16 的密钥，否则拒绝启动/签发——
 * 公开的默认密钥等于没有鉴权，任何人都能伪造任意用户（含超管）令牌。
 */
const MIN_SECRET_LEN = 16;
function resolveSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', devFallback: string): string {
  const v = process.env[name];
  if (v && v.length >= MIN_SECRET_LEN) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`生产环境(NODE_ENV=production)必须配置长度≥${MIN_SECRET_LEN}位的环境变量 ${name}，拒绝使用内置开发密钥启动`);
  }
  return v || devFallback;
}
const ACCESS_SECRET = () => resolveSecret('JWT_ACCESS_SECRET', 'dev_access_change_me');
const REFRESH_SECRET = () => resolveSecret('JWT_REFRESH_SECRET', 'dev_refresh_change_me');

/** 启动时显式校验（生产缺密钥直接 fail-fast，而不是等第一个请求才报错） */
export function assertJwtSecrets(): void {
  ACCESS_SECRET();
  REFRESH_SECRET();
}

export async function hashPassword(pw: string): Promise<string> {
  return argon2.hash(pw, { type: argon2.argon2id }); // argon2id 抗GPU/侧信道
}
export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try { return await argon2.verify(hash, pw); } catch { return false; }
}

export interface JwtPayload { sub: string; level: string }

export function signAccess(p: JwtPayload): string {
  return jwt.sign(p, ACCESS_SECRET(), { expiresIn: Number(process.env.JWT_ACCESS_TTL) || 900 });
}
export function signRefresh(p: JwtPayload): string {
  return jwt.sign(p, REFRESH_SECRET(), { expiresIn: Number(process.env.JWT_REFRESH_TTL) || 2592000 });
}
export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET()) as JwtPayload;
}
export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET()) as JwtPayload;
}

/** 唯一邀请码（大写字母数字，去除易混字符） */
export function genInviteCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
