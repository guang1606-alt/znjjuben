const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.277 dogfood 第十二轮 · 弱网写失败可恢复面（重试重复 POST /projects 孤儿项目 + 失败面板裸码）
// Playwright 零后端副作用实证（projects route fulfill 假项目、episodes 500）：
//   S3 episodes 阶段 500 失败后点 #failRetry → 整链路重跑 → 再发 1 个 POST /projects
//      （projects 计数 1→2、两张同标题失败卡）。真实环境每点一次重试就多一个空壳项目，
//      直接占用 FREE 2 / BASIC 10 / ADVANCED 30 / PRO 100 的项目额度，REACH_PROJECT_LIMIT 后锁死。
//   S1 projects 阶段 500：即时撤卡、0 episodes（此阶段项目未建成，重跑是对的）。
//   S2 projects 阶段断网：v2.276 启动闸正常释放可重入，但失败面板大字直出裸码 NETWORK_ERR（v2.239 脱敏漏网点）。
// 修复：
//   A) 失败会话在「已持有服务端项目」后留存 brief；#failRetry 仅对 episodes 阶段失败携带
//      {project, brief} 复用句柄；startGenerate 入口同步消费（防交错），跳过重建项目直接重发 episodes。
//      projects 阶段失败不带句柄（结果未知，宁可重建），歧义面记 PENDING 不擅自幂等。
//   B) catch 内 NETWORK_ERR/TIMEOUT 与 5xx 同口径回落本地友好文案，失败面板不再显示内部错误码。
const srcRaw = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const src = srcRaw.replace(/\/\/.*$/gm, ''); // 剥行注释，防注释文本救场
const FN_MARK = 'async function startGenerate() {';
const fnStart = src.indexOf(FN_MARK);
const fnEnd = src.indexOf('function handleEvent(data, session)', fnStart);
assert.ok(fnStart > 0 && fnEnd > fnStart, 'pre: startGenerate / handleEvent 锚点存在');
const fn = src.slice(fnStart, fnEnd);
const headWin = fn.slice(0, fn.indexOf('for (const loadAssets of'));
const projectsIdx = fn.indexOf("'/api/generate/projects'");
const episodesIdx = fn.indexOf("'/api/generate/episodes'");

test('v2.277 A1 模块级重试复用句柄声明在 startGenerate 体外，初值为 null', () => {
  const m1 = src.match(/\n\s*let\s+_retryProject\s*=\s*null\s*;/);
  const m2 = src.match(/\n\s*let\s+_retryBrief\s*=\s*null\s*;/);
  assert.ok(m1, 'A1a: 需模块级 let _retryProject = null;');
  assert.ok(m2, 'A1b: 需模块级 let _retryBrief = null;');
  assert.ok(src.indexOf(m1[0]) < fnStart, 'A1c: _retryProject 须声明在 startGenerate 体外（跨重渲染持久）');
  assert.ok(src.indexOf(m2[0]) < fnStart, 'A1d: _retryBrief 须声明在 startGenerate 体外');
});

test('v2.277 A2 入口在首个 await 之前同步消费并清空句柄（点击→进函数同同步段，杜绝交错污染）', () => {
  const takeProject = headWin.indexOf('const reuseProject = _retryProject;');
  const takeBrief = headWin.indexOf('const reuseBrief = _retryBrief;');
  assert.ok(takeProject >= 0, 'A2a: 头部需 const reuseProject = _retryProject;');
  assert.ok(takeBrief >= 0, 'A2b: 头部需 const reuseBrief = _retryBrief;');
  // 消费后必须立即置空：下一次正常 startGenerate（非重试）绝不能意外复用
  const winAfterTake = headWin.slice(Math.min(takeProject, takeBrief));
  assert.ok(/_retryProject\s*=\s*null\s*;/.test(winAfterTake), 'A2c: 取走后须 _retryProject = null;');
  assert.ok(/_retryBrief\s*=\s*null\s*;/.test(winAfterTake), 'A2d: 取走后须 _retryBrief = null;');
  const firstAwait = headWin.search(/await\s+/);
  assert.ok(firstAwait < 0 || takeProject < firstAwait && takeBrief < firstAwait, 'A2e: 消费必须先于首个 await（同步可见）');
});

test('v2.277 A3 brief 构建存在复用分支，且先于 tags/内联校验（重试不再被空输入框/隐藏 tagBench 挡回）', () => {
  const reuseIdx = fn.indexOf('if (reuseBrief != null)');
  const tagIdx = fn.indexOf('buildTagBrief()');
  assert.ok(reuseIdx >= 0, 'A3a: 需 if (reuseBrief != null) 复用分支');
  assert.ok(tagIdx >= 0 && reuseIdx < tagIdx, 'A3b: 复用分支必须排在 tags 简报构建之前');
  const branchWin = fn.slice(reuseIdx, reuseIdx + 260);
  assert.ok(/brief\s*=\s*reuseBrief\s*;/.test(branchWin), 'A3c: 复用分支须 brief = reuseBrief;');
  assert.ok(/projTitle/.test(branchWin), 'A3d: 复用分支须给定 projTitle（卡片标题不退化）');
});

test('v2.277 A4 建项目行纳入复用：有句柄时跳过 POST /projects（与 adapt 草稿同一行合并）', () => {
  const line = fn.match(/let\s+project\s*=\s*generationDraft\s*\|\|\s*reuseProject\s*;/);
  assert.ok(line, 'A4a: 需 let project = generationDraft || reuseProject;');
  // POST 必须在 if (!project) 守卫内，证明 reuseProject 命中时不会发出建单请求
  const guardIdx = fn.indexOf('if (!project) {', fn.indexOf(line[0]));
  assert.ok(guardIdx >= 0 && guardIdx < projectsIdx, 'A4b: POST /projects 必须位于 if (!project) 守卫内');
});

test('v2.277 A5 会话仅在 episodes 阶段留存 briefText：位置严格在 projects 之后、episodes 之前且唯一', () => {
  assert.ok(projectsIdx >= 0 && episodesIdx > projectsIdx, 'pre: projects/episodes URL 锚存在且有序');
  const setIdx = fn.indexOf('session.briefText = brief.trim();');
  assert.ok(setIdx >= 0, 'A5a: 需 session.briefText = brief.trim();（失败重试恢复原简报）');
  assert.ok(setIdx > projectsIdx, 'A5b: briefText 留存必须在建项目请求之后（projects 阶段失败不得带句柄）');
  assert.ok(setIdx < episodesIdx, 'A5c: briefText 留存必须在 POST episodes 之前（episodes 任一失败分支都可恢复）');
  assert.strictEqual(fn.indexOf('session.briefText'), fn.lastIndexOf('session.briefText'), 'A5d: session.briefText 仅单点赋值');
});

test('v2.277 A6 #failRetry 仅为「已持项目的失败会话」安装复用句柄，再启动', () => {
  const tail = src.slice(fnEnd);
  const bindIdx = tail.indexOf("$('failRetry').onclick = genClickGuard");
  assert.ok(bindIdx >= 0, 'A6a: #failRetry 经 genClickGuard 绑定锚存在');
  const win = tail.slice(bindIdx, bindIdx + 520);
  assert.ok(/genSessions\.find\(/.test(win), 'A6b: 需 genSessions.find 定位 activeSessionId 对应失败会话');
  assert.ok(/activeSessionId/.test(win), 'A6c: find 条件须含 activeSessionId');
  assert.ok(/\.status\s*===\s*'failed'/.test(win), 'A6d: 须校验 status === failed');
  assert.ok(/s\.project\b/.test(win), 'A6e: 须确认会话已持有服务端项目（区分 projects 阶段失败）');
  assert.ok(/s\.briefText\s*!=\s*null/.test(win), 'A6f: 须确认 briefText 已留存（episodes 阶段才存在）');
  assert.ok(/_retryProject\s*=\s*s\.project\s*;/.test(win), 'A6g: 安装 _retryProject = s.project');
  assert.ok(/_retryBrief\s*=\s*s\.briefText\s*;/.test(win), 'A6h: 安装 _retryBrief = s.briefText');
  assert.ok(/startGenerate\(\)/.test(win), 'A6i: 随后调用 startGenerate()');
});

test('v2.277 B1 catch 内网络裸码 NETWORK_ERR/TIMEOUT 回落本地友好文案，失败面板不再直出错误码', () => {
  const catchIdx = fn.lastIndexOf('} catch (e) {');
  const catchWin = fn.slice(catchIdx);
  assert.ok(catchIdx >= 0, 'B1-pre: catch 窗存在');
  assert.ok(/e\.code\s*===\s*'NETWORK_ERR'/.test(catchWin), 'B1a: catch 须识别 NETWORK_ERR');
  assert.ok(/e\.code\s*===\s*'TIMEOUT'/.test(catchWin), 'B1b: catch 须识别 TIMEOUT');
  assert.ok(/网络异常/.test(catchWin) && /超时/.test(catchWin), 'B1c: 需中文本地文案（网络异常/超时）');
  // failGenerationSession 与 showFail 都必须收到友好文案变量，而不是 String(e.message)/e.message 裸值
  assert.ok(/failGenerationSession\(session,\s*\w+\)/.test(catchWin), 'B1d: failGenerationSession 收友好文案变量');
  const showFailIdx = catchWin.indexOf('showFail(');
  assert.ok(showFailIdx >= 0, 'B1e-pre: showFail 调用存在');
  assert.ok(!/showFail\(e\.message\)/.test(catchWin), 'B1e: showFail 不得再直出 e.message 裸码');
});
