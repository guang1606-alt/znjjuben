const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
const hasModel = (m) => new RegExp(`model\\s+${m}\\s*{`).test(schema);

test('核心数据模型齐全', () => {
  ['User', 'AdminUser', 'Membership', 'PointsAccount', 'LedgerEntry', 'Order', 'Payment',
   'Project', 'Script', 'GenerationTask', 'ModelCallLog', 'Poster', 'PkBattle', 'Invitation',
   'Feedback', 'Post', 'Listing', 'Purchase', 'KnowledgeItem', 'ModelConfig', 'AuditLog',
   'MatureConsent', 'StorageObject'].forEach((m) => assert.ok(hasModel(m), `缺模型 ${m}`));
});

test('积分流水幂等：LedgerEntry 必须有唯一幂等键，杜绝重复扣费', () => {
  const block = schema.match(/model\s+LedgerEntry\s*{([\s\S]*?)}/)[1];
  assert.ok(/idempotencyKey\s+String\s+@unique/.test(block));
});

test('成年授权留痕：四声明+年龄+法域+到期时间齐全', () => {
  const block = schema.match(/model\s+MatureConsent\s*{([\s\S]*?)}/)[1];
  ['ageConfirmed', 'purposePersonal', 'noMinorDistribution', 'boundaryAccepted',
   'legalSelfResponsible', 'age', 'region', 'expireAt', 'paidOrderId'].forEach((f) => assert.ok(block.includes(f), `MatureConsent缺字段 ${f}`));
});

test('有限存储：对象记字节、可软删，User反向关系成对', () => {
  const block = schema.match(/model\s+StorageObject\s*{([\s\S]*?)}/)[1];
  assert.ok(/bytes\s+Int/.test(block) && block.includes('deletedAt'));
  assert.ok(schema.includes('matureConsents MatureConsent[]') && schema.includes('storageObjects StorageObject[]'));
  assert.ok(/model\s+MatureConsent[\s\S]*?user\s+User\s+@relation/.test(schema));
  assert.ok(/model\s+StorageObject[\s\S]*?user\s+User\s+@relation/.test(schema));
});

test('安全红线：schema 不允许明文模型密钥列（只能加密落 ModelConfig.payloadEnc）', () => {
  assert.ok(!/apiKey\s+String/.test(schema), '出现明文 apiKey 列');
  assert.ok(hasModel('ModelConfig') && /payloadEnc\s+String/.test(schema));
});

test('积分分桶与交易状态枚举完整（赠送/充值/佣金分账）', () => {
  ['RECHARGE', 'BONUS', 'COMMISSION'].forEach((e) => assert.ok(schema.includes(e)));
  ['ON_SHELF', 'ESCROW', 'SOLD', 'REFUNDED'].forEach((e) => assert.ok(schema.includes(e)));
});
