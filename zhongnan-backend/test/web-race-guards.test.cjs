/**
 * v2.258 异步竞态守卫（stale response 不得覆盖新状态）—— 静态守卫 web/app.js
 * 背景：快速切换榜单 Tab / 翻页 / 排序、开关详情弹窗、切标签维度、连续触发投稿匹配时，
 *  先发的慢请求后返回会把旧数据写回当前容器。项目既有守卫范式：ivIsCurrent(epoch)、
 *  listenReqSeq、制式 reqSeq（3082）、isPrivateSessionCurrent。
 * 本文件断言新增的同族 seq 守卫不被回退（读源码断言，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(path.join(__dirname, '..', 'web'), 'app.js'), 'utf8');

function fnWindow(startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) return '';
  const e = endMarker ? src.indexOf(endMarker, s) : -1;
  return e > s ? src.slice(s, e) : src.slice(s, s + 2000);
}

describe('v2.258 市场区 mkGrid 共享竞态令牌（loadListings/loadBoard 交叉作废）', () => {
  it('声明共享令牌 mkReqSeq', () => {
    assert.ok(/let\s+mkReqSeq\s*=\s*0\s*;/.test(src), '应有 let mkReqSeq = 0; 市场区共享请求序号');
  });

  it('loadListings 取数前自增序号，写 mkGrid 前校验未过期（翻页/排序连点不被旧响应覆盖）', () => {
    const w = fnWindow('async function loadListings()', 'async function openListingDetail');
    assert.ok(w, '应定位到 loadListings');
    const inc = w.indexOf('++mkReqSeq');
    assert.ok(inc >= 0, 'loadListings 应自增 mkReqSeq');
    const awaitPos = w.indexOf('await fetch');
    assert.ok(awaitPos >= 0 && inc < awaitPos, '自增应发生在 await 取数之前');
    const guard = w.indexOf('seq !== mkReqSeq');
    assert.ok(guard > awaitPos, 'await 之后、渲染之前应校验 seq !== mkReqSeq 并 return');
    assert.ok(guard < w.indexOf("$('mkGrid')"), '过期校验应在写 mkGrid 之前');
  });

  it('loadBoard 取数前自增序号（且早于 all 分支），渲染前校验未过期', () => {
    const w = fnWindow('async function loadBoard(type)', null).slice(0, 1600);
    assert.ok(w, '应定位到 loadBoard');
    const inc = w.indexOf('++mkReqSeq');
    const allBranch = w.indexOf("type === 'all'");
    const awaitPos = w.indexOf('await fetch');
    assert.ok(inc >= 0, 'loadBoard 应自增 mkReqSeq');
    assert.ok(allBranch >= 0 && inc < allBranch, '自增必须早于 all 分支（all 分支调 loadListings 会再 ++ 作废旧榜单请求）');
    assert.ok(awaitPos > allBranch, '取数应在 all 分支之后');
    const guard = w.indexOf('seq !== mkReqSeq');
    assert.ok(guard > awaitPos && guard < w.indexOf("$('mkGrid')"), 'await 后写网格前应校验序号');
  });
});

describe('v2.258 openListingDetail 详情弹窗竞态令牌', () => {
  it('打开详情自增 detailReqSeq，两个 await 后与 catch 均校验过期（关 A 开 B 不被 A 慢响应覆盖）', () => {
    const w = fnWindow('async function openListingDetail(id)', "$('mkSort').onchange");
    assert.ok(w, '应定位到 openListingDetail');
    assert.ok(/\+\+detailReqSeq/.test(w), '应自增 detailReqSeq');
    assert.ok(/let\s+detailReqSeq\s*=\s*0\s*;/.test(src), '应声明 let detailReqSeq = 0;');
    // fetch 返回后先校验（覆盖 !res.ok 错误态分支）
    const fetchPos = w.indexOf('await fetch(');
    const g1 = w.indexOf('seq !== detailReqSeq', fetchPos);
    assert.ok(g1 >= 0 && g1 < w.indexOf('znErrorHtml(errText)'), 'fetch 返回后应先校验序号（过期错误态也不得覆盖新弹窗骨架）');
    // res.json() 返回后渲染前再校验
    const jsonPos = w.indexOf('await res.json()', g1);
    const renderPos = w.indexOf('body.innerHTML = `', jsonPos);
    const g2 = w.indexOf('seq !== detailReqSeq', jsonPos);
    assert.ok(jsonPos >= 0 && g2 >= 0 && g2 < renderPos, 'res.json 后、正文渲染前应再次校验序号');
    // catch 不得为过期请求渲染错误态
    const catchPos = w.indexOf('} catch', renderPos);
    assert.ok(catchPos >= 0, '应保留 v2.256 网络异常 catch');
    assert.ok(/catch\s*\{[^}]*seq\s*!==\s*detailReqSeq[^}]*return/.test(w.slice(catchPos, catchPos + 160)),
      'catch 应先校验序号再渲染 znErrorHtml');
  });
});

describe('v2.258 loadTagLeaves 维度切换竞态令牌 + 失败兜底', () => {
  it('切维度自增 tagLeavesSeq，await 后校验；取数走 jsonOrThrow 且 catch 有兜底（不再裸 .json 无 catch）', () => {
    const w = fnWindow('async function loadTagLeaves(dim)', 'function addTag(');
    assert.ok(w, '应定位到 loadTagLeaves');
    assert.ok(/let\s+tagLeavesSeq\s*=\s*0\s*;/.test(src), '应声明 let tagLeavesSeq = 0;');
    const inc = w.indexOf('++tagLeavesSeq');
    const awaitPos = w.indexOf('await');
    assert.ok(inc >= 0 && inc < awaitPos, '自增应在 await 前');
    const guard = w.indexOf('seq !== tagLeavesSeq');
    assert.ok(guard > awaitPos && guard < w.indexOf('renderTagPool'), 'await 后写标签池前应校验序号');
    assert.ok(w.includes('jsonOrThrow'), '取数应走 Api.jsonOrThrow（纳入 v2.226 脱敏层，替代裸 .json()）');
    const wCode = w.replace(/\/\/.*$/gm, ''); // 剥行注释（注释文字本身可能含 ".json()"）
    assert.ok(!/\.json\(\)/.test(wCode), '不应再保留裸 .json()');
    const catchPos = w.indexOf('catch');
    assert.ok(catchPos >= 0, '应有 catch 兜底（消除 unhandled rejection）');
    assert.ok(/catch[^}]*tagRecommendFail/.test(w.slice(catchPos)), 'catch 应提示 tagRecommendFail 并清空标签池');
  });
});

describe('v2.258 loadSubmissionMatch 投稿匹配竞态令牌', () => {
  it('每次匹配自增 subMatchSeq，渲染前与 catch 均校验（连跑两次体检旧结果不覆盖新结果）', () => {
    const w = fnWindow('async function loadSubmissionMatch(tags)', 'function renderSubmission(');
    assert.ok(w, '应定位到 loadSubmissionMatch');
    assert.ok(/let\s+subMatchSeq\s*=\s*0\s*;/.test(src), '应声明 let subMatchSeq = 0;');
    const inc = w.indexOf('++subMatchSeq');
    const awaitPos = w.indexOf('await Api');
    assert.ok(inc >= 0 && inc < awaitPos, '自增应在 await 前');
    const guard = w.indexOf('seq !== subMatchSeq');
    assert.ok(guard > awaitPos && guard < w.indexOf('renderSubmission'), 'await 后渲染匹配前应校验序号');
    const catchPos = w.indexOf('catch');
    assert.ok(/catch\s*\{[^}]*seq\s*!==\s*subMatchSeq[^}]*return/.test(w.slice(catchPos, catchPos + 140)),
      'catch 应先校验序号再隐藏面板');
  });
});
