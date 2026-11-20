/**
 * v2.629 角色资产沉淀入口：序列化圣经损坏必须可归因（与 v2.627 同根的第二处解析点）。
 *
 * 先证伪：
 *   `POST /character-assets/from-project/:projectId` 在 `bible.characters` 为字符串时直接
 *   `JSON.parse`，外层 `catch { chars = {}; }` 把「序列化圣经被截断/损坏」与「本来就没有人物」
 *   混为一谈：沉淀结果 created=0，用户点「一键沉淀」毫无收获，服务端零日志，分不清是项目真没人物
 *   还是数据损坏。v2.627 已修 `lib/cast-arc.ts` 的同根两处，这里是与邻居 `generate.asset.cast.
 *   fromProject.latest`（v2.603）同一条链路上的漏网点。
 * 修复：仅在「trim 后以 { / [ 开头却解析失败」时 logInternal(e,'generate.asset.cast.parse')；
 * 纯文本人物字段属常态保持零日志。响应形状与沉淀结果不变。
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'v2629-secret';
process.env.JWT_REFRESH_SECRET = 'v2629-refresh';
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

function seed(uid, pid, bible) {
  mem._seedUser({ id: uid, level: 'BASIC', balance: 5000 });
  mem._projects.set(pid, { id: pid, userId: uid, title: 'v2629', mode: 'tags', bible });
}
async function post(pid, uid) {
  const resp = await fetch(`${base}/api/generate/character-assets/from-project/${pid}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}` },
  });
  return { status: resp.status, json: await resp.json().catch(() => null) };
}
function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => { calls.push(a.map((x) => String(x)).join(' ')); };
  return Promise.resolve().then(fn).then((value) => ({ value, calls })).finally(() => { console.error = orig; });
}

describe('v2.629 角色资产沉淀入口的圣经损坏必须留痕', () => {
  it('1) 截断的序列化圣经：沉淀 0 条但必须留痕 generate.asset.cast.parse', async () => {
    seed('u_v2629a', 'p_v2629a', { characters: '{"苏眉":{"traits":"飒爽"' });
    const { value, calls } = await captureErrors(() => post('p_v2629a', 'u_v2629a'));
    assert.strictEqual(value.status, 200);
    assert.strictEqual(value.json.created, 0);
    assert.ok(calls.some((c) => c.includes('[generate.asset.cast.parse]')),
      '截断 JSON 不得静默按空圣经沉淀；实际：' + calls.join(' | '));
  });

  it('2) 纯文本人物字段属常态：零日志，不制造噪音', async () => {
    seed('u_v2629b', 'p_v2629b', { characters: '苏眉、陈默' });
    const { value, calls } = await captureErrors(() => post('p_v2629b', 'u_v2629b'));
    assert.strictEqual(value.status, 200);
    assert.strictEqual(calls.length, 0, '纯文本不是损坏，不应记日志；实际：' + calls.join(' | '));
  });

  it('3) 合法序列化圣经照常沉淀且零日志（不误伤正常路径）', async () => {
    seed('u_v2629c', 'p_v2629c', { characters: JSON.stringify({ 苏眉: { traits: '飒爽', voice: '句句带刺' } }) });
    const { value, calls } = await captureErrors(() => post('p_v2629c', 'u_v2629c'));
    assert.strictEqual(value.status, 200);
    assert.strictEqual(value.json.created, 1);
    assert.strictEqual(value.json.assets[0].name, '苏眉');
    assert.strictEqual(calls.length, 0, '正常路径不应记日志；实际：' + calls.join(' | '));
  });
});
