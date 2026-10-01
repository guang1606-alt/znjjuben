/**
 * v2.283 dogfood 第二十一轮（广场交互 handler 网络层 reject 未兜底 lens）—— 静态守卫
 *
 * 复现（DEMO 8099，登录后 page.route abort like 端点）：
 *   likeBtn.onclick = async () => { const r = await Api.request('/like'...) }
 *   Api.request 断网 throw makeNetErr(NETWORK_ERR)，api.js L178 全局 onNetworkError
 *   已弹「网络异常」toast（用户感知已覆盖），但 handler 无 try/catch → reject 冒泡为
 *   unhandledrejection（控制台 Error: NETWORK_ERR），污染嵌入式 webview/前端监控错误率。
 *   delBtn.onclick（DELETE 帖子）同构同缺陷。
 *
 * 修复约定：两 handler 的 await 段包 try/catch；业务错误（r.ok=false）xnSay 分支保持；
 * catch 块保持静默（全局 toast 已提示），禁止再 xnSay(e.message) 双弹或裸码直送。
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

const likeW = fnBody(src, 'likeBtn.onclick = async () => {', 'const delBtn');
const delW = fnBody(src, "delBtn.onclick = async () => {", 'feed.appendChild(c)');

test('A1 like handler：try 块包裹且开启位置早于 like 请求', () => {
  const iTry = likeW.indexOf('try {');
  const iReq = likeW.indexOf('/like');
  assert.ok(iTry >= 0, 'like handler 缺 try 块');
  assert.ok(iTry < iReq && iReq >= 0, 'try 必须包住 like 请求（try 起点在请求之前）');
});

test('A2 like handler：语句级 catch 位于 like 请求之后（兜住网络层 reject；Promise .catch 不算）', () => {
  const m = likeW.match(/}\s*catch\b/);
  assert.ok(m, 'like handler 缺 try/catch（r.json().catch 不计）');
  assert.ok(m.index > likeW.indexOf('/like'), 'catch 必须在 like 请求之后');
});

test('A3 del handler：try 块包裹且开启位置早于 DELETE 请求', () => {
  const iTry = delW.indexOf('try {');
  const iReq = delW.indexOf("posts/${p.id}`, { method: 'DELETE'");
  assert.ok(iTry >= 0, 'del handler 缺 try 块');
  assert.ok(iTry < iReq && iReq >= 0, 'try 必须包住删除请求');
});

test('A4 del handler：语句级 catch 位于 DELETE 请求之后', () => {
  const m = delW.match(/}\s*catch\b/);
  assert.ok(m, 'del handler 缺 try/catch');
  assert.ok(m.index > delW.indexOf("method: 'DELETE'"), 'catch 必须在删除请求之后');
});

test('A5 两 handler 业务错误 xnSay(znSanitizeErr) 分支保持（HTTP 非 ok 不被吞）', () => {
  assert.match(likeW, /else xnSay\(znSanitizeErr/, 'like 业务错误分支丢失');
  assert.match(delW, /else xnSay\(znSanitizeErr/, 'del 业务错误分支丢失');
});

test('A6 catch 块静默：不得再 xnSay（全局 onNetworkError toast 已提示，禁止双弹/裸码直送）', () => {
  for (const [name, w] of [['like', likeW], ['del', delW]]) {
    // 语句级 try/catch：从 `} catch` 起取到窗口末尾（避开 r.json().catch Promise 链）
    const m = w.match(/}\s*catch[^{]*\{[\s\S]*$/);
    assert.ok(m, name + ' 语句级 catch 块缺失');
    const body = m[0];
    assert.ok(!/xnSay/.test(body), name + ' catch 内禁止 xnSay（与全局网络 toast 重复）');
    assert.ok(!/\be\.message|\berr\.message/.test(body), name + ' catch 内禁止直送裸 e.message');
  }
});

test('A7 两 handler 成功路径更新逻辑保持（点赞数/删除后刷新）', () => {
  assert.match(likeW, /likeBtn\.dataset\.liked/, '点赞态更新丢失');
  assert.match(delW, /loadFeed\(\)/, '删除成功后刷新列表丢失');
});
