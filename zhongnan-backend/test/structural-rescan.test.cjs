const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../dist/engine/structural-rescan.js');

const ZH_BAD = [
  '1. 家中-夜 内景',
  '林母（犹豫）：小凡啊，你听妈一句劝，这事就算了吧，啊？',
  '林小凡：我不！我偏不！我就要查清楚！',
  '林母：你这孩子怎么这么不听话！',
  '林小凡：我恨你们！我好难过！我非常愤怒！',
  '（她猛地摔门，在雨里跑了很久很久，不知不觉天亮了。）',
  '2. 公司-日 内景',
  '张总：合同签了吧。林小凡：好。张总：那就这样。林小凡：嗯。',
  '恰好这时候手机响了，碰巧是医院打来的，幸好医生说体检报告拿错了。',
  '她突然就想通了，所有问题一下子都解决了，从此大家幸福地生活在一起。',
].join('\n');

const EN_BAD = [
  '1. INT. LIVING ROOM - NIGHT',
  'MOTHER: Honey, just let it go, okay?',
  'JANE: I will not! I am so angry and very sad!',
  '(She slammed the door and ran in the rain. Somehow morning came.)',
  '2. INT. OFFICE - DAY',
  'BOSS: Sign the contract. JANE: Okay. BOSS: Fine. JANE: Yep.',
  'Luckily the phone rang, and coincidentally the hospital said they mixed up the reports by chance.',
  'Suddenly everything was fine and everyone lived happily ever after.',
].join('\n');

describe('c212 structuralRescan（/fix 后结构维度 32 键统一重算）', () => {
  const KEYS = [
    'coolMoment', 'dialogueWater', 'conflictDensity', 'punchlineDensity', 'repetition', 'twistDensity', 'informationDensity',
    'sceneDensity', 'characterBalance', 'dialogueLength', 'suspenseTension', 'sceneHeader', 'dialogueFunction',
    'causalLogic', 'protagonistGoal', 'antagonistQuality', 'relationship', 'scenePadding', 'supporting',
    'conflictEscalation', 'subtext', 'supportingArc', 'scenePurpose', 'continuity', 'misunderstanding',
    'plotArmor', 'evidenceChain', 'cheatRule', 'memoryFakeout', 'emotionalAftermath', 'locationContinuity', 'characterPresence',
  ];

  it('中文稿：32 键全部产出统一契约 {score, issueCount, issues[]}，issues 元素限界、severity 合法', () => {
    const out = M.structuralRescan(ZH_BAD, { 林小凡: '', 林母: '', 张总: '' });
    const got = Object.keys(out).sort();
    assert.deepStrictEqual(got, [...KEYS].sort(), '键集必须恰好 32 键（无 openingWeld/timeline/payoffRhythm）');
    for (const k of KEYS) {
      const e = out[k];
      assert.ok(typeof e.score === 'number' && e.score >= 0 && e.score <= 100, `${k} score 非法`);
      assert.ok(typeof e.issueCount === 'number' && Array.isArray(e.issues), `${k} 形态非法`);
      assert.ok(e.issues.length <= 5, `${k} issues 必须 ≤5`);
      for (const i of e.issues) {
        assert.ok(['high', 'mid', 'low'].includes(i.severity), `${k} severity 非法: ${i.severity}`);
        if (i.type !== undefined) assert.ok(i.type.length <= 40);
        if (i.evidence !== undefined) assert.ok(i.evidence.length <= 160);
        if (i.advice !== undefined) assert.ok(i.advice.length <= 200);
      }
      assert.ok(e.issues.length <= e.issueCount, `${k} issueCount 不得小于截断后条数`);
      if ('gate' in e) assert.ok(typeof e.gate === 'string' && e.gate.length <= 20);
    }
  });

  it('英文稿不炸且键集一致（引擎内部语种覆盖 en）', () => {
    const out = M.structuralRescan(EN_BAD, { JANE: '', MOTHER: '', BOSS: '' });
    assert.strictEqual(Object.keys(out).length, 32);
    assert.ok(typeof out.causalLogic.score === 'number');
  });

  it('问题稿至少被结构引擎抓到问题（causalLogic 巧合家族 / sceneDensity 等应命中），证明重算不是空壳', () => {
    const out = M.structuralRescan(ZH_BAD, { 林小凡: '', 林母: '' });
    const flagged = KEYS.filter((k) => out[k].issueCount > 0);
    assert.ok(flagged.length >= 2, `问题稿应被多个结构键命中，实际：${flagged.join(',')}`);
    assert.ok(out.causalLogic.issueCount > 0 || out.dialogueFunction.issueCount > 0, '巧合/对白功能家族应至少一个命中');
  });

  it('短文本/空文本/无 cast 不抛错：引擎健康态或跳过，返回对象仍可直接展开进 qcReport', () => {
    assert.doesNotThrow(() => M.structuralRescan('', {}));
    assert.doesNotThrow(() => M.structuralRescan('短', undefined));
    const short = M.structuralRescan('短文本，没有场景。', {});
    assert.ok(typeof short === 'object');
  });

  it('cast 三键（characterBalance/supporting/supportingArc）接受 castMap 且产出契约形态', () => {
    const out = M.structuralRescan(ZH_BAD, { 林小凡: '', 林母: '', 张总: '' });
    for (const k of ['characterBalance', 'supporting', 'supportingArc']) {
      assert.ok(typeof out[k].score === 'number' && Array.isArray(out[k].issues), `${k} cast 形态非法`);
    }
  });
});
