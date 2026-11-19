// v2.544 删除海报时同步删除 TOS 对象：否则配额显示已释放、云上仍占空间（名实不符）。
// 这里只验证签名请求构造与降级语义，不触网（fetch 全量打桩）。
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert');

process.env.TOS_REGION = 'cn-test';
process.env.TOS_BUCKET = 'znbucket';
process.env.TOS_ACCESS_KEY_ID = 'AKTEST';
process.env.TOS_ACCESS_KEY_SECRET = 'SKTEST';
delete process.env.TOS_ENDPOINT;
const { deleteTosObject } = require('../dist/lib/tos.js');

const OUR = 'https://znbucket.tos-cn-test.volces.com/poster/a.png';
let calls = [];
let status = 200;
const realFetch = global.fetch;

beforeEach(() => { calls = []; status = 200; });
after(() => { global.fetch = realFetch; });

function stubFetch() {
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method, headers: opts.headers || {} });
    return new Response('', { status });
  };
}

test('删除本桶对象：发 DELETE、带签名与空载荷哈希，成功返回 true', async () => {
  stubFetch();
  assert.strictEqual(await deleteTosObject(OUR), true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].method, 'DELETE');
  assert.strictEqual(calls[0].url, OUR);
  const h = calls[0].headers;
  assert.match(String(h.authorization), /^TOS4-HMAC-SHA256 Credential=AKTEST\/\d{8}\/cn-test\/tos\/request/);
  assert.match(String(h.authorization), /SignedHeaders=host;x-tos-content-sha256;x-tos-date/);
  assert.strictEqual(h['x-tos-content-sha256'], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'DELETE 空载荷哈希');
});

test('对象已不存在（404）按幂等成功处理', async () => {
  status = 404; stubFetch();
  assert.strictEqual(await deleteTosObject(OUR), true);
});

test('云侧故障：不抛错、返回 false，删除海报不被阻断', async () => {
  status = 500; stubFetch();
  assert.strictEqual(await deleteTosObject(OUR), false);
});

test('非本桶地址一律不删（防越权），且不发请求', async () => {
  stubFetch();
  assert.strictEqual(await deleteTosObject('https://evil.example.com/poster/a.png'), false);
  assert.strictEqual(calls.length, 0);
});

test('删除端点必须接入 TOS 清理（静态守卫）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'value-added.ts'), 'utf8');
  assert.match(src, /deleteTosObject\(String\(\(asset as any\)\.externalUrl\)\)/, '删除海报时必须清云上对象');
  assert.match(src, /await prisma\.mediaAsset\.delete/, '记录照常删除');
});
