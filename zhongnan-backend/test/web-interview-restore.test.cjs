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

test('restoration skips finished sessions and preserves a newly typed idea', async () => {
  const h = setup(async () => ({ sessions: [saved({ id: 'finished', status: 'CONVERTED' }), saved({ ready: false, turnCount: 3 })] }));
  h.$('modeBrief').value = '刚写下的新故事';
  await h.c.initInterviewPanel();
  assert.equal(h.$('modeBrief').value, '刚写下的新故事');
  assert.match(h.$('ivStatus').textContent, /第 3 轮/);
  assert.equal(h.$('ivBriefBtn').classList.contains('hidden'), true);
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
