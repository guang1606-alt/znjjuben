'use strict';
// v2.80 人物状态跨集台账测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { characterStateLedger, CHAR_STATE_META } = require('../dist/engine/character-state-ledger.js');

const CJK = /[\u4e00-\u9fff]/;

test('人物状态隔离：另一人物生产不能消掉原人物的怀孕', () => {
  const first = characterStateLedger('林晚怀孕了。');
  const second = characterStateLedger('王丽顺产生下一个孩子。', first.nextState);
  assert.strictEqual(second.nextState.onsets.length, 1);
  assert.strictEqual(second.nextState.onsets[0].character, '林晚');
  assert.strictEqual(second.unresolved.length, 1);
  assert.ok(second.issues.some(i => i.type === 'bridge_without_onset'));
});

test('同一人物再次触发已解决的状态仍应入账', () => {
  const first = characterStateLedger('林晚怀孕了。');
  const second = characterStateLedger('林晚顺产生下一个孩子。', first.nextState);
  assert.strictEqual(second.nextState.onsets.length, 0);
  const third = characterStateLedger('林晚再次怀孕了。', second.nextState);
  assert.strictEqual(third.nextState.onsets.length, 1);
  assert.strictEqual(third.nextState.onsets[0].character, '林晚');
  assert.strictEqual(third.nextState.onsets[0].onsetInEp, 3);
  assert.ok(!third.nextState.resolved.includes('pregnant'));
});

test('具名双人状态在同一行分别入账，桥接只消掉对应人物', () => {
  const first = characterStateLedger('林晚怀孕了，王丽也怀孕了。', null, 'zh', ['林晚', '王丽']);
  assert.strictEqual(first.nextState.onsets.length, 2);
  const second = characterStateLedger('王丽生下孩子。', first.nextState, 'zh', ['林晚', '王丽']);
  assert.deepStrictEqual(second.nextState.onsets.map(o => o.character), ['林晚']);
});

test('顺序台账允许本集先恢复后再次失忆，并保留最早未解决 onset', () => {
  const first = characterStateLedger('林晚失忆了。', null, 'zh', ['林晚']);
  const second = characterStateLedger('林晚恢复记忆。\n林晚再次失忆了。', first.nextState, 'zh', ['林晚']);
  assert.strictEqual(second.nextState.onsets.length, 1);
  assert.strictEqual(second.nextState.onsets[0].onsetInEp, 2);
  const third = characterStateLedger('林晚仍然失忆。', second.nextState, 'zh', ['林晚']);
  assert.strictEqual(third.nextState.onsets.length, 1);
  assert.strictEqual(third.nextState.onsets[0].onsetInEp, 2);
});

test('同一分句的状态恢复后再发生应保留最后状态，复合桥接只计一次', () => {
  const repeated = characterStateLedger('林晚失忆后恢复记忆又失忆了。', null, 'zh', ['林晚']);
  assert.strictEqual(repeated.onsets.length, 2);
  assert.strictEqual(repeated.nextState.onsets.length, 1);
  assert.strictEqual(repeated.nextState.onsets[0].character, '林晚');
  assert.strictEqual(repeated.nextState.onsets[0].state, 'memory_loss');
  assert.ok(!repeated.nextState.resolved.includes('memory_loss'));
  const pregnancy = characterStateLedger('林晚怀孕了。', null, 'zh', ['林晚']);
  const birth = characterStateLedger('林晚顺产生下孩子。', pregnancy.nextState, 'zh', ['林晚']);
  assert.strictEqual(birth.bridges.length, 1);
  assert.strictEqual(birth.nextState.onsets.length, 0);
  assert.ok(!birth.issues.some(i => i.type === 'bridge_without_onset'));
});

test('英文人物隔离与旧台账兼容：历史 resolved 不阻止新 onset', () => {
  const first = characterStateLedger('Anna is pregnant.', null, 'en', ['Anna', 'Beth']);
  const second = characterStateLedger('Beth gave birth.', first.nextState, 'en', ['Anna', 'Beth']);
  assert.strictEqual(second.unresolved.length, 1);
  assert.strictEqual(second.unresolved[0].character, 'Anna');
  const legacy = characterStateLedger('Anna is pregnant.', { onsets: [], resolved: ['pregnant'], epNo: 6 }, 'en', ['Anna']);
  assert.strictEqual(legacy.nextState.onsets[0].onsetInEp, 7);
});

// —— 中文：首集立起怀孕状态 ——
const ZH_EP1 = `场景一 医院 日
医生：她怀孕了，两个月。
林晚：这个孩子……先别让赵家知道。`;

// —— 无桥接的过场集 ——
const ZH_EP2 = `场景一 公司 日
林晚：这个项目必须拿下。
赵天成：交给我。`;

// —— 桥接集：孩子出生，状态闭环 ——
const ZH_BRIDGE = `场景一 产房 日
旁白：孩子平安出生，母子均安。
林晚：他哭了。`;

test('ZH 首集：onset 入账，无跨集悬空，nextState 记账', () => {
  const r = characterStateLedger(ZH_EP1);
  assert.strictEqual(r.onsets.length, 1);
  assert.strictEqual(r.onsets[0].state, 'pregnant');
  assert.strictEqual(r.bridges.length, 0);
  assert.strictEqual(r.unresolved.length, 0, '首集无 prev，不判悬空');
  assert.strictEqual(r.nextState.epNo, 1);
  assert.strictEqual(r.nextState.onsets[0].state, 'pregnant');
  assert.strictEqual(r.nextState.onsets[0].onsetInEp, 1);
});

test('ZH 悬空分级：age1 low / age2 mid / age4 high（跨集链）', () => {
  const r1 = characterStateLedger(ZH_EP1);
  const r2 = characterStateLedger(ZH_EP2, r1.nextState); // ageEp=1
  assert.strictEqual(r2.unresolved.length, 1);
  assert.strictEqual(r2.issues[0].severity, 'low');
  const r3 = characterStateLedger(ZH_EP2, r2.nextState); // ageEp=2
  assert.strictEqual(r3.issues[0].severity, 'mid');
  const r5 = characterStateLedger(ZH_EP2, { onsets: r3.nextState.onsets, resolved: [], epNo: 4 }); // ageEp=4
  assert.strictEqual(r5.issues[0].severity, 'high');
  assert.ok(r5.score < r3.score);
});

test('ZH 生死不明封顶 mid：诈死是合法套路，age4 也只到 mid', () => {
  const prev = {
    onsets: [{ state: 'presumed_dead', onsetInEp: 1, snippet: '她坠崖了' }],
    resolved: [], epNo: 4,
  };
  const r = characterStateLedger(ZH_EP2, prev); // ageEp=4
  assert.strictEqual(r.unresolved[0].state, 'presumed_dead');
  const issue = r.issues.find((i) => i.type === 'state_unresolved');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 闭环：onset→bridge 后 unresolved 清零、出池、闭环加分', () => {
  const r1 = characterStateLedger(ZH_EP1);
  const r2 = characterStateLedger(ZH_BRIDGE, r1.nextState);
  assert.strictEqual(r2.bridges.length, 1);
  assert.strictEqual(r2.bridges[0].state, 'pregnant');
  assert.strictEqual(r2.unresolved.length, 0);
  assert.ok(r2.nextState.resolved.includes('pregnant'));
  assert.strictEqual(r2.nextState.onsets.length, 0, '已桥接状态移出待收池');
  assert.strictEqual(r2.score, 100);
  assert.strictEqual(r2.issues.length, 0);
});

test('ZH 凭空恢复：只有出狱桥接从无入狱 onset → bridge_without_onset mid', () => {
  const t = `场景一 家门 日
旁白：赵天成出狱了，站在家门口却不敢敲门。
林晚：你回来了。`;
  const r = characterStateLedger(t);
  const issue = r.issues.find((i) => i.type === 'bridge_without_onset');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.strictEqual(issue.evidence.includes('出狱'), true);
});

test('ZH 多状态并行：两个悬空状态各自计龄', () => {
  const prev = {
    onsets: [
      { state: 'jailed', onsetInEp: 2, snippet: '他被捕了' },
      { state: 'coma', onsetInEp: 3, snippet: '他昏迷不醒' },
    ],
    resolved: [], epNo: 3,
  };
  const r = characterStateLedger(ZH_EP2, prev); // curEp=4：jailed age2 / coma age1
  assert.strictEqual(r.unresolved.length, 2);
  const jailed = r.unresolved.find((u) => u.state === 'jailed');
  const coma = r.unresolved.find((u) => u.state === 'coma');
  assert.strictEqual(jailed.ageEp, 2);
  assert.strictEqual(coma.ageEp, 1);
  assert.strictEqual(jailed.stateLabel, '入狱');
  assert.strictEqual(coma.stateLabel, '昏迷');
});

test('EN 层：onset/bridge/悬空判定，issue 文案零中文，label 用英文', () => {
  const en1 = `Scene 1. Hospital - Day
Doctor: She is pregnant. Two months along.
Anna: Nobody can know. Not yet.`;
  const r1 = characterStateLedger(en1, null, 'en');
  assert.strictEqual(r1.onsets[0].state, 'pregnant');

  const en2 = `Scene 1. Office - Day
Anna: We close this deal today.
Victor: Leave it to me.`;
  const r2 = characterStateLedger(en2, r1.nextState, 'en'); // ageEp=1 low
  assert.strictEqual(r2.unresolved.length, 1);
  assert.strictEqual(r2.unresolved[0].labelEn, 'pregnancy');
  for (const i of r2.issues) {
    assert.ok(!CJK.test(i.evidence), `evidence 含中文: ${i.evidence}`);
    assert.ok(!CJK.test(i.advice), `advice 含中文: ${i.advice}`);
  }

  const en3 = `Scene 1. Ward - Day
Anna: She gave birth to a healthy boy.
Victor: Finally.`;
  const r3 = characterStateLedger(en3, r2.nextState, 'en');
  assert.strictEqual(r3.bridges[0].state, 'pregnant');
  assert.strictEqual(r3.unresolved.length, 0);
  assert.strictEqual(r3.score, 100);
});

test('字段边界：空文本/状态枚举完整/severity 排序', () => {
  const r0 = characterStateLedger('');
  assert.strictEqual(r0.onsets.length, 0);
  assert.strictEqual(r0.score, 100);
  assert.strictEqual(Object.keys(CHAR_STATE_META).length, 6);
  const r1 = characterStateLedger(ZH_EP1);
  const order = { high: 0, mid: 1, low: 2 };
  for (let i = 1; i < r1.issues.length; i++) {
    assert.ok(order[r1.issues[i - 1].severity] <= order[r1.issues[i].severity]);
  }
});
