/**
 * v2.469 运行时对话框的可访问名称守卫。
 *
 * 背景：`index.html` 里 19 个静态 `.modal-mask` 都有 aria-label/aria-labelledby，
 * 但三个「造出来」的对话框漏了名称——屏幕阅读器只会念「对话框」，不说是干什么的：
 *   1) `_uiModalShell`（uiConfirm / uiPrompt 共用外壳）：有 h3 标题却不接 aria-labelledby，body 也不接 aria-describedby；
 *   2) `askText`（模态输入框，替代 window.prompt）：label 有文字但没有 id，对话框不引用它；
 *   3) `qsMask`（⌘/Ctrl+K 全局快速跳转）：整块只有 role/aria-modal，从无名称。
 *
 * WCAG 4.1.2（Name, Role, Value）：有 role 的组件必须有可访问名称。
 * 守卫口径：
 *   - 三个构造点必须各自接上 aria-labelledby（或 aria-label 兜底）；
 *   - index.html 的静态模态保持「有名称」，且 aria-labelledby 引用的 id 真实存在（防悬空引用）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '..', 'web');
const APP = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');

/** 按花括号配对截取具名函数体（本文件要截的三个函数体内无含花括号的字符串/模板） */
function sliceFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `app.js 里找不到 function ${name}(`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} 花括号未闭合`);
}

test('v2.469 uiConfirm/uiPrompt 外壳必须有可访问名称与描述', () => {
  const body = sliceFn(APP, '_uiModalShell');

  // 有标题时：h3 要有 id，modal 通过 aria-labelledby 指过去
  assert.match(body, /h\.id\s*=/, '_uiModalShell 必须给 h3 标题分配 id');
  assert.match(
    body,
    /setAttribute\(\s*'aria-labelledby'\s*,\s*h\.id\s*\)/,
    '_uiModalShell 必须 modal.setAttribute(\'aria-labelledby\', h.id)',
  );
  // 无标题时：必须有 aria-label 兜底，不能留空
  assert.match(body, /setAttribute\(\s*'aria-label'\s*,/, '_uiModalShell 无标题分支必须给 aria-label 兜底');
  // body 要接 aria-describedby，读屏才能念出正文
  assert.match(body, /setAttribute\(\s*'aria-describedby'\s*,/, '_uiModalShell 必须把正文接为 aria-describedby');
  assert.match(body, /bodyEl\.id\s*=/, '_uiModalShell 必须给正文容器分配 id');
});

test('v2.469 askText 对话框必须引用自己的 label', () => {
  const body = sliceFn(APP, 'askText');
  assert.match(
    body,
    /<div class="zn-ask"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="znAskLabel"/,
    'askText 的 role="dialog" 必须带 aria-labelledby="znAskLabel"',
  );
  assert.match(
    body,
    /<label class="zn-ask-label" id="znAskLabel"/,
    'askText 的 label 必须带 id="znAskLabel"，否则 aria-labelledby 指向空气',
  );
});

test('v2.469 快捷跳转遮罩 qsMask 必须有名称（走 i18n，不得写死中文）', () => {
  const body = sliceFn(APP, 'wireQuickSwitcher');
  assert.match(
    body,
    /mask\.setAttribute\(\s*'aria-label'\s*,\s*t\('qsDialog'\)\s*\)/,
    "qsMask 必须 mask.setAttribute('aria-label', t('qsDialog'))，名称走 i18n 且随语言重刷",
  );
  // 负对照：裸中文字面量会被 v2.262 i18n 守卫咬红，这里也不允许回退
  assert.doesNotMatch(
    body,
    /mask\.setAttribute\(\s*'aria-label'\s*,\s*'[^']*[一-鿿]/,
    'qsMask 的 aria-label 不得直接写中文字面量',
  );
});

test('v2.469 语言切换时快速跳转遮罩名称必须重刷', () => {
  const body = sliceFn(APP, 'applyLang');
  assert.match(
    body,
    /qsMaskEl\.setAttribute\(\s*'aria-label'\s*,\s*t\('qsDialog'\)\s*\)/,
    'applyLang 必须重刷 qsMask 的 aria-label，否则 en 用户一直听到中文',
  );
});

test('v2.469 静态模态保持有名称且 aria-labelledby 不悬空（防回退）', () => {
  const masks = [];
  const re = /<div class="modal-mask[^"]*"[^>]*>/g;
  let m;
  while ((m = re.exec(HTML))) masks.push(m[0]);
  assert.ok(masks.length >= 15, `静态模态数量异常：${masks.length}`);

  const missing = masks.filter((tag) => !/aria-label(?:ledby)?="/.test(tag));
  assert.deepStrictEqual(missing, [], `以下静态模态缺可访问名称：\n${missing.join('\n')}`);

  // 悬空引用检查：aria-labelledby 的每个 id 必须在 index.html 里真实存在
  const dangling = [];
  for (const tag of masks) {
    const lb = tag.match(/aria-labelledby="([^"]+)"/);
    if (!lb) continue;
    for (const id of lb[1].split(/\s+/).filter(Boolean)) {
      if (!new RegExp(`id="${id}"`).test(HTML)) dangling.push(`${id} ← ${tag.slice(0, 60)}`);
    }
  }
  assert.deepStrictEqual(dangling, [], `aria-labelledby 引用了不存在的 id：\n${dangling.join('\n')}`);
});
