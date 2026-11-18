// v2.507 无 Key/供应商故障的用户可读降级：内部错误码一律转中文可操作提示，且不泄露厂商细节。
const { test } = require('node:test');
const assert = require('node:assert');

const M = require('../dist/lib/model-error-message.js');
const B = require('../dist/lib/blackbox.js');

test('未配置密钥：中文提示指向超管后台，机器码保留', () => {
  const r = M.friendlyModelError(new Error('MODEL_NOT_CONFIGURED:economy'));
  assert.strictEqual(r.code, 'MODEL_NOT_CONFIGURED');
  assert.match(r.message, /尚未接入|未配置/);
  assert.match(r.message, /超管后台/);
  assert.ok(!/NOT_CONFIGURED/.test(r.message), '不得把内部码原样展示给用户');

  const img = M.friendlyModelError(new Error('IMAGE_NOT_CONFIGURED:STANDARD'));
  assert.strictEqual(img.code, 'IMAGE_NOT_CONFIGURED');
  assert.match(img.message, /超管后台/);
});

test('鉴权失败/审核拒绝/限流/超时/取消/空返回 各有专属中文文案', () => {
  const auth = M.friendlyModelError(new Error('MODEL_FATAL_HTTP_401:{"error":"invalid api key"}'));
  assert.strictEqual(auth.code, 'MODEL_FATAL_HTTP_401');
  assert.match(auth.message, /密钥/);
  assert.ok(!/invalid api key/i.test(auth.message), '不得回传供应商原始报文');

  const audit = M.friendlyModelError(new Error('IMAGE_FATAL_HTTP_400:DataInspection failed'));
  assert.strictEqual(audit.code, 'IMAGE_FATAL_HTTP_400');
  assert.match(audit.message, /审核/);

  assert.match(M.friendlyModelError(new Error('MODEL_TRANSIENT_HTTP_429:slow down')).message, /稍后重试/);
  assert.match(M.friendlyModelError(new Error('MODEL_TIMEOUT')).message, /超时/);
  const cancelled = M.friendlyModelError(new Error('CANCELLED'));
  assert.strictEqual(cancelled.code, 'CANCELLED');
  assert.match(cancelled.message, /取消/);
  assert.match(M.friendlyModelError(new Error('MODEL_EMPTY_CONTENT:HTTP200')).message, /为空|异常/);
  assert.match(M.friendlyModelError(new Error('IMAGE_BAD_RESPONSE: x')).message, /为空|异常/);
  assert.match(M.friendlyModelError(new Error('MODEL_TRANSIENT_HTTP_500:boom')).message, /稍后重试/);
});

test('未知错误兜底中文话术，绝不回传原始英文栈', () => {
  const r = M.friendlyModelError(new Error('some internal stack trace at Foo.bar'));
  assert.strictEqual(r.code, 'MODEL_UNKNOWN');
  assert.match(r.message, /失败/);
  assert.ok(!/internal stack/i.test(r.message));
});

test('英文语言包可用（海外档/英文界面）', () => {
  const r = M.friendlyModelError(new Error('MODEL_NOT_CONFIGURED:economy'), 'en');
  assert.match(r.message, /not configured|admin/i);
});

test('sanitizeClientError：内部码转中文，厂商泄露仍中性化，普通中文原样保留', () => {
  assert.match(B.sanitizeClientError('MODEL_NOT_CONFIGURED:economy'), /超管后台/);
  assert.ok(!/MODEL_NOT_CONFIGURED/.test(B.sanitizeClientError('MODEL_NOT_CONFIGURED:economy')));
  assert.match(B.sanitizeClientError('IMAGE_FATAL_HTTP_400:DataInspection'), /审核/);

  const leaked = B.sanitizeClientError('callText failed: ECONNRESET https://api.openai.com/v1/chat');
  assert.ok(!/openai/i.test(leaked));
  assert.match(leaked, /创作引擎/);

  assert.strictEqual(B.sanitizeClientError('项目不存在'), '项目不存在');
});
