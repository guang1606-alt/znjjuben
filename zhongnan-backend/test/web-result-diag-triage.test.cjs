/**
 * v2.702 结果页诊断分层：19 张诊断卡同级平铺 → 「先看几项 + 其余折叠」
 *
 * 真实缺口：一次出本后，结果页会同时亮出最多 19 张 `.notice` 诊断条（合规改写/抽检/
 * 模式闸门/改稿尺子/创作深度/赛道/标题传播力/每集三问/开场四要素/六维评分卡/流派/
 * 资方/微节拍/伏笔/弧光/爆款逆向…）。它们视觉权重完全相同、按代码书写顺序排列，
 * 首屏第一眼既不知道「哪张最急」，也不知道「有没有已经通过的」——作者只能从头往下逐张读，
 * 十几屏之后才开始看剧本正文；而真正拦路的（标红）可能排在第 8 张。
 *
 * 修复口径：渲染完成后按「卡里已渲染出的严重度」做一次分层（不重复各渲染器的判断逻辑）：
 *   · 标红（--danger-text / --cinnabar / ✗）→ 急，最多 3 张直接展开，按严重度优先；
 *   · 标黄（--grade-warn / --warn-text / --gold / ⚠）→ 在名额未满时补位；
 *   · 其余（纯参考/已通过）→ 全部折进「其余 N 项」，默认收起、一键展开；
 *   · 一张红的都没有时首屏只留一行「本轮无硬伤」，不再让 19 张同权卡糊成一片。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function extract(name) {
  let found = null;
  (function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === name) found = node.getText(ast);
    ts.forEachChild(node, visit);
  })(ast);
  return found;
}

function extractConst(name) {
  let found = null;
  (function visit(node) {
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (d.name && d.name.text === name) found = node.getText(ast);
      }
    }
    ts.forEachChild(node, visit);
  })(ast);
  return found;
}

/** 最小 DOM 桩：保留 children 顺序，供「卡片被搬进哪个层」的断言 */
function makeDom() {
  const nodes = new Map();
  const cls = new Map();
  function el(id, classes) {
    const set = new Set(classes || []);
    cls.set(id, set);
    const node = {
      id,
      children: [],
      innerHTML: '',
      textContent: '',
      _attrs: {},
      classList: {
        contains: (n) => set.has(n),
        add: (...ns) => ns.forEach((n) => set.add(n)),
        remove: (...ns) => ns.forEach((n) => set.delete(n)),
        toggle(n, force) {
          const on = force === undefined ? !set.has(n) : !!force;
          if (on) set.add(n); else set.delete(n);
          return on;
        },
      },
      setAttribute(k, v) { this._attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
      appendChild(child) { this.children.push(child); return child; },
      querySelector: () => null,
      onclick: null,
    };
    nodes.set(id, node);
    return node;
  }
  return { nodes, cls, el };
}

const ALL_IDS = [
  'diagTriage', 'diagTierCore', 'diagCoreHead', 'diagTierRest', 'diagRestToggle', 'diagRestLabel', 'diagRestList',
  'sandboxTip', 'complianceTip', 'aiLabelTip', 'filingTip', 'postScanTip', 'modeGateTip',
  'craftLintTip', 'craftDepthTip', 'trackTip', 'titlePitchTip', 'epThreeQTip', 'openingCheckTip',
  'scorecardTip', 'genresTip', 'investorTip', 'aigcBeatTip', 'foreshadowTip', 'arcTrackTip', 'hitTeardownTip',
];

function setup(extra = {}) {
  const dom = makeDom();
  for (const id of ALL_IDS) dom.el(id, ['hidden']);
  const context = {
    lang: 'zh',
    $: (id) => dom.nodes.get(id) || null,
    t: (k, vars) => (vars ? Object.entries(vars).reduce((s, [n, v]) => s.split('{' + n + '}').join(String(v)), k) : k),
    console,
    ...extra,
  };
  vm.createContext(context);
  const ids = extractConst('RESULT_DIAG_IDS');
  assert.ok(ids, 'app.js 缺少常量 RESULT_DIAG_IDS（结果页诊断卡登记表被删/改名）');
  vm.runInContext(ids, context);
  for (const name of ['DIAG_DECOR_IDS', 'DIAG_FLOOR', 'DIAG_ACTION_IDS']) {
    const code = extractConst(name);
    assert.ok(code, `app.js 缺少常量 ${name}（分层策略表被删/改名）`);
    vm.runInContext(code, context);
  }
  for (const name of ['diagCardSeverity', 'triageDiagCards', 'setDiagRestOpen', 'arrangeResultDiag']) {
    const code = extract(name);
    assert.ok(code, `app.js 缺少函数 ${name}（本轮契约函数被删/改名，需同步本测试）`);
    vm.runInContext(code, context);
  }
  return { c: context, dom };
}

describe('v2.702 结果页诊断分层', { concurrency: 1 }, () => {
  it('① 结构契约：分层容器 + 默认收起的「其余」折叠条（带无障碍属性）', () => {
    assert.match(html, /id="diagTriage"/, 'index.html 缺少诊断分层容器');
    assert.match(html, /id="diagTierCore"/, '缺少「先看几项」层');
    assert.match(html, /id="diagRestList"/, '缺少「其余」层列表');
    assert.match(html, /id="diagRestToggle"[^>]*aria-expanded="false"/, '其余项折叠按钮必须初始 aria-expanded=false');
    assert.match(html, /aria-controls="diagRestList"/, '折叠按钮须用 aria-controls 关联列表');
    const box = html.indexOf('id="diagTriage"');
    assert.ok(box > html.indexOf('id="diagPanel"'), '分层容器应排在六维诊断面板之后（先给总分，再给分层明细）');
    assert.ok(box < html.indexOf('id="sandboxTip"'), '分层容器必须在诊断卡群之前，卡片才能被搬进去');
  });

  it('② 严重度只从「卡里已渲染出的信号」反推，不另造一套判断', () => {
    const { c } = setup();
    assert.strictEqual(c.diagCardSeverity('<b style="color:var(--danger-text)">缺项</b>'), 3, '标红=急');
    assert.strictEqual(c.diagCardSeverity('想要✗ 阻拦✓'), 3, '打叉同样代表缺项');
    assert.strictEqual(c.diagCardSeverity('<b style="color:var(--grade-warn)">偏弱</b>'), 2, '标黄=注意');
    assert.strictEqual(c.diagCardSeverity('⚠ 合规改写法建议'), 2, '警示符号=注意');
    assert.strictEqual(c.diagCardSeverity('<b style="color:var(--grade-good)">良好</b>'), 1, '全通过=参考');
    assert.strictEqual(c.diagCardSeverity('   '), 0, '空卡不计入分层');
    assert.strictEqual(c.diagCardSeverity(undefined), 0);
  });

  it('③ 急事先上桌：标红优先、最多 3 张，同级保持既有书写顺序', () => {
    const { c } = setup();
    const r = c.triageDiagCards([
      { id: 'genresTip', html: '流派匹配：都市' },
      { id: 'scorecardTip', html: '<b style="color:var(--danger-text)">60/100</b>' },
      { id: 'trackTip', html: '市场赛道：下沉剧' },
      { id: 'craftLintTip', html: '<b style="color:var(--danger-text)">76/100 · 3 处硬伤</b>' },
      { id: 'epThreeQTip', html: '想要✗ 阻拦✓ 追更✗' },
      { id: 'genresTip2', html: '流派匹配：逆袭' },
    ]);
    assert.deepStrictEqual(Array.from(r.core, (x) => x.id), ['scorecardTip', 'craftLintTip', 'epThreeQTip'],
      '首屏必须是三张标红卡，且按书写顺序（同为「急」时先出现的先看）');
    assert.deepStrictEqual(Array.from(r.rest, (x) => x.id).sort(), ['genresTip', 'genresTip2', 'trackTip'], '其余项一张都不能丢');
    assert.strictEqual(r.riskCount, 3);
    assert.strictEqual(r.total, 6);
  });

  it('④ 红卡不足 3 张时用「注意」级补位；全通过时首屏不顶任何卡', () => {
    const { c } = setup();
    const some = c.triageDiagCards([
      { id: 'craftLintTip', html: '✗ 硬伤 2 处' },
      { id: 'trackTip', html: '市场赛道：下沉剧' },
      { id: 'titlePitchTip', html: '<b style="color:var(--grade-warn)">66/100</b>' },
      { id: 'genresTip', html: '流派匹配：都市' },
    ]);
    assert.deepStrictEqual(Array.from(some.core, (x) => x.id), ['craftLintTip', 'titlePitchTip'], '红卡之后由注意级补位，纯参考卡不上首屏');
    const allOk = c.triageDiagCards([
      { id: 'genresTip', html: '流派匹配：都市' },
      { id: 'trackTip', html: '市场赛道：下沉剧' },
    ]);
    assert.strictEqual(Array.from(allOk.core).length, 0, '没有需要处理的项，首屏不留卡片');
    assert.strictEqual(allOk.rest.length, 2, '参考项全部折进「其余」');
    assert.strictEqual(allOk.riskCount, 0);
  });

  it('⑤ 搬运接线：可见卡按分层搬进对应层，其余层默认收起，点击才展开', () => {
    const { c, dom } = setup();
    const put = (id, content) => { const n = dom.nodes.get(id); n.innerHTML = content; n.classList.remove('hidden'); };
    put('craftLintTip', '<b style="color:var(--danger-text)">70/100</b>');
    put('scorecardTip', '<b style="color:var(--danger-text)">58/100</b>');
    put('trackTip', '市场赛道：下沉剧');
    put('genresTip', '流派匹配：都市');
    // sandboxTip 等保持 hidden：隐藏卡不得进入分层（否则「其余 19 项」里全是没触发的东西）
    c.arrangeResultDiag();
    const core = dom.nodes.get('diagTierCore');
    const rest = dom.nodes.get('diagTierRest');
    const list = dom.nodes.get('diagRestList');
    assert.deepStrictEqual(core.children.map((x) => x.id), ['craftLintTip', 'scorecardTip'], '首屏只留标红卡（同为急时按既有书写顺序）');
    assert.deepStrictEqual(list.children.map((x) => x.id), ['trackTip', 'genresTip'], '参考卡折进其余层');
    assert.strictEqual(dom.nodes.get('diagTriage').classList.contains('hidden'), false, '有卡时分层容器必须可见');
    assert.strictEqual(rest.classList.contains('collapsed'), true, '其余层默认收起（首屏不能再平铺）');
    assert.strictEqual(dom.nodes.get('diagRestToggle').getAttribute('aria-expanded'), 'false');
    assert.strictEqual(dom.nodes.get('diagRestLabel').textContent, 'diagTriageRest', '折叠条要写明还有几项（模板文案带 {n}）');
    dom.nodes.get('diagRestToggle').onclick();
    assert.strictEqual(rest.classList.contains('collapsed'), false, '点击必须真的展开');
    assert.strictEqual(dom.nodes.get('diagRestToggle').getAttribute('aria-expanded'), 'true');
    assert.strictEqual(dom.nodes.get('diagRestLabel').textContent, 'diagTriageCollapse');
  });

  it('⑥ 没有可见诊断卡 / 全部通过 → 不渲染空壳，且给出「无硬伤」结论行', () => {
    const { c, dom } = setup();
    c.arrangeResultDiag();
    assert.strictEqual(dom.nodes.get('diagTriage').classList.contains('hidden'), true, '一屏没卡就不该出现空容器');
    const n = dom.nodes.get('genresTip');
    n.innerHTML = '流派匹配：都市';
    n.classList.remove('hidden');
    c.arrangeResultDiag();
    assert.strictEqual(dom.nodes.get('diagTriage').classList.contains('hidden'), false);
    assert.deepStrictEqual(dom.nodes.get('diagTierCore').children, [], '全通过时首屏不顶卡');
    assert.strictEqual(dom.nodes.get('diagCoreHead').textContent, 'diagTriageOk', '全通过要一句话给结论');
    assert.strictEqual(dom.nodes.get('diagRestLabel').textContent, 'diagTriageRest');
  });

  it('⑦ 登记表覆盖结果页全部诊断条（新增一张卡忘了登记就会重新平铺）', () => {
    const panel = html.slice(html.indexOf('id="resultPanel"'), html.indexOf('id="scriptText"'));
    const ids = [...panel.matchAll(/<div class="notice[^"]*"(?:\s+id|[\s\S]{0,120}?\bid)="([A-Za-z]+Tip|modeGateTip)"/g)].map((m) => m[1]);
    const ids2 = [...panel.matchAll(/class="notice[^"]*"\s+id="([A-Za-z]+)"/g)].map((m) => m[1]);
    const declared = new Set([...ids, ...ids2].filter((x) => /Tip$/.test(x)));
    const listSrc = extractConst('RESULT_DIAG_IDS');
    for (const id of declared) {
      assert.ok(listSrc.includes(`'${id}'`), `结果页诊断条 #${id} 未登记进 RESULT_DIAG_IDS，仍会与其余卡同级平铺`);
    }
    assert.ok(declared.size >= 15, `结果页诊断条解析数异常（${declared.size}），守卫解析失效`);
    const rr = source.slice(source.indexOf('async function renderResult'), source.indexOf('async function refreshResultScripts'));
    assert.match(rr, /arrangeResultDiag\(\)/, 'renderResult 末尾必须执行分层，否则新生成的结果页仍是平铺');
  });

  it('⑧ 样式与文案契约：令牌配色、窄屏单列、展开动画尊重 reduced-motion、中英双语', () => {
    const start = css.indexOf('/* v2.702 结果页诊断分层');
    const end = css.indexOf('/* ================= 登录 / 模态');
    assert.ok(start >= 0 && end > start, 'styles.css 缺少 v2.702 诊断分层样式块');
    const seg = css.slice(start, end);
    assert.ok(seg.length > 300, '分层样式块过短');
    assert.doesNotMatch(seg, /#[0-9a-fA-F]{3,8}\b/, '分层配色不得写死色值，必须引用主题令牌');
    assert.match(seg, /@media\s*\(prefers-reduced-motion:\s*no-preference\)/, '展开动画必须挂在 no-preference 下');
    assert.match(seg, /@media\s*\(max-width:\s*560px\)/, '窄屏需单独收紧折叠条与卡片间距');
    assert.match(seg, /margin-top:\s*0/, '卡片搬进分层后须清掉 .notice 的 12px 上边距，否则层内间距翻倍');
    for (const key of ['diagTriageCore', 'diagTriageOk', 'diagTriageRest', 'diagTriageCollapse', 'diagTriageToggleAria']) {
      const hits = i18n.split(key + ':').length - 1;
      assert.ok(hits >= 2, `i18n.js 中 ${key} 必须中英各一份（当前 ${hits} 处）`);
    }
  });
});
