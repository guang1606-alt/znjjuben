/**
 * v2.225 toast 三入口统一 —— 守卫 web/app.js 与独立 view js
 * 背景：页面同时存在两套 toast 外观——c201 简版 znToast（#znToastHost 动态创建，纯文本无语义）
 *   与 v2.186 富版 toast(opts)（#toastStack 常驻，kind 色条/title/action/关闭按钮/堆叠上限）。
 *   view js 34 处经 window.Xn.toast → xnSay → znToast 全部落进简版中性灰，错误/成功无视觉分级
 *   （c201 用户反馈原始诉求正是"提示容易被无视"）。
 * 收口：znToast 重写为富版薄封装（kind 可选），xnSay/Xn.toast 透传 kind，view js 34 处按语义
 *   补 error/ok 第二参，双 host 样式退役。本文件静态断言收口不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8');

const count = (s, re) => (s.match(re) || []).length;

describe('v2.225 app.js：znToast 重写为富版薄封装', () => {
  it('znToast 带 kind 可选参数并转调富版 toast（单体系）', () => {
    assert.match(src, /function znToast\(msg, kind\)/, 'znToast 签名应升级 (msg, kind)');
    assert.match(src, /toast\(\{ kind: kind \|\| 'info', body: msg \}\)/,
      'znToast 内部应转调富版 toast（kind 默认 info）');
  });

  it('双 host 退役：不再动态创建 znToastHost、不再操作 zn-toast 类（注释历史提及不算回退）', () => {
    assert.doesNotMatch(src, /getElementById\('znToastHost'\)/, 'znToastHost 查找/创建应退役');
    assert.doesNotMatch(src, /className = 'zn-toast'/, 'zn-toast 类赋值应退役');
    assert.doesNotMatch(src, /classList\.add\('zn-toast-in'\)/, 'zn-toast-in 类操作应退役');
  });

  it('xnSay 透传 kind；Xn.toast 签名升级 (m, kind)（view js 通道贯通语义）', () => {
    assert.match(src, /function xnSay\(line, tip, kind\)/, 'xnSay 应加第三参 kind');
    assert.match(src, /znToast\(line, kind\)/, 'xnSay 兜底 toast 应透传 kind');
    assert.match(src, /toast: \(m, kind\) => xnSay\(m, undefined, kind\)/,
      'Xn.toast 应透传 kind 给 xnSay');
  });

  it('富版便捷函数 window 暴露（独立 view js 可直接复用）', () => {
    assert.match(src, /window\.toastError = toastError/, 'toastError 应 window 暴露');
    assert.match(src, /window\.toastOk = toastOk/, 'toastOk 应 window 暴露');
    assert.match(src, /window\.toastInfo = toastInfo/, 'toastInfo 应 window 暴露');
  });
});

describe('v2.225 view js：34 处调用语义分级（error=红 / ok=绿）', () => {
  const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');

  it('room-view 15 处全部 error（校验拦截 + errMsg 失败，xnErr 别名通道）', () => {
    const s = read('room-view.js');
    assert.match(s, /const xnErr = \(m\) => window\.Xn\.toast\(m, 'error'\)/, '应定义 error 别名通道');
    assert.equal(count(s, /xnErr\(/g), 15, '15 个调用点应全部经 xnErr');
    assert.equal(count(s, /window\.Xn\.toast\(/g), 1, 'window.Xn.toast 直调应仅剩别名定义 1 处');
  });

  it('teardown-view 本地包装透传 kind；10 error + 5 ok（别名通道）', () => {
    const s = read('teardown-view.js');
    assert.match(s, /const toast = \(msg, kind\) => \{/, '本地包装签名应升级 (msg, kind)');
    assert.match(s, /window\.Xn\.toast\(msg, kind\)/, '包装内部应透传 kind');
    assert.match(s, /const toastErr = \(m\) => toast\(m, 'error'\)/, '应定义 error 别名');
    assert.match(s, /const toastOk = \(m\) => toast\(m, 'ok'\)/, '应定义 ok 别名');
    assert.equal(count(s, /toastErr\(/g), 10, '失败/拦截语义应 10 处经 toastErr');
    assert.equal(count(s, /toastOk\(/g), 5, '成功确认语义应 5 处经 toastOk');
  });

  it('diversity-view 3 处全部 error（行数/版本数校验拦截，xnErr 别名通道）', () => {
    const s = read('diversity-view.js');
    assert.match(s, /const xnErr = \(m\) => window\.Xn\.toast\(m, 'error'\)/, '应定义 error 别名通道');
    assert.equal(count(s, /xnErr\(/g), 3, '3 个调用点应全部经 xnErr');
    assert.equal(count(s, /window\.Xn\.toast\(/g), 1, 'window.Xn.toast 直调应仅剩别名定义 1 处');
  });
});

describe('v2.225 styles.css：双 host 样式退役', () => {
  it('#znToastHost/.zn-toast 功能规则退役，富版 .toast 四色条保留', () => {
    assert.doesNotMatch(css, /#znToastHost \{/, '双 host 定位规则应删除');
    assert.doesNotMatch(css, /\.zn-toast \{/, '.zn-toast 样式规则应删除');
    assert.doesNotMatch(css, /\.zn-toast\.zn-toast-in/, 'zn-toast-in 进场样式应删除');
    assert.match(css, /\.toast\.t-error::before/, '富版 error 色条应保留');
    assert.match(css, /\.toast\.t-ok::before/, '富版 ok 色条应保留');
    assert.match(css, /\.toast\.t-warn::before/, '富版 warn 色条应保留');
    assert.match(css, /\.toast\.t-info::before/, '富版 info 色条应保留');
  });
});
