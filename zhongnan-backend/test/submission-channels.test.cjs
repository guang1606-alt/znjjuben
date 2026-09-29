const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/config/submission-channels.js');

test('通道库：国内外≥10，且初始联系方式一律留空待核验（不臆造）', () => {
  assert.ok(S.SUBMISSION_CHANNELS.length >= 10);
  assert.ok(S.SUBMISSION_CHANNELS.some((c) => c.region === 'domestic'));
  assert.ok(S.SUBMISSION_CHANNELS.some((c) => c.region === 'overseas'));
  S.SUBMISSION_CHANNELS.forEach((c) => {
    assert.ok(c.kinds.length >= 1);
    assert.ok(c.fitTags.length >= 1);
    // 未核验前不得有伪造的具体联系方式
    if (c.contact.verifiedAt == null) assert.strictEqual(c.contact.detail, '');
  });
  assert.strictEqual(S.unverifiedCount(), S.SUBMISSION_CHANNELS.length);
});

test('匹配：女频情感优先推女频/综合通道，数量受限，带verified标记', () => {
  const m = S.matchChannels({ tags: ['情感', '虐恋', '甜宠'], genre: '女频', count: 5 });
  assert.ok(m.length <= 5 && m.length >= 1);
  m.forEach((x) => assert.strictEqual(x.verified, false));
  assert.ok(m.some((x) => x.name.includes('九州') || x.name.includes('版权中心')));
});

test('地区过滤：overseas 只返回海外平台', () => {
  const m = S.matchChannels({ region: 'overseas', count: 10 });
  assert.ok(m.length >= 3);
  m.forEach((x) => assert.strictEqual(x.region, 'overseas'));
});
