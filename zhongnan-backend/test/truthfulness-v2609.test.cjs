/**
 * v2.609 /fix 重算链路：异常可以 fail-open（保留旧台账、不阻断付费交付），但必须留痕可归因。
 *
 * 先证伪：`src/routes/generate.ts` /fix 的十余处 `catch { freshX = 旧值 }` 只有降级、没有日志。
 * 其中两处还包着真实 DB 读取：
 *  1) freshArc 块的 `script.findFirst`（读上一集 qcReport/content）——读失败时角色弧光按无前集重算，
 *     跨集弧光直接断档，服务端零线索；
 *  2) 跨集诊断/连续性台账块的 `script.findMany`（读前 40 条再取最近 8 集）——读失败时六键+24 本台账
 *     整体退回 {}（旧值），改写稿的穿帮结论与账本全部停留在 v1，用户以为已按新稿重算。
 * 修复：两处及其余静默 catch 统一补 `logInternal`，对外行为不变（仍是 200 + 保留旧值）。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2609-secret';
process.env.JWT_REFRESH_SECRET = 'v2609-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const MP = require('../dist/lib/model-proxy.js');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} }));

const mem = createMemoryPrisma();
const app = createApp({ generate: createGenerateRouter(mem) });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

const UID = 'u_v2609';
const PID = 'p_v2609';
const h = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: UID, level: 'BASIC' })}` });

const mk = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}第${i + 1}行，这是足够长的对白或动作描写文本。`).join('\n');
const original = mk(20, '原稿');
const rewritten = Array.from({ length: 20 }, (_, i) =>
  (i < 10 ? `原稿第${i + 1}行，这是足够长的对白或动作描写文本。` : `改写后第${i + 1}行，全新的台词与动作描写在这里。`)).join('\n');

function captureErrors() {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return () => { console.error = orig; return calls; };
}
function fixFix(epNo = 2) {
  return fetch(base + `/api/generate/projects/${PID}/fix`, {
    method: 'POST', headers: h(),
    body: JSON.stringify({ fix: { rule: 'format.length', dimLabel: '格式', advice: '字数不达标，补到单集体量' }, epNo }),
  });
}

describe('v2.609 /fix 重算静默降级必须留痕', { concurrency: 1 }, () => {
  before(() => {
    mem._seedUser({ id: UID, level: 'BASIC', balance: 1000 });
    mem._projects.set(PID, { id: PID, userId: UID, bible: null, format: 'LIVE' });
    mem._scripts.push({ id: 'v2609_e1', projectId: PID, epNo: 1, version: 1, title: 't1', wordCount: original.length, content: original, score: 70 });
    mem._scripts.push({ id: 'v2609_e2', projectId: PID, epNo: 2, version: 1, title: 't2', wordCount: original.length, content: original, score: 70 });
  });

  it('1) 前集读取失败：/fix 仍成功交付（fail-open），并留痕 arcTrack', async () => {
    const origFindFirst = mem.script.findFirst;
    mem.script.findFirst = async (arg) => {
      if (arg?.where?.epNo === 1) throw new Error('DB_DOWN_PREV_SCRIPT');
      return origFindFirst.call(mem.script, arg);
    };
    const origCall = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    const stop = captureErrors();
    let status, body;
    try {
      const r = await fixFix(2);
      status = r.status; body = await r.json();
    } finally {
      const calls = stop();
      MP.callText = origCall;
      mem.script.findFirst = origFindFirst;
      assert.ok(calls.some((c) => c.includes('[generate.fix.rescan.arcTrack]')),
        '前集读失败必须留痕 generate.fix.rescan.arcTrack；实际：' + calls.join(' | '));
    }
    assert.strictEqual(status, 200, '降级不得阻断付费交付');
    assert.ok(body.newVersion >= 2, '仍应落新版本');
  });

  it('2) 前序台账读取失败：/fix 仍成功交付（fail-open），并留痕 ledgerDiag', async () => {
    const origFindMany = mem.script.findMany;
    mem.script.findMany = async (arg) => {
      if (arg?.where?.epNo?.lt !== undefined) throw new Error('DB_DOWN_PREV_LEDGERS');
      return origFindMany.call(mem.script, arg);
    };
    const origCall = MP.callText;
    MP.callText = async () => ({ text: rewritten, costFen: 0 });
    const stop = captureErrors();
    let status, body;
    try {
      const r = await fixFix(2);
      status = r.status; body = await r.json();
    } finally {
      const calls = stop();
      MP.callText = origCall;
      mem.script.findMany = origFindMany;
      assert.ok(calls.some((c) => c.includes('[generate.fix.rescan.ledgerDiag]')),
        '前序台账读失败必须留痕 generate.fix.rescan.ledgerDiag；实际：' + calls.join(' | '));
    }
    assert.strictEqual(status, 200, '降级不得阻断付费交付');
    assert.ok(body.newVersion >= 3, '仍应落新版本');
  });
});
