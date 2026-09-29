const test = require('node:test');
const assert = require('node:assert');
const { cliffhangerScore } = require('../dist/engine/cliffhanger-score.js');

// —— 中文剧本样本 ——

// 强反转钩结尾
const ZH_REVERSAL = `
场景：客厅 夜 内景
△林晚缓缓撕开信封，手在颤抖
林晚（颤抖）：这不可能……
△信纸掉落，镜头推近
林晚（震惊）：原来……你才是当年推我下楼的人！
没想到，站在她身后的陈总，脸上露出了一丝冷笑。
`;

// 强危机钩结尾
const ZH_CRISIS = `
场景：天台 夜 外景
△林晚一步步退向天台边缘，碎石从脚下坠落
陈总（逼近）：你没有退路了。
△刺眼的远光灯打在两人身上
林晚回头，身后就是悬崖，脚下碎石滚落。
`;

// 弱钩（只有问号和省略号，无其他钩子信号）
const ZH_WEAK = `
场景：客厅 日 内景
△林晚坐在沙发上，手里拿着信
林明（平静）：就这样吧。
？
……
`;

// 无钩子（平收结尾，无任何信号——不用问号/省略号/未完/待续）
const ZH_NONE = `
场景：客厅 日 内景
△林晚把茶杯放下，站起身
李明（平静）：事情就这样定了。
门关上了。
一切归于平静。
`;

// 情感钩（中等强度）
const ZH_EMOTIONAL = `
场景：医院 夜 内景
△林晚瘫坐在走廊的长椅上，眼泪无声地滑落
林晚（哽咽）：三年了……我就这样被骗了三年……
△她闭上眼，肩膀颤抖着，镜头渐渐拉远
`;

// 英文反转钩
const EN_REVERSAL = `
Scene: Living room, Night, Interior
Lin (trembling): This is impossible...
The letter falls. Camera pushes in.
Lin (shocked): You were the one who pushed me down that day!
Suddenly, Chen standing behind her, a cold smile on his face.
`;

test('中文反转钩应识别为 reversal 类型且高分', () => {
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', null);
  assert.strictEqual(res.type, 'reversal');
  assert.strictEqual(res.typeLabel, '反转钩');
  assert.ok(res.score >= 80, `反转钩分数应≥80，实际${res.score}`);
  assert.ok(res.issues.filter((i) => i.severity === 'high').length === 0, '反转钩不应有 high 级问题');
});

test('中文危机钩应识别为 crisis 类型且高分', () => {
  const res = cliffhangerScore(ZH_CRISIS, 'zh', null);
  assert.strictEqual(res.type, 'crisis');
  assert.strictEqual(res.typeLabel, '危机钩');
  assert.ok(res.score >= 75, `危机钩分数应≥75，实际${res.score}`);
});

test('中文弱钩应识别为 weak 类型并产生 high 级问题', () => {
  const res = cliffhangerScore(ZH_WEAK, 'zh', null);
  assert.strictEqual(res.type, 'weak');
  assert.strictEqual(res.typeLabel, '弱钩');
  assert.ok(res.score < 50, `弱钩分数应<50，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `弱钩应至少1个 high 级问题，实际${highIssues.length}`);
  assert.ok(highIssues.some((i) => i.type === 'weak_cliffhanger'), '应有 weak_cliffhanger 问题');
});

test('中文无钩子应识别为 none 类型并产生 high 级问题', () => {
  const res = cliffhangerScore(ZH_NONE, 'zh', null);
  assert.strictEqual(res.type, 'none');
  assert.strictEqual(res.typeLabel, '无钩子');
  assert.ok(res.score < 40, `无钩子分数应<40，实际${res.score}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.length >= 1, `无钩子应至少1个 high 级问题，实际${highIssues.length}`);
  assert.ok(highIssues.some((i) => i.type === 'no_cliffhanger'), '应有 no_cliffhanger 问题');
});

test('中文情感钩应识别为 emotional 类型并产生 mid 级问题', () => {
  const res = cliffhangerScore(ZH_EMOTIONAL, 'zh', null);
  assert.strictEqual(res.type, 'emotional');
  assert.strictEqual(res.typeLabel, '情感钩');
  const midIssues = res.issues.filter((i) => i.severity === 'mid');
  assert.ok(midIssues.some((i) => i.type === 'medium_hook'), '情感钩应有 medium_hook mid 问题');
});

test('英文反转钩应识别为 reversal 类型', () => {
  const res = cliffhangerScore(EN_REVERSAL, 'en', null);
  assert.strictEqual(res.type, 'reversal');
  assert.strictEqual(res.typeLabel, 'Reversal');
  assert.ok(res.score >= 80, `英文反转钩分数应≥80，实际${res.score}`);
});

test('规划对齐：结尾包含规划关键词应返回 planAlignment=true', () => {
  // planned 通常包含标点/空格分隔的关键词（与 outline.cliffhanger 一致）
  const planned = '林晚 陈总 冷笑';
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', planned);
  assert.ok(res.planAlignment === true, `规划关键词在结尾应返回 true，实际 hits=${JSON.stringify(res)}`);
});

test('规划对齐：结尾不包含规划关键词应返回 planAlignment=false 并产生 mid 级问题', () => {
  const planned = '王芳继承遗产';
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', planned);
  assert.ok(res.planAlignment === false, `规划关键词不在结尾应返回 false`);
  const midIssues = res.issues.filter((i) => i.severity === 'mid');
  assert.ok(midIssues.some((i) => i.type === 'plan_misaligned'), '应有 plan_misaligned mid 问题');
});

test('未传 planned 时 planAlignment 应为 null', () => {
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', null);
  assert.strictEqual(res.planAlignment, null);
});

test('返回结构应包含所有必要字段', () => {
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', null);
  assert.ok(typeof res.score === 'number' && res.score >= 0 && res.score <= 100, 'score 应为 0-100 数字');
  assert.ok(typeof res.type === 'string', 'type 应为字符串');
  assert.ok(typeof res.typeLabel === 'string', 'typeLabel 应为字符串');
  assert.ok(typeof res.endingSnippet === 'string' && res.endingSnippet.length > 0, 'endingSnippet 应为非空字符串');
  assert.ok(Array.isArray(res.issues), 'issues 应为数组');
});

test('endingSnippet 应取结尾约200字', () => {
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', null);
  assert.ok(res.endingSnippet.length <= 220, `endingSnippet 长度应≤220，实际${res.endingSnippet.length}`);
  assert.ok(res.endingSnippet.includes('冷笑') || res.endingSnippet.includes('没想到'), 'endingSnippet 应包含钩子内容');
});

// —— c209 创作能力增强：末拍泄气 / 梦境作废 ——

// 强钩信号在前，最后一拍落在平收总结句上（观众那口气被放掉）
const ZH_DEFLATED = `
场景：客厅 夜 内景
△林晚把亲子鉴定拍在桌上，满屋人愣住
陈总（脸色煞白）：你……你想怎么样？
△灯突然灭了，门被人从外面重重锁死
△她瘫坐在地上痛哭，天亮以后，一切归于平静。
`;

// 梦境作废：末拍揭示全集是一场梦（钩子作废，最高级作弊）
const ZH_DREAM = `
场景：病房 夜 内景
△林晚握着母亲的手，仪器滴答作响
林晚（哭）：妈你别走，别留下我一个人……
△白光猛地涌来，她坐起身，满头大汗
林晚：原来是一场梦。
`;

// 正常台词里带"梦"字（梦想/做梦都想），不是梦境作废
const ZH_DREAM_WORD_OK = `
场景：客厅 日 内景
△林晚攥紧拳头站在窗边
林晚（咬牙）：我连做梦都想赢这一次，谁也别想再把我踩下去。
△陈总突然推门进来，手里举着一份股权转让书。
`;

test('c209 末拍泄气：强钩在前+末拍平收句应判 hook_deflated 且压分', () => {
  const res = cliffhangerScore(ZH_DEFLATED, 'zh', null);
  const hit = res.issues.find((i) => i.type === 'hook_deflated');
  assert.ok(hit, `应产出 hook_deflated 问题，实际 issues=${JSON.stringify(res.issues.map((i) => i.type))}`);
  assert.strictEqual(hit.severity, 'mid');
  // 反转/危机原始强度 92+，泄气末拍必须明显压分（cap ≤ 75），不能仍给 90+
  assert.ok(res.score <= 80, `泄气尾分数应≤80，实际${res.score}`);
});

test('c209 梦境作废：末拍"一场梦"应判 high 级 dream_nullification 且重罚', () => {
  const res = cliffhangerScore(ZH_DREAM, 'zh', null);
  const hit = res.issues.find((i) => i.type === 'dream_nullification');
  assert.ok(hit, `应产出 dream_nullification 问题，实际 issues=${JSON.stringify(res.issues.map((i) => i.type))}`);
  assert.strictEqual(hit.severity, 'high');
  assert.ok(res.score <= 40, `梦境作废必须重罚（≤40），实际${res.score}`);
});

test('c209 反向不误杀：台词中的梦想/做梦不判 dream_nullification，强钩不判泄气', () => {
  const res = cliffhangerScore(ZH_DREAM_WORD_OK, 'zh', null);
  assert.ok(!res.issues.some((i) => i.type === 'dream_nullification'), '"做梦都想"不是梦境作废');
  assert.ok(!res.issues.some((i) => i.type === 'hook_deflated'), '末拍是强钩（突然+股权转让书），不判泄气');
});

test('c209 反向不误杀：已有强反转样本不得新增泄气/梦境问题', () => {
  const res = cliffhangerScore(ZH_REVERSAL, 'zh', null);
  assert.ok(!res.issues.some((i) => i.type === 'hook_deflated'), '冷笑收尾不是泄气');
  assert.ok(!res.issues.some((i) => i.type === 'dream_nullification'));
});

// 英文：强钩 + 平收
const EN_DEFLATED = `
Scene: Office, Night
Lin: You set me up from the very beginning, didn't you?
Suddenly the door flew open and two strangers stepped in.
She watched them leave, and just like that, everything was over.
`;

// 英文：梦境作废
const EN_DREAM = `
Scene: Bedroom, Night
The white light swallowed the room and she reached for her mother's hand.
She woke up gasping in her own bed and realized it was all a dream.
`;

test('c209 英文末拍泄气与梦境作废同样可识别', () => {
  const d = cliffhangerScore(EN_DEFLATED, 'en', null);
  assert.ok(d.issues.some((i) => i.type === 'hook_deflated'), `英文应判 hook_deflated，实际 ${JSON.stringify(d.issues.map((i) => i.type))}`);
  assert.ok(d.score <= 80, `英文泄气尾应压分，实际${d.score}`);
  const dr = cliffhangerScore(EN_DREAM, 'en', null);
  assert.ok(dr.issues.some((i) => i.type === 'dream_nullification'), '英文应判 dream_nullification');
  assert.ok(dr.score <= 40, `英文梦境作废应重罚，实际${dr.score}`);
});

// —— c209 落库摘要 helper：生成落库 / SSE / 付费改写三处共用同一存储形态 ——

test('c209 detectCliffhangerLang 按汉字判定中英文', () => {
  const { detectCliffhangerLang } = require('../dist/engine/cliffhanger-score.js');
  assert.strictEqual(detectCliffhangerLang('林晚：你来了。'), 'zh');
  assert.strictEqual(detectCliffhangerLang('Lin: You came.'), 'en');
  assert.strictEqual(detectCliffhangerLang(''), 'en', '空文本兜底 en（与正则引擎默认一致）');
});

test('c209 cliffhangerDigest 产出统一存储形态：片段≤100、问题文本截断、字段齐全', () => {
  const { cliffhangerDigest } = require('../dist/engine/cliffhanger-score.js');
  const res = cliffhangerScore(ZH_DREAM, 'zh', null);
  const d = cliffhangerDigest(res);
  assert.ok(d.endingSnippet.length <= 100, `落库 endingSnippet 必须≤100，实际${d.endingSnippet.length}`);
  assert.ok(Array.isArray(d.issues) && d.issues.length <= 4);
  assert.strictEqual(typeof d.score, 'number');
  assert.strictEqual(typeof d.type, 'string');
  assert.strictEqual(typeof d.typeLabel, 'string');
  assert.ok(d.planAlignment === null, '未传规划时 planAlignment=null');
  for (const i of d.issues) {
    assert.ok(i.evidence.length <= 120, 'evidence 必须截断防 qcReport 膨胀');
    assert.ok(i.advice.length <= 160, 'advice 必须截断防 qcReport 膨胀');
  }
});

test('c209 scoreCliffhangerForStorage 自动识别语言并返回存储形态', () => {
  const { scoreCliffhangerForStorage } = require('../dist/engine/cliffhanger-score.js');
  const d = scoreCliffhangerForStorage(ZH_REVERSAL);
  assert.strictEqual(d.type, 'reversal');
  assert.strictEqual(d.typeLabel, '反转钩', '自动识别中文→中文类型名');
  assert.ok(d.endingSnippet.length <= 100);
  const de = scoreCliffhangerForStorage(EN_REVERSAL);
  assert.strictEqual(de.typeLabel, 'Reversal', '自动识别英文→英文类型名');
});
