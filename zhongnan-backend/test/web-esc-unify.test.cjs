/**
 * v2.305 全端 esc/escapeHtml 完整性守卫
 * 背景：web 端各视图自包含、各自定义本地 esc（架构既定，不抽取共享模块）。
 * v2.304 审计发现 teardown-view.js 的 esc 缺单引号转义（字符类 [&<>"] 无 '，映射表无 &#39;），
 * 与其他 5 份完整实现漂移。本守卫锁定：任何本地 esc/escapeHtml 定义必须五字符全覆盖（& < > " '），
 * 且映射/链式替换中必须真实产生 &#39;——防"字符类在、映射漏"型半残防线。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WEB = path.join(__dirname, '../web');

// 本地 esc 定义的两种形态：
//  A. 单行箭头：const esc = (s) => ... .replace(/[&<>"']/g, ...)
//  B. 多行函数：function escapeHtml(s) { ... .replace(/'/g, '&#39;') }
function findEscDefs(src) {
  const points = [];
  for (const m of src.matchAll(/const esc = \(s\) =>/g)) points.push(m.index);
  for (const m of src.matchAll(/function escapeHtml\(s\) \{/g)) points.push(m.index);
  return points;
}

test('web 端所有本地 esc/escapeHtml 定义五字符全覆盖（含单引号）', () => {
  const files = fs.readdirSync(WEB).filter((f) => f.endsWith('.js'));
  const withEsc = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(WEB, f), 'utf8');
    const defs = findEscDefs(src);
    if (!defs.length) continue;
    withEsc.push(f);
    for (const at of defs) {
      const window600 = src.slice(at, at + 600);
      // 委托包装（如 app.js:3041 的 esc → 全局 escapeHtml）不做字符断言，由被委托方的定义点兜底
      if (!window600.includes('.replace(')) continue;
      const coversQuoteInClass = /\[&<>"'\]/.test(window600);      // 形态A：字符类含 '
      const coversQuoteInChain = /\.replace\(\/'\/g/.test(window600); // 形态B：链式 .replace(/'/g
      assert.ok(
        coversQuoteInClass || coversQuoteInChain,
        `${f} 的 esc 定义必须覆盖单引号（字符类 [&<>"'] 或链式 .replace(/'/g）`,
      );
      assert.ok(
        window600.includes('&#39;'),
        `${f} 的 esc 定义必须真实映射 ' → &#39;（防字符类在、映射漏的半残防线）`,
      );
    }
  }
  // 台账锚定：当前应有 7 处定义（app/diversity/ad-roll/branch/room/teardown/nav-stack），
  // 新增视图若引入本地 esc 必须被本守卫自动纳入。
  assert.ok(withEsc.length >= 7, `esc 台账不应缩水（当前 ${withEsc.length} 处）：${withEsc.join(',')}`);
});
