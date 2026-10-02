/**
 * v2.306 常驻守卫测试：web 裸 async 事件 handler 设卡（scripts/guard-async-handler.cjs）。
 *
 * 双证结构：
 *  ①真实 web/*.js 扫描必须 0 violation——v2.284~v2.287 四轮同族修复已全部合规；
 *    任何人新增裸 async handler，本测试即刻转红。
 *  ②fixture 变异自证（红能力/绿能力）：裸 async 必报（守卫会咬）、
 *    try/catch/同步体/委托自管/非 async 必不报（守卫不误杀）——防守卫自身形同虚设。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanSource, scanProject } = require('../scripts/guard-async-handler.cjs');

describe('v2.306 裸 async handler 静态设卡（AST-lite 守卫）', { concurrency: 1 }, () => {
  it('真实 web/*.js 全量扫描：0 violation（现状全合规，新增裸 handler 即刻转红）', () => {
    const v = scanProject();
    assert.deepStrictEqual(v, [], `新增裸 async handler：\n${v.map((x) => `  ${x.file}:${x.line} ${x.snippet}`).join('\n')}`);
  });

  it('红能力①：内联 onclick = async () => { await api() } 无 try/catch 必报', () => {
    const fx = `const b = document.getElementById('x');\n  b.onclick = async () => { const r = await fetch('/api/x'); };`;
    const v = scanSource(fx, 'web/app.js');
    assert.strictEqual(v.length, 1, '裸 async 箭头必须被咬出');
    assert.strictEqual(v[0].form, 'inline');
  });

  it('红能力②：内联 addEventListener("click", async () => { await api() }) 无 try/catch 必报', () => {
    const fx = `b.addEventListener('click', async () => { const r = await Api.request('/x'); });`;
    const v = scanSource(fx, 'web/app.js');
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].form, 'inline');
  });

  it('红能力③：引用 onclick = fn（fn 为 async 且含 await 无 try/catch）必报', () => {
    const fx = `async function save() { const r = await Api.request('/x'); }\n  $('btn').onclick = save;`;
    const v = scanSource(fx, 'web/app.js');
    assert.strictEqual(v.length, 1, '引用 async fn 必须被咬出');
    assert.strictEqual(v[0].form, 'ref:save');
  });

  it('红能力④：引用 addEventListener("click", fn)（fn 为 async 箭头且含 await 无 try/catch）必报', () => {
    const fx = `const save = async () => { const r = await Api.request('/x'); };\n  btn.addEventListener('click', save);`;
    const v = scanSource(fx, 'web/app.js');
    assert.strictEqual(v.length, 1, '引用 async 箭头必须被咬出');
    assert.strictEqual(v[0].form, 'ref:save');
  });

  it('绿能力①：含 try/catch → 不报', () => {
    const fx = `b.onclick = async () => { try { await Api.request('/x'); } catch { xnSay('fail'); } };`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力②：同步体（无 await）→ 不报', () => {
    const fx = `b.onclick = async () => { console.log('ok'); };`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力③：委托自管函数（dealAction 内部 try/catch 兜底）→ 不报', () => {
    const fx = `b.onclick = async () => { await dealAction('/api/market/confirm'); };`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力④：非 async 函数引用 → 不报', () => {
    const fx = `function syncSave() { console.log('ok'); }\n  $('btn').onclick = syncSave;`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力⑤：async 函数引用但无 await → 不报', () => {
    const fx = `const noop = async () => { console.log('ok'); };\n  btn.addEventListener('click', noop);`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力⑥：自管函数 + 非自管函数混用 → 不报（try/catch 兜底全局）', () => {
    const fx = `b.onclick = async () => { try { await dealAction('/a'); await Api.request('/b'); } catch { xnSay('fail'); } };`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });
});
