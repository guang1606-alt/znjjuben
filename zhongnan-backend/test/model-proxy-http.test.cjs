'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const config = require('../dist/lib/model-config.js');
const proxy = require('../dist/lib/model-proxy.js');
const { validateProvider } = require('../dist/lib/model-config-policy.js');

test('合法 HTTP 自建模型端点使用明文 HTTP 并返回模型正文', async () => {
  const originalResolve = config.resolveText;
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'loopback reply' } }], usage: { prompt_tokens: 1, completion_tokens: 2 } }));
  });
  server.on('clientError', (_err, socket) => socket.destroy());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const provider = { id: 'loopback', name: 'loopback', modality: 'text', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, apiKey: 'local-test-only', model: 'audit', inYuanPerMTok: 1, outYuanPerMTok: 1, enabled: true };
  config.resolveText = async () => null;
  proxy.__setProviderSource(async () => ({ providers: [provider], routing: { writer: provider.id } }));
  try {
    assert.equal(validateProvider(provider).ok, true);
    const result = await proxy.callText('economy', 'writer', 'local test', { timeoutMs: 1000, maxTokens: 10 });
    assert.equal(result.text, 'loopback reply');
    assert.equal(result.tokensOut, 2);
    assert.deepEqual(requests, [{ url: '/v1/chat/completions', authorization: 'Bearer local-test-only' }]);
  } finally {
    config.resolveText = originalResolve;
    proxy.__setProviderSource(null);
    proxy.__resetModelHealth();
    await new Promise(resolve => server.close(resolve));
  }
});
