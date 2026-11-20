/**
 * v2.619 合规覆写读库失败必须可归因，且不得刷爆日志
 *
 * 证伪背景：safety-store.loadOverrides 的 catch 在 safetyConfig 读失败时静默回退默认规则。
 * 后果有两个方向都被掩盖：
 *  ① 运营在后台新增的敏感词静默失效——该拦的内容照常放行（合规风险）；
 *  ② 运营停用的规则全部「复活」，误杀增多，客服投诉却找不到服务端线索。
 * 而该函数位于每次内容扫描的热路径上，直接逐次打日志会在库持续不可用时刷爆日志，
 * 因此留痕必须按 TTL 限频（本文件同时锁定「第一次必留痕」与「短时间内只留一次」）。
 */
const test = require('node:test');
const assert = require('node:assert');

const STORE = '../dist/lib/safety-store.js';
const BLOCK_SAMPLE = '这本小说讲的是恐怖主义的起源';
const SAFE_SAMPLE = '这是一个关于成长的温暖故事';

function freshStore() {
  delete require.cache[require.resolve(STORE)];
  return require(STORE);
}

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ r, logs }))
    .finally(() => { console.error = orig; });
}

const downDb = {
  safetyConfig: { findUnique: async () => { throw new Error('SAFETY_DB_DOWN_V2619'); } },
};
const healthyDb = {
  safetyConfig: { findUnique: async () => null },
};

test('读库失败仍回退默认规则（该拦的还拦），但必须写入 [safety.overrides] 留痕', async () => {
  const { scanWithStore } = freshStore();
  const { r: res, logs } = await captureErr(() => scanWithStore(BLOCK_SAMPLE, downDb));
  assert.strictEqual(res.level, 'block', '覆写读不到时必须退回默认规则，硬拦截不得失效');
  assert.ok(
    logs.some((l) => l.includes('[safety.overrides]') && l.includes('SAFETY_DB_DOWN_V2619')),
    '读库失败必须带 scope 与原始异常留痕，否则运营改词失效无从归因',
  );
});

test('库持续不可用：短时间内多次扫描只留痕一次，不得刷爆日志', async () => {
  const { scanWithStore } = freshStore();
  const failCount = () => captureErr(async () => {
    await scanWithStore(SAFE_SAMPLE, downDb);
    await scanWithStore(SAFE_SAMPLE, downDb);
    await scanWithStore(SAFE_SAMPLE, downDb);
  });
  const { logs } = await failCount();
  const hits = logs.filter((l) => l.includes('[safety.overrides]')).length;
  assert.strictEqual(hits, 1, `热路径必须限频留痕，实际写了 ${hits} 条`);
});

test('覆写正常读取时不得产生 [safety.overrides] 噪音', async () => {
  const { scanWithStore } = freshStore();
  const { r: res, logs } = await captureErr(() => scanWithStore(SAFE_SAMPLE, healthyDb));
  assert.strictEqual(res.level, 'safe');
  assert.ok(!logs.some((l) => l.includes('[safety.overrides]')), '正常路径不应写降级日志');
});
