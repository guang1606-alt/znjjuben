/**
 * v2.446 产品化：视图路由（URL 可寻址 / 刷新不丢页 / 后退可回上一视图）。
 *
 * 证伪背景：web/ 全目录 grep `pushState` / `replaceState` / `popstate` / `hashchange` 均为 0 命中，
 * `switchView()` 只切 DOM，不写 URL——刷新一律回首页、浏览器后退退不到上一视图、
 * 也无法把「我的作品」这类页面链接直接发给别人。本文件锁死最小 hash 路由契约：
 * 白名单视图才可寻址、程序化恢复不重复入栈、后退由 popstate 接管、管理后台不在未登录时恢复。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');

function pick(fnName) {
  const m = appJs.match(new RegExp(`function ${fnName}\\([^)]*\\)[\\s\\S]*?\\n  \\}`));
  assert.ok(m, `缺 ${fnName}`);
  return m[0];
}

test('视图切换写 URL：switchView 接受 fromRoute/replace 选项并同步 hash', () => {
  const fn = pick('switchView');
  assert.match(fn, /function switchView\(v, opts\)/, 'switchView 需接受第二参数，供路由恢复时抑制重复入栈');
  assert.match(fn, /fromRoute/, '程序化恢复（启动/后退）必须能从调用点区分，避免自身再入栈');
  assert.match(fn, /writeRoute\(v/, '切换成功后必须把视图写进 URL');
  assert.match(fn, /!!o\.replace|o\.replace/, '需要 replace 通道，避免权限回退时堆积历史记录');
});

test('hash 解析只认白名单视图，脏 hash 一律回落到首页', () => {
  const fn = pick('viewFromHash');
  assert.match(fn, /location\.hash/, '必须从 hash 解析');
  assert.match(fn, /VIEWS\.indexOf\(v\)\s*>=\s*0|VIEWS\.includes\(v\)/, '非白名单视图不得进入（防任意 hash 触发未知分支）');

  const init = pick('initViewRouter');
  assert.match(init, /viewFromHash\(\)/, '启动时必须读一次 hash');
  assert.match(init, /writeRoute\('home', true\)|writeRoute\(restore, true\)/, '启动需用 replaceState 归一 URL，不制造历史记录');
  assert.match(init, /addEventListener\('popstate'/, '浏览器后退/前进必须由 popstate 接管');
  assert.match(init, /fromRoute: true/, 'popstate 内的切换不能再写一次历史，否则后退会自增');
});

test('管理后台不在未登录时从 URL 恢复，避免刷新即弹登录框', () => {
  const init = pick('initViewRouter');
  assert.match(init, /initial !== 'admin' \|\| Api\.isAuthed\(\)/, 'admin 视图需登录后才可恢复');
});

test('writeRoute 用 history 而非 location.hash 赋值，且失败可降级', () => {
  const fn = pick('writeRoute');
  assert.match(fn, /pushState/, '前进需新增历史记录');
  assert.match(fn, /replaceState/, '归一/替换场景不留历史');
  assert.match(fn, /try\s*\{[\s\S]*?catch/, 'file:// 等受限环境下 history 可能抛错，需降级不阻断视图切换');
  assert.match(fn, /location\.pathname|location\.search/, '必须保留现有 query，不能把 ?参数 抹掉');
});

test('路由在启动段接线，早于业务取数', () => {
  const boot = appJs.match(/initNetWatch\(\); initInstallPrompt\(\);[\s\S]{0,400}if \(Api\.isAuthed\(\)\) loadMe\(\);/);
  assert.ok(boot, '缺启动段');
  assert.match(boot[0], /initViewRouter\(\)/, '启动段必须接线视图路由');
  assert.ok(
    boot[0].indexOf('initViewRouter()') < boot[0].indexOf('loadMe()'),
    '路由恢复要先于 loadMe，避免刷新后视图与数据各按一套状态跑'
  );
});
