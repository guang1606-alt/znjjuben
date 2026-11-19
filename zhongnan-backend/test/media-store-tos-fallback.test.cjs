/**
 * v2.541 TOS 转存失败必须回退落库
 * 背景：uploadImageToTos 过去失败时「原样返回临时地址」，业务看起来成功，但模型临时链接会过期，
 * 几天后用户的海报全变裂图。现在失败返回 null，persistImage 继续落库返回 /media/:id。
 * 本文件在独立进程里先设置 TOS_* 环境变量再加载模块（tos.ts 在模块加载时读取配置）。
 */
process.env.TOS_REGION = 'cn-test';
process.env.TOS_BUCKET = 'znbucket';
process.env.TOS_ACCESS_KEY_ID = 'ak-test';
process.env.TOS_ACCESS_KEY_SECRET = 'sk-test';

const { test } = require('node:test');
const assert = require('node:assert');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f030005fe02fea72d1b4a0000000049454e44ae426082', 'hex');
const INPUT = 'https://model.example.com/tmp/poster.png';

function stubFetch({ putOk }) {
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ url: u, method });
    if (method === 'PUT') {
      return new Response(putOk ? '' : 'boom', { status: putOk ? 200 : 500 });
    }
    return new Response(new Uint8Array(PNG), { status: 200, headers: { 'content-type': 'image/png' } });
  };
  return calls;
}

const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');
const { persistImage } = require('../dist/lib/media-store.js');

test('TOS 转存成功：落一条元数据（不存字节）并返回 /media/:id 统一地址', async () => {
  const mem = createMemoryPrisma();
  const calls = stubFetch({ putOk: true });
  const url = await persistImage(INPUT, 'poster', mem, 'u_tos_ok');
  assert.match(url, /^\/media\//, 'v2.542 两种存储模式对外地址结构统一');
  assert.ok(calls.some((c) => c.method === 'PUT'), '必须真的发起 TOS PUT');
  const rows = await mem.mediaAsset.findMany({ where: {} });
  assert.strictEqual(rows.length, 1, 'TOS 成功也要落元数据，让「我的海报」能看到');
  assert.ok(!rows[0].bytes, 'TOS 模式不重复存字节');
  assert.match(String(rows[0].externalUrl), /^https:\/\/znbucket\.tos-cn-test\.volces\.com\/poster\//);
  assert.strictEqual(rows[0].userId, 'u_tos_ok');
  assert.ok(rows[0].size > 0, '体积用于配额与列表展示');
  const agg = await mem.storageObject.aggregate({ where: { userId: 'u_tos_ok', deletedAt: null }, _sum: { bytes: true } });
  assert.strictEqual(agg._sum.bytes, rows[0].size, 'TOS 模式同样计入存储用量');
});

test('TOS 转存失败：不得把临时地址当永久地址，必须回退落库 /media/:id', async () => {
  const mem = createMemoryPrisma();
  stubFetch({ putOk: false });
  const url = await persistImage(INPUT, 'poster', mem, 'u_tos_fail');
  assert.match(url, /^\/media\//, '失败必须回退站内永久地址，不能返回模型临时 URL');
  const rows = await mem.mediaAsset.findMany({ where: {} });
  assert.strictEqual(rows.length, 1, '回退必须真的落库');
  assert.strictEqual(rows[0].kind, 'poster');
  assert.ok(rows[0].size > 0);
  assert.strictEqual(rows[0].userId, 'u_tos_fail');
  const agg = await mem.storageObject.aggregate({ where: { userId: 'u_tos_fail', deletedAt: null }, _sum: { bytes: true } });
  assert.ok((agg._sum.bytes || 0) > 0, '回退落库同样要计入存储用量');
});

test('降级后 /media/:id 真的能读到字节（不是只返回一个字符串）', async () => {
  const mem = createMemoryPrisma();
  stubFetch({ putOk: false });
  const url = await persistImage(INPUT, 'poster', mem);
  const id = url.replace('/media/', '');
  const row = await mem.mediaAsset.findUnique({ where: { id } });
  assert.ok(row, '落库行必须存在');
  assert.ok(Buffer.isBuffer(row.bytes) && row.bytes.length > 0, '落库必须带真实字节');
  assert.match(row.mime, /^image\/png/);
});
