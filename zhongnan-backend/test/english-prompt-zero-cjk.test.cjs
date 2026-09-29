// v2.00 总闭环断言：英文链路下，真正拼装下发给每个大模型岗位的「完整提示词」零中文。
// 关键：必须先 patch model-proxy.callText，再首次 require pipeline，
// 因为 pipeline 在模块加载时解构 callText，事后替换无效。
const test = require('node:test');
const assert = require('node:assert');
const mp = require('../dist/lib/model-proxy.js');
const { EngineTier } = require('../dist/config/pricing.js');

const captured = [];
mp.callText = async (_tier, role, prompt) => { captured.push({ role, prompt }); return { text: '', sandbox: true, costFen: 0 }; };
const { runEpisode } = require('../dist/agents/pipeline.js');

const cjk = (s) => /[一-鿿]/.test(String(s));
function emptyBible() { return { worldview: '', characters: {}, timeline: [], foreshadow: [] }; }

test('v2.00 英文链路：七岗位收到的完整提示词逐条零中文（含风格/口吻/细节/模式骨架）', async () => {
  captured.length = 0;
  await runEpisode(EngineTier.STANDARD, emptyBible(), 'hidden ceo office revenge', () => {},
    { lang: 'en', style: 'suspense', episodeCount: 3, episodeIndex: 1 });
  assert.ok(captured.length >= 7, '应拦截到全部七岗位提示词');
  const roles = new Set(captured.map((c) => c.role));
  for (const expect of ['architect', 'designer', 'writer', 'audience', 'polisher', 'compliance', 'market']) {
    assert.ok(roles.has(expect), `缺少岗位 ${expect} 的提示词`);
  }
  const leak = captured.filter((c) => cjk(c.prompt));
  assert.deepStrictEqual(leak.map((c) => c.role), [], '英文链路任何岗位提示词都不得含中文');
});

test('v2.00 英文链路无风格、跨集同样全提示词零中文', async () => {
  captured.length = 0;
  for (const idx of [0, 2]) {
    await runEpisode(EngineTier.ECONOMY, emptyBible(), 'rebirth underdog comeback', () => {},
      { lang: 'en', episodeCount: 3, episodeIndex: idx });
  }
  const leak = captured.filter((c) => cjk(c.prompt));
  assert.deepStrictEqual(leak.map((c) => c.role), []);
});
