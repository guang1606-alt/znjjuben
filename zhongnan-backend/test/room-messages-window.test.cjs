/**
 * v2.587 编剧室发言流窗口必须"取最新"而不是"取最早"：
 * 旧实现 `orderBy createdAt asc, take 500` 取的是房间最早 500 条——超过 500 条后，
 * 新发言全部落在窗口外，前端（每次发问整页拉取）看到的永远是旧记录，直播感断裂。
 * 本用例锁定：默认返回最近 500 条（正序）+ total/hasMore；before 游标可继续回看更早，且不重不漏。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'gen-test-secret';
process.env.JWT_REFRESH_SECRET = 'gen-test-refresh';
const { createApp } = require('../dist/server/app.js');
const { createRoomRouter } = require('../dist/routes/room.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ room: createRoomRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {});
});

const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);

function seedRoom(id, count) {
  mem._seedUser({ id: 'u_room', level: 'BASIC', balance: 0 });
  mem._writersRooms.push({
    id, kind: 'PITCH', ownerId: 'u_room', participantIds: [], state: 'ACTIVE',
    payload: {}, createdAt: new Date(T0), updatedAt: new Date(T0),
  });
  for (let i = 1; i <= count; i++) {
    mem._roomMessages.push({
      id: `${id}_m${i}`, roomId: id, speakerType: i % 2 ? 'USER' : 'XN',
      speakerName: i % 2 ? '我' : '小南', seat: null, content: `第${i}条`,
      createdAt: new Date(T0 + i * 1000),
    });
  }
}

async function getMessages(roomId, query = '') {
  const resp = await fetch(`${base}/api/room/${roomId}/messages${query}`, {
    headers: { Authorization: `Bearer ${signAccess({ sub: 'u_room', level: 'BASIC' })}` },
  });
  return { status: resp.status, body: await resp.json() };
}

describe('编剧室发言流取最新窗口（v2.587）', { concurrency: 1 }, () => {
  it('超过 500 条时默认返回最近 500 条（正序），并给出 total/hasMore', async () => {
    seedRoom('wr_long', 520);
    const r = await getMessages('wr_long');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.messages.length, 500, '窗口大小 500');
    assert.strictEqual(r.body.messages[0].content, '第21条', '窗口应从第 21 条开始，而不是停在最早 500 条');
    assert.strictEqual(r.body.messages[499].content, '第520条', '最后一条必须是最新发言');
    assert.strictEqual(r.body.total, 520);
    assert.strictEqual(r.body.hasMore, true);
  });

  it('before 游标回看更早：不重不漏，回到底部后 hasMore=false', async () => {
    const first = await getMessages('wr_long');
    const cursor = first.body.messages[0].createdAt;
    const r = await getMessages('wr_long', `?before=${encodeURIComponent(cursor)}`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.messages.length, 20, '剩余恰好 20 条');
    assert.strictEqual(r.body.messages[0].content, '第1条');
    assert.strictEqual(r.body.messages[19].content, '第20条', '游标前一条是第 20 条，不重复第 21 条');
    assert.strictEqual(r.body.hasMore, false);
  });

  it('小房间全量返回且 hasMore=false', async () => {
    seedRoom('wr_small', 3);
    const r = await getMessages('wr_small');
    assert.strictEqual(r.body.messages.length, 3);
    assert.deepStrictEqual(r.body.messages.map((m) => m.content), ['第1条', '第2条', '第3条']);
    assert.strictEqual(r.body.hasMore, false);
    assert.strictEqual(r.body.total, 3);
  });
});
