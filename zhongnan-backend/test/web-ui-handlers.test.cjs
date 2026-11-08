/**
 * v2.490 控件接线守卫（纯静态）
 *
 * 背景：真机巡检（scripts/ui-audit.cjs）能证明「此刻点得到」，但证明不了「点了有没有事」——
 * 一个按钮只要命中测试通过、又不报错，巡检就是绿的，可它可能压根没绑任何 handler（点了没反应）。
 * 这类缺陷只能靠静态断言兜住：页面上存在的每个按钮，必须能指到一处真正会响应的接线。
 *
 * 判据（三选一即算已接线）：
 *   A 带动作属性（data-open / data-view / data-view-go / data-close / data-open-dash / data-fmt / data-dp-fmt / data-act / data-tab）
 *   B 其 id 在 web/*.js 里被引用（'id' / "id" / #id），由各视图模块自行绑定
 *   C 是表单提交按钮（type="submit"），由 form 的 submit 处理器统一承接
 *
 * 另外守住「动作属性 ↔ 接线实现」双向一致：新增一个 data-xxx 动作属性却没人处理，
 * 等于给页面加了一批点了没反应的控件，必须在这里就红。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
// 接线可能落在任意视图模块（branch-view / room-view / teardown-view …），必须全量拼接
const jsFiles = fs.readdirSync(WEB).filter((f) => f.endsWith('.js'));
const js = jsFiles.map((f) => fs.readFileSync(path.join(WEB, f), 'utf8')).join('\n');

const ACTION_ATTRS = [
  'data-open', 'data-view', 'data-view-go', 'data-close',
  'data-open-dash', 'data-fmt', 'data-dp-fmt', 'data-act', 'data-tab',
];

function buttons() {
  return [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => ({ attrs: m[1], tag: m[0] }));
}

function referenced(id) {
  return js.includes(`'${id}'`) || js.includes(`"${id}"`) || js.includes('#' + id);
}

test('H1 页面上的每个按钮都必须有接线（动作属性 / JS 引用 / submit）', () => {
  const unwired = [];
  for (const b of buttons()) {
    const id = (b.attrs.match(/\bid="([^"]+)"/) || [])[1];
    if (!id) continue;
    const hasAction = ACTION_ATTRS.some((a) => new RegExp('\\b' + a + '\\b').test(b.attrs));
    const isSubmit = /\btype="submit"/.test(b.attrs);
    if (!hasAction && !isSubmit && !referenced(id)) unwired.push(id);
  }
  assert.deepStrictEqual(unwired, [],
    '这些按钮没有任何接线，点了不会有反应：' + unwired.join(', '));
});

test('H2 页面上用到的每个动作属性都必须有对应的接线实现', () => {
  const missing = [];
  for (const attr of ACTION_ATTRS) {
    const used = new RegExp('\\b' + attr + '=').test(html);
    if (!used) continue;
    // 三种合法接线写法：querySelectorAll('[data-x]') / dataset.x / getAttribute('data-x')
    const camel = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const wired = js.includes(`[${attr}]`) || new RegExp('dataset\\.' + camel + '\\b').test(js)
      || js.includes(`'${attr}'`) || js.includes(`"${attr}"`);
    if (!wired) missing.push(attr);
  }
  assert.deepStrictEqual(missing, [],
    '这些动作属性没有任何处理器，整批控件会点了没反应：' + missing.join(', '));
});

test('H3 弹窗关闭键必须指向真实存在的弹窗 id（防止改了 id 后关闭键失效）', () => {
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const dynamic = [...js.matchAll(/\.id\s*=\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
  const known = new Set([...htmlIds, ...dynamic]);
  const bad = [...html.matchAll(/data-close="([^"]+)"/g)].map((m) => m[1]).filter((id) => !known.has(id));
  assert.deepStrictEqual([...new Set(bad)], [],
    '这些 data-close 指向不存在的弹窗，关闭键点了没反应：' + bad.join(', '));
});
