/**
 * v2.232 data-i 命名空间扫尾 —— 守卫 web/app.js、web/index.html、web/branch-view.js、web/ad-roll.js
 * 背景：renderStaticText() 会 querySelectorAll('[data-i]') 并 textContent = t(key)（app.js:71），
 *  而三处动态渲染复用了 data-i 作为「索引」数据属性（非 i18n 键）；I18N.t 未知键回落返回 key
 *  本身（i18n.js:317）→ 语言切换瞬间动态内容被洗成裸数字：
 *   1) app.js 快速搜索列表 data-i="${i}"（点击跳转读取 getAttribute('data-i')，读写双处）
 *   2) branch-view.js 权重输入 data-i="${i}"（写侧残留，读侧按 .br-w class 取）
 *   3) ad-roll.js 轮播圆点 data-i="${i}"（写侧残留，读侧按 .ad-dots i 选择器取）
 * 另：#subAllBtn 展开态文案由多段 t() 拼接（subHideAll+计数），元素却挂静态 data-i="subShowAll"
 *  → 展开后切语言，按钮退回「查看全部」而列表仍展开（状态错位）→ 去 data-i + syncSubAllLabel 自愈。
 * 本文件静态断言收口不被回退（读源码断言，不起服务器，跑得快）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(WEB, 'i18n.js'), 'utf8');
const branchView = fs.readFileSync(path.join(WEB, 'branch-view.js'), 'utf8');
const adRoll = fs.readFileSync(path.join(WEB, 'ad-roll.js'), 'utf8');

describe('v2.232 data-i 命名空间扫尾', () => {
  it('app.js：动态模板不得再用 data-i= 作为数据属性（全部改 data-idx 或删除）', () => {
    assert.doesNotMatch(src, /data-i="\$\{/, 'app.js 动态 innerHTML 中不得出现 data-i="${…}"（语言切换会被 t(key) 洗成裸数字）');
  });

  it('app.js：快速搜索列表读写双处改用 data-idx', () => {
    assert.match(src, /data-idx="\$\{i\}"/, 'qs 渲染应写 data-idx="${i}"');
    assert.match(src, /el\.onclick = \(\) => pick\(\+el\.getAttribute\('data-idx'\)\)/, 'qs 点击读取应改 getAttribute(\'data-idx\')');
  });

  it('branch-view.js / ad-roll.js：动态元素上的 data-i 残留清零', () => {
    assert.doesNotMatch(branchView, /data-i=/, 'branch-view.js 不得残留 data-i=（读侧按 .br-w class 取，属性纯冗余）');
    assert.doesNotMatch(adRoll, /data-i=/, 'ad-roll.js 不得残留 data-i=（读侧按 .ad-dots i 选择器取，属性纯冗余）');
  });

  it('app.js：renderStaticText 的 [data-i] 绑定循环与三个自愈钩子保持完好', () => {
    const region = src.slice(src.indexOf('function renderStaticText'), src.indexOf('/* ---------- 12 模式 ---------- */'));
    assert.match(region, /querySelectorAll\('\[data-i\]'\)\.forEach/, '静态 i18n 绑定机制本体不得动');
    assert.match(region, /refreshListenBtn\(\)/, 'listenBtn 自愈钩子保留');
    assert.match(region, /listenSyncUI\(\)/, '播放器按钮自愈钩子保留');
    assert.match(region, /staffCostPatch\(\)/, '内部账户价格补丁自愈钩子保留');
    assert.match(region, /syncSubAllLabel\(\)/, 'subAllBtn 展开态标签自愈钩子接入');
  });

  it('app.js：syncSubAllLabel 统一收口 subAllBtn 文案（含展开态缓存计数）', () => {
    assert.match(src, /function syncSubAllLabel\(\)/, '应有具名 syncSubAllLabel（函数声明提升，供 renderStaticText 调用）');
    const region = src.slice(src.indexOf('function syncSubAllLabel'), src.indexOf('function syncSubAllLabel') + 1200);
    assert.match(region, /subAllCache/, '展开态计数应入缓存，切语言后可复原');
    assert.match(region, /t\('subShowAll'\)/, '收起态文案应走 t(\'subShowAll\')（替代被移除的 data-i 静态绑定）');
    assert.match(region, /t\('subHideAll'\)/, '展开态文案应走 t(\'subHideAll\') 拼接');
  });

  it('index.html：#subAllBtn 不再挂 data-i（防语言切换洗掉展开态文案）', () => {
    const m = html.match(/<button[^>]*id="subAllBtn"[^>]*>/);
    assert.ok(m, 'subAllBtn 按钮应存在');
    assert.doesNotMatch(m[0], /data-i=/, 'subAllBtn 不得携带 data-i 属性');
  });

  it('i18n：t() 未知键回落返回 key 本身的机制未被改动（本类 bug 的可见性根基）', () => {
    assert.match(i18n, /\?\? key/, 'I18N.t 回落链（lang→zh→key）应保持原样');
    for (const key of ['subShowAll', 'subHideAll', 'subAllCount', 'subUnverifiedN']) {
      const n = i18n.split(key + ':').length - 1;
      assert.ok(n >= 2, key + ' 应在 zh/en 两块均有定义（当前 ' + n + ' 处）');
    }
  });
});
