'use strict';
// v2.80 全剧装置疲劳分析测试（中英双语，输入与 emotion-wave WavePoint 同构）
const test = require('node:test');
const assert = require('node:assert');
const { deviceFatigue, fatigueDirective } = require('../dist/engine/device-fatigue.js');

const CJK = /[\u4e00-\u9fff]/;

/** 构造逐集输入：与 emotion-wave points 映射后的形态一致 */
function mk(ep, reversalId, payoffIds = [], emotionHead = 'emo_burst') {
  return { ep, reversalId: reversalId ?? null, payoffIds, emotionPath: [emotionHead] };
}

test('样本不足 3 集不出问题：2 集同反转不报', () => {
  const r = deviceFatigue([mk(1, 'rev_identity'), mk(2, 'rev_identity')]);
  assert.strictEqual(r.epCount, 2);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
  assert.ok(r.runs.some((x) => x.kind === 'reversal' && x.run === 2), '连续段仍应记录');
});

test('健康剧：装置轮换充分 → 零 issue 满分', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_stance', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_truefalse', ['pay_sweet'], 'emo_warmth'),
    mk(4, 'rev_cause', ['pay_crush', 'pay_truth'], 'emo_release'),
  ];
  const r = deviceFatigue(eps);
  assert.strictEqual(r.issues.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.shares.length, 5);
});

test('反转连用 3 集 → reversal_run mid；4 集 → high + 轮换建议', () => {
  const eps3 = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_identity', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_identity', ['pay_sweet'], 'emo_warmth'),
  ];
  const r3 = deviceFatigue(eps3);
  const i3 = r3.issues.find((i) => i.type === 'reversal_run');
  assert.ok(i3);
  assert.strictEqual(i3.severity, 'mid');
  assert.ok(i3.evidence.includes('身份反转'));
  assert.strictEqual(r3.rotations.length, 1);
  assert.strictEqual(r3.rotations[0].kind, 'reversal');
  assert.strictEqual(r3.rotations[0].currentId, 'rev_identity');
  assert.ok(!r3.rotations[0].suggestIds.includes('rev_identity'));
  assert.strictEqual(r3.rotations[0].suggestIds.length, 2);

  const eps4 = [
    mk(1, 'rev_friendfoe', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_friendfoe', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_friendfoe', ['pay_sweet'], 'emo_warmth'),
    mk(4, 'rev_friendfoe', ['pay_crush'], 'emo_release'),
  ];
  const r4 = deviceFatigue(eps4);
  const i4 = r4.issues.find((i) => i.type === 'reversal_run');
  assert.ok(i4);
  assert.strictEqual(i4.severity, 'high');
  assert.ok(r4.score < r3.score);
});

test('爽点连用 3 集 → payoff_monotone；中断后重新计数', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_stance', ['pay_faceslap'], 'emo_burst'),
    mk(3, 'rev_cause', ['pay_faceslap'], 'emo_warmth'),
    mk(4, 'rev_truefalse', ['pay_counter'], 'emo_release'),
  ];
  const r = deviceFatigue(eps);
  const issue = r.issues.find((i) => i.type === 'payoff_monotone');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.ok(r.runs.some((x) => x.kind === 'payoff' && x.id === 'pay_faceslap' && x.run === 3));
});

test('单一爽点占比 >60%（4/5 集）→ payoff_monotone 占比型', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap', 'pay_counter'], 'emo_suppress'),
    mk(2, 'rev_stance', ['pay_faceslap', 'pay_sweet'], 'emo_burst'),
    mk(3, 'rev_cause', ['pay_faceslap', 'pay_truth'], 'emo_warmth'),
    mk(4, 'rev_truefalse', ['pay_counter', 'pay_sweet'], 'emo_release'),
    mk(5, 'rev_timeline', ['pay_faceslap', 'pay_karma'], 'emo_hype'),
  ];
  const r = deviceFatigue(eps);
  const ratioIssue = r.issues.find((i) => i.type === 'payoff_monotone' && i.evidence.includes('80%'));
  assert.ok(ratioIssue, `应有占比型 issue：${JSON.stringify(r.issues.map((i) => i.evidence))}`);
  const share = r.shares.find((s) => s.id === 'pay_faceslap');
  assert.strictEqual(share.count, 4);
  assert.strictEqual(share.ratio, 0.8);
});

test('情绪主轴连用 3 集 → emotion_run', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_stance', ['pay_counter'], 'emo_suppress'),
    mk(3, 'rev_cause', ['pay_sweet'], 'emo_suppress'),
  ];
  const r = deviceFatigue(eps);
  const issue = r.issues.find((i) => i.type === 'emotion_run');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.ok(issue.evidence.includes('憋屈蓄力'));
});

test('爽点种类不足：4 集仅 2 种 → payoff_variety_low', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_stance', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_cause', ['pay_faceslap'], 'emo_warmth'),
    mk(4, 'rev_truefalse', ['pay_counter'], 'emo_release'),
  ];
  const r = deviceFatigue(eps);
  const issue = r.issues.find((i) => i.type === 'payoff_variety_low');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.ok(issue.evidence.includes('2 种'));
});

test('乱序输入自动按 ep 排序，不影响连续段判定', () => {
  const eps = [
    mk(3, 'rev_identity', ['pay_sweet'], 'emo_warmth'),
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_identity', ['pay_counter'], 'emo_burst'),
  ];
  const r = deviceFatigue(eps);
  assert.strictEqual(r.epCount, 3);
  assert.ok(r.issues.some((i) => i.type === 'reversal_run'));
});

test('EN 层：issue/rotation 建议零中文，装置名用英文表', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_identity', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_identity', ['pay_sweet'], 'emo_warmth'),
    mk(4, 'rev_identity', ['pay_crush'], 'emo_release'),
  ];
  const r = deviceFatigue(eps, 'en');
  assert.ok(r.issues.length >= 1);
  for (const i of r.issues) {
    assert.ok(!CJK.test(i.evidence), `evidence 含中文: ${i.evidence}`);
    assert.ok(!CJK.test(i.advice), `advice 含中文: ${i.advice}`);
  }
  for (const rot of r.rotations) {
    for (const n of rot.suggestNames) assert.ok(!CJK.test(n), `suggestNames 含中文: ${n}`);
  }
  const rev = r.issues.find((i) => i.type === 'reversal_run');
  assert.ok(rev.evidence.includes('consecutive'));
});

test('字段边界：空数组/shares 排序/score 范围', () => {
  const r0 = deviceFatigue([]);
  assert.strictEqual(r0.epCount, 0);
  assert.strictEqual(r0.score, 100);
  assert.strictEqual(r0.issues.length, 0);
  const r1 = deviceFatigue([
    mk(1, 'rev_identity', ['pay_faceslap', 'pay_faceslap'], 'emo_burst'),
    mk(2, 'rev_stance', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_cause', ['pay_sweet'], 'emo_warmth'),
  ]);
  assert.ok(r1.score >= 0 && r1.score <= 100);
  // shares 按次数降序
  for (let i = 1; i < r1.shares.length; i++) {
    assert.ok(r1.shares[i - 1].count >= r1.shares[i].count);
  }
});

// —— v2.80 生成侧注入：fatigueDirective（架构师布点约束，与 continuityBrief 同构） ——

test('fatigueDirective：无疲劳信号（<3集/零issue/空数组）→ 双语均为空串', () => {
  assert.deepStrictEqual(fatigueDirective([]), { zh: '', en: '' });
  assert.deepStrictEqual(fatigueDirective([mk(1, 'rev_identity'), mk(2, 'rev_identity')]), { zh: '', en: '' });
  const healthy = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_stance', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_truefalse', ['pay_sweet'], 'emo_warmth'),
  ];
  assert.deepStrictEqual(fatigueDirective(healthy), { zh: '', en: '' });
});

test('fatigueDirective：有 issue → 中文指令含头/证据/建议/轮换候选', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_identity', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_identity', ['pay_sweet'], 'emo_warmth'),
  ];
  const d = fatigueDirective(eps);
  assert.ok(d.zh.startsWith('【装置防疲劳·本集布点约束】'));
  assert.ok(d.zh.includes('身份反转'), `应含装置中文名: ${d.zh}`);
  assert.ok(d.zh.includes('优先轮换'), `应含轮换候选行: ${d.zh}`);
  assert.ok(d.zh.includes('；'), '证据与建议应以中文分号连接');
  // 行格式：issue 行 "  - evidence；advice"
  assert.ok(d.zh.includes('\n  - 反转装置「身份反转」连续 3 集使用（第1-3集）；'), d.zh);
});

test('fatigueDirective：EN 指令零中文，结构与中文对齐', () => {
  const eps = [
    mk(1, 'rev_identity', ['pay_faceslap'], 'emo_suppress'),
    mk(2, 'rev_identity', ['pay_counter'], 'emo_burst'),
    mk(3, 'rev_identity', ['pay_sweet'], 'emo_warmth'),
    mk(4, 'rev_identity', ['pay_crush'], 'emo_release'),
  ];
  const d = fatigueDirective(eps);
  assert.ok(d.zh.startsWith('【装置防疲劳·本集布点约束】'));
  assert.ok(d.en.startsWith('[Device fatigue guard — beat constraints for this episode]'));
  assert.ok(!CJK.test(d.en), `EN 指令含中文: ${d.en}`);
  assert.ok(d.en.includes('consecutive'));
  assert.ok(d.en.includes('prefer: '), 'EN 轮换候选行应含 prefer');
  // 行数对齐：头 + issue 行 + 轮换行，双语一致
  assert.strictEqual(d.zh.split('\n').length, d.en.split('\n').length);
  assert.ok(d.zh.endsWith('\n') && d.en.endsWith('\n'), '指令应以换行结尾便于拼接');
});
