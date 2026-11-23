'use strict';
// v2.669 创作端内容揭示与复制反馈：
// 1) 作品详情逐集卡片错落入场（--ep-i 递减延迟），降动效下关闭；
// 2) 生成结果评分格逐格弹出（--score-i），降动效下关闭，悬停轻微抬升；
// 3) copy() 返回 Promise<boolean>；单集复制按钮就地切换「✓ 已复制」成功态、失败抖动并还原。
// 背景：此前作品详情整块出现、评分格同时闪现、复制只弹全局 toast，按钮本身零反馈。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = read('web/app.js');
const css = read('web/styles.css');
const i18n = read('web/i18n.js');

const ast = ts.createSourceFile('app.js', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

function makeBtn(text) {
  const classes = new Set();
  return {
    textContent: text, dataset: {}, _copyTimer: null,
    classList: {
      add: (...xs) => xs.forEach((x) => classes.add(x)),
      remove: (...xs) => xs.forEach((x) => classes.delete(x)),
      contains: (x) => classes.has(x),
      toggle(x, on) { if (on ?? !classes.has(x)) classes.add(x); else classes.delete(x); },
    },
  };
}

function setup(names, extra = {}) {
  const timers = [];
  const context = {
    lang: 'zh', console,
    t: (k, vars) => `${k}${vars ? ':' + Object.values(vars).join(',') : ''}`,
    xnSay() {},
    document: {
      createElement: () => ({ value: '', select() {}, remove() {} }),
      body: { appendChild() {} },
      execCommand: () => true,
    },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout() {},
    navigator: { clipboard: { writeText: async () => {} } },
    ...extra,
  };
  vm.createContext(context);
  for (const name of names) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return { context, run: () => timers.splice(0).forEach((fn) => fn()) };
}

test('静态契约：逐集错落与评分揭示带降动效守卫，复制成功态样式齐备', () => {
  // 作品详情逐集：内联阶梯序号 + 入场动画 + 延迟
  assert.match(app, /class="ep-item"[^>]*style="--ep-i:\$\{Math\.min\(i, 8\)\}"/);
  assert.match(css, /\.ep-item\{[^}]*animation:zn-rise/);
  assert.match(css, /animation-delay:calc\(var\(--ep-i/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\.ep-item\{animation:none\}\}/);

  // 结果评分格：内联阶梯序号 + 弹出动画 + 延迟 + 悬停抬升
  assert.match(app, /class="score-cell"[^>]*style="--score-i:\$\{i\}"/);
  assert.match(css, /\.score-cell\s*\{[^}]*animation:\s*zn-pop/);
  assert.match(css, /animation-delay:\s*calc\(var\(--score-i/);
  assert.match(css, /\.score-cell:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.score-cell \{ animation: none; transition: none;/);

  // 复制按钮就地成功态
  assert.match(css, /\.ep-copy-btn\.is-copied\s*\{[^}]*color:var\(--gold-text\)/);
  assert.match(css, /\.ep-copy-btn\.is-copied\s*\{[^}]*background:var\(--gold-soft\)/);
});

test('静态契约：单集复制接线到 flashCopied，copy 有布尔返回契约', () => {
  const open = functions.get('openProject');
  assert.ok(open, '缺少 openProject');
  assert.match(open, /flashCopied\(b, ok\)/);
  const copySrc = functions.get('copy');
  assert.ok(copySrc, '缺少 copy');
  assert.match(copySrc, /return navigator\.clipboard\.writeText\(text\)\.then\(/);
  assert.match(copySrc, /return true;/);
  assert.match(copySrc, /return ok;/);
});

test('i18n：复制就地反馈文案中英双份', () => {
  for (const key of ['copiedShort', 'copyFailShort']) {
    const hits = i18n.match(new RegExp(`${key}\\s*:`, 'g')) || [];
    assert.equal(hits.length, 2, `${key} 必须在中英两份 DICT 中各出现一次`);
  }
});

test('copy() 成功返回 true，剪贴板拒绝时走 execCommand 兜底并返回其布尔结果', async () => {
  const ok = setup(['copy']);
  assert.equal(await ok.context.copy('正文'), true);

  const denied = setup(['copy'], {
    navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } },
    document: {
      createElement: () => ({ value: '', select() {}, remove() {} }),
      body: { appendChild() {} },
      execCommand: () => true,
    },
  });
  assert.equal(await denied.context.copy('正文'), true, '兜底复制成功应为 true');

  const blocked = setup(['copy'], {
    navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } },
    document: {
      createElement: () => ({ value: '', select() {}, remove() {} }),
      body: { appendChild() {} },
      execCommand: () => false,
    },
  });
  assert.equal(await blocked.context.copy('正文', '', '失败'), false, '两条路径都失败应为 false');
  assert.equal(await blocked.context.copy(''), false, '空文本直接返回 false');
});

test('flashCopied：成功显示「✓ 已复制」并高亮，失败抖动，1.4s 后还原原始文案', () => {
  const { context, run } = setup(['flashCopied']);
  const btn = makeBtn('复制本集');

  context.flashCopied(btn, true);
  assert.ok(btn.classList.contains('is-copied'), '成功应加 is-copied');
  assert.ok(btn.classList.contains('ep-shake') === false, '成功不应抖动');
  assert.match(btn.textContent, /copiedShort/);
  run();
  assert.equal(btn.classList.contains('is-copied'), false, '计时结束应去掉成功态');
  assert.equal(btn.textContent, '复制本集', '还原为原始文案');

  context.flashCopied(btn, false);
  assert.ok(btn.classList.contains('ep-shake'), '失败应抖动');
  assert.ok(btn.classList.contains('is-copied') === false, '失败不应加成功色');
  assert.match(btn.textContent, /copyFailShort/);
  run();
  assert.equal(btn.classList.contains('ep-shake'), false, '计时结束应去掉抖动');
  assert.equal(btn.textContent, '复制本集');
});
