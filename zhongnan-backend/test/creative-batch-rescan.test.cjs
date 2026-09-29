const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/creative-batch-rescan.js');
const S = require('../dist/engine/structural-rescan.js');

const ZH_BAD = [
  '1. 家中-夜 内景',
  '林母：你好吗？',
  '林小凡：我很好。你好吗？',
  '林母：我很好。你好吗？',
  '林小凡：我很好。',
  '他看起来非常生气非常愤怒特别特别激动。',
  '恰好这时候手机响了，碰巧是医院打来的，幸好医生说体检报告拿错了。',
  '她突然就想通了，所有问题一下子都解决了。',
].join('\n');

const ZH_GOOD = [
  '1. 茶馆-日 内景',
  '林晚推门而入，把账本拍在桌上。',
  '林晚（冷）：三百两，今天结清。',
  '赵坤擦着茶杯，手在抖。',
  '赵坤：再宽限三日。',
  '林晚：上回你也是这么说的。她抽出匕首插在桌缝里。',
  '赵坤脸色煞白，从柜下摸出银票。',
].join('\n');

describe('c215 batchCreativeDigest（/fix 后 102 个纯函数创作引擎批量重算）', () => {
  it('102 键全产出：每个键要么 hits 形态要么 issues 形态，score 合法', () => {
    const out = M.batchCreativeDigest(ZH_BAD, ['林母', '林小凡']);
    const keys = Object.keys(out);
    assert.strictEqual(keys.length, 102, `应为 102 键（100 纯 draft + voicePrint/dialogueNameCall），实际 ${keys.length}`);
    for (const k of keys) {
      const e = out[k];
      assert.ok(typeof e.score === 'number' && e.score >= 0 && e.score <= 100, `${k} score 非法`);
      assert.ok(Array.isArray(e.hits) || Array.isArray(e.issues), `${k} 必须是 hits 或 issues 形态`);
    }
  });

  it('与 structuralRescan 32 键 / c214 重算键零碰撞（并列展开安全）', () => {
    const out = M.batchCreativeDigest(ZH_BAD, ['林母']);
    const structural = new Set(Object.keys(S.structuralRescan(ZH_BAD, ['林母'])));
    const c214 = ['villainStall', 'teamBriefing', 'deadlineStretch', 'openingWeld', 'sceneSoftEnding', 'showDontTell', 'cliffhanger', 'arcTrack'];
    for (const k of Object.keys(out)) {
      assert.ok(!structural.has(k), `${k} 与 structuralRescan 撞键`);
      assert.ok(!c214.includes(k), `${k} 与 c214 撞键`);
    }
  });

  it('覆盖语义：健康稿显式写健康壳（hits 壳 / issues 壳），清 v1 旧账', () => {
    const out = M.batchCreativeDigest(ZH_GOOD, ['林晚', '赵坤']);
    // vagueWord 是 hits 形态引擎，健康稿必须出 {score, hits:[]} 壳而不是缺键
    assert.ok(out.vagueWord, '健康稿 vagueWord 不得缺键（覆盖语义）');
    assert.deepStrictEqual(out.vagueWord.hits, []);
    assert.strictEqual(out.vagueWord.score, 100);
    // echoDialogue 同理
    assert.ok(out.echoDialogue && Array.isArray(out.echoDialogue.hits) && out.echoDialogue.hits.length === 0);
    // issues 形态引擎（dialogueAiTaste）健康时出 {score, issueCount:0, issues:[]} 壳
    assert.ok(out.dialogueAiTaste, '健康稿 dialogueAiTaste 不得缺键');
    assert.strictEqual(out.dialogueAiTaste.issueCount, 0);
    assert.deepStrictEqual(out.dialogueAiTaste.issues, []);
  });

  it('问题稿真实命中：回声对白/模糊词引擎抓到问题，证明重算不是空壳', () => {
    const out = M.batchCreativeDigest(ZH_BAD, ['林母', '林小凡']);
    assert.ok(out.echoDialogue.hits.length > 0, '回声对白应命中');
    assert.ok(out.vagueWord.hits.length > 0, '模糊词应命中');
    assert.ok(out.vagueWord.score < 100);
  });

  it('无 cast 时跳过 voicePrint/dialogueNameCall，其余 100 键仍在', () => {
    const out = M.batchCreativeDigest(ZH_BAD);
    assert.ok(!out.voicePrint, '无 cast 不得跑 voicePrint');
    assert.ok(!out.dialogueNameCall, '无 cast 不得跑 dialogueNameCall');
    assert.strictEqual(Object.keys(out).length, 100);
  });

  it('空文本/短文本不抛错，返回 {} 或可展开对象', () => {
    assert.doesNotThrow(() => M.batchCreativeDigest(''));
    assert.deepStrictEqual(M.batchCreativeDigest(''), {});
    assert.doesNotThrow(() => M.batchCreativeDigest('短', undefined));
  });
});
