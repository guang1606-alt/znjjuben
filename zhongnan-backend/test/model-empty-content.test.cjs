// HTTP200 空正文（仅 reasoning_content）不应在同一候选上重复烧钱：直接换候选
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const MP = require('../dist/lib/model-proxy.js');
const SL = require('../dist/lib/spend-limit.js');
const P = require('../dist/config/pricing.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

afterEach(() => {
  SL.__setSpendControlForTest(null);
  MP.__setProviderSource(null);
  MP.__setHttpTransport(null);
  MP.__resetModelHealth();
  delete process.env.MODEL_TEXT_ECONOMY_KEY;
  delete process.env.MODEL_GATEWAY_BASE_URL;
});

const emptyContent = () => ({
  ok: true, status: 200, text: async () => '',
  json: async () => ({
    choices: [{ message: { content: '', reasoning_content: '想了很多但正文被截断' }, finish_reason: 'length' }],
    usage: { prompt_tokens: 10, completion_tokens: 8 },
  }),
});

test('空正文失败不在同候选重试，直接交给下一候选', async () => {
  SL.__setSpendControlForTest({ prisma: createMemoryPrisma(), enabled: false, totalLimitYuan: 0 });
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-empty';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://empty.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let hits = 0;
  MP.__setHttpTransport(async () => { hits++; return emptyContent(); });
  await assert.rejects(MP.callText(P.EngineTier.ECONOMY, 'writer', 'p', { maxTokens: 16 }), /MODEL_EMPTY_CONTENT/);
  assert.equal(hits, 1, '空正文应一次即放弃该候选，不重试三次');
});
