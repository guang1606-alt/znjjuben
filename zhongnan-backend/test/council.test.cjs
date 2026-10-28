const { describe, it } = require('node:test');
const assert = require('node:assert');

const CFG = require('../dist/config/council.js');
const ENG = require('../dist/engine/council.js');
const AC = require('../dist/config/assistant-capability.js');
const { MemberLevel } = require('../dist/config/pricing.js');

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

describe('v2.330 多方评议 · 契约完整性', { concurrency: 1 }, () => {
  it('8 个席位权重合计为 1，且每席 stance 五维合计为 1', () => {
    assert.strictEqual(CFG.COUNCIL_SEATS.length, 8);
    const w = CFG.COUNCIL_SEATS.reduce((s, x) => s + x.weight, 0);
    assert.ok(near(w, 1), `席位权重必须合计 1，实际 ${w}`);
    for (const seat of CFG.COUNCIL_SEATS) {
      const sum = Object.values(seat.stance).reduce((a, b) => a + b, 0);
      assert.ok(near(sum, 1), `${seat.id} stance 必须合计 1，实际 ${sum}`);
    }
  });

  it('5 个研判维度且与维度名映射一一对应', () => {
    assert.strictEqual(CFG.DIMENSIONS.length, 5);
    for (const d of CFG.DIMENSIONS) {
      assert.ok(CFG.DIMENSION_NAME_ZH[d.id]);
      assert.ok(CFG.DIMENSION_NAME_EN[d.id]);
    }
  });

  it('评议目录 47 项、id 唯一、板块计数 30/4/13', () => {
    assert.strictEqual(CFG.COUNCIL_ITEMS.length, 47);
    const ids = new Set(CFG.COUNCIL_ITEMS.map((x) => x.id));
    assert.strictEqual(ids.size, 47, '评议 id 不得重复');
    const count = (m) => CFG.COUNCIL_ITEMS.filter((x) => x.module === m).length;
    assert.strictEqual(count('membership'), 30);
    assert.strictEqual(count('pricing'), 4);
    assert.strictEqual(count('assistant'), 13);
  });

  it('每项五维建议档位落在 0..3，kind 合法，gate 项现行档位与真实注册表一致', () => {
    for (const item of CFG.COUNCIL_ITEMS) {
      for (const [dim, v] of Object.entries(item.scores)) {
        assert.ok(Number.isInteger(v) && v >= 0 && v <= 3, `${item.id}.${dim} 必须是 0..3 整数`);
      }
      assert.ok(item.kind === 'gate' || item.kind === 'posture');
      assert.ok(item.current >= 0 && item.current <= 3);
    }
    // 抽查三处：现行档位不是手抄的，来自真实注册表
    assert.strictEqual(CFG.COUNCIL_ITEM_MAP['mode:tag'].current, 0);
    assert.strictEqual(CFG.COUNCIL_ITEM_MAP['mode:multiverse'].current, 3);
    assert.strictEqual(CFG.COUNCIL_ITEM_MAP['mode:hot'].current, 2);
  });
});

describe('v2.330 多方评议 · 聚合逻辑', { concurrency: 1 }, () => {
  it('逐席投票：8 票、档位等于加权分的四舍五入、加权总分在 0..3', () => {
    const r = ENG.conveneItem(CFG.COUNCIL_ITEM_MAP['mode:duel']);
    assert.strictEqual(r.votes.length, 8);
    assert.deepStrictEqual(r.votes.map((v) => v.seat), CFG.COUNCIL_SEATS.map((s) => s.id));
    for (const v of r.votes) {
      assert.strictEqual(v.suggest, Math.max(0, Math.min(3, Math.round(v.score))));
      assert.ok(v.score >= 0 && v.score <= 3);
    }
    assert.ok(r.weighted >= 0 && r.weighted <= 3);
    assert.strictEqual(r.suggested, Math.round(r.weighted));
    assert.strictEqual(r.delta, r.target - r.current);
  });

  it('共识度按主张档位极差计算，异议席位与多数意见精确对应', () => {
    for (const item of CFG.COUNCIL_ITEMS) {
      const r = ENG.conveneItem(item);
      const tiers = r.votes.map((v) => v.suggest);
      const expected = Math.round((1 - (Math.max(...tiers) - Math.min(...tiers)) / 3) * 100) / 100;
      assert.strictEqual(r.consensus, expected, `${item.id} 共识度公式漂移`);
      assert.deepStrictEqual(
        r.dissent,
        r.votes.filter((v) => v.suggest !== r.suggested).map((v) => v.seat),
        `${item.id} 异议名单必须只含与建议档位不同的席位`,
      );
    }
  });

  it('完全确定性：同一输入两次复盘逐字段相等', () => {
    assert.strictEqual(JSON.stringify(ENG.reviewCouncil()), JSON.stringify(ENG.reviewCouncil()));
    assert.strictEqual(JSON.stringify(ENG.councilBoard()), JSON.stringify(ENG.councilBoard()));
  });

  it('引擎可复用（举一反三）：任意自建项都能开席裁决，无需改引擎', () => {
    const synthetic = {
      id: 'demo:any_board', module: 'membership', group: 'mode', kind: 'gate',
      name: '示例项', nameEn: 'Demo item', current: 1,
      scores: { market: 0, differentiation: 0, compute: 0, risk: 0, entry: 0 },
    };
    const low = ENG.conveneItem(synthetic);
    assert.strictEqual(low.suggested, 0);
    assert.strictEqual(low.status, 'lower');
    assert.strictEqual(low.target, 0);
    assert.strictEqual(low.consensus, 1);
    const high = ENG.conveneItem({ ...synthetic, scores: { market: 3, differentiation: 3, compute: 3, risk: 3, entry: 3 } });
    assert.strictEqual(high.suggested, 3);
    assert.strictEqual(high.status, 'raise');
  });

  it('分歧过大不得改档：共识低于阈值时进入观察而非 raise/lower', () => {
    // 人为制造 0 档与 3 档对立：市场/入门取 0，其余取 3，席间必分两派
    const split = {
      id: 'demo:split', module: 'membership', group: 'mode', kind: 'gate',
      name: '对立项', nameEn: 'Split item', current: 2,
      scores: { market: 0, differentiation: 3, compute: 3, risk: 3, entry: 0 },
    };
    const r = ENG.conveneItem(split);
    if (r.consensus < ENG.CONSENSUS_DEFER && r.suggested !== r.current) {
      assert.strictEqual(r.status, 'observe');
      assert.strictEqual(r.target, r.current, '观察态不得偷偷改档');
    }
  });
});

describe('v2.330 多方评议 · 结论与主席裁定', { concurrency: 1 }, () => {
  const review = ENG.reviewCouncil('all');
  const byId = Object.fromEntries(review.items.map((r) => [r.id, r]));

  it('战略锚点一律维持现行档位，即使评议想上调', () => {
    const anchors = review.items.filter((r) => r.anchor);
    assert.ok(anchors.length >= 4);
    for (const r of anchors) {
      assert.strictEqual(r.status, 'anchor', `${r.id} 锚点结论必须为 anchor`);
      assert.strictEqual(r.target, r.current);
    }
    // tag 与中英双语是获客入口/主力语种；真人短剧是大众成品形态（评议想抬到基础，主席按住）
    for (const id of ['mode:tag', 'language:zh', 'language:en', 'scriptType:live_action_drama']) {
      assert.strictEqual(byId[id].status, 'anchor', `${id} 必须被识别为战略锚点`);
      assert.strictEqual(byId[id].target, byId[id].current);
    }
    assert.ok(byId['scriptType:live_action_drama'].suggested > byId['scriptType:live_action_drama'].current,
      '该锚点必须记录评议上调倾向，而不是分数恰好为 0');
  });

  it('主席保留项必须带理由，且目标档位不动', () => {
    const upheld = review.items.filter((r) => r.status === 'upheld');
    assert.ok(upheld.length > 0, '至少应存在被主席显式保留的分歧项');
    for (const r of upheld) {
      assert.ok(r.chairNote && r.chairNote.zh.length > 8, `${r.id} 主席保留必须写清理由`);
      assert.ok(r.chairNote.en.length > 8, `${r.id} 英文理由缺失`);
      assert.strictEqual(r.target, r.current);
      assert.notStrictEqual(r.suggested, r.current, `${r.id} 若建议与现行一致就不该是 upheld`);
    }
  });

  it('所有偏差都由主席显式裁定：待执行项必须为空', () => {
    assert.deepStrictEqual(review.summary.pending, [],
      '出现 raise/lower 说明有偏差未经主席裁定，必须先补 CHAIR_OVERRIDES 再上线');
  });

  it('价格姿态项：建议值即姿态，现行锚定维持', () => {
    const postures = review.items.filter((r) => r.kind === 'posture');
    assert.strictEqual(postures.length, 4);
    for (const r of postures) {
      assert.strictEqual(r.status, 'posture');
      assert.strictEqual(r.current, 1);
      assert.strictEqual(r.target, r.suggested);
      assert.ok(ENG.POSTURE_NAME_ZH[r.suggested]);
    }
    assert.strictEqual(byId['pricing:engine_price'].suggested, 1,
      '积分价不得上调：成本×2 铁底已锁死');
  });

  it('摘要计数与条目一一对应，平均共识度落在 0..1', () => {
    const s = review.summary;
    assert.strictEqual(s.total, review.items.length);
    assert.strictEqual(Object.values(s.byStatus).reduce((a, b) => a + b, 0), s.total);
    assert.strictEqual(Object.values(s.byModule).reduce((a, b) => a + b, 0), s.total);
    assert.ok(s.averageConsensus > 0.5 && s.averageConsensus <= 1);
    assert.ok(s.tensions.length > 0);
  });

  it('单项速查与 /modes 极简结论可用，未知 id 返回 null', () => {
    assert.strictEqual(ENG.councilOf('mode:tag').status, 'anchor');
    assert.strictEqual(ENG.councilOf('no_such_item'), null);
    const brief = ENG.councilBrief('assistant:listen_script');
    assert.deepStrictEqual(Object.keys(brief).sort(), ['consensus', 'status', 'suggested']);
    assert.strictEqual(brief.suggested, 1);
    assert.strictEqual(ENG.councilBrief('no_such_item'), null);
  });

  it('接入协议 6 步、序号连续（其他板块照此复用）', () => {
    assert.strictEqual(ENG.COUNCIL_PROTOCOL.length, 6);
    ENG.COUNCIL_PROTOCOL.forEach((s, i) => {
      assert.strictEqual(s.step, i + 1);
      assert.ok(s.zh && s.en);
    });
    const board = ENG.councilBoard();
    assert.strictEqual(board.seats.length, 8);
    assert.strictEqual(Object.keys(board.digest).length, 47);
  });
});

describe('v2.330 评议落地：助理能力档位', { concurrency: 1 }, () => {
  it('听剧本：免费仍被拦、基础起可用（由高级下调）', () => {
    assert.strictEqual(AC.assistantGate(MemberLevel.FREE, 'listen_script').allowed, false);
    assert.strictEqual(AC.assistantGate(MemberLevel.FREE, 'listen_script').needLevel, MemberLevel.BASIC);
    assert.strictEqual(AC.assistantGate(MemberLevel.BASIC, 'listen_script').allowed, true);
    assert.strictEqual(AC.assistantGate(MemberLevel.ADVANCED, 'listen_script').allowed, true);
  });

  it('习惯学习：基础被拦、高级起可用（由专业下调）', () => {
    assert.strictEqual(AC.assistantGate(MemberLevel.BASIC, 'habit_learning').allowed, false);
    assert.strictEqual(AC.assistantGate(MemberLevel.BASIC, 'habit_learning').needLevel, MemberLevel.ADVANCED);
    assert.strictEqual(AC.assistantGate(MemberLevel.ADVANCED, 'habit_learning').allowed, true);
    assert.strictEqual(AC.assistantGate(MemberLevel.PRO, 'habit_learning').allowed, true);
  });

  it('专业档仍保留三项独占能力（升级理由不被评议抹平）', () => {
    for (const action of ['voice_control', 'dedicated_assistant', 'market_analysis']) {
      assert.strictEqual(AC.assistantGate(MemberLevel.ADVANCED, action).allowed, false, `${action} 必须仍是专业档独占`);
      assert.strictEqual(AC.assistantGate(MemberLevel.PRO, action).allowed, true);
    }
  });
});
