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

test('带 ownerId 时同步记一条存储用量（refId 指向媒体 id）', async () => {
  const url = await persistImage(PNG_1PX, 'poster', mem, 'u_owner');
  const id = url.split('/').pop();
  const asset = await mem.mediaAsset.findUnique({ where: { id } });
  const sum = await mem.storageObject.aggregate({ where: { userId: 'u_owner', deletedAt: null }, _sum: { bytes: true } });
  assert.equal(sum._sum.bytes, asset.size, '存储用量必须等于落库图片字节数');
  const rows = await mem.storageObject.aggregate({ where: { userId: 'nobody', deletedAt: null }, _sum: { bytes: true } });
  assert.equal(rows._sum.bytes, 0, '别的用户不应被记入');
});

test('未传 ownerId 时不产生存储用量（避免匿名记账）', async () => {
  await persistImage(PNG_1PX, 'poster', mem);
  const sum = await mem.storageObject.aggregate({ where: { userId: 'u_no_owner', deletedAt: null }, _sum: { bytes: true } });
  assert.equal(sum._sum.bytes, 0);
});

test('存储记账失败不影响图片永久地址返回', async () => {
  const db = {
    mediaAsset: mem.mediaAsset,
    storageObject: { async create() { throw new Error('STORAGE_WRITE_FAIL'); } },
  };
  const url = await persistImage(PNG_1PX, 'poster', db, 'u_owner');
  assert.match(url, /^\/media\/ma_\d+$/);
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

// v2.539 前端海报渲染守卫：落库后返回的是 /media/:id 站内相对地址，
// 前端若只放行 http(s)/data: 就会把持久化成功的海报整批过滤掉（提示成功却一张不显示）。
test('前端海报渲染必须放行同源 /media/ 地址，且仍拒绝协议相对外链', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const line = src.split('\n').find((l) => l.includes('const urls = (r.images || [])'));
  assert.ok(line, '未找到高清海报渲染处（r.images 过滤）');
  assert.match(line, /filter\(imgUrlOk\)/, '过滤必须走 imgUrlOk 单点维护');
  const fn = src.match(/const imgUrlOk = \(u\) => \{[\s\S]*?\n    \};/);
  assert.ok(fn, '过滤逻辑应集中在 imgUrlOk，便于单点维护');
  assert.match(fn[0], /startsWith\('\/'\)/, '必须放行站内相对地址（/media/:id）');
  assert.match(fn[0], /'\/\/'/, '必须显式拒绝 // 协议相对外链，避免把站内地址放行扩大成任意域');
  assert.match(fn[0], /\^https\?:\\\/\\\//, '仍需放行 http(s) 外部地址（TOS 模式）');
  assert.match(fn[0], /data:image\//, '仍需放行 data:image（未配置 TOS 且落库失败时的回退）');
});
