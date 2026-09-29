const test = require('node:test');
const assert = require('node:assert');
const { repetitionCheck } = require('../dist/engine/repetition-check.js');

// —— 中文剧本样本 ——

// 高质量剧本：句式多样，情绪递进，动作不重复
const ZH_HIGH_QUALITY = `
场景：公司大厅 日 内景
△林晚走进大厅，前台拦住她
前台：这位女士，没有预约不能进。
△林晚一巴掌扇在前台脸上
林晚：滚开！
李经理（怒）：你敢在这里撒野？

场景：经理办公室 日 内景
△李经理揪住林晚衣领
李经理：跪下求我，我就放你走。
△林晚冷笑，把一份文件摔在桌上
林晚：这是收购协议。从今天起，这家公司是我的。
李经理（震惊）：不可能！

场景：天台 黄昏 外景
△王总站在天台边缘，风吹乱他的头发
王总（绝望）：你赢了，我都给你。
林晚：晚了。你以为忍让是软弱？
`;

// 近似重复台词3次以上
const ZH_EXACT_REPEAT = `
场景：客厅 日 内景
△李明走进来
林晚：你凭什么这么说？
△李明坐下
李明：你凭什么这么说？
△两人对视
林晚：你凭什么这么说我？
李明：你凭什么这么说呢？
△沉默
林晚：凭什么？
`;

// 重复句式模板
const ZH_PATTERN_REPEAT = `
场景：客厅 日 内景
△林晚走进来
林晚：你以为你是谁？
李明：你以为你很厉害？
林晚：你以为你能赢？
李明：你以为你能走？
△两人对视
`;

// 重复情绪beat
const ZH_EMOTION_REPEAT = `
场景：客厅 日 内景
△林晚怒吼
林晚：滚！
△李明怒吼
李明：你给我滚！
△王总怒吼
王总：都给我滚！
△助理怒吼
助理：滚出去！
`;

// 重复动作词
const ZH_ACTION_REPEAT = `
场景：客厅 日 内景
△林晚摔杯子
林晚：滚！
△李明摔花瓶
李明：你疯了？
△林晚摔椅子
林晚：出去！
△李明摔桌子
李明：住手！
△林晚摔碗
林晚：走！
`;

// 无重复（低重复感）
const ZH_LOW_REPEAT = `
场景：客厅 日 内景
△林晚走进来
李明：今天天气不错。
林晚：嗯，但事情还没完。
李明：什么意思？
△林晚坐下
林晚：合同的事。
`;

// 英文近似重复
const EN_EXACT_REPEAT = `
Scene: Living room, Day, Interior
Lin walks in.
Lin: Why do you always say that?
Li sits down.
Li: Why do you always say that?
They stare at each other.
Lin: Why do you always say this?
Li: Why do you always say that?
Silence.
`;

test('中文高质量剧本应得高分（低重复）', () => {
  const res = repetitionCheck(ZH_HIGH_QUALITY, 'zh');
  assert.ok(res.score >= 60, `高质量剧本分数应≥60，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `不应有 high 级问题，实际${JSON.stringify(highIssues)}`);
});

test('近似重复台词3次以上应触发 high 级问题', () => {
  const res = repetitionCheck(ZH_EXACT_REPEAT, 'zh');
  assert.ok(res.exactLineGroups >= 1, `应有≥1组近似重复，实际${res.exactLineGroups}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'exact_repeat_3plus'), '应有 exact_repeat_3plus 问题');
  assert.ok(res.score < 85, `重复感高时分数应<85，实际${res.score}`);
});

test('重复句式模板应被识别', () => {
  const res = repetitionCheck(ZH_PATTERN_REPEAT, 'zh');
  assert.ok(res.patternCount >= 1, `应有≥1组重复句式，实际${res.patternCount}`);
  const patternHits = res.hits.filter((h) => h.type === 'pattern');
  assert.ok(patternHits.length >= 1, '应有 pattern 类型的 hit');
  // "你以为"开头出现4次
  const youPattern = patternHits.find((h) => h.pattern.includes('你以为'));
  assert.ok(youPattern, '应检测到"你以为"句式模板');
  assert.ok(youPattern.count >= 3, `句式模板应出现≥3次，实际${youPattern.count}`);
});

test('重复情绪beat应被识别', () => {
  const res = repetitionCheck(ZH_EMOTION_REPEAT, 'zh');
  assert.ok(res.emotionRepeats >= 1, `应有≥1个重复情绪，实际${res.emotionRepeats}`);
  const emotionHits = res.hits.filter((h) => h.type === 'emotion');
  assert.ok(emotionHits.length >= 1, '应有 emotion 类型的 hit');
  // "怒"或"吼"应被识别
  const angerHit = emotionHits.find((h) => h.pattern.includes('怒') || h.pattern.includes('吼'));
  assert.ok(angerHit, '应检测到"怒/吼"情绪beat重复');
  assert.ok(angerHit.count >= 3, `情绪重复应≥3次，实际${angerHit.count}`);
});

test('重复动作词应被识别', () => {
  const res = repetitionCheck(ZH_ACTION_REPEAT, 'zh');
  assert.ok(res.actionRepeats >= 1, `应有≥1个重复动作词，实际${res.actionRepeats}`);
  const actionHits = res.hits.filter((h) => h.type === 'action');
  assert.ok(actionHits.length >= 1, '应有 action 类型的 hit');
  // "摔"应被识别
  const smashHit = actionHits.find((h) => h.pattern.includes('摔'));
  assert.ok(smashHit, '应检测到"摔"动作词重复');
  assert.ok(smashHit.count >= 4, `动作词重复应≥4次，实际${smashHit.count}`);
});

test('英文近似重复应被识别', () => {
  const res = repetitionCheck(EN_EXACT_REPEAT, 'en');
  assert.ok(res.exactLineGroups >= 1, `英文应有≥1组近似重复，实际${res.exactLineGroups}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'exact_repeat_3plus'), '英文应有 exact_repeat_3plus 问题');
});

test('低重复剧本应得高分', () => {
  const res = repetitionCheck(ZH_LOW_REPEAT, 'zh');
  assert.ok(res.score >= 80, `低重复剧本分数应≥80，实际${res.score}`);
  assert.strictEqual(res.exactLineGroups, 0, '不应有近似重复台词');
});

test('重复结果应包含必要字段', () => {
  const res = repetitionCheck(ZH_EXACT_REPEAT, 'zh');
  assert.ok(typeof res.score === 'number', 'score 应为数字');
  assert.ok(Array.isArray(res.hits), 'hits 应为数组');
  assert.ok(typeof res.exactLineGroups === 'number', 'exactLineGroups 应为数字');
  assert.ok(typeof res.patternCount === 'number', 'patternCount 应为数字');
  assert.ok(typeof res.emotionRepeats === 'number', 'emotionRepeats 应为数字');
  assert.ok(typeof res.actionRepeats === 'number', 'actionRepeats 应为数字');
  assert.ok(typeof res.sceneOpenerRepeats === 'number', 'sceneOpenerRepeats 应为数字');
  assert.ok(typeof res.totalPenalty === 'number', 'totalPenalty 应为数字');
  assert.ok(Array.isArray(res.issues), 'issues 应为数组');
});

test('hits 应按出现次数降序排列', () => {
  const res = repetitionCheck(ZH_EXACT_REPEAT + ZH_EMOTION_REPEAT, 'zh');
  for (let i = 1; i < res.hits.length; i++) {
    assert.ok(res.hits[i - 1].count >= res.hits[i].count, `hits 应按 count 降序：${res.hits[i - 1].count} >= ${res.hits[i].count}`);
  }
});

test('score 应等于 100 减去 totalPenalty', () => {
  const res = repetitionCheck(ZH_EXACT_REPEAT, 'zh');
  const expected = Math.max(0, Math.min(100, 100 - res.totalPenalty));
  assert.strictEqual(res.score, expected, `score 应为 ${expected}，实际 ${res.score}`);
});
