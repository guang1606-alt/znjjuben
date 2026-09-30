const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_ACCESS_SECRET = 'cron-access-test';
process.env.JWT_REFRESH_SECRET = 'cron-refresh-test';
const escrow = require('../dist/lib/escrow.js');
const originalSettle = escrow.settleDueEscrows;
let calls = 0;
escrow.settleDueEscrows = async () => { calls++; return 3; };
const { createApp } = require('../dist/server/app.js');
let server, base;
const originalSecret = process.env.CONFIG_SECRET;
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  escrow.settleDueEscrows = originalSettle;
  if (originalSecret === undefined) delete process.env.CONFIG_SECRET;
  else process.env.CONFIG_SECRET = originalSecret;
});
test('内部结算：缺少或空白服务端密钥时拒绝，不能执行结算', async () => {
  for (const secret of [undefined, '', '   ']) {
    if (secret === undefined) delete process.env.CONFIG_SECRET;
    else process.env.CONFIG_SECRET = secret;
    const beforeCalls = calls;
    const r = await fetch(base + '/api/internal/escrow/settle', { method: 'POST' });
    assert.equal(r.status, 401);
    const root = await fetch(base + '/', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: ':escrow' });
    assert.equal(root.status, 404);
    assert.equal(calls, beforeCalls);
  }
});
test('已配置密钥时只接受匹配的内部调用', async () => {
  process.env.CONFIG_SECRET = 'test-cron-configured';
  const count = calls;
  const denied = await fetch(base + '/api/internal/escrow/settle', { method: 'POST', headers: { 'x-cron-token': 'wrong' } });
  assert.equal(denied.status, 401);
  assert.equal(calls, count);
  const ok = await fetch(base + '/api/internal/escrow/settle', { method: 'POST', headers: { Authorization: 'Bearer test-cron-configured' } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).settled, 3);
  assert.equal(calls, count + 1);
  const root = await fetch(base + '/', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'test-cron-configured:escrow' });
  assert.equal(root.status, 200);
  assert.equal(calls, count + 2);
});
