/**
 * v2.618 超限/空图片丢弃必须可归因
 *
 * 证伪背景：persistImage 的三条降级里，抓取/落库失败都会写 [media.fallback]，
 * 唯独「字节为空 / 超过 MEDIA_MAX_BYTES」这一条直接 `return input`，完全静默。
 * 它同样回退的是模型临时地址——当天能看，几天后过期即裂图；
 * 线上出现裂图时，无从区分是抓取失败、落库失败，还是体积超限被丢弃。
 *
 * 本文件锁定：回退行为保持不变（仍返回原地址、不抛错），但必须写入 [media.too-large]
 * 且带上实际字节数与上限，便于按图片体积反查供应商。
 */
const test = require('node:test');
const assert = require('node:assert');
const { persistImage } = require('../dist/lib/media-store.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TOS_KEYS = ['TOS_REGION', 'TOS_BUCKET', 'TOS_ACCESS_KEY_ID', 'TOS_ACCESS_KEY_SECRET', 'TOS_ENDPOINT'];

function captureErr(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...args) => { logs.push(args.map((a) => String(a)).join(' ')); };
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ r, logs }))
    .finally(() => { console.error = orig; });
}

test('超过体积上限回退原地址时必须写入 [media.too-large] 留痕', async () => {
  for (const k of TOS_KEYS) delete process.env[k];
  process.env.MEDIA_MAX_BYTES = '4';
  try {
    const mem = createMemoryPrisma();
    const { r: url, logs } = await captureErr(() => persistImage(PNG_1PX, 'poster', mem));
    assert.equal(url, PNG_1PX, '回退原地址的行为保持不变');
    assert.ok(
      logs.some((l) => l.includes('[media.too-large]') && l.includes('limit=4')),
      '超限丢弃必须带 scope 与实际上限留痕，否则海报过期裂图无从归因',
    );
  } finally {
    delete process.env.MEDIA_MAX_BYTES;
  }
});

test('正常体积入库成功，不得产生 [media.too-large] 噪音', async () => {
  for (const k of TOS_KEYS) delete process.env[k];
  const mem = createMemoryPrisma();
  const { r: url, logs } = await captureErr(() => persistImage(PNG_1PX, 'poster', mem));
  assert.match(url, /^\/media\/ma_\d+$/);
  assert.ok(!logs.some((l) => l.includes('[media.too-large]')), '正常落库不应写丢弃日志');
});
