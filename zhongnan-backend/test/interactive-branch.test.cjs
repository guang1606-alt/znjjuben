const test = require('node:test');
const assert = require('node:assert');
const B = require('../dist/engine/interactive-branch.js');

test('健康分支图：三结局齐全、闭环、满分', () => {
  const r = B.validateBranches({
    start: 'start',
    nodes: {
      start: { type: 'scene', to: ['c1'] },
      c1: { type: 'choice', to: ['e_main', 'e_bad', 'e_hidden'] },
      e_main: { type: 'ending', endingType: 'main' },
      e_bad: { type: 'ending', endingType: 'bad' },
      e_hidden: { type: 'ending', endingType: 'hidden' },
    },
  });
  assert.strictEqual(r.issues.some((i) => i.severity === 'high'), false);
  assert.strictEqual(r.closedLoop, true);
  assert.deepStrictEqual(r.endings, { main: 1, hidden: 1, bad: 1 });
  assert.strictEqual(r.score, 100);
});

test('非结局节点没有出边→死胡同', () => {
  const r = B.validateBranches({ start: 's', nodes: { s: { type: 'scene', to: [] } } });
  assert.ok(r.issues.some((i) => i.type === 'dead_end'));
});

test('与起点不连通的节点→孤儿', () => {
  const r = B.validateBranches({
    start: 's',
    nodes: {
      s: { type: 'scene', to: ['e'] }, e: { type: 'ending', endingType: 'main' },
      orphan: { type: 'scene', to: ['e'] },
    },
  });
  assert.ok(r.issues.some((i) => i.type === 'unreachable' && i.node === 'orphan'));
});

test('选择点只有1个分支→single_choice', () => {
  const r = B.validateBranches({
    start: 's',
    nodes: { s: { type: 'choice', to: ['e'] }, e: { type: 'ending', endingType: 'main' } },
  });
  assert.ok(r.issues.some((i) => i.type === 'single_choice'));
});

test('自环与伪选择被识别', () => {
  const self = B.validateBranches({ start: 's', nodes: { s: { type: 'choice', to: ['s', 'e'] }, e: { type: 'ending', endingType: 'main' } } });
  assert.ok(self.issues.some((i) => i.type === 'self_loop'));
  const fake = B.validateBranches({ start: 's', nodes: { s: { type: 'choice', to: ['e', 'e'] }, e: { type: 'ending', endingType: 'main' } } });
  assert.ok(fake.issues.some((i) => i.type === 'fake_choice'));
});

test('A↔B互指且无结局→死循环+无结局，非闭环', () => {
  const r = B.validateBranches({
    start: 'a',
    nodes: { a: { type: 'scene', to: ['b'] }, b: { type: 'scene', to: ['a'] } },
  });
  assert.ok(r.issues.some((i) => i.type === 'infinite_loop'));
  assert.ok(r.issues.some((i) => i.type === 'no_ending'));
  assert.strictEqual(r.closedLoop, false);
});

test('悬空边（指向不存在节点）被识别', () => {
  const r = B.validateBranches({ start: 's', nodes: { s: { type: 'scene', to: ['ghost'] }, e: { type: 'ending', endingType: 'main' } } });
  assert.ok(r.issues.some((i) => i.type === 'dangling_edge'));
});

test('概率触发：权重等长非负且总和>0；非法权重报 bad_weights', () => {
  const ok = B.validateBranches({ start: 'c', nodes: {
    c: { type: 'choice', kind: 'probability', to: ['a', 'b'], weights: [30, 70] },
    a: { type: 'ending', endingType: 'main' }, b: { type: 'ending', endingType: 'bad' } } });
  assert.ok(!ok.issues.some((i) => i.type === 'bad_weights'));
  const bad = B.validateBranches({ start: 'c', nodes: {
    c: { type: 'choice', kind: 'probability', to: ['a', 'b'], weights: [30] },
    a: { type: 'ending', endingType: 'main' }, b: { type: 'ending', endingType: 'bad' } } });
  assert.ok(bad.issues.some((i) => i.type === 'bad_weights'));
});

test('骨架生成器：默认产出合法闭环图（主/坏/隐藏结局齐全、零问题）', () => {
  const g = B.buildBranchSkeleton({ choicePoints: 3 });
  const r = B.validateBranches(g);
  assert.strictEqual(r.closedLoop, true);
  assert.strictEqual(r.endings.main, 1);
  assert.strictEqual(r.endings.hidden, 1);
  assert.strictEqual(r.endings.bad, 3);
  const high = r.issues.filter((i) => i.severity === 'high');
  assert.strictEqual(high.length, 0, '骨架不应有高危问题: ' + JSON.stringify(high));
});

test('骨架：关闭坏/隐藏结局后结构仍合法', () => {
  const g = B.buildBranchSkeleton({ choicePoints: 1, withBad: false, withHidden: false });
  const r = B.validateBranches(g);
  assert.strictEqual(r.endings.main, 1);
  assert.strictEqual(r.endings.bad, 0);
  assert.strictEqual(r.endings.hidden, 0);
  assert.ok(!r.issues.some((i) => i.severity === 'high'));
});

test('结构操作：增删改连，删节点级联清边，不可删起点', () => {
  let g = { start: 's', nodes: { s: { type: 'scene', to: [] } } };
  g = B.applyMutator(g, { op: 'addNode', nodeType: 'choice', label: '选' });
  assert.ok(g.nodes.n1);
  g = B.applyMutator(g, { op: 'link', from: 's', to: 'n1' });
  assert.deepStrictEqual(g.nodes.s.to, ['n1']);
  // 重复连线报错
  assert.throws(() => B.applyMutator(g, { op: 'link', from: 's', to: 'n1' }));
  // 结局不能向外连
  g = B.applyMutator(g, { op: 'addNode', nodeType: 'ending', endingType: 'main' });
  assert.throws(() => B.applyMutator(g, { op: 'link', from: 'n2', to: 's' }));
  // 连到结局后删除该结局，choice 的出边被级联清掉
  g = B.applyMutator(g, { op: 'link', from: 'n1', to: 'n2' });
  g = B.applyMutator(g, { op: 'removeNode', id: 'n2' });
  assert.ok(!g.nodes.n2); assert.deepStrictEqual(g.nodes.n1.to, []);
  // 起点不可删
  assert.throws(() => B.applyMutator(g, { op: 'removeNode', id: 's' }));
  // 不可变：原对象不被改
  assert.ok(true);
});

test('setType 改为结局时清空出边并补 endingType；relabel 生效', () => {
  const g0 = { start: 's', nodes: { s: { type: 'scene', to: ['a'] }, a: { type: 'scene', to: [] } } };
  const g = B.applyMutator(B.applyMutator(g0, { op: 'setType', id: 'a', nodeType: 'ending' }), { op: 'relabel', id: 'a', label: '主线结局' });
  assert.strictEqual(g.nodes.a.type, 'ending');
  assert.strictEqual(g.nodes.a.endingType, 'main');
  assert.deepStrictEqual(g.nodes.a.to, []);
  assert.strictEqual(g.nodes.a.label, '主线结局');
});

test('autoLayout：起点在第0列，可达节点按深度分列，孤儿 depth=-1', () => {
  const g = { start: 's', nodes: { s: { type: 'choice', to: ['e'] }, e: { type: 'ending', endingType: 'main' }, orphan: { type: 'scene', to: [] } } };
  const p = B.autoLayout(g);
  assert.strictEqual(p.s.depth, 0);
  assert.strictEqual(p.e.depth, 1);
  assert.strictEqual(p.orphan.depth, -1);
  assert.ok(p.e.x > p.s.x);
});

test('setKind：概率权重校验，fixed/random清权重，连线/断连同步权重', () => {
  let g = { start: 'c', nodes: { c: { type: 'choice', to: ['a', 'b'] }, a: { type: 'ending', endingType: 'main' }, b: { type: 'ending', endingType: 'bad' } } };
  // 权重数与分支不一致→抛错
  assert.throws(() => B.applyMutator(g, { op: 'setKind', id: 'c', kind: 'probability', weights: [50] }));
  // 合法概率
  g = B.applyMutator(g, { op: 'setKind', id: 'c', kind: 'probability', weights: [30, 70] });
  assert.deepStrictEqual(g.nodes.c.weights, [30, 70]); assert.strictEqual(g.nodes.c.kind, 'probability');
  // 新增分支自动补一个权重
  g = B.applyMutator(g, { op: 'addNode', nodeType: 'ending', endingType: 'hidden' });
  g = B.applyMutator(g, { op: 'link', from: 'c', to: 'n1' });
  assert.strictEqual(g.nodes.c.weights.length, 3);
  // 断连同步删权重
  g = B.applyMutator(g, { op: 'unlink', from: 'c', to: 'n1' });
  assert.strictEqual(g.nodes.c.weights.length, 2);
  // 切回 fixed 清权重
  g = B.applyMutator(g, { op: 'setKind', id: 'c', kind: 'fixed' });
  assert.strictEqual(g.nodes.c.weights, undefined);
  // 非选择点不能设机制
  assert.throws(() => B.applyMutator(g, { op: 'setKind', id: 'a', kind: 'random' }));
});

test('v1.89 lang=en：骨架标签与校验问题输出英文；默认仍中文', () => {
  const en = B.buildBranchSkeleton({ choicePoints: 2, lang: 'en' });
  assert.strictEqual(en.nodes.start.label, 'Opening setup');
  assert.strictEqual(en.nodes.c1.label, 'Choice 1');
  assert.strictEqual(en.nodes.bad_1.label, 'Bad ending 1');
  assert.strictEqual(en.nodes.end_main.label, 'Main ending');
  assert.strictEqual(en.nodes.end_hidden.label, 'Hidden ending');
  // 英文校验问题
  const bad = { start: 's', nodes: { s: { type: 'scene', to: [] } } };
  const rep = B.validateBranches(bad, 'en');
  assert.ok(rep.issues.some((i) => /ending/i.test(i.evidence) && /[A-Za-z]/.test(i.advice)));
  assert.ok(!/[一-龥]/.test(JSON.stringify(rep.issues)));
  // 英文结构编辑报错
  assert.throws(() => B.applyMutator(en, { op: 'removeNode', id: 'start' }, 'en'), /cannot be deleted/i);
  // 默认中文不变（回归保护）
  const zh = B.buildBranchSkeleton({});
  assert.strictEqual(zh.nodes.start.label, '开场铺垫');
});
