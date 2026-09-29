const test = require('node:test');
const assert = require('node:assert');
// c202：改写前后版本对比纯引擎（零 token、确定性，行级 LCS）。先红后绿。
const { splitScriptLines, diffScripts, assessRewrite, summarizeChanges, MAX_CHANGE_HIGHLIGHTS, MAX_DIFF_LINES, ScriptTooLargeError } = require('../dist/engine/script-diff');

test('splitScriptLines：按行切分、trim、丢弃空行；空文本归一为空数组', () => {
  assert.deepStrictEqual(splitScriptLines('场景：小店\n老周：面钱\n\n 小林：嗯 \n'), ['场景：小店', '老周：面钱', '小林：嗯']);
  assert.deepStrictEqual(splitScriptLines(''), []);
  assert.deepStrictEqual(splitScriptLines('  \n\t\n'), []);
  assert.deepStrictEqual(splitScriptLines(null), []);
});

test('diffScripts：完全相同→全部 equal，added/removed 为 0', () => {
  const text = '场景：小店\n老周：面钱下回给。\n小林：你上回也这么说。';
  const r = diffScripts(text, text);
  assert.ok(r.segments.every((s) => s.type === 'equal'));
  assert.strictEqual(r.stats.equal, 3);
  assert.strictEqual(r.stats.added, 0);
  assert.strictEqual(r.stats.removed, 0);
});

test('diffScripts：仅新增一行→added 计数且无 removed，equal 行保留', () => {
  const r = diffScripts('A\nB', 'A\nB\nC');
  assert.strictEqual(r.stats.added, 1);
  assert.strictEqual(r.stats.removed, 0);
  assert.strictEqual(r.stats.equal, 2);
  const added = r.segments.find((s) => s.type === 'added');
  assert.strictEqual(added.text, 'C');
});

test('diffScripts：一行被改写→旧行 removed、新行 added，其余 equal', () => {
  const r = diffScripts('A\nB\nC', 'A\nB2\nC');
  assert.strictEqual(r.stats.removed, 1);
  assert.strictEqual(r.stats.added, 1);
  assert.strictEqual(r.stats.equal, 2);
  assert.deepStrictEqual(r.segments.filter((s) => s.type !== 'equal').map((s) => [s.type, s.text]),
    [['removed', 'B'], ['added', 'B2']]);
});

test('diffScripts：整段重写（无共同行）→只有 added/removed，无 equal', () => {
  const r = diffScripts('A\nB', 'X\nY');
  assert.strictEqual(r.stats.equal, 0);
  assert.strictEqual(r.stats.added, 2);
  assert.strictEqual(r.stats.removed, 2);
});

test('diffScripts：行移动被识别为重排（LCS 保序，移动计为 removed+added 而非报错）', () => {
  const r = diffScripts('A\nB\nC', 'A\nC\nB');
  // LCS = A + (B 或 C)，另两行计为一次删除一次新增
  assert.strictEqual(r.stats.equal, 2);
  assert.strictEqual(r.stats.added, 1);
  assert.strictEqual(r.stats.removed, 1);
});

test('diffScripts：确定性——同一输入两次结果逐段一致（端点可缓存/可复现）', () => {
  const a = diffScripts('场景：小店\n老周：面钱\n小林：嗯', '场景：小店\n老周：面钱下回给。\n小林：嗯\n门外喇叭响。');
  const b = diffScripts('场景：小店\n老周：面钱\n小林：嗯', '场景：小店\n老周：面钱下回给。\n小林：嗯\n门外喇叭响。');
  assert.deepStrictEqual(a, b);
});

test('diffScripts：每行首尾空白与空行归一不产生噪音差异', () => {
  const r = diffScripts('A\nB\n', ' A \n\n B ');
  assert.strictEqual(r.stats.added, 0);
  assert.strictEqual(r.stats.removed, 0);
  assert.strictEqual(r.stats.equal, 2);
});

test('assessRewrite：相同文本 ratio=0/negligible；空→有内容按整体新增 major', () => {
  assert.deepStrictEqual(assessRewrite('A\nB\nC', 'A\nB\nC'), { changedRatio: 0, level: 'negligible' });
  const fresh = assessRewrite('', 'A\nB\nC\nD');
  assert.strictEqual(fresh.level, 'major');
  assert.strictEqual(fresh.changedRatio, 1);
  assert.deepStrictEqual(assessRewrite('', ''), { changedRatio: 0, level: 'negligible' });
});

test('assessRewrite：改动幅度分档——1/20 行微调 negligible，4/20 light，半数 partial，全改 major', () => {
  const lines = (n) => Array.from({ length: n }, (_, i) => `第${i + 1}行对白内容保持原样。`);
  const withChanges = (base, n) => base.map((l, i) => (i < n ? `改写后的全新第${i + 1}行台词来了。` : l));
  // 1/20：对称 churn=1/20=0.05 → negligible（几乎没动）
  assert.strictEqual(assessRewrite(lines(20).join('\n'), withChanges(lines(20), 1).join('\n')).level, 'negligible');
  // 4/20：0.2 → light
  assert.strictEqual(assessRewrite(lines(20).join('\n'), withChanges(lines(20), 4).join('\n')).level, 'light');
  // 10/20：0.5 → partial
  assert.strictEqual(assessRewrite(lines(20).join('\n'), withChanges(lines(20), 10).join('\n')).level, 'partial');
  // 20/20：1 → major
  assert.strictEqual(assessRewrite(lines(20).join('\n'), withChanges(lines(20), 20).join('\n')).level, 'major');
});

// c203 D4：O(nm) DP 必须有行数上限，防止异常超长内容把只读 diff 端点拖成 OOM
test('diffScripts：超过 MAX_DIFF_LINES 行抛 SCRIPT_TOO_LARGE（带 code，端点可转 400）', () => {
  assert.ok(MAX_DIFF_LINES >= 1000, '正常单集（<150 行）必须远在上限内');
  const big = Array.from({ length: MAX_DIFF_LINES + 1 }, (_, i) => `第${i + 1}行，足够长的正文内容。`).join('\n');
  assert.throws(() => diffScripts('只有一行的旧稿。', big), (e) => e instanceof ScriptTooLargeError && e.code === 'SCRIPT_TOO_LARGE');
  // 恰好上限不抛
  const atLimit = Array.from({ length: MAX_DIFF_LINES }, (_, i) => `第${i + 1}行，足够长的正文内容。`).join('\n');
  assert.doesNotThrow(() => diffScripts(atLimit, atLimit));
});

test('assessRewrite：观测函数永不因超限抛错——超限时降级 major，不能让观测炸掉 /fix 主流程', () => {
  const big = Array.from({ length: MAX_DIFF_LINES + 1 }, (_, i) => `第${i + 1}行，足够长的正文内容。`).join('\n');
  assert.deepStrictEqual(assessRewrite('只有一行的旧稿。', big), { changedRatio: 1, level: 'major' });
});

// c204 变更摘要卡：在红绿行 diff 之上给"改了什么"的确定性归纳（零 token），分类口径复用 listen-script
const ZERO_BUCKETS = { scene: 0, dialogue: 0, action: 0, other: 0 };

test('c204 summarizeChanges：新增/删除按 场标/台词/动作/其他 分类，计数与 stats 总量守恒', () => {
  const oldT = ['内景 小店·日', '老周：面钱下回给。', '△他端起碗吃面。'].join('\n');
  const newT = ['内景 小店·日', '老周：面钱今天就结。', '△他端起碗吃面。', '△门外喇叭响了两声。'].join('\n');
  const { segments, stats } = diffScripts(oldT, newT);
  const s = summarizeChanges(segments);
  assert.strictEqual(s.removed.dialogue, 1, '老周旧台词一句被删');
  assert.strictEqual(s.added.dialogue, 1, '老周新台词一句新增');
  assert.strictEqual(s.added.action, 1, '门外动作行新增');
  assert.strictEqual(s.removed.action, 0);
  const sum = (c) => c.scene + c.dialogue + c.action + c.other;
  assert.strictEqual(sum(s.added), stats.added, '新增分类计数之和必须等于 stats.added');
  assert.strictEqual(sum(s.removed), stats.removed, '删除分类计数之和必须等于 stats.removed');
});

test('c204 summarizeChanges：亮点优先台词、同级按原文顺序、名额封顶，台词带 speaker/纯内容', () => {
  const segs = [
    { type: 'equal', text: '内景 大厅·日' },
    { type: 'added', text: '△排在最前的动作行。' },
    { type: 'added', text: '林晚：我改的第一句台词。' },
    { type: 'removed', text: '老周：被删掉的旧台词。' },
    { type: 'added', text: '小陈：第二句新台词。' },
    { type: 'added', text: 'INT. LOBBY - DAY' },
  ];
  const s = summarizeChanges(segs);
  assert.strictEqual(s.highlights.added.length, MAX_CHANGE_HIGHLIGHTS);
  assert.strictEqual(s.highlights.added[0].category, 'dialogue');
  assert.strictEqual(s.highlights.added[0].speaker, '林晚');
  assert.strictEqual(s.highlights.added[0].text, '我改的第一句台词。', '台词亮点只给纯内容，不带角色名前缀');
  assert.strictEqual(s.highlights.added[1].speaker, '小陈');
  assert.strictEqual(s.highlights.added[2].category, 'scene', '第三名额给场标，而非文档顺序更早的动作行');
  assert.strictEqual(s.highlights.removed[0].speaker, '老周');
  // maxHighlights 可收窄
  assert.strictEqual(summarizeChanges(segs, { maxHighlights: 1 }).highlights.added.length, 1);
});

test('c204 summarizeChanges：亮点长文本截断保护载荷；纯 equal/空输入给零摘要且不抛错', () => {
  const longLine = `林晚：${'很长的台词'.repeat(20)}。`;
  const s = summarizeChanges([{ type: 'added', text: longLine }]);
  assert.strictEqual(s.highlights.added.length, 1);
  assert.ok(s.highlights.added[0].text.length <= 61, '单条亮点最长 60 字+省略号，防止响应 payload 失控');
  const zero = summarizeChanges([{ type: 'equal', text: 'A' }, { type: 'equal', text: 'B' }]);
  assert.deepStrictEqual(zero.added, ZERO_BUCKETS);
  assert.deepStrictEqual(zero.removed, ZERO_BUCKETS);
  assert.deepStrictEqual(zero.highlights, { added: [], removed: [] });
  assert.doesNotThrow(() => summarizeChanges(null));
  assert.doesNotThrow(() => summarizeChanges(undefined));
  assert.doesNotThrow(() => summarizeChanges([{ type: 'added' }, { type: 'weird', text: 'X' }]), '脏段（缺 text/未知类型）不得炸掉摘要');
});

// c205 复盘：守恒契约精确化——已知红绿类型即使文本为空（外部脏输入）也计 other，
// 桶和严格等于入参红绿段总数；但空段不进亮点池（不出空亮点）。未知类型仍整体忽略。
test('c205 summarizeChanges：空文本红绿段计 other 保守恒，但不产生空亮点', () => {
  const s = summarizeChanges([
    { type: 'added' },
    { type: 'added', text: '   ' },
    { type: 'removed', text: '' },
    { type: 'added', text: '林晚：你好。' },
    { type: 'weird', text: 'X' },
    { type: 'equal', text: '不变行' },
  ]);
  assert.strictEqual(s.added.other, 2, '缺 text/纯空白的新增段计 other，输入不许蒸发');
  assert.strictEqual(s.removed.other, 1, '空文本删除段同样计 other');
  assert.strictEqual(s.added.dialogue, 1);
  const sum = (c) => c.scene + c.dialogue + c.action + c.other;
  assert.strictEqual(sum(s.added), 3, 'added 桶和=入参 added 段总数（3）');
  assert.strictEqual(sum(s.removed), 1, 'removed 桶和=入参 removed 段总数（1）');
  assert.strictEqual(s.highlights.added.length, 1, '空段不进亮点池，只有台词一条亮点');
  assert.strictEqual(s.highlights.removed.length, 0, '全空 removed 无亮点');
});

test('c205 summarizeChanges：码点安全截断，不切断 emoji 代理对产生 lone surrogate', () => {
  // 71 个码点（a+70 emoji）触发截断：旧 UTF-16 slice(0,60) 落在 emoji 高代理位，结尾留孤立半代理
  const payload = 'a' + '😀'.repeat(70);
  const s = summarizeChanges([{ type: 'added', text: payload }]);
  const out = s.highlights.added[0].text;
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out), '不得出现孤立高代理');
  assert.ok(!/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out), '不得出现孤立低代理');
  assert.ok([...out].length <= 61, '按码点计最长 60 码点+省略号，payload 不失控');
  assert.ok(out.endsWith('…'), '超长有截断省略号');
});

test('c205 summarizeChanges：场记台账行计入 other 而非台词（与 parseScriptLine 同口径）', () => {
  const s = summarizeChanges([
    { type: 'added', text: '时间：夜' },
    { type: 'added', text: '地点：外滩江边' },
    { type: 'added', text: '林晚：你怎么才来。' },
    { type: 'removed', text: 'TIME: NIGHT' },
  ]);
  assert.strictEqual(s.added.dialogue, 1);
  assert.strictEqual(s.added.other, 2, '中文台账行进 other');
  assert.strictEqual(s.removed.other, 1, '英文台账行进 other');
  assert.strictEqual(s.highlights.added[0].speaker, '林晚');
});
