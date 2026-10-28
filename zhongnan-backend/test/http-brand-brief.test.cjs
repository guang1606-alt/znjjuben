const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'bb-secret';
process.env.JWT_REFRESH_SECRET = 'bb-refresh';
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

const brief = '深夜办公室，新人被方案逼到崩溃，第二天还要向最大客户提案。';
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

describe('剧情软广·品牌简报 HTTP 闭环（串行）', { concurrency: 1 }, () => {
  it('广告词命中：422 AD_CLAIM_BLOCKED 回传命中词，且不进入扣费流程', async () => {
    // v2.329：软广（branded_skit → 灵感式·广告脚本）为基础档能力，免费档在模式闸门即被拦
    mem._seedUser({ id: 'u_bb_bad', level: 'BASIC', balance: 0 });
    mem._projects.set('p_bb_bad', { id: 'p_bb_bad', userId: 'u_bb_bad', bible: null, mode: 'branded_skit' });
    const r = await call('u_bb_bad', 'BASIC', {
      projectId: 'p_bb_bad', brief,
      brandBrief: { brand: '橘隐', sellingPoint: '全网第一好喝，100%不胖，稳赚不赔' },
    });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.error, 'AD_CLAIM_BLOCKED');
    assert.ok(r.json.hits.includes('全网第一') && r.json.hits.includes('100%') && r.json.hits.includes('稳赚'));
    assert.strictEqual(mem._accounts.get('u_bb_bad').balance, 0);
  });

  it('品牌名缺失：400 且带 field，不进入扣费流程', async () => {
    mem._seedUser({ id: 'u_bb_miss', level: 'BASIC', balance: 0 });
    mem._projects.set('p_bb_miss', { id: 'p_bb_miss', userId: 'u_bb_miss', bible: null, mode: 'branded_skit' });
    const r = await call('u_bb_miss', 'BASIC', {
      projectId: 'p_bb_miss', brief,
      brandBrief: { brand: '   ', sellingPoint: '0糖也有烘焙香' },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.json.field, 'brand');
    assert.strictEqual(mem._accounts.get('u_bb_miss').balance, 0);
  });

  it('非软广模式：brandBrief 被忽略，即使含违规词也不拦截（免费额度内 200）', async () => {
    mem._seedUser({ id: 'u_bb_plain', level: 'FREE', balance: 0 });
    mem._projects.set('p_bb_plain', { id: 'p_bb_plain', userId: 'u_bb_plain', bible: null, mode: 'tags' });
    const r = await call('u_bb_plain', 'FREE', {
      projectId: 'p_bb_plain', brief,
      brandBrief: { brand: '随便', sellingPoint: '全网第一' },
    });
    assert.strictEqual(r.status, 200);
    assert.ok(r.events.some((e) => e.stage === 'done'));
  });

  it('合法品牌简报：SSE 跑通，品牌事实源注入架构师/撰写师/观众三岗位，正常计费', async () => {
    mem._seedUser({ id: 'u_bb_ok', level: 'BASIC', balance: 5000 });
    mem._projects.set('p_bb_ok', { id: 'p_bb_ok', userId: 'u_bb_ok', bible: null, mode: 'branded_skit' });
    const captured = [];
    const orig = MP.callText;
    MP.callText = async (tier, role, prompt) => { captured.push({ role, prompt }); return orig(tier, role, prompt); };
    try {
      const r = await call('u_bb_ok', 'BASIC', {
        projectId: 'p_bb_ok', brief,
        brandBrief: {
          brand: '橘隐', product: '冷萃乌龙茶饮料', sellingPoint: '0糖也有烘焙香，开盖即饮',
          audience: '下午犯困又怕胖的上班族', memorySymbol: '开罐声「啵」+ 橘色罐',
          cta: '评论区领尝鲜券', storyShell: '深夜办公室', softness: 'balanced',
        },
      });
      assert.strictEqual(r.status, 200);
      assert.ok(r.events.some((e) => e.stage === 'done'), '必须跑到 done');
      const promptOf = (role) => captured.filter((c) => c.role === role).map((c) => c.prompt).join('\n');
      for (const role of ['architect', 'writer', 'audience']) {
        const p = promptOf(role);
        assert.ok(p.includes('橘隐'), `${role} 提示词必须含逐字品牌名`);
        assert.ok(p.includes('0糖也有烘焙香，开盖即饮'), `${role} 提示词必须含唯一核心卖点`);
        assert.ok(p.includes('品牌简报') || p.includes('BRANDED'), `${role} 提示词必须含品牌简报指令块`);
      }
      // 记忆符号/CTA/软性度也应在事实源中
      const writerP = promptOf('writer');
      assert.ok(writerP.includes('开罐声「啵」') && writerP.includes('评论区领尝鲜券') && writerP.includes('均衡'));
      // 正常计费：沙盘真实成本 0，按最低 10 fen 结算（证明未走拦截/退费路径）
      assert.strictEqual(mem._accounts.get('u_bb_ok').balance, 4990);
      assert.ok(r.events.some((e) => e.stage === 'frozen' && e.points > 0));
    } finally {
      MP.callText = orig;
    }
  });
});
