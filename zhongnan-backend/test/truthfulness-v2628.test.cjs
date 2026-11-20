/**
 * v2.628 对象存储删除/转存失败必须按统一规范可归因。
 *
 * 先证伪：
 *  1) `deleteTosObject` 云侧删除失败时 `console.error('[tos] delete failed:', (e as Error).message)`：
 *     ① 丢掉堆栈——签名错/桶权限/网络超时无法区分调用点与根因；② 非 Error 抛出时 message 为
 *     undefined，日志只剩一句 "delete failed"；③ 不走 `[模块.动作]` 统一 scope，告警检索漏收。
 *     用户侧「配额显示已释放、云上仍占空间」的名实不符因此长期无迹可查。
 *  2) `uploadImageToTos` 同根：转存失败静默回落 DB 持久化，图片改成 blob 进库（库膨胀、列表变慢），
 *     线上只看到一条无堆栈的 message，分不清是抓图失败、签名失败还是 TOS 5xx。
 * 修复：两处改 `logInternal(e, 'tos.delete' / 'tos.upload')`。返回值/回退语义完全不变。
 */
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
// 必须在 require 前配置：桶常量在模块加载时读取
process.env.TOS_REGION = 'cn-beijing';
process.env.TOS_BUCKET = 'bucket-v2628';
process.env.TOS_ACCESS_KEY_ID = 'ak-v2628';
process.env.TOS_ACCESS_KEY_SECRET = 'sk-v2628';
const { uploadImageToTos, deleteTosObject, tosObjectHost } = require('../dist/lib/tos.js');

const ORIG_FETCH = global.fetch;
afterEach(() => { global.fetch = ORIG_FETCH; });

function captureErrors(fn) {
  const calls = []; const orig = console.error;
  console.error = (...a) => {
    calls.push(a.map((x) => (x instanceof Error && x.stack ? x.stack : String(x))).join(' '));
  };
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ value, calls }), (err) => { throw err; })
    .finally(() => { console.error = orig; });
}

describe('v2.628 TOS 失败必须可归因', () => {
  it('1) 转存失败：返回 null 不变，但必须留痕 tos.upload 且带堆栈', async () => {
    global.fetch = async () => { throw new Error('ECONNRESET'); };
    const { value, calls } = await captureErrors(() => uploadImageToTos('https://example.com/poster.png'));
    assert.strictEqual(value, null, '回退语义不变：失败仍返回 null 交调用方落库');
    const hit = calls.find((c) => c.includes('[tos.upload]'));
    assert.ok(hit, '转存失败不得静默，必须留痕；实际：' + calls.join(' | '));
    assert.ok(hit.includes('ECONNRESET'), '必须保留原始异常信息');
    assert.ok(hit.includes('\n    at '), '必须保留堆栈，否则无法定位调用点');
  });

  it('2) 删除失败：返回 false 不变，但必须留痕 tos.delete 且带原始状态', async () => {
    global.fetch = async () => ({ ok: false, status: 500, text: async () => 'internal error' });
    const url = `https://${tosObjectHost()}/poster/a.png`;
    const { value, calls } = await captureErrors(() => deleteTosObject(url));
    assert.strictEqual(value, false, '删除失败仍返回 false，不阻断用户删除');
    const hit = calls.find((c) => c.includes('[tos.delete]'));
    assert.ok(hit, '云侧删除失败不得静默，必须留痕；实际：' + calls.join(' | '));
    assert.ok(hit.includes('TOS DELETE failed 500'), '必须保留真实状态码');
  });

  it('3) 非本桶地址属正常跳过：零日志、零请求', async () => {
    let requested = 0;
    global.fetch = async () => { requested += 1; return { ok: true, status: 204, text: async () => '' }; };
    const { value, calls } = await captureErrors(() => deleteTosObject('https://other-bucket.example.com/x.png'));
    assert.strictEqual(value, false);
    assert.strictEqual(requested, 0, '外链不得发起删除请求');
    assert.strictEqual(calls.length, 0, '正常跳过不应产生日志；实际：' + calls.join(' | '));
  });

  it('4) 删除成功属正常路径：零日志', async () => {
    global.fetch = async () => ({ ok: true, status: 204, text: async () => '' });
    const url = `https://${tosObjectHost()}/poster/b.png`;
    const { value, calls } = await captureErrors(() => deleteTosObject(url));
    assert.strictEqual(value, true);
    assert.strictEqual(calls.length, 0, '成功路径不应产生日志；实际：' + calls.join(' | '));
  });
});
