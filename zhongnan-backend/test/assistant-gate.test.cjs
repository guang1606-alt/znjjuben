const test = require('node:test');
const assert = require('node:assert');
const G = require('../dist/config/assistant-capability.js');
const B = require('../dist/lib/blackbox.js');
require('../dist/lib/model-proxy.js').__setProviderSource(async () => ({ providers: [], routing: {} })); // v2.194 隔离真实DB供应商池，防测试打真机

test('v2.54 小南能力闸门：免费/基础/高级/专业逐级解锁，低等级拿不到高阶能力', () => {
  assert.strictEqual(G.assistantGate('FREE', 'guide').allowed, true);
  assert.strictEqual(G.assistantGate('FREE', 'inspiration').allowed, false);
  assert.strictEqual(G.assistantGate('BASIC', 'inspiration').allowed, true);
  assert.strictEqual(G.assistantGate('BASIC', 'deep_advice').allowed, false);
  assert.strictEqual(G.assistantGate('ADVANCED', 'character_plot_fix').allowed, true);
  assert.strictEqual(G.assistantGate('ADVANCED', 'voice_control').allowed, false);
  assert.strictEqual(G.assistantGate('PRO', 'habit_learning').allowed, true);
  // 越权时给升级引导
  const v = G.assistantGate('FREE', 'market_analysis');
  assert.strictEqual(v.needLevel, 'PRO');
  assert.ok(/专业会员/.test(v.upsell.zh));
});

test('fix 维度映射：只信服务端规则号，dimLabel 伪造不能降级越权', () => {
  // 命中基础润色规则白名单才降级
  assert.strictEqual(G.fixActionByDim('台词', 'dialogue_colloquial'), 'dialogue_polish');
  assert.strictEqual(G.fixActionByDim('Format', 'format.spacing'), 'dialogue_polish');
  // 剧情/人物=深度优化
  assert.strictEqual(G.fixActionByDim('剧情', 'rhythm_flat'), 'character_plot_fix');
  assert.strictEqual(G.fixActionByDim('人物', 'agency'), 'character_plot_fix');
  // 安全：rule 是深度规则时，dimLabel 写“台词”也不能降级
  assert.strictEqual(G.fixActionByDim('台词', 'rhythm_flat'), 'character_plot_fix');
  // 安全：空 rule/未知 rule 一律 fail-closed 到高级深度优化
  assert.strictEqual(G.fixActionByDim('台词'), 'character_plot_fix');
});

test('c220 fix 驼峰引擎键：纯台词表层病症走基础润色，结构/剧情键 fail-closed 到高级', () => {
  // 质检 chip 点击即修直接传引擎驼峰键：纯台词/文字表层 → 基础会员可修
  ['tongue', 'dialogueAiTaste', 'dialogueWater', 'dialogueLength', 'dialoguePingpong',
   'dialogueNameCall', 'dialogueFunction', 'echoDialogue', 'expositionDialogue',
   'emotionLabelDialogue', 'rhetoricalBarrage', 'parenOverdirect', 'vagueWord',
   'mirrorVisualDialogue', 'roundRobinDialogue', 'subtextErase', 'voicePrint'].forEach((r) => {
    assert.strictEqual(G.fixActionByDim('xxx', r), 'dialogue_polish', `${r} 应走基础台词润色`);
  });
  // 结构/剧情/动作/跨集类驼峰键必须留在高级深度优化（fail-closed，防越权）
  ['scenePadding', 'plotArmor', 'conflictDensity', 'misunderstanding', 'cliche', 'grounded',
   'lengthPlan', 'hollowAction', 'faintOnCue', 'instantTrust', 'villainStall', 'propLedger',
   'characterPresence', 'emotionalAftermath', 'styleCheck', 'fidgetProp'].forEach((r) => {
    assert.strictEqual(G.fixActionByDim('台词', r), 'character_plot_fix', `${r} 不应被降级`);
  });
  // 防前缀伪装：以 dialogue 开头但实为结构改写的未收录键不得蒙混进白名单
  assert.strictEqual(G.fixActionByDim('台词', 'dialogueStructureRewrite'), 'character_plot_fix');
});

test('v2.54 黑盒护栏：厂商/型号/端点/密钥命中，正常剧本内容不误伤', () => {
  const dirty = { stage: 'done', meta: { model: 'deepseek_v4pro', url: 'https://ark.cn-beijing.volces.com/api/v3', key: 'sk-abcdef1234567890abcdef' } };
  const hits = B.scanVendorLeaks(dirty);
  assert.ok(hits.length >= 3, `应命中多处泄露，实际 ${hits.join(',')}`);
  const clean = { stage: 'done', engineTier: 'FLAGSHIP', content: '林晚晴推开门，雨下得很大。（豆包？不，这是正文测试）'.replace('豆包？不，这是正文测试', '她深吸一口气'), market: { score: 82 } };
  assert.deepStrictEqual(B.scanVendorLeaks(clean), []);
  // 错误消息清洗
  const msg = B.sanitizeClientError('callText failed: ECONNRESET https://api.openai.com/v1/chat');
  assert.ok(!/openai/i.test(msg));
  assert.ok(/创作引擎/.test(msg));
});
