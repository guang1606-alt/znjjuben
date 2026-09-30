/**
 * A2 首页瘦身分层 + 壳层结构守卫 —— TDD 先红后绿
 * 守卫 web/index.html 的关键结构：面包屑/脚本加载顺序/小南课堂容器/最新动态折叠。
 * 直接读文件断言，不起服务器，跑得快。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');

describe('A2 壳层结构守卫', () => {
  it('脚本加载顺序：i18n → staff-cost → nav-stack → tool-lesson → progress-view → api → app', () => {
    const order = ['i18n.js', 'staff-cost.js', 'nav-stack.js', 'tool-lesson.js', 'progress-view.js', 'api.js', 'app.js'];
    let last = -1;
    order.forEach((f) => {
      const idx = html.indexOf(`./${f}`);
      assert.ok(idx > 0, `${f} 应被引入`);
      assert.ok(idx > last, `${f} 应在 ${order[last] || '开头'} 之后加载`);
      last = idx;
    });
  });

  it('面包屑容器存在', () => {
    assert.ok(html.includes('id="breadcrumb"'), '应有 #breadcrumb');
    assert.ok(/<nav class="breadcrumb"/.test(html), 'breadcrumb 应是 <nav> 语义');
  });

  it('小南课堂容器 waitLesson 存在且默认隐藏', () => {
    assert.ok(html.includes('id="waitLesson"'), '应有 #waitLesson');
    assert.ok(/class="wait-lesson hidden"/.test(html), 'waitLesson 默认 hidden');
  });

  it('最新动态折叠为 <details>（首页信息分层）', () => {
    assert.ok(/<details[^>]*id="homeUpdates"/.test(html), 'homeUpdates 应是 <details> 折叠');
    const m = html.match(/<details[^>]*id="homeUpdates"[^>]*>([\s\S]*?)<\/details>/);
    assert.ok(m, 'details 应有闭合标签');
    assert.ok(/<summary/.test(m[1]), 'details 内应有 summary（可点标题）');
    assert.ok(m[1].includes('homeUpdatesBody'), '折叠体内保留 homeUpdatesBody');
  });

  it('最新动态默认收起（无 open 属性）', () => {
    const m = html.match(/<details[^>]*id="homeUpdates"/);
    assert.ok(m && !/ open[>\s]/.test(m[0]), '默认不应带 open');
  });
});
