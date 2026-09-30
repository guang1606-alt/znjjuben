/**
 * 导航栈 + 面包屑渲染（v2.200）
 *
 * 解决 switchView 平级切换无层级、无返回链的问题。
 * 维护一个导航栈：每次进入视图压栈，pop 返回上一级，
 * 跳到已存在层级的视图时截断后面（避免栈无限增长）。
 *
 * 纯函数 + 单例工厂，浏览器与 Node 单测共用。
 * app.js 持有全局实例，switchView 末尾调用 push 并渲染面包屑。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZnNavStack = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createNavStack() {
    let stack = [];

    function list() { return stack.slice(); }
    function peek() { return stack.length ? stack[stack.length - 1] : null; }
    function canPop() { return stack.length > 1; }

    function push(item) {
      if (!item || typeof item !== 'object' || !item.view) return;
      // 截断：若 push 的 view 已存在于栈中，截断到该位置（避免栈无限增长 + 防绕回环）
      const idx = stack.findIndex((x) => x.view === item.view);
      if (idx >= 0) {
        stack = stack.slice(0, idx + 1);
        // 同视图但 label 可能更新，替换之
        stack[idx] = Object.assign({}, stack[idx], item);
      } else {
        stack.push({ view: item.view, label: item.label || item.view });
      }
    }

    function pop() {
      if (!stack.length) return null;
      if (stack.length === 1) return stack[0]; // 只剩根视图时返回根视图且不出栈
      return stack.pop();
    }

    /**
     * 渲染面包屑到目标元素。
     * @param {Element} el 目标 DOM 元素（设 innerHTML）
     * @param {object} [opts] 选项
     * @param {function} [opts.onJump] 点击非末级 chip 时的回调，参数为 view
     */
    function renderBreadcrumb(el, opts) {
      if (!el) return;
      const onJump = (opts && typeof opts.onJump === 'function') ? opts.onJump : null;
      if (!stack.length) { el.innerHTML = ''; return; }
      const parts = stack.map((item, i) => {
        const isLast = i === stack.length - 1;
        // 末级高亮 active 且不可点；前面可点跳回（onJump 决定行为）
        const cls = isLast ? 'crumb crumb-active' : 'crumb';
        // 非末级用 <button> 形式，便于键盘与 a11y；末级用 <span>
        if (isLast) {
          return `<span class="${cls}" aria-current="page">${escapeHtml(item.label || item.view)}</span>`;
        }
        // 用 data-view 标记可点击跳回
        return `<button type="button" class="${cls}" data-view="${escapeHtml(item.view)}">${escapeHtml(item.label || item.view)}</button><span class="crumb-sep" aria-hidden="true">›</span>`;
      });
      el.innerHTML = parts.join('');
      // 绑定点击：非末级点击触发 onJump
      if (onJump) {
        el.querySelectorAll ? el.querySelectorAll('.crumb[data-view]').forEach((b) => {
          b.onclick = () => onJump(b.getAttribute('data-view'));
        }) : null;
      }
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    return { list, peek, push, pop, canPop, renderBreadcrumb };
  }

  return { createNavStack };
});
