/**
 * v2.278 dogfood 第十六轮（加载三态 lens）——「我的作品」主列表缺骨架屏，加载期全白
 * 背景（静态审计，三态覆盖比对）：
 *  loadWorks 有错误态（catch → znErrorHtml）与空态（znEmptyHtml），但缺骨架态：
 *  进入「我的作品」或 250ms 防抖搜索触发时，函数开头 grid.innerHTML='' 后立即 await 取数，
 *  弱网/慢请求期间作品网格全白零反馈；同族资产库三面板（loadCastAssets 等）均已在取数前
 *  znSkeleton(grid,'grid')，本函数是唯一缺骨架态的主列表。
 * 修法（同族范式 + v2.274 序号语义）：
 *  - 已登录分支内、发请求前：znSkeleton(grid, 'grid')（卡片网格形态）；
 *  - 成功路径 seq 校验后先 grid.innerHTML='' 清骨架再渲染卡片；
 *  - catch 分支 seq 校验后先 grid.innerHTML='' 清骨架再置错误态；
 *  - 未登录早退分支在骨架之前，未登录不得闪骨架（直接空态 needLogin）。
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

describe('v2.278 [R1] loadWorks 加载骨架屏（三态补全）', () => {
  const w = fnWindow('async function loadWorks() {', 6000);

  it('B1 loadWorks 窗口可定位', () => {
    assert.ok(w.length > 0, 'loadWorks 未定位到');
  });

  it('B2 已登录分支内有网格骨架调用 znSkeleton(grid, \'grid\')', () => {
    assert.match(w, /znSkeleton\(grid,\s*'grid'\)/);
  });

  it('B3 骨架必须先于请求发出（进入/搜索即见骨架，不白屏）', () => {
    const iSk = w.indexOf("znSkeleton(grid, 'grid')");
    const iReq = w.indexOf("Api.request('/api/generate/projects'");
    assert.ok(iSk >= 0 && iReq > 0, '骨架调用与请求均应在窗口内');
    assert.ok(iSk < iReq, '骨架必须在 Api.request 之前写入，否则加载期仍全白');
  });

  it('B4 未登录早退在骨架之前（未登录直接 needLogin 空态，不得闪骨架）', () => {
    const iAuth = w.indexOf('if (!Api.isAuthed())');
    const iSk = w.indexOf("znSkeleton(grid, 'grid')");
    assert.ok(iAuth >= 0 && iSk > iAuth, 'isAuthed 早退必须先于骨架写入');
  });

  it('B5 成功路径：seq 校验后、写 worksCount 前必须清骨架（缺清除 = 骨架与卡片并存）', () => {
    const iGuard = w.indexOf('seq !== worksReqSeq');
    const iRender = w.indexOf("t('worksCount'");
    const iClear = w.indexOf("grid.innerHTML = ''", iGuard);
    assert.ok(iGuard >= 0, '应有序号校验');
    assert.ok(iRender > iGuard, 'worksCount 渲染仍在校验之后（v2.274 语义不回退）');
    assert.ok(iClear > iGuard && iClear < iRender,
      '成功路径必须在 seq 校验之后、worksCount 渲染之前清骨架（缺清除则骨架残留，顺序错则清不掉骨架）');
  });

  it('B6 catch 分支：seq 校验后清骨架再置错误态（不得残留骨架与错误态并存）', () => {
    const iCatch = w.indexOf('catch');
    assert.ok(iCatch > 0, '应有 catch 分支');
    const tail = w.slice(iCatch);
    const iGuard = tail.indexOf('seq !== worksReqSeq');
    const iClear = tail.indexOf("grid.innerHTML = ''");
    const iErr = tail.indexOf('znErrorHtml');
    assert.ok(iGuard >= 0, 'catch 分支应有 seq 校验（v2.274 A6 语义）');
    assert.ok(iClear > iGuard, '清骨架必须在 catch 的 seq 校验之后');
    assert.ok(iErr > iClear, '错误态必须在清骨架之后写入');
  });
});
