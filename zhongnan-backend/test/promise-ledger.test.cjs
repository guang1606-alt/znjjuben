// v2.80 承诺欠账账本（promise-ledger）测试：誓言提取 / 摘要规范化 / 欠账记账 / 架构师指令
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractPromiseKeywords,
  sharePromiseWord,
  derivePromiseLine,
  promiseAdvanceCheck,
  normalizePromiseRow,
  promiseDroughtLedger,
  promiseDroughtDirective,
  PROMISE_DROUGHT_MID,
  PROMISE_DROUGHT_HIGH,
} = require('../dist/engine/promise-ledger.js');

// —— derivePromiseLine：誓言句提取 ——

test('derivePromiseLine：含宣誓词句子提取为承诺线，无誓言 → 空串', () => {
  assert.equal(derivePromiseLine('沈青澜攥紧拳头："我发誓，一定要为母亲讨回这笔血债！"'), '沈青澜攥紧拳头：我发誓，一定要为母亲讨回这笔血债');
  assert.equal(derivePromiseLine('两人对坐喝茶，聊起了天气。'), '');
  assert.equal(derivePromiseLine(''), '');
  assert.equal(derivePromiseLine('   '), '');
  assert.equal(derivePromiseLine('我保证三天之内把证据交给你。'), '我保证三天之内把证据交给你');
});

test('derivePromiseLine：多句取首个誓言句，超长截断，en 走词组匹配', () => {
  const multi = derivePromiseLine('先吃饭。我答应你，一定查清楚真相。回头再说。');
  assert.ok(multi.startsWith('我答应你'));
  const long = derivePromiseLine(`我发誓，${'剧情'.repeat(50)}结束。`);
  assert.equal(long.length, 60);
  assert.equal(derivePromiseLine('I swear, I will make them pay for this.'), 'I swear, I will make them pay for this');
  assert.equal(derivePromiseLine('He nodded and left the room.'), '');
});

// —— extractPromiseKeywords / sharePromiseWord：同诺关联 ——

test('extractPromiseKeywords：宣誓词自身进停用表，同诺交集 true / 换诺 false', () => {
  const kw = extractPromiseKeywords('我发誓，一定要为母亲报仇');
  assert.ok(!kw.includes('发誓'));
  assert.ok(!kw.includes('一定'));
  assert.ok(kw.some((w) => '报仇'.includes(w) || w === '报仇' || w === '为母' || w === '母亲'));
  assert.equal(sharePromiseWord('我发誓，一定要为母亲报仇', '这份仇，我记下了，母亲之仇必报'), true); // 共享 报仇/母亲 词根
  assert.equal(sharePromiseWord('我发誓，一定要为母亲报仇', '我答应你，三天内离开这座城市'), false);
  assert.equal(sharePromiseWord('', '随便'), false);
  assert.equal(sharePromiseWord('我发誓报仇', ''), false);
});

// —— promiseAdvanceCheck：兑现检测 ——

test('promiseAdvanceCheck：承诺词复现+兑现动作词 → true，缺一不可', () => {
  assert.equal(promiseAdvanceCheck('我发誓要为母亲报仇', '他终于报仇了，跪在母亲坟前久久不起，眼里全是这些年的委屈。'), true);
  assert.equal(promiseAdvanceCheck('我答应三天内交出证据', '三天后，证据到手，他如约把U盘放在桌上，一字一句说完了当年的真相。'), true);
  assert.equal(promiseAdvanceCheck('我发誓要为母亲报仇', '他坐在窗前，想起了母亲生前的笑容，眼眶一热。'), false); // 复现但无兑现词
  assert.equal(promiseAdvanceCheck('我答应过要保护你', '一切尽在掌握，他冲对面微微一笑，抬手举杯示意。'), false); // 兑现词侧无承诺词复现
  assert.equal(promiseAdvanceCheck('', '他终于报仇了。'), false);
  assert.equal(promiseAdvanceCheck('我发誓报仇', '  '), false);
  assert.equal(promiseAdvanceCheck('我发誓报仇', '太短'), false);
  assert.equal(promiseAdvanceCheck('I will make them pay for this debt', 'The debt was finally paid back, and he walked away.'), true);
});

// —— normalizePromiseRow：摘要规范化 ——

test('normalizePromiseRow：合法行入账，ep 非法 → null，line 截断，advanced 容错', () => {
  assert.deepEqual(normalizePromiseRow({ ep: 4, line: '我发誓报仇', advanced: true }), { ep: 4, line: '我发誓报仇', advanced: true });
  assert.equal(normalizePromiseRow({ ep: 0, line: 'x', advanced: false }), null);
  assert.equal(normalizePromiseRow({ ep: NaN, line: '', advanced: false }), null);
  assert.equal(normalizePromiseRow(null), null);
  assert.equal(normalizePromiseRow({ ep: 3, line: '我发誓报仇'.padEnd(80, '字'), advanced: 1 }).line.length, 60);
  assert.equal(normalizePromiseRow({ ep: 3, line: '', advanced: 1 }).advanced, true);
  assert.equal(normalizePromiseRow({ ep: 3, line: '', advanced: 'yes' }).advanced, false);
});

// —— promiseDroughtLedger：欠账记账 ——

test('promiseDroughtLedger：空序列 → 全 0 无问题', () => {
  const r = promiseDroughtLedger([], 5);
  assert.equal(r.drought, 0);
  assert.equal(r.level, 'none');
  assert.equal(r.line, '');
  assert.deepEqual(r.issues, []);
});

test('promiseDroughtLedger：同诺未兑现逐集 +1（首诺=0，≥2 mid、≥3 high）', () => {
  const line = '我发誓，一定要为母亲报仇';
  const rows = [
    { ep: 1, line, advanced: false },
    { ep: 2, line, advanced: false },
    { ep: 3, line, advanced: false },
    { ep: 4, line, advanced: false },
  ];
  const first = promiseDroughtLedger(rows.slice(0, 1), 2);
  assert.equal(first.drought, 0); // 首诺当集不欠账
  const mid = promiseDroughtLedger(rows.slice(0, 3), 4);
  assert.equal(mid.drought, 2);
  assert.equal(mid.level, 'mid');
  assert.equal(mid.issues[0].type, 'promise_drought');
  const high = promiseDroughtLedger(rows, 5);
  assert.equal(high.drought, 3);
  assert.equal(high.level, 'high');
  assert.ok(high.issues[0].evidence.includes('报仇'));
});

test('promiseDroughtLedger：兑现清零 + 换诺重置 + line 空挂起保持', () => {
  const line = '我发誓，一定要为母亲报仇';
  const paid = [
    { ep: 1, line, advanced: false },
    { ep: 2, line, advanced: false },
    { ep: 3, line, advanced: true },
  ];
  assert.equal(promiseDroughtLedger(paid, 4).drought, 0);
  const switched = [
    { ep: 1, line, advanced: false },
    { ep: 2, line, advanced: false },
    { ep: 3, line: '我答应你，三天内离开这座城市', advanced: false },
    { ep: 4, line: '我答应你，三天内离开这座城市', advanced: false },
  ];
  assert.equal(promiseDroughtLedger(switched, 5).drought, 1); // 换诺重置后新诺挂账 1 集
  const idle = [
    { ep: 1, line, advanced: false },
    { ep: 2, line, advanced: false },
    { ep: 3, line: '', advanced: false },
  ];
  const r = promiseDroughtLedger(idle, 4);
  assert.equal(r.drought, 1); // 挂起不加重也不清零
  assert.equal(r.level, 'none');
});

test('promiseDroughtLedger：乱序输入安全 + 只认 < curEpNo 的行', () => {
  const line = '我发誓，一定要为母亲报仇';
  const rows = [
    { ep: 3, line, advanced: false },
    { ep: 1, line, advanced: false },
    { ep: 2, line, advanced: false },
    { ep: 9, line, advanced: false }, // 未完成集剔除
  ];
  const r = promiseDroughtLedger(rows, 4);
  assert.equal(r.drought, 2);
  assert.equal(r.level, 'mid');
});

// —— promiseDroughtDirective：架构师指令 ——

test('promiseDroughtDirective：挂账达阈值出话，zh/en 双语齐备且 en 层零中文', () => {
  const d = promiseDroughtDirective([
    { ep: 1, line: '我发誓，一定要为母亲报仇', advanced: false },
    { ep: 2, line: '我发誓，一定要为母亲报仇', advanced: false },
    { ep: 3, line: '我发誓，一定要为母亲报仇', advanced: false },
  ]);
  assert.ok(d.zh.includes('【承诺欠账·本集兑现】'));
  assert.ok(d.zh.includes('挂账 2 集'));
  assert.ok(d.zh.includes('阶段兑现'));
  assert.ok(d.en.includes('[Promise debt — pay it down this episode]'));
  assert.ok(d.en.includes('outstanding for 2 episodes'));
  // en 系统文案零中文：承诺句属内容词按原样透传，用英文誓言行单独验证 en 模板
  const dEn = promiseDroughtDirective([
    { ep: 1, line: 'I swear I will make them pay', advanced: false },
    { ep: 2, line: 'I swear I will make them pay', advanced: false },
    { ep: 3, line: 'I swear I will make them pay', advanced: false },
  ]);
  assert.ok(dEn.en.includes('I swear I will make them pay'));
  assert.ok(!/[\u4e00-\u9fff]/.test(dEn.en));
});

test('promiseDroughtDirective：无欠账/空输入 → 空串（两语言一致）', () => {
  assert.deepEqual(promiseDroughtDirective([]), { zh: '', en: '' });
  const fresh = promiseDroughtDirective([{ ep: 1, line: '我发誓报仇', advanced: false }]);
  assert.equal(fresh.zh, '');
  assert.equal(fresh.en, '');
  const paid = promiseDroughtDirective([
    { ep: 1, line: '我发誓报仇', advanced: false },
    { ep: 2, line: '我发誓报仇', advanced: true },
  ]);
  assert.equal(paid.zh, '');
});

// —— 常量 sanity ——

test('常量 sanity：挂账阈值 2/3', () => {
  assert.equal(PROMISE_DROUGHT_MID, 2);
  assert.equal(PROMISE_DROUGHT_HIGH, 3);
});
