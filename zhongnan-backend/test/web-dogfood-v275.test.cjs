const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.275 dogfood 第十轮 · 弱网写路径（移动端 lens）
// 作品卡片「重命名/克隆/归档/删除」此前在 async 请求在途期间既无在途锁也无按钮禁用/反馈。
// Playwright 弱网实证：克隆请求挂起 2s 时再次点「克隆」可再弹窗二次提交，POST /clone 被调 2 次、
// 项目 1 → 3（产生重复副本）。修复：模块级 _workActionBusy 函数级在途锁（跨卡片/跨 loadWorks
// 重渲染持久）+ runWorkAction 统一包裹，被点按钮即时 disabled 并显示「…中」loading 文案。
const srcRaw = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const src = srcRaw.replace(/\/\/.*$/gm, ''); // 剥行注释，防注释文本救场
const LOAD_MARK = 'async function loadWorks() {';
const HELPER_MARK = 'async function runWorkAction(btn';

test('v2.275 作品卡片写操作在途锁 + 提交中反馈（防弱网重复克隆）', () => {
  // A1 helper 声明（带形参 marker，防子串救场）
  assert.ok(src.includes(HELPER_MARK), 'A1: 需声明 async function runWorkAction(btn, busyText, task) helper');
  const helperIdx = src.indexOf(HELPER_MARK);
  const helperWin = src.slice(helperIdx, helperIdx + 900);

  // A2 模块级锁声明，且必须在 loadWorks 之外（跨重渲染持久，不能每次渲染重置）
  const loadIdx = src.indexOf(LOAD_MARK);
  assert.ok(loadIdx > 0, 'A2-pre: loadWorks marker 存在');
  const m = src.match(/\n\s*let\s+_workActionBusy\s*=\s*false\s*;/);
  assert.ok(m, 'A2: 需模块级 let _workActionBusy = false;');
  assert.ok(src.indexOf(m[0]) < loadIdx, 'A2: _workActionBusy 必须声明在 loadWorks 体外（跨重渲染持久）');

  // A3 在途拦截：helper 首行 busy 即 return
  assert.ok(helperWin.includes('if (_workActionBusy) return;'), 'A3: helper 需在入口以 if (_workActionBusy) return 拦截重入');

  // A4 进入即置位
  assert.ok(helperWin.includes('_workActionBusy = true'), 'A4: helper 需置 _workActionBusy = true');

  // A5 被点按钮即时禁用 + loading 文案反馈（消除弱网「没点上」误判）
  assert.ok(helperWin.includes('btn.disabled = true'), 'A5a: helper 需 btn.disabled = true');
  assert.ok(helperWin.includes('btn.textContent = busyText'), 'A5b: helper 需把 busyText 写入 btn.textContent 反馈提交中状态');

  // A6 finally 复位锁与按钮态（异常路径也必须释放，否则永久锁死）
  const finallyIdx = helperWin.indexOf('finally {');
  assert.ok(finallyIdx >= 0, 'A6a: helper 需 finally 块');
  const finallyWin = helperWin.slice(finallyIdx);
  assert.ok(finallyWin.includes('_workActionBusy = false'), 'A6b: finally 需复位 _workActionBusy = false');
  assert.ok(/btn\.disabled\s*=\s*oldDisabled/.test(finallyWin), 'A6c: finally 需恢复 btn.disabled');

  // A7 loadWorks 内四个动作（rename/clone/archive/delete）都经 helper 包裹
  const lwEnd = src.indexOf('}', src.indexOf('znErrorHtml(t(\'loadFail\'))', loadIdx)) + 1;
  const lw = src.slice(loadIdx, lwEnd + 40);
  const calls = lw.match(/runWorkAction\s*\(\s*btn/g) || [];
  assert.ok(calls.length >= 4, `A7: 四个卡片动作都须 runWorkAction 包裹，实际 ${calls.length} 处`);

  // A8 clone 非幂等重点：锁包裹必须在 POST /clone 请求之前（防「先请求后加锁」假防护）
  const cloneStart = lw.indexOf("act === 'clone'");
  const cloneEnd = lw.indexOf("act === 'archive'", cloneStart);
  const cloneWin = lw.slice(cloneStart, cloneEnd);
  const lockIdx = cloneWin.indexOf('runWorkAction');
  const reqIdx = cloneWin.indexOf('`/api/generate/projects/${p.id}/clone`');
  assert.ok(lockIdx >= 0, 'A8a: clone 分支须经 runWorkAction');
  assert.ok(reqIdx >= 0, 'A8b-pre: clone 请求锚存在');
  assert.ok(lockIdx < reqIdx, 'A8c: 在途锁必须在 POST /clone 发出前置位');
  assert.ok(/Cloning…|克隆中…/.test(cloneWin), 'A8d: clone 须提供「克隆中…」loading 文案');

  // A9 delete 分支同样在途包裹（软删请求在途期间禁用按钮）
  const delStart = lw.indexOf("act === 'delete'");
  const delWin = lw.slice(delStart);
  assert.ok(delWin.indexOf('runWorkAction') >= 0, 'A9: delete 分支须经 runWorkAction');
  assert.ok(/Deleting…|删除中…/.test(delWin), 'A9b: delete 须提供「删除中…」loading 文案');

  // A10 archive 分支在途包裹（含恢复动作）
  const arcStart = lw.indexOf("act === 'archive'");
  const arcEnd = lw.indexOf("act === 'delete'", arcStart);
  const arcWin = lw.slice(arcStart, arcEnd);
  assert.ok(arcWin.indexOf('runWorkAction') >= 0, 'A10: archive 分支须经 runWorkAction');
});
