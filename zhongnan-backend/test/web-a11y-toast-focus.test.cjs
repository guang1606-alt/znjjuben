const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.244 a11y 第四梯队：toast 实时区语义 + focus-visible 兜底
// ① #toastStack 容器 aria-live="polite"，但 aria-atomic 不得为 true——
//    容器原子化会导致每新增一条 toast 整堆全文重读（噪音）；原子性由每个 toast 节点的
//    role="status"/role="alert" 隐含（隐含 aria-atomic=true），新增节点作为 relevant addition 被朗读。
// ② toast 节点 role 映射逻辑存续（error→alert，其余→status）。
// ③ styles.css 全局 :focus-visible 覆盖键盘焦点可见性，:where 列表须含
//    button/a/[role="button"]/[tabindex]:not([tabindex="-1"])（tabindex 兜底防未来自定义聚焦元素漏样式）。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../web/styles.css'), 'utf8');

describe('v2.244 a11y：toastStack 实时区语义', () => {
  it('#toastStack 容器 aria-live="polite"', () => {
    const m = html.match(/<div class="toast-stack" id="toastStack"[^>]*>/);
    assert.ok(m, '应存在 #toastStack');
    assert.match(m[0], /aria-live="polite"/, '#toastStack 缺 aria-live="polite"');
  });

  it('#toastStack 容器 aria-atomic 不得为 true（防整堆重读）', () => {
    const m = html.match(/<div class="toast-stack" id="toastStack"[^>]*>/);
    assert.ok(m, '应存在 #toastStack');
    assert.ok(!/aria-atomic="true"/.test(m[0]), '#toastStack 容器 aria-atomic 不应为 true（原子性由 toast 节点 role 隐含）');
  });

  it('toast 节点按 kind 映射 role（error→alert，其余→status）', () => {
    assert.match(appSrc, /node\.setAttribute\('role', kind === 'error' \? 'alert' : 'status'\)/, 'toast 节点 role 映射逻辑缺失');
  });
});

describe('v2.244 a11y：focus-visible 全局兜底', () => {
  it('全局 :focus-visible 规则存在且 :where 列表含 button/a/[role="button"]/[tabindex] 兜底', () => {
    const m = css.match(/:where\(((?:[^()]|\([^)]*\))*)\):focus-visible/);
    assert.ok(m, '应存在 :where(...):focus-visible 全局规则');
    const list = m[1];
    for (const sel of ['button', 'a', '[role="button"]', '[tabindex]:not([tabindex="-1"])']) {
      assert.ok(list.includes(sel), `:focus-visible :where 列表缺 ${sel}`);
    }
  });
});
