const test = require('node:test');
const assert = require('node:assert');
const { conflictDensityCheck } = require('../dist/engine/conflict-density-check.js');

// —— 中文剧本样本 ——

// 高冲突密度剧本（口角→对峙→肢体冲突→生死对抗，开头+中段+结尾都有）
const ZH_HIGH_DENSITY = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
△林晚一巴掌扇在前台脸上，清脆的响声回荡
林晚：滚开！
李经理冲过来，揪住林晚衣领
李经理：你敢在这里撒野？凭什么？
△林晚甩开李经理，怒吼
林晚：松手！否则我让你后悔。
李经理：你算什么东西？跪下求我，我就放你走。
△突然一群黑衣人涌入，为首的人拔出刀
黑衣人：谁敢动她！
王总（震惊）：你、你敢杀人？
林晚：从今天起，这家公司是我的。敢不服？
`;

// 低冲突密度剧本（只有1个口角）
const ZH_LOW_DENSITY = `
场景：客厅 日 内景
△林晚坐在沙发上，手里拿着茶杯
李明（平静）：今天天气不错。
林晚：嗯，是啊。
李明：你凭什么这么说？
△两人沉默了一会儿
林晚：事情就这样吧。
`;

// 无冲突剧本
const ZH_NO_CONFLICT = `
场景：客厅 日 内景
△林晚把茶杯放下，站起身
李明（平静）：事情就这样定了。
门关上了。
一切归于平静。
`;

// 英文高冲突密度剧本
const EN_HIGH_DENSITY = `
Scene: Company lobby, Day, Interior
Lin walks in, the receptionist blocks her.
Receptionist: No appointment, no entry.
Lin slaps the receptionist across the face.
Lin: Get out of my way!
Manager rushes over, grabbing Lin's collar.
Manager: Who do you think you are?
Lin shakes off the manager and shouts.
Lin: Let go, or you'll regret this.
Manager: Kneel and beg, I'll let you go.
Suddenly, men in black flood in, their leader draws a knife.
Man in black: Who dares touch her!
CEO (shocked): You, you dare to kill?
Lin: From today, this company is mine.
`;

test('中文高冲突密度应识别多个冲突且高分', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  assert.ok(res.count >= 3, `应至少3个冲突，实际${res.count}`);
  assert.ok(res.score >= 60, `高密度剧本分数应≥60，实际${res.score}`);
  assert.ok(res.issues.filter((i) => i.severity === 'high').length === 0, `不应有 high 级问题`);
  assert.ok(res.variety >= 2, `应至少2种冲突类型，实际${res.variety}`);
});

test('中文低冲突密度应识别为不足并产生 high 级问题', () => {
  const res = conflictDensityCheck(ZH_LOW_DENSITY, 'zh');
  assert.ok(res.count < 3, `低密度应<3个冲突，实际${res.count}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `应至少1个 high 级问题，实际${highIssues.length}`);
  assert.ok(res.score < 60, `低密度分数应<60，实际${res.score}`);
});

test('中文无冲突应识别为 none 并产生 high 级问题', () => {
  const res = conflictDensityCheck(ZH_NO_CONFLICT, 'zh');
  assert.strictEqual(res.count, 0);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_conflict'), '应有 no_conflict 问题');
  assert.ok(res.score < 40, `无冲突分数应<40，实际${res.score}`);
});

test('英文高冲突密度应识别多个冲突', () => {
  const res = conflictDensityCheck(EN_HIGH_DENSITY, 'en');
  assert.ok(res.count >= 3, `英文应至少3个冲突，实际${res.count}`);
  assert.ok(res.score >= 60, `英文高密度分数应≥60，实际${res.score}`);
});

test('冲突强度等级应正确分类', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  // 应包含肢体冲突（physical）或生死对抗（life_death）
  const levels = res.hits.map((h) => h.level);
  assert.ok(levels.includes('physical') || levels.includes('life_death'), '应包含肢体冲突或生死对抗');
  // maxLevel 应为 physical 或 life_death
  assert.ok(['physical', 'life_death'].includes(res.maxLevel), `maxLevel 应为 physical 或 life_death，实际${res.maxLevel}`);
});

test('三段分布应正确计算', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  const total = res.distribution.head + res.distribution.mid + res.distribution.tail;
  assert.strictEqual(total, res.count, '分布总数应等于冲突总数');
});

test('多样性应正确计算', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  assert.ok(res.variety >= 1, '多样性应≥1');
  const cats = new Set(res.hits.map((h) => h.category));
  assert.strictEqual(res.variety, cats.size, '多样性应等于不重复类型数');
});

test('冲突 hits 应包含必要字段', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  for (const h of res.hits) {
    assert.ok(['verbal', 'confront', 'physical', 'life_death'].includes(h.level), `level 应为有效值，实际${h.level}`);
    assert.ok(typeof h.levelLabel === 'string', 'levelLabel 应为字符串');
    assert.ok(['emotional', 'interest', 'power', 'identity', 'life_death'].includes(h.category), `category 应为有效值，实际${h.category}`);
    assert.ok(typeof h.categoryLabel === 'string', 'categoryLabel 应为字符串');
    assert.ok(typeof h.snippet === 'string' && h.snippet.length > 0, 'snippet 应为非空字符串');
    assert.ok(typeof h.position === 'number' && h.position >= 0 && h.position <= 1, 'position 应为 0-1');
    assert.ok(typeof h.strength === 'number' && h.strength >= 0 && h.strength <= 100, 'strength 应为 0-100');
  }
});

test('冲突升级检测', () => {
  // 含升级信号的剧本（口角→对峙→肢体冲突→生死对抗）
  const escalatingScript = `
李明：你凭什么这么说？吵什么吵？
林晚：你敢拦我？做梦！
△林晚一巴掌扇在李明脸上
李明：你打我？我要杀了你！
`;
  const res = conflictDensityCheck(escalatingScript, 'zh');
  assert.strictEqual(res.hasEscalation, true, '强度递增应识别为有升级');
  // 不升级的剧本（全是口角，强度持平）
  const flatScript = `
李明：你凭什么这么说？
林晚：你算什么东西？
李明：闭嘴！
林晚：滚蛋！
`;
  const flatRes = conflictDensityCheck(flatScript, 'zh');
  assert.strictEqual(flatRes.hasEscalation, false, '强度持平不应识别为升级');
});

test('强度曲线应按位置排序', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  assert.ok(Array.isArray(res.strengthCurve), 'strengthCurve 应为数组');
  assert.strictEqual(res.strengthCurve.length, res.count, 'strengthCurve 长度应等于冲突数');
});

test('返回结构应包含所有必要字段', () => {
  const res = conflictDensityCheck(ZH_HIGH_DENSITY, 'zh');
  assert.ok(typeof res.score === 'number' && res.score >= 0 && res.score <= 100, 'score 0-100');
  assert.ok(Array.isArray(res.hits), 'hits 应为数组');
  assert.ok(typeof res.count === 'number', 'count 应为数字');
  assert.ok(['verbal', 'confront', 'physical', 'life_death'].includes(res.maxLevel), 'maxLevel 应为有效值');
  assert.ok(typeof res.variety === 'number', 'variety 应为数字');
  assert.ok(typeof res.distribution === 'object', 'distribution 应为对象');
  assert.ok('head' in res.distribution && 'mid' in res.distribution && 'tail' in res.distribution, 'distribution 含 head/mid/tail');
  assert.ok(typeof res.hasEscalation === 'boolean', 'hasEscalation 应为布尔');
  assert.ok(Array.isArray(res.strengthCurve), 'strengthCurve 应为数组');
  assert.ok(Array.isArray(res.issues), 'issues 应为数组');
});

test('空文本应安全返回', () => {
  const res = conflictDensityCheck('', 'zh');
  assert.strictEqual(res.count, 0);
  assert.strictEqual(res.hits.length, 0);
  assert.strictEqual(res.variety, 0);
  assert.strictEqual(res.hasEscalation, false);
});

test('纯场景行剧本应安全返回零冲突', () => {
  const sceneOnly = `
场景：客厅 日 内景
△林晚走进客厅，坐在沙发上
△门铃响了，她起身开门
△外面没有人，只有一封信
`;
  const res = conflictDensityCheck(sceneOnly, 'zh');
  assert.strictEqual(res.count, 0, '纯动作行应零冲突');
  assert.strictEqual(res.score, 0);
});
