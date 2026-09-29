const test = require('node:test');
const assert = require('node:assert');
const { showDontTellScan } = require('../dist/engine/show-dont-tell.js');

// 中文"叙述代替展示"剧本
const TELL_SCRIPT = `
场景：客厅 日 内景
李明感到很生气，她心里十分紧张。
王刚非常愤怒地走了过来，他心想这个人真是无耻。
他们聊了很久，经过一番争论，最终他们决定放弃。
就这样过了三天，时间过得很快。
△李明坐在沙发上
她是一个美丽的女人，有着迷人的眼睛和优雅的气质。
他记得那天的每一个细节，脑海中浮现出当时的画面。
`;

// 中文"展示而非叙述"剧本
const SHOW_SCRIPT = `
场景：客厅 日 内景
△李明猛地把咖啡杯摔在桌上，碎片溅了一地
李明（颤抖）：你……你怎么能这样……
△王刚大步走过来，一把揪住李明的衣领
王刚（厉声）：闭嘴！轮不到你说话！
李明（哽咽）：三年的感情，你说扔就扔……
△王刚松开手，转身走向门口，头也不回
`;

test('叙述剧本应检出 high 级问题', () => {
  const res = showDontTellScan(TELL_SCRIPT, 'zh');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 2, `应至少2个 high 级问题，实际${highIssues.length}：${highIssues.map((i) => i.type).join(',')}`);
  assert.ok(res.score < 70, `叙述剧本得分应低于70，实际${res.score}`);
  assert.ok(res.tellEmotionHits.length >= 3, `应检出3+直接说情绪，实际${res.tellEmotionHits.length}`);
  assert.ok(res.summaryHits.length >= 2, `应检出2+总结代替场景，实际${res.summaryHits.length}`);
  assert.ok(res.abstractAdjHits.length >= 2, `应检出2+抽象形容，实际${res.abstractAdjHits.length}`);
  assert.ok(res.innerMonologueHits.length >= 1, `应检出内心独白，实际${res.innerMonologueHits.length}`);
});

test('展示剧本应无 high 级问题', () => {
  const res = showDontTellScan(SHOW_SCRIPT, 'zh');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `展示剧本不应有 high 级问题，实际有：${highIssues.map((i) => i.type).join(',')}`);
  assert.ok(res.score >= 80, `展示剧本得分应≥80，实际${res.score}`);
});

test('长叙述无动作检测', () => {
  const longProse = `
场景：客厅 日 内景
这是一间很大的客厅，墙上挂着几幅画。
阳光从窗户照进来，照在深色的木地板上。
房间中央摆着一张红木茶几，上面放着两杯已经凉了的茶。
角落里有一盆绿植，叶子有些发黄。
窗帘是深蓝色的，微微晃动。
△李明走了进来
李明：你来了。
`;
  const res = showDontTellScan(longProse, 'zh');
  const proseIssue = res.issues.find((i) => i.type === 'long_prose_no_action');
  assert.ok(proseIssue, '应检出长叙述无动作');
  assert.ok(res.longestProseBlock >= 4, `最长叙述块应≥4行，实际${res.longestProseBlock}`);
});

test('英文链路零中文泄漏', () => {
  const enScript = `
SCENE: Living room, day, INT
Li Ming felt very angry and she was furious.
Wang Gang was scared and nervous.
They talked for a while, after some time they agreed.
Time passed, days went by.
She was a beautiful woman with mysterious eyes.
He thought about that day, he remembered every detail.
△Li Ming sits on the sofa
`;
  const res = showDontTellScan(enScript, 'en');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `英文叙述剧本应检出 high 级问题`);
  // 所有 advice 必须是英文
  for (const issue of res.issues) {
    assert.ok(!/[\u4e00-\u9fa5]/.test(issue.advice), `英文 advice 不含中文：${issue.advice}`);
  }
  assert.ok(res.tellEmotionHits.length >= 2, `英文应检出2+直接说情绪`);
  assert.ok(res.summaryHits.length >= 1, `英文应检出总结代替场景`);
});

test('空文本不崩溃', () => {
  const res = showDontTellScan('', 'zh');
  assert.strictEqual(res.score, 100);
  assert.strictEqual(res.issues.length, 0);
});

test('得分范围 0-100', () => {
  const res1 = showDontTellScan(TELL_SCRIPT, 'zh');
  const res2 = showDontTellScan(SHOW_SCRIPT, 'zh');
  assert.ok(res1.score >= 0 && res1.score <= 100, `叙述剧本得分${res1.score}越界`);
  assert.ok(res2.score >= 0 && res2.score <= 100, `展示剧本得分${res2.score}越界`);
});

// c211 落库统一 digest：issues 形态引擎此前被 buildQcEngineDigest 的 hits 硬过滤整体漏掉
const M2 = require('../dist/engine/show-dont-tell.js');
test('c211 showDontTellDigest：四类计数/issue 四字段/封顶 6/截断/null 抛错', () => {
  const res = M2.showDontTellScan(TELL_SCRIPT, 'zh');
  assert.ok(res.issues.length > 0, '夹具本身应有 issue');
  const big = (n) => 'x'.repeat(n);
  const fake = {
    score: 10,
    issues: Array.from({ length: 9 }, (_, i) => ({
      severity: i % 2 ? 'mid' : 'high', type: big(60), evidence: big(400), advice: big(400), extra: '剥离',
    })),
    tellEmotionHits: [{}, {}, {}], summaryHits: [{}], abstractAdjHits: [{}, {}], innerMonologueHits: [{}, {}, {}, {}],
    longestProseBlock: 7,
  };
  const d = M2.showDontTellDigest(fake);
  assert.strictEqual(d.issues.length, 6, 'issues 封顶 6');
  assert.deepStrictEqual(Object.keys(d.issues[0]).sort(), ['advice', 'evidence', 'severity', 'type']);
  assert.ok(d.issues.every((i) => i.type.length <= 40));
  assert.ok(d.issues.every((i) => i.evidence.length <= 180));
  assert.ok(d.issues.every((i) => i.advice.length <= 200));
  assert.deepStrictEqual(d.counts, { tellEmotion: 3, summary: 1, abstractAdj: 2, innerMonologue: 4 });
  assert.strictEqual(d.longestProseBlock, 7);
  assert.throws(() => M2.showDontTellDigest(null));
  // 真引擎结果：四类计数与 hits 数组一致，健康稿 issues 为空仍落库（供卡片"健康"计数）
  const live = M2.showDontTellDigest(res);
  assert.strictEqual(live.counts.tellEmotion, res.tellEmotionHits.length);
  assert.strictEqual(live.counts.summary, res.summaryHits.length);
});

test('c211 detectSdtLang 按汉字探测；forStorage 自动语种', () => {
  assert.strictEqual(M2.detectSdtLang('她感到很生气'), 'zh');
  assert.strictEqual(M2.detectSdtLang('She felt angry about it'), 'en');
  const zh = M2.showDontTellForStorage('她感到很生气，心里很紧张，她伤心地哭了。他们聊了很久，最终他们决定放弃。');
  assert.ok(zh.issues.some((i) => i.type === 'tell_emotion'));
  const en = M2.showDontTellForStorage('She felt very angry and was anxious. They talked for a while and eventually they decided to leave. He thought about it and she knew that it was wrong.');
  assert.ok(en.issues.length >= 1, '英文稿自动 en 探测应检出问题');
});

// c213：场头收口共享切分器——「场N：」无"景"字格式必须切断长散文计数（旧内联正则只认 场景/内景/外景）
test('c213 场N：场头切断长叙述计数，多场健康稿不误判 long_prose_no_action', () => {
  const scene = (n) => `场${n}：走廊·日
林小凡沿着走廊往前走，手里攥着复印件。
她在拐角处停了一下，听着办公室里的动静。`;
  const text = [1, 2, 3, 4, 5].map(scene).join('\n');
  const res = M2.showDontTellScan(text, 'zh');
  assert.ok(!res.issues.some((i) => i.type === 'long_prose_no_action'),
    '五场各 2 行叙述、用「场N：」分场，不应误判长散文；实际 issues=' + JSON.stringify(res.issues.map((i) => i.type)));
});
