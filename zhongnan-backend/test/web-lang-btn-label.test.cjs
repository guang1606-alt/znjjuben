/**
 * v2.460 WCAG 2.5.3「Label in Name」：语言切换按钮的无障碍名必须包含可见文字「中 / EN」。
 *
 * 证伪来源（真机 Lighthouse mobile，/#/home 与 /#/works 两页各跑一次）：两页 Accessibility 均为 100
 * 分，唯一失败项都是 label-content-name-mismatch，命中同一个全局元素：
 *   <button id="langBtn" aria-label="切换界面语言为 English">中 / EN</button>
 * 可见文字是「中 / EN」，aria-label 只有动作描述、不含可见文字——读屏只会念 aria-label，
 * 而语音控制用户按可见文字说「点击 中 EN」无法命中该按钮（WCAG 2.5.3 违规，影响全站每一页）。
 *
 * 本文件锁定：
 * 1) 可见文字保持「中 / EN」（两个语言分支都不许改掉它）；
 * 2) 两个语言的 aria-label 都必须**包含**「中 / EN」，同时保留原有的动作语义；
 * 3) 静态 HTML 里按钮的可见文字与测试锚点一致，避免以后改文案却没同步断言。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');

test('语言按钮可见文字为「中 / EN」（断言锚点）', () => {
  const m = html.match(/<button[^>]*id="langBtn"[^>]*>([^<]*)<\/button>/);
  assert.ok(m, 'index.html 应存在 #langBtn');
  assert.strictEqual(m[1].trim(), '中 / EN');
});

test('中/英两个分支的 aria-label 都包含可见文字「中 / EN」并保留动作语义', () => {
  const m = app.match(/const label = (lang === 'en' \? '([^']+)' : '([^']+)');/);
  assert.ok(m, 'app.js 应存在语言按钮 aria-label 赋值');
  const enLabel = m[2];
  const zhLabel = m[3];
  assert.ok(zhLabel.includes('中 / EN'), '中文界面下 aria-label 必须包含可见文字「中 / EN」');
  assert.ok(enLabel.includes('中 / EN'), '英文界面下 aria-label 必须包含可见文字「中 / EN」');
  assert.match(zhLabel, /切换界面语言为 English/, '中文界面仍应说明切换到 English');
  assert.match(enLabel, /Switch interface language to 中文/, '英文界面仍应说明切换到中文');
});

test('语言按钮的无障碍名不只靠 title，且 aria-label 在加载时即被写入', () => {
  assert.ok(html.includes('id="langBtn"'), 'index.html 应存在 #langBtn');
  assert.ok(/lb\.setAttribute\('aria-label', label\)/.test(app), '应在 applyLang 时写入 aria-label');
});
