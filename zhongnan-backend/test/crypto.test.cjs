const test = require('node:test');
const assert = require('node:assert');
const C = require('../dist/lib/crypto.js');

test('AES-256-GCM 加解密往返（含中文/长串/空串）', () => {
  ['sk-abc123XYZ', '密钥口令：终南剧本助手🔑', 'x'.repeat(500), ''].forEach((s) => {
    const enc = C.encrypt(s);
    assert.strictEqual(C.decrypt(enc), s);
  });
});

test('同一明文两次加密密文不同（随机IV），且密文不含明文', () => {
  const a = C.encrypt('sk-secret-key-999');
  const b = C.encrypt('sk-secret-key-999');
  assert.notStrictEqual(a, b);
  assert.ok(!a.includes('secret'));
  assert.strictEqual(a.split('.').length, 3); // iv.tag.data
});

test('篡改密文任一段都解密失败并安全返回空串（不抛堆栈）', () => {
  const enc = C.encrypt('sk-important');
  const [iv, tag, data] = enc.split('.');
  const tamperData = `${iv}.${tag}.${data.slice(0, -2)}AA`;
  const tamperTag = `${iv}.${tag.slice(0, -2)}AA.${data}`;
  assert.strictEqual(C.decrypt(tamperData), '');
  assert.strictEqual(C.decrypt(tamperTag), '');
});

test('畸形/垃圾输入一律返回空串而非抛错', () => {
  ['', 'garbage', 'a.b', '...', null, undefined].forEach((x) => assert.strictEqual(C.decrypt(x), ''));
});

test('maskKey 脱敏：仅露末4，前缀不外泄（防 32 字符 OpenAI key 22% 泄露）', () => {
  assert.strictEqual(C.maskKey(''), '');
  assert.strictEqual(C.maskKey('abc'), '••••');
  assert.strictEqual(C.maskKey('12345678'), '••••'); // 恰好8位也短串全遮
  const m = C.maskKey('sk-1234567890abcd');
  assert.ok(m.includes('•'));
  assert.ok(!m.startsWith('sk-'), '首3字符不得外泄');
  assert.ok(m.endsWith('abcd'), '末4保留便于核对');
  assert.ok(!m.includes('1234567'), '中段不得泄露');
  assert.ok(!m.includes('sk-'), '前缀整体不得出现');
  // 32字符 OpenAI 风格 key：仅末4外泄（泄露 12.5%）
  const long = 'sk-proj-' + 'x'.repeat(23) + 'ABCD';
  const m2 = C.maskKey(long);
  assert.ok(m2.endsWith('ABCD'));
  assert.ok(!m2.includes('sk-proj'));
  assert.strictEqual(m2.slice(0, -4).replace(/•/g, '').length, 0, '除末4外全是•');
});
