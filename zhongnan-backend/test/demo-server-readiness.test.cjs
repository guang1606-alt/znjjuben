/**
 * v2.655 演示服务器就绪顺序守卫（真子进程，真 HTTP）
 *
 * 背景：dev-server 曾用 `demoUsers.forEach(async ...)` 先入库用户、再异步补写
 * passwordHash，而 `app.listen` 立刻开始接客。于是健康检查已通过、启动横幅已宣称
 * 「演示账号可用」的那几百毫秒里，所有演示账号登录都返回 401；连续重试还会把
 * 登录限流（5 次/窗口）打成 429——这正是全量用例 `demo-local-admin` 偶发失真的根因。
 *
 * 本守卫断言：健康检查通过之后，「首次」登录必须直接成功，不依赖任何重试。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 18411;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForHealth() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('demo server did not become healthy');
}

test('健康检查通过后，演示账号首次登录即成功（哈希不落后于监听）', async (t) => {
  const server = spawn(process.execPath, [path.join('dist', 'dev-server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  t.after(() => server.kill());
  await waitForHealth();

  // 只发一次：不允许靠重试掩盖「监听领先于种子就绪」
  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '15209291219', password: 'demo123456' }),
  });
  assert.equal(login.status, 200, '健康检查通过后首次登录必须 200，实际 ' + login.status);
});
