/**
 * v2.624 密钥解密失败必须可归因
 *
 * 证伪背景：crypto.decrypt 对任何失败（CONFIG_SECRET 轮换后旧密文解不开、密文被截断/损坏、
 * 手工写入了非密文）一律静默返回 ''，上层按「未配置」处理：
 *  ① 超管后台明明显示已保存的供应商 Key，实际全部解不出 → resolveText 回落 env/报未配置，无从排查；
 *  ② handoff.ts 读交接状态失败静默回落 EMPTY_HANDOFF，接力上下文整段消失且不留任何痕迹。
 * 本文件锁定：返回值仍为 ''（绝不把堆栈抛给用户），但必须写入 [crypto.decrypt]。
 */
const test = require('node:test');
const assert = require('node:assert');

const CRYPTO = '../dist/lib/crypto.js';

function freshCrypto(secret) {
  if (secret) process.env.CONFIG_SECRET = secret; else delete process.env.CONFIG_SECRET;
  delete require.cache[require.resolve(CRYPTO)];
  return require(CRYPTO);
}

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => (a instanceof Error && a.stack ? a.stack : String(a))).join(' ')); };
  try {
    const r = fn();
    return { r, logs };
  } finally {
    console.error = orig;
  }
}

test.after(() => { delete process.env.CONFIG_SECRET; });

test('密钥轮换后旧密文解不开：仍返回空串，但必须写入 [crypto.decrypt]', () => {
  const oldKey = 'A'.repeat(40);
  const newKey = 'B'.repeat(40);
  const cipherText = freshCrypto(oldKey).encrypt('sk-live-v2624');
  const { r, logs } = captureErr(() => freshCrypto(newKey).decrypt(cipherText));
  assert.strictEqual(r, '', '对外契约不变：解密失败按未配置处理，不抛错');
  assert.ok(
    logs.some((l) => l.includes('[crypto.decrypt]')),
    '密钥轮换导致全部密文失效必须留痕，否则后台显示已配置、实际全部不可用',
  );
});

test('密文被截断/损坏同样留痕，且不得把密文内容打进日志', () => {
  const secret = 'C'.repeat(40);
  const mod = freshCrypto(secret);
  const bad = 'not-a-ciphertext-v2624';
  const { r, logs } = captureErr(() => mod.decrypt(bad));
  assert.strictEqual(r, '');
  const hit = logs.find((l) => l.includes('[crypto.decrypt]'));
  assert.ok(hit, '损坏密文必须留痕');
  assert.ok(!hit.includes('not-a-ciphertext-v2624'), '日志不得回显密文内容（防敏感信息二次外泄）');
});

test('正常加解密不受影响，且不得产生 [crypto.decrypt] 噪音', () => {
  const mod = freshCrypto('D'.repeat(40));
  const enc = mod.encrypt('sk-ok-v2624');
  const { r, logs } = captureErr(() => mod.decrypt(enc));
  assert.strictEqual(r, 'sk-ok-v2624');
  assert.ok(!logs.some((l) => l.includes('[crypto.decrypt]')), '正常路径不应写降级日志');
});
