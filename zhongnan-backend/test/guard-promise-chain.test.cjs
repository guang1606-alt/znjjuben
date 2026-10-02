/**
 * v2.307 常驻守卫测试：web 裸 promise 链缺 catch 设卡（scripts/guard-promise-chain.cjs）。
 *
 * 双证结构：
 *  ①真实 web/*.js 扫描必须 0 violation——c199 同族（room/app 剪贴板、admApi 链群、tags 链群）
 *    全部合规，teardown 复制大纲漏网已修；任何人新增裸 promise 链，本测试即刻转红。
 *  ②fixture 变异自证（红能力/绿能力）：裸链必报（守卫会咬）、
 *    catch/双参/await/return/赋值/微任务调度/跨行合规链必不报（守卫不误杀）——
 *    防守卫自身形同虚设。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanSource, scanProject } = require('../scripts/guard-promise-chain.cjs');

describe('v2.307 裸 promise 链静态设卡（AST-lite 守卫）', { concurrency: 1 }, () => {
  it('真实 web/*.js 全量扫描：0 violation（现状全合规，新增裸链即刻转红）', () => {
    const v = scanProject();
    assert.deepStrictEqual(v, [], `新增裸 promise 链：\n${v.map((x) => `  ${x.file}:${x.line} ${x.snippet}`).join('\n')}`);
  });

  it('红能力①：行内裸链（clipboard 形态，c199 同族）必报', () => {
    const fx = `btn.onclick = () => {\n  navigator.clipboard.writeText(t).then(() => toastOk('ok'));\n};`;
    const v = scanSource(fx, 'web/app.js');
    assert.strictEqual(v.length, 1, '行内裸链必须被咬出');
    assert.strictEqual(v[0].line, 2);
  });

  it('红能力②：跨行链无 catch 必报', () => {
    const fx = `function load() {\n  admApi('/api/x')\n    .then((r) => render(r));\n}`;
    const v = scanSource(fx, 'web/app.js');
    assert.strictEqual(v.length, 1, '跨行裸链必须被咬出');
    assert.strictEqual(v[0].line, 3);
  });

  it('绿能力①：行内链含 catch → 不报', () => {
    const fx = `Api.request('/x').then((r) => r.json()).then(fill).catch(() => {});`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力②：跨行链尾 catch → 不报', () => {
    const fx = `Api.request('/x').then((r) => Api.jsonOrThrow(r)).then(fill)\n  .catch((e) => xnSay(e.message));`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力③：then 双参自管 → 不报', () => {
    const fx = `p.then((v) => { resolve(v); }, (e) => { reject(e); });`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力④：await 头（reject 由 await 点负责）→ 不报', () => {
    const fx = `async function f() {\n  const r = await api().then((x) => x.json());\n}`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力⑤：return 头（调用方负责）→ 不报', () => {
    const fx = `function f() {\n  return api().then((x) => x.data);\n}`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力⑥：赋值头（promise 存留，使用方负责）→ 不报', () => {
    const fx = `const ensure = meCache ? Promise.resolve(meCache) : Api.request('/api/auth/me').then((r) => r.json());`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力⑦：Promise.resolve 微任务调度头 → 不报', () => {
    const fx = `Promise.resolve().then(() => { token = ''; });`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });

  it('绿能力⑧：then 回调内字符串含括号/分号不误判链块边界', () => {
    const fx = `api().then(() => { xnSay('done; (ok)'); }).catch(() => {});`;
    assert.strictEqual(scanSource(fx, 'web/app.js').length, 0);
  });
});
