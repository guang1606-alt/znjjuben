/**
 * 认证与权限策略（纯函数、可离线对拍）。argon2/jwt 的 IO 边界在 auth.ts；这里放决策逻辑：
 * 手机号规范化与脱敏、密码强度、会员等级断言、登录失败锁定、敏感模式授权门槛。
 */

export type Level = 'FREE' | 'BASIC' | 'ADVANCED' | 'PRO' | 'ENTERPRISE';
const LEVEL_RANK: Record<Level, number> = { FREE: 0, BASIC: 1, ADVANCED: 2, PRO: 3, ENTERPRISE: 4 };

/** 中国大陆手机号规范化：去空格/横线，校验 1[3-9] + 9位 */
export function normalizePhone(raw: string): { ok: boolean; phone: string | null } {
  const p = (raw || '').replace(/[\s-]/g, '');
  return /^1[3-9]\d{9}$/.test(p) ? { ok: true, phone: p } : { ok: false, phone: null };
}
/** 脱敏 138****1234，日志/客服可见但不暴露全号 */
export function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

const WEAK_PASSWORDS = new Set(['12345678', 'password', 'qwerty123', '11111111', '00000000', 'abc12345']);
export interface PwStrength { ok: boolean; score: number; problems: string[] }
export function passwordStrength(pw: string): PwStrength {
  const problems: string[] = [];
  if (!pw || pw.length < 8) problems.push('密码至少8位');
  // 黑名单优先于复杂度：12345678 这类纯数字弱口令应报「弱口令」而非笼统的「需包含字母」
  if (WEAK_PASSWORDS.has((pw || '').toLowerCase())) problems.push('弱口令不可用');
  if (pw && !/[a-zA-Z]/.test(pw)) problems.push('需包含字母');
  if (pw && !/\d/.test(pw)) problems.push('需包含数字');
  let score = 0;
  if ((pw || '').length >= 8) score += 1;
  if ((pw || '').length >= 12) score += 1;
  if (/[a-z]/.test(pw || '') && /[A-Z]/.test(pw || '')) score += 1;
  if (/\d/.test(pw || '') && /[a-zA-Z]/.test(pw || '')) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw || '')) score += 1;
  return { ok: problems.length === 0, score: Math.min(5, score), problems };
}

/** 等级断言：have 是否达到 need */
export function hasLevel(have: Level, need: Level): boolean {
  return LEVEL_RANK[have] >= LEVEL_RANK[need];
}

/** 登录失败锁定：连续失败≥5次锁15分钟，返回是否锁定与剩余秒数 */
export function loginLock(state: { failCount: number; firstFailAt: number | null; lockedUntil: number | null }, now = Date.now()) {
  const MAX_FAIL = 5;
  const LOCK_MS = 15 * 60 * 1000;
  if (state.lockedUntil && state.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  if (state.failCount >= MAX_FAIL) {
    return { locked: true, retryAfterSec: 900, lockedUntil: now + LOCK_MS };
  }
  return { locked: false, retryAfterSec: 0 };
}
/** 一次登录失败后的状态转移 */
export function registerFail(state: { failCount: number; firstFailAt: number | null }, now = Date.now()) {
  const failCount = state.failCount + 1;
  return { failCount, firstFailAt: state.firstFailAt ?? now };
}
export function resetFail() { return { failCount: 0, firstFailAt: null as number | null, lockedUntil: null as number | null }; }

/** 敏感/特殊模式授权门槛：成年向必须有有效成年授权（兼容前端 wire-id xscript） */
export function requiresMatureConsent(mode: string): boolean {
  return mode === 'mature_x' || mode === 'xscript';
}
