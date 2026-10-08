const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const interview = source.slice(source.indexOf('  let ivInited ='), source.indexOf('  function initBriefUpload()'));
const saved = (overrides = {}) => ({
  id: 'saved-session', status: 'ACTIVE', turnCount: 2, ready: true,
  transcript: [{ q: '', a: '女记者寻找失踪姐姐' }, { q: '她会失去什么？', a: '她会失去唯一的线索' }],
  question: '她决定如何反击？', materials: { rawNotes: ['已保存素材'] },
  gaps: { desire: true, conflict: true, stakes: true, turn: false },
  ...overrides,
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup(handler = async () => ({ sessions: [saved()] })) {
  const nodes = new Map(), events = new Map(), requests = [], messages = [];
  let user = { id: 'alice' }, authenticated = true;
  function node() {
    const classes = new Set();
    return { value: '', textContent: '', style: {}, children: [], disabled: false, scrollHeight: 0,
      set innerHTML(value) { this.html = value; this.children = []; }, get innerHTML() { return this.html || ''; },
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x),
        toggle(x, on) { if (on ?? !classes.has(x)) classes.add(x); else classes.delete(x); } },
      appendChild(child) { this.children.push(child); }, addEventListener() {}, focus() {},
    };
  }
  const $ = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const c = { $, lang: 'zh', selectedMode: 'interview', t: x => x, xnSay: text => messages.push(text), openAuth() {}, syncPrivateAccount() {}, refreshAdminNav() {}, renderModes() {},
    // 合并（剧本1）后 interview 段的 ivStartBtn 文案分支与 renderAuthButton 片段引用身份函数，按本文件风格以最小 stub 替代
    isStaffAcct: () => false, userRoleLabel: () => '',
    document: { createElement: node }, window: { addEventListener: (key, fn) => events.set(key, fn) },
    Api: { getUser: () => user, isAuthed: () => authenticated,
      request: async (url, opts = {}) => { requests.push({ url, opts }); return handler(url, opts); },
      jsonOrThrow: async result => { if (result instanceof Error) throw result; return result; },
    },
  };
  vm.createContext(c);
  vm.runInContext(interview, c);
  return { c, $, requests, messages, events, setUser(value) { user = value; authenticated = !!value; },
    bubbles: () => $('ivTranscript').children.map(child => child.children[1].textContent) };
}

test('opening interview restores saved questions, answers, readiness and the original idea for free', async () => {
  const h = setup();
  await h.c.initInterviewPanel();
  assert.deepEqual(h.bubbles(), ['女记者寻找失踪姐姐', '她会失去什么？', '她会失去唯一的线索', '她决定如何反击？']);
  assert.equal(h.$('modeBrief').value, '女记者寻找失踪姐姐');
  assert.match(h.$('ivStatus').textContent, /就绪/);
  assert.match(h.$('ivGaps').innerHTML, /✓.*欲望/);
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), false);
  assert.deepEqual(Array.from(vm.runInContext('ivMaterials.rawNotes', h.c)), ['已保存素材']);
  await h.c.initInterviewPanel();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/interview/sessions');
  assert.equal(h.requests[0].opts.method || 'GET', 'GET');
  assert.equal(h.bubbles().length, 4);
});

test('restoration prefers an ACTIVE session over a converted one and preserves a newly typed idea', async () => {
  const h = setup(async () => ({ sessions: [saved({ id: 'finished', status: 'CONVERTED', brief: '已完成的简报' }), saved({ ready: false, turnCount: 3 })] }));
  h.$('modeBrief').value = '刚写下的新故事';
  await h.c.initInterviewPanel();
  assert.equal(h.$('modeBrief').value, '刚写下的新故事');
  assert.match(h.$('ivStatus').textContent, /第 3 轮/);
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), true);
});

test('v2.319 a converted session is restorable after refresh: transcript + closed UI + deterministic brief', async () => {
  const h = setup(async (_url, opts) => opts.method === 'POST'
    ? { ...saved({ status: 'ACTIVE', ready: false }), sessionId: 'new-session', question: '新的追问' }
    : { sessions: [saved({ id: 'converted-one', status: 'CONVERTED', brief: '【采访式创作 · 创意简报】\n确定性简报正文' })] });
  await h.c.initInterviewPanel();
  assert.deepEqual(h.bubbles(), ['女记者寻找失踪姐姐', '她会失去什么？', '她会失去唯一的线索', '她决定如何反击？']);
  assert.equal(h.$('modeBrief').value, '【采访式创作 · 创意简报】\n确定性简报正文', 'CONVERTED 简报必须随列表回填');
  assert.match(h.$('ivStatus').textContent, /采访已完成/);
  assert.equal(h.$('ivAnswer').disabled, true, '终态会话禁止继续回答');
  assert.equal(h.$('ivSendBtn').disabled, true);
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), true, '终态不再显示生成简报按钮');
  assert.equal(h.$('ivStopBtn').classList.contains('hidden'), true);
  const requestsBefore = h.requests.length;
  await h.c.ivReply();
  assert.equal(h.requests.length, requestsBefore, 'closed 态追问必须被前端拦截，不打付费 turn 请求');
  // 「新建采访」仍可开新会话，不被终态锁死
  h.$('modeBrief').value = '一个全新的反击故事';
  h.$('ivAnswer').value = '她换了身份重新开始';
  await h.c.ivStart();
  const post = h.requests.find(r => r.opts.method === 'POST' && r.url === '/api/interview/sessions');
  assert.ok(post);
});

test('v2.319 restoring a converted session never overwrites a brief the user already edited', async () => {
  const h = setup(async () => ({ sessions: [saved({ status: 'CONVERTED', brief: '服务器上的确定性简报' })] }));
  h.$('modeBrief').value = '我自己手动改过的创意';
  await h.c.initInterviewPanel();
  assert.equal(h.$('modeBrief').value, '我自己手动改过的创意');
});

test('a restored interview continues against its saved ID and blocks duplicate paid replies', async () => {
  const pending = deferred();
  const h = setup(async (_url, opts) => opts.method === 'POST' ? pending.promise : { sessions: [saved({ ready: false })] });
  await h.c.initInterviewPanel();
  h.$('ivAnswer').value = '她向幕后人宣战';
  const first = h.c.ivReply();
  await h.c.ivReply();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].url, '/api/interview/sessions/saved-session/turn');
  assert.equal(h.$('ivStartBtn').disabled, true);
  pending.resolve({ ...saved(), question: '她的盟友是谁？', turnCount: 3 });
  await first;
  assert.deepEqual(h.bubbles().slice(-2), ['她向幕后人宣战', '她的盟友是谁？']);
  assert.equal(h.$('ivAnswer').value, '');
  assert.equal(h.$('ivStartBtn').disabled, false);
});

test('loading an existing interview never starts another paid session', async () => {
  const pending = deferred();
  const h = setup(async () => pending.promise);
  h.$('modeBrief').value = '足够长的新故事';
  const restoring = h.c.initInterviewPanel();
  await h.c.ivStart();
  await h.c.ivReply();
  assert.equal(h.requests.length, 1);
  assert.equal(h.$('ivStartBtn').disabled, true);
  pending.resolve({ sessions: [saved()] });
  await restoring;
  assert.equal(h.requests.length, 1);
  assert.equal(h.$('ivStartBtn').disabled, false);
});

test('changing accounts clears old content and rejects an old account response arriving late', async () => {
  const old = deferred(); let calls = 0;
  const h = setup(async () => ++calls === 1 ? old.promise : { sessions: [] });
  const restoring = h.c.initInterviewPanel();
  h.setUser({ id: 'bob' });
  await h.c.initInterviewPanel();
  old.resolve({ sessions: [saved()] });
  await restoring;
  assert.deepEqual(h.bubbles(), []);
  assert.equal(h.$('modeBrief').value, '');
  assert.equal(h.$('ivStartBtn').disabled, false);
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), true);
});

test('an idea entered while the restore request is pending is never overwritten', async () => {
  const pending = deferred();
  const h = setup(async () => pending.promise);
  const restoring = h.c.initInterviewPanel();
  h.$('modeBrief').value = '正在输入的不同故事';
  pending.resolve({ sessions: [saved()] });
  await restoring;
  assert.equal(h.$('modeBrief').value, '正在输入的不同故事');
});

test('the actual auth-render hook and cross-tab sign-out clear interview state immediately', async () => {
  const h = setup();
  await h.c.initInterviewPanel();
  const auth = source.slice(source.indexOf('  function renderAuthButton()'), source.indexOf('  function openAuth(mode)'));
  vm.runInContext(auth, h.c);
  h.setUser(null);
  h.c.renderAuthButton();
  assert.deepEqual(h.bubbles(), []);
  h.setUser({ id: 'alice' });
  await h.c.initInterviewPanel();
  assert.equal(h.bubbles().length, 4);
  h.setUser(null);
  h.events.get('storage')({ key: 'zn_user' });
  assert.deepEqual(h.bubbles(), []);
});

test('signing out clears the restored idea and an in-flight turn cannot repopulate it', async () => {
  const pending = deferred();
  const h = setup(async (_url, opts) => opts.method === 'POST' ? pending.promise : { sessions: [saved()] });
  await h.c.initInterviewPanel();
  h.$('ivAnswer').value = '账号甲的回答';
  const turn = h.c.ivReply();
  h.setUser(null);
  await h.c.initInterviewPanel();
  pending.resolve({ ...saved(), question: '账号甲的私密问题' });
  await turn;
  assert.deepEqual(h.bubbles(), []);
  assert.equal(h.$('ivAnswer').value, '');
  assert.equal(h.$('modeBrief').value, '');
});

for (const result of [{ sessions: [saved({ status: 'CLOSED' })] }, new Error('NETWORK_ERR')]) {
  test(`no active session or a failed restore permits an explicit new interview (${result instanceof Error ? 'network' : 'closed'})`, async () => {
    const h = setup(async (_url, opts) => opts.method === 'POST' ? { ...saved({ ready: false }), sessionId: 'new-session', question: '新问题' } : result);
    await h.c.initInterviewPanel();
    h.$('modeBrief').value = '一个全新的故事';
    assert.equal(h.$('ivStartBtn').disabled, false);
    await h.c.ivStart();
    assert.equal(h.requests.length, 2);
    assert.equal(h.requests[1].opts.method, 'POST');
    assert.deepEqual(h.bubbles(), ['一个全新的故事', '新问题']);
    assert.equal(h.$('ivAnswer').disabled, false);
  });
}

test('reopening after a failed restore retries for free, but not during an explicit new start', async () => {
  const pending = deferred(); let gets = 0;
  const h = setup(async (_url, opts) => opts.method === 'POST' ? pending.promise : ++gets === 1 ? new Error('NETWORK_ERR') : { sessions: [saved()] });
  await h.c.initInterviewPanel();
  h.$('modeBrief').value = '另一个新故事创意';
  const starting = h.c.ivStart();
  await h.c.initInterviewPanel();
  assert.equal(gets, 1);
  pending.resolve(new Error('NETWORK_ERR'));
  await starting;
  await h.c.initInterviewPanel();
  assert.equal(gets, 2);
  assert.equal(h.requests.filter(r => r.opts.method === 'POST').length, 1);
  assert.equal(h.bubbles().length, 4);
});

test('an idea typed in the interview box (main brief empty) starts the session and syncs back to the main brief', async () => {
  const h = setup(async (_url, opts) => opts.method === 'POST'
    ? { sessionId: 'new-session', question: '他最怕被谁发现？', turnCount: 1, ready: false, gaps: {} }
    : { sessions: [] });
  await h.c.initInterviewPanel();
  assert.match(h.$('ivSendBtn').textContent, /开始/); // 未开会话：内嵌框右侧按钮就是“用此创意开始”
  h.$('modeBrief').value = '';
  h.$('ivAnswer').value = '80后男生，中年危机';
  await h.c.ivStart();
  const post = h.requests.find(r => r.url === '/api/interview/sessions' && r.opts.method === 'POST');
  assert.ok(post, '应当真的发起开会话请求');
  assert.equal(JSON.parse(post.opts.body).idea, '80后男生，中年危机');
  assert.equal(h.$('modeBrief').value, '80后男生，中年危机'); // 同步回主创意框，后续“生成剧本”可读
  assert.equal(h.$('ivAnswer').value, ''); // 开会后输入框清空，转为逐轮回答用途
  assert.equal(h.$('ivSendBtn').textContent, '回答并继续');
});

test('with no idea in either box starting is blocked and points to the interview box', async () => {
  const h = setup(async () => ({ sessions: [] }));
  await h.c.initInterviewPanel();
  h.$('modeBrief').value = '';
  h.$('ivAnswer').value = '';
  await h.c.ivStart();
  assert.equal(h.requests.filter(r => r.opts.method === 'POST').length, 0);
  assert.match(h.messages.join('|'), /下面/);
});

test('finishing a brief allows another interview and resets closed controls', async () => {
  const h = setup(async (url, opts) => url.endsWith('/brief') ? { brief: '完成的结构化简报' }
    : opts.method === 'POST' ? { ...saved({ ready: false }), sessionId: 'new-session', question: '全新采访问题' } : { sessions: [saved()] });
  await h.c.initInterviewPanel();
  await h.c.ivBrief();
  assert.equal(h.$('modeBrief').value, '完成的结构化简报');
  assert.equal(h.$('ivAnswer').disabled, true);
  assert.equal(h.$('ivStartBtn').classList.contains('hidden'), false);
  h.$('modeBrief').value = '第二个全新故事';
  await h.c.ivStart();
  assert.equal(h.$('ivAnswer').disabled, false);
  assert.equal(h.$('ivSendBtn').disabled, false);
  assert.deepEqual(h.bubbles(), ['第二个全新故事', '全新采访问题']);
});

// v2.319 下游闭环：ivBrief 把简报回填进主创意框后，若用户不开新采访直接生成，主框就是简报（正常）；
// 但若用户在采访框写新创意并点「开始新采访」，主框必须被新创意覆盖——否则 ivCollectIdea 优先读主框，
// 新创意根本采集不到，生成剧本会沿用上一轮简报（张冠李戴）。
test('after a brief is filled, starting a new interview overwrites the main brief box with the new idea', async () => {
  const h = setup(async (url, opts) => url.endsWith('/brief') ? { brief: '上一轮采访的结构化简报' }
    : opts.method === 'POST' ? { ...saved({ ready: false }), sessionId: 'new-session', question: '新采访的问题' } : { sessions: [saved()] });
  await h.c.initInterviewPanel();
  await h.c.ivBrief();
  assert.equal(h.$('modeBrief').value, '上一轮采访的结构化简报', 'ivBrief 应回填简报到主框');
  // 用户不生成，改在采访框写新创意并开新采访
  h.$('ivAnswer').value = '这一次想写一个关于快递员的都市逆袭故事';
  await h.c.ivStart();
  assert.equal(h.$('modeBrief').value, '这一次想写一个关于快递员的都市逆袭故事',
    '开新采访时主框必须被新创意覆盖，不能残留上一轮简报');
  assert.deepEqual(h.bubbles(), ['这一次想写一个关于快递员的都市逆袭故事', '新采访的问题']);
});

// 同口径：刷新页面恢复 CONVERTED 会话（简报回填主框）后开新采访，主框同样须被新创意覆盖。
test('restoring a converted session then starting a new interview overwrites the filled brief', async () => {
  const h = setup(async (url, opts) => opts.method === 'POST'
    ? { ...saved({ ready: false }), sessionId: 'new-session', question: '刷新后新采访的问题' }
    : { sessions: [saved({ status: 'CONVERTED', ready: true, brief: '刷新恢复的采访简报' })] });
  await h.c.initInterviewPanel();
  assert.equal(h.$('modeBrief').value, '刷新恢复的采访简报', 'CONVERTED 回填简报');
  h.$('ivAnswer').value = '刷新后想写一个全新的古装复仇故事';
  await h.c.ivStart();
  assert.equal(h.$('modeBrief').value, '刷新后想写一个全新的古装复仇故事',
    'CONVERTED 回填的简报在开新采访时必须被新创意覆盖');
});

// v2.320 下游闭环：用户采访结束（CLOSED）但未生成简报时，刷新页面不应丢失采访记录——
// 旧逻辑 ivRestoreSession 只恢复 ACTIVE/CONVERTED，CLOSED 被当空会话丢弃，用户只能重新采访。
// 修复：CLOSED 会话也应恢复（回看 transcript、禁回答），但保留生成简报入口（补转 CONVERTED）。
test('v2.320 a CLOSED session is restorable after refresh: transcript visible, answers blocked, brief button available', async () => {
  const h = setup(async () => ({ sessions: [saved({ status: 'CLOSED', ready: true })] }));
  await h.c.initInterviewPanel();
  assert.deepEqual(h.bubbles(), ['女记者寻找失踪姐姐', '她会失去什么？', '她会失去唯一的线索', '她决定如何反击？'],
    'CLOSED 采访记录应可回看，不应被丢弃');
  assert.equal(h.$('ivAnswer').disabled, true, 'CLOSED 禁止继续回答');
  assert.equal(h.$('ivSendBtn').disabled, true);
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), false, 'CLOSED 应允许生成简报（补转 CONVERTED）');
  assert.equal(h.$('ivStopBtn').classList.contains('hidden'), true, 'CLOSED 不再显示结束按钮');
  assert.match(h.$('ivStatus').textContent, /采访已完成|已结束/);
});

// v2.320 CLOSED 状态下点生成简报：简报回填主框，会话进入终态（不再显示生成按钮）。
test('v2.320 a CLOSED session can still generate a brief and enter terminal state', async () => {
  const h = setup(async (url, opts) => url.endsWith('/brief')
    ? { brief: 'CLOSED 后补生成的简报', status: 'CONVERTED', ready: true }
    : { sessions: [saved({ status: 'CLOSED', ready: true })] });
  await h.c.initInterviewPanel();
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), false);
  await h.c.ivBrief();
  assert.equal(h.$('modeBrief').value, 'CLOSED 后补生成的简报');
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), true, '生成简报后进入终态，不再显示生成按钮');
  assert.equal(h.$('ivAnswer').disabled, true);
});
