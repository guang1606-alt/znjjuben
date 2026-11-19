/**
 * v2.573 存储配额与记账的静默失败收口
 * 背景：
 *  1) 删除海报时「删记录」与「软删 StorageObject（释放用量）」是两条独立写，后者失败被 `.catch(()=>{})` 吞掉，
 *     海报从列表消失但配额永久占着——用户既看不到也清不掉，且无日志可查。现改为单事务原子删除。
 *  2) 生成海报落库时 StorageObject 记账失败静默 → 存储用量少计（用户白拿容量）且无从排查；现只留痕不阻断。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'quota-secret';
process.env.JWT_REFRESH_SECRET = 'quota-refresh';
delete process.env.IMAGE_API_KEY; delete process.env.OPENAI_API_KEY;
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));
const { createApp } = require('../dist/server/app.js');
const { createValueAddedRouter } = require('../dist/routes/value-added.js');
const { persistImage } = require('../dist/lib/media-store.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ va: createValueAddedRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => {
  const done = () => { base = `http://127.0.0.1:${server.address().port}`; res(); };
  if (server.listening) return done();
  server.once('listening', done);
}));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

mem._seedUser({ id: 'quota-owner', balance: 500 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });

/** 捕获 console.error 输出（留痕断言用） */
function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  return Promise.resolve().then(fn).finally(() => { console.error = orig; }).then((r) => ({ r, logs }));
}

describe('存储配额与记账静默失败收口（v2.573）', { concurrency: 1 }, () => {
  it('删除海报时用量释放失败：整体回滚 + 明确报错 + 留痕（不出现“删了却仍占容量”）', async () => {
    const asset = await mem.mediaAsset.create({
      data: { userId: 'quota-owner', kind: 'poster', mime: 'image/png', size: 100, bytes: Buffer.alloc(100) },
    });
    await mem.storageObject.create({ data: { userId: 'quota-owner', kind: 'poster', bytes: 100, refId: asset.id } });

    const orig = mem.storageObject.updateMany.bind(mem.storageObject);
    let calls = 0;
    mem.storageObject.updateMany = async (args) => {
      calls += 1;
      if (calls === 1) throw new Error('storage release down');
      return orig(args);
    };
    let resp;
    const { logs } = await captureErr(async () => {
      resp = await fetch(base + `/api/va/posters/${asset.id}`, { method: 'DELETE', headers: H('quota-owner') });
    });
    mem.storageObject.updateMany = orig;

    assert.strictEqual(resp.status, 500, '释放失败不得谎报成功');
    assert.strictEqual((await resp.json()).error, '删除失败，请重试', '话术要可重试，不暴露内部异常');
    const still = await mem.mediaAsset.findUnique({ where: { id: asset.id } });
    assert.ok(still, '事务回滚：海报记录仍在（重试即可），不得删了记录留下占用');
    const usage = await mem.storageObject.aggregate({ where: { userId: 'quota-owner', deletedAt: null }, _sum: { bytes: true } });
    assert.strictEqual(usage._sum.bytes, 100, '配额口径保持一致，不出现记录与用量分叉');
    assert.ok(logs.some((l) => l.includes('[va.poster.delete]')), '失败必须留痕');
  });

  it('生成海报记账失败：图片照常返回永久地址，但写入 [media.accounting] 留痕', async () => {
    const fakeDb = {
      mediaAsset: { create: async () => ({ id: 'fake-media-1' }) },
      storageObject: { create: async () => { throw new Error('ledger down'); } },
    };
    const dataUri = 'data:image/png;base64,' + Buffer.from('fake-png-bytes').toString('base64');
    const { r: url, logs } = await captureErr(() => persistImage(dataUri, 'poster', fakeDb, 'quota-owner'));
    assert.strictEqual(url, '/media/fake-media-1', '记账失败不得阻断出图');
    assert.ok(logs.some((l) => l.includes('[media.accounting]')), '少计容量必须可观测');
  });
});
