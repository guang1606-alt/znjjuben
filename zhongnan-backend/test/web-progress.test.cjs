const { describe, it } = require('node:test');
const assert = require('node:assert');
const PV = require('../web/progress-view.js');

describe('前端创作进度状态机（游戏化进度/小南陪伴）', () => {
  it('冻结积分→上下文：记录积分与免费标记，起步进度2%', () => {
    let s = PV.createProgress();
    s = PV.reduceProgress(s, { stage: 'frozen', points: 10, free: false });
    assert.strictEqual(s.points, 10);
    assert.strictEqual(s.free, false);
    s = PV.reduceProgress(s, { stage: 'context', xiaonanLines: ['先看看你的口味'], directions: ['时令:高考'] });
    assert.strictEqual(s.percent, 2);
    assert.strictEqual(s.xiaonanLine, '先看看你的口味');
    assert.deepStrictEqual(s.directions, ['时令:高考']);
  });

  it('逐岗位推进：阶段时间线、当前活跃、上一阶段自动完成', () => {
    let s = PV.createProgress();
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'market_pre', percent: 6, label: '看市场', xiaonanLine: 'a', tip: 't1', stageKind: 'llm' });
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'architect', percent: 18, label: '搭骨架', xiaonanLine: 'b', tip: 't2', stageKind: 'llm' });
    assert.deepStrictEqual(s.order, ['market_pre', 'architect']);
    assert.strictEqual(s.activeStage, 'architect');
    assert.strictEqual(s.stages.market_pre.status, 'done');
    assert.strictEqual(s.stages.architect.status, 'active');
    assert.strictEqual(s.xiaonanLine, 'b');
    assert.strictEqual(PV.stageList(s).length, 2);
  });

  it('进度单调不减：乱序/回退事件不把进度条往回拉', () => {
    let s = PV.createProgress();
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'writer', percent: 60 });
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'deai', percent: 42 }); // 门岗回退
    assert.strictEqual(s.percent, 60);
  });

  it('done：进度拉满100、所有阶段收尾、结果归集', () => {
    let s = PV.createProgress();
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'writer', percent: 70 });
    s = PV.reduceProgress(s, { stage: 'done', taskId: 't1', pointsCharged: 10, antiAi: { pass: true }, market: { score: 88 }, opportunity: { hit: true } });
    assert.strictEqual(s.phase, 'done');
    assert.strictEqual(s.percent, 100);
    assert.strictEqual(s.activeStage, null);
    assert.strictEqual(s.stages.writer.status, 'done');
    assert.strictEqual(s.result.taskId, 't1');
    assert.strictEqual(s.result.market.score, 88);
    assert.strictEqual(s.result.opportunity.hit, true);
  });

  it('失败退款：记录错误且保留已达进度（不假装成功）', () => {
    let s = PV.createProgress();
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'writer', percent: 55 });
    s = PV.reduceProgress(s, { stage: 'failed_refunded', error: '上游超时' });
    assert.strictEqual(s.phase, 'failed');
    assert.strictEqual(s.error, '上游超时');
    assert.strictEqual(s.percent, 55);
  });

  it('未知/空事件安全忽略，不崩', () => {
    const s0 = PV.createProgress();
    assert.strictEqual(PV.reduceProgress(s0, null), s0);
    assert.strictEqual(PV.reduceProgress(s0, { stage: 'weird' }).phase, 'idle');
  });

  it('SSE 分帧解析：半包拼接，完整帧才产出事件', () => {
    const buf = { text: '' };
    const e1 = PV.parseSseChunk(buf, 'data: {"stage":"frozen"');
    assert.strictEqual(e1.length, 0); // 半包
    const e2 = PV.parseSseChunk(buf, ',"points":5}\n\n');
    assert.strictEqual(e2.length, 1);
    assert.strictEqual(e2[0].stage, 'frozen');
    assert.strictEqual(e2[0].points, 5);
    const e3 = PV.parseSseChunk(buf, 'data: {"stage":"context"}\n\ndata: {"stage":"done"}\n\n');
    assert.strictEqual(e3.length, 2);
  });

  it('游戏化鼓励语按区间切换', () => {
    assert.match(PV.milestone(0), /就位/);
    assert.match(PV.milestone(30), /骨架/);
    assert.match(PV.milestone(60), /过半/);
    assert.match(PV.milestone(80), /收尾/);
    assert.match(PV.milestone(100), /完成/);
  });

  it('v2.66 岗位协同可视化：role 落库 + roleMeta 图标配色 + waitTips 双语种非空', () => {
    let s = PV.createProgress();
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'architect', role: 'architect', percent: 12, label: '搭骨架' });
    s = PV.reduceProgress(s, { stage: 'progress', pipelineStage: 'writer', role: 'writer', percent: 40, label: '写本集' });
    assert.strictEqual(s.stages.architect.role, 'architect');
    assert.strictEqual(s.stages.writer.role, 'writer');
    const m = PV.roleMeta('writer');
    assert.ok(m.icon && m.color && m.zh && m.en);
    const unknown = PV.roleMeta('nope');
    assert.ok(unknown.icon);
    assert.ok(Array.isArray(PV.waitTips(false)) && PV.waitTips(false).length >= 6);
    assert.ok(Array.isArray(PV.waitTips(true)) && PV.waitTips(true).length >= 6);
    // 英文彩蛋不含中文
    PV.waitTips(true).forEach((t) => assert.ok(!/[一-鿿]/.test(t), t));
  });
});
