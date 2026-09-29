const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../dist/server/app.js');

// craft 为纯只读、不连库、不鉴权路由：用默认装配即可
const app = createApp({});
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); });
const M = '/api/craft';

describe('叙事工艺·小南递招 HTTP', () => {
  it('taxonomy 返回10类钩子与43张方法卡（4组）', async () => {
    const r = await fetch(base + M + '/taxonomy');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.hooks.length, 10);
    assert.strictEqual(j.cardGroups.length, 4);
    assert.strictEqual(j.totals.hooks, 10);
    assert.strictEqual(j.totals.cards, 43);
    const sum = j.cardGroups.reduce((n, g) => n + g.count, 0);
    assert.strictEqual(sum, 43);
    // 组内卡片只暴露标题/公式层
    assert.ok(j.cardGroups[0].cards.every((c) => c.id && c.title && c.formula && !c.steps));
  });

  it('空输入 400；正常创意返回匹配方法卡+默认钩子（保底集/场/连环）', async () => {
    const r400 = await fetch(base + M + '/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r400.status, 400);
    const r = await fetch(base + M + '/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '重生复仇逆袭，悬疑权谋，女主隐忍卖惨最后翻盘', tags: ['复仇', '悬疑'], limit: 6 }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.cards.length >= 1 && j.cards.length <= 6);
    const ids = j.hooks.map((h) => h.id);
    for (const must of ['episode_hook', 'scene_hook', 'chain_hook']) assert.ok(ids.includes(must), '保底钩子缺失 ' + must);
    // 复仇/悬疑题材应额外命中专属钩（信息差/隐忍卖惨等至少一个）
    assert.ok(ids.length >= 3);
  });

  it('传 opening 时返回开篇钩子审计；超长文本被截断不报错', async () => {
    const r = await fetch(base + M + '/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '都市逆袭', opening: '刀尖正抵着他的喉咙，他却笑了。' }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.openingAudit && Array.isArray(j.openingAudit.used));
    assert.ok(j.openingAudit.used.includes('action_hook'));
    const long = await fetch(base + M + '/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '复仇'.repeat(9000) }),
    });
    assert.strictEqual(long.status, 200);
  });

  it('diverse-seeds：n 被钳到2..6，各版主角原型互不重复', async () => {
    const j = await (await fetch(base + M + '/diverse-seeds?n=4')).json();
    assert.strictEqual(j.n, 4);
    assert.strictEqual(j.seeds.length, 4);
    assert.strictEqual(new Set(j.seeds.map((s) => s.archetype)).size, 4);
    assert.ok(j.seeds.every((s) => s.directive.includes('第')));
    const clamp = await (await fetch(base + M + '/diverse-seeds?n=99')).json();
    assert.strictEqual(clamp.seeds.length, 6);
  });

  it('diversity-audit：雷同两版判伪多版本，正交两版通过；不足2版400', async () => {
    const bad = await fetch(base + M + '/diversity-audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versions: [
        { id: 'A', logline: '被顶替名额的女医生回乡逆袭打脸所有人', archetype: '天才少女', conflictTags: ['身份错位', '尊严羞辱'], plotTags: ['证据反杀'] },
        { id: 'B', logline: '被顶替名额的女医生回乡逆袭打脸全部亲戚', archetype: '天才少女', conflictTags: ['身份错位', '尊严羞辱'], plotTags: ['证据反杀'] },
      ] }),
    });
    assert.strictEqual(bad.status, 200);
    const bj = await bad.json();
    assert.strictEqual(bj.pseudoVersion, true);
    assert.strictEqual(bj.verdict, 'pseudo');
    assert.ok(bj.issues.length >= 1);
    const good = await (await fetch(base + M + '/diversity-audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versions: [
        { id: 'A', logline: '落魄原配隐忍三年后夺回公司控制权', archetype: '落魄原配', conflictTags: ['财产争夺'], plotTags: ['证据反杀'] },
        { id: 'B', logline: '市井小人物意外卷入古董局中局', archetype: '市井小人物', conflictTags: ['生死危机'], plotTags: ['反向利用'] },
      ] }),
    })).json();
    assert.strictEqual(good.pseudoVersion, false);
    const e400 = await fetch(base + M + '/diversity-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versions: [{ logline: '只有一版' }] }) });
    assert.strictEqual(e400.status, 400);
  });
});

describe('互动短剧分支（v1.82）', () => {
  it('branch-skeleton 返回合法闭环骨架', async () => {
    const r = await fetch(base + M + '/branch-skeleton?choicePoints=2');
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.report.closedLoop, true);
    assert.ok(j.graph.nodes.start);
    assert.strictEqual(j.report.endings.main, 1);
  });
  it('branch-validate 识别死胡同；非法图 400', async () => {
    const bad400 = await fetch(base + M + '/branch-validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: { start: 'x', nodes: {} } }) });
    assert.strictEqual(bad400.status, 400);
    const r = await fetch(base + M + '/branch-validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: { start: 's', nodes: { s: { type: 'scene', to: [] } } } }) });
    const j = await r.json();
    assert.ok(j.report.issues.some((i) => i.type === 'dead_end' || i.type === 'no_ending'));
  });
});

describe('互动分支可视化编辑（v1.85）', () => {
  it('branch-mutate 增节点并回布局；非法操作400', async () => {
    const g0 = { start: 's', nodes: { s: { type: 'scene', to: [] } } };
    const r = await fetch(base + M + '/branch-mutate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: g0, op: { op: 'addNode', nodeType: 'ending', endingType: 'bad' } }) });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.graph.nodes.n1 && j.layout.n1);
    const bad = await fetch(base + M + '/branch-mutate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: j.graph, op: { op: 'removeNode', id: 's' } }) });
    assert.strictEqual(bad.status, 400);
  });
  it('branch-skeleton 回自动布局', async () => {
    const r = await fetch(base + M + '/branch-skeleton?choicePoints=2');
    const j = await r.json();
    assert.ok(j.layout && j.layout.start);
  });
});

describe('互动分支概率机制（v1.86）', () => {
  it('setKind 概率权重合法生效，权重数不符400', async () => {
    const g = { start: 'c', nodes: { c: { type: 'choice', to: ['a', 'b'] }, a: { type: 'ending', endingType: 'main' }, b: { type: 'ending', endingType: 'bad' } } };
    const ok = await fetch(base + M + '/branch-mutate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: g, op: { op: 'setKind', id: 'c', kind: 'probability', weights: [30, 70] } }) });
    assert.strictEqual(ok.status, 200);
    const j = await ok.json(); assert.deepStrictEqual(j.graph.nodes.c.weights, [30, 70]);
    const bad = await fetch(base + M + '/branch-mutate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: g, op: { op: 'setKind', id: 'c', kind: 'probability', weights: [30] } }) });
    assert.strictEqual(bad.status, 400);
  });
});
