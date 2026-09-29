const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'tb-secret';
process.env.JWT_REFRESH_SECRET = 'tb-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const MP = require('../dist/lib/model-proxy.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// 沙盘隔离：无供应商 → callText 走确定性兜底，零真实模型调用
MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const brief = '年轻人在职场被关系户抢走功劳，她决定用一次提案当场反击。';
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

describe('热点追更·热点简报 HTTP 闭环（串行）', { concurrency: 1 }, () => {
  it('隐私硬信息命中：422 TREND_PII_BLOCKED 回传类别，扣费前拦截', async () => {
    mem._seedUser({ id: 'u_tb_pii', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_tb_pii', { id: 'p_tb_pii', userId: 'u_tb_pii', bible: null, mode: 'hot' });
    const r = await call('u_tb_pii', 'BASIC', {
      projectId: 'p_tb_pii', brief,
      trendBrief: { trendName: 'xx话题', heatCore: '有人在评论留了 13912345678 约采访' },
    });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.error, 'TREND_PII_BLOCKED');
    assert.deepStrictEqual(r.json.hits, ['手机号']);
    assert.strictEqual(mem._accounts.get('u_tb_pii').balance, 5000);
  });

  it('热点名缺失：400 带 field=trendName，不扣费', async () => {
    mem._seedUser({ id: 'u_tb_miss', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_tb_miss', { id: 'p_tb_miss', userId: 'u_tb_miss', bible: null, mode: 'hot' });
    const r = await call('u_tb_miss', 'BASIC', {
      projectId: 'p_tb_miss', brief,
      trendBrief: { trendName: ' ', heatCore: '打工人的憋屈情绪' },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.field, 'trendName');
    assert.strictEqual(mem._accounts.get('u_tb_miss').balance, 5000);
  });

  it('非热点模式：trendBrief 被忽略，即使含手机号也不拦截', async () => {
    mem._seedUser({ id: 'u_tb_plain', level: 'FREE', balance: 0 });
    mem._projects.set('p_tb_plain', { id: 'p_tb_plain', userId: 'u_tb_plain', bible: null, mode: 'tags' });
    const r = await call('u_tb_plain', 'FREE', {
      projectId: 'p_tb_plain', brief,
      trendBrief: { trendName: '随便', heatCore: '电话 13912345678 打爆' },
    });
    assert.strictEqual(r.status, 200);
    assert.ok(r.events.some((e) => e.stage === 'done'));
  });

  it('合法热点简报：SSE 跑通，事实源+借法指令注入架构师/撰写师，正常计费；观众岗不强注入', async () => {
    mem._seedUser({ id: 'u_tb_ok', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_tb_ok', { id: 'p_tb_ok', userId: 'u_tb_ok', bible: null, mode: 'hot' });
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await call('u_tb_ok', 'BASIC', {
        projectId: 'p_tb_ok', brief,
        trendBrief: {
          trendName: '关系户截胡功劳话题', trendKind: 'social', approach: 'formula_clone',
          heatCore: '打工人对努力被关系户截胡的集体憋屈，爽点在当场反击',
          userAngle: '靠一份谁也没想到的提案翻盘', avoidElements: '不使用原热点标志台词',
        },
      });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'), '必须跑到 done');
      const promptOf = (role) => captured.filter((c) => c.role === role).map((c) => c.prompt).join('\n');
      for (const role of ['architect', 'writer']) {
        const p = promptOf(role);
        assert.ok(p.includes('关系户截胡功劳话题'), `${role} 必须含逐字热点名`);
        assert.ok(p.includes('同套路复刻'), `${role} 必须含借法指令`);
        assert.ok(p.includes('热点简报') || p.includes('TREND-CHASING'), `${role} 必须含热点简报指令块`);
      }
      const writerP = promptOf('writer');
      assert.ok(writerP.includes('连续 8 字') && writerP.includes('不使用原热点标志台词') && writerP.includes('热度退了剧不废'));
      // 沙盘最低 10 fen 结算 + 有冻结积分事件
      assert.strictEqual(mem._accounts.get('u_tb_ok').balance, 4990);
      assert.ok(r.events.some((e) => e.stage === 'frozen' && e.points > 0));
    } finally {
      MP.callText = orig;
    }
  });

  it('灾难高危信号：不拦截跑通，context 事件带热点风险预警，架构师提示含强制虚构化要求', async () => {
    mem._seedUser({ id: 'u_tb_risk', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_tb_risk', { id: 'p_tb_risk', userId: 'u_tb_risk', bible: null, mode: 'hot' });
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await call('u_tb_risk', 'BASIC', {
        projectId: 'p_tb_risk', brief,
        trendBrief: {
          trendName: '灾后互助热议', trendKind: 'social', approach: 'setting_remix',
          heatCore: '地震遇难事件后普通人守望相助的情绪',
        },
      });
      assert.strictEqual(r.status, 200);
      const ctx = r.events.find((e) => e.stage === 'context');
      assert.ok(ctx && Array.isArray(ctx.complianceWarnings), 'context 事件必须存在且带 complianceWarnings');
      assert.ok(ctx.complianceWarnings.some((w) => String(w.ruleId || '').startsWith('trend_risk_') && w.label.includes('灾难')),
        '预警必须含热点灾难风险：' + JSON.stringify(ctx.complianceWarnings.map((w) => w.label)));
      const architectP = captured.filter((c) => c.role === 'architect').map((c) => c.prompt).join('\n');
      assert.ok(architectP.includes('强制虚构化') && architectP.includes('同背景改编'));
      assert.strictEqual(mem._accounts.get('u_tb_risk').balance, 4990);
    } finally {
      MP.callText = orig;
    }
  });
});
