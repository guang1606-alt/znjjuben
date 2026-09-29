const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildQcEngineDigest, QC_LEDGER_KEYS } = require('../dist/engine/qc-digest.js');

describe('qc-digest 引擎摘要（v2.129 质检聚合卡数据源修复）', () => {
  it('score+hits 形态引擎被摘要：hits 截断、issues/advice 截断、unrescuedCount 透传', () => {
    const res = buildQcEngineDigest({
      faintOnCue: {
        score: 72,
        hits: Array.from({ length: 20 }, (_, i) => ({ line: `L${i}`, rescued: false })),
        issues: ['i1', 'i2', 'i3', 'i4'],
        advice: ['a1', 'a2', 'a3', 'a4'],
        unrescuedCount: 5,
      },
    });
    assert.deepStrictEqual(Object.keys(res), ['faintOnCue']);
    const e = res.faintOnCue;
    assert.strictEqual(e.score, 72);
    assert.strictEqual(e.hits.length, 8, 'hits 应截断到 8 条（落库防膨胀）');
    assert.deepStrictEqual(e.issues, ['i1', 'i2', 'i3']);
    assert.deepStrictEqual(e.advice, ['a1', 'a2', 'a3']);
    assert.strictEqual(e.unrescuedCount, 5);
  });

  it('台账键即使长得像引擎（score+hits）也必须排除——防覆盖跨集台账契约', () => {
    const res = buildQcEngineDigest({
      cliffhanger: { score: 60, hits: [{ x: 1 }] },   // DB 用此键存钩子位台账
      payoffRhythm: { score: 60, hits: [{ x: 1 }] },  // DB 用此键存憋爽摘要
      timeline: { score: 60, hits: [{ x: 1 }] },      // DB 用此键存时间锚
      villainFate: { score: 60, hits: [{ x: 1 }] },   // DB 用此键存下场行
      voicePrint: { score: 60, hits: [{ x: 1 }] },    // 正常引擎应保留
    });
    assert.deepStrictEqual(Object.keys(res), ['voicePrint']);
    assert.ok(QC_LEDGER_KEYS.has('cliffhanger') && QC_LEDGER_KEYS.has('payoffRhythm'));
  });

  it('非引擎形态天然排除：无 score（cliche 家族）/无 hits 数组（showDontTell 家族）/数组与原始值/空 hits', () => {
    const res = buildQcEngineDigest({
      cliche: { hits: [{ id: 'c1' }], noveltyScore: 80, pass: true },       // 无 score
      showDontTell: { score: 66, issues: [{ x: 1 }] },                      // 无 hits
      antiAi: null,
      format: 'ok',
      tags: ['a'],
      hollowAction: { score: 95, hits: [] },                                // 空 hits：前端过滤，不摘要
    });
    assert.deepStrictEqual(Object.keys(res), []);
  });

  it('摘要结果满足前端 chip 卡过滤契约：score<100 且 hits 非空即可上卡', () => {
    const result = {
      voicePrint: { score: 55, hits: [{ a: 1 }], issues: ['x'] },
      perfect: { score: 100, hits: [{ a: 1 }] }, // 满分引擎前端不渲染，摘要照收无害
    };
    const res = buildQcEngineDigest(result);
    // 模拟 web/app.js buildQcReportHtml 的 chip 过滤
    const chips = Object.keys(res).filter((k) => {
      const v = res[k];
      return typeof v.score === 'number' && v.score < 100 && Array.isArray(v.hits) && v.hits.length > 0;
    });
    assert.deepStrictEqual(chips, ['voicePrint']);
  });

  it('null/undefined 输入安全返回空对象（沙盘/异常路径零副作用）', () => {
    assert.deepStrictEqual(buildQcEngineDigest(null), {});
    assert.deepStrictEqual(buildQcEngineDigest(undefined), {});
  });
});

describe('c212 qc-digest issues 形态路径（v2.113-v2.147 结构维度族零落地修复）', () => {
  it('无顶层 hits、score + 对象 issues[] 的引擎被收录：issueCount + 限界 issues（severity 归一/字段截断/≤5 条）', () => {
    const long = 'x'.repeat(300);
    const res = buildQcEngineDigest({
      causalLogic: {
        score: 55,
        coincidenceCount: 3,
        issues: Array.from({ length: 9 }, (_, i) => ({
          severity: i === 0 ? 'high' : 'weird',
          type: 'coincidence_overload',
          evidence: long,
          advice: long,
        })),
      },
    });
    assert.deepStrictEqual(Object.keys(res), ['causalLogic']);
    const e = res.causalLogic;
    assert.strictEqual(e.score, 55);
    assert.ok(!('hits' in e), 'issues 形态不得伪造 hits 键');
    assert.strictEqual(e.issueCount, 9, 'issueCount 保留全量计数（面板副标题用）');
    assert.strictEqual(e.issues.length, 5, 'issues 截断到 5 条（落库防膨胀）');
    assert.strictEqual(e.issues[0].severity, 'high');
    assert.strictEqual(e.issues[1].severity, 'mid', '非 high/low 的 severity 归一为 mid');
    assert.ok(e.issues.every((i) => i.evidence.length <= 160 && i.advice.length <= 200));
    assert.ok(e.issues.every((i) => i.type.length <= 40));
  });

  it('cheatRule 的 gate 字符串透传（限界），非字符串 gate 丢弃', () => {
    const withGate = buildQcEngineDigest({ cheatRule: { gate: 'rebirth', score: 80, issues: [{ type: 't', advice: 'a' }] } });
    assert.strictEqual(withGate.cheatRule.gate, 'rebirth');
    const badGate = buildQcEngineDigest({ cheatRule: { gate: 123, score: 80, issues: [{ type: 't' }] } });
    assert.ok(!('gate' in badGate.cheatRule));
  });

  it('hits 非空时优先 hits 路径：不产出 issueCount，hits 路径行为零变化', () => {
    const res = buildQcEngineDigest({
      coolMoment: { score: 70, hits: [{ type: 'a' }, { type: 'b' }], issues: [{ type: 'x', advice: 'y' }] },
    });
    assert.strictEqual(res.coolMoment.hits.length, 2);
    assert.ok(!('issueCount' in res.coolMoment));
  });

  it('SPECIAL/LEDGER 键即使是 issues 形态也排除（专用 digest/台账契约不得分叉）', () => {
    const res = buildQcEngineDigest({
      sceneSoftEnding: { score: 40, issues: [{ type: 't', advice: 'a' }] },
      showDontTell: { score: 40, issues: [{ type: 't', advice: 'a' }] },
      cliffhanger: { score: 40, issues: [{ type: 't', advice: 'a' }] },
    });
    assert.deepStrictEqual(Object.keys(res), []);
  });

  it('防误收：string[] issues / 空 issues / 元素无 type 且无 evidence&advice / 无 score，一律不收录', () => {
    const res = buildQcEngineDigest({
      softString: { score: 40, issues: ['纯字符串问题1', '纯字符串问题2'] },
      healthy: { score: 100, issues: [] },
      shapeless: { score: 80, issues: [{ foo: 1 }, null, 42] },
      noScore: { issues: [{ type: 't', advice: 'a' }] },
      voicePrintLike: { score: 60, issues: [{ type: 'same_voice', advice: '区分口头禅' }] },
    });
    assert.deepStrictEqual(Object.keys(res), ['voicePrintLike'], '只有规范对象 issues 引擎才落地，其余全部排除');
  });
});
