/**
 * v2.626 入口 HTML 读失败必须可归因（且不得刷屏）
 *
 * 证伪背景：createApp 的 renderIndexHtml 在 statSync/readFileSync 抛错时 `catch { return null; }`，
 * sendIndex 随即 404。也就是说 web/index.html 缺失/权限错/磁盘异常时，全站首页与所有 SPA 深链
 * 全部变成空白 404，而服务端一行日志都没有——运维只能看到「用户说打不开」，无从判断是部署漏包还是磁盘问题。
 * 但入口是全站最高频请求，失败时逐请求打日志会瞬间刷爆日志、淹没其它告警，因此留痕按分钟节流。
 * 本文件锁定：仍返回 404（不伪造页面），但必须写入 [spa.index]，且 60s 内只写一条。
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { createApp } = require('../dist/server/app.js');

const mem = {
  user: { findUnique: async () => null },
};
const app = createApp({});
const server = app.listen(0);
let base = '';
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => (a instanceof Error && a.stack ? a.stack : String(a))).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ r, logs }))
    .finally(() => { console.error = orig; });
}

const origStat = fs.statSync;

test('入口 HTML 读取失败：全站 404 但必须留痕，且同一分钟内只留一条', async () => {
  fs.statSync = ((p, ...rest) => {
    if (String(p).endsWith('index.html')) throw new Error('SPA_INDEX_STAT_V2626');
    return origStat.call(fs, p, ...rest);
  });
  try {
    const { r: res, logs } = await captureErr(async () => {
      const a = await fetch(`${base}/`, { headers: { accept: 'text/html' } });
      const b = await fetch(`${base}/works/12345`, { headers: { accept: 'text/html' } });
      return { a: a.status, b: b.status };
    });
    assert.strictEqual(res.a, 404, '对外行为不变：入口读不到时如实 404，不伪造页面');
    assert.strictEqual(res.b, 404);
    const hits = logs.filter((l) => l.includes('[spa.index]'));
    assert.strictEqual(hits.length, 1, `最高频入口必须节流留痕，实际 ${hits.length} 条`);
    assert.ok(hits[0].includes('SPA_INDEX_STAT_V2626'), '必须保留原始异常，才能区分漏包/权限/磁盘');
  } finally {
    fs.statSync = origStat;
  }
});

test('入口正常时不得产生 [spa.index] 噪音', async () => {
  const { r: status, logs } = await captureErr(async () => (await fetch(`${base}/`, { headers: { accept: 'text/html' } })).status);
  assert.strictEqual(status, 200);
  assert.ok(!logs.some((l) => l.includes('[spa.index]')), '正常路径不应写降级日志');
});
