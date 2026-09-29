'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { terminalDiagnosisOnCue } = require('../dist/engine/terminal-diagnosis-on-cue.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(terminalDiagnosisOnCue('').score, 100);
  assert.strictEqual(terminalDiagnosisOnCue('  \n ').score, 100);
  assert.strictEqual(terminalDiagnosisOnCue('').hitCount, 0);
});

test('zh: 单次绝症宣判（STRONG 直配）豁免不扣分', () => {
  const draft = [
    '内景 医院走廊 日',
    '△医生神情凝重地走出来。',
    '△诊断书：癌症晚期，只剩三个月。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次绝症宣判未救 → 70，元数据落死刑行', () => {
  const draft = [
    '内景 林家 夜',
    '△医生坐在对面，叹了口气说。',
    '△他确诊了，癌症晚期，只剩三个月。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△第二份诊断书递到她手里。',
    '△胰腺癌晚期，时日无多。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.sceneIndex, 0);
  assert.ok(h.sceneHeader.includes('林家'));
  assert.ok(h.snippet.includes('胰腺癌'));
  assert.ok(h.marker.includes('→'));
  assert.strictEqual(h.kind, 'verdict');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('一纸判决'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('活检'));
});

test('zh: verdict 被 SECOND 复查/第二家医院/活检救回', () => {
  const draft = [
    '内景 医院 日',
    '△医生把诊断书放在桌上说。',
    '△确诊恶性肿瘤，只剩半年光景。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△她带着片子去第二家医院做活检。',
    '△病理报告确认：淋巴瘤晚期。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: verdict 被 PROCESS 化疗治疗过程救回', () => {
  const draft = [
    '内景 诊室 日',
    '△主任医生递来诊断书宣布。',
    '△肺癌晚期，只剩四个月。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△主任医生告诉他检查结果后说。',
    '△肺癌晚期，他下周开始化疗。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'verdict');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: verdict 被 PRICE 转移/死亡真兑付救回', () => {
  const draft = [
    '内景 老屋 夜',
    '△诊断书送来了，医生通知家属。',
    '△绝症，时日无多。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△新的诊断书出来了。',
    '△胰腺癌晚期，癌细胞已经转移，秋天时他走了。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: "保持乐观可能有转机"预后安慰不救 → 70', () => {
  const draft = [
    '内景 病房 夜',
    '△医生拿着诊断书宣布。',
    '△白血病晚期。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△又一张诊断书摊开，医生说保持乐观，可能还有转机。',
    '△她被确诊为绝症。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

test('zh: WEAK 坏消息无医学语境——日常不乐观放行', () => {
  const draft = [
    '内景 办公室 日',
    '△体检报告甩在桌上。',
    '△情况不太乐观。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: WEAK 坏消息 + 医生化验单语境兜底——事件成立（首次豁免）', () => {
  const draft = [
    '内景 诊室 日',
    '△医生把化验结果递过来。',
    '△检查结果出来了，情况不太乐观。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯住院观察无死刑结果锚放行', () => {
  const draft = [
    '内景 病房 日',
    '△医生查了房说。',
    '△他得住院观察一周。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 单次误诊秒痊愈（型B）豁免不扣分', () => {
  const draft = [
    '内景 病房 日',
    '△她冲进来大喊，原来是误诊！',
    '△他的病全好了，健健康康。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('zh: 第2次误诊秒痊愈未救 → 70，kind=reprieve', () => {
  const draft = [
    '内景 医院 日',
    '△医院打来电话说，报告拿错了。',
    '△癌细胞消失了，他完全康复。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△医生宣布是误诊。',
    '△肿瘤消失，她没事了。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  const h = r.hits[0];
  assert.strictEqual(h.line, 7);
  assert.strictEqual(h.kind, 'reprieve');
  assert.strictEqual(h.rescued, false);
  assert.ok(h.reason.includes('秒撤回'));
  assert.strictEqual(r.score, 70);
  assert.ok(r.advice[0].includes('骨髓移植'));
});

test('zh: reprieve 被 RPROCESS 骨髓移植/半年化疗救回', () => {
  const draft = [
    '内景 医院 日',
    '△原来一切都是误诊。',
    '△他痊愈了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△医生解释这是误诊，骨髓移植后治疗了半年。',
    '△他完全康复，癌细胞清零。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'reprieve');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: reprieve 被 PARTIAL 带瘤生存/仍需复查救回', () => {
  const draft = [
    '内景 诊室 日',
    '△医生打来电话，配型突然成功。',
    '△他痊愈了。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△国外新药有了消息。',
    '△他没事了，但要带瘤生存，仍需定期复查。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: reprieve 被 COST 倾家荡产代价救回', () => {
  const draft = [
    '内景 家中 夜',
    '△报告拿错了。',
    '△他完全康复。',
    '△墙角堆着几个纸箱。',
    '△窗台上落着一层灰。',
    '△医生说，是误诊。',
    '△她痊愈了，可为了买进口特效药，全家倾家荡产。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('zh: 无触发物的缓慢好转放行（合法恢复）', () => {
  const draft = [
    '内景 家中 春',
    '△经过一年休养，他的身体慢慢好了起来。',
    '△她终于放下心来。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头不配对——诊断在一场死刑在下一场放行', () => {
  const draft = [
    '内景 医院 日',
    '△医生拿出诊断书说。',
    '内景 家中 夜',
    '△癌症晚期，只剩三个月。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 相邻诊断锚行合并为同一事件', () => {
  const draft = [
    '内景 诊室 日',
    '△医生通知了家属。',
    '△诊断书也开了出来。',
    '△绝症，只剩一个月。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 普通探望病人无绝症放行', () => {
  const draft = [
    '内景 住院部 日',
    '△她提着水果去医院探望。',
    '△同事的病很快就会好。',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* ============ English ============ */

test('en: no medical verdict anchor → clean 100', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'The quarterly results were not looking good at all.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: single terminal verdict (STRONG) exempt', () => {
  const draft = [
    'INT. HOSPITAL - DAY',
    'The doctor closed the chart and told them.',
    'Terminal pancreatic cancer. He had only three months to live.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second unrescued verdict → 70, kind=verdict', () => {
  const draft = [
    'INT. LIN HOME - NIGHT',
    'The doctor closed the chart and told them.',
    'Terminal cancer. He had only three months to live.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'She held the new medical report.',
    'Stage four lymphoma, the oncologist said.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 7);
  assert.strictEqual(r.hits[0].kind, 'verdict');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: verdict rescued by another hospital + biopsy (SECOND)', () => {
  const draft = [
    'INT. HOSPITAL - DAY',
    'The doctor closed the chart and told them.',
    'Terminal cancer. He had only three months to live.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'They transferred to another hospital for a biopsy.',
    'The pathology report confirmed advanced cancer, only six months.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK bad news without medical context → pass', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'The quarterly figures were not optimistic at all.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: WEAK bad news + doctor/test results context → event, exempt', () => {
  const draft = [
    'INT. CLINIC - DAY',
    'The doctor called them in with the test results.',
    'The condition was serious, a growth on the scan.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second reprieve rescued by transplant + months of chemo', () => {
  const draft = [
    'INT. WARD - DAY',
    'It was a misdiagnosis!',
    'He was cancer-free, fully recovered.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The lab admitted the wrong results, after a bone marrow transplant and months of chemotherapy.',
    'He made a full recovery.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.hits[0].kind, 'reprieve');
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('en: second miracle-cure reprieve unrescued → 70', () => {
  const draft = [
    'INT. WARD - DAY',
    'It was a misdiagnosis!',
    'He was cancer-free, fully recovered.',
    'Paint peeled from the window frame.',
    'A neon sign buzzed outside.',
    'The miracle drug arrived from abroad.',
    'The tumor was gone, she was healthy again.',
  ].join('\n');
  const r = terminalDiagnosisOnCue(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].kind, 'reprieve');
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});
