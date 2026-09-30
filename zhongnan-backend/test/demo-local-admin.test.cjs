const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 18199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('demo server did not become healthy');
}

test('local demo seeds 15209291219 as an administrator', async (t) => {
  const server = spawn(process.execPath, [path.join('dist', 'dev-server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  t.after(() => server.kill());
  await waitForHealth();

  let login;
  const deadline = Date.now() + 5_000;
  do {
    login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '15209291219', password: 'demo123456' }),
    });
    if (login.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);

  assert.equal(login.status, 200);
  const session = await login.json();
  const me = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(me.status, 200);
  const profile = await me.json();
  assert.equal(profile.phone, '152****1219');
  assert.equal(profile.level, 'PRO');
  assert.equal(profile.isAdmin, true);
});
