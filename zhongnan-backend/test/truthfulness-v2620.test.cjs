/**
 * v2.620 模型配置读库失败必须可归因
 *
 * 证伪背景：model-config.loadConfig 的 catch 在无表/解密失败/读库失败时静默回退 EMPTY，
 * 随后各 resolve* 再叠加环境变量兜底。两处后果都被掩盖：
 *  ① 后台配置读不到时整站静默切到 env 供应商/模型——用户看到「换了引擎」却无人知道；
 *  ② spendLimit 随 EMPTY 一起变成 undefined，消费硬限额静默关闭（无限额烧钱）。
 * 该函数同样带 60s 缓存，失败结果也入缓存，因此留痕不会随模型调用逐次刷屏。
 */
const test = require('node:test');
const assert = require('node:assert');

const MOD = '../dist/lib/model-config.js';

function freshLoad() {
  delete require.cache[require.resolve(MOD)];
  return require(MOD).loadConfig;
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
  modelConfig: { findUnique: async () => { throw new Error('MODEL_CONFIG_DB_DOWN_V2620'); } },
};
const healthyDb = {
  modelConfig: { findUnique: async () => null },
};

test('读库失败仍回退空配置，但必须写入 [model.config] 留痕', async () => {
  const loadConfig = freshLoad();
  const { r: cfg, logs } = await captureErr(() => loadConfig(downDb));
  assert.deepStrictEqual(cfg.providers, [], '回退形态保持不变：空供应商池，随后由 resolve* 叠 env');
  assert.ok(
    logs.some((l) => l.includes('[model.config]') && l.includes('MODEL_CONFIG_DB_DOWN_V2620')),
    '配置读失败必须带 scope 与原始异常留痕，否则静默换引擎/关限额无从归因',
  );
});

test('库持续不可用：短时间多次读取只留痕一次（失败结果同样入缓存）', async () => {
  const loadConfig = freshLoad();
  const { logs } = await captureErr(async () => {
    await loadConfig(downDb);
    await loadConfig(downDb);
    await loadConfig(downDb);
  });
  const hits = logs.filter((l) => l.includes('[model.config]')).length;
  assert.strictEqual(hits, 1, `热路径必须限频留痕，实际写了 ${hits} 条`);
});

test('配置正常存在（含空行）时不得产生 [model.config] 噪音', async () => {
  const loadConfig = freshLoad();
  const { r: cfg, logs } = await captureErr(() => loadConfig(healthyDb));
  assert.deepStrictEqual(cfg.providers, []);
  assert.ok(!logs.some((l) => l.includes('[model.config]')), '正常路径不应写降级日志');
});
