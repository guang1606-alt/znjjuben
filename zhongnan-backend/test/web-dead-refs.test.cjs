/**
 * v2.478 死引用守卫（纯静态，不起服务器）
 *
 * 背景：站点长期迭代后，「JS 里按 id 找元素、但该 id 从未被创建」是「点了没反应」最隐蔽的根因：
 * 代码看着完整、控制台不报错、`if (el)` 兜底又把空指针吃掉，功能就这么静默消失了。
 * 本轮实测抓到 3 处真实死引用：
 *   1) app.js `document.getElementById('pkSetupHint')` —— index.html 的 <p> 只有 data-i 没有 id，
 *      内部账户「免费」提示永远不生效，页面继续显示「PK 消耗 20 积分」（名实不符）；
 *   2) room-view.js `$('toolPitch')` / `$('toolRead')` —— 全站没有任何元素带这两个 id，
 *      两行 onclick 从未生效（死代码）。
 *
 * 守卫口径：
 *   D1  web/*.js 中所有字面量 id 引用（$('x') / getElementById('x') / querySelector('#x')）
 *       必须能在 web/*.html 的 id="x" 或 web/*.js 的动态创建（id="x" 模板 / .id = 'x' /
 *       setAttribute('id', 'x')）中找到声明；
 *   D2  快速跳转（⌘/Ctrl+K）必须有一个可点、可读屏的可见入口 #qsBtn，
 *       并在巡检目录 REAL_TRIGGERS 中登记真实触发路径（否则触屏设备永远打不开）；
 *   D3  运行时构造的快速跳转弹窗，占位符/无障碍名/空态文案必须走 i18n，不得写死中文。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const files = fs.readdirSync(WEB).filter((f) => /\.(js|html)$/.test(f));
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
const corpus = files.map(read).join('\n');
const app = read('app.js');
const html = read('index.html');
const i18n = read('i18n.js');
const audit = fs.readFileSync(path.join(ROOT, 'scripts', 'ui-audit.cjs'), 'utf8');

function declaredIds() {
  const ids = new Set();
  for (const m of corpus.matchAll(/\bid\s*=\s*["']([A-Za-z][\w-]*)["']/g)) ids.add(m[1]);
  for (const m of corpus.matchAll(/\.id\s*=\s*['"]([A-Za-z][\w-]*)['"]/g)) ids.add(m[1]);
  for (const m of corpus.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]/g)) ids.add(m[1]);
  return ids;
}

function referencedIds() {
  const refs = new Map();
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    const src = read(f);
    const add = (id) => { if (!refs.has(id)) refs.set(id, f); };
    for (const m of src.matchAll(/\$\(\s*['"]([A-Za-z][\w-]*)['"]\s*\)/g)) add(m[1]);
    for (const m of src.matchAll(/getElementById\(\s*['"]([A-Za-z][\w-]*)['"]\s*\)/g)) add(m[1]);
    for (const m of src.matchAll(/querySelector(?:All)?\(\s*['"]#([A-Za-z][\w-]*)/g)) add(m[1]);
  }
  return refs;
}

function quickSwitcherBody() {
  const start = app.indexOf('(function wireQuickSwitcher()');
  assert.ok(start >= 0, 'app.js 找不到 wireQuickSwitcher 挂载函数');
  return app.slice(start, start + 4000);
}

describe('v2.478 死引用守卫', () => {
  it('D0 扫描器自检：能解析到足量 id 声明与引用（防守卫自身失效假绿）', () => {
    const ids = declaredIds();
    const refs = referencedIds();
    assert.ok(ids.size >= 500, '声明的 id 数量异常偏少：' + ids.size);
    assert.ok(refs.size >= 400, '字面量 id 引用数量异常偏少：' + refs.size);
    assert.ok(ids.has('qsInput') && ids.has('readRewritePanel'), '扫描器应同时覆盖静态与动态创建的 id');
  });

  it('D1 每个字面量 id 引用都必须有对应的创建点（否则点击/赋值静默失效）', () => {
    const ids = declaredIds();
    const dead = [...referencedIds()].filter(([id]) => !ids.has(id)).map(([id, f]) => `${f} → #${id}`);
    assert.deepStrictEqual(dead, [], '引用了从不存在的 id（either 补创建点，either 删死代码）：\n' + dead.join('\n'));
  });

  it('D2 快速跳转必须有可见入口 #qsBtn，并纳入巡检真实触发器', () => {
    assert.match(html, /<button[^>]*id="qsBtn"[^>]*>/, 'index.html 缺少 #qsBtn：触屏设备没有 ⌘/Ctrl+K，功能等于不存在');
    assert.match(html, /id="qsBtn"[^>]*data-i="qsOpen"/, '#qsBtn 的可见文字必须走 i18n（data-i="qsOpen"）');
    // 入口必须真的接线（不是画一个按钮放着）
    const body = quickSwitcherBody();
    assert.match(body, /\$\('qsBtn'\)/, 'app.js 未把 #qsBtn 接到快速跳转的 open()');
    // 巡检目录：有真实入口才可能在真机/巡检里被打开
    const block = audit.slice(audit.indexOf('const REAL_TRIGGERS = {'), audit.indexOf('\n};', audit.indexOf('const REAL_TRIGGERS = {')));
    assert.match(block, /\bqsMask:\s*\{[^}]*sel:\s*\[[^\]]*'#qsBtn'/, 'REAL_TRIGGERS 必须登记 qsMask 的真实入口 #qsBtn');
  });

  it('D3 运行时弹窗的占位符/无障碍名/空态走 i18n，不得写死中文', () => {
    const body = quickSwitcherBody();
    for (const key of ['qsInputAria', 'qsPh', 'qsEmpty']) {
      assert.ok(i18n.includes(key + ':'), 'i18n.js 缺少键 ' + key);
      assert.ok(body.includes("t('" + key + "')"), '快速跳转必须用 t(\'' + key + '\')，不得写死中文字面量');
    }
    // 负对照：模板里不得再出现中文 placeholder / aria-label 字面量
    assert.doesNotMatch(body, /placeholder="[^"]*[\u4e00-\u9fff]/, 'placeholder 不得写死中文');
    assert.doesNotMatch(body, /aria-label="[^"]*[\u4e00-\u9fff]/, 'aria-label 不得写死中文');
  });
});
