/**
 * v2.55 P1 安全铁律实证：生产环境（NODE_ENV=production）未设 CONFIG_SECRET 必须拒绝启动。
 * 用子进程隔离模拟，避免污染主测试进程的 NODE_ENV（已被 run-tests.cjs 锁为 'test'）。
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const distCrypto = path.join(__dirname, '..', 'dist', 'lib', 'crypto.js');

test('生产环境未设 CONFIG_SECRET 时 require crypto.js 立即抛错且非0退出', () => {
  // 只设 NODE_ENV=production，不给 CONFIG_SECRET
  const r = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(distCrypto)})`], {
    env: { ...process.env, NODE_ENV: 'production', CONFIG_SECRET: '' },
    encoding: 'utf8',
  });
  assert.notStrictEqual(r.status, 0, '生产缺 CONFIG_SECRET 必须非0退出');
  assert.ok(r.stderr.includes('CONFIG_SECRET'), `stderr 应含 CONFIG_SECRET 字样，实际：${r.stderr}`);
  assert.ok(/拒绝启动/.test(r.stderr), 'stderr 应明确写出“拒绝启动”');
});

test('生产环境设了 CONFIG_SECRET 时正常加载（不抛错）', () => {
  const r = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(distCrypto)})`], {
    env: { ...process.env, NODE_ENV: 'production', CONFIG_SECRET: 'prod-secret-32-chars-aaaaaaaaaaaaaa' },
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, '设了 CONFIG_SECRET 应正常加载');
  assert.strictEqual(r.stderr, '', '不应有任何 warn/stderr');
});

test('开发/测试环境不设 CONFIG_SECRET 仅 warn 不抛错', () => {
  const r = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(distCrypto)})`], {
    env: { ...process.env, NODE_ENV: 'test', CONFIG_SECRET: '' },
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, 'test 环境不抛错');
  assert.ok(r.stderr.includes('CONFIG_SECRET'), '应有 warn 提示');
});
