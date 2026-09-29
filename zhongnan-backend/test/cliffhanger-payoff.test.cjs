// v2.80 集尾钩子跨集兑现账本（cliffhanger-payoff）测试：钩子位派生 / 开场兑现检测 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveHookBit,
  hookPayoffCheck,
  hookPayoffDirective,
  HARD_HOOK_TYPES,
  HOOK_OPENING_WINDOW,
} = require('../dist/engine/cliffhanger-payoff.js');

// —— deriveHookBit：qcReport.cliffhanger → HookBit ——

test('deriveHookBit：合法 reversal 钩子位正常入账', () => {
  const bit = deriveHookBit({ score: 92, type: 'reversal', typeLabel: '反转钩', endingSnippet: '门被推开，林晚举着股权书走进来，全场哗然', issues: [] }, 7);
  assert.ok(bit);
  assert.equal(bit.ep, 7);
  assert.equal(bit.type, 'reversal');
  assert.equal(bit.score, 92);
  assert.ok(bit.snippet.includes('股权书'));
});

test('deriveHookBit：type none/weak/未知不入账', () => {
  assert.equal(deriveHookBit({ score: 50, type: 'none', snippet: '无钩子结尾场景描写' }, 3), null);
  assert.equal(deriveHookBit({ score: 30, type: 'weak', snippet: '……？？' }, 3), null);
  assert.equal(deriveHookBit({ score: 50, type: 'whatever', snippet: '未知类型的内容片段' }, 3), null);
});

test('deriveHookBit：片段过短不入账（防标点残片）', () => {
  assert.equal(deriveHookBit({ score: 90, type: 'crisis', snippet: '枪口。' }, 4), null);
});

test('deriveHookBit：raw 非对象或 epNo 非法返回 null', () => {
  assert.equal(deriveHookBit(null, 5), null);
  assert.equal(deriveHookBit('oops', 5), null);
  assert.equal(deriveHookBit({ score: 90, type: 'reveal', snippet: '真相在信封里，谁也不敢拆开' }, NaN), null);
  assert.equal(deriveHookBit({ score: 90, type: 'reveal', snippet: '真相在信封里，谁也不敢拆开' }, 0), null);
});

test('deriveHookBit：片段截断到 100、score clamp 0-100 且缺省兜底 0', () => {
  const long = '字'.repeat(180);
  const bit = deriveHookBit({ score: 250, type: 'mystery', snippet: long }, 2);
  assert.ok(bit);
  assert.equal(bit.snippet.length, 100);
  assert.equal(bit.score, 100);
  const bit2 = deriveHookBit({ type: 'emotional', snippet: '她转过身去，肩膀在轻轻发抖' }, 2);
  assert.ok(bit2);
  assert.equal(bit2.score, 0);
});

// —— hookPayoffCheck：跨集兑现检测 ——

const mkText = (openBody, restBody = '') => openBody + restBody;

test('hookPayoffCheck：无前集钩子/文本过短 → 未检测', () => {
  assert.equal(hookPayoffCheck(null, 'x'.repeat(100)).checked, false);
  const bit = deriveHookBit({ score: 90, type: 'reversal', snippet: '这不是聘请，这是宣战。' }, 6);
  assert.equal(hookPayoffCheck(bit, '太短').checked, false);
});

test('hookPayoffCheck：开场复现上集钩子关键词 → opening，无 issue', () => {
  const bit = deriveHookBit({ score: 90, type: 'reversal', snippet: '"这不是聘请，这是宣战。"' }, 6);
  const r = hookPayoffCheck(bit, mkText('林晚把合同推回桌上："这不是聘请，这是宣战。"会议室瞬间安静。', '后续铺陈内容继续展开剧情走向。'));
  assert.equal(r.checked, true);
  assert.equal(r.paid, 'opening');
  assert.equal(r.prevType, 'reversal');
  assert.deepEqual(r.issues, []);
});

test('hookPayoffCheck：开场承接信号词（原来/真相）也算接住', () => {
  const bit = deriveHookBit({ score: 88, type: 'reveal', snippet: '信封滑落在地，没有人敢去捡。' }, 6);
  const r = hookPayoffCheck(bit, mkText('答案很快揭晓：真相远比传闻更狠，继承权从来不属于他们任何一个人。', '后段继续。'));
  assert.equal(r.paid, 'opening');
  assert.deepEqual(r.issues, []);
});

test('hookPayoffCheck：钩子后段才接住 → late_payoff（mid）', () => {
  const bit = deriveHookBit({ score: 90, type: 'reversal', snippet: '"这不是聘请，这是宣战。"' }, 6);
  // 开场 35% 无关键词，关键词落在中段
  const open = 'x'.repeat(60); // 60/200 = 30% < 35%
  const r = hookPayoffCheck(bit, mkText(open + ' padded'.repeat(6) + '，直到此刻她才说出：这不是聘请，这是宣战。', '。'));
  assert.equal(r.paid, 'late');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].severity, 'mid');
  assert.equal(r.issues[0].type, 'late_payoff');
});

test('hookPayoffCheck：硬钩全文未接住 → hook_dropped（high）', () => {
  for (const t of HARD_HOOK_TYPES) {
    const bit = deriveHookBit({ score: 90, type: t, snippet: '上集结尾的具体钩子内容。' }, 6);
    const r = hookPayoffCheck(bit, mkText('他转身离开，雨下得很大，街道空无一人，只剩路灯还亮着。'));
    assert.equal(r.paid, 'none');
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].severity, 'high');
    assert.equal(r.issues[0].type, 'hook_dropped');
  }
});

test('hookPayoffCheck：软钩（情感/动作）未接住降级 mid', () => {
  for (const t of ['emotional', 'action_cut']) {
    const bit = deriveHookBit({ score: 65, type: t, snippet: '她转过身去，肩膀在轻轻发抖。' }, 6);
    const r = hookPayoffCheck(bit, mkText('清晨的阳光照进办公室，新的一天开始了，谁都没有提起昨晚的事。'));
    assert.equal(r.paid, 'none');
    assert.equal(r.issues[0].severity, 'mid');
  }
});

test('hookPayoffCheck：en 链路——开场承接信号（turned out）接住 + 关键词大小写不敏感', () => {
  const bit = deriveHookBit({ score: 90, type: 'reveal', snippet: 'The envelope hit the floor. Nobody dared to pick it up.' }, 6);
  const r1 = hookPayoffCheck(bit, mkText('It turned out the envelope held the merger papers. The room went dead silent.'), 'en');
  assert.equal(r1.paid, 'opening');
  assert.deepEqual(r1.issues, []);
  const r2 = hookPayoffCheck(bit, mkText('She slowly bent down and picked up the envelope, hands trembling.'), 'en');
  assert.equal(r2.paid, 'late'); // 关键词（picked→pick）落在开场窗口之后 → 兑现迟到
  assert.equal(r2.issues[0].type, 'late_payoff');
});

test('hookPayoffCheck：en 链路——en snippet 小词（is/the）不构成误判关键词', () => {
  const bit = deriveHookBit({ score: 90, type: 'crisis', snippet: 'This is the end of the road for her.' }, 6);
  // 开场含 "is"/"the" 但无 ≥3 字母关键词 → 不算接住
  const r = hookPayoffCheck(bit, mkText('Morning came quietly. The city woke up as usual, indifferent.'), 'en');
  assert.equal(r.paid, 'none');
  assert.equal(r.issues[0].severity, 'high');
});

// —— hookPayoffDirective：架构师指令 ——

test('hookPayoffDirective：有硬钩才出话，zh/en 双语齐备且 en 层零中文', () => {
  const bit = deriveHookBit({ score: 92, type: 'reversal', snippet: 'Boardroom doors swung open. Lin Wan held up the equity papers.' }, 6);
  const d = hookPayoffDirective(bit);
  assert.ok(d.zh.includes('【集尾钩子·跨集兑现】'));
  assert.ok(d.zh.includes('第6集'));
  assert.ok(d.zh.includes('反转钩'));
  assert.ok(d.zh.includes('开场前1/3'));
  assert.ok(d.en.includes('[Cliffhanger payoff'));
  assert.ok(d.en.includes('Episode 6'));
  assert.ok(d.en.includes('Reversal'));
  assert.ok(d.en.includes('first third'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en)); // en 层系统文案零中文（片段为英文剧本内容）
});

test('hookPayoffDirective：无钩子返回空串（两语言一致）', () => {
  const d = hookPayoffDirective(null);
  assert.equal(d.zh, '');
  assert.equal(d.en, '');
});

test('常量 sanity：开场窗口 35%、硬钩四类', () => {
  assert.equal(HOOK_OPENING_WINDOW, 0.35);
  assert.deepEqual(HARD_HOOK_TYPES, ['reversal', 'crisis', 'reveal', 'mystery']);
});
