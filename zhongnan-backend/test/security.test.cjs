const test = require('node:test');
const assert = require('node:assert');
const { encrypt, decrypt, maskKey } = require('../dist/lib/crypto.js');

test('密钥 AES 加密可逆，且密文不含明文', () => {
  const secret = 'sk-abcdef1234567890';
  const enc = encrypt(secret);
  assert.ok(!enc.includes(secret), '密文不暴露明文');
  assert.notStrictEqual(enc, secret);
  assert.strictEqual(decrypt(enc), secret, '可正确解密');
});

test('两次加密结果不同（随机IV），坏密文安全降级不抛错', () => {
  assert.notStrictEqual(encrypt('same'), encrypt('same'), '随机IV');
  assert.strictEqual(decrypt('not.a.valid.payload'), '');
});

test('脱敏只露末4（v2.55 收紧：原首3外泄对 32 字符 OpenAI key 暴露 22%）', () => {
  assert.strictEqual(maskKey('sk-abcdefgh1234'), '••••••1234');
  assert.strictEqual(maskKey('short'), '••••');
  assert.strictEqual(maskKey(''), '');
  // 长串：除末4外全部 •
  assert.strictEqual(maskKey('sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxABCD'), '••••••ABCD');
});
