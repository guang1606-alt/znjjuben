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

// v2.334 线索 × 分支图联合校验：clues 选填；不传时响应与 v2.333 逐字兼容
describe('互动分支·线索联合校验（v2.334）', () => {
  const g = {
    start: 's',
    nodes: {
      s: { type: 'choice', to: ['c1', 'c2'], label: '开场对峙' },
      c1: { type: 'scene', to: ['e1'], label: '选择点1' },
      c2: { type: 'scene', to: ['e1'], label: '选择点2' },
      e1: { type: 'ending', endingType: 'main', label: '主线结局' },
    },
  };
  it('不传 clues → clueIssues 为空数组，结构报告不变', async () => {
    const r = await fetch(base + M + '/branch-validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: g }) });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.deepStrictEqual(j.clueIssues, []);
    assert.strictEqual(j.report.closedLoop, true);
  });
  it('线索可得处落在图外 → clue_gain_unknown', async () => {
    const r = await fetch(base + M + '/branch-validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: g, clues: [{ id: '锈钥匙', trust: '真', gainAt: ['第三幕'], opens: ['主线结局'] }] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.clueIssues.some((i) => i.type === 'clue_gain_unknown' && i.severity === 'high'));
  });
  it('branch-mutate 同样回线索联合校验；非法线索规格 400 带 field', async () => {
    const ok = await fetch(base + M + '/branch-mutate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: g, op: { op: 'addNode', nodeType: 'scene' }, clues: [{ id: '锈钥匙', gainAt: ['选择点2'], requiredFor: ['主线结局'] }] }),
    });
    assert.strictEqual(ok.status, 200);
    const j = await ok.json();
    assert.ok(j.clueIssues.some((i) => i.type === 'clue_ending_bypass'));
    const bad = await fetch(base + M + '/branch-mutate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: g, op: { op: 'addNode', nodeType: 'scene' }, clues: [{ trust: '真' }] }),
    });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual((await bad.json()).field, 'clues');
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

// v2.510 免费剧本体检：把已实现的三组工艺尺子（原型/情绪/网文，约18条）开放为不登录、不耗 token 的只读工具
describe('免费剧本体检 craft/lint（v2.510）', () => {
  it('空文本 400，只有空白也 400', async () => {
    for (const body of ['{}', JSON.stringify({ text: '   ' })]) {
      const r = await fetch(base + M + '/lint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.strictEqual(r.status, 400);
    }
  });

  it('五组尺子全部返回（v2.520 补上改稿尺子与叙事逻辑），问题按 P0/P1/P2 排序且分数升序', async () => {
    const r = await fetch(base + M + '/lint', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '第1场 内景 夜 办公室\n反派：穷逼，废物，给我上，一起上，哈哈哈。\n主角：算了，原谅他吧。' }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.deepStrictEqual(j.groups.map((g) => g.key), ['archetype', 'emotion', 'webnovel', 'craft', 'narrative']);
    assert.ok(j.counts.total >= 15, '五组尺子合计应至少 15 条，实际 ' + j.counts.total);
    assert.ok(j.issues.length === j.counts.total);
    assert.ok(j.groups.every((g) => typeof g.avg === 'number' && Array.isArray(g.issues) && g.issues.every((i) => i.rule && i.dim && i.advice)));
    const order = { P0: 0, P1: 1, P2: 2 };
    for (let i = 1; i < j.issues.length; i++) {
      const a = j.issues[i - 1], b = j.issues[i];
      assert.ok(order[a.level] < order[b.level] || (order[a.level] === order[b.level] && a.score <= b.score));
    }
  });

  it('传剧名才体检剧名，不传不误报（v2.522）', async () => {
    const body = { text: '她把合同拍在桌上，对方脸色一变。这一次，她不打算再退。'.repeat(6) };
    const bare = await (await fetch(base + M + '/lint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    assert.ok(!bare.issues.some((i) => i.rule === 'title'), '未填剧名时不应出现剧名问题');
    const withTitle = await (await fetch(base + M + '/lint', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, title: '风中的蒲公英' }),
    })).json();
    const t = withTitle.issues.filter((i) => i.rule === 'title');
    assert.strictEqual(t.length, 1, '填了剧名就该给出一条剧名检查');
    assert.strictEqual(t[0].dim, '剧名一眼想看');
    assert.strictEqual(t[0].level, 'P1', '没有冲突词/一眼看点的剧名应判 P1');
  });

  it('改稿尺子与叙事逻辑在免费体检中生效（小说腔/然后链）', async () => {
    const j = await (await fetch(base + M + '/lint', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '他心想，这一切都过去了。然后他走下楼，然后点了一根烟，然后看着窗外。' }),
    })).json();
    const craft = j.groups.find((g) => g.key === 'craft');
    const narr = j.groups.find((g) => g.key === 'narrative');
    assert.ok(craft && craft.issues.some((i) => i.rule === 'novelistic'), '小说腔应由改稿尺子命中');
    assert.ok(narr && narr.issues.some((i) => i.rule === 'ntThenChain'), '「然后」因果链应由叙事逻辑命中');
  });

  it('廉价反派/强行原谅的文本被判 P1，并给出可执行建议', async () => {
    const j = await (await fetch(base + M + '/lint', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '复仇线。反派嘴臭：穷逼，废物，给我上，一起上，哈哈哈。她心软了，算了，原谅他吧。' }),
    })).json();
    assert.ok(j.counts.p1 >= 1, '应至少命中一条 P1');
    const p1 = j.issues.find((i) => i.level === 'P1');
    assert.ok(p1.advice.length > 20);
  });

  it('支持 episodes 分集数组（情绪线/开篇留存），超长正文被截断不报错', async () => {
    const r = await fetch(base + M + '/lint', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '短剧正文'.repeat(12000), episodes: ['第1集 主角被顶替名额', '第2集 主角反击'] }),
    });
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.ok(j.chars <= 20000, '正文应被截断到 20000 字以内，实际 ' + j.chars);
    assert.ok(j.issues.some((i) => i.rule === 'emotionOutline'), 'episodes 应触发分集情绪线尺子');
    assert.ok(j.issues.some((i) => i.rule === 'firstThree'), 'episodes 应触发前三集节奏尺子（改稿尺子组）');
    const outlines = j.issues.filter((i) => i.rule === 'emotionOutline');
    assert.ok(outlines.length >= 2, '两集应各出一条情绪大纲问题');
    assert.ok(outlines.every((i, k) => i.dim.includes(`第${k + 1}集`)), '多集情绪大纲须标出集号，否则同名同建议分不清：' + JSON.stringify(outlines.map((i) => i.dim)));
  });
});

// v2.510 免费原型选型：6型主角 / 6型反派 / 5套系统机制，按一句话创意实时匹配
describe('免费原型选型 craft/archetype-match（v2.510）', () => {
  it('空输入 400', async () => {
    const r = await fetch(base + M + '/archetype-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(r.status, 400);
  });

  it('复仇逆袭命中主角/反派原型，系统词命中三套系统机制', async () => {
    const j = await (await fetch(base + M + '/archetype-match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '重生复仇逆袭，带着系统金手指，反派出场', tags: ['复仇', '大女主'] }),
    })).json();
    assert.ok(j.protag.length >= 1 && j.protag.every((p) => p.id && p.name && p.formula && p.core));
    assert.ok(j.villain.length >= 1 && j.villain.every((v) => v.id && v.name));
    assert.strictEqual(j.system.length, 3);
    assert.strictEqual(j.hasSystem, true);
  });

  it('lang=en 用英文关键词匹配并返回英文原型名/公式，不混入中文', async () => {
    const j = await (await fetch(base + M + '/archetype-match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'a rebirth revenge story, she is an iron queen who never forgives', tags: ['female', 'revenge', 'system panel'], lang: 'en' }),
    })).json();
    assert.ok(j.protag.some((p) => p.id === 'iron_queen'), '英文关键词应命中 iron_queen，实际 ' + JSON.stringify(j.protag.map((p) => p.id)));
    assert.strictEqual(j.hasSystem, true);
    assert.strictEqual(j.system.length, 3);
    const cjk = /[\u4e00-\u9fa5]/;
    for (const p of [...j.protag, ...j.villain, ...j.system]) {
      assert.ok(!cjk.test(p.name), '英文界面原型名不应含中文：' + p.name);
      assert.ok(!cjk.test(p.formula || p.tip || ''), '英文界面原型说明不应含中文：' + (p.formula || p.tip));
    }
  });

  it('无系统词时不推荐系统机制，标签也能参与匹配', async () => {
    const j = await (await fetch(base + M + '/archetype-match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['谍战', '双雄'] }),
    })).json();
    assert.strictEqual(j.hasSystem, false);
    assert.deepStrictEqual(j.system, []);
    assert.ok(j.protag.length + j.villain.length >= 1);
  });
});

// v2.519 免费递招：开篇钩子审计不再睡死；英文创意也能命中方法卡，建议不含中文
describe('免费递招 craft/recommend（v2.519）', () => {
  it('不传 opening 时 openingAudit 为 null，传了才给建议', async () => {
    const bare = await (await fetch(base + M + '/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '重生复仇逆袭', tags: ['复仇'] }),
    })).json();
    assert.strictEqual(bare.openingAudit, null);
    assert.ok(bare.cards.length >= 1);
    const withOpen = await (await fetch(base + M + '/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '重生复仇逆袭', opening: '这片大陆历史悠久四季如春，人们过着平静的生活，讲述一个古老家族的传承' }),
    })).json();
    assert.ok(withOpen.openingAudit && withOpen.openingAudit.advice.length > 20, '开篇平铺背景应给出可执行建议');
    assert.ok(withOpen.openingAudit.used.length === 0);
  });

  it('lang=en 时英文创意能命中方法卡，开篇建议为英文且不含中文', async () => {
    const j = await (await fetch(base + M + '/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'revenge comeback underdog workplace', tags: ['revenge'], lang: 'en', opening: 'The continent has a long history and four gentle seasons; this tells an old family legend.' }),
    })).json();
    assert.ok(j.cards.length >= 1, '英文创意应命中方法卡');
    assert.ok(j.openingAudit && j.openingAudit.advice.length > 20);
    assert.ok(!/[\u4e00-\u9fa5]/.test(j.openingAudit.advice), '英文界面建议不应含中文：' + j.openingAudit.advice);
  });
});
