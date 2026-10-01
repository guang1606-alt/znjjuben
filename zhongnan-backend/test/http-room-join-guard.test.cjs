const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'room-join-guard-secret';
process.env.JWT_REFRESH_SECRET = 'room-join-guard-refresh';
const { createApp } = require('../dist/server/app.js');
const { createRoomRouter } = require('../dist/routes/room.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const mem = createMemoryPrisma();
const app = createApp({ room: createRoomRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'owner', balance: 500 });
mem._seedUser({ id: 'invitee', balance: 500 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid) => fetch(base + p, { method: 'POST', headers: H(uid), body: JSON.stringify(b) });
const get = (p, uid) => fetch(base + p, { headers: H(uid) });

const SCRIPT = `第1集
日 内 私密书房
她决定暗中布局夺回公司，对手是背叛她的合伙人。
△她把一份文件锁进抽屉。
她：这一次，我不会再输。`;

describe('v2.294 围读邀请面加固：私人模式拒 join / 邀请码最小权限 / 重复 join 幂等', { concurrency: 1 }, () => {
  it('me_xn 私密房：他人凭邀请码 join 必须 403（模式语义：只有我与小南，不接受拉人）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'me_xn', title: '私密围读', scriptText: SCRIPT }, 'owner');
    assert.strictEqual(o.status, 200);
    const oj = await o.json();
    global.meXnCode = oj.inviteCode; global.meXnRoom = oj.roomId;
    const jr = await post('/api/room/read/join', { inviteCode: oj.inviteCode }, 'invitee');
    assert.strictEqual(jr.status, 403, `me_xn 房不得接受邀请加入（当前 ${jr.status} 放行=私密房可被闯入）`);
    const j = await jr.json();
    assert.ok(j.error, '必须给中文拒绝文案');
  });

  it('me_xn 房被拒之门外后：invitee 读消息流仍 403，拿不到 scriptText 剧本全文', async () => {
    const r = await get(`/api/room/${global.meXnRoom}/messages`, 'invitee');
    assert.strictEqual(r.status, 403);
  });

  it('xn_xn 全自动房：他人凭码 join 同样 403（无人值守模式没有拉人语义）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'xn_xn', scriptText: SCRIPT }, 'owner');
    const oj = await o.json();
    const jr = await post('/api/room/read/join', { inviteCode: oj.inviteCode }, 'invitee');
    assert.strictEqual(jr.status, 403, `xn_xn 房不得接受邀请加入（当前 ${jr.status} 放行）`);
  });

  it('user_user 协作房：join 仍 200 不受影响（防误伤既有协作路径）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'user_user', title: '协作房', scriptText: SCRIPT }, 'owner');
    const oj = await o.json();
    global.uuRoom = oj.roomId; global.uuCode = oj.inviteCode;
    const jr = await post('/api/room/read/join', { inviteCode: oj.inviteCode }, 'invitee');
    assert.strictEqual(jr.status, 200);
    const j = await jr.json();
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.roomId, oj.roomId);
  });

  it('重复 join 同一协作房：幂等返回 ok 但不重复写「进入围读室」消息', async () => {
    const before = await (await get(`/api/room/${global.uuRoom}/messages`, 'owner')).json();
    const joinMsgsBefore = before.messages.filter((m) => m.speakerUserId === 'invitee' && String(m.content).includes('进入围读室')).length;
    const jr = await post('/api/room/read/join', { inviteCode: global.uuCode }, 'invitee');
    assert.strictEqual(jr.status, 200, '重复 join 应幂等成功而非报错');
    const afterMsg = await (await get(`/api/room/${global.uuRoom}/messages`, 'owner')).json();
    const joinMsgsAfter = afterMsg.messages.filter((m) => m.speakerUserId === 'invitee' && String(m.content).includes('进入围读室')).length;
    assert.strictEqual(joinMsgsAfter, joinMsgsBefore, `重复 join 不得刷屏（前 ${joinMsgsBefore} 条，后 ${joinMsgsAfter} 条）`);
  });

  it('邀请码最小权限：member 的 /mine 响应不下发 inviteCode（切断链式再传播），owner 照常可见', async () => {
    const mj = await (await get('/api/room/mine', 'invitee')).json();
    const joined = mj.rooms.find((r) => r.id === global.uuRoom);
    assert.ok(joined, '参与者必须能在列表看到自己的参与房');
    assert.strictEqual(joined.role, 'member');
    assert.strictEqual(joined.inviteCode, undefined, 'member 不得拿到邀请码（当前泄漏=可背着房主无限拉人）');
    const oj = await (await get('/api/room/mine', 'owner')).json();
    const owned = oj.rooms.find((r) => r.id === global.uuRoom);
    assert.ok(owned && owned.role === 'owner');
    assert.strictEqual(owned.inviteCode, global.uuCode, 'owner 必须继续能看到自己的邀请码');
  });
});
