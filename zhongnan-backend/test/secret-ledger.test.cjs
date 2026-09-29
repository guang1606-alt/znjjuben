'use strict';
// v2.80 跨集信息差台账测试（中英双语离线启发式）
const test = require('node:test');
const assert = require('node:assert');
const { secretLedger } = require('../dist/engine/secret-ledger.js');

const CJK = /[\u4e00-\u9fff]/;

// —— 中文：首集植入身世秘密（瞒着）——
const ZH_EP1 = `场景一 老宅 夜
母亲：你的身世我瞒了你二十年，不能再瞒了。
林晚：什么叫不能再瞒？
母亲：这件事烂在肚子里才是保护你。`;

// —— 第二集：秘密仍在瞒（未到悬空阈值）——
const ZH_EP2 = `场景一 公司 日
林晚：妈到底想说什么。
赵天成：别多想，先忙项目。`;

// —— 第三集：仍未揭示 → 悬空 ageEp=2 ——
const ZH_EP3 = `场景一 咖啡厅 日
林晚：我总觉得家里有事瞒着我。
赵天成：回趟老家就知道了。`;

// —— 揭示集：身世当众揭穿 ——
const ZH_REVEAL = `场景一 发布会 日
赵天成：今天我把真相当众揭穿，她的身世我调查清楚了。
林晚：你居然当众揭穿？`;

// —— 揭示后又当秘密写：揭示失忆 ——
const ZH_AMNESIA = `场景一 客厅 夜
母亲：你的身世我还是瞒着吧，时机未到。
林晚：都这时候了还瞒着？`;

test('ZH 首集：识别植入事件，无悬空，nextState 记账 epNo=1', () => {
  const r = secretLedger(ZH_EP1);
  assert.strictEqual(r.plants.length, 1);
  assert.strictEqual(r.plants[0].topic, '身世');
  assert.strictEqual(r.reveals.length, 0);
  assert.strictEqual(r.dangling.length, 0);
  assert.strictEqual(r.nextState.epNo, 1);
  assert.strictEqual(r.nextState.plants[0].plantedInEp, 1);
  assert.strictEqual(r.nextState.revealedTopics.length, 0);
  assert.ok(r.score >= 0 && r.score <= 100);
});

test('ZH 跨集链：ep2 ageEp=1 不悬空，ep3 ageEp=2 悬空 mid', () => {
  const r1 = secretLedger(ZH_EP1);
  const r2 = secretLedger(ZH_EP2, r1.nextState);
  assert.strictEqual(r2.nextState.epNo, 2);
  assert.strictEqual(r2.dangling.length, 0);
  const r3 = secretLedger(ZH_EP3, r2.nextState);
  assert.strictEqual(r3.dangling.length, 1);
  assert.strictEqual(r3.dangling[0].topic, '身世');
  assert.strictEqual(r3.dangling[0].plantedInEp, 1);
  assert.strictEqual(r3.dangling[0].ageEp, 2);
  const issue = r3.issues.find((i) => i.type === 'secret_dangling');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
});

test('ZH 揭示：revealedTopics 入账，待收池出池，跨集不再悬空', () => {
  const r1 = secretLedger(ZH_EP1);
  const r2 = secretLedger(ZH_REVEAL, r1.nextState);
  assert.strictEqual(r2.reveals.length, 1);
  assert.ok(r2.nextState.revealedTopics.includes('身世'));
  assert.strictEqual(r2.nextState.plants.length, 0, '已揭示主题应移出待收池');
  const r3 = secretLedger(ZH_EP3, r2.nextState);
  assert.strictEqual(r3.dangling.length, 0, '已揭示主题不再判悬空');
});

test('ZH 揭示失忆：已揭穿主题又写瞒着 → mid；两主题 → high', () => {
  const prev = { plants: [], revealedTopics: ['身世'], epNo: 2 };
  const r1 = secretLedger(ZH_AMNESIA, prev);
  const i1 = r1.issues.find((i) => i.type === 'reveal_amnesia');
  assert.ok(i1);
  assert.strictEqual(i1.severity, 'mid');
  assert.strictEqual(r1.amnesia.length, 1);

  const prev2 = { plants: [], revealedTopics: ['身世', '怀孕'], epNo: 2 };
  const t2 = `场景一 客厅 夜
母亲：你的身世我瞒着你说不出口。
姐姐：她怀孕的事也得瞒着，不能让妈知道。`;
  const r2 = secretLedger(t2, prev2);
  assert.strictEqual(r2.amnesia.length, 2);
  const i2 = r2.issues.find((i) => i.type === 'reveal_amnesia');
  assert.strictEqual(i2.severity, 'high');
});

test('ZH 节奏失衡：首集 3 个秘密零揭示 → reveal_pacing mid', () => {
  const t = `场景一 老宅 夜
母亲：你的身世我一直瞒着你。
管家：少爷的婚约也得瞒着，老爷吩咐的。
司机：小姐怀孕的消息我谁都不敢说。`;
  const r = secretLedger(t);
  const issue = r.issues.find((i) => i.type === 'reveal_pacing');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'mid');
  assert.ok(r.score < 100);
});

test('ZH 无处着力：连载集零植入零揭示 → no_secret low', () => {
  const prev = { plants: [], revealedTopics: [], epNo: 3 };
  const r = secretLedger('场景一 公司 日\n林晚：把报表发我。\n赵天成：好的。', prev);
  const issue = r.issues.find((i) => i.type === 'no_secret');
  assert.ok(issue);
  assert.strictEqual(issue.severity, 'low');
  // 首集（prev=null）不判 no_secret
  const r0 = secretLedger('场景一 公司 日\n林晚：把报表发我。');
  assert.strictEqual(r0.issues.filter((i) => i.type === 'no_secret').length, 0);
});

test('EN 层：plant/reveal/amnesia 全链路，issue 文案零中文', () => {
  const en1 = `Scene 1. Study - Night
Mother: I kept your birth secret for twenty years. I can never tell you.
Anna: What do you mean?`;
  const r1 = secretLedger(en1, null, 'en');
  assert.strictEqual(r1.plants.length, 1);
  assert.strictEqual(r1.plants[0].topic, 'birth secret');

  const en2 = `Scene 1. Hall - Day
Victor: The truth is out. Her birth secret is exposed to everyone.
Anna: You exposed it in public?`;
  const r2 = secretLedger(en2, r1.nextState, 'en');
  assert.ok(r2.nextState.revealedTopics.includes('birth secret'));
  assert.strictEqual(r2.nextState.plants.length, 0);

  const en3 = `Scene 1. Living Room - Night
Mother: I am still keeping your birth secret. Not yet.
Anna: Again with the secrecy?`;
  const r3 = secretLedger(en3, r2.nextState, 'en');
  assert.strictEqual(r3.amnesia.length, 1);
  for (const i of r3.issues) {
    assert.ok(!CJK.test(i.evidence), `evidence 含中文: ${i.evidence}`);
    assert.ok(!CJK.test(i.advice), `advice 含中文: ${i.advice}`);
  }
});

test('字段边界：空文本/严重度排序/nextState 植入池上限', () => {
  const r0 = secretLedger('');
  assert.strictEqual(r0.plants.length, 0);
  assert.strictEqual(r0.nextState.epNo, 1);
  // 植入池上限 40：prev 已有 40 条时不膨胀
  const bigPrev = {
    plants: Array.from({ length: 40 }, (_, i) => ({ topic: `主题${i}`, plantedInEp: 1, snippet: 'x' })),
    revealedTopics: [], epNo: 1,
  };
  const r1 = secretLedger(ZH_EP1, bigPrev);
  assert.ok(r1.nextState.plants.length <= 40);
  const order = { high: 0, mid: 1, low: 2 };
  const r2 = secretLedger(ZH_EP1);
  for (let i = 1; i < r2.issues.length; i++) {
    assert.ok(order[r2.issues[i - 1].severity] <= order[r2.issues[i].severity]);
  }
});
