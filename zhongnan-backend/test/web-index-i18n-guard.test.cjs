/**
 * v2.263 index.html i18n 守卫 —— 用户可见静态节点不得无 data-i / data-ph
 * 背景：v2.262 勘察 index.html 119 条无 data-i 中文行，32 条已被 JS 动态覆盖，
 *       真漏网 7 条（用户可见）：
 *       ① 4 条 aria-label（主导航/面包屑/公告位/编剧室）——renderStaticText 不处理 aria-label；
 *       ② 1 条 placeholder（worksSearch）——无 data-ph；
 *       ③ 2 条 btn-ghost 关闭按钮（listenModal/dpModal）——无 data-i；
 * 修复策略：index.html 补 data-i / data-ph，i18n.js 补 zh/en 键。
 * 本文件静态断言收口不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(WEB, 'i18n.js'), 'utf8');

describe('v2.263 index.html i18n 守卫（用户可见静态节点双语覆盖）', () => {
  it('主导航 nav 的 aria-label 应有 data-i-aria 双语处理', () => {
    // 有 aria-label 时必须有 data-i-aria 让 renderStaticText 覆盖
    assert.match(html, /<nav[^>]*aria-label="主导航"[^>]*data-i-aria="[^"]+"/,
      '主导航 aria-label 应有 data-i-aria 双语处理');
  });

  it('面包屑 breadcrumb 的 aria-label 应有 data-i-aria 双语处理', () => {
    assert.match(html, /<nav[^>]*aria-label="面包屑"[^>]*data-i-aria="[^"]+"/,
      '面包屑 aria-label 应有 data-i-aria 双语处理');
  });

  it('公告位 adRoll 的 aria-label 应有 data-i-aria 双语处理', () => {
    assert.match(html, /id="adRoll"[^>]*aria-label="公告与合作位"[^>]*data-i-aria="[^"]+"/,
      '公告位 aria-label 应有 data-i-aria 双语处理');
  });

  it('编剧室 roomPanel 的 aria-label 应有 data-i-aria 双语处理', () => {
    assert.match(html, /id="roomPanel"[^>]*aria-label="编剧室"[^>]*data-i-aria="[^"]+"/,
      '编剧室 aria-label 应有 data-i-aria 双语处理');
  });

  it('作品搜索 worksSearch 的 placeholder 应有 data-ph', () => {
    assert.match(html, /id="worksSearch"[^>]*data-ph="[^"]+"/,
      'worksSearch 应有 data-ph 属性');
  });

  it('听剧本弹窗关闭按钮应有 data-i', () => {
    assert.match(html, /data-close="listenModal"[^>]*data-i="[^"]+"/,
      'listenModal 关闭按钮应有 data-i');
  });

  it('导演交付包弹窗关闭按钮应有 data-i', () => {
    assert.match(html, /data-close="dpModal"[^>]*data-i="[^"]+"/,
      'dpModal 关闭按钮应有 data-i');
  });

  it('i18n.js 应包含新增键（ariaLabel / worksSearchPh / close）', () => {
    // close 键已存在，检查新增键
    assert.match(i18n, /worksSearchPh:/, 'i18n.js 应有 worksSearchPh 键');
    assert.match(i18n, /navAria:/, 'i18n.js 应有 navAria 键');
    assert.match(i18n, /breadcrumbAria:/, 'i18n.js 应有 breadcrumbAria 键');
    assert.match(i18n, /adRollAria:/, 'i18n.js 应有 adRollAria 键');
    assert.match(i18n, /roomPanelAria:/, 'i18n.js 应有 roomPanelAria 键');
  });
});
