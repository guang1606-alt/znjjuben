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

describe('v2.258 loadTagLeaves 维度切换竞态令牌 + 失败兜底（v2.259 起令牌升级为标签池共享 tagPoolSeq）', () => {
  it('切维度自增 tagPoolSeq，await 后校验；取数走 jsonOrThrow 且 catch 有兜底（不再裸 .json 无 catch）', () => {
    const w = fnWindow('async function loadTagLeaves(dim)', 'function addTag(');
    assert.ok(w, '应定位到 loadTagLeaves');
    assert.ok(/let\s+tagPoolSeq\s*=\s*0\s*;/.test(src), '应声明 let tagPoolSeq = 0;（标签池共享序号）');
    const inc = w.indexOf('++tagPoolSeq');
    const awaitPos = w.indexOf('await');
    assert.ok(inc >= 0 && inc < awaitPos, '自增应在 await 前');
    const guard = w.indexOf('seq !== tagPoolSeq');
    assert.ok(guard > awaitPos && guard < w.indexOf('renderTagPool'), 'await 后写标签池前应校验序号');
    assert.ok(w.includes('jsonOrThrow'), '取数应走 Api.jsonOrThrow（纳入 v2.226 脱敏层，替代裸 .json()）');
    const wCode = w.replace(/\/\/.*$/gm, ''); // 剥行注释（注释文字本身可能含 ".json()"）
    assert.ok(!/\.json\(\)/.test(wCode), '不应再保留裸 .json()');
    const catchPos = w.indexOf('catch');
    assert.ok(catchPos >= 0, '应有 catch 兜底（消除 unhandled rejection）');
    assert.ok(/catch[^}]*tagRecommendFail/.test(w.slice(catchPos)), 'catch 应提示 tagRecommendFail 并清空标签池');
  });
});

describe('v2.259 标签池搜索↔维度跨流竞态（searchTagPool 与 loadTagLeaves 共享 tagPoolSeq）', () => {
  it('searchTagPool 入口（含空词清池分支）即自增共享序号，await 后与 catch 均校验，取数走 jsonOrThrow', () => {
    const w = fnWindow('async function searchTagPool()', 'async function loadTagLeaves');
    assert.ok(w, '应定位到 searchTagPool');
    const inc = w.indexOf('++tagPoolSeq');
    const branch = w.indexOf('if (!q)');
    const awaitPos = w.indexOf('await Api');
    assert.ok(inc >= 0 && inc < branch, '入口先自增序号（空词清池也必须作废旧在途请求）');
    assert.ok(awaitPos > branch, '取数应在空词分支之后');
    const guard = w.indexOf('seq !== tagPoolSeq', awaitPos);
    assert.ok(guard >= 0 && guard < w.indexOf('renderTagPool', awaitPos), 'await 后写标签池前应校验共享序号（慢搜索词不覆盖新维度/新搜索）');
    assert.ok(w.includes('jsonOrThrow'), '搜索取数应走 Api.jsonOrThrow');
    const wCode = w.replace(/\/\/.*$/gm, '');
    assert.ok(!/\.json\(\)/.test(wCode), '不应再保留裸 .json()');
    const catchPos = w.indexOf('catch');
    assert.ok(/catch[^}]*seq\s*!==\s*tagPoolSeq[^}]*return/.test(w.slice(catchPos, catchPos + 160)),
      'catch 应先校验序号再清池提示（过期失败不得覆盖新状态）');
  });

  it('维度下拉选「空」与清空已选按钮均自增共享序号（显式清池后在途响应不得回填）', () => {
    const w = fnWindow('function initTagBench()', 'function renderTagPool');
    assert.ok(/onchange[\s\S]*?else\s*\{\s*\+\+tagPoolSeq\s*;\s*renderTagPool\(\[\]\)\s*;?\s*\}/.test(w),
      'tagDim 选空分支应 ++tagPoolSeq 后再清池');
    const clearBtn = w.indexOf("$('tagClearBtn')");
    assert.ok(clearBtn >= 0, '应定位 tagClearBtn');
    assert.ok(w.slice(clearBtn, clearBtn + 260).includes('++tagPoolSeq'), 'tagClearBtn 清池前应自增序号');
  });

  it('维度下拉预取不再静默吞错（/api/tags/dimensions 走 jsonOrThrow，catch 有 xnSay 提示）', () => {
    const w = fnWindow('function initTagBench()', 'function renderTagPool');
    const pre = w.indexOf('/api/tags/dimensions');
    assert.ok(pre >= 0, '应保留维度预取');
    const seg = w.slice(pre, pre + 260);
    assert.ok(seg.includes('jsonOrThrow'), '维度预取应走 Api.jsonOrThrow');
    assert.ok(!/catch\s*\(\s*\)\s*=>\s*\{\s*\}/.test(seg), '不应再 .catch(() => {}) 完全静默（v2.255 同族旧账）');
    assert.ok(/catch[^]*xnSay/.test(seg), 'catch 应 xnSay 提示，维度下拉失败用户可知');
  });
});

describe('v2.259 loadFeed 交流广场板块/翻页竞态令牌', () => {
  it('切板块/翻页自增 feedReqSeq，取数结束写 sqEmpty/sqFeed 前校验（旧板块慢响应不覆盖当前 Tab）', () => {
    assert.ok(/let\s+feedReqSeq\s*=\s*0\s*;/.test(src), '应声明 let feedReqSeq = 0;');
    const w = fnWindow('async function loadFeed()', 'function renderSqPager');
    assert.ok(w, '应定位到 loadFeed');
    const inc = w.indexOf('++feedReqSeq');
    const awaitPos = w.indexOf('await fetch');
    assert.ok(inc >= 0 && inc < awaitPos, '自增应在 await 取数之前');
    const settled = w.indexOf('catch { failed = true; }');
    const guard = w.indexOf('seq !== feedReqSeq');
    const writePos = w.indexOf("$('sqEmpty')");
    assert.ok(settled >= 0 && guard > settled, '序号校验应在 try/catch 结算之后');
    assert.ok(guard < writePos, '序号校验应在写 sqEmpty/sqFeed 之前');
  });
});

describe('v2.259 openValueCard 价值证书跨项目竞态守卫', () => {
  it('入口固化 pid 且 URL 用 pid，await 后与 catch 均校验项目未切换（A 项目慢证书不覆盖 B 项目）', () => {
    const w = fnWindow('async function openValueCard()', 'function renderValueCard');
    assert.ok(w, '应定位到 openValueCard');
    const cap = w.indexOf('const pid = currentProjectId');
    const reqPos = w.indexOf('Api.request(`/api/generate/projects/');
    assert.ok(cap >= 0 && cap < reqPos, '应在取数前固化 const pid = currentProjectId');
    assert.ok(/projects\/\$\{pid\}\/value-card/.test(w), '请求 URL 应使用固化的 pid（而非 await 后再读全局）');
    const guardTry = w.indexOf('pid !== currentProjectId', reqPos);
    assert.ok(guardTry >= 0 && guardTry < w.indexOf('renderValueCard', reqPos), 'await 成功返回后、渲染前应校验 pid 未切换');
    const catchPos = w.indexOf('} catch', guardTry);
    assert.ok(/catch[^}]*pid\s*!==\s*currentProjectId[^}]*return/.test(w.slice(catchPos, catchPos + 160)),
      'catch 应先校验 pid 再渲染错误态');
  });
});

describe('v2.259 openPkBoard 战力榜重入竞态令牌', () => {
  it('每次打开榜单自增 pkBoardSeq，await 后与 catch 均校验（旧在途失败不覆盖新加载）', () => {
    assert.ok(/let\s+pkBoardSeq\s*=\s*0\s*;/.test(src), '应声明 let pkBoardSeq = 0;');
    const w = fnWindow('async function openPkBoard()', 'function renderMineCard');
    assert.ok(w, '应定位到 openPkBoard');
    const inc = w.indexOf('++pkBoardSeq');
    const awaitPos = w.indexOf('await Api');
    assert.ok(inc >= 0 && inc < awaitPos, '自增应在 await 取数之前');
    const guard = w.indexOf('seq !== pkBoardSeq', awaitPos);
    assert.ok(guard >= 0 && guard < w.indexOf('season.textContent', awaitPos), 'await 后写榜单前应校验序号');
    const catchPos = w.indexOf('} catch', guard);
    assert.ok(/catch[^}]*seq\s*!==\s*pkBoardSeq[^}]*return/.test(w.slice(catchPos, catchPos + 160)),
      'catch 应先校验序号再渲染错误态');
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
