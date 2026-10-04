/**
 * v2.309 read/join 协作房并发加入加固（participantIds lost update）——先红后绿
 *
 * 缺口：room.ts /read/join 此前是「findUnique 读快照 → includes 判重 → 整体数组覆盖
 *   update({ data: { participantIds: [...快照, 我] } })」。
 * 两个新用户 A、B 凭同一邀请码在同一窗口加入（owner 群发邀请码后两人同时点入）：
 *   - 两路请求都读到 participantIds=[owner] 的快照；
 *   - A 写 [owner, A]，B 写 [owner, B] —— 后写整体覆盖先写，A 从参与者集合消失；
 * 危害链：A 客户端拿到 200、房内还落了「进入围读室」消息，但 accessibleRoom（room.ts:114）
 *   只认 ownerId/participantIds —— A 随后发言、读消息、AI 围读全部 403：「加入成功却进不去」。
 *
 * 修复：改用 Prisma scalar list 的条件原子追加
 *   updateMany({ where: { id, NOT: { participantIds: { has: uid } } }, data: { participantIds: { push: uid } } })
 *   PG 行锁串行化两个 array_append，条件在锁上后按最新行版本评估，无丢失；
 *   count=0 即「已在房间」，幂等返回 200 且不重复写进入消息。
 *
 * 确定性复现（不依赖真并发时序）：mock findUnique 对 inviteCode 查询恒返回加入前的过期
 *   快照 [owner]，等价于「两路请求在任一写入前完成读取」；旧实现整体覆盖必丢一人。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'join-race-secret';
process.env.JWT_REFRESH_SECRET = 'join-race-refresh';
const { createApp } = require('../dist/server/app.js');
const { createRoomRouter } = require('../dist/routes/room.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ room: createRoomRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((r) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const R = '/api/room';
mem._seedUser({ id: 'owner', balance: 500 });
mem._seedUser({ id: 'joinerA', balance: 500 });
mem._seedUser({ id: 'joinerB', balance: 500 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid) => fetch(base + p, { method: 'POST', headers: H(uid), body: JSON.stringify(b ?? {}) });
const get = (p, uid) => fetch(base + R + p, { headers: H(uid) });

const SCRIPT = `第1集
日 内 会议室
她带着证据推门而入，所有人的目光集中过来。
△她把U盘拍在桌上。
她：今天该有个了断。`;

/** 开一间 user_user 协作房，返回 { roomId, inviteCode } */
async function openRoom(title) {
  const r = await post(R + '/read/open', { readMode: 'user_user', title, scriptText: SCRIPT }, 'owner');
  assert.strictEqual(r.status, 200, '开房东主流程前置失败 status=' + r.status);
  return r.json();
}

/**
 * 让 writersRoom.findUnique 对指定邀请码查询恒返回「加入前快照」（participantIds 仅 owner），
 * 等价于并发两路在任何写入提交前完成读取；id 查询（accessibleRoom）保持真实。
 */
function freezeJoinSnapshot(code) {
  const real = mem.writersRoom.findUnique.bind(mem.writersRoom);
  mem.writersRoom.findUnique = async (args) => {
    const row = await real(args);
    if (args?.where?.inviteCode === code && row) return { ...row, participantIds: ['owner'] };
    return row;
  };
  return () => { mem.writersRoom.findUnique = real; };
}

/** 数某用户的「进入围读室」消息条数 */
async function joinMsgCount(roomId, uid) {
  const r = await get(`/${roomId}/messages`, 'owner');
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  return body.messages.filter((m) => m.speakerUserId === uid && String(m.content).includes('进入围读室')).length;
}

describe('v2.309 join 竞态：两人凭同一邀请码同时加入，参与者集合不得互踩', { concurrency: 1 }, () => {
  it('并发 A、B 都 200，最终 participantIds 必须同时含 A、B（旧整体覆盖必丢其一）', async () => {
    const { roomId, inviteCode } = await openRoom('并发房');
    const restore = freezeJoinSnapshot(inviteCode);
    let rs;
    try {
      rs = await Promise.all([
        post(R + '/read/join', { inviteCode }, 'joinerA'),
        post(R + '/read/join', { inviteCode }, 'joinerB'),
      ]);
    } finally { restore(); }
    assert.deepStrictEqual(rs.map((x) => x.status), [200, 200]);

    const room = await mem.writersRoom.findUnique({ where: { id: roomId } });
    const ids = room.participantIds || [];
    assert.ok(ids.includes('joinerA'), `A 必须在参与者集合（实际=[${ids.join(',')}]，后写覆盖先写=A 虽收 200 却被踢出）`);
    assert.ok(ids.includes('joinerB'), `B 必须在参与者集合（实际=[${ids.join(',')}]，后写覆盖先写=B 虽收 200 却被踢出）`);
  });

  it('危害链验收：并发加入后 A、B 发言都必须 200（被覆盖者旧实现恒 403）', async () => {
    const { roomId, inviteCode } = await openRoom('发言房');
    const restore = freezeJoinSnapshot(inviteCode);
    try {
      await Promise.all([
        post(R + '/read/join', { inviteCode }, 'joinerA'),
        post(R + '/read/join', { inviteCode }, 'joinerB'),
      ]);
    } finally { restore(); }

    for (const uid of ['joinerA', 'joinerB']) {
      const sp = await post(R + `/read/${roomId}/speak`, { content: `我是${uid}，报到` }, uid);
      assert.strictEqual(sp.status, 200, `${uid} 加入后发言被拒（${sp.status}）= 加入成功却进不去，accessibleRoom 权限丢失`);
    }
  });

  it('幂等不刷屏：同一用户重复 join 只 200，参与者不出现重复 id，进入消息仅一条', async () => {
    const { roomId, inviteCode } = await openRoom('幂等房');
    const first = await post(R + '/read/join', { inviteCode }, 'joinerA');
    assert.strictEqual(first.status, 200);
    const second = await post(R + '/read/join', { inviteCode }, 'joinerA');
    assert.strictEqual(second.status, 200, '重复 join 必须幂等成功');
    const room = await mem.writersRoom.findUnique({ where: { id: roomId } });
    assert.strictEqual((room.participantIds || []).filter((x) => x === 'joinerA').length, 1, 'participantIds 不得出现重复 id');
    assert.strictEqual(await joinMsgCount(roomId, 'joinerA'), 1, '重复 join 不得重复写「进入围读室」');
  });

  it('对照：无竞态单人正常 join 仍 200 且写一条进入消息（条件追加不得误伤正常流）', async () => {
    const { roomId, inviteCode } = await openRoom('对照房');
    const r = await post(R + '/read/join', { inviteCode }, 'joinerB');
    assert.strictEqual(r.status, 200);
    const room = await mem.writersRoom.findUnique({ where: { id: roomId } });
    assert.deepStrictEqual(room.participantIds, ['owner', 'joinerB']);
    assert.strictEqual(await joinMsgCount(roomId, 'joinerB'), 1);
  });
});
