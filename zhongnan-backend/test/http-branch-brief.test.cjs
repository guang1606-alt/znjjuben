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

  it('v2.333 悬空线索（无获得处）：422 CLUE_VALIDATION_FAILED，扣费前拦截', async () => {
    mem._seedUser({ id: 'u_br_clue_bad', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_br_clue_bad', { id: 'p_br_clue_bad', userId: 'u_br_clue_bad', bible: null, mode: 'interactive' });
    const r = await call('u_br_clue_bad', 'BASIC', {
      projectId: 'p_br_clue_bad', brief,
      branchBrief: {
        mainLine: '外卖员小陈送到别墅区发现收件人是前女友',
        choicePoints: '前女友求助他送文件给现任男友',
        endingsMain: 1, endingsHidden: 1, endingsBad: 1,
        clues: [{ id: '锈钥匙', trust: 'true', source: '老管家', gainAt: [], opens: ['隐藏结局1'] }],
      },
    });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.error, 'CLUE_VALIDATION_FAILED');
    assert.strictEqual(r.json.field, 'clues');
    assert.ok(r.json.errors.some((e) => e.type === 'clue_unobtainable'));
    assert.strictEqual(mem._accounts.get('u_br_clue_bad').balance, 5000);
  });

  it('v2.333 合法线索链：指令块注入线索事实源，文字与拆穿点逐字落地', async () => {
    mem._seedUser({ id: 'u_br_clue_ok', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_br_clue_ok', { id: 'p_br_clue_ok', userId: 'u_br_clue_ok', bible: null, mode: 'interactive' });
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await call('u_br_clue_ok', 'BASIC', {
        projectId: 'p_br_clue_ok', brief,
        branchBrief: {
          mainLine: '外卖员小陈送到别墅区发现收件人是前女友',
          choicePoints: '前女友求助他送文件给现任男友',
          endingsMain: 1, endingsHidden: 1, endingsBad: 1,
          clues: [
            { id: '锈钥匙', trust: 'true', source: '老管家在杂物间递出', gainAt: ['选择点3'], opens: ['隐藏结局1'], requiredFor: ['隐藏结局1'] },
            { id: '假账本', trust: 'false', source: '秘书故意留在桌上', gainAt: ['选择点2'], opens: ['坏结局1'], exposeAt: '选择点4' },
          ],
        },
      });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'));
      const writerP = captured.filter((c) => c.role === 'writer').map((c) => c.prompt).join('\n');
      assert.ok(writerP.includes('线索链') && writerP.includes('锈钥匙') && writerP.includes('假账本'));
      assert.ok(writerP.includes('拆穿于 选择点4'));
      assert.strictEqual(mem._accounts.get('u_br_clue_ok').balance, 4990);
    } finally {
      MP.callText = orig;
    }
  });
});

// v2.335 已排好的分支图随生成请求下发：结构语义 + 线索联合可达性，全部在扣费前拦截
describe('互动分支·生成侧接图（v2.335）', { concurrency: 1 }, () => {
  const baseBrief = {
    mainLine: '外卖员小陈送到别墅区发现收件人是前女友',
    choicePoints: '前女友求助他送文件给现任男友',
    endingsMain: 1, endingsHidden: 0, endingsBad: 1,
  };
  const okGraph = {
    start: 's',
    nodes: {
      s: { type: 'choice', to: ['hold', 'confront'], label: '开场对峙' },
      hold: { type: 'scene', to: ['主线结局'], label: '按兵不动' },
      confront: { type: 'scene', to: ['坏结局'], label: '直接拆穿' },
      主线结局: { type: 'ending', endingType: 'main' },
      坏结局: { type: 'ending', endingType: 'bad' },
    },
  };

  it('图有悬空边：422 BRANCH_GRAPH_INVALID，扣费前拦截', async () => {
    mem._seedUser({ id: 'u_brg_dangle', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_brg_dangle', { id: 'p_brg_dangle', userId: 'u_brg_dangle', bible: null, mode: 'interactive' });
    const r = await call('u_brg_dangle', 'BASIC', {
      projectId: 'p_brg_dangle', brief,
      branchBrief: { ...baseBrief, graph: { start: 's', nodes: { s: { type: 'choice', to: ['missing', 'missing2'] } } } },
    });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.error, 'BRANCH_GRAPH_INVALID');
    assert.strictEqual(r.json.field, 'graph');
    assert.ok(r.json.errors.some((e) => e.type === 'dangling_edge' && e.severity === 'high'));
    assert.strictEqual(mem._accounts.get('u_brg_dangle').balance, 5000);
  });

  it('线索可得处不在图里：422 CLUE_GRAPH_VALIDATION_FAILED，扣费前拦截', async () => {
    mem._seedUser({ id: 'u_brg_clue', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_brg_clue', { id: 'p_brg_clue', userId: 'u_brg_clue', bible: null, mode: 'interactive' });
    const r = await call('u_brg_clue', 'BASIC', {
      projectId: 'p_brg_clue', brief,
      branchBrief: {
        ...baseBrief, graph: okGraph,
        clues: [{ id: '锈钥匙', trust: 'true', source: '老管家', gainAt: ['第三幕走廊'], opens: ['主线结局'], requiredFor: ['主线结局'] }],
      },
    });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.error, 'CLUE_GRAPH_VALIDATION_FAILED');
    assert.strictEqual(r.json.field, 'clues');
    assert.ok(r.json.errors.some((e) => e.type === 'clue_gain_unknown' && e.severity === 'high'));
    assert.strictEqual(mem._accounts.get('u_brg_clue').balance, 5000);
  });

  it('图形状不合法（起点不在 nodes）：400 field=graph，不扣费', async () => {
    mem._seedUser({ id: 'u_brg_shape', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_brg_shape', { id: 'p_brg_shape', userId: 'u_brg_shape', bible: null, mode: 'interactive' });
    const r = await call('u_brg_shape', 'BASIC', {
      projectId: 'p_brg_shape', brief,
      branchBrief: { ...baseBrief, graph: { start: 'nope', nodes: { s: { type: 'ending' } } } },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.field, 'graph');
    assert.strictEqual(mem._accounts.get('u_brg_shape').balance, 5000);
  });

  it('合法图 + 合法线索：结构锁定注入撰写师，节点名与去向逐字落地，正常计费', async () => {
    mem._seedUser({ id: 'u_brg_ok', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_brg_ok', { id: 'p_brg_ok', userId: 'u_brg_ok', bible: null, mode: 'interactive' });
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await call('u_brg_ok', 'BASIC', {
        projectId: 'p_brg_ok', brief,
        branchBrief: {
          ...baseBrief, graph: okGraph,
          clues: [{ id: '锈钥匙', trust: 'true', source: '老管家', gainAt: ['开场对峙'], opens: ['主线结局'], requiredFor: ['主线结局'] }],
        },
      });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'));
      const writerP = captured.filter((c) => c.role === 'writer').map((c) => c.prompt).join('\n');
      assert.ok(writerP.includes('已定分支图'), '撰写师必须收到图段');
      assert.ok(writerP.includes('开场对峙') && writerP.includes('按兵不动') && writerP.includes('直接拆穿'));
      assert.ok(writerP.includes('不得增删节点或改连线'));
      assert.strictEqual(mem._accounts.get('u_brg_ok').balance, 4990);
    } finally {
      MP.callText = orig;
    }
  });
});
