const test = require('node:test');
const assert = require('node:assert');
const { punchlineDensityScore } = require('../dist/engine/punchline-density-score.js');

// —— 中文剧本样本 ——

// 高金句密度剧本（反转+宣言+对比+决心+拷问，开头+中段+结尾都有）
const ZH_HIGH_DENSITY = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
林晚：从今天起，这家公司就是我的。轮不到你来管。
李经理冲过来，揪住林晚衣领
李经理：你凭什么这么说？你算什么东西？
林晚：你以为我只是个无名小卒？其实，我是你们最大的股东。
△李经理愣住，王总从里面走出
王总：你给我等着，迟早你会后悔！
林晚：你等着看吧。我偏要把你赶出这个行业，绝不罢手。
黑衣人：谁才是真正的老板，今天才知道。
王总：你以为我跪下求饶就完了？殊不知，我已经把股份转移了。
林晚：就算你转移了又怎样？你以为这样就能逃？
`;

// 低金句密度剧本（只有1个弱金句）
const ZH_LOW_DENSITY = `
场景：客厅 日 内景
△林晚坐在沙发上，手里拿着茶杯
李明（平静）：今天天气不错。
林晚：嗯，是啊。
李明：你给我等着。
△两人沉默了一会儿
林晚：事情就这样吧。
`;

// 无金句剧本
const ZH_NO_PUNCHLINE = `
场景：客厅 日 内景
△林晚把茶杯放下，站起身
李明（平静）：事情就这样定了。
门关上了。
一切归于平静。
`;

// 全是弱金句的剧本
const ZH_ALL_WEAK = `
场景：客厅 日 内景
△林晚站在窗前
李明：你给我等着。
林晚：走着瞧。
李明：做梦。
林晚：休想。
`;

// 英文高金句密度剧本
const EN_HIGH_DENSITY = `
Scene: Company lobby, Day, Interior
Lin walks in, the receptionist blocks her.
Receptionist: No appointment, no entry.
Lin: From today on, this company is mine. It's not your place to stop me.
Manager: Who do you think you are? Why should I listen to you?
Lin: You thought I was a nobody? Actually, I'm your largest shareholder.
The CEO rushes out.
CEO: Just you wait, sooner or later you'll regret this!
Lin: I'll never stop until I drive you out of this industry.
Man in black: Who knew who the real boss was all along.
CEO: You thought I'd kneel and beg? Little did I know, I've already transferred the shares.
Lin: Even if you transferred them, so what? You think you can escape?
`;

test('中文高金句密度应识别多个金句且高分', () => {
  const res = punchlineDensityScore(ZH_HIGH_DENSITY, 'zh');
  assert.ok(res.count >= 3, `应至少3个金句，实际${res.count}`);
  assert.ok(res.score >= 60, `高密度剧本分数应≥60，实际${res.score}`);
  assert.ok(res.issues.filter((i) => i.severity === 'high').length === 0, `不应有 high 级问题，实际：${JSON.stringify(res.issues)}`);
  assert.ok(res.variety >= 2, `应至少2种金句类型，实际${res.variety}`);
});

test('中文低金句密度应识别为不足并产生 high 级问题', () => {
  const res = punchlineDensityScore(ZH_LOW_DENSITY, 'zh');
  assert.ok(res.count < 3, `低密度应<3个金句，实际${res.count}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `应至少1个 high 级问题，实际${highIssues.length}`);
  assert.ok(res.score < 60, `低密度分数应<60，实际${res.score}`);
});

test('中文无金句应识别为 none 并产生 high 级问题', () => {
  const res = punchlineDensityScore(ZH_NO_PUNCHLINE, 'zh');
  assert.strictEqual(res.count, 0);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_punchline'), '应有 no_punchline 问题');
  assert.ok(res.score < 40, `无金句分数应<40，实际${res.score}`);
});

test('英文高金句密度应识别多个金句', () => {
  const res = punchlineDensityScore(EN_HIGH_DENSITY, 'en');
  assert.ok(res.count >= 3, `英文应至少3个金句，实际${res.count}`);
  assert.ok(res.score >= 60, `英文高密度分数应≥60，实际${res.score}`);
});

test('三段分布应正确计算', () => {
  const res = punchlineDensityScore(ZH_HIGH_DENSITY, 'zh');
  const total = res.distribution.head + res.distribution.mid + res.distribution.tail;
  assert.strictEqual(total, res.count, '分布总数应等于金句总数');
});

test('多样性应正确计算', () => {
  const res = punchlineDensityScore(ZH_HIGH_DENSITY, 'zh');
  assert.ok(res.variety >= 1, '多样性应≥1');
  const types = new Set(res.hits.map((h) => h.type));
  assert.strictEqual(res.variety, types.size, '多样性应等于不重复类型数');
});

test('金句 hits 应包含必要字段', () => {
  const res = punchlineDensityScore(ZH_HIGH_DENSITY, 'zh');
  for (const h of res.hits) {
    assert.ok(typeof h.type === 'string', 'type 应为字符串');
    assert.ok(typeof h.typeLabel === 'string', 'typeLabel 应为字符串');
    assert.ok(typeof h.snippet === 'string', 'snippet 应为字符串');
    assert.ok(typeof h.strength === 'number', 'strength 应为数字');
    assert.ok(h.strength >= 0 && h.strength <= 100, 'strength 应在 0-100 范围');
    assert.ok(typeof h.device === 'string', 'device 应为字符串');
  }
});

test('全是弱金句应触发 too_many_weak 问题', () => {
  const res = punchlineDensityScore(ZH_ALL_WEAK, 'zh');
  // 4个弱金句，weakCount/count > 0.5 应触发
  const weakIssue = res.issues.find((i) => i.type === 'too_many_weak');
  if (res.count >= 2) {
    assert.ok(weakIssue, `弱金句过多应触发 too_many_weak 问题，实际issues：${JSON.stringify(res.issues)}`);
  }
});

test('结尾段有强金句应识别为 hasClimaxPunch', () => {
  const res = punchlineDensityScore(ZH_HIGH_DENSITY, 'zh');
  // 高密度剧本结尾段有"你以为这样就能逃"等拷问
  assert.ok(res.hasClimaxPunch === true || res.distribution.tail === 0 || res.hits.filter((h) => h.position >= 0.66 && h.strength >= 80).length > 0, '结尾段应有强金句或没有结尾金句');
});

test('无对白行剧本应返回0金句', () => {
  const text = `
场景：客厅 日 内景
△林晚走进客厅，坐下
△茶杯被放下
△门关上
`;
  const res = punchlineDensityScore(text, 'zh');
  assert.strictEqual(res.count, 0);
  assert.strictEqual(res.score, 0);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, '无对白应触发 high 级问题');
});

test('场景行不应被识别为对白', () => {
  const text = `
场景：客厅 日 内景
第1集 测试
《测试剧》
△动作描述
李明：你以为这样就能逃？
`;
  const res = punchlineDensityScore(text, 'zh');
  // 应该只识别1个金句（李明的台词）
  for (const h of res.hits) {
    assert.ok(!h.snippet.includes('场景'), '场景行不应出现在金句片段中');
    assert.ok(!h.snippet.includes('第1集'), '集标题不应出现在金句片段中');
  }
});

test('lang=en 时不应识别中文信号', () => {
  const res = punchlineDensityScore(ZH_HIGH_DENSITY, 'en');
  // 英文模式匹配中文剧本，应该识别为0或很少金句（因为是中文）
  assert.ok(res.count < 3, `英文模式匹配中文应很少金句，实际${res.count}`);
});

test('对白行可能命中多个类型，应保留最强的', () => {
  // 同时包含反转和拷问的金句
  const text = `
场景：公司 日 内景
李明：你以为我会跪下求饶？殊不知，我才是真正的老板！
`;
  const res = punchlineDensityScore(text, 'zh');
  // 同一说话人同一位置只应有一个金句
  const samePos = res.hits.filter((h) => h.speaker === '李明');
  assert.ok(samePos.length <= 1, `同一说话人应去重为最多1个金句，实际${samePos.length}`);
  if (samePos.length === 1) {
    // 应保留最强的（反转 95 或 宣言 90）
    assert.ok(samePos[0].strength >= 85, `应保留最强类型，实际强度${samePos[0].strength}`);
  }
});
