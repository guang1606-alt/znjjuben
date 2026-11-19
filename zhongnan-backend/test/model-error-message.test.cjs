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

// v2.563 测试期消费硬限额：额度用尽/台账不可用必须给可操作话术，
// 不能把 MODEL_SPEND_LIMIT_* 内部码原样丢给用户；额度用尽也不能误导为「稍后重试」（重试不会变好）。
test('消费硬限额失败：中文可操作话术，不泄露内部码、不误导重试', () => {
  const total = M.friendlyModelError(new Error('MODEL_SPEND_LIMIT_TOTAL 测试期总额度已不足'));
  assert.strictEqual(total.code, 'MODEL_SPEND_LIMIT_TOTAL');
  assert.match(total.message, /额度|限额/);
  assert.match(total.message, /管理员/);
  assert.ok(!/MODEL_SPEND_LIMIT/.test(total.message), '不得把内部码原样展示给用户');
  assert.ok(!/稍后重试/.test(total.message), '额度用尽反复重试不会变好，不能引导重试');
  assert.match(total.message, /不扣积分/);

  const key = M.friendlyModelError(new Error('MODEL_SPEND_LIMIT_KEY 该 API Key 的消费额度已不足'));
  assert.strictEqual(key.code, 'MODEL_SPEND_LIMIT_KEY');
  assert.match(key.message, /额度|限额/);
  assert.ok(!/MODEL_SPEND_LIMIT|API Key/.test(key.message), '不得向用户暴露密钥层细节');

  const un = M.friendlyModelError(new Error('MODEL_SPEND_LIMIT_UNAVAILABLE 消费限额台账不可用，已阻止模型调用'));
  assert.strictEqual(un.code, 'MODEL_SPEND_LIMIT_UNAVAILABLE');
  assert.match(un.message, /额度|限额/);
  assert.match(un.message, /稍后重试/);
  assert.ok(!/MODEL_SPEND_LIMIT/.test(un.message));

  // userMessageOf 也必须先命中限额规则，而不是因含中文而原样透出（旧行为会连内部码一起给用户）
  const viaUser = M.userMessageOf(new Error('MODEL_SPEND_LIMIT_TOTAL 测试期总额度已不足'));
  assert.ok(!/MODEL_SPEND_LIMIT/.test(viaUser));

  const en = M.friendlyModelError(new Error('MODEL_SPEND_LIMIT_TOTAL'), 'en');
  assert.match(en.message, /budget|limit/i);
});

test('未知错误兜底中文话术，绝不回传原始英文栈', () => {
  const r = M.friendlyModelError(new Error('some internal stack trace at Foo.bar'));
  assert.strictEqual(r.code, 'MODEL_UNKNOWN');
  assert.match(r.message, /失败/);
  assert.ok(!/internal stack/i.test(r.message));
});

test('modelErrorMeta：业务错误不带 code，只有真模型失败才下发机器码', () => {
  // 业务错误（余额不足/项目不存在）不能挂 MODEL_UNKNOWN，否则前端会把业务失败误判成模型故障
  assert.deepStrictEqual(M.modelErrorMeta(new Error('积分不足：需要 39 分，当前 5 分')), {});
  assert.deepStrictEqual(M.modelErrorMeta(new Error('项目不存在')), {});
  assert.strictEqual(M.modelErrorMeta(new Error('IMAGE_NOT_CONFIGURED:STANDARD')).code, 'IMAGE_NOT_CONFIGURED');
  assert.strictEqual(M.modelErrorMeta(new Error('MODEL_TIMEOUT')).code, 'MODEL_TIMEOUT');
});

test('userMessageOf：中文业务错误原样透出，英文内部异常（Prisma/堆栈）一律换成通用中文', () => {
  assert.strictEqual(M.userMessageOf(new Error('积分不足：需要 39 分，当前 5 分')), '积分不足：需要 39 分，当前 5 分');
  const leaked = M.userMessageOf(new Error('PrismaClientKnownRequestError: Unique constraint failed on the fields: (`id`)'));
  assert.match(leaked, /失败|稍后重试/);
  assert.ok(!/Prisma|Unique constraint/i.test(leaked), '不得把英文内部异常原样给用户');
  const en = M.userMessageOf(new Error('something exploded'), 'en');
  assert.ok(!/something exploded/.test(en));
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
