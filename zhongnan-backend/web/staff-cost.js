/**
 * 工具箱 staff 文案精细化（v2.200）
 *
 * 内部账户（超管/副管理员）在工具箱价格处看到的文案：
 *   - 保留操作名（拆解/大纲/围读/积分单位…）
 *   - 把数字归零（30→0、20→0）
 *   - 尾部加「（内部免费）」/「 (Staff Free)」
 * 不再笼统替换为「内部账户·免费」，避免丢失操作名信息。
 *
 * 已是免费口径的（含「免费」或「Free」字样）原样不动，避免双尾标。
 *
 * 纯函数、零依赖，浏览器与 Node 单测中共用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZnStaffCost = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 规则化 staff 看到的价格文案。
   * @param {string|null|undefined} rawTxt 原始价格文本（如 "拆解30·大纲20积分"）
   * @param {boolean} en true=英文环境，false=中文环境
   * @returns {string|null|undefined} 规则化后的文本
   */
  function normalizeStaffCost(rawTxt, en) {
    if (rawTxt == null) return rawTxt; // null/undefined 原样返回
    const s = String(rawTxt);
    if (!s.trim()) return s; // 空串原样返回
    // 已是免费口径：含「免费」或「Free」（不区分大小写）→ 原样返回，避免双尾标
    if (/免费|free/i.test(s)) return s;
    // 把所有数字（≥1 位）归零
    const zeroed = s.replace(/\d+/g, '0');
    const suffix = en ? ' (Staff Free)' : '（内部免费）';
    return zeroed + suffix;
  }

  /**
   * 扫描 root 下所有 .tool-cost / [data-cost] 元素，把含价格信息的文本规则化。
   * 跳过：空文本、已免费口径（含「免费」/「Free」）。
   * @param {Document|Element} root DOM 根
   * @param {boolean} en 是否英文环境
   * @param {boolean} [isStaff=true] 是否内部账户；false 则不扫描
   */
  function patchStaffCostInDom(root, en, isStaff) {
    if (isStaff === false) return; // 非 staff 不扫描
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const nodes = root.querySelectorAll('.tool-cost,[data-cost]');
    if (!nodes) return;
    nodes.forEach((el) => {
      const txt = el.textContent || '';
      if (!txt.trim()) return;
      if (/免费|free/i.test(txt)) return; // 已免费口径不动
      el.textContent = normalizeStaffCost(txt, en);
    });
  }

  return { normalizeStaffCost, patchStaffCostInDom };
});
