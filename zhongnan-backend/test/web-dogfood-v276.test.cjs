const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.276 dogfood 第十一轮 · 生成主链路「建卡前启动准备窗口」弱网重复建单（移动端 lens）
// Playwright 弱网实证（零后端副作用，projects 用 route fulfill 假项目）：novel 等走 #modeBrief 的内联模式下，
// startGenerate 在建会话卡之前要串行 await 三份资产清单（冷启动弱网实测 ≈3s、期间 0 卡、genBtn 不 disabled、
// 仅 800ms UI 节流）。窗口内第二次点击（>800ms 放行）各走一遍：两单都通过校验 → genSessions 各 unshift 一张卡
// → 连发 2 个 POST /api/generate/projects（紧接扣费 episodes），实测 2 卡 / 2 projects / 0 JS 错误。
// tags 模式仅因「建卡→progressPanel 经 MutationObserver 顶替隐藏 tagBench→后单 useTagBench=false 走空 brief return」
// 这一巧合副作用幸免；其余内联 brief 模式无保护。
// 修复：模块级 _genStarting「建卡前瞬时单飞闸」——入口拦截重入并提示，置位后 try/finally 兜底释放；
// 一旦通过校验、与 genSessions.unshift 同一同步执行段提前释放，故 v2.132 卡后多任务并行完全不受影响。
const srcRaw = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const src = srcRaw.replace(/\/\/.*$/gm, ''); // 剥行注释，防注释文本救场
const FN_MARK = 'async function startGenerate() {';
const fnStart = src.indexOf(FN_MARK);
const fnEnd = src.indexOf('function handleEvent(data, session)', fnStart);
assert.ok(fnStart > 0 && fnEnd > fnStart, 'pre: startGenerate / handleEvent 锚点存在');
const fn = src.slice(fnStart, fnEnd); // startGenerate 全函数窗（含其内 try，右界为下一函数）

test('v2.276 startGenerate 建卡前瞬时启动闸（堵弱网重复 POST projects，不破坏 v2.132 并行）', () => {
  // A1 模块级闸声明，且必须在 startGenerate 体外（跨重渲染/跨调用持久，不能每次进函数重置）
  const decl = src.match(/\n\s*let\s+_genStarting\s*=\s*false\s*;/);
  assert.ok(decl, 'A1: 需模块级 let _genStarting = false;');
  assert.ok(src.indexOf(decl[0]) < fnStart, 'A1: _genStarting 必须声明在 startGenerate 体外（跨调用持久）');

  // A2 入口重入拦截：在首个 await / capturePrivateSession 之前的头部窗口内，闸为真即 return 且给用户反馈
  const headWin = fn.slice(0, fn.indexOf('for (const loadAssets of'));
  const guardIdx = headWin.indexOf('if (_genStarting)');
  assert.ok(guardIdx >= 0, 'A2a: 函数头部需 if (_genStarting) 重入拦截');
  const guardWin = headWin.slice(guardIdx, guardIdx + 220);
  assert.ok(/return\s*;/.test(guardWin), 'A2b: 重入拦截分支须直接 return（不继续建单）');
  assert.ok(/xnSay|toast/.test(guardWin), 'A2c: 重入拦截须有 xnSay/toast 反馈（消除弱网「没点上」误判）');

  // A3 置位必须先于任何 await（保证后一个 startGenerate 在资产等待期进入时已能见到闸为真）
  const setIdx = headWin.indexOf('_genStarting = true');
  assert.ok(setIdx >= 0, 'A3a: 头部需 _genStarting = true 置位');
  const firstAwaitInFn = fn.search(/await\s+loadAssets/);
  assert.ok(firstAwaitInFn >= 0, 'A3b-pre: 资产 await 锚存在');
  assert.ok(fn.indexOf('_genStarting = true') < firstAwaitInFn, 'A3c: 置位必须在首个 await 资产之前（同步置位，并发可见）');

  // A4 置位后、首个 await 之前进入 try：使准备期所有提前 return / 抛错都被 finally 兜住
  const betweenSetAndAwait = fn.slice(setIdx, firstAwaitInFn);
  assert.ok(/\btry\s*\{/.test(betweenSetAndAwait), 'A4: 置位后、首个 await 前需开启 try（让各提前 return 也走 finally）');

  // A5 finally 复位（异常路径/准备期任一提前 return 都必须释放，否则一次失败后永久不能生成）
  const finallyIdx = fn.lastIndexOf('finally {');
  assert.ok(finallyIdx >= 0, 'A5a: startGenerate 需 finally 块');
  assert.ok(fn.slice(finallyIdx).includes('_genStarting = false'), 'A5b: finally 须复位 _genStarting = false');

  // A6 核心：必须在「建会话卡 genSessions.unshift」之前释放闸（与 unshift 同一同步段），
  //    且早于 POST /projects —— 证明锁只覆盖准备窗口，不覆盖建卡后的扣费生成运行期。
  const unshiftIdx = fn.indexOf('genSessions.unshift(session)');
  assert.ok(unshiftIdx >= 0, 'A6-pre: 建卡 marker 存在');
  const projectsIdx = fn.indexOf("'/api/generate/projects'");
  assert.ok(projectsIdx >= 0, 'A6-pre2: POST projects marker 存在');
  const preRelease = fn.lastIndexOf('_genStarting = false', unshiftIdx);
  assert.ok(preRelease >= 0 && preRelease < unshiftIdx, 'A6a: 建卡 genSessions.unshift 之前必须有 _genStarting = false 释放');
  assert.ok(preRelease < projectsIdx, 'A6b: 释放必须早于 POST /projects（锁不覆盖扣费运行期）');

  // A7 释放与建卡原子：二者之间不得有 await（同一同步执行段，用户二次点击事件无法插入造成空窗）
  const releaseToUnshift = fn.slice(preRelease, unshiftIdx);
  assert.ok(!/await\b/.test(releaseToUnshift), 'A7: 释放→unshift 之间须为纯同步（无 await），杜绝点击事件插入空窗');

  // A8 不破坏 v2.132 多任务并行：全函数仅入口一处置位，episodes SSE 运行期不再持锁
  const setCount = (fn.match(/_genStarting\s*=\s*true/g) || []).length;
  assert.equal(setCount, 1, 'A8a: 全函数仅入口一处 _genStarting = true（运行期不得重新加锁）');
  const episodesIdx = fn.indexOf("'/api/generate/episodes'");
  assert.ok(episodesIdx >= 0 && episodesIdx > preRelease, 'A8b: POST /episodes（扣费 SSE）发生在释放之后，卡后并行不受闸限制');
});
