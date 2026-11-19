const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/server/app.js');
const { createMediaRouter } = require('../dist/routes/media.js');
const { persistImage } = require('../dist/lib/media-store.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TOS_KEYS = ['TOS_REGION', 'TOS_BUCKET', 'TOS_ACCESS_KEY_ID', 'TOS_ACCESS_KEY_SECRET', 'TOS_ENDPOINT'];

let mem;
let server;
let base;

before(async () => {
  for (const k of TOS_KEYS) delete process.env[k];
  mem = createMemoryPrisma();
  const app = createApp({ media: createMediaRouter(mem) });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); }));
});
after(async () => {
  server?.closeAllConnections?.();
  if (server) await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

test('data URI 图片落库并返回 /media 永久地址', async () => {
  const url = await persistImage(PNG_1PX, 'poster', mem);
  assert.match(url, /^\/media\/ma_\d+$/);
  const asset = await mem.mediaAsset.findUnique({ where: { id: url.split('/').pop() } });
  assert.equal(asset.mime, 'image/png');
  assert.ok(asset.size > 0);
  assert.ok(asset.bytes.length === asset.size);
});

test('无法解析的输入回退原地址，不阻断海报生成', async () => {
  const bad = 'data:image/png;base64,';
  assert.equal(await persistImage(bad, 'poster', mem), bad);
});

test('超过体积上限的图片不入库，回退原地址', async () => {
  process.env.MEDIA_MAX_BYTES = '4';
  try {
    assert.equal(await persistImage(PNG_1PX, 'poster', mem), PNG_1PX);
  } finally {
    delete process.env.MEDIA_MAX_BYTES;
  }
});

test('GET /media/:id 返回字节、类型与长缓存；未知 id 404', async () => {
  const url = await persistImage(PNG_1PX, 'poster', mem);
  const r = await fetch(base + url);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /^image\/png/);
  assert.match(r.headers.get('cache-control') || '', /immutable/);
  assert.ok((await r.arrayBuffer()).byteLength > 0);

  const miss = await fetch(base + '/media/not-exist');
  assert.equal(miss.status, 404);
});
