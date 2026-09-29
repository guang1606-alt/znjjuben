const test = require('node:test');
const assert = require('node:assert');
const P = require('../dist/engine/fix-playbook.js');
const { buildFixPrompt } = require('../dist/engine/polish-fix.js');

test('c220 兵法库：已收录规则返回三要素完整结构', () => {
  const p = P.getFixPlaybook('faintOnCue', 'zh');
  assert.ok(p, 'faintOnCue 应有兵法');
  assert.ok(typeof p.cliche === 'string' && p.cliche.length > 5, 'cliche 为非空字符串');
  assert.ok(Array.isArray(p.moves) && p.moves.length >= 2, 'moves 至少 2 条');
  p.moves.forEach((m) => assert.ok(m.length >= 8, '每条手法需具体（≥8字），不得是空话'));
  assert.ok(typeof p.win === 'string' && p.win.length > 5, 'win 为非空字符串');
});

test('c220 兵法库：未收录规则返回 null（通用提示兜底，不硬编）', () => {
  assert.strictEqual(P.getFixPlaybook('notARealRule_xyz', 'zh'), null);
  assert.strictEqual(P.getFixPlaybook('', 'zh'), null);
  assert.strictEqual(P.buildPlaybookBlock('notARealRule_xyz', 'zh'), '');
});

test('c220 兵法库：别名规则映射到同一条兵法', () => {
  assert.ok(P.getFixPlaybook('misunderstandingDrag', 'zh'), 'misunderstandingDrag 应映射 misunderstanding');
  assert.strictEqual(
    P.buildPlaybookBlock('misunderstandingDrag', 'zh'),
    P.buildPlaybookBlock('misunderstanding', 'zh'),
    '别名与正名产出同一兵法块',
  );
  assert.ok(P.getFixPlaybook('softSceneEnding', 'zh'), 'softSceneEnding 应映射 sceneSoftEnding');
});

test('c220 兵法库：双语兵法块均含三段标题且语言正确', () => {
  const zh = P.buildPlaybookBlock('cliche', 'zh');
  assert.match(zh, /【专科改写兵法】/, '中文块含标题');
  assert.match(zh, /病灶识别/, '含病灶段');
  assert.match(zh, /改写手法/, '含手法段');
  assert.match(zh, /改完自检/, '含验收段');
  assert.match(zh, /[一-鿿]/, '中文块含中文');

  const en = P.buildPlaybookBlock('cliche', 'en');
  assert.match(en, /Specialty playbook/, '英文块含标题');
  assert.match(en, /Rewrite moves/, '含手法段');
  assert.match(en, /Acceptance test/, '含验收段');
  assert.doesNotMatch(en, /[一-鿿]/, '英文块不得混入汉字');
});

test('c220/c221 数据完整性：每条收录条目字段齐全且非空，c221 扩库四族双语齐', () => {
  assert.ok(P.PLAYBOOK_RULE_COUNT >= 120, `兵法至少覆盖 120 条高频规则，实际 ${P.PLAYBOOK_RULE_COUNT}`);
  // c220 五大家族 + c221 扩库（叙事/阀门/生理开关/和解）代表键双语覆盖
  ['dialogueAiTaste', 'echoDialogue', 'instantTrust', 'commFailCrutch',
   'scenePadding', 'plotArmor', 'cliche', 'tongue', 'grounded', 'lengthPlan',
   'sceneEmotionFlat', 'crowdReaction', 'effortGloss', 'recordsOnDemand',
   'alwaysLate', 'instantEscape', 'rumorSpeed', 'feverTruth',
   'paralysisOnCue', 'pregnancyOnCue', 'fatigueOverdrive',
   'apologyLoop', 'instantRepentance', 'crowdFlip'].forEach((r) => {
    assert.ok(P.getFixPlaybook(r, 'zh'), `${r} 缺中文兵法`);
    assert.ok(P.getFixPlaybook(r, 'en'), `${r} 缺英文兵法`);
  });
});

test('c220 buildFixPrompt：已收录规则注入兵法块，未收录规则干净降级', () => {
  const withPb = buildFixPrompt(
    '原稿正文'.repeat(100),
    { rule: 'faintOnCue', dimLabel: '巧合阀门', advice: '冲突时晕倒' },
    { lang: 'zh' },
  );
  assert.match(withPb, /【专科改写兵法】/, '已收录规则的 prompt 必须注入兵法');
  assert.match(withPb, /病灶识别/, '注入内容含病灶识别');

  const enWith = buildFixPrompt(
    'original '.repeat(50),
    { rule: 'cliche', dimLabel: 'Cliche', advice: 'cliche beat' },
    { lang: 'en' },
  );
  assert.match(enWith, /Specialty playbook/, '英文 prompt 注入英文兵法');

  const without = buildFixPrompt(
    '原稿正文'.repeat(100),
    { rule: 'unknown_rule', dimLabel: '其他', advice: '随便改改' },
    { lang: 'zh' },
  );
  assert.doesNotMatch(without, /【专科改写兵法】/, '未收录规则不得出现兵法标题（空串被过滤）');
  assert.match(without, /必须解决的问题：随便改改/, '通用 advice 仍保留');
});

test('c220 兵法块 token 纪律：单块注入内容控制在合理体量', () => {
  // 付费润色链路：兵法块是额外 token，单条 ≤ 220 字，防止喧宾夺主
  const keys = ['dialogueAiTaste', 'scenePadding', 'villainStall', 'lengthPlan'];
  keys.forEach((k) => {
    const block = P.buildPlaybookBlock(k, 'zh');
    assert.ok(block.length <= 260, `${k} 兵法块 ${block.length} 字超过体量上限`);
  });
});
