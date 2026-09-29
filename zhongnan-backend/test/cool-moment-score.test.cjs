const test = require('node:test');
const assert = require('node:assert');
const { coolMomentScore } = require('../dist/engine/cool-moment-score.js');

// —— 中文剧本样本 ——

// 高爽点密度剧本（打脸+逆袭+揭露+财富炫耀，开头+中段+结尾都有）
const ZH_HIGH_DENSITY = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：您好，这里不是您能来的地方。
△林晚一巴掌扇在前台脸上，清脆的响声回荡
林晚（冷声）：让你拦我？
李经理走过来，一把揪住林晚的衣领
李经理：你算什么东西，敢在这里撒野？
△突然一群黑衣人涌入大厅，为首的人递上一份合同
黑衣人：林小姐，这是我们董事长要收购这家公司的合同，请您过目。
李经理（震惊）：什么？收购？
△林晚接过合同，甩在李经理脸上
林晚：从今天起，你是我的下属。敢不服？
王总冲出来，跪在地上
王总：林小姐，是我有眼不珠，求您饶了我这一次！
`;

// 低爽点密度剧本（只有1个弱爽点）
const ZH_LOW_DENSITY = `
场景：客厅 日 内景
△林晚坐在沙发上，手里拿着茶杯
李明（平静）：今天天气不错。
林晚：嗯，是啊。
李明：你给我等着，走着瞧。
△两人沉默了一会儿
林晚：事情就这样吧。
`;

// 无爽点剧本
const ZH_NO_COOL = `
场景：客厅 日 内景
△林晚把茶杯放下，站起身
李明（平静）：事情就这样定了。
门关上了。
一切归于平静。
`;

// 英文高爽点密度剧本
const EN_HIGH_DENSITY = `
Scene: Company lobby, Day, Interior
Lin walks in, the receptionist blocks her.
Receptionist: Excuse me, you can't be here.
Lin slaps the receptionist across the face, the crisp sound echoing.
Lin (cold): Let me pass.
Manager rushes over, grabbing Lin's collar.
Manager: Who do you think you are?
Lin: You'll regret this.
Manager: In your dreams.
The two stand in silence for a moment.
Scene: Office, Day, Interior
Suddenly, men in black flood the lobby, their leader hands over a contract.
Man in black: Miss Lin, our chairman wants to acquire this company.
Manager (shocked): What? Acquire?
Lin takes the contract and smashes it in the manager's face.
Lin: From today, you work for me.
Scene: Hallway, Day, Interior
The CEO rushes out and kneels on the floor.
CEO: Miss Lin, I was blind, please spare me this once!
Lin: Now you know what karma feels like.
`;

test('中文高爽点密度应识别多个爽点且高分', () => {
  const res = coolMomentScore(ZH_HIGH_DENSITY, 'zh');
  assert.ok(res.count >= 3, `应至少3个爽点，实际${res.count}`);
  assert.ok(res.score >= 60, `高密度剧本分数应≥60，实际${res.score}`);
  assert.ok(res.issues.filter((i) => i.severity === 'high').length === 0, `不应有 high 级问题`);
  assert.ok(res.variety >= 2, `应至少2种爽点类型，实际${res.variety}`);
});

test('中文低爽点密度应识别为不足并产生 high 级问题', () => {
  const res = coolMomentScore(ZH_LOW_DENSITY, 'zh');
  assert.ok(res.count < 3, `低密度应<3个爽点，实际${res.count}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `应至少1个 high 级问题，实际${highIssues.length}`);
  assert.ok(res.score < 60, `低密度分数应<60，实际${res.score}`);
});

test('中文无爽点应识别为 none 并产生 high 级问题', () => {
  const res = coolMomentScore(ZH_NO_COOL, 'zh');
  assert.strictEqual(res.count, 0);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_cool_moment'), '应有 no_cool_moment 问题');
  assert.ok(res.score < 40, `无爽点分数应<40，实际${res.score}`);
});

test('英文高爽点密度应识别多个爽点', () => {
  const res = coolMomentScore(EN_HIGH_DENSITY, 'en');
  assert.ok(res.count >= 3, `英文应至少3个爽点，实际${res.count}`);
  assert.ok(res.score >= 60, `英文高密度分数应≥60，实际${res.score}`);
});

test('三段分布应正确计算', () => {
  const res = coolMomentScore(ZH_HIGH_DENSITY, 'zh');
  const total = res.distribution.head + res.distribution.mid + res.distribution.tail;
  assert.strictEqual(total, res.count, '分布总数应等于爽点总数');
  assert.ok(res.distribution.head >= 1, '开头应有爽点');
});

test('多样性应正确计算', () => {
  const res = coolMomentScore(ZH_HIGH_DENSITY, 'zh');
  assert.ok(res.variety >= 1, '多样性应≥1');
  const types = new Set(res.hits.map((h) => h.type));
  assert.strictEqual(res.variety, types.size, '多样性应等于不重复类型数');
});

test('爽点 hits 应包含必要字段', () => {
  const res = coolMomentScore(ZH_HIGH_DENSITY, 'zh');
  for (const h of res.hits) {
    assert.ok(typeof h.type === 'string', 'type 应为字符串');
    assert.ok(typeof h.typeLabel === 'string', 'typeLabel 应为字符串');
    assert.ok(typeof h.snippet === 'string' && h.snippet.length > 0, 'snippet 应为非空字符串');
    assert.ok(typeof h.position === 'number' && h.position >= 0 && h.position <= 1, 'position 应为 0-1');
    assert.ok(typeof h.strength === 'number' && h.strength >= 0 && h.strength <= 100, 'strength 应为 0-100');
  }
});

test('蓄力-爆发节奏检测', () => {
  // 含蓄力信号的剧本
  const buildupScript = `林晚忍辱负重，含泪咽下了这口气。三年后，她一巴掌扇在渣男脸上。`;
  const res = coolMomentScore(buildupScript, 'zh');
  assert.strictEqual(res.hasBuildup, true, '含"忍辱负重/含泪"应识别蓄力');
  // 不含蓄力信号
  const noBuildupRes = coolMomentScore(ZH_NO_COOL, 'zh');
  assert.strictEqual(noBuildupRes.hasBuildup, false, '无爽点剧本不应有蓄力');
});

test('返回结构应包含所有必要字段', () => {
  const res = coolMomentScore(ZH_HIGH_DENSITY, 'zh');
  assert.ok(typeof res.score === 'number' && res.score >= 0 && res.score <= 100, 'score 0-100');
  assert.ok(Array.isArray(res.hits), 'hits 应为数组');
  assert.ok(typeof res.count === 'number', 'count 应为数字');
  assert.ok(typeof res.variety === 'number', 'variety 应为数字');
  assert.ok(typeof res.distribution === 'object', 'distribution 应为对象');
  assert.ok('head' in res.distribution && 'mid' in res.distribution && 'tail' in res.distribution, 'distribution 含 head/mid/tail');
  assert.ok(typeof res.hasBuildup === 'boolean', 'hasBuildup 应为布尔');
  assert.ok(Array.isArray(res.issues), 'issues 应为数组');
});
