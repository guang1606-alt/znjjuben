/**
 * v2.607 生成失败退款：退款失败不得仍对外宣称「已退款」。
 *
 * 先证伪：episodes 的失败兜底 `withBillingTransaction(...).catch(() => undefined)`——
 * 冻结额度解冻失败时用户仍收到 `failed_refunded`，账户里那笔钱还在 frozen 里，
 * 前端按「已退款」安抚用户，既无提示也无日志（money-related 谎报）。
 * 修复：退款失败 → 留痕 `generate.episode.refund`，并在失败文案后补一句「退款处理中，请稍后在账单核对」，
 * 让用户知道要核对而不是以为已到账；正常退款/正常生成路径不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2607-secret';
process.env.JWT_REFRESH_SECRET = 'v2607-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const UID = 'u_v2607';
const PID = 'p_v2607';
const brief = '外卖员林夏被富二代当众羞辱，她隐忍未发，转头发现对方公司正是自己即将接手并购的目标。';

function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return () => { console.error = orig; return calls; };
}
async function readSse(resp) {
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ''; const events = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      chunk.split('\n').forEach((l) => { if (l.startsWith('data: ')) events.push(JSON.parse(l.slice(6))); });
    }
  }
  return events;
}
function gen() {
  return fetch(base + '/api/generate/episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` },
    body: JSON.stringify({ projectId: PID, brief, engineTier: 'ECONOMY' }),
  });
}

describe('v2.607 退款失败不得谎报已退款', { concurrency: 1 }, () => {
  before(() => {
    mem._seedUser({ id: UID, level: 'BASIC', balance: 1000 });
    mem._projects.set(PID, { id: PID, userId: UID, bible: null });
  });

  it('1) 生成失败且解冻失败：留痕 + 文案提示退款处理中 + 钱仍在冻结里', async () => {
    const origCreate = mem.script.create;
    const origLedger = mem.ledgerEntry.create;
    mem.script.create = async () => { throw new Error('DB_DOWN_SCRIPT'); }; // 强制进入失败兜底
    mem.ledgerEntry.create = async (arg) => {
      if (String(arg?.data?.idempotencyKey || '').startsWith('unfreeze:')) throw new Error('LEDGER_DOWN');
      return origLedger.call(mem.ledgerEntry, arg);
    };
    const stop = captureErrors();
    let events;
    try {
      const resp = await gen();
      assert.strictEqual(resp.status, 200);
      events = await readSse(resp);
    } finally {
      const calls = stop();
      mem.script.create = origCreate;
      mem.ledgerEntry.create = origLedger;
      assert.ok(calls.some((c) => c.includes('[generate.episode.refund]')),
        '必须留痕 generate.episode.refund；实际：' + calls.join(' | '));
    }
    const failed = events.find((e) => e.stage === 'failed_refunded');
    assert.ok(failed, '仍应走 failed_refunded 事件（前端状态机不变）');
    assert.match(String(failed.error), /退款处理中/, '文案必须如实提示退款待确认，不能只说已退款');
    const acct = mem._accounts.get(UID);
    assert.ok(acct, '账户应存在');
    assert.ok(acct.frozen > 0, '解冻失败时额度应仍在冻结里（不得假装已退回）');
    assert.strictEqual(
      mem._ledgers.filter((l) => String(l.idempotencyKey || '').startsWith('unfreeze:')).length, 0,
      '解冻失败不得落 UNFROZEN 流水',
    );
  });

  it('2) 恢复正常后生成照常完成（不误伤）', async () => {
    const resp = await gen();
    const events = await readSse(resp);
    assert.ok(events.find((e) => e.stage === 'done'), '恢复后应正常走到 done');
  });
});
