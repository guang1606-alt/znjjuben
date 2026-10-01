/**
 * v2.285 dogfood 第二十三轮（裸 async click handler 横向盘点·行政与授权侧 lens）—— 静态守卫
 *
 * v2.283/v2.284 收口广场与市场后，完检全仓扫描剩余 6 处候选，逐个体检销项 4：
 *   - dlEpBtn.onclick：唯一 await 是 uiPrompt（非网络），其后 downloadFromServer 同步自管
 *   - [data-act="points"]/[data-act="resetpw"]：async 仅因 await uiPrompt，
 *     网络调用 admApi(...).then().catch(e=>xnSay) 链尾自带 catch，不冒泡
 *   - [data-reread] b.onclick：仅 await uiConfirm + 同步 dispatchEvent
 * 真缺口 2 处：
 *   ① xMatureRevoke.onclick：await POST /mature/consent/revoke 无 try（断网冒泡
 *      unhandledrejection），且无 r.ok 判断——HTTP 非 ok 仍乐观提示「授权已撤销」
 *      并 openXMature()（业务误报）。
 *   ② [data-pvdel] handler：uiConfirm 后 await admApi(DELETE) 无 try。admApi 走
 *      Api.request（断网全局 onNetworkError toast 已弹），但 jsonOrThrow 会把
 *      HTTP 非 ok（400/403/404）也 throw——catch 同时承担网络层与业务层失败反馈，
 *      不能像 v2.283/v2.284 那样静默，须 xnSay 失败结论并 return 阻断乐观成功提示。
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

const revW = fnBody(src, "$('xMatureRevoke').onclick = async () => {", '各模式内联创意输入');
const pvW = fnBody(src, "$('pvList').querySelectorAll('[data-pvdel]')", "$('pvList').querySelectorAll('[data-pvedit]')");

test('R1 xMatureRevoke：try 包住 revoke POST，语句级 catch 仅静默 return（网络 toast 已提示）', () => {
  const iTry = revW.indexOf('try {');
  const iReq = revW.indexOf('/mature/consent/revoke');
  assert.ok(iTry >= 0 && iTry < iReq && iReq >= 0, 'try 必须包住 revoke 请求');
  const cm = revW.match(/}\s*catch[^{]*\{\s*return;?\s*\}/);
  assert.ok(cm && cm.index > iReq, 'catch 必须存在且仅静默 return（不得 xnSay 双弹）');
});

test('R2 xMatureRevoke：非 ok 分支 return 阻断乐观提示；「授权已撤销」在 catch 之后', () => {
  assert.match(revW, /if \(!r\.ok\)[\s\S]{0,220}?return;/, '非 ok 必须早退');
  const cm = revW.match(/}\s*catch/);
  const iOk = revW.indexOf('授权已撤销');
  assert.ok(cm && iOk > cm.index, '成功提示必须位于 catch 之后（失败路径不得出现）');
  assert.match(revW, /openXMature\(\)\.catch\(\(\) => \{\}\)/, 'openXMature 收尾调用保持');
});

test('P1 data-pvdel：try 包住 admApi DELETE，catch 内 xnSay 失败反馈且 return 阻断乐观成功', () => {
  const iTry = pvW.indexOf('try {');
  const iReq = pvW.indexOf("method: 'DELETE'");
  assert.ok(iTry >= 0 && iTry < iReq && iReq >= 0, 'try 必须包住 DELETE 请求');
  const cm = pvW.match(/}\s*catch[^{]*\{[\s\S]*?\}/);
  assert.ok(cm && cm.index > iReq, 'catch 必须存在');
  assert.match(cm[0], /xnSay/, 'admApi 非 ok 亦 throw，catch 必须给失败反馈（非静默）');
  assert.match(cm[0], /return;?/, 'catch 必须 return 防乐观成功提示与后续刷新');
});

test('P2 data-pvdel：成功路径保持（删除提示 + loadProviders + loadAdmPortfolio）', () => {
  assert.match(pvW, /xnSay\('已删除并解绑路由'\)/, '成功提示丢失');
  assert.match(pvW, /await loadProviders\(\)/, '供应商列表刷新丢失');
  assert.match(pvW, /await loadAdmPortfolio\(\)/, '岗位组合刷新丢失');
});

test('P3 data-pvdel：uiConfirm  danger 确认在 try 外，取消早退保持', () => {
  const iConfirm = pvW.indexOf('uiConfirm');
  const iTry = pvW.indexOf('try {');
  assert.ok(iConfirm >= 0 && iConfirm < iTry, 'uiConfirm 必须在 try 外（非网络面）');
  assert.match(pvW, /\)\)\s*return;/, '取消确认必须早退');
});
