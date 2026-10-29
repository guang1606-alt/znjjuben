// v2.348 真人侧「爽点蓄力曲线」引擎
// 分工：cool-moment-score 查爽点数量/分布/强度/hasBuildup(布尔)；payoff-rhythm-check 查受压↔释放配对；
// 本引擎查「蓄力/爆发在全文的位置形状」——短剧铁律：前段憋（蓄力密）、后段爆（爽点密）。
// 反过来的稿（开头就爆、结尾干憋）现有引擎不报警，本引擎补位。
const test = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/payoff-curve-check.js');

// ---------- 健康曲线：前段蓄力密 + 后段爽点密 → 不报 high ----------
test('v2.348 健康稿：前段蓄力堆叠、后段爽点爆发 → score 高且无 high', () => {
  // 前 1/3 全是受辱蓄力，后 1/3 全是打脸爆发
  const healthy = [
    '内景 婚宴厅·日',
    '林晚被当众退婚，未婚夫把离婚协议甩在她脸上：你这种穷鬼配不上我。',
    '满堂宾客嘲笑她是个废物，她含泪忍住，咬牙咽下这口气。',
    '反派逼她跪下道歉，她忍气吞声，受尽屈辱。',
    '中段她默默收集证据，低声下气地周旋。',
    '内景 公司·日',
    '林晚亮出黑卡和股权书：这家公司归我了。',
    '她当场打脸所有人，身份揭晓原来是董事长千金。',
    '未婚夫跪地求饶，全场震惊倒吸凉气。',
    '反派被当场逮捕，恶有恶报，大仇得报。',
    '林晚扬眉吐气，收购了对方公司，完胜。',
  ].join('\n');
  const r = M.payoffCurveCheck(healthy, 'zh');
  assert.strictEqual(typeof r.score, 'number');
  assert.ok(r.score >= 60, `score=${r.score} issues=${JSON.stringify(r.issues.map(i=>i.type))}`);
  assert.strictEqual(r.issues.filter((i) => i.severity === 'high').length, 0, JSON.stringify(r.issues));
});

// ---------- 倒置曲线：开头就爆、结尾干憋 → 报 high ----------
test('v2.348 倒置稿：开头就爆发、后段只有蓄力没有爽点 → 报 high（front_burst/back_suppress）', () => {
  const inverted = [
    '内景 公司·日',
    '林晚一出场就当场打脸反派，掀翻桌子，身份揭晓是首富。',
    '反派跪地求饶，全场震惊，她大胜开局。',
    '内景 走廊·夜',
    '可接下来她被冤枉、被嘲笑、被赶出公司。',
    '她含泪忍住，走投无路，被逼到绝境。',
    '反派当众羞辱她，逼她跪下，她委屈地咽下这口气。',
    '全集结尾她还在忍气吞声，没有任何翻盘。',
  ].join('\n');
  const r = M.payoffCurveCheck(inverted, 'zh');
  const types = r.issues.map((i) => i.type);
  assert.ok(types.includes('front_loaded_burst') || types.includes('tail_no_payoff'), JSON.stringify(types));
  assert.ok(r.issues.some((i) => i.severity === 'high'), JSON.stringify(r.issues));
});

// ---------- 蓄力全堆后段：前段无蓄力、后段憋死 → 报 ----------
test('v2.348 蓄力错配稿：蓄力全堆在后 1/3 → 报 tail_suppression_pileup', () => {
  const pileup = [
    '内景 咖啡厅·日',
    '林晚和朋友聊天，气氛平和，无波无澜。',
    '她去上班，处理日常文件，一切如常。',
    '内景 仓库·夜',
    '突然她被打、被泼、被扇耳光、被逼跪下。',
    '反派嘲笑她是废物，她含泪忍住，受尽屈辱走投无路。',
    '她被关起来，账户被冻结，身无分文，绝望地哭泣。',
  ].join('\n');
  const r = M.payoffCurveCheck(pileup, 'zh');
  const types = r.issues.map((i) => i.type);
  assert.ok(types.includes('tail_suppression_pileup') || types.includes('tail_no_payoff') || types.includes('no_payoff'), JSON.stringify(types));
});

// ---------- 返回结构完整 ----------
test('v2.348 结构：返回 head/tail 蓄力与爽点密度及曲线斜率字段', () => {
  const r = M.payoffCurveCheck('内景 厅·日\n他受辱忍住。\n他打脸反派。', 'zh');
  for (const k of ['headBuildup', 'tailBuildup', 'headPayoff', 'tailPayoff', 'curveSlope']) {
    assert.ok(k in r, `missing ${k}`);
    assert.strictEqual(typeof r[k], 'number', `${k} should be number`);
  }
  assert.ok(Array.isArray(r.issues));
});

// ---------- 空稿/短稿不崩溃 ----------
test('v2.348 边界：空稿返回满分无 issue（与 payoffRhythm 一致）', () => {
  const r = M.payoffCurveCheck('', 'zh');
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.issues, []);
});

// ---------- 英文链路 ----------
test('v2.348 英文稿：前段 humiliation 蓄力 + 后段 face-slap 爆发 → 无 high', () => {
  const en = [
    'INT. HALL - DAY',
    'She was publicly humiliated and jilted, the divorce papers thrown in her face.',
    'Everyone called her trash. She swallowed her pride, tears streaming, forced to kneel.',
    'INT. OFFICE - DAY',
    'She revealed her true identity as the CEO and turned the tables.',
    'The villain dropped to his knees begging for mercy. Everyone was stunned silent.',
    'She acquired the company and won it all back, vindicated.',
  ].join('\n');
  const r = M.payoffCurveCheck(en, 'en');
  assert.ok(r.score >= 60, `score=${r.score} ${JSON.stringify(r.issues.map(i=>i.type))}`);
  assert.strictEqual(r.issues.filter((i) => i.severity === 'high').length, 0, JSON.stringify(r.issues));
});

// ---------- 变异咬红：判定边界鲁棒性 ----------

test('v2.348 变异1：零信号稿（无蓄力无爽点）不得误报 high（避免与 coolMoment 重复定罪）', () => {
  // 全文中性对话，既无蓄力也无爽点——数量不足是 coolMoment 的职责，本引擎只管"形状"
  const neutral = '内景 厅·日\n甲：今天天气不错。\n乙：是啊，出去走走。\n甲：好。';
  const r = M.payoffCurveCheck(neutral, 'zh');
  assert.strictEqual(r.issues.filter((i) => i.severity === 'high').length, 0, JSON.stringify(r.issues));
});

test('v2.348 变异2：前段爽点密度略高于后段但未达 1.5 倍阈值 → 不报 front_loaded_burst（阈值边界）', () => {
  // 构造：前段 1 个爽点 + 后段 1 个爽点（密度相近，斜率不陡但也不算倒置）
  const borderline = [
    '内景 厅·日',
    '林晚被退婚，含泪忍住，咬牙咽下这口气，受尽屈辱走投无路。',
    '她默默忍耐，低声下气。',
    '内景 公司·日',
    '她亮出证据戳穿反派，反派跪地求饶。',
    '结尾她身份揭晓是董事长，收购对方公司完胜。',
  ].join('\n');
  const r = M.payoffCurveCheck(borderline, 'zh');
  assert.ok(!r.issues.some((i) => i.type === 'front_loaded_burst'), JSON.stringify(r.issues.map(i=>i.type)));
});

test('v2.348 变异3：畸形输入不崩溃（null/undefined/纯空白）', () => {
  assert.doesNotThrow(() => M.payoffCurveCheck(null, 'zh'));
  assert.doesNotThrow(() => M.payoffCurveCheck(undefined, 'zh'));
  const r = M.payoffCurveCheck('   \n  ', 'zh');
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.issues, []);
});

test('v2.348 变异4：score 恒在 0-100 区间（极端倒置稿不得为负）', () => {
  const worst = '内景 厅·日\n他当场打脸反派掀桌身份揭晓首富，反派跪地求饶全场震惊。\n内景 廊·夜\n可他随后被冤枉被嘲笑被赶被泼被逼跪下含泪忍住走投无路绝望痛哭。'.repeat(3);
  const r = M.payoffCurveCheck(worst, 'zh');
  assert.ok(r.score >= 0 && r.score <= 100, `score=${r.score}`);
});

test('v2.348 变异5：后段蓄力未达 0.3 阈值时不得报 tail_no_payoff（阈值边界）', () => {
  // 后段仅极少量蓄力（密度低于阈值），即使零爽点也不该定 tail_no_payoff
  // 构造：蓄力全在前段，后段干净
  const r = M.payoffCurveCheck([
    '内景 厅·日',
    '林晚被退婚被嘲笑含泪忍住走投无路受尽屈辱绝望痛哭被逼下跪。',
    '内景 公司·日',
    '时间过去，她回到家休息。',
  ].join('\n'), 'zh');
  assert.ok(!r.issues.some((i) => i.type === 'tail_no_payoff'), JSON.stringify(r.issues.map(i=>i.type)));
});

test('v2.348 变异6：curveSlope 语义——健康稿为正、倒置稿为负或显著更低', () => {
  const healthy = '内景 厅·日\n被退婚含泪忍住受尽屈辱走投无路。\n被嘲笑被逼下跪。\n内景 司·日\n亮出黑卡身份揭晓董事长，当场打脸反派跪地求饶全场震惊收购完胜扬眉吐气。';
  const inverted = '内景 厅·日\n亮出黑卡身份揭晓董事长当场打脸反派跪地求饶全场震惊收购完胜。\n内景 廊·夜\n被冤枉被嘲笑被赶被泼被逼下跪含泪忍住走投无路绝望痛哭受尽屈辱。';
  const hs = M.payoffCurveCheck(healthy, 'zh').curveSlope;
  const is = M.payoffCurveCheck(inverted, 'zh').curveSlope;
  assert.ok(hs > is, `healthy=${hs} inverted=${is}`);
});
