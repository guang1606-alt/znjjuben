const test = require('node:test');
const assert = require('node:assert');
const S = require('../dist/lib/content-safety.js');

// ───────── BLOCK 硬拦截 ─────────
test('BLOCK：明确违法违规导向短语被硬拦截，错误文案口径与历史一致', () => {
  const cases = [
    '这里是赌博技巧教学', '制作毒品的方法', '诈骗教程全套', '分裂国家言论',
    '恐怖主义宣传', '买卖公民信息渠道', '教唆犯罪', '非法集资教程',
    '偷税漏税操作', '逃避监管办法', '制作炸弹步骤', '煽动民族仇恨', '儿童色情',
  ];
  for (const t of cases) {
    const r = S.scanContent(t);
    assert.strictEqual(r.level, 'block', `应拦截：${t}`);
    assert.ok(r.blocked.length >= 1);
    assert.ok(r.blockReason.includes('已拦截'), r.blockReason);
  }
});

test('向后兼容：强导向/行为词仍硬拦截；纯题材名词按新口径只预警、不硬拦', () => {
  // 强行为/教程导向词保持 BLOCK
  const stillBlock = ['教唆犯罪','赌博技巧','色情淫秽','非法集资','诈骗教程','分裂国家','恐怖主义','买卖公民信息','制作毒品'];
  for (const w of stillBlock) {
    assert.strictEqual(S.scanContent(w).level, 'block', `应继续拦截：${w}`);
  }
  // 题材名词（旧版以裸 includes 误作 BLOCK）降为 WARN，避免误杀正面叙事
  const warnOnly = ['偷税漏税','逃避监管','制毒'];
  for (const w of warnOnly) {
    const r = S.scanContent(w);
    assert.strictEqual(r.level, 'warn', `题材名词应只预警：${w}`);
    assert.strictEqual(r.blocked.length, 0, `${w} 不应产生硬拦截命中`);
  }
});

test('不误杀正面叙事：被查处/受严惩的题材台词不 block，但教程化表达仍硬拦', () => {
  const positive = [
    '反派最终因偷税漏税被判刑，受到法律严惩',
    '警方连夜捣毁制毒窝点，毒贩全部落网',
    '企业完成合规整改，依法纳税、不再逃避监管',
  ];
  for (const t of positive) {
    assert.notStrictEqual(S.scanContent(t).level, 'block', `正面叙事不应硬拦：${t}`);
  }
  // 同一题材一旦教程化/操作化，仍必须硬拦（拦截力度不降）
  for (const t of ['偷税漏税教程', '偷税漏税操作', '逃避监管办法', '制毒教程', '贩毒渠道']) {
    assert.strictEqual(S.scanContent(t).level, 'block', `导向短语应硬拦：${t}`);
  }
});

// ───────── WARN 预警不拦截 ─────────
test('WARN：受限题材只预警、不硬拦（不误杀正常创作）', () => {
  const r = S.scanContent('女主陷入缅北电诈园区后机智逃生，最终配合警方端掉窝点（反诈警示）');
  assert.strictEqual(r.level, 'warn');
  assert.strictEqual(r.blocked.length, 0);
  assert.ok(r.warnings.length >= 1);
  assert.strictEqual(r.blockReason, null);
});

test('SAFE：反赌/剧情中出现普通题材词不被误杀', () => {
  // “赌博”作为剧情后果呈现（非“赌博技巧”教程），正常题材名词不应硬拦
  const r = S.scanContent('男主因赌博倾家荡产，最终醒悟自首，警示观众远离赌桌');
  assert.notStrictEqual(r.level, 'block');
  // 正常都市情感剧本完全安全
  assert.strictEqual(S.scanContent('雨夜，林晚在便利店重逢十年未见的高中同学，两人相视一笑。').level, 'safe');
});

// ───────── scanMany 互动分支全扫描 ─────────
test('scanMany：互动短剧任一分支违规即整体 block，全部干净才 safe', () => {
  const mixed = S.scanMany(['结局A：主角团圆', '结局B：主角黑化后传授诈骗教程', '结局C：开放式']);
  assert.strictEqual(mixed.level, 'block');
  const clean = S.scanMany(['结局A', '结局B', null, undefined, '']);
  assert.strictEqual(clean.level, 'safe');
});

test('isBlocked 便捷判定', () => {
  assert.strictEqual(S.isBlocked('正常内容'), false);
  assert.strictEqual(S.isBlocked('含赌博技巧'), true);
});

// ───────── 三级备案分类 ─────────
test('classifyFiling：特殊题材无论投资额一律一类、需发行许可证', () => {
  const r = S.classifyFiling({ specialTopic: true, isAI: false, investWan: 5 });
  assert.strictEqual(r.cls, 'I');
  assert.strictEqual(r.needLicense, true);
});

test('classifyFiling：AI 微短剧 80/30 万门槛边界', () => {
  assert.strictEqual(S.classifyFiling({ isAI: true, investWan: 80 }).cls, 'I');
  assert.strictEqual(S.classifyFiling({ isAI: true, investWan: 79 }).cls, 'II');
  assert.strictEqual(S.classifyFiling({ isAI: true, investWan: 30 }).cls, 'II');
  assert.strictEqual(S.classifyFiling({ isAI: true, investWan: 29 }).cls, 'III');
});

test('classifyFiling：真人微短剧 300/100 万门槛边界', () => {
  assert.strictEqual(S.classifyFiling({ isAI: false, investWan: 300 }).cls, 'I');
  assert.strictEqual(S.classifyFiling({ isAI: false, investWan: 299 }).cls, 'II');
  assert.strictEqual(S.classifyFiling({ isAI: false, investWan: 100 }).cls, 'II');
  assert.strictEqual(S.classifyFiling({ isAI: false, investWan: 99 }).cls, 'III');
});

test('classifyFiling：未提供投资额暂按三类并提示补充', () => {
  const r = S.classifyFiling({ isAI: true });
  assert.strictEqual(r.cls, 'III');
  assert.strictEqual(r.needLicense, false);
  assert.ok(r.reasons[0].includes('暂按'));
});

// ───────── AI 标注与改编授权 ─────────
test('aiDisclaimer：中英文标注均含合规依据', () => {
  assert.ok(S.aiDisclaimer('zh').includes('人工智能'));
  assert.ok(S.aiDisclaimer('en').includes('AI-Generated'));
});

test('adaptationCopyrightCheck：未声明授权被拒，原创/已授权通过', () => {
  assert.strictEqual(S.adaptationCopyrightCheck('UNDECLARED').ok, false);
  assert.strictEqual(S.adaptationCopyrightCheck('ORIGINAL').ok, true);
  assert.strictEqual(S.adaptationCopyrightCheck('LICENSED').ok, true);
});

// ───────── 运营规则覆写（后台规则库） ─────────
test('mergeRules：停用默认规则 + 合并自定义规则', () => {
  const merged = S.mergeRules({ custom: [{ id: 'c_1', category: '自定义', label: '测试', severity: 'BLOCK', patterns: ['自定义禁词'], advice: 'x' }], disabled: ['B05-crime-tutorial'] });
  assert.ok(merged.some((r) => r.id === 'c_1'));
  assert.ok(!merged.some((r) => r.id === 'B05-crime-tutorial'), '被停用规则应移除');
  // 停用后“赌博技巧”不再拦，自定义词可拦
  assert.strictEqual(S.scanContent('赌博技巧', merged).level, 'safe');
  assert.strictEqual(S.scanContent('含自定义禁词', merged).level, 'block');
});

test('buildCustomRule：清洗/校验/自动id', () => {
  const ok = S.buildCustomRule({ severity: 'BLOCK', label: '新规则', patterns: ['词一', '词一', ' 词二 ', ''], advice: '' });
  assert.strictEqual(ok.ok, true);
  assert.ok(ok.rule.id.startsWith('c_'));
  assert.deepStrictEqual(ok.rule.patterns, ['词一', '词二'], '去重去空');
  assert.strictEqual(S.buildCustomRule({ severity: 'BLOCK', label: '', patterns: ['词'] }).ok, false);
  assert.strictEqual(S.buildCustomRule({ severity: 'BLOCK', label: '单字', patterns: ['a'] }).ok, false);
  assert.strictEqual(S.buildCustomRule({ severity: 'BAD', label: '级别', patterns: ['词'] }).ok, false);
});

// ───────── 三档凭证精修（#059《办法》第十七/十六条） ─────────
test('classifyFiling：一类=发行许可证+资质+20日', () => {
  const r = S.classifyFiling({ isAI: false, investWan: 400 });
  assert.strictEqual(r.cls, 'I');
  assert.strictEqual(r.certType, 'LICENSE');
  assert.ok(r.certName.includes('微短剧发行许可证'));
  assert.strictEqual(r.qualRequired, true);
  assert.strictEqual(r.reviewDays, 20);
  assert.strictEqual(r.needLicense, true, 'needLicense 向后兼容');
  assert.strictEqual(r.canVoluntaryUp, false);
});
test('classifyFiling：二类=省级批准文件（非许可证）', () => {
  const r = S.classifyFiling({ isAI: false, investWan: 150 });
  assert.strictEqual(r.cls, 'II');
  assert.strictEqual(r.certType, 'APPROVAL');
  assert.ok(r.certName.includes('批准文件'));
  assert.strictEqual(r.needLicense, false);
  assert.strictEqual(r.qualRequired, false);
  assert.strictEqual(r.canVoluntaryUp, true);
});
test('classifyFiling：三类=平台节目编号；未填投资额暂按三类', () => {
  const r3 = S.classifyFiling({ isAI: true, investWan: 10 });
  assert.strictEqual(r3.cls, 'III'); assert.strictEqual(r3.certType, 'PROGRAM_NO');
  assert.ok(r3.certName.includes('节目编号'));
  const rp = S.classifyFiling({ isAI: true });
  assert.strictEqual(rp.cls, 'III'); assert.strictEqual(rp.certType, 'PROGRAM_NO');
  assert.ok(rp.name.includes('待评估'));
});
test('filingChangeImpact：改主角定位/整体走向须重新备案', () => {
  assert.strictEqual(S.filingChangeImpact({ changedMainCharacter: true }, 'I').level, 'REFILE');
  assert.strictEqual(S.filingChangeImpact({ changedStoryDirection: true }, 'II').refileRequired, true);
  assert.strictEqual(S.filingChangeImpact({ changedTitle: true }, 'I').level, 'ALTER');
  assert.strictEqual(S.filingChangeImpact({ changedProducer: true }, 'I').refileRequired, false);
  assert.strictEqual(S.filingChangeImpact({}, 'I').level, 'NONE');
  // 三类平台自审，无需行政重备
  assert.strictEqual(S.filingChangeImpact({ changedStoryDirection: true }, 'III').level, 'NONE');
});
