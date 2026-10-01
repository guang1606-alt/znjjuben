/**
 * v2.279 dogfood 第十七轮（SSE 断流恢复面）——断流即误判失败，与服务端「断网不丢」语义矛盾
 * 背景（静态审计）：
 *  服务端 generate.ts L2549 明确语义：客户端 SSE 断连后后台继续跑完、正常结算入库（断网不丢）。
 *  但前端 startGenerate 的 catch 对 NETWORK_ERR/TIMEOUT 直接 failGenerationSession + showFail——
 *  用户看到「生成失败」，实际服务端仍在生成/已完成且积分已正常结算；用户若按失败重试，
 *  会与服务端在途任务并存（双份生成/双扣费风险仅被 FREE 限额与项目复用部分缓解）。
 * 修法：
 *  - 新增 pollUntilSettled(session, account)：断流且已持 projectId 时按 /projects/:id/scripts
 *    轮询分集落库（间隔 + 截止上限），拿到分集即渲染真实结果（标 done），超时/确认失败才落失败面板；
 *  - catch 中 NETWORK_ERR/TIMEOUT 分支在 failGenerationSession 之前先走恢复；
 *  - 恢复期间任务卡片转「重连中」（session.recovering 标志，renderTaskQueue 文案分支）；
 *  - 轮询全程尊重 isPrivateSessionCurrent 换号守卫与卡片移除（genSessions.includes）。
 * 本文件断言修复形态不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8')
  .replace(/\/\/.*$/gm, ''); // 剥行注释

function fnWindow(startMarker, maxLen) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  return src.slice(s, s + (maxLen || 6000));
}
// 精确函数体窗口：到下一个同级函数定义为止（防大窗口把函数外同名守卫误判为函数内，v2.279 M2 假绿教训）
function fnBody(startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = src.indexOf(endMarker, s + startMarker.length);
  return e < 0 ? src.slice(s) : src.slice(s, e);
}

describe('v2.279 [R1] SSE 断流恢复：断网不判失败，轮询分集落库恢复真实结果', () => {
  it('C1 pollUntilSettled 恢复函数存在且轮询项目分集接口', () => {
    const w = fnBody('async function pollUntilSettled', 'function failGenerationSession');
    assert.ok(w.length > 0, 'pollUntilSettled 未定义');
    assert.match(w, /projects\/\$\{[^}]*projectId[^}]*\}\/scripts/, '必须按 projectId 轮询分集接口');
  });

  it('C2 轮询有截止上限与间隔（防无限轮询/打爆接口）', () => {
    const w = fnBody('async function pollUntilSettled', 'function failGenerationSession');
    assert.match(w, /DEADLINE|deadline|TIMEOUT_MS|MAX_.*MS/, '应有截止上限常量');
    assert.match(w, /setTimeout/, '应有轮询间隔');
  });

  it('C3 恢复成功路径渲染真实结果（openProject 拉分集开详情），不是仅 toast 提示', () => {
    // 恢复时无 done 帧完整载荷（antiAi/market 分数皆缺），renderResult 会渲染大片 '-'；
    // 正确落地是 openProject：切作品视图、真实拉取 /scripts 渲染成稿列表（与 done 卡片点击行为一致）。
    const w = fnBody('async function pollUntilSettled', 'function failGenerationSession');
    assert.match(w, /openProject\(/, '恢复成功必须打开真实项目详情（分集成稿），不得仅 toast');
  });

  it('C4 轮询尊重换号守卫与卡片移除（stale/切号不得写 DOM）', () => {
    const w = fnBody('async function pollUntilSettled', 'function failGenerationSession');
    assert.match(w, /isPrivateSessionCurrent\(account\)/, '缺换号守卫');
    assert.match(w, /genSessions\.includes\(session\)/, '缺卡片移除守卫');
  });

  it('C5 catch 中断流（NETWORK_ERR/TIMEOUT）先走恢复，失败才落 failGenerationSession', () => {
    const w = fnWindow('async function startGenerate', 12000);
    const iCatch = w.lastIndexOf('} catch (e) {');
    assert.ok(iCatch > 0, 'startGenerate catch 未定位');
    const tail = w.slice(iCatch);
    const iRecover = tail.indexOf('pollUntilSettled(');
    const iFail = tail.indexOf('failGenerationSession(session');
    assert.ok(iRecover >= 0, 'catch 分支未接入断流恢复');
    assert.ok(iFail > iRecover, '必须先尝试恢复，恢复失败才判失败');
    assert.match(tail, /NETWORK_ERR[\s\S]{0,400}pollUntilSettled|pollUntilSettled[\s\S]{0,400}NETWORK_ERR/,
      '恢复入口必须与 NETWORK_ERR/TIMEOUT 断流判定关联');
  });

  it('C6 恢复期间任务卡片显示「重连中」（recovering 标志接入 renderTaskQueue）', () => {
    assert.match(src, /\.recovering/, '应有 recovering 标志');
    const w = fnWindow('function renderTaskQueue', 3000);
    assert.match(w, /recovering/, 'renderTaskQueue 未区分重连中文案');
  });

  it('C7 恢复有 projectId 前提（未建成项目的早期失败不得空轮询）', () => {
    const w = fnWindow('async function startGenerate', 12000);
    const iCatch = w.lastIndexOf('} catch (e) {');
    const tail = w.slice(iCatch);
    assert.match(tail, /projectId[\s\S]{0,200}pollUntilSettled|pollUntilSettled[\s\S]{0,200}projectId/,
      '断流恢复必须以 session.projectId 存在为前提');
  });
});
