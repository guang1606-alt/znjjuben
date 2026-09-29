/**
 * v2.80 焊点承接检测（opening-continuity-check）测试
 * 覆盖：prevEnding 无效不检测、正常承接零 issue、说话人全灭=high（零重叠）/
 *       mid（有重叠）、纯动作结尾零重叠=cold_open、有重叠放行、跳时间=low、
 *       开场块二场标界定、zh 说话人停用词、en 说话人提取与零中文、
 *       draft 过短兜底、lastSpeaker/overlapCount 字段。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { openingContinuityCheck } = require('../dist/engine/opening-continuity-check.js');

test('prevEnding 缺失/过短（<20 字）不检测：checked=false、score=100、零 issue', () => {
  for (const e of ['', '   ', '林晚：好的。']) {
    const r = openingContinuityCheck(e, '内景 办公室 夜\n△有人在加班。' + 'x'.repeat(30));
    assert.strictEqual(r.checked, false);
    assert.strictEqual(r.score, 100);
    assert.deepStrictEqual(r.issues, []);
  }
});

test('正常承接：结尾说话人在开场接住 → 零 issue、score=100、lastSpeaker 取末位说话人', () => {
  const ending = '林晚（平静）：合同我签了，但周氏的账，我们还没完。\n周慕深（冷笑）：随时奉陪。';
  const draft = '内景 周氏顶层办公室 夜\n△林晚把签好的合同推回桌子中央，周慕深的手指停在支票上方。\n林晚：先说清楚，这笔钱怎么还。';
  const r = openingContinuityCheck(ending, draft);
  assert.strictEqual(r.checked, true);
  assert.deepStrictEqual(r.speakers, ['林晚', '周慕深']);
  assert.strictEqual(r.lastSpeaker, '周慕深');
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(r.score, 100);
  assert.ok(r.overlapCount >= 3);
});

test('说话人全灭+零重叠 → speaker_missing=high（焊点断裂，高危触发重试档）', () => {
  const ending = '周慕深：你以为这张借条能困住我？\n△他把支票拍在桌上，转身走进雨里。';
  const draft = '内景 咖啡馆 晨\n△阳光洒进落地窗，苏茉搅动着杯中的拿铁。';
  const r = openingContinuityCheck(ending, draft);
  assert.strictEqual(r.issueCount, 1);
  assert.strictEqual(r.issues[0].type, 'speaker_missing');
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.overlapCount, 0);
  assert.strictEqual(r.score, 82);
  assert.ok(r.issues[0].evidence.includes('周慕深'));
});

test('说话人全灭但有零星词汇重叠 → speaker_missing=mid', () => {
  const ending = '周慕深：你以为这张借条能困住我？\n△他把支票拍在桌上，转身走进雨里。';
  const draft = '内景 律所会议室 晨\n△清晨，那张借条静静躺在茶几上，像一道结痂的伤口。';
  const r = openingContinuityCheck(ending, draft);
  assert.strictEqual(r.issueCount, 1);
  assert.strictEqual(r.issues[0].type, 'speaker_missing');
  assert.strictEqual(r.issues[0].severity, 'mid');
  assert.ok(r.overlapCount >= 1);
  assert.strictEqual(r.score, 90);
});

test('纯动作结尾+零重叠 → cold_open=mid；纯动作结尾+有重叠 → 放行', () => {
  const ending = '△她把那把旧伞塞进他怀里，转身冲进茫茫雨幕，没有再回头看他一眼。';
  const cold = openingContinuityCheck(ending, '内景 咖啡馆 晨\n△阳光洒进落地窗，苏茉搅动着杯中的拿铁。');
  assert.strictEqual(cold.speakers.length, 0);
  assert.strictEqual(cold.issueCount, 1);
  assert.strictEqual(cold.issues[0].type, 'cold_open');
  assert.strictEqual(cold.issues[0].severity, 'mid');
  const fair = openingContinuityCheck(ending, '内景 街口 夜\n△他抱着伞愣在原地，看着她冲进雨幕的背影消失在街角。');
  assert.strictEqual(fair.issueCount, 0);
  assert.strictEqual(fair.score, 100);
});

test('开场直接跳时间 → delayed_open=low（承接住说话人的前提下不叠加高危）', () => {
  const ending = '林晚（平静）：合同我签了，但周氏的账，我们还没完。\n周慕深（冷笑）：随时奉陪。';
  const draft = '内景 周氏顶层办公室 次日清晨\n△林晚把签好的合同推回桌子中央，周慕深的手指停在支票上方。';
  const r = openingContinuityCheck(ending, draft);
  assert.strictEqual(r.issueCount, 1);
  assert.strictEqual(r.issues[0].type, 'delayed_open');
  assert.strictEqual(r.issues[0].severity, 'low');
  assert.strictEqual(r.score, 98);
});

test('开场块界定：承接内容出现在第一个场标之后（第二个场标之前）仍被识别', () => {
  const ending = '周慕深（哽咽）：你到底要我怎么做才肯相信？';
  const draft = [
    '内景 地下车库 夜',
    '△周慕深从车里下来，手里还捏着那张被雨水泡皱的支票。',
    '内景 顶层办公室 夜',
    '△秘书抱着一摞文件走过长廊，窗帘被风掀起一角。',
  ].join('\n');
  const r = openingContinuityCheck(ending, draft);
  assert.strictEqual(r.issueCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh 说话人停用词：字幕/旁白/特写等冒号行不算人名，走纯动作路径', () => {
  const ending = '字幕：三天后，海滨别墅。\n△林晚把伞塞进他怀里，转身冲进茫茫雨幕，没有回头。';
  const r = openingContinuityCheck(ending, '内景 咖啡馆 晨\n△苏茉搅动着杯中的拿铁，望着窗外出神。');
  assert.strictEqual(r.speakers.length, 0);
  assert.strictEqual(r.issues[0].type, 'cold_open');
});

test('en 模式：说话人提取（含情绪括号）、全灭=high、advice/evidence 零中文', () => {
  const ending = 'ELENA (angry): You think that contract can hold me?\nVICTOR (smiling): Watch it hold you in place.';
  const draft = 'INT. COFFEE SHOP - MORNING\nSunlight floods the counter. MIA stirs her latte, phone face down.';
  const r = openingContinuityCheck(ending, draft, 'en');
  assert.deepStrictEqual(r.speakers, ['ELENA', 'VICTOR']);
  assert.strictEqual(r.lastSpeaker, 'VICTOR');
  assert.strictEqual(r.issues[0].type, 'speaker_missing');
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.ok(r.issues[0].advice.startsWith("The previous episode's final speakers"));
  assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(r.issues)), `en issue 层含中文: ${JSON.stringify(r.issues)}`);
  const ok = openingContinuityCheck(ending, "INT. VICTOR'S PENTHOUSE - NIGHT\nELENA slides the signed contract back across the desk.\nELENA: We are not done, Victor.", 'en');
  assert.strictEqual(ok.issueCount, 0);
  assert.strictEqual(ok.score, 100);
});

test('en 模式：stopword 过滤（the/and 等不算衔接词），冷开场判定不被虚词救活', () => {
  const ending = 'MARCUS (low): Find the ledger before dawn, or everything burns tonight.';
  const draft = 'INT. DINER - NIGHT\nThe waitress pours the coffee and wipes the counter again and again.';
  const r = openingContinuityCheck(ending, draft, 'en');
  // the/and 均为虚词；marcus/find/ledger/burns 等实词无一出现 → speaker_missing
  assert.strictEqual(r.issues[0].type, 'speaker_missing');
  assert.strictEqual(r.issues[0].severity, 'high');
  assert.strictEqual(r.overlapCount, 0);
});

test('draft 过短兜底：checked=true 但不产生 issue，不崩溃', () => {
  const r = openingContinuityCheck('周慕深：你以为这张借条能困住我？他冷笑着转身走进雨里。', '太短');
  assert.strictEqual(r.checked, true);
  assert.strictEqual(r.prevEndingChars > 20, true);
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(r.score, 100);
});

// c214：开头剧名行（第N集/Episode N）不是场标——旧逻辑把剧名行计为第 1 个场标，
// 开场块被截成"剧名+首个场标"两行空壳，speaker_missing 必误报、delayed_open 必漏报。
test('c214 开头剧名行不计场标：开场块覆盖首个场景正文，承接良好不报 speaker_missing', () => {
  const ending = '小舟（嘶吼）：你敢动她一根头发，我跟你拼命！\n△他把椅子踹翻，玻璃碎了一地。';
  const good = '第2集 接上一瞬\n内景 废弃仓库 夜 接上场\n小舟的拳头攥得咯咯响，玻璃渣扎进掌心。\n小舟：放开她。\n他：急什么。';
  const r = openingContinuityCheck(ending, good, 'zh');
  assert.strictEqual(r.checked, true);
  assert.ok(!r.issues.some((i) => i.severity === 'high'), `承接良好稿不得报 high，实际 ${JSON.stringify(r.issues.map((i) => [i.severity, i.type]))}`);
});

test('c214 开头剧名行不计场标：坏稿仍真报 speaker_missing + delayed_open', () => {
  const ending = '小舟（嘶吼）：你敢动她一根头发，我跟你拼命！\n△他把椅子踹翻，玻璃碎了一地。';
  const bad = '第2集 新的一天\n内景 咖啡馆 日\n△次日清晨，阳光正好。\n林总：这杯美式不错。\n服务员：慢用。';
  const r = openingContinuityCheck(ending, bad, 'zh');
  assert.ok(r.issues.some((i) => i.type === 'speaker_missing'), '坏稿必须检出 speaker_missing');
  assert.ok(r.issues.some((i) => i.type === 'delayed_open'), '坏稿必须检出 delayed_open（剧名行不再吃掉开场块）');
});

test('c214 英文剧名行 Episode N 同样跳过；无剧名行的旧行为不变', () => {
  const ending = 'MIA (screaming): You lay one finger on her and I will end you, Victor!';
  const good = 'Episode 2\nINT. WAREHOUSE - NIGHT\nMIA clenches her fists, glass biting into her palm.\nMIA: Let her go.';
  const r = openingContinuityCheck(ending, good, 'en');
  assert.ok(!r.issues.some((i) => i.severity === 'high'), `en 承接良好稿不得报 high，实际 ${JSON.stringify(r.issues.map((i) => [i.severity, i.type]))}`);
  // 无剧名行：首个行即场标，行为与修复前一致
  const plain = openingContinuityCheck(ending, 'INT. WAREHOUSE - NIGHT\nMIA clenches her fists.\nMIA: Let her go.', 'en');
  assert.ok(!plain.issues.some((i) => i.severity === 'high'));
});
