const test = require('node:test');
const assert = require('node:assert');
const { dialogueWaterCheck } = require('../dist/engine/dialogue-water-check.js');

// —— 中文剧本样本 ——

// 高水分剧本（多寒暄+不推进+重复信息+无功能台词）
const ZH_HIGH_WATER = `
场景：客厅 日 内景
△林晚坐在沙发上
李明：你好。
林晚：您好。
李明：最近怎么样？
林晚：最近还好。
李明：好久不见了。
林晚：是啊。
李明：身体还好吧？
林晚：还行。
李明：吃了吗？
林晚：吃了。
李明：天气真好啊。
林晚：嗯，是不错。
李明：我告诉你了，这件事很重要。
林晚：你说过了。
`;

// 低水分剧本（每句台词都推进剧情/塑造人物/制造冲突）
const ZH_LOW_WATER = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
△林晚一巴掌扇在前台脸上
林晚：让开！
李经理冲过来，揪住林晚衣领
李经理：你敢在这里撒野？
林晚：松手，否则我让你后悔。
李经理：凭什么？你算什么东西？
△林晚甩开李经理，走到王总面前
林晚：王总，那份收购合同我还留着。
王总（震惊）：不可能，合同早销毁了。
林晚：但我复印了。你跪下求我，我就不报警。
`;

// 英文高水分剧本
const EN_HIGH_WATER = `
Scene: Living room, Day, Interior
Lin sits on the sofa.
Li: Hi.
Lin: Hello.
Li: How are you?
Lin: Fine, thanks.
Li: Long time no see.
Lin: Yeah.
Li: Have you eaten?
Lin: Yes.
Li: Nice weather today.
Lin: Yeah, it is.
Li: I told you, this is important.
Lin: You already said that.
`;

// 英文低水分剧本
const EN_LOW_WATER = `
Scene: Company lobby, Day, Interior
Lin walks in, the receptionist blocks her.
Receptionist: No appointment, no entry.
Lin slaps the receptionist.
Lin: Get out of my way!
Manager rushes over, grabbing Lin's collar.
Manager: Who do you think you are?
Lin: Let go, or you'll regret this.
Manager: Why should I?
Lin shakes off the manager and walks to the CEO.
Lin: I still have that acquisition contract.
CEO (shocked): Impossible. We destroyed it.
Lin: I made a copy. Kneel and beg, I won't call the police.
`;

test('中文高水分剧本应识别多个水分台词且低分', () => {
  const res = dialogueWaterCheck(ZH_HIGH_WATER, 'zh');
  assert.ok(res.waterCount >= 5, `高水分应至少5条，实际${res.waterCount}`);
  assert.ok(res.waterRatio > 0.4, `水分率应>40%，实际${Math.round(res.waterRatio * 100)}%`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `应至少1个 high 级问题，实际${highIssues.length}`);
  assert.ok(res.score < 60, `高水分分数应<60，实际${res.score}`);
});

test('中文低水分剧本应识别少量水分台词且高分', () => {
  const res = dialogueWaterCheck(ZH_LOW_WATER, 'zh');
  assert.ok(res.waterCount <= 3, `低水分应≤3条，实际${res.waterCount}`);
  assert.ok(res.waterRatio < 0.2, `水分率应<20%，实际${Math.round(res.waterRatio * 100)}%`);
  assert.ok(res.score >= 80, `低水分分数应≥80，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `低水分不应有 high 级问题`);
});

test('中文寒暄台词应被识别为 greeting 类型', () => {
  const greetingScript = `
场景：客厅 日 内景
李明：你好。
林晚：您好。
李明：最近怎么样？
林晚：最近还好。
`;
  const res = dialogueWaterCheck(greetingScript, 'zh');
  const greetingHits = res.hits.filter((h) => h.waterType === 'greeting');
  assert.ok(greetingHits.length >= 3, `应至少3条寒暄，实际${greetingHits.length}`);
  // 寒暄水分等级应为 95
  for (const h of greetingHits) {
    assert.strictEqual(h.waterLevel, 95, `寒暄水分等级应为95，实际${h.waterLevel}`);
  }
});

test('中文重复信息台词应被识别为 repeat 类型', () => {
  const repeatScript = `
场景：客厅 日 内景
李明：我刚才说的是这件事很重要。
林晚：你说过了。
李明：我不是说了吗？
`;
  const res = dialogueWaterCheck(repeatScript, 'zh');
  const repeatHits = res.hits.filter((h) => h.waterType === 'repeat');
  assert.ok(repeatHits.length >= 2, `应至少2条重复信息，实际${repeatHits.length}`);
  for (const h of repeatHits) {
    assert.ok(h.waterLevel >= 80, `重复信息水分等级应≥80，实际${h.waterLevel}`);
  }
});

test('中文寒暄过多应触发 high 级问题', () => {
  const tooManyGreetings = `
场景：客厅 日 内景
李明：你好。
林晚：您好。
李明：最近怎么样？
林晚：最近还好。
李明：好久不见了。
林晚：是啊。
李明：身体还好吧？
`;
  const res = dialogueWaterCheck(tooManyGreetings, 'zh');
  const greetingIssue = res.issues.find((i) => i.type === 'too_many_greetings');
  assert.ok(greetingIssue, '应有 too_many_greetings 问题');
  assert.strictEqual(greetingIssue.severity, 'high', '寒暄过多应为 high 级');
});

test('中文水分率过高应触发 high 级问题', () => {
  const res = dialogueWaterCheck(ZH_HIGH_WATER, 'zh');
  const excessiveWaterIssue = res.issues.find((i) => i.type === 'excessive_water');
  assert.ok(excessiveWaterIssue, '应有 excessive_water 问题');
  assert.strictEqual(excessiveWaterIssue.severity, 'high', '水分率过高应为 high 级');
});

test('英文高水分剧本应识别多个水分台词', () => {
  const res = dialogueWaterCheck(EN_HIGH_WATER, 'en');
  assert.ok(res.waterCount >= 5, `英文高水分应至少5条，实际${res.waterCount}`);
  assert.ok(res.waterRatio > 0.4, `英文水分率应>40%，实际${Math.round(res.waterRatio * 100)}%`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `英文应至少1个 high 级问题`);
});

test('英文低水分剧本应识别少量水分台词', () => {
  const res = dialogueWaterCheck(EN_LOW_WATER, 'en');
  assert.ok(res.waterCount <= 3, `英文低水分应≤3条，实际${res.waterCount}`);
  assert.ok(res.score >= 70, `英文低水分分数应≥70，实际${res.score}`);
});

test('返回结构应包含所有必要字段', () => {
  const res = dialogueWaterCheck(ZH_HIGH_WATER, 'zh');
  assert.ok(typeof res.score === 'number' && res.score >= 0 && res.score <= 100, 'score 0-100');
  assert.ok(typeof res.totalLines === 'number' && res.totalLines > 0, 'totalLines 应为正数');
  assert.ok(typeof res.waterCount === 'number' && res.waterCount >= 0, 'waterCount 应为非负数');
  assert.ok(typeof res.waterRatio === 'number' && res.waterRatio >= 0 && res.waterRatio <= 1, 'waterRatio 应为 0-1');
  assert.ok(Array.isArray(res.hits), 'hits 应为数组');
  assert.ok(Array.isArray(res.issues), 'issues 应为数组');
});

test('hits 应包含必要字段', () => {
  const res = dialogueWaterCheck(ZH_HIGH_WATER, 'zh');
  for (const h of res.hits) {
    assert.ok(typeof h.line === 'string' && h.line.length > 0, 'line 应为非空字符串');
    assert.ok(typeof h.character === 'string', 'character 应为字符串');
    assert.ok(['greeting', 'filler', 'repeat', 'long_setup', 'no_progress'].includes(h.waterType), `waterType 应为有效值，实际${h.waterType}`);
    assert.ok(typeof h.waterLevel === 'number' && h.waterLevel >= 0 && h.waterLevel <= 100, 'waterLevel 应为 0-100');
    assert.ok(typeof h.lineIndex === 'number' && h.lineIndex >= 0, 'lineIndex 应为非负数');
  }
});

test('场景行和动作行不应被识别为对白', () => {
  const mixedScript = `
场景：客厅 日 内景
△林晚走进客厅
李明：你好。
△林晚坐下
林晚：最近怎么样？
△门铃响了
`;
  const res = dialogueWaterCheck(mixedScript, 'zh');
  // 只有2条对白，totalLines应为2
  assert.strictEqual(res.totalLines, 2, `应识别2条对白行，实际${res.totalLines}`);
});

test('推进剧情的短台词不应被识别为水分', () => {
  const advancingScript = `
场景：客厅 日 内景
林晚：滚！
李明：你敢！
林晚：闭嘴！
`;
  const res = dialogueWaterCheck(advancingScript, 'zh');
  // "滚""你敢""闭嘴"虽然短但推进剧情（冲突信号），不应被识别为 no_progress
  const noProgressHits = res.hits.filter((h) => h.waterType === 'no_progress');
  assert.strictEqual(noProgressHits.length, 0, `不应有 no_progress 水分，实际${noProgressHits.length}`);
});

test('空文本应安全返回', () => {
  const res = dialogueWaterCheck('', 'zh');
  assert.strictEqual(res.totalLines, 0);
  assert.strictEqual(res.waterCount, 0);
  assert.strictEqual(res.waterRatio, 0);
  assert.strictEqual(res.hits.length, 0);
});

test('纯动作行剧本应安全返回零对白', () => {
  const actionOnly = `
场景：客厅 日 内景
△林晚走进客厅，坐在沙发上
△门铃响了，她起身开门
△外面没有人，只有一封信
`;
  const res = dialogueWaterCheck(actionOnly, 'zh');
  assert.strictEqual(res.totalLines, 0, '纯动作行应零对白');
  assert.strictEqual(res.waterCount, 0);
});
