// v2.80 多集悬念干旱账本（mystery-drought）测试：线词提取 / 钩状态提取 / 推进检测 / 干旱记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractLineKeywords,
  shareLineWord,
  deriveMysteryHook,
  mysteryAdvanceCheck,
  normalizeMysteryRow,
  mysteryDroughtLedger,
  mysteryDroughtDirective,
  DROUGHT_MID,
  DROUGHT_HIGH,
  MYSTERY_ADVANCE_WINDOW,
} = require('../dist/engine/mystery-drought.js');

// —— extractLineKeywords：悬念线词提取 ——

test('extractLineKeywords：中文 2 字滑窗，停用词（到底/什么）被过滤', () => {
  const kw = extractLineKeywords('父亲到底去了哪里，为什么没人知道');
  assert.ok(kw.includes('父亲'));
  assert.ok(kw.includes('哪里') === false);
  assert.ok(kw.includes('到底') === false);
  assert.ok(kw.length >= 1 && kw.length <= 8);
});

test('extractLineKeywords：英文词级提取（≥4 字母 + 停用词过滤）', () => {
  const kw = extractLineKeywords("Where is the missing father? Nobody knows the truth about Blackwood Manor");
  assert.ok(kw.includes('missing'));
  assert.ok(kw.includes('father'));
  assert.ok(kw.includes('truth') === false);
  assert.ok(kw.includes('where') === false);
});

test('extractLineKeywords：去重 + cap 8 + 过短文本返回空', () => {
  const kw = extractLineKeywords('监控录像里的男人背影和监控录像里的脚步声越走越近了');
  assert.ok(new Set(kw).size === kw.length);
  assert.ok(kw.length <= 8);
  assert.deepEqual(extractLineKeywords('父亲'), []);
  assert.deepEqual(extractLineKeywords(''), []);
});

// —— shareLineWord：同线关联 ——

test('shareLineWord：共享实词判同线，悬念句式词不算', () => {
  assert.equal(shareLineWord('父亲到底去了哪里', '父亲的诊所关门了'), true); // 共享「父亲」
  assert.equal(shareLineWord('这到底是怎么回事', '那究竟是什么东西'), false); // 只有句式词
  assert.equal(shareLineWord('', '父亲'), false);
});

// —— deriveMysteryHook：qcReport.cliffhanger → 悬念钩状态 ——

test('deriveMysteryHook：mystery/reveal → hooked=true + 线词；其他类型 → hooked=false', () => {
  const m = deriveMysteryHook({ type: 'mystery', endingSnippet: '父亲到底去了哪里？监控里最后出现的人是谁' }, 3);
  assert.ok(m);
  assert.equal(m.hooked, true);
  assert.ok(m.line.includes('父亲'));
  const rv = deriveMysteryHook({ type: 'reveal', snippet: '原来父亲一直藏在老宅地下室的暗门后面' }, 4);
  assert.ok(rv);
  assert.equal(rv.hooked, true);
  const other = deriveMysteryHook({ type: 'crisis', endingSnippet: '枪口顶住了她的额头，她动弹不得' }, 5);
  assert.deepEqual(other, { hooked: false, line: '' });
});

test('deriveMysteryHook：钩片段过短 → hooked 保留、line 置空；非法集号 → null；空 raw 兜底', () => {
  const short = deriveMysteryHook({ type: 'mystery', endingSnippet: '为什么' }, 3);
  assert.deepEqual(short, { hooked: true, line: '' });
  assert.equal(deriveMysteryHook({ type: 'mystery', endingSnippet: '父亲到底去了哪里啊' }, 0), null);
  assert.deepEqual(deriveMysteryHook(null, 2), { hooked: false, line: '' });
});

// —— mysteryAdvanceCheck：推进检测 ——

test('mysteryAdvanceCheck：线词出现在正文前 70% → 推进；只在尾段 → 未推进', () => {
  const line = '父亲/下落';
  const body = '她翻遍了老宅的每个房间，寻找父亲留下的线索。'.repeat(3);
  const tail = '的尾声。'.repeat(30);
  assert.equal(mysteryAdvanceCheck(line, body + tail), true);
  assert.equal(mysteryAdvanceCheck(line, tail + '父亲的下落依然成谜。'), false);
  assert.equal(mysteryAdvanceCheck('', body + tail), false);
  assert.equal(mysteryAdvanceCheck(line, '父亲'), false);
});

// —— normalizeMysteryRow：落库摘要规范化 ——

test('normalizeMysteryRow：合法摘要入账，非法 ep 丢弃，字段容错', () => {
  const r = normalizeMysteryRow({ ep: 6, line: '父亲/下落', advanced: true, hooked: false });
  assert.deepEqual(r, { ep: 6, line: '父亲/下落', advanced: true, hooked: false });
  assert.equal(normalizeMysteryRow({ ep: 'x', line: '父亲' }), null);
  assert.equal(normalizeMysteryRow(null), null);
  const loose = normalizeMysteryRow({ ep: 3, line: 42, advanced: 'yes', hooked: 1 });
  assert.deepEqual(loose, { ep: 3, line: '', advanced: false, hooked: true });
});

// —— mysteryDroughtLedger：干旱记账 ——

test('mysteryDroughtLedger：空序列 → drought 0 无问题', () => {
  const r = mysteryDroughtLedger([], 5);
  assert.equal(r.drought, 0);
  assert.equal(r.level, 'none');
  assert.deepEqual(r.issues, []);
});

test('mysteryDroughtLedger：同线连吊未推进 → 干旱累积（≥2 mid、≥3 high）', () => {
  const rows = [
    { ep: 1, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 2, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 3, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 4, line: '父亲/下落', advanced: false, hooked: true },
  ];
  assert.equal(mysteryDroughtLedger(rows.slice(0, 3), 4).drought, 2);
  assert.equal(mysteryDroughtLedger(rows.slice(0, 3), 4).level, 'mid');
  const r = mysteryDroughtLedger(rows, 5);
  assert.equal(r.drought, 3);
  assert.equal(r.level, 'high');
  assert.equal(r.issues[0].type, 'mystery_drought');
  assert.ok(r.issues[0].evidence.includes('3'));
  assert.ok(r.issues[0].evidence.includes('父亲'));
});

test('mysteryDroughtLedger：正文推进 → 清零；换线 → 重置；首吊不加重', () => {
  const advanced = [
    { ep: 1, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 2, line: '父亲/下落', advanced: true, hooked: true },
    { ep: 3, line: '父亲/下落', advanced: false, hooked: true },
  ];
  const rA = mysteryDroughtLedger(advanced, 4);
  assert.equal(rA.drought, 1); // ep2 推进清零，ep3 重吊同问未推进 → 1（未达阈值）
  const switched = [
    { ep: 1, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 2, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 3, line: '母亲的遗产', advanced: false, hooked: true }, // 新线
  ];
  const rB = mysteryDroughtLedger(switched, 4);
  assert.equal(rB.drought, 0);
  const first = [{ ep: 1, line: '父亲/下落', advanced: false, hooked: true }];
  assert.equal(mysteryDroughtLedger(first, 2).drought, 0);
});

test('mysteryDroughtLedger：挂起保持（无钩无推进不加不减）+ 无线行跳过', () => {
  const rows = [
    { ep: 1, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 2, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 3, line: '父亲/下落', advanced: false, hooked: false }, // 挂起保持
    { ep: 4, line: '', advanced: false, hooked: false }, // 无线跳过
    { ep: 5, line: '父亲/下落', advanced: false, hooked: false }, // 挂起保持
  ];
  const r = mysteryDroughtLedger(rows, 6);
  assert.equal(r.drought, 1);
  assert.equal(r.level, 'none');
});

test('mysteryDroughtLedger：乱序输入安全 + 只认 < curEpNo 的行', () => {
  const rows = [
    { ep: 3, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 1, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 2, line: '父亲/下落', advanced: false, hooked: true },
    { ep: 9, line: '父亲/下落', advanced: false, hooked: true }, // 未完成集剔除
  ];
  const r = mysteryDroughtLedger(rows, 4);
  assert.equal(r.drought, 2);
  assert.equal(r.level, 'mid');
});

// —— mysteryDroughtDirective：架构师指令 ——

test('mysteryDroughtDirective：干旱达阈值出话，zh/en 双语齐备且 en 层零中文（英文线词）', () => {
  const rows = [
    { ep: 1, line: 'missing/father', advanced: false, hooked: true },
    { ep: 2, line: 'missing/father', advanced: false, hooked: true },
    { ep: 3, line: 'missing/father', advanced: false, hooked: true },
  ];
  const d = mysteryDroughtDirective(rows);
  assert.ok(d.zh.includes('【悬念干旱·部分答案】'));
  assert.ok(d.zh.includes('2 集'));
  assert.ok(d.zh.includes('部分答案'));
  assert.ok(d.en.includes('[Mystery drought'));
  assert.ok(d.en.includes('strung along for 2 episodes'));
  assert.ok(d.en.includes('missing'));
  assert.ok(!/[\u4e00-\u9fff]/.test(d.en)); // en 系统文案零中文
});

test('mysteryDroughtDirective：无干旱/未达阈值 → 空串（两语言一致）', () => {
  assert.equal(mysteryDroughtDirective([]).zh, '');
  assert.equal(mysteryDroughtDirective([{ ep: 1, line: '父亲', advanced: false, hooked: true }]).en, '');
});

// —— 常量 sanity ——

test('常量 sanity：干旱阈值 2/3，推进窗口 0.7', () => {
  assert.equal(DROUGHT_MID, 2);
  assert.equal(DROUGHT_HIGH, 3);
  assert.equal(MYSTERY_ADVANCE_WINDOW, 0.7);
});
