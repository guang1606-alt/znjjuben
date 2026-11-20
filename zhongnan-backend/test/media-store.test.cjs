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

// v2.614 无 TOS 时抓取/落库失败会回退模型临时地址——当下图能看，几天后过期变裂图。
// 这条降级此前完全静默，线上出现裂图时没有任何服务端线索。行为不变，只补留痕。
test('落库失败回退原地址时必须写入 [media.fallback] 留痕', async () => {
  const db = { mediaAsset: { create: async () => { throw new Error('MEDIA_ASSET_DOWN_V2614'); } } };
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  let url;
  try {
    url = await persistImage(PNG_1PX, 'poster', db);
  } finally {
    console.error = orig;
  }
  assert.equal(url, PNG_1PX, '回退原地址的行为保持不变');
  assert.ok(
    logs.some((l) => l.includes('[media.fallback]') && l.includes('MEDIA_ASSET_DOWN_V2614')),
    '回退临时地址必须可归因，否则海报过期裂图无从排查',
  );
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

// v2.542 TOS 模式元数据行没有字节：/media/:id 必须 302 到对象地址，前端地址结构不变
test('无字节但有 externalUrl 的元数据行 302 到对象存储；两者都缺才 404', async () => {
  const obj = 'https://znbucket.tos-cn-test.volces.com/poster/a.png';
  const asset = await mem.mediaAsset.create({ data: { kind: 'poster', mime: 'image/png', size: 1234, externalUrl: obj } });
  const r = await fetch(base + `/media/${asset.id}`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), obj);

  const broken = await mem.mediaAsset.create({ data: { kind: 'poster', mime: 'image/png', size: 1 } });
  const miss = await fetch(base + `/media/${broken.id}`);
  assert.equal(miss.status, 404, '既无字节也无外链不得当成空图返回 200');
});

// v2.558 下载原图：?download=1 必须补 Content-Disposition（文件名带扩展名），
// 不带参数时仍内联显示（缩略图/预览需要能被 <img> 直接渲染）。
test('GET /media/:id?download=1 返回附件下载头，不带参数时仍内联', async () => {
  const url = await persistImage(PNG_1PX, 'poster', mem);
  const dl = await fetch(base + url + '?download=1');
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition') || '', /^attachment; filename="poster-ma_\d+\.png"$/);
  const inline = await fetch(base + url);
  assert.equal(inline.headers.get('content-disposition'), null, '不带 download 参数不得强制下载');
});

// v2.558 前端海报预览守卫：付费生成物必须有「点开大图 + 下载原图」入口，
// 且卡片缩略图必须用按钮承载（裸 img 不可键盘聚焦，读屏/键盘用户无法预览）。
test('前端海报卡片可开大图并下载原图，破图必须替换为可删占位', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
  assert.ok(html.includes('id="posterModal"'), 'index.html 必须有海报预览弹窗');
  assert.ok(html.includes('data-close="posterModal"'), '预览弹窗必须能关闭');
  assert.ok(html.includes('id="posterDownload"'), '预览弹窗必须有下载入口');
  assert.match(app, /data-poster-open=/, '卡片缩略图必须带预览触发标记');
  assert.match(app, /class="poster-open"/, '缩略图必须用按钮承载，键盘可达');
  assert.match(app, /\$\('myPostersList'\)\.addEventListener\('click'/, '预览点击必须走事件委托');
  assert.match(app, /'download=1'/, '下载链接必须带 download=1 让服务端补附件头');
  assert.match(app, /poster-dead/, '图片失效必须换成占位块而不是破图标');
  assert.match(app, /\.addEventListener\('error'/, '必须有图片加载失败兜底');
});

// v2.560 生成结果页的「保存」承诺必须有入口：此前结果区只有裸 <img>，提示语让用户
// 「选一张保存」，实际既不能点开也不能下载，只能长按——付费生成后最该顺畅的一步反而没有操作。
test('生成结果页高清海报必须可点开大图并下载，扩展名交给服务端决定', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const i = lines.findIndex((l) => l.includes('vc-poster-grid'));
  assert.ok(i >= 0, '未找到生成结果的海报网格（vc-poster-grid）');
  const block = lines.slice(i, i + 5).join('\n');
  assert.match(block, /data-poster-open=/, '结果海报必须带预览/下载入口');
  assert.match(block, /class="poster-open"/, '入口必须用按钮承载，键盘可达');
  assert.match(app, /wrap\.addEventListener\('click'/, '结果区点击必须走事件委托');
  assert.doesNotMatch(app, /setAttribute\('download',\s*'poster-/, '不得写死 .png（webp/jpeg 海报会被存成错误后缀）');
  assert.match(app, /setAttribute\('download', ''\)/, '下载文件名应交给服务端 Content-Disposition');
});

// v2.561 价值参考面板的认证海报结果同样必须有「看大图 + 下载原图」入口：
// 此前只有裸 <img> 且提示「可截图用于宣传」——39 积分付费生成后仍要靠截图，画质受损。
test('价值参考面板的认证海报必须可点开大图并下载', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const i = lines.findIndex((l) => l.includes("const pg = $('certPosters')"));
  assert.ok(i >= 0, '未找到认证海报渲染处（certPosters）');
  const block = lines.slice(i, i + 12).join('\n');
  assert.match(block, /data-poster-open=/, '认证海报必须带预览/下载入口');
  assert.match(block, /class="poster-open"/, '入口必须用按钮承载，键盘可达');
  assert.match(block, /\.onclick = \(e\)/, '点击必须走委托（每次生成重插卡片，逐张绑定会失效）');
  assert.doesNotMatch(app, /可截图用于宣传/, '支持下载后不得再引导用户截图');
});

// v2.561 我的海报卡片只显示体积，多次生成后无法区分哪张更新，删除时容易删错。
test('我的海报卡片必须显示生成时间', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const i = lines.findIndex((l) => l.includes('data-poster-card='));
  assert.ok(i >= 0, '未找到我的海报卡片模板');
  const block = lines.slice(i, i + 3).join('\n');
  assert.match(block, /posterTimeText\(it\.createdAt\)/, '卡片必须渲染生成时间');
  assert.match(app, /function posterTimeText\(iso\)/, '时间格式化应集中在一个函数');
});

// v2.562 多端/多标签页并发下删除海报：另一端已删时服务端返回 404，
// 此时目标已达成，把它当失败会留下删不掉的卡片与「海报不存在」假故障。
test('删除海报接口 404 必须按成功处理（多端已删 = 目标达成）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const i = lines.findIndex((l) => l.includes('async function deletePosterApi'));
  assert.ok(i >= 0, '未找到 deletePosterApi');
  const block = lines.slice(i, i + 8).join('\n');
  assert.match(block, /status === 404/, '404 必须短路为成功，不得抛错');
});

// v2.562 从「我的海报」预览里删掉的图，价值参考面板里同款格子不能留下点不开的残影。
test('预览弹窗删除后必须同步移除认证海报网格里的同款格子', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const i = lines.findIndex((l) => l.includes("$('posterDel').onclick"));
  assert.ok(i >= 0, '未找到预览弹窗删除处理');
  const block = lines.slice(i, i + 14).join('\n');
  assert.match(block, /certPosters/, '删除后必须同步清理认证海报网格');
  assert.match(block, /posterViewId/, '清理必须按当前预览的海报 id 定位');
});

// v2.562 认证海报表单读屏时几张图的名称完全相同，无法区分选哪张。
test('认证海报按钮的无障碍名必须带方案序号', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const i = lines.findIndex((l) => l.includes("const pg = $('certPosters')"));
  assert.ok(i >= 0, '未找到认证海报渲染处（certPosters）');
  const block = lines.slice(i, i + 12).join('\n');
  assert.match(block, /aria-label="\$\{escapeHtml\(t\('viewPoster'\) \+ ' ' \+ label\)\}"/, '无障碍名需含方案序号');
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
