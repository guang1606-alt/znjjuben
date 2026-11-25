'use strict';
// v2.686 编剧室首屏排布与空态：
// 1) 标签行的「我的编剧室」不再和「收起」平分 auto 外边距（桌面被挤到行中央、窄屏把收起挤到第二行）；
// 2) 窄屏隐藏面板内「收起」——工作台头部已有「← 返回」，重复按钮只会多占一行；
// 3) 会议纪要区在没有任何发言时不再显示空边框盒子，改用一条批注式提示说明「发起后会看到什么」，
//    有第一条发言后自动让位。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('web/index.html');
const css = read('web/styles.css');
const i18n = read('web/i18n.js');
const roomSource = read('web/room-view.js');
const roomAst = ts.createSourceFile('room-view.js', roomSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let resumeRoomSource = '';
(function findResumeRoom(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'resumeRoom') resumeRoomSource = node.getText(roomAst);
  ts.forEachChild(node, findResumeRoom);
})(roomAst);

test('静态契约：历史入口独占 auto 外边距，收起不再参与空白分配', () => {
  assert.match(html, /<button class="chip room-history-chip" id="roomHistoryBtn"[^>]*>/, '历史入口应带 room-history-chip 类');
  const tag = html.match(/<button[^>]*id="roomHistoryBtn"[^>]*>/)[0];
  assert.ok(!/margin-left\s*:\s*auto/.test(tag), '不应再用内联 margin-left:auto（会与 .room-close 平分空白）');
  assert.match(css, /\.room-history-chip\s*\{\s*margin-left:\s*auto;?\s*\}/);
  assert.match(css, /#roomClose\s*\{\s*margin-left:\s*0;?\s*\}/);
  // 其他面板仍靠 .room-close 的 auto 外边距把收起推到行尾，这条默认规则不能被改掉
  assert.match(css, /\.room-close\s*\{\s*margin-left:\s*auto;/);
});

test('静态契约：窄屏在 768px 断点内隐藏工作台面板内的重复收起', () => {
  const rule = '.workbench-body .room-close { display: none; }';
  const at = css.indexOf(rule);
  assert.ok(at > 0, `styles.css 缺少窄屏去重规则：${rule}`);
  const mediaAt = css.lastIndexOf('@media (max-width: 768px)', at);
  assert.ok(mediaAt > 0 && mediaAt < at, '该规则必须落在 768px 媒体查询内，避免影响桌面');
  // 返回按钮仍在头部（窄屏唯一出口）
  assert.match(html, /id="workbenchBack"/);
});

test('静态契约：空纪要区隐藏，批注提示紧随其后并成对出现', () => {
  assert.match(css, /\.room-stream:empty\s*\{\s*display:\s*none;?\s*\}/);
  assert.match(css, /\.room-stream:not\(:empty\)\s*\+\s*\.room-idle-hint\s*\{\s*display:\s*none;?\s*\}/);
  // DOM 顺序：提示必须紧跟在 #pitchStream 之后，兄弟选择器才成立
  const streamAt = html.indexOf('id="pitchStream"');
  const hintAt = html.indexOf('id="pitchIdleHint"');
  assert.ok(streamAt > 0 && hintAt > streamAt, 'pitchIdleHint 必须位于 pitchStream 之后');
  const hintTag = html.match(/<p[^>]*id="pitchIdleHint"[^>]*>/)[0];
  assert.match(hintTag, /data-i="roomIdleHint"/, '提示文案要走 i18n');
});

test('静态契约：中英双语文案键齐备', () => {
  const hits = i18n.match(/roomIdleHint\s*:/g) || [];
  assert.equal(hits.length, 2, 'roomIdleHint 必须在中英两份 DICT 中各出现一次');
});

// v2.687 工作台头部窄屏防拆行：390px 下长标题「小南递招 · 方法卡与钩子」换成两行，
// 连带把「← 返回」和「生成剧本」压成多行，头部高度从约 34px 涨到 68px，第一屏可见创作区被吃掉。
// 修法：标题单行省略吃剩余宽度，返回键与动作区各自不换行；窄屏隐藏纯占位 spacer，
// 由标题 flex 增长把动作推到行尾。
function ruleBody(selector, fromIndex = 0) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.slice(fromIndex).match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : null;
}

test('静态契约：工作台标题单行省略，不再撑高头部', () => {
  const body = ruleBody('.workbench-head h2');
  assert.ok(body, '缺少 .workbench-head h2 规则');
  assert.match(body, /white-space:\s*nowrap/, '标题必须单行');
  assert.match(body, /overflow:\s*hidden/, '标题溢出须裁剪');
  assert.match(body, /text-overflow:\s*ellipsis/, '标题溢出须省略号');
  assert.match(body, /min-width:\s*0/, '标题须可收缩（flex 子项默认 min-width:auto 撑破容器）');
});

test('静态契约：返回键与动作区不被挤压换行', () => {
  const back = ruleBody('.workbench-back');
  assert.ok(back, '缺少 .workbench-back 规则');
  assert.match(back, /flex-shrink:\s*0/, '返回键不得被压缩');
  assert.match(back, /white-space:\s*nowrap/, '返回键文字不得换行');
  const actions = ruleBody('.workbench-head #workbenchActions');
  assert.ok(actions, '缺少 #workbenchActions 规则');
  assert.match(actions, /flex-shrink:\s*0/, '动作区不得被压缩');
});

test('静态契约：窄屏隐藏占位 spacer，标题吃剩余宽度、主按钮紧凑', () => {
  const at = css.indexOf('.workbench-head .spacer');
  assert.ok(at > 0, '缺少窄屏 .workbench-head .spacer 规则');
  const mediaAt = css.lastIndexOf('@media (max-width: 768px)', at);
  assert.ok(mediaAt > 0 && mediaAt < at, '该规则必须落在 768px 媒体查询内');
  assert.match(css.slice(at, at + 80), /display:\s*none/, '窄屏应隐藏 spacer');
  const h2 = ruleBody('.workbench-head h2', mediaAt);
  assert.ok(h2 && /flex:\s*1 1 auto/.test(h2), '窄屏标题应 flex:1 1 auto 吃剩余宽度');
  const btn = ruleBody('.workbench-head #workbenchActions .btn-primary', mediaAt);
  assert.ok(btn && /white-space:\s*nowrap/.test(btn), '窄屏主按钮文字不得换行');
});

// v2.691 消息内容防御：历史/迁移数据可能把 content 存成对象（旧 schema 或序列化残留），
// msgHtml 不能直接 String(obj) → "[object Object]"。抽 msgHtml 出来单测。
let msgHtmlSource = '';
let msgContentAsTextSource = '';
(function findMsgFns(node) {
  if (ts.isFunctionDeclaration(node)) {
    if (node.name?.text === 'msgHtml') msgHtmlSource = node.getText(roomAst);
    if (node.name?.text === '_msgContentAsText') msgContentAsTextSource = node.getText(roomAst);
  }
  ts.forEachChild(node, findMsgFns);
})(roomAst);

function msgHarness() {
  const context = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  };
  context.T = () => ({ me: '我', xn: '小南' });
  vm.createContext(context);
  if (msgContentAsTextSource) vm.runInContext(msgContentAsTextSource, context);
  vm.runInContext(msgHtmlSource, context);
  return context;
}

test('msgHtml：content 为对象时不渲染 [object Object]，降级为可读 JSON', () => {
  assert.ok(msgHtmlSource, '必须能加载真实 msgHtml 实现');
  const ctx = msgHarness();
  const html = ctx.msgHtml({ speakerType: 'USER', content: { message: '你好', role: 'USER' } }, { me: '我', xn: '小南' });
  assert.ok(!html.includes('[object Object]'), `不得出现 [object Object]，实际：${html}`);
  assert.ok(html.includes('你好') || html.includes('USER'), `对象内容应被降级为可读字符串，实际：${html}`);
});

test('msgHtml：content 为数组时降级为 JSON 数组，不炸 UI', () => {
  const ctx = msgHarness();
  const html = ctx.msgHtml({ speakerType: 'AI', content: ['要点一', '要点二'] }, { me: '我', xn: '小南' });
  assert.ok(!html.includes('[object Object]'), '数组 content 不得渲染 [object Object]');
});

test('msgHtml：content 为 null/undefined 时渲染空串，不炸 UI', () => {
  const ctx = msgHarness();
  assert.doesNotThrow(() => ctx.msgHtml({ speakerType: 'AI', content: null }, { me: '我', xn: '小南' }));
  assert.doesNotThrow(() => ctx.msgHtml({ speakerType: 'AI', content: undefined }, { me: '我', xn: '小南' }));
  const h1 = ctx.msgHtml({ speakerType: 'AI', content: null }, { me: '我', xn: '小南' });
  const h2 = ctx.msgHtml({ speakerType: 'AI', content: undefined }, { me: '我', xn: '小南' });
  assert.ok(!h1.includes('[object Object]'));
  assert.ok(!h2.includes('[object Object]'));
});

// v2.691 工作台关闭过渡态禁用 pointer-events：_hideWorkbenchLayer 先加 .view-out（220ms 动画）
// 再加 .hidden。动画期间 layer 仍在 DOM 上有 position:fixed + inset:0 + z-index:60，
// pointer-events 默认为 auto → 这 220ms 内所有点击都被它吃掉（实测退出登录按钮被拦）。
test('CSS：工作台 view-out 过渡态禁用 pointer-events，避免拦截顶栏点击', () => {
  const at = css.indexOf('.workbench-layer.view-out');
  assert.ok(at > 0, '缺少 .workbench-layer.view-out 规则');
  // 允许两种等价写法：view-out 本身写 pointer-events:none，或在同一 rule 里声明
  const windowLen = '.workbench-layer.view-out'.length;
  const window = css.slice(at, at + 200);
  assert.match(window, /pointer-events\s*:\s*none/, 'view-out 期间必须禁用 pointer-events');
});

test('msgHtml：content 为正常字符串时换行仍正确转 <br>', () => {
  const ctx = msgHarness();
  const html = ctx.msgHtml({ speakerType: 'USER', content: '第一行\n第二行' }, { me: '我', xn: '小南' });
  assert.ok(html.includes('<br>'), '字符串换行应正确转为 <br>');
});

function resumeHarness(kind) {
  const nodes = new Map();
  const calls = { get: [], stream: [], verdict: [], readActions: [] };
  const errors = [];
  const $ = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, {
        value: '', innerHTML: '', textContent: '',
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
      });
    }
    return nodes.get(id);
  };
  const pitch = kind === 'PITCH';
  const verdict = { decision: 'GO' };
  const lastRead = { overall: 8 };
  const room = {
    id: 'room-1', kind, readMode: 'me_xn', inviteCode: 'ABC123',
    scriptText: pitch ? '被平台辞退的女骑手重建站点' : '第一场：女骑手雨夜回到旧站点',
    payload: pitch
      ? { audience: '25-40岁城市女性', medium: '真人', verdict }
      : { scriptMode: 'AIGC', lastRead },
  };
  const state = { pitchRoom: null, readRoom: null, readMode: 'me_xn', lastVerdict: null, lastRead: null, lastRoomMeta: null };
  const context = {
    $, state, console, needAuth: () => true,
    get: async (url) => { calls.get.push(url); return { room, messages: [{ id: 'm1' }], hasMore: false }; },
    switchTab: () => {}, stream: (...args) => calls.stream.push(args),
    renderVerdict: (value) => calls.verdict.push(value), renderReadModes: () => {}, renderReadInfo: () => {},
    renderReadActions: (value) => calls.readActions.push(value),
    xnErr: (error) => errors.push(error), errMsg: (error) => error?.message || 'error',
  };
  vm.createContext(context);
  vm.runInContext(resumeRoomSource, context);
  return { context, $, state, calls, errors };
}

test('恢复选题会历史时，原始创意、受众与载体随消息和决议一起回填', async () => {
  assert.ok(resumeRoomSource, '必须能加载真实 resumeRoom 实现');
  const h = resumeHarness('PITCH');
  await h.context.resumeRoom({ id: 'room-1', kind: 'PITCH' });
  assert.deepEqual(h.errors, []);
  assert.equal(h.$('pitchIdea').value, '被平台辞退的女骑手重建站点');
  assert.equal(h.$('pitchAud').value, '25-40岁城市女性');
  assert.equal(h.$('pitchMed').value, '真人');
  assert.equal(h.state.pitchRoom, 'room-1');
  assert.equal(h.calls.verdict.length, 1, '既有决议恢复不得回归');
});

test('恢复围读历史时，原剧本与制式随消息和围读结论一起回填', async () => {
  const h = resumeHarness('READ');
  await h.context.resumeRoom({ id: 'room-1', kind: 'READ', readMode: 'me_xn' });
  assert.deepEqual(h.errors, []);
  assert.equal(h.$('readScript').value, '第一场：女骑手雨夜回到旧站点');
  assert.equal(h.$('readFormat').value, 'AIGC');
  assert.equal(h.state.readRoom, 'room-1');
  assert.equal(h.calls.readActions.length, 1, '既有围读结论恢复不得回归');
});
