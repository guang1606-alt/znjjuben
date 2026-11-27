/**
 * v2.701 结果页「创作回执」（系统据以创作的创意原文要交还给用户核对）
 *
 * 真实缺口：标签创建 / 自动匹配 / 三种结构化模式（角色自述·双人对撞·世界线推演）都会在
 * 前端或服务端「合成」一份最终简报交给模型，但这份文字对用户全程不可见——
 *   · 角色自述等结构化模式的简报是程序拼的句子，字段留空会变成「（待定）」；
 *   · 标签模式只记标签，用户不知道自己写的标签被拼成了什么；
 *   · 自动匹配只告知「匹配到什么模式」，不展示「据此创作的创意」。
 * 生成结果不符合预期时，作者无法区分「简报被理解偏」还是「生成跑偏」，只能盲目重开（白耗积分）。
 *
 * 修复口径：结果页顶部一条可折叠的「创作回执」，展示本次真正提交的简报原文 + 模式名 +
 * 系统合成标记，支持复制后改版重开；正文用 textContent 落地（自由文本不当 HTML 解析）。
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

/** 抽取顶层 const 声明（函数依赖的同文件常量，如「哪些模式算系统合成」） */
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

/** 最小 DOM 桩：只实现本组函数真正用到的类/属性方法 */
function makeDom() {
  const nodes = new Map();
  const initial = {
    briefReceipt: ['brief-receipt', 'hidden'],
    briefReceiptBody: ['br-body', 'collapsed'],
    briefReceiptSync: ['br-sync', 'hidden'],
  };
  for (const id of ['briefReceipt', 'briefReceiptMode', 'briefReceiptBody', 'briefReceiptSync', 'briefReceiptToggle', 'briefReceiptCopy']) {
    const cls = new Set(initial[id] || []);
    nodes.set(id, {
      id,
      textContent: '',
      innerHTML: '',
      _attrs: {},
      classList: {
        contains: (n) => cls.has(n),
        add: (n) => cls.add(n),
        remove: (n) => cls.delete(n),
        toggle(n, force) {
          const on = force === undefined ? !cls.has(n) : !!force;
          if (on) cls.add(n); else cls.delete(n);
          return on;
        },
      },
      setAttribute(k, v) { this._attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
      onclick: null,
    });
  }
  return { nodes, $: (id) => nodes.get(id) || null };
}

function setup(names, extra = {}) {
  const dom = makeDom();
  const I18N = {
    MODES: [{ id: 'tag' }, { id: 'auto' }],
    DICT: {
      zh: { mode: { tag: '标签创建', auto: '自动匹配' } },
      en: { mode: { tag: 'Tags by combination', auto: 'Auto match' } },
    },
  };
  const context = {
    lang: 'zh',
    $: dom.$,
    t: (k) => k,
    copy: () => Promise.resolve(true),
    flashCopied: () => {},
    window: { I18N },
    I18N,
    console,
    ...extra,
  };
  vm.createContext(context);
  const constSrc = extractConst('SYNTH_RECEIPT_MODES');
  assert.ok(constSrc, 'app.js 缺少常量 SYNTH_RECEIPT_MODES（系统合成模式清单被删/改名）');
  vm.runInContext(constSrc, context);
  for (const name of names) {
    const code = extract(name);
    assert.ok(code, `app.js 缺少函数 ${name}（本轮契约函数被删/改名，需同步本测试）`);
    vm.runInContext(code, context);
  }
  return { c: context, dom };
}

describe('v2.701 结果页创作回执', { concurrency: 1 }, () => {
  it('① 结构契约：结果页有可折叠回执条，默认折叠且带无障碍属性', () => {
    assert.match(html, /id="briefReceipt"/, 'index.html 缺少回执卡容器');
    assert.match(html, /id="briefReceiptBody"/, '缺少简报正文节点');
    assert.match(html, /id="briefReceiptMode"/, '缺少模式名节点（用户要知道这次用的是哪个模式）');
    assert.match(html, /id="briefReceiptSync"[^>]*data-i="briefReceiptSync"/, '缺少「系统合成」标记节点');
    assert.match(html, /id="briefReceiptToggle"[^>]*aria-expanded="false"/, '展开按钮必须初始 aria-expanded=false');
    assert.match(html, /aria-controls="briefReceiptBody"/, '展开按钮须用 aria-controls 关联正文');
    assert.match(html, /id="briefReceiptCopy"/, '缺少复制按钮（复制后改版重开是唯一低成本纠偏路径）');
    const box = html.slice(html.indexOf('id="briefReceipt"') - 200, html.indexOf('id="briefReceipt"'));
    assert.match(box, /hidden/, '回执条必须默认隐藏，只在有简报时出现');
    assert.ok(html.indexOf('id="briefReceipt"') < html.indexOf('id="scoreGrid"'), '回执必须排在评分之前：先让用户核对「创意是否被读懂」，再看评分');
  });

  it('② 正文用 textContent 落地：自由文本不得当 HTML 解析（防注入/防排版破坏）', () => {
    const { c, dom } = setup(['renderBriefReceipt', 'setReceiptExpanded']);
    const brief = '标签组合：霸总、重生\n一句话创意：<b>她</b>被夺走署名权 <script>x</script>';
    c.renderBriefReceipt(brief, 'tag');
    const body = dom.nodes.get('briefReceiptBody');
    assert.strictEqual(body.textContent, brief, '正文必须原样展示简报');
    assert.strictEqual(body.innerHTML, '', '正文不得通过 innerHTML 注入未转义文本');
    assert.strictEqual(dom.nodes.get('briefReceipt').classList.contains('hidden'), false, '有简报时回执必须可见');
  });

  it('③ 空简报 → 整条回执隐藏（不渲染空壳）', () => {
    const { c, dom } = setup(['renderBriefReceipt', 'setReceiptExpanded']);
    c.renderBriefReceipt('   ', 'auto');
    assert.strictEqual(dom.nodes.get('briefReceipt').classList.contains('hidden'), true);
    c.renderBriefReceipt(undefined, 'auto');
    assert.strictEqual(dom.nodes.get('briefReceipt').classList.contains('hidden'), true);
  });

  it('④ 系统合成模式标「系统合成」，用户亲写的模式不标', () => {
    const { c, dom } = setup(['renderBriefReceipt', 'setReceiptExpanded']);
    for (const mode of ['tag', 'persona', 'duel', 'multiverse']) {
      c.renderBriefReceipt('x', mode);
      assert.strictEqual(dom.nodes.get('briefReceiptSync').classList.contains('hidden'), false, `${mode} 的简报是系统拼的，必须标记`);
    }
    for (const mode of ['auto', 'interview', 'hot', 'spark']) {
      c.renderBriefReceipt('x', mode);
      assert.strictEqual(dom.nodes.get('briefReceiptSync').classList.contains('hidden'), true, `${mode} 是用户自己写的，不应误标系统合成`);
    }
  });

  it('⑤ 展开/收起：正文折叠态与 aria-expanded 同步，按钮文案随状态切换', () => {
    const { c, dom } = setup(['renderBriefReceipt', 'setReceiptExpanded']);
    c.renderBriefReceipt('x', 'tag');
    const body = dom.nodes.get('briefReceiptBody');
    const btn = dom.nodes.get('briefReceiptToggle');
    const box = dom.nodes.get('briefReceipt');
    assert.strictEqual(body.classList.contains('collapsed'), true, '默认折叠');
    c.setReceiptExpanded(true);
    assert.strictEqual(body.classList.contains('collapsed'), false);
    assert.strictEqual(btn.getAttribute('aria-expanded'), 'true');
    assert.strictEqual(box.classList.contains('expanded'), true, '展开态挂在容器上，供提示行与全文显示');
    assert.strictEqual(btn.textContent, 'briefReceiptCollapse');
    c.setReceiptExpanded(false);
    assert.strictEqual(btn.textContent, 'briefReceiptExpand');
    // 按钮点击必须真的切换（不能只画个箭头）
    btn.onclick();
    assert.strictEqual(btn.getAttribute('aria-expanded'), 'true');
  });

  it('⑥ 接线：done 事件把会话简报原文与模式一起交给 renderResult', () => {
    assert.match(source, /renderResult\(data,\s*session\.projectId,\s*session\)/, 'done 事件必须把整个会话（含简报原文）交给 renderResult');
    const seg = source.slice(source.indexOf('const session = {'), source.indexOf('const session = {') + 500);
    assert.match(seg, /mode:\s*generationMode/, '会话必须记录本次真实模式（用户可能在生成中切模式）');
    const rr = source.slice(source.indexOf('async function renderResult'), source.indexOf('async function renderResult') + 1200);
    assert.match(rr, /renderBriefReceipt\(/, 'renderResult 必须渲染回执');
    assert.match(rr, /session\s*&&\s*session\.briefText/, '回执正文必须取会话留存的原简报（不是重新拼一份）');
  });

  it('⑦ 样式契约：色走主题令牌、折叠行数限制、展开动画尊重 reduced-motion', () => {
    const start = css.indexOf('/* v2.701 创作回执');
    const end = css.indexOf('/* ================= 登录 / 模态');
    assert.ok(start >= 0 && end > start, 'styles.css 缺少 v2.701 创作回执样式块');
    const seg = css.slice(start, end);
    assert.ok(seg.length > 300, '回执样式块过短');
    assert.doesNotMatch(seg, /#[0-9a-fA-F]{3,8}\b/, '回执配色不得写死色值，必须引用主题令牌');
    assert.match(seg, /-webkit-line-clamp/, '折叠态必须限制行数，否则回执会把结果页顶下去');
    assert.match(seg, /@media\s*\(prefers-reduced-motion:\s*no-preference\)/, '展开动画必须挂在 no-preference 下');
  });

  it('⑧ i18n：中英双语键齐全（缺 en 会在英文界面漏出中文提示）', () => {
    for (const key of ['briefReceiptEyebrow', 'briefReceiptCopy', 'briefReceiptExpand', 'briefReceiptCollapse', 'briefReceiptSync', 'briefReceiptHint']) {
      const hits = i18n.split(key + ':').length - 1;
      assert.ok(hits >= 2, `i18n.js 中 ${key} 必须中英各一份（当前 ${hits} 处）`);
    }
  });
});
