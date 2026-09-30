const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'room-secret';
process.env.JWT_REFRESH_SECRET = 'room-refresh';
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

mem._seedUser({ id: 'rich', balance: 500 });
mem._seedUser({ id: 'poor', balance: 3 });
mem._seedUser({ id: 'other', balance: 200 });
const H = (uid) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` });
const post = (p, b, uid) => fetch(base + p, { method: 'POST', headers: H(uid), body: JSON.stringify(b) });
const get = (p, uid) => fetch(base + p, { headers: H(uid) });
const bal = (uid) => mem._accounts.get(uid).balance;

const SCRIPT = `第1集
日 内 小店
她被老板刁难逼退，对方拍桌叫她滚。她决定暗中夺回店铺，藏着前主厨的身份秘密。
△她一边擦桌子一边把录音笔推到账本下。
老板：你被开除了，现在就走。
她（抬眼）：巧了，这店租约写的我名。`;

describe('选题会闭环', { concurrency: 1 }, () => {
  it('未登录401', async () => {
    const r = await fetch(base + '/api/room/pitch/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: 'x' }) });
    assert.strictEqual(r.status, 401);
  });
  it('开场扣20积分并返回议程与关键问题', async () => {
    const before = bal('rich');
    const r = await post('/api/room/pitch/open', { idea: '被辞退的女厨师想要夺回餐厅，前合伙人打压，她暗中布局', audience: '25-40女性' }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.roomId && j.opened.agenda.length === 5 && j.opened.questions.length >= 4);
    assert.strictEqual(j.points, 20);
    assert.strictEqual(bal('rich'), before - 20);
    global.pitchRoom = j.roomId;
  });
  it('形成决议再扣20，返回GO/HOLD/NO与选题卡', async () => {
    const before = bal('rich');
    const r = await post(`/api/room/pitch/${global.pitchRoom}/decide`, { relation: '师徒反目', conflict: '秘方股权口碑三层冲突', scenes: '后厨小店', episodes: 70 }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(['GO', 'HOLD', 'NO'].includes(j.verdict.decision));
    assert.ok(j.verdict.scores.total >= 0);
    assert.strictEqual(bal('rich'), before - 20);
  });
  it('余额不足：400且不建会', async () => {
    const r = await post('/api/room/pitch/open', { idea: '一个想要夺回人生的女性成长故事' }, 'poor');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(bal('poor'), 3);
  });
});

describe('剧本围读四模式闭环', { concurrency: 1 }, () => {
  it('建室不扣分，返回邀请码与四模式', async () => {
    const before = bal('rich');
    const r = await post('/api/room/read/open', { readMode: 'user_user', title: '测试围读', scriptText: SCRIPT }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.roomId && j.inviteCode && j.readModes.length === 4);
    assert.strictEqual(bal('rich'), before);
    global.readRoom = j.roomId; global.code = j.inviteCode;
  });
  it('非参与者无法查看/围读（403）', async () => {
    const r = await post(`/api/room/read/${global.readRoom}/ai-read`, {}, 'other');
    assert.strictEqual(r.status, 403);
  });
  it('凭邀请码加入后成为参与者', async () => {
    const r = await post('/api/room/read/join', { inviteCode: global.code }, 'other');
    assert.strictEqual(r.status, 200);
    const bad = await post('/api/room/read/join', { inviteCode: 'ZZZZZZ' }, 'other');
    assert.strictEqual(bad.status, 404);
  });
  it('AI围读扣30积分，产出多席位意见与修改清单', async () => {
    const before = bal('other');
    const r = await post(`/api/room/read/${global.readRoom}/ai-read`, { mode: 'LIVE' }, 'other');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 30);
    assert.ok(Array.isArray(j.result.notes));
    assert.ok(j.result.scores && typeof j.result.scores.overall === 'number');
    assert.strictEqual(bal('other'), before - 30);
  });
  it('发言流含XN多席位与真人发言', async () => {
    await post(`/api/room/read/${global.readRoom}/speak`, { content: '我觉得开头可以更快' }, 'other');
    const r = await get(`/api/room/${global.readRoom}/messages`, 'other');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.messages.some((m) => m.speakerType === 'XN'));
    assert.ok(j.messages.some((m) => m.speakerType === 'USER'));
  });
  it('xn_xn自动围读模式同样可跑且扣费', async () => {
    const o = await post('/api/room/read/open', { readMode: 'xn_xn', scriptText: SCRIPT }, 'rich');
    const oj = await o.json();
    const r = await post(`/api/room/read/${oj.roomId}/ai-read`, { }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.result.summary);
    // c198：无人模式没有真人讨论，结论不得伪造讨论点
    assert.deepStrictEqual(j.result.discussionPoints, []);
  });
  it('我的编剧室列表：只返摘要（无 scriptText/payload/ownerId），房主/参与者均可见且带 role，按 updatedAt 倒序；未登录 401', async () => {
    const anon = await fetch(base + '/api/room/mine');
    assert.strictEqual(anon.status, 401);
    const r = await get('/api/room/mine', 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.rooms.length >= 2);
    for (const room of j.rooms) {
      assert.strictEqual(room.scriptText, undefined, '列表禁止携带剧本文本（c196 瘦身）');
      assert.strictEqual(room.payload, undefined, '列表禁止携带 payload 大 Json（c196 瘦身）');
      assert.strictEqual(room.ownerId, undefined, '列表不泄露内部 ownerId 字段');
      assert.strictEqual(room.role, 'owner', 'rich 是自己全部房间的房主');
      assert.ok(room.id && room.kind && room.title && room.state);
    }
    const times = j.rooms.map((x) => new Date(x.updatedAt).getTime());
    assert.deepStrictEqual(times, [...times].sort((a, b) => b - a), '必须按 updatedAt 倒序');
    // c197：凭邀请码加入的参与房必须出现在“我的编剧室”，且只看到参与的那一间（看不到 rich 私有房）
    const oj = await (await get('/api/room/mine', 'other')).json();
    assert.ok(Array.isArray(oj.rooms) && oj.rooms.length === 1, '参与者只应看到自己加入的房，got ' + JSON.stringify((oj.rooms || []).map((x) => x.id)));
    const joined = oj.rooms[0];
    assert.strictEqual(joined.id, global.readRoom, '必须是凭码加入的那间 user_user 围读房');
    assert.strictEqual(joined.role, 'member', '加入者角色必须是 member');
    assert.strictEqual(joined.scriptText, undefined, '参与房列表同样禁止携带剧本文本');
    assert.strictEqual(joined.payload, undefined, '参与房列表同样禁止携带 payload');
    assert.strictEqual(joined.ownerId, undefined, '参与房列表不泄露 ownerId');
  });
});

describe('选题会多轮发言必须累积进判定（c197 讨论不是表演）', { concurrency: 1 }, () => {
  it('主持追问与最终决议都消费历史USER发言：发言房的故事分高于沉默对照房，且第二轮不重复追问第一轮已答信息', async () => {
    // 房A：弱开场 idea（无任何目标/对抗方/规模信号），分两轮补充
    const oa = await post('/api/room/pitch/open', { idea: '一个女性成长的故事' }, 'rich');
    assert.strictEqual(oa.status, 200);
    const aid = (await oa.json()).roomId;
    const s1 = await post(`/api/room/pitch/${aid}/speak`, { content: '她想要夺回自己创办的餐厅，决定暗中布局，一步步拿回股权' }, 'rich');
    assert.strictEqual(s1.status, 200);
    const j1 = await s1.json();
    assert.ok(/对抗方|集数/.test(j1.reply), '第一轮：目标已答、对抗方与规模未答，主持应继续追问');
    const s2 = await post(`/api/room/pitch/${aid}/speak`, { content: '她的对手是背叛她的前合伙人，小成本制作，场景就后厨和街边小店，预计60集' }, 'rich');
    assert.strictEqual(s2.status, 200);
    const j2 = await s2.json();
    assert.ok(!j2.reply.includes('主动目标'), '第一轮已交代主动目标，第二轮主持不应丢失历史重复追问：' + j2.reply);
    const da = await (await post(`/api/room/pitch/${aid}/decide`, {}, 'rich')).json();
    assert.ok(da.ok && da.verdict);
    // 房B：另一条同质弱开场（无目标/对抗方/规模信号），全程零发言，直接决议（对照房）
    const ob = await post('/api/room/pitch/open', { idea: '一个普通人重新开始的故事' }, 'rich');
    const bid = (await ob.json()).roomId;
    const db = await (await post(`/api/room/pitch/${bid}/decide`, {}, 'rich')).json();
    assert.ok(db.ok && db.verdict);
    assert.ok(da.verdict.scores.story > db.verdict.scores.story,
      `讨论房决议必须吃到历史发言的主动目标信号（故事分 ${da.verdict.scores.story} 应高于沉默房 ${db.verdict.scores.story}）`);
  });
});

describe('围读真人讨论必须进入AI围读结论（c198 讨论不是孤岛）', { concurrency: 1 }, () => {
  it('user_user房两人发言→ai-read结论discussionPoints含真人要点（路由真接线，非引擎单测自嗨）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'user_user', title: '讨论进结论房', scriptText: SCRIPT }, 'rich');
    assert.strictEqual(o.status, 200);
    const oj = await o.json();
    const rid = oj.roomId;
    const jr = await post('/api/room/read/join', { inviteCode: oj.inviteCode }, 'other');
    assert.strictEqual(jr.status, 200);
    // 房主与参与者各发一条带明确席位信号的真人意见
    const s1 = await post(`/api/room/read/${rid}/speak`, { content: '我觉得开头太慢了，主角动机也立不住' }, 'rich');
    assert.strictEqual(s1.status, 200);
    const s2 = await post(`/api/room/read/${rid}/speak`, { content: '成本太高，这一场不能再加新场景了，预算扛不住' }, 'other');
    assert.strictEqual(s2.status, 200);
    const before = bal('rich');
    const r = await post(`/api/room/read/${rid}/ai-read`, { mode: 'LIVE' }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.points, 30);
    assert.strictEqual(bal('rich'), before - 30);
    assert.ok(Array.isArray(j.result.discussionPoints), '结论必须带 discussionPoints 数组');
    const seats = j.result.discussionPoints.map((p) => p.seat);
    assert.ok(seats.includes('editor'), '责编信号（开头/动机）必须进结论：' + JSON.stringify(j.result.discussionPoints));
    assert.ok(seats.includes('producer'), '制片信号（成本/加场/预算）必须进结论');
    // 入房系统消息“进入围读室”零信号词，不得被误归类成讨论点
    assert.ok(j.result.discussionPoints.every((p) => !String(p.point).includes('进入围读室')), '系统入房消息不得混入讨论点');
    assert.ok(j.result.discussionPoints.every((p) => p.seatName && typeof p.adopted === 'boolean'));
    global.c198Room = rid;
  });
});

describe('c199 复盘：EN房主持人名本地化 × 重跑制式可切换（白名单）', { concurrency: 1 }, () => {
  const HAN = /[一-龥]/;
  it('EN选题会：开场主持/流程提示/决议主持的 speakerName 全部零中文（修写死“小南(主持)”）', async () => {
    const o = await post('/api/room/pitch/open', { idea: 'A fired chef wants her restaurant back and fights her ex-partner.', audience: 'women 25-40', lang: 'en' }, 'rich');
    assert.strictEqual(o.status, 200);
    const rid = (await o.json()).roomId;
    let j = await (await get(`/api/room/${rid}/messages`, 'rich')).json();
    const hosts = j.messages.filter((m) => m.seat === 'host');
    assert.ok(hosts.length >= 2, '开场主持消息+流程提示消息都应存在');
    for (const h of hosts) {
      assert.ok(!HAN.test(h.speakerName), 'EN房主持人名不得出现中文：' + h.speakerName);
      assert.strictEqual(h.speakerName, 'Xiaonan (host)');
    }
    const d = await post(`/api/room/pitch/${rid}/decide`, { relation: 'mentor turns rival', conflict: 'secret recipe vs equity, 6+ words', scenes: 'kitchen and shop', episodes: 60 }, 'rich');
    assert.strictEqual(d.status, 200);
    j = await (await get(`/api/room/${rid}/messages`, 'rich')).json();
    const verdictHost = j.messages.filter((m) => m.seat === 'host' && String(m.content).includes('Pitch verdict'));
    assert.strictEqual(verdictHost.length, 1);
    assert.strictEqual(verdictHost[0].speakerName, 'Xiaonan (host)', '决议主持人名必须随房语言本地化');
    assert.ok(!HAN.test(verdictHost[0].speakerName));
  });
  it('EN围读：ai-read主持人结论 speakerName 为 Xiaonan notes，零中文（修写死“小南记录”）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'me_xn', scriptText: SCRIPT, lang: 'en' }, 'rich');
    assert.strictEqual(o.status, 200);
    const rid = (await o.json()).roomId;
    const r = await post(`/api/room/read/${rid}/ai-read`, { mode: 'LIVE', clientToken: 'c199-en-host-1' }, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await (await get(`/api/room/${rid}/messages`, 'rich')).json();
    const hosts = j.messages.filter((m) => m.seat === 'host');
    assert.ok(hosts.length >= 2, '建室主持+结论主持都应存在');
    for (const h of hosts) {
      assert.strictEqual(h.speakerName, 'Xiaonan notes', 'EN围读房主持人名必须英文：' + h.speakerName);
      assert.ok(!HAN.test(h.speakerName));
    }
  });
  it('重跑ai-read时切换制式必须生效并回写payload；非法制式忽略（修payload永久覆盖body的死控件）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'me_xn', scriptText: SCRIPT, mode: 'LIVE' }, 'rich');
    assert.strictEqual(o.status, 200);
    const rid = (await o.json()).roomId;
    let j = await (await get(`/api/room/${rid}/messages`, 'rich')).json();
    assert.strictEqual(j.room.payload.scriptMode, 'LIVE', '开房制式应为LIVE');
    const before = bal('rich');
    const r1 = await post(`/api/room/read/${rid}/ai-read`, { mode: 'AIGC', clientToken: 'c199-mode-aigc' }, 'rich');
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(bal('rich'), before - 30, '重跑是新付费动作，正常扣30');
    j = await (await get(`/api/room/${rid}/messages`, 'rich')).json();
    assert.strictEqual(j.room.payload.scriptMode, 'AIGC', '用户重跑时切AIGC必须生效（当前被open时payload永久覆盖）');
    const r2 = await post(`/api/room/read/${rid}/ai-read`, { mode: 'NOPE', clientToken: 'c199-mode-bad' }, 'rich');
    assert.strictEqual(r2.status, 200, '非法制式不应400（容错），但必须被忽略');
    j = await (await get(`/api/room/${rid}/messages`, 'rich')).json();
    assert.strictEqual(j.room.payload.scriptMode, 'AIGC', '非法制式不得污染已选制式');
  });
});

describe('c200 围读结论→定点改写包 GET /read/:id/rewrite-pack（只读/零扣费/确定性）', { concurrency: 1 }, () => {
  // 关联项目分集（模拟真实作品页围读入口）
  mem.project.create({ data: { id: 'c200proj', userId: 'rich', title: 'c200围读项目', format: 'LIVE' } });
  mem.script.create({ data: { id: 'c200sc', projectId: 'c200proj', epNo: 3, title: '第三集', content: SCRIPT, version: 1 } });

  it('粘贴文本房：linked=false（无项目落点），不泄露 projectId', async () => {
    const o = await post('/api/room/read/open', { readMode: 'me_xn', scriptText: SCRIPT }, 'rich');
    const rid = (await o.json()).roomId;
    await post(`/api/room/read/${rid}/ai-read`, { clientToken: 'c200-paste-read' }, 'rich');
    const before = bal('rich');
    const r = await get(`/api/room/read/${rid}/rewrite-pack`, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.linked, false, '粘贴房无关联项目，前端只能保留复制出口');
    assert.strictEqual(j.projectId, undefined, 'linked=false 时不得下发 projectId');
    assert.deepStrictEqual(j.packs, []);
    assert.strictEqual(bal('rich'), before, '只读端点零扣费');
  });

  it('未围读先取包：ready=false 但 linked 信息照常（前端引导先围读，不409）', async () => {
    const o = await post('/api/room/read/open', { readMode: 'me_xn', scriptId: 'c200sc' }, 'rich');
    const rid = (await o.json()).roomId;
    const r = await get(`/api/room/read/${rid}/rewrite-pack`, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.linked, true);
    assert.strictEqual(j.ready, false);
    assert.deepStrictEqual(j.packs, []);
  });

  it('挂项目分集房 ai-read 后：linked/mine/ready=true，packs 与结论 actionItems 同口径，带落点 projectId/epNo/scriptId', async () => {
    const o = await post('/api/room/read/open', { readMode: 'me_xn', scriptId: 'c200sc', title: '分集围读' }, 'rich');
    const rid = (await o.json()).roomId;
    const before = bal('rich');
    const ar = await post(`/api/room/read/${rid}/ai-read`, { clientToken: 'c200-linked-read' }, 'rich');
    assert.strictEqual(ar.status, 200);
    const aj = await ar.json();
    assert.strictEqual(bal('rich'), before - 30, '只有围读扣费');
    const r = await get(`/api/room/read/${rid}/rewrite-pack`, 'rich');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.linked, true);
    assert.strictEqual(j.mine, true, '项目主人 mine=true（前端才允许带去改写）');
    assert.strictEqual(j.ready, true);
    assert.strictEqual(j.projectId, 'c200proj');
    assert.strictEqual(j.scriptId, 'c200sc');
    assert.strictEqual(j.epNo, 3);
    assert.ok(j.scriptTitle && typeof j.scriptTitle === 'string');
    assert.ok(Array.isArray(j.packs) && j.packs.length >= 1, '差剧本必须产出可改写包，got ' + j.packs.length);
    assert.strictEqual(j.packs.length, aj.result.actionItems.length, 'packs 必须与修改清单同口径');
    assert.ok(Array.isArray(j.discussionPoints), '真人讨论点必须随包，供作品页呈现新增关注');
    for (const pk of j.packs) {
      assert.ok(pk.fix && pk.fix.rule && pk.fix.dimLabel && pk.fix.advice, '每条 pack 必须是 /fix 可直接消费的结构');
      assert.ok(pk.fix.rule.length <= 60 && pk.fix.dimLabel.length <= 20 && pk.fix.advice.length <= 500, '字段必须满足 fix schema 上限');
      assert.ok(['P0', 'P1'].includes(pk.priority) && pk.seatName && pk.suggestion);
    }
    // 字数偏差意见必须带 format.length（基础会员可改写的语义同源规则号）
    assert.ok(j.packs.some((p) => p.fix.rule === 'format.length'), '字数意见规则号必须透传到包');
    // 再次 GET 确定性一致、零扣费
    const r2 = await get(`/api/room/read/${rid}/rewrite-pack`, 'rich');
    const j2 = await r2.json();
    assert.deepStrictEqual(j2.packs.map((p) => p.fix.rule), j.packs.map((p) => p.fix.rule));
    assert.strictEqual(bal('rich'), before - 30, '重复取包不扣费');
    global.c200Room = rid; global.c200Code = (await (await get(`/api/room/${rid}/messages`, 'rich')).json()).room.inviteCode;
  });

  it('非参与者 403；未登录 401', async () => {
    const anon = await fetch(base + `/api/room/read/${global.c200Room}/rewrite-pack`);
    assert.strictEqual(anon.status, 401);
    const r = await get(`/api/room/read/${global.c200Room}/rewrite-pack`, 'other');
    assert.strictEqual(r.status, 403, '围读内容参与权限与房内一致，不得被只读端点绕过');
  });

  it('凭码加入的参与者：可见包但 mine=false（/fix 只认项目主人，前端据此禁用，避免点了才403）', async () => {
    const jr = await post('/api/room/read/join', { inviteCode: global.c200Code }, 'other');
    assert.strictEqual(jr.status, 200);
    const r = await get(`/api/room/read/${global.c200Room}/rewrite-pack`, 'other');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.linked, true);
    assert.strictEqual(j.mine, false, '项目归 rich，参与者 other 不能拿包去改他人项目');
    assert.ok(j.packs.length >= 1, '参与围读的人仍能看意见本身（复制讨论用途不受限）');
  });
});

// c201 复盘：版本漂移名实相符、pack 服务端会员闸门元数据、参与者最小权限
describe('c201 rewrite-pack 加固（版本漂移/闸门元数据/最小权限）', { concurrency: 1 }, () => {
  mem._seedUser({ id: 'adv', level: 'ADVANCED', balance: 500 });
  mem.project.create({ data: { id: 'c201proj', userId: 'adv', title: 'c201漂移项目', format: 'LIVE' } });
  mem.script.create({ data: { id: 'c201v1', projectId: 'c201proj', epNo: 1, title: '第一集', content: SCRIPT, version: 1 } });
  mem.script.create({ data: { id: 'c201v2', projectId: 'c201proj', epNo: 1, title: '第一集v2', content: SCRIPT + '\n（修订版）', version: 2 } });
  const HL = (uid, level) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level })}` });

  it('版本漂移：围读冻结 v1、该集已出 v2，必须回 roomVersion=1/currentVersion=2/versionDrift=true，不得静默改最新版', async () => {
    const o = await fetch(base + '/api/room/read/open', {
      method: 'POST', headers: HL('adv', 'ADVANCED'),
      body: JSON.stringify({ readMode: 'me_xn', scriptId: 'c201v1', title: 'c201漂移围读' }),
    });
    const rid = (await o.json()).roomId;
    await fetch(base + `/api/room/read/${rid}/ai-read`, {
      method: 'POST', headers: HL('adv', 'ADVANCED'),
      body: JSON.stringify({ clientToken: 'c201-drift-read' }),
    });
    const r = await fetch(base + `/api/room/read/${rid}/rewrite-pack`, { headers: HL('adv', 'ADVANCED') });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.roomVersion, 1, '围读意见基于开房时冻结的 v1');
    assert.strictEqual(j.currentVersion, 2, '该集最新版已是 v2');
    assert.strictEqual(j.versionDrift, true, '存在漂移必须显性告知，前端提示改写作用于最新版');
    global.c201DriftRoom = rid;
  });

  it('无漂移：围读版即最新版 versionDrift=false', async () => {
    const r = await get(`/api/room/read/${global.c200Room}/rewrite-pack`, 'rich');
    const j = await r.json();
    assert.strictEqual(j.roomVersion, 1);
    assert.strictEqual(j.currentVersion, 1);
    assert.strictEqual(j.versionDrift, false, '无新版本时不得误报漂移');
  });

  it('每条 pack 带服务端闸门 gate{allowed,needLevel}：FREE 房主 format.length 需 BASIC（前端提前置灰，而非点了才403）', async () => {
    const r = await get(`/api/room/read/${global.c200Room}/rewrite-pack`, 'rich');
    const j = await r.json();
    assert.ok(j.packs.length >= 1);
    for (const pk of j.packs) {
      assert.ok(pk.gate && typeof pk.gate.allowed === 'boolean', '每条 pack 必须带 gate.allowed（服务端按 DB 等级判定，不信前端）');
      assert.ok(['BASIC', 'ADVANCED'].includes(pk.gate.needLevel), 'needLevel 只能是 BASIC/ADVANCED');
    }
    const lenPack = j.packs.find((p) => p.fix.rule === 'format.length');
    assert.ok(lenPack, '字数意见必须存在');
    assert.strictEqual(lenPack.gate.allowed, false, 'rich 在 DB 是 FREE，基础润色也不可用');
    assert.strictEqual(lenPack.gate.needLevel, 'BASIC');
    // 深度规则（lint 白名单外的 read.* 兜底号或 craft 规则号）必须要求 ADVANCED，不得被 dimLabel 降级
    const deep = j.packs.filter((p) => p.fix.rule === 'dialog.aiTone' || p.fix.rule.startsWith('read.'));
    for (const p of deep) assert.strictEqual(p.gate.needLevel, 'ADVANCED');
  });

  it('ADVANCED 房主：全部 packs gate.allowed=true（高级会员覆盖台词润色与深度优化）', async () => {
    const r = await fetch(base + `/api/room/read/${global.c201DriftRoom}/rewrite-pack`, { headers: HL('adv', 'ADVANCED') });
    const j = await r.json();
    assert.ok(j.packs.length >= 1);
    for (const pk of j.packs) assert.strictEqual(pk.gate.allowed, true, `规则 ${pk.fix.rule} 对 ADVANCED 应放行`);
  });

  it('参与者 mine=false：最小权限——不下发 projectId/scriptId，只给意见内容', async () => {
    const r = await get(`/api/room/read/${global.c200Room}/rewrite-pack`, 'other');
    const j = await r.json();
    assert.strictEqual(j.mine, false);
    assert.strictEqual(j.projectId, undefined, '他人项目 ID 不得下发给参与者');
    assert.strictEqual(j.scriptId, undefined, '他人剧本 ID 不得下发给参与者');
    assert.strictEqual(j.latestScriptId, undefined, 'c202：最新版剧本 ID 同样不得下发给参与者');
    assert.ok(j.packs.length >= 1, '意见内容本身仍可复制');
  });

  it('c202 房主漂移房：latestScriptId 指向该集最新版 v2（供“基于最新版重新围读”桥接）', async () => {
    const r = await fetch(base + `/api/room/read/${global.c201DriftRoom}/rewrite-pack`, { headers: HL('adv', 'ADVANCED') });
    const j = await r.json();
    assert.strictEqual(j.scriptId, 'c201v1', '房内冻结的仍是 v1');
    assert.strictEqual(j.latestScriptId, 'c201v2', 'latestScriptId 必须指向最新版行，前端才能用它开新围读房');
    assert.strictEqual(j.latestVersion, 2);
  });

  it('c202 无漂移房：latestScriptId 即房内版本，不误报', async () => {
    const r = await get(`/api/room/read/${global.c200Room}/rewrite-pack`, 'rich');
    const j = await r.json();
    assert.strictEqual(j.versionDrift, false);
    assert.ok(j.latestScriptId && typeof j.latestScriptId === 'string');
    assert.strictEqual(j.latestScriptId, j.scriptId, '没有新版本时最新版就是房内冻结版');
    assert.strictEqual(j.latestVersion, j.roomVersion);
  });
});

describe('编剧室·内部账户免费（串行）', { concurrency: 1 }, () => {
  const { SUPER_ADMIN_PHONE } = require('../dist/middleware/admin.js');
  const staffRows = (uid) => mem._ledgers.filter((l) => l.userId === uid && l.reason === 'STAFF_FREE' && l.amount === 0 && l.direction === 'OUT');
  it('副管理员 FREE 零余额：选题会开场/发言/决议全 0 扣费', async () => {
    const uid = 'room_staff1';
    mem._seedUser({ id: uid, level: 'FREE', balance: 0, isAdmin: true });
    const open = await post('/api/room/pitch/open', { idea: '被辞退的女厨师想夺回餐厅，前合伙人打压她，她暗中布局反击' }, uid);
    assert.strictEqual(open.status, 200);
    const oj = await open.json();
    assert.strictEqual(oj.staff, true);
    assert.strictEqual(oj.points, 0);
    assert.strictEqual(bal(uid), 0);
    assert.strictEqual(staffRows(uid).length, 1);

    const sp = await post(`/api/room/pitch/${oj.roomId}/speak`, { content: '主角想要夺回餐厅，对手是前合伙人和婆婆，计划做70集竖屏真人短剧' }, uid);
    assert.strictEqual(sp.status, 200);
    assert.strictEqual((await sp.json()).points, 0);

    const dec = await post(`/api/room/pitch/${oj.roomId}/decide`, { relation: '师徒反目', conflict: '秘方股权冲突', scenes: '后厨', episodes: 70 }, uid);
    assert.strictEqual(dec.status, 200);
    assert.strictEqual((await dec.json()).points, 0);
    assert.strictEqual(bal(uid), 0);
    assert.strictEqual(staffRows(uid).length, 3);
  });
  it('超管手机号硬命中：AI围读 0 扣费，重放 409', async () => {
    const uid = 'room_super2';
    mem._seedUser({ id: uid, level: 'FREE', balance: 0, isAdmin: false, phone: SUPER_ADMIN_PHONE });
    const op = await post('/api/room/read/open', { readMode: 'xn_xn', scriptText: SCRIPT }, uid);
    assert.strictEqual(op.status, 200);
    const rid = (await op.json()).roomId;
    const body = {};
    const r1 = await post(`/api/room/read/${rid}/ai-read`, body, uid);
    assert.strictEqual(r1.status, 200);
    const j1 = await r1.json();
    assert.strictEqual(j1.staff, true);
    assert.strictEqual(j1.points, 0);
    assert.strictEqual(bal(uid), 0);
    assert.strictEqual(staffRows(uid).length, 1);
    const r2 = await post(`/api/room/read/${rid}/ai-read`, body, uid);
    assert.strictEqual(r2.status, 409, '同参数窗内重放幂等拦截');
    assert.strictEqual(staffRows(uid).length, 1);
  });
});
