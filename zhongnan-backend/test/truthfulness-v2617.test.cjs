/**
 * v2.617 续期读库失败必须可归因
 *
 * 证伪背景：POST /api/auth/refresh 的宽 catch 把「令牌无效/过期」（常态，应静默 401）
 * 与「读用户表失败 / 单飞存储异常 / 签发失败」（基础设施故障）混在一起，
 * 一律静默返回 401 REFRESH_INVALID。数据库抖动时全体用户被踢下线，
 * 服务端零线索，无法区分是令牌真过期还是库挂了。
 *
 * 本文件锁定：基础设施故障对外契约不变（仍 401 REFRESH_INVALID），
 * 但必须写入 [auth.refresh] 且携带原始异常；无效令牌不得产生日志噪音。
 */
const test = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'test_access_secret_16';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_16';
const { createApp } = require('../dist/server/app.js');
const { createAuthRouter } = require('../dist/routes/auth.js');
const { signRefresh } = require('../dist/lib/auth.js');

const throwingPrisma = {
  user: { findUnique: async () => { throw new Error('REFRESH_DB_DOWN_V2617'); } },
};
const app = createApp({ auth: createAuthRouter(throwingPrisma) });
const server = app.listen(0);
test.before(() => new Promise((r) => server.once('listening', r)));
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
});

const refresh = async (refreshToken) => {
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
};

test('续期读库失败：对外仍 401 REFRESH_INVALID，但必须写入 [auth.refresh] 留痕', async () => {
  const rt = signRefresh({ sub: 'u_refresh_db_v2617', level: 'BASIC', pv: '' });
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  let r;
  try {
    r = await refresh(rt);
  } finally {
    console.error = orig;
  }
  assert.strictEqual(r.status, 401, '行为保持不变：续期失败一律 401');
  assert.deepStrictEqual(r.json, { error: 'REFRESH_INVALID' }, '对外错误码保持不变');
  assert.ok(
    logs.some((l) => l.includes('[auth.refresh]') && l.includes('REFRESH_DB_DOWN_V2617')),
    '基础设施故障必须带 scope 与原始异常留痕，否则「全体被踢下线」无从归因',
  );
});

test('无效 refresh token 属于常态，不得产生 [auth.refresh] 日志噪音', async () => {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  let r;
  try {
    r = await refresh('not-a-jwt-token');
  } finally {
    console.error = orig;
  }
  assert.strictEqual(r.status, 401);
  assert.deepStrictEqual(r.json, { error: 'REFRESH_INVALID' });
  assert.ok(!logs.some((l) => l.includes('[auth.refresh]')), '过期/篡改令牌不应写基础设施故障日志');
});
