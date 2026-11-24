const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// v2.682 创作二级界面的语言一致性：
// - 动态块（日记授权 / 第一人称 / 双人对撞 / 世界线）与侧栏建议过去是硬编码中文，
//   英文界面下整块正文仍是中文；
// - 更隐蔽的是切换语言时 applyLang 只刷 data-i，已打开的二级界面标题/描述/动态块不重建，
//   顶部导航已变英文、正文还是中文。
// 这里用 AST 抽取 _renderModeBody / _sideBlocks 做行为断言，再用源码约束守住重建链路。

const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map(), initializers = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  if (ts.isVariableDeclaration(node) && node.initializer) initializers.set(node.name.getText(ast), node.initializer.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);

function makeEl() {
  const node = {
    className: '', children: [], parentNode: null,
    textContent: '', value: '', checked: false, type: '',
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = node; node.children.push(c); return c; },
    removeChild(c) { const i = node.children.indexOf(c); if (i >= 0) node.children.splice(i, 1); c.parentNode = null; return c; },
    querySelector(sel) {
      node._qs = node._qs || {};
      if (!node._qs[sel]) node._qs[sel] = makeEl();
      return node._qs[sel];
    },
    setAttribute() {}, addEventListener() {}, focus() {},
  };
  Object.defineProperty(node, 'innerHTML', {
    get() { return node._html || ''; },
    set(v) { node._html = v; },
  });
  return node;
}

function render(modeId, lang) {
  const code = `
    const _sideBlocks = ${functions.get('_sideBlocks')};
    const _renderModeBody = ${initializers.get('_renderModeBody')};
    this.__api = { _renderModeBody };
  `;
  const ctx = vm.createContext({
    lang,
    document: { createElement: () => makeEl() },
    window: {},
  });
  vm.runInContext(code, ctx);
  const main = makeEl(), side = makeEl();
  ctx.__api._renderModeBody[modeId](modeId, main, side);
  return {
    main, side,
    mainHtml: main.children.map((c) => c.innerHTML).join('\n'),
    sideHtml: side.children.map((c) => c.children.map((g) => g.innerHTML).join('\n')).join('\n'),
    hasSide: side.children.length > 0,
  };
}

test('英文日记授权块渲染英文档位与说明，不再混中文', () => {
  const en = render('diary', 'en');
  assert.match(en.mainHtml, /Commit authorization/, '缺少英文授权标题');
  assert.match(en.mainHtml, /Summary only/, '缺少英文摘要档');
  assert.match(en.mainHtml, /Selected passages/, '缺少英文指定段落档');
  assert.match(en.mainHtml, /Everything/, '缺少英文全部放行档');
  assert.ok(!/落稿授权|仅摘要|指定段落|全部放行/.test(en.mainHtml), '英文界面仍残留中文档位');
  assert.match(en.sideHtml, /Privacy promise/, '侧栏隐私承诺未英文化');
  assert.ok(!/隐私承诺|推荐做法/.test(en.sideHtml), '英文侧栏仍残留中文');

  const zh = render('diary', 'zh');
  assert.match(zh.mainHtml, /落稿授权/, '中文界面丢了原有中文标题');
  assert.match(zh.sideHtml, /隐私承诺/, '中文界面丢了原有侧栏');
});

test('英文第一人称与双人对撞块全部字段英文化', () => {
  const persona = render('persona', 'en');
  assert.match(persona.mainHtml, /First-person narrator/);
  assert.match(persona.mainHtml, /Who they are/);
  assert.match(persona.mainHtml, /What they want most/);
  assert.match(persona.mainHtml, /What they fear most/);
  assert.match(persona.mainHtml, /The lie they may tell themselves/);
  assert.ok(!/第一人称叙述者|他 \/ 她是谁/.test(persona.mainHtml), '英文第一人称仍残留中文');

  const duel = render('duel', 'en');
  assert.match(duel.mainHtml, /Head-to-head/);
  assert.match(duel.mainHtml, /cannot retreat/);
  assert.match(duel.mainHtml, /Why they cannot retreat/);
  assert.ok(!/双人对撞|不可退让|为什么不能退/.test(duel.mainHtml), '英文双人对撞仍残留中文');
  assert.match(duel.sideHtml, /Trading moves/);
});

test('英文世界线块含英文标题、路线与代价字段', () => {
  const mv = render('multiverse', 'en');
  // 世界线在现有迷你 DOM 里拿不到 #mvChoices，行内容用源码约束兜底
  assert.match(source, /'Worldline' : '世界线'/, '世界线标题缺英文分支');
  assert.match(source, /'Which path' : '走哪条路'/, '路线字段缺英文分支');
  assert.match(source, /'What it costs' : '代价是什么'/, '代价字段缺英文分支');
  assert.match(source, /'\+ Add a worldline \(2–4\)' : '\+ 再加一条世界线（2-4 条）'/, '新增世界线按钮缺英文分支');
  assert.match(mv.mainHtml, /Pivotal choice/, '世界线主标题未英文化');
});

test('切换语言会重建已打开的二级界面并回填输入', () => {
  assert.match(source, /document\.addEventListener\('zn-lang',\s*\(\)\s*=>\s*\{[\s\S]{0,600}?showModeDetail\(_modeDetailMode\)/, '切语言未重建二级界面');
  assert.match(source, /const snap = _snapshotModeDetail\(\);/, '重建前没有快照输入');
  assert.match(source, /showModeDetail\(_modeDetailMode\);[\s\S]{0,120}?_restoreModeDetail\(snap\);/, '重建后没有回填输入');
  // 工作台弹层开着时不重建，避免顺手关掉用户正在用的弹层
  assert.match(source, /workbenchLayer[\s\S]{0,120}?classList\.contains\('hidden'\)/, '缺少弹层保护');
});

test('动态块底色随主题走，暗色下不再浅底浅字', () => {
  const css = fs.readFileSync(path.join(__dirname, '../web/styles.css'), 'utf8');
  for (const sel of ['.persona-card', '.duel-col', '.multiverse-choice', '.diary-auth']) {
    const block = new RegExp('\\' + sel + '\\{[^}]*background:color-mix\\(insrgb,var\\(--mode-accent[^)]*\\)8%,var\\(--panel')
      .test(css.replace(/\s+/g, ''));
    assert.ok(block, sel + ' 仍使用固定浅底，暗色主题会出现浅底浅字');
  }
  assert.match(css, /\.duel-col h4\s*\{[^}]*color:\s*color-mix\(in srgb, var\(--mode-accent/, '双人栏标题在暗色下仍是深色，对比不足');
  assert.match(css, /\.multiverse-choice h4\s*\{[^}]*color:\s*color-mix\(in srgb, var\(--mode-accent/, '世界线标题在暗色下仍是深色，对比不足');
  // 说明块不再套一层 .mode-detail-side：暗色下那层容器会用 --surface 的浅色兜底
  assert.match(source, /side\.className = 'mode-detail-blocks dyn-mode-block'/, '说明块仍复用 .mode-detail-side 容器');
  assert.match(css, /\.mode-detail-blocks\s*\{[^}]*display:\s*flex/, '说明块缺少独立排布样式');
  // 生成配置整体 sticky 会盖住上方说明块，必须随页面滚动
  assert.match(css, /\.mode-detail-side #genConfigBar\s*\{[^}]*position:\s*static/, '生成配置仍整体 sticky，长配置会遮住说明块');
  assert.ok(!/\.mode-detail-side #genConfigBar\s*\{[^}]*position:\s*sticky/.test(css), '仍存在 sticky 规则');
});
