const test = require('node:test');
const assert = require('node:assert');
const MP = require('../dist/lib/model-proxy.js');
const P = require('../dist/config/pricing.js');

test('assertMargin 毛利熔断：售价<成本×2 抛错，等于/超过通过', () => {
  assert.throws(() => MP.assertMargin(199, 100), /MARGIN_BREACH/); // 199 < 200
  assert.doesNotThrow(() => MP.assertMargin(200, 100));           // 恰好×2
  assert.doesNotThrow(() => MP.assertMargin(300, 100));
});

test('extractJson 容错：代码块包裹/前后杂质/数组/非法返回null', () => {
  assert.deepStrictEqual(MP.extractJson('前缀\n```json\n{"a":1}\n```\n后缀'), { a: 1 });
  assert.deepStrictEqual(MP.extractJson('结果是 [1,2,3] 哦'), [1, 2, 3]);
  assert.deepStrictEqual(MP.extractJson('{"x":"y"}'), { x: 'y' });
  assert.strictEqual(MP.extractJson('没有任何json'), null);
  assert.strictEqual(MP.extractJson('{坏的json'), null);
  assert.strictEqual(MP.extractJson(''), null);
});

test('未配置密钥：进入沙盘模式，零成本、sandbox标记', async () => {
  delete process.env.MODEL_TEXT_ECONOMY_KEY;
  delete process.env.REQUIRE_REAL_MODEL;
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'hi');
  assert.strictEqual(r.sandbox, true);
  assert.strictEqual(r.costFen, 0);
  MP.__setProviderSource(null);
});

test('REQUIRE_REAL_MODEL=true 且无密钥：拒绝"假装创作"并抛错', async () => {
  delete process.env.MODEL_TEXT_ECONOMY_KEY;
  process.env.REQUIRE_REAL_MODEL = 'true';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  await assert.rejects(() => MP.callText(P.EngineTier.ECONOMY, 'writer', 'hi'), /MODEL_NOT_CONFIGURED/);
  delete process.env.REQUIRE_REAL_MODEL;
  MP.__setProviderSource(null);
});

test('真实调用按 usage 与档位单价精确核算成本（经济档 1M入+0.5M出=180分）', async () => {
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://stub.local/v1';
  // 显式隔离 DB：用空 provider 源，确保走 env 档位单价（0.8/2 元），不被 DB 已存 provider 单价串扰
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({ choices: [{ message: { content: '正文' } }], usage: { prompt_tokens: 1_000_000, completion_tokens: 500_000 } }),
  }));
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '正文');
    assert.strictEqual(r.tokensIn, 1_000_000);
    assert.strictEqual(r.costFen, 180); // 0.8 + 1.0 元
  } finally {
    MP.__setHttpTransport(null);
    MP.__setProviderSource(null);
    delete process.env.MODEL_TEXT_ECONOMY_KEY;
  }
});

test('增值服务不赔钱铁律：售价(积分×10分)>=成本×2，且海报成本与实际出图核算一致', () => {
  Object.keys(P.VALUE_ADDED).forEach((k) => {
    const it = P.VALUE_ADDED[k];
    assert.ok(it.points * P.FEN_PER_POINT >= it.costFen * 2, `${k} 毛利不足`);
  });
  // 标准海报：国产 10分/张 × 4张 = 40；旗舰：140分/张 × 4张 = 560（与 callImage 口径一致，防台账失真）
  assert.strictEqual(P.VALUE_ADDED.POSTER_STANDARD.costFen, 40);
  assert.strictEqual(P.VALUE_ADDED.POSTER_FLAGSHIP.costFen, 560);
  assert.ok(P.VALUE_ADDED.POSTER_FLAGSHIP.points * 10 >= 560 * 2);
});

test('稳定后缀存在，服务于人物一致性', () => {
  assert.ok(MP.STABILITY_SUFFIX.includes('稳定'));
});

test('callImage 供应商返回非 data 数组（网关劫持/错误页）→ IMAGE_BAD_RESPONSE，不得崩在 .map', async () => {
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-img-test';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://img-stub.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  MP.__setHttpTransport(async () => ({
    ok: true, status: 200, text: async () => '', json: async () => ({ error: 'upstream html error page' }),
  }));
  try {
    await assert.rejects(() => MP.callImage(P.EngineTier.STANDARD, '海报提示词', 1), /IMAGE_BAD_RESPONSE/);
  } finally {
    MP.__setHttpTransport(null);
    MP.__setProviderSource(null);
    MP.__resetModelHealth();
    delete process.env.MODEL_IMAGE_STANDARD_KEY;
    delete process.env.MODEL_IMAGE_GATEWAY_BASE_URL;
  }
});

test('callText usage 缺 completion_tokens：按 maxTokens 70% 保守估输出，不漏算成本', async () => {
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://stub.local/v1';
  MP.__setHttpTransport(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({ choices: [{ message: { content: '正文' } }], usage: { prompt_tokens: 100 } }),
  }));
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.tokensOut, Math.ceil(4096 * 0.7));
    assert.strictEqual(r.tokensIn, 100);
  } finally {
    MP.__setHttpTransport(null);
    delete process.env.MODEL_TEXT_ECONOMY_KEY;
  }
});

/* ================= v2.82 故障转移链：错误码分流 + 供应商池替补 + 健康降级 ================= */

function failoverCleanup() {
  MP.__setHttpTransport(null);
  MP.__setProviderSource(null);
  MP.__resetModelHealth();
  delete process.env.MODEL_TEXT_ECONOMY_KEY;
  delete process.env.MODEL_GATEWAY_BASE_URL;
  delete process.env.REQUIRE_REAL_MODEL;
}
function poolEntry(over = {}) {
  return { id: 'pv1', name: '池-标准文本', modality: 'text', baseUrl: 'https://pool-a.local/v1', apiKey: 'sk-pool', model: 'pool-model', inYuanPerMTok: 2, outYuanPerMTok: 6, enabled: true, ...over };
}
function okResp(content) {
  return { ok: true, status: 200, text: async () => '', json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 1_000_000, completion_tokens: 500_000 } }) };
}
function badResp(status) {
  return { ok: false, status, text: async () => `err-${status}`, json: async () => ({}) };
}

test('429/5xx 瞬态错误：同模型指数退避重试，成功即不触发故障转移', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  const urls = [];
  let calls = 0;
  MP.__setHttpTransport(async (url) => { urls.push(url); calls += 1; return calls <= 2 ? badResp(429) : okResp('OK'); });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, 'OK');
    assert.strictEqual(calls, 3);
    assert.ok(urls.every((u) => u.startsWith('https://primary.local/v1')));
  } finally { failoverCleanup(); }
});

test('5xx 重试耗尽：自动故障转移到供应商池替补，成本按替补单价核算', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  const primaryHits = [];
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://primary.local')) { primaryHits.push(url); return badResp(503); }
    return okResp('备份正文');
  });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '备份正文');
    assert.strictEqual(primaryHits.length, 3); // 主候选先重试 3 次才切换
    // 替补单价 2元/1M入 + 6元/0.5M出 = 5元 = 500分（若误用档位价 0.8/2 会得 180）
    assert.strictEqual(r.costFen, 500);
    assert.strictEqual(r.fellback, true);
  } finally { failoverCleanup(); }
});

test('401/403 鉴权失败：不重试同模型，直接换池替补并计降级', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  const urls = [];
  MP.__setHttpTransport(async (url) => { urls.push(url); return url.startsWith('https://primary.local') ? badResp(401) : okResp('备份正文'); });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '备份正文');
    assert.strictEqual(urls.length, 2); // 主候选 1 次即换，不空转 3 次重试
    assert.ok(urls.some((u) => u.startsWith('https://pool-a.local')));
  } finally { failoverCleanup(); }
});

test('400 请求级错误：不重试也不换模型，立即上抛（提示词/参数问题换模型无意义）', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  const urls = [];
  MP.__setHttpTransport(async (url) => { urls.push(url); return badResp(400); });
  try {
    await assert.rejects(() => MP.callText(P.EngineTier.ECONOMY, 'writer', 'p'), /MODEL_FATAL_HTTP_400/);
    assert.strictEqual(urls.length, 1);
  } finally { failoverCleanup(); }
});

test('超时/网络错误：重试耗尽后故障转移到替补', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  let primaryCalls = 0;
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://primary.local')) { primaryCalls += 1; throw new Error('MODEL_TIMEOUT'); }
    return okResp('备份正文');
  });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '备份正文');
    assert.strictEqual(primaryCalls, 3);
  } finally { failoverCleanup(); }
});

test('健康降级：主候选连续 3 次失败熔断 10 分钟，后续调用直接跳过', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  let primaryCalls = 0;
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://primary.local')) { primaryCalls += 1; return badResp(503); }
    return okResp('备份正文');
  });
  try {
    for (let i = 0; i < 3; i++) await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p'); // 每次主候选失败计 1 次
    assert.strictEqual(primaryCalls, 9); // 3 次调用 × 3 次重试
    const before = primaryCalls;
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '备份正文');
    assert.strictEqual(primaryCalls, before); // 主候选已被熔断，一次都没再试
  } finally { failoverCleanup(); }
});

test('档位缺密钥但池有可用供应商：池救主，不进沙盘', async () => {
  MP.__resetModelHealth();
  delete process.env.MODEL_TEXT_ECONOMY_KEY;
  delete process.env.REQUIRE_REAL_MODEL;
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  MP.__setHttpTransport(async () => okResp('池救主'));
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '池救主');
    assert.notStrictEqual(r.sandbox, true);
    assert.strictEqual(r.costFen, 500);
  } finally { failoverCleanup(); }
});

test('九岗路由：岗位已路由到池内供应商则优先于档位配置，成本按路由单价核算', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({
    providers: [poolEntry({ id: 'pv2', name: '路由-旗舰文本', baseUrl: 'https://route-b.local/v1', model: 'route-model', inYuanPerMTok: 20, outYuanPerMTok: 50 })],
    routing: { writer: 'pv2' },
  }));
  const urls = [];
  MP.__setHttpTransport(async (url) => { urls.push(url); return okResp('路由正文'); });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '路由正文');
    assert.ok(urls[0].startsWith('https://route-b.local/v1'));
    // 路由单价 20元/1M入 + 50元/0.5M出 = 45元 = 4500分
    assert.strictEqual(r.costFen, 4500);
  } finally { failoverCleanup(); }
});

test('九岗路由失效（供应商被禁用）：回退档位配置，不中断创作', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({
    providers: [poolEntry({ id: 'pv2', name: '路由-已禁用', baseUrl: 'https://route-b.local/v1', model: 'route-model', enabled: false })],
    routing: { writer: 'pv2' },
  }));
  const urls = [];
  MP.__setHttpTransport(async (url) => { urls.push(url); return okResp('档位正文'); });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '档位正文');
    assert.ok(urls[0].startsWith('https://primary.local/v1'));
  } finally { failoverCleanup(); }
});

/* ================= v2.82 图片链路对齐：重试/池替补/健康降级（图片重试上限更保守） ================= */

function imageCleanup() {
  MP.__setHttpTransport(null);
  MP.__setProviderSource(null);
  MP.__resetModelHealth();
  delete process.env.MODEL_IMAGE_STANDARD_KEY;
  delete process.env.MODEL_IMAGE_FLAGSHIP_KEY;
  delete process.env.MODEL_IMAGE_GATEWAY_BASE_URL;
}
function imgPoolEntry(over = {}) {
  return poolEntry({ id: 'pvi', name: '池-国产图片', modality: 'image', baseUrl: 'https://img-pool.local/v1', model: 'img-pool-model', ...over });
}
function imgOk() {
  return { ok: true, status: 200, text: async () => '', json: async () => ({ data: [{ url: 'https://cdn.local/a.png' }] }) };
}

test('图片 429：同端点重试 1 次成功，不触发转移，成本按张数核算（标准10分/张）', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-img-test';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://img-primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  const urls = [];
  let calls = 0;
  MP.__setHttpTransport(async (url) => { urls.push(url); calls += 1; return calls === 1 ? badResp(429) : imgOk(); });
  try {
    const r = await MP.callImage(P.EngineTier.STANDARD, '海报', 1);
    assert.strictEqual(calls, 2);
    assert.ok(urls.every((u) => u.startsWith('https://img-primary.local')));
    assert.deepStrictEqual(r.images, ['https://cdn.local/a.png']);
    assert.strictEqual(r.costFen, 10);
    assert.notStrictEqual(r.fellback, true); // 同端点恢复不算故障转移
  } finally { imageCleanup(); }
});

test('图片 503 重试耗尽（2 次）：自动转移到供应商池 image 端点', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-img-test';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://img-primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [imgPoolEntry()], routing: {} }));
  const primaryHits = [];
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://img-primary.local')) { primaryHits.push(url); return badResp(503); }
    return imgOk();
  });
  try {
    const r = await MP.callImage(P.EngineTier.STANDARD, '海报', 4);
    assert.strictEqual(primaryHits.length, 2); // 图片最多重试 1 次，共 2 次即换
    assert.strictEqual(r.images[0], 'https://cdn.local/a.png');
    assert.strictEqual(r.costFen, 40); // 池救主仍按标准档 10分×4 保守核算
    assert.strictEqual(r.fellback, true);
  } finally { imageCleanup(); }
});

test('图片 400（内容审核拒绝）：不重试不换端点，立即上抛 IMAGE_FATAL_HTTP_400', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-img-test';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://img-primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [imgPoolEntry()], routing: {} }));
  const urls = [];
  MP.__setHttpTransport(async (url) => { urls.push(url); return badResp(400); });
  try {
    await assert.rejects(() => MP.callImage(P.EngineTier.STANDARD, '违规提示词', 1), /IMAGE_FATAL_HTTP_400/);
    assert.strictEqual(urls.length, 1); // 不白烧生成费
  } finally { imageCleanup(); }
});

test('图片 401：同端点不重试，直接换池替补', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-img-test';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://img-primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [imgPoolEntry()], routing: {} }));
  const urls = [];
  MP.__setHttpTransport(async (url) => { urls.push(url); return url.startsWith('https://img-primary.local') ? badResp(401) : imgOk(); });
  try {
    const r = await MP.callImage(P.EngineTier.STANDARD, '海报', 1);
    assert.strictEqual(r.images[0], 'https://cdn.local/a.png');
    assert.strictEqual(urls.length, 2);
    assert.ok(urls[1].startsWith('https://img-pool.local'));
  } finally { imageCleanup(); }
});

test('图片端点全部缺密钥但池有 image 供应商：池救主，不抛 IMAGE_NOT_CONFIGURED', async () => {
  MP.__resetModelHealth();
  MP.__setProviderSource(async () => ({ providers: [imgPoolEntry()], routing: {} }));
  MP.__setHttpTransport(async () => imgOk());
  try {
    const r = await MP.callImage(P.EngineTier.FLAGSHIP, '海报', 1); // 旗舰位无 key，由池兜底
    assert.strictEqual(r.images[0], 'https://cdn.local/a.png');
    assert.strictEqual(r.costFen, 140); // 旗舰请求按旗舰下限核算（池实际更便宜，只高估不低估）
  } finally { imageCleanup(); }
});

test('无档位图片密钥且池内仅有 text 供应商：模态过滤，仍抛 IMAGE_NOT_CONFIGURED（业务侧自动退款）', async () => {
  MP.__resetModelHealth();
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} })); // text 池不得当图片端点
  MP.__setHttpTransport(async () => imgOk());
  try {
    await assert.rejects(() => MP.callImage(P.EngineTier.STANDARD, '海报', 1), /IMAGE_NOT_CONFIGURED/);
  } finally { imageCleanup(); }
});

test('图片健康降级：主端点 3 次调用失败后熔断，第 4 次直接走池替补', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_IMAGE_STANDARD_KEY = 'sk-img-test';
  process.env.MODEL_IMAGE_GATEWAY_BASE_URL = 'https://img-primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [imgPoolEntry()], routing: {} }));
  let primaryCalls = 0;
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://img-primary.local')) { primaryCalls += 1; return badResp(503); }
    return imgOk();
  });
  try {
    for (let i = 0; i < 3; i++) {
      const r = await MP.callImage(P.EngineTier.STANDARD, '海报', 1); // 主端点失败计 1 次，池救主成功
      assert.strictEqual(r.images[0], 'https://cdn.local/a.png');
    }
    assert.strictEqual(primaryCalls, 6); // 3 次 × 2 尝试
    const before = primaryCalls;
    const r = await MP.callImage(P.EngineTier.STANDARD, '海报', 1); // 主端点熔断，零尝试直接走池
    assert.strictEqual(r.images[0], 'https://cdn.local/a.png');
    assert.strictEqual(primaryCalls, before);
  } finally { imageCleanup(); }
});

// v2.543 推理参数自适应：Kimi K3 思考模型只接受 temperature=1，否则 400 invalid temperature
test('pickInferenceParams：moonshot 域名（Kimi）强制 temperature=1 且不发 reasoning_effort', () => {
  const p = MP.pickInferenceParams('https://api.moonshot.cn/v1', 'kimi-k3-thinking');
  assert.strictEqual(p.temperature, 1);
  assert.strictEqual(p.reasoningEffort, undefined);
});
test('pickInferenceParams：OpenAI o1/o3/o4 系列思考模型 temperature=1 + reasoning_effort=minimal', () => {
  const p1 = MP.pickInferenceParams('https://api.openai.com/v1', 'o1-mini');
  assert.strictEqual(p1.temperature, 1);
  assert.strictEqual(p1.reasoningEffort, 'minimal');
  const p3 = MP.pickInferenceParams('https://api.openai.com/v1', 'o3-2024');
  assert.strictEqual(p3.temperature, 1);
  assert.strictEqual(p3.reasoningEffort, 'minimal');
  const p4 = MP.pickInferenceParams('https://api.openai.com/v1', 'o4-high');
  assert.strictEqual(p4.temperature, 1);
});
test('pickInferenceParams：普通模型保持 0.9 + reasoning_effort=minimal（不破坏既有行为）', () => {
  const p = MP.pickInferenceParams('https://ark.cn-beijing.volces.com/api/v3', 'doubao-seed-1-6');
  assert.strictEqual(p.temperature, 0.9);
  assert.strictEqual(p.reasoningEffort, 'minimal');
  const p2 = MP.pickInferenceParams('https://api.deepseek.com/v1', 'deepseek-chat');
  assert.strictEqual(p2.temperature, 0.9);
  assert.strictEqual(p2.reasoningEffort, 'minimal');
});
test('pickInferenceParams：空 baseUrl/model 不崩溃，回退默认参数', () => {
  const p = MP.pickInferenceParams('', '');
  assert.strictEqual(p.temperature, 0.9);
  assert.strictEqual(p.reasoningEffort, 'minimal');
});
test('pickInferenceParams：非 o1/o3/o4 开头的 OpenAI 模型（如 gpt-4o）走默认 0.9', () => {
  const p = MP.pickInferenceParams('https://api.openai.com/v1', 'gpt-4o-mini');
  assert.strictEqual(p.temperature, 0.9);
  assert.strictEqual(p.reasoningEffort, 'minimal');
});

/* ================= v2.317 HTTP200 空响应治理：200 但无 content 当瞬态失败，重试/切候选/耗尽抛错，绝不静默成功、不满额计费 ================= */

// 200 + 大 usage，但 choices/message/content 为空——供应商安全静默/截断/抖动的典型形态
function emptyContentResp(choice) {
  return {
    ok: true, status: 200, text: async () => '',
    json: async () => ({ choices: [choice ?? { message: { content: '' }, finish_reason: 'length' }], usage: { prompt_tokens: 100, completion_tokens: 4096 } }),
  };
}

test('v2.317 HTTP200 空 content：按瞬态同模型重试，第2次成功则不换候选/不沙盘', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let calls = 0;
  MP.__setHttpTransport(async () => { calls += 1; return calls === 1 ? emptyContentResp() : okResp('救回正文'); });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '救回正文');
    assert.strictEqual(calls, 2); // 同端点第2次成功，未切候选
    assert.notStrictEqual(r.sandbox, true);
  } finally { failoverCleanup(); }
});

test('v2.317 HTTP200 choices 空数组 / message 缺失：同属空响应瞬态，重试成功', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let calls = 0;
  MP.__setHttpTransport(async () => {
    calls += 1;
    if (calls === 1) return { ok: true, status: 200, text: async () => '', json: async () => ({ choices: [], usage: {} }) };
    if (calls === 2) return { ok: true, status: 200, text: async () => '', json: async () => ({ choices: [{ finish_reason: 'length' }], usage: {} }) };
    return okResp('救回正文');
  });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '救回正文');
    assert.strictEqual(calls, 3);
  } finally { failoverCleanup(); }
});

test('v2.317 空 content 重试耗尽：切池替补成功且 fellback；空响应不计费（成本只含成功调用一次）', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  const primaryHits = [];
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://primary.local')) { primaryHits.push(url); return emptyContentResp(); }
    return okResp('备份正文');
  });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '备份正文');
    assert.strictEqual(primaryHits.length, 3); // 主候选重试3次才换
    assert.strictEqual(r.fellback, true);
    // 空响应带 completion_tokens=4096 的假 usage：若被当成功满额估算，成本会混入档位价；
    // 500 分=替补单次成本（2元/1M入+6元/0.5M出），证明空响应一次都没计费
    assert.strictEqual(r.costFen, 500);
  } finally { failoverCleanup(); }
});

test('v2.317 仅有 reasoning_content 无 content：业务 JSON 只认 content，判空响应并切候选', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  const primaryHits = [];
  MP.__setHttpTransport(async (url) => {
    if (url.startsWith('https://primary.local')) {
      primaryHits.push(url);
      return emptyContentResp({ message: { content: '', reasoning_content: '模型想了很多但最终什么都没输出' }, finish_reason: 'stop' });
    }
    return okResp('备份正文');
  });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'architect', 'p');
    assert.strictEqual(r.text, '备份正文');
    assert.strictEqual(primaryHits.length, 3);
    assert.strictEqual(r.fellback, true);
  } finally { failoverCleanup(); }
});

test('v2.317 思维链污染：<think>...</think> 包裹的业务JSON自动剥离思维链，首调成功不重试', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let calls = 0;
  const polluted = '<think>先分析：大纲里 beats: ["一","二"]，需要两个人物</think>\n\n{\n  "老桂": { "want": "守住口碑" }\n}';
  MP.__setHttpTransport(async () => { calls += 1; return {
    ok: true, status: 200, text: async () => '',
    json: async () => ({ choices: [{ message: { content: polluted }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 800 } }),
  }; });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'designer', 'p');
    assert.strictEqual(calls, 1, '剥离后即合法业务输出，不触发重试');
    assert.ok(!r.text.includes('<think>') && !r.text.includes('</think>'), '思维链标签已剥离');
    assert.deepStrictEqual(MP.extractJson(r.text), { 老桂: { want: '守住口碑' } }, '剥离后直接是可解析JSON');
  } finally { failoverCleanup(); }
});

test('v2.317 只有未闭合 <think>（模型想完没给答案）：剥后为空按空响应重试，第2次正常成功', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [], routing: {} }));
  let calls = 0;
  MP.__setHttpTransport(async () => {
    calls += 1;
    const c = calls === 1 ? '<think>我想了很多但 token 用完了，最终答案……' : '正常正文';
    return {
      ok: true, status: 200, text: async () => '',
      json: async () => ({ choices: [{ message: { content: c }, finish_reason: 'length' }], usage: { prompt_tokens: 100, completion_tokens: 4096 } }),
    };
  });
  try {
    const r = await MP.callText(P.EngineTier.ECONOMY, 'writer', 'p');
    assert.strictEqual(r.text, '正常正文');
    assert.strictEqual(calls, 2);
  } finally { failoverCleanup(); }
});

/* ================= v2.317 通义万相原生异步协议（compatible-mode 实测 404，只能 /api/v1 提交任务+轮询） ================= */

function wanxPool(over = {}) {
  return poolEntry({ id: 'pvw', name: '通义-万相', modality: 'image', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'wanx2.1-t2i-turbo', ...over });
}
function wanxSetup() {
  MP.__resetModelHealth();
  process.env.WANX_POLL_MS = '1';
  MP.__setProviderSource(async () => ({ providers: [wanxPool()], routing: {} }));
}
function sresp(obj) { return { ok: true, status: 200, text: async () => '', json: async () => obj }; }

test('v2.317 万相异步happy path：提交任务→轮询SUCCEEDED拿URL；X-DashScope-Async头、竖版size映射720*1280、n透传', async () => {
  wanxSetup();
  const reqs = [];
  let polls = 0;
  MP.__setHttpTransport(async (url, init) => {
    reqs.push({ url, init });
    if (url.includes('/image-synthesis')) {
      return sresp({ output: { task_id: 't1', task_status: 'PENDING' } });
    }
    if (url.includes('/tasks/')) {
      polls += 1;
      if (polls === 1) return sresp({ output: { task_id: 't1', task_status: 'RUNNING' } });
      return sresp({ output: { task_id: 't1', task_status: 'SUCCEEDED', results: [{ url: 'https://cdn.local/wanx.png' }] } });
    }
    return badResp(404);
  });
  try {
    const r = await MP.callImage(P.EngineTier.STANDARD, '民宿海报', 1); // 默认竖版 1024x1536
    assert.strictEqual(r.images[0], 'https://cdn.local/wanx.png');
    assert.strictEqual(r.costFen, 10);
    const submit = reqs.find((x) => x.url.includes('/image-synthesis'));
    assert.ok(submit, '必须走 /api/v1/services/aigc/text2image/image-synthesis 提交');
    assert.strictEqual(submit.init.headers['X-DashScope-Async'], 'enable', '异步提交必须带 X-DashScope-Async: enable');
    const sb = JSON.parse(submit.init.body);
    assert.strictEqual(sb.model, 'wanx2.1-t2i-turbo');
    assert.strictEqual(sb.input.prompt, '民宿海报');
    assert.strictEqual(sb.parameters.size, '720*1280', '竖版 OpenAI 尺寸映射为万相近似值（星号分隔）');
    assert.strictEqual(sb.parameters.n, 1);
    assert.ok(reqs.some((x) => x.url.endsWith('/api/v1/tasks/t1')), '必须轮询 /api/v1/tasks/t1');
  } finally { imageCleanup(); delete process.env.WANX_POLL_MS; }
});

test('v2.317 万相内容审核失败(DataInspection)：不重试不换候选，立即抛 IMAGE_FATAL_HTTP_400 不白烧钱', async () => {
  wanxSetup();
  let submits = 0;
  MP.__setHttpTransport(async (url) => {
    if (url.includes('/image-synthesis')) { submits += 1; return sresp({ output: { task_id: 't2', task_status: 'PENDING' } }); }
    return sresp({ output: { task_id: 't2', task_status: 'FAILED', code: 'DataInspection.Failed', message: 'data inspection failed' } });
  });
  try {
    await assert.rejects(() => MP.callImage(P.EngineTier.STANDARD, '违规海报', 1), /IMAGE_FATAL_HTTP_400/);
    assert.strictEqual(submits, 1, '审核拒绝只提交1次');
  } finally { imageCleanup(); delete process.env.WANX_POLL_MS; }
});

test('v2.317 万相系统错误首次失败：按瞬态整体重试（重新提交任务），第2次SUCCEEDED', async () => {
  wanxSetup();
  let round = 0;
  let polls = 0;
  MP.__setHttpTransport(async (url) => {
    if (url.includes('/image-synthesis')) {
      round += 1; polls = 0;
      return sresp({ output: { task_id: `t${round}`, task_status: 'PENDING' } });
    }
    polls += 1;
    if (round === 1) return sresp({ output: { task_id: 't1', task_status: 'FAILED', code: 'InternalError', message: 'boom' } });
    return sresp({ output: { task_id: 't2', task_status: 'SUCCEEDED', results: [{ url: 'https://cdn.local/wanx2.png' }] } });
  });
  try {
    const r = await MP.callImage(P.EngineTier.STANDARD, '民宿海报', 1);
    assert.strictEqual(r.images[0], 'https://cdn.local/wanx2.png');
    assert.strictEqual(round, 2, '系统错误瞬态：重新提交第2次任务');
  } finally { imageCleanup(); delete process.env.WANX_POLL_MS; }
});

test('v2.317 所有候选持续空 content：耗尽抛 MODEL_EMPTY_CONTENT，绝不返回空成功或进沙盘', async () => {
  MP.__resetModelHealth();
  process.env.MODEL_TEXT_ECONOMY_KEY = 'sk-test';
  process.env.MODEL_GATEWAY_BASE_URL = 'https://primary.local/v1';
  MP.__setProviderSource(async () => ({ providers: [poolEntry()], routing: {} }));
  let calls = 0;
  MP.__setHttpTransport(async () => { calls += 1; return emptyContentResp(); });
  try {
    await assert.rejects(() => MP.callText(P.EngineTier.ECONOMY, 'designer', 'p'), /MODEL_EMPTY_CONTENT/);
    assert.strictEqual(calls, 6); // 主候选3次 + 池替补3次，全部真实尝试后才失败（上层据此退款）
  } finally { failoverCleanup(); }
});
