/**
 * v2.625 交接状态读取失败必须可归因
 *
 * 证伪背景：handoff.loadHandoff 在 payloadEnc 存在但解析失败时（密文可解但明文非 JSON、
 * 历史数据被手工改写、半截写入）静默回落 EMPTY_HANDOFF，并把这个空态写进 60s 缓存。
 * 后果：后台「交接班」页面整块变空，运营以为状态被清空/丢失，而服务端没有任何线索——
 * 这是产品里唯一承载跨会话上下文的地方，静默空态等于不可恢复的上下文丢失。
 * 本文件锁定：仍返回完整空态（不炸页面），但必须写入 [handoff.load]。
 */
const test = require('node:test');
const assert = require('node:assert');

const HANDOFF = '../dist/lib/handoff.js';

function fresh() {
  delete require.cache[require.resolve(HANDOFF)];
  return require(HANDOFF);
}

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => (a instanceof Error && a.stack ? a.stack : String(a))).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ r, logs }))
    .finally(() => { console.error = orig; });
}

test.after(() => { delete process.env.CONFIG_SECRET; });

test('密文可解但明文非 JSON：仍返回完整空态，但必须写入 [handoff.load]', async () => {
  delete process.env.CONFIG_SECRET;
  const { encrypt } = require('../dist/lib/crypto.js');
  const { loadHandoff } = fresh();
  const db = { modelConfig: { findUnique: async () => ({ payloadEnc: encrypt('这不是 JSON') }) } };
  const { r, logs } = await captureErr(() => loadHandoff(db));
  assert.deepStrictEqual(r.iterationLog, [], '对外契约不变：返回完整空态，不炸后台页面');
  assert.ok(
    logs.some((l) => l.includes('[handoff.load]')),
    '交接状态解析失败必须留痕，否则运营只看到整块变空、无从判断是否丢数据',
  );
});

test('空行（从未保存过）与正常读取不得产生 [handoff.load] 噪音', async () => {
  delete process.env.CONFIG_SECRET;
  const empty = fresh();
  const { logs: l1 } = await captureErr(() => empty.loadHandoff({ modelConfig: { findUnique: async () => null } }));
  assert.ok(!l1.some((l) => l.includes('[handoff.load]')), '从未保存过属于常态，不应写降级日志');

  const { saveHandoff, loadHandoff } = fresh();
  const db = { modelConfig: { findUnique: async () => null, upsert: async () => ({}) } };
  await saveHandoff({ nextPlan: '下一轮：市场退款抢占' }, 'tester', db);
  const { r, logs: l2 } = await captureErr(() => loadHandoff({
    modelConfig: { findUnique: async () => ({ payloadEnc: (require('../dist/lib/crypto.js').encrypt(JSON.stringify({
      nextPlan: '下一轮：市场退款抢占', iterationLog: [], updatedAt: new Date().toISOString(),
    }))) }) },
  }));
  assert.strictEqual(r.nextPlan, '下一轮：市场退款抢占');
  assert.ok(!l2.some((l) => l.includes('[handoff.load]')), '正常读取不应写降级日志');
});
