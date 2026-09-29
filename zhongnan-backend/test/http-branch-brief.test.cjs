const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'br-secret';
process.env.JWT_REFRESH_SECRET = 'br-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const brief = '外卖员小陈送到别墅区，发现收件人是前女友。';
async function call(uid, level, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (uid) headers.Authorization = `Bearer ${signAccess({ sub: uid, level })}`;
  const resp = await fetch(base + '/api/generate/episodes', { method: 'POST', headers, body: JSON.stringify(body) });
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
      }
    }
    return { status: resp.status, events };
  }
  return { status: resp.status, json: await resp.json().catch(() => null) };
}

describe('互动分支·分支简报 HTTP 闭环（串行）', { concurrency: 1 }, () => {
  it('坏结局过多：422 BRANCH_VALIDATION_FAILED，扣费前拦截', async () => {
    mem._seedUser({ id: 'u_br_bad', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_br_bad', { id: 'p_br_bad', userId: 'u_br_bad', bible: null, mode: 'interactive' });
    const r = await call('u_br_bad', 'BASIC', {
      projectId: 'p_br_bad', brief,
      branchBrief: { mainLine: '小陈送外卖到别墅', choicePoints: '前女友求助送文件', endingsMain: 1, endingsHidden: 0, endingsBad: 2, branchStyle: 'moral', stakesLevel: 'high' },
    });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.error, 'BRANCH_VALIDATION_FAILED');
    assert.strictEqual(mem._accounts.get('u_br_bad').balance, 5000);
  });

  it('主线缺失：400 带 field=mainLine，不扣费', async () => {
    mem._seedUser({ id: 'u_br_miss', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_br_miss', { id: 'p_br_miss', userId: 'u_br_miss', bible: null, mode: 'interactive' });
    const r = await call('u_br_miss', 'BASIC', {
      projectId: 'p_br_miss', brief,
      branchBrief: { mainLine: '  ', choicePoints: '前女友求助送文件', endingsMain: 1, endingsHidden: 1, endingsBad: 1 },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.field, 'mainLine');
    assert.strictEqual(mem._accounts.get('u_br_miss').balance, 5000);
  });

  it('非互动模式：branchBrief 被忽略（免费额度内 200）', async () => {
    mem._seedUser({ id: 'u_br_plain', level: 'FREE', balance: 0 });
    mem._projects.set('p_br_plain', { id: 'p_br_plain', userId: 'u_br_plain', bible: null, mode: 'tags' });
    const r = await call('u_br_plain', 'FREE', {
      projectId: 'p_br_plain', brief,
      branchBrief: { mainLine: '随便', choicePoints: '随便' },
    });
    assert.strictEqual(r.status, 200);
    assert.ok(r.events.some((e) => e.stage === 'done'));
  });

  it('合法分支简报：SSE 跑通，事实源+闭环铁律注入架构师/撰写师，正常计费', async () => {
    mem._seedUser({ id: 'u_br_ok', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_br_ok', { id: 'p_br_ok', userId: 'u_br_ok', bible: null, mode: 'interactive' });
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await call('u_br_ok', 'BASIC', {
        projectId: 'p_br_ok', brief,
        branchBrief: {
          mainLine: '外卖员小陈送到别墅区发现收件人是前女友',
          choicePoints: '前女友求助他送文件给现任男友',
          endingsMain: 1, endingsHidden: 1, endingsBad: 1,
          branchStyle: 'relationship', stakesLevel: 'medium',
          customEnding: '隐藏结局是前女友其实在帮小陈',
        },
      });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'), '必须跑到 done');
      const promptOf = (role) => captured.filter((c) => c.role === role).map((c) => c.prompt).join('\n');
      for (const role of ['architect', 'writer']) {
        const p = promptOf(role);
        assert.ok(p.includes('外卖员小陈'), `${role} 必须含逐字主线`);
        assert.ok(p.includes('前女友'), `${role} 必须含选择点`);
        assert.ok(p.includes('1/1/1'), `${role} 必须含结局数量`);
        assert.ok(p.includes('关系驱动'), `${role} 必须含分支风格`);
        assert.ok(p.includes('互动分支') || p.includes('INTERACTIVE'), `${role} 必须含分支简报指令块`);
      }
      const writerP = promptOf('writer');
      assert.ok(writerP.includes('无死胡同') && writerP.includes('假选择') && writerP.includes('隐藏结局是前女友其实在帮小陈'));
      assert.strictEqual(mem._accounts.get('u_br_ok').balance, 4990);
      assert.ok(r.events.some((e) => e.stage === 'frozen' && e.points > 0));
    } finally {
      MP.callText = orig;
    }
  });
});
