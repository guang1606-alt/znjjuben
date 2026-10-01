/**
 * v2.284 dogfood 第二十二轮（市场交易面 async handler reject 兜底横向收口 lens）—— 静态守卫
 *
 * 背景：v2.283 收口广场 like/del 后横向盘点，全仓 13 处「含 await 无 try」click handler。
 * 逐个体检交易域：fullConfirm/fullRefund/data-confirm/data-refund 四处调用 dealAction()，
 * 而 dealAction（v2.260）内部已有 try/catch/finally + _dealBusy 锁、不向上 throw——误报排除；
 * mkMineBtn 本体已有 try。真裸 3 处：
 *   ① mkListBtn.onclick：await GET /api/generate/projects（打开上架弹窗前拉作品列表）
 *   ② [data-delist] handler：await PATCH /listings/:id/delist（uiConfirm 之后）
 *   ③ [data-relist] handler：await PATCH /listings/:id/relist（uiPrompt 之后）
 * 断网时 Api.request 全局 onNetworkError toast 已提示，但 reject 冒泡为 unhandledrejection；
 * delist/relist 的非 ok 分支 `(await r.json()).error` 还无 .catch 保护（502 HTML 时次生 throw）。
 *
 * 修复约定：三处取数段包语句级 try/catch，catch 静默（全局 toast 已提示），
 * 业务非 ok 的 xnSay(znSanitizeErr) 分支与成功路径（开弹窗/刷新工作台）保持。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8').replace(/\/\/.*$/gm, '');

function fnBody(s, startMarker, endMarker) {
  const i = s.indexOf(startMarker);
  assert.ok(i >= 0, '窗口起点缺失: ' + startMarker);
  const j = s.indexOf(endMarker, i + startMarker.length);
  assert.ok(j >= 0, '窗口终点缺失: ' + endMarker);
  return s.slice(i, j);
}

const listW = fnBody(src, "$('mkListBtn').onclick = async () => {", 'async function previewListingValue');
const delistW = fnBody(src, "querySelectorAll('[data-delist]').forEach((b) => b.onclick = async () => {", "querySelectorAll('[data-relist]')");
const relistW = fnBody(src, "querySelectorAll('[data-relist]').forEach((b) => b.onclick = async () => {", "openModal('mineModal')");

test('A1 mkListBtn：try 起点早于 GET projects，且带语句级 catch', () => {
  const iTry = listW.indexOf('try {');
  const iReq = listW.indexOf("'/api/generate/projects'");
  assert.ok(iTry >= 0 && iTry < iReq && iReq >= 0, 'try 必须包住 projects 请求');
  const c = listW.match(/}\s*catch\b/);
  assert.ok(c && c.index > iReq, '语句级 catch 必须在请求之后');
});

test('A2 delist：try 包住 PATCH delist（含非 ok 分支 r.json 次生面），语句级 catch 在其后', () => {
  const iTry = delistW.indexOf('try {');
  const iReq = delistW.indexOf('/delist');
  assert.ok(iTry >= 0 && iTry < iReq && iReq >= 0, 'try 必须包住 delist 请求');
  const c = delistW.match(/}\s*catch\b/);
  assert.ok(c && c.index > iReq, '语句级 catch 必须在 delist 请求之后');
});

test('A3 relist：try 包住 PATCH relist，语句级 catch 在其后', () => {
  const iTry = relistW.indexOf('try {');
  const iReq = relistW.indexOf('/relist');
  assert.ok(iTry >= 0 && iTry < iReq && iReq >= 0, 'try 必须包住 relist 请求');
  const c = relistW.match(/}\s*catch\b/);
  assert.ok(c && c.index > iReq, '语句级 catch 必须在 relist 请求之后');
});

test('A4 三处 catch 静默：禁止 xnSay 双弹/裸 e.message（全局网络 toast 已提示）', () => {
  for (const [name, w] of [['mkList', listW], ['delist', delistW], ['relist', relistW]]) {
    const m = w.match(/}\s*catch[^{]*\{[\s\S]*$/);
    assert.ok(m, name + ' 语句级 catch 块缺失');
    assert.ok(!/xnSay/.test(m[0]), name + ' catch 内禁止 xnSay');
    assert.ok(!/\be\.message|\berr\.message/.test(m[0]), name + ' catch 内禁止直送裸 e.message');
  }
});

test('A5 业务非 ok 分支 xnSay(znSanitizeErr) 三窗口保留（HTTP 错误面不被吞）', () => {
  assert.match(listW, /xnSay\(znSanitizeErr/, 'mkList 业务错误分支丢失');
  assert.match(delistW, /xnSay\(znSanitizeErr/, 'delist 业务错误分支丢失');
  assert.match(relistW, /xnSay\(znSanitizeErr/, 'relist 业务错误分支丢失');
});

test('A6 成功路径保持：listModal 打开、delist/relist 后刷新卖家工作台', () => {
  assert.match(listW, /openModal\('listModal'\)/, '上架弹窗打开丢失');
  assert.match(delistW, /\$\('mkMineBtn'\)\.click\(\)/, '下架后工作台刷新丢失');
  assert.match(relistW, /\$\('mkMineBtn'\)\.click\(\)/, '重新上架后工作台刷新丢失');
});

test('A7 交互前置不被 try 误伤：未登录开门、uiConfirm/uiPrompt 取消语义保持', () => {
  assert.match(listW, /if \(!Api\.isAuthed\(\)\) \{ openAuth\('login'\); return; \}/, 'mkList 登录门丢失');
  assert.match(delistW, /await uiConfirm\(/, 'delist 确认弹窗丢失');
  assert.match(relistW, /await uiPrompt\(/, 'relist 输入弹窗丢失');
  assert.match(delistW, /=== null|=== false|\)\) return/, '取消早退丢失');
});
