/**
 * v2.441 产品化：偏好控件的无障碍与浏览器 UI 同步（静态契约）。
 *
 * 证伪背景：顶栏 themeBtn / langBtn 只有可见文字（「主题」「中 / EN」），
 * 屏幕阅读器读不出当前值；切主题后浏览器地址栏 theme-color 不跟随，暗色模式仍显示亮色标题栏。
 * 本文件锁死：applyTheme 同步 theme-color、applyLang 重刷偏好标签、两枚按钮带 aria-label。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');

test('index.html 的 theme-color 带深色媒体查询兜底', () => {
  assert.match(indexHtml, /<meta name="theme-color"[^>]*media="\(prefers-color-scheme: dark\)"[^>]*>/,
    '系统深色时必须切换地址栏颜色，否则白底刺眼');
});

test('applyTheme 同步 theme-color（三主题各自配色）', () => {
  const fn = appJs.match(/function applyTheme\(\)[\s\S]*?\n  \}/);
  assert.ok(fn, 'applyTheme 必须存在');
  assert.match(fn[0], /syncThemeColor\(/, 'applyTheme 必须调用 theme-color 同步');
  const sync = appJs.match(/function syncThemeColor\([\s\S]*?\n  \}/);
  assert.ok(sync, 'syncThemeColor 必须存在');
  assert.match(sync[0], /meta\[name="theme-color"\]/, '必须写入 theme-color 元信息');
  assert.match(appJs, /THEME_META\s*=\s*\{[\s\S]*?dark:[\s\S]*?light:/, '需按主题给出不同配色');
});

test('语言/主题按钮带可读 aria-label，且切语言后重刷', () => {
  assert.match(appJs, /function syncPrefsA11y\(/, '需统一的偏好控件标签同步函数');
  const fn = appJs.match(/function syncPrefsA11y\([\s\S]*?\n  \}/);
  assert.ok(fn);
  assert.match(fn[0], /\$\('themeBtn'\)/, '主题按钮需更新标签');
  assert.match(fn[0], /\$\('langBtn'\)/, '语言按钮需更新标签');
  assert.match(fn[0], /aria-label/, '标签必须写入 aria-label');
  const applyLang = appJs.match(/function applyLang\(\)[\s\S]*?\n  \}/);
  assert.match(applyLang[0], /syncPrefsA11y\(\)/, '切语言后按钮标签必须跟随，否则读屏仍是旧语言');
});
