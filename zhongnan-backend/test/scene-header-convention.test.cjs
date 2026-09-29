const { test } = require('node:test');
const assert = require('node:assert');
const { sceneHeaderConvention } = require('../dist/engine/scene-header-convention.js');

// 中文健康剧本：5场，编号连续，地点具体，时间标注，格式一致
const ZH_HEALTHY = `场景 1：内景·卧室·日
△晨光透过窗帘，林晓猛地坐起。
林晓：几点了？！

场景 2：外景·街道·日
△林晓冲出小区，差点撞到一辆车。
路人：小心点！

场景 3：内景·办公室·日
△林晓推开会议室门，所有人都回头看她。
王总：你又迟到了。

场景 4：内景·走廊·黄昏
△林晓靠在墙上，手机响起。
林母：你到底什么时候结婚？

场景 5：外景·天台·夜
△林晓望着城市灯火，嘴角微扬。
林晓：从今天起，我要为自己活。`;

// 格式不一致剧本：混用 LIVE 和 AIGC 格式
const ZH_MIXED_FORMAT = `场景 1：内景·卧室·日
△内容

【场景2】内景·办公室·日
△内容

场景 3：外景·街道·夜
△内容

【第四场】外景·天台·夜
△内容`;

// 编号不连续剧本
const ZH_DISCONTINUOUS = `场景 1：内景·卧室·日
△内容

场景 3：外景·街道·日
△内容

场景 5：内景·办公室·日
△内容`;

// 地点缺失剧本
const ZH_MISSING_LOCATION = `场景 1：内景·日
△内容

场景 2：外景·夜
△内容

场景 3：内景·日
△内容`;

// 时间标注缺失剧本
const ZH_MISSING_TIME = `场景 1：内景·卧室
△内容

场景 2：外景·街道
△内容

场景 3：内景·办公室
△内容`;

// 标题过长剧本
const ZH_TOO_LONG = `场景 1：内景·卧室·日，阳光明媚透过薄纱窗帘洒落在凌乱的床上，林晓正在睡觉
△内容

场景 2：外景·街道·日
△内容`;

// 标题重复剧本
const ZH_DUPLICATE = `场景 1：内景·卧室·日
△内容

场景 2：内景·卧室·日
△内容

场景 3：内景·卧室·日
△内容`;

// 无场景标题剧本
const ZH_NO_HEADERS = `△林晓醒来。
林晓：几点了？！
△林晓冲出门。`;

// 英文健康剧本
const EN_HEALTHY = `INT. BEDROOM - DAY
Lin Xiao sits up in bed suddenly.
LIN XIAO: What time is it?!

EXT. STREET - DAY
Lin Xiao rushes out of the compound.
PASSERBY: Watch out!

INT. OFFICE - DAY
Lin Xiao pushes open the meeting room door.
BOSS WANG: You're late again.

INT. HALLWAY - DUSK
Lin Xiao leans against the wall, phone rings.
MOTHER: When are you getting married?

EXT. ROOFTOP - NIGHT
Lin Xiao looks at the city lights.
LIN XIAO: From today, I live for myself.`;

// 英文格式不一致
const EN_MIXED = `INT. BEDROOM - DAY
Content here.

[Scene 2] OFFICE - DAY
Content here.

EXT. STREET - NIGHT
Content here.`;

test('中文健康剧本应得高分（≥70）且无 high 级问题', () => {
  const res = sceneHeaderConvention(ZH_HEALTHY, 'zh');
  assert.ok(res.totalHeaders === 5, `headers=${res.totalHeaders}`);
  assert.ok(res.score >= 70, `expected >=70, got ${res.score}`);
  assert.ok(res.hasContinuousNumbering, 'should be continuous');
  assert.ok(res.hasConsistentFormat, 'should be consistent');
  assert.ok(res.dominantFormat === 'live_cn', `dominant=${res.dominantFormat}`);
  assert.ok(res.missingNumberCount === 0, `missingNum=${res.missingNumberCount}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `unexpected high issues: ${JSON.stringify(highIssues)}`);
});

test('格式混用应触发问题', () => {
  const res = sceneHeaderConvention(ZH_MIXED_FORMAT, 'zh');
  assert.ok(res.inconsistentFormatCount >= 2, `inconsistent=${res.inconsistentFormatCount}`);
  const issues = res.issues.filter((i) => i.type === 'inconsistent_format');
  assert.ok(issues.length >= 1, 'should detect inconsistent format');
  assert.ok(res.score < 90, `expected <90, got ${res.score}`);
});

test('编号不连续应触发问题', () => {
  const res = sceneHeaderConvention(ZH_DISCONTINUOUS, 'zh');
  assert.ok(res.discontinuousCount >= 2, `discontinuous=${res.discontinuousCount}`);
  assert.ok(!res.hasContinuousNumbering, 'should not be continuous');
  const issues = res.issues.filter((i) => i.type === 'discontinuous_numbering');
  assert.ok(issues.length >= 1, 'should detect discontinuous numbering');
});

test('地点缺失应触发问题', () => {
  const res = sceneHeaderConvention(ZH_MISSING_LOCATION, 'zh');
  assert.ok(res.missingLocationCount >= 3, `missingLoc=${res.missingLocationCount}`);
  const issues = res.issues.filter((i) => i.type === 'missing_location');
  assert.ok(issues.length >= 1, 'should detect missing location');
});

test('时间标注缺失应触发问题', () => {
  const res = sceneHeaderConvention(ZH_MISSING_TIME, 'zh');
  assert.ok(res.missingTimeCount >= 3, `missingTime=${res.missingTimeCount}`);
  const issues = res.issues.filter((i) => i.type === 'missing_time');
  assert.ok(issues.length >= 1, 'should detect missing time');
});

test('标题过长应触发问题', () => {
  const res = sceneHeaderConvention(ZH_TOO_LONG, 'zh');
  assert.ok(res.tooLongCount >= 1, `tooLong=${res.tooLongCount}`);
  const issues = res.issues.filter((i) => i.type === 'too_long_header');
  assert.ok(issues.length >= 1, 'should detect too long header');
});

test('标题重复应触发问题', () => {
  const res = sceneHeaderConvention(ZH_DUPLICATE, 'zh');
  assert.ok(res.duplicatePairCount >= 2, `dupPairs=${res.duplicatePairCount}`);
  const issues = res.issues.filter((i) => i.type === 'duplicate_header');
  assert.ok(issues.length >= 1, 'should detect duplicates');
});

test('无场景标题应触发 high 级问题', () => {
  const res = sceneHeaderConvention(ZH_NO_HEADERS, 'zh');
  assert.ok(res.totalHeaders === 0, `headers=${res.totalHeaders}`);
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.ok(highIssues.some((i) => i.type === 'no_scene_headers'), 'should detect no headers');
  assert.ok(res.score < 50, `expected <50, got ${res.score}`);
});

test('英文健康剧本应得高分', () => {
  const res = sceneHeaderConvention(EN_HEALTHY, 'en');
  assert.ok(res.totalHeaders === 5, `headers=${res.totalHeaders}`);
  assert.ok(res.score >= 70, `expected >=70, got ${res.score}`);
  assert.ok(res.dominantFormat === 'en', `dominant=${res.dominantFormat}`);
  assert.ok(res.hasConsistentFormat, 'should be consistent');
  const highIssues = res.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(highIssues.length, 0, `unexpected high issues: ${JSON.stringify(highIssues)}`);
});

test('英文层零中文（issue advice 字段不得含中文，当 lang=en）', () => {
  const res = sceneHeaderConvention(EN_MIXED, 'en');
  const chineseRe = /[一-鿿]/;
  for (const issue of res.issues) {
    assert.ok(!chineseRe.test(issue.evidence), `evidence 含中文: ${issue.evidence}`);
    assert.ok(!chineseRe.test(issue.advice), `advice 含中文: ${issue.advice}`);
  }
});

test('场景编号提取应正确处理中文数字', () => {
  const script = `第一场：内景·卧室·日
△内容

第二场：外景·街道·日
△内容

第三场：内景·办公室·日
△内容`;
  const res = sceneHeaderConvention(script, 'zh');
  assert.ok(res.totalHeaders === 3, `headers=${res.totalHeaders}`);
  assert.ok(res.hasContinuousNumbering, 'should be continuous 1-2-3');
  assert.ok(res.headers[0].number === 1, `num1=${res.headers[0].number}`);
  assert.ok(res.headers[1].number === 2, `num2=${res.headers[1].number}`);
  assert.ok(res.headers[2].number === 3, `num3=${res.headers[2].number}`);
});

test('AIGC 格式【场景N】应被正确识别', () => {
  const script = `【场景1】内景·卧室·日
△内容

【场景2】外景·街道·日
△内容

【场景3】内景·办公室·日
△内容`;
  const res = sceneHeaderConvention(script, 'zh');
  assert.ok(res.totalHeaders === 3, `headers=${res.totalHeaders}`);
  assert.ok(res.dominantFormat === 'aigc_cn', `dominant=${res.dominantFormat}`);
  assert.ok(res.hasContinuousNumbering, 'should be continuous');
});

test('v2.157 bare_cn：「内景/外景 地点·时间」为合法 AIGC 场头格式，无编号不扣分', () => {
  const script = `内景 卧室 日
△内容

外景 街道 夜
△内容

内景 办公室 日
△内容`;
  const res = sceneHeaderConvention(script, 'zh');
  assert.strictEqual(res.totalHeaders, 3, `headers=${res.totalHeaders}`);
  assert.strictEqual(res.dominantFormat, 'bare_cn', `dominant=${res.dominantFormat}`);
  assert.strictEqual(res.missingNumberCount, 0, 'bare_cn 无编号要求，不计 missing_number');
  assert.ok(res.hasConsistentFormat, '同格式应一致');
  assert.ok(res.headers.every((h) => h.valid), `全合规：${JSON.stringify(res.headers.map((h) => h.reasons))}`);
  assert.ok(res.headers.every((h) => h.timeOfDay), '时间标注提取在位（物料排期依赖）');
});

test('疑似场景标题但格式不标准应触发问题（无编号无冒号 → unknown + missing_number）', () => {
  const script = `场景 卧室 日
△内容

场景 街道 夜
△内容

场景 办公室 日
△内容`;
  const res = sceneHeaderConvention(script, 'zh');
  // 这些行会被识别为场景标题（SCENE_LIKE_CN），但无编号无冒号：非 live_cn/bare_cn → unknown + missing_number
  assert.ok(res.totalHeaders >= 2, `headers=${res.totalHeaders}`);
  const issues = res.issues.filter((i) => i.type === 'non_standard_scene_header' || i.type === 'inconsistent_format' || i.type === 'missing_number');
  assert.ok(issues.length >= 1, `should detect non-standard headers, issues: ${JSON.stringify(res.issues.map((i) => i.type))}`);
});

// ==================== v2.157 场头前置教学指令 ====================
const D_DIR = require('../dist/engine/scene-header-convention.js').buildSceneHeaderDirective;

test('v2.157 指令·zh LIVE：教「场景N：地点·时间」带编号口径，含时间必填与统一格式约束', () => {
  const d = D_DIR('LIVE', 'zh');
  assert.ok(d.includes('场景N：地点·时间'), 'LIVE 教 live_cn 带编号口径');
  assert.ok(d.includes('时间标注必填') && d.includes('连续编号'), '编号连续 + 时间必填');
  assert.ok(d.includes('统一同一种格式'), '格式一致约束');
  assert.ok(!d.includes('内景/外景 地点'), 'LIVE 不教 bare_cn 口径');
});

test('v2.157 指令·zh AIGC：教「内景/外景 地点·时间」bare_cn 口径（与 aigc-screenplay SCENE_HEAD_RE 同源）', () => {
  const d = D_DIR('AIGC', 'zh');
  assert.ok(d.includes('内景/外景 地点·时间'), 'AIGC 教 bare_cn 口径');
  assert.ok(d.includes('时间标注必填'), '时间必填');
  assert.ok(!d.includes('场景N：地点·时间'), 'AIGC 不教 live_cn 口径（会致 sceneCount=0）');
});

test('v2.157 指令·en：零中文，LIVE 带编号 SCENE N，AIGC 用 INT./EXT.', () => {
  const live = D_DIR('LIVE', 'en');
  const aigc = D_DIR('AIGC', 'en');
  assert.ok(/SCENE N: Location - TIME/.test(live) && /continuous/.test(live));
  assert.ok(/INT\.\/EXT\. Location - TIME/.test(aigc));
  assert.ok(!/[\u4e00-\u9fff]/.test(live) && !/[\u4e00-\u9fff]/.test(aigc), '英文指令零中文');
});

// ==================== v2.158 漏标场头探测（non_standard_scene_header 死代码修复） ====================
test('v2.158 漏标探测：时间词打头/结尾的短行（如「教室 日」「深夜 天台」）触发 non_standard_scene_header', () => {
  const script = `场景 1：内景·卧室·日
△林晓猛地坐起。
林晓：几点了？！
教室 日
△一场没有场头的戏混了进来。
深夜 天台
△另一场漏标场头的戏。`;
  const res = sceneHeaderConvention(script, 'zh');
  const issue = res.issues.find((i) => i.type === 'non_standard_scene_header');
  assert.ok(issue, `应触发漏标探测，实际 issues: ${JSON.stringify(res.issues.map((i) => i.type))}`);
  assert.ok(/L4|L6/.test(issue.evidence), `证据应指向漏标行，evidence=${issue.evidence}`);
});

test('v2.158 漏标探测不误报：健康剧本与台词/旁白行不触发', () => {
  const healthy = sceneHeaderConvention(`场景 1：内景·卧室·日
△晨光透过窗帘，林晓猛地坐起。
林晓：几点了？！
夜色渐深，城市仍未入眠。`, 'zh');
  assert.ok(!healthy.issues.some((i) => i.type === 'non_standard_scene_header'), '健康剧本不误报（长旁白句排除）');
  const dialogue = sceneHeaderConvention(`场景 1：内景·卧室·日
林晓：深夜 天台 这句是台词不是场头`, 'zh');
  assert.ok(!dialogue.issues.some((i) => i.type === 'non_standard_scene_header'), '含冒号台词行排除');
  const enMissed = sceneHeaderConvention(`INT. CAFE - NIGHT
Amy: Hi.
ALLEY - NIGHT
They fight.
ROOFTOP - DAWN
They talk.`, 'en');
  assert.ok(enMissed.issues.some((i) => i.type === 'non_standard_scene_header'), 'en 漏标行（ALLEY - NIGHT 等 2 行）同样触发');
});
