/**
 * v2.573 采访轮次的模型调用观测写入失败必须留痕
 * 旧实现 `modelCallLog.create(...).catch(() => {})`：回答与素材正常返回，但成本记录静默丢失，
 * 按档核价与毛利体检长期少算。现改为只留痕、不阻断本轮。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'iv-calllog-secret';
process.env.JWT_REFRESH_SECRET = 'iv-calllog-refresh';
const { createApp } = require('../dist/server/app.js');
const { createInterviewRouter } = require('../dist/routes/interview.js');
const MP = require('../dist/lib/model-proxy.js');
const engine = require('../dist/engine/interview.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

MP.__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ interview: createInterviewRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => {
  const done = () => { base = `http://127.0.0.1:${server.address().port}`; res(); };
  if (server.listening) return done();
  server.once('listening', done);
}));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

mem._seedUser({ id: 'iv-user', balance: 500 });
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: 'iv-user', level: 'BASIC' })}` };

describe('采访调用观测写入失败留痕（v2.573）', { concurrency: 1 }, () => {
  it('modelCallLog 写失败：本轮仍 200 正常返回，日志出现 [interview.calllog]', async () => {
    // 固定引擎输出：costFen>0 才会走观测写入分支（沙盘无供应商时真实 costFen=0）
    const origTurn = engine.interviewTurn;
    engine.interviewTurn = async (_tier, _text, materials) => ({
      materials, question: '她为了夺回餐厅，最怕失去的是什么？', ready: false, costFen: 7, aiExtract: false, aiQuestion: false,
    });
    const origCreate = mem.modelCallLog.create.bind(mem.modelCallLog);
    mem.modelCallLog.create = async () => { throw new Error('call log down'); };

    const logs = [];
    const origErr = console.error;
    console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
    let resp;
    try {
      resp = await fetch(base + '/api/interview/sessions', {
        method: 'POST', headers: H, body: JSON.stringify({ idea: '被辞退的女厨师想夺回自己的餐厅' }),
      });
    } finally {
      console.error = origErr;
      engine.interviewTurn = origTurn;
      mem.modelCallLog.create = origCreate;
    }

    assert.strictEqual(resp.status, 200, '观测写入失败不得阻断本轮采访');
    const j = await resp.json();
    assert.strictEqual(j.ok, true);
    assert.ok(j.question, '下一问必须正常返回');
    assert.ok(logs.some((l) => l.includes('[interview.calllog]')), '成本记录丢失必须可观测');
  });
});
