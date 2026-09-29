const { resultsOnCue } = require('../dist/engine/results-on-cue.js');
const assert = require('assert');

/* c131 results-on-cue 化验秒出/官方流程掐点检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue / 英文放行与合并 */

/* 中文隔离行（确保无任何锚词与 rescue 词） */
const ISO1 = '△墙上挂着一幅褪色的山水画。';
const ISO2 = '△桌上的茶凉了一半。';

/* 事件基础件：流程锚行 + 秒速兑付锚行（±2 行内共现，窗口内无 rescue 词） */
const EV_A = ['内景 市局检验科 日', '△化验结果当场就出了。'].join('\n');
const EV_B = ['内景 司法鉴定中心 日', '△亲子鉴定报告半小时就拿到了。'].join('\n');
const EV_C = ['内景 派出所 日', '△笔迹鉴定今天就能出结果。'].join('\n');

/* 英文隔离行 */
const EISO1 = 'Paint peeled from the window frame.';
const EISO2 = 'A neon sign buzzed outside.';

const run = (i, name, fn) => {
  try { fn(); console.log(`ok ${i} - ${name}`); } catch (e) { console.error(`not ok ${i} - ${name}\n  ${e.message}`); process.exitCode = 1; }
};

/* 1 空文本 */
run(1, 'empty draft → score 100', () => {
  const r = resultsOnCue('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

/* 2 中文首次豁免 */
run(2, 'zh first instant-process exempted → 100', () => {
  const r = resultsOnCue(EV_A);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 0);
});

/* 3 两事件（首次豁免后第 2 次计 1 hit）→ 70 */
run(3, 'zh two instant-process → hitCount 2, score 70', () => {
  const r = resultsOnCue(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 4 三事件 → 50 */
run(4, 'zh three instant-process → hitCount 3, score 50', () => {
  const r = resultsOnCue(`${EV_A}\n${EV_B}\n${EV_C}`);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

/* 5 rescue A：等待明示（三天后出+等了一周落在事件2窗口内；首次豁免事件不入 hits） */
run(5, 'zh rescue via real wait', () => {
  const text = ['内景 市局检验科 日', '△化验结果当场就出了。',
    '内景 司法鉴定中心 日', '△这报告本该三天后出，硬是等了一周。', '△亲子鉴定报告半小时就拿到了。'].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 6 rescue B：加急代价（塞了红包） */
run(6, 'zh rescue via rush cost', () => {
  const text = ['内景 市局检验科 日', '△化验结果当场就出了。',
    '内景 司法鉴定中心 日', '△为了加急，他塞了红包。', '△亲子鉴定报告半小时就拿到了。'].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 7 rescue C：现场快检（试纸） */
run(7, 'zh rescue via field test', () => {
  const text = ['内景 市局检验科 日', '△化验结果当场就出了。',
    '内景 司法鉴定中心 日', '△用的是现场快检试纸。', '△亲子鉴定报告半小时就拿到了。'].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 8 双锚缺一：纯流程无速度（真实周期放行） */
run(8, 'zh process without instant → pass', () => {
  const r = resultsOnCue(['内景 检验科 日', '△化验结果下周出。', ISO1].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9 双锚缺一：纯速度无流程（没提流程名） */
run(9, 'zh instant without process → pass', () => {
  const r = resultsOnCue(['内景 派出所 日', '△批文当场就拿到了。', ISO1].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 10 相邻 ≤2 行流程行合并为同一事件 */
run(10, 'zh adjacent processes merged → 1 event', () => {
  const text = ['内景 市局检验科 日', '△化验结果当场就出了。', '△毒理报告半小时就拿到了。', ISO1].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 11 跨场景头不合并 */
run(11, 'zh instant-process across scene header not merged → 70', () => {
  const r = resultsOnCue(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

/* 12 ±3 边界外不命中 */
run(12, 'zh process and instant 3 lines apart → pass', () => {
  const text = ['内景 检验科 日', '△送检的血样已经封存。', ISO1, ISO2, '△半小时就出了结果。'].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 13 场景头行不参与匹配（场景头含锚词也不计入） */
run(13, 'zh scene header with anchor word ignored', () => {
  const text = ['内景 鉴定中心当场出件', '△他坐在走廊里。', ISO1].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 14 反例：当场做检查不等于秒出报告（"当场给"无兑付动词）不误伤 */
run(14, 'zh on-spot exam without instant payoff → pass', () => {
  const text = ['内景 急诊室 夜', '△医生当场给他做了验伤。', ISO1].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 15 英文计分：两事件 → 70 */
run(15, 'en two instant-process → hitCount 2, score 70', () => {
  const text = ['INT. LAB - DAY', 'The blood work was already out.',
    'INT. COURTHOUSE - DAY', 'The paternity test results were in before lunch.'].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 16 英文 rescue：加急代价豁免 */
run(16, 'en rescue via rush fee → 100', () => {
  const text = ['INT. LAB - NIGHT', 'The blood work was already out.',
    'INT. COURTHOUSE - DAY', 'He paid extra for the rush fee.', 'The notarized paperwork was ready by morning.'].join('\n');
  const r = resultsOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 17 英文放行与合并：真实周期放行 + 相邻流程行合并 */
run(17, 'en real-window pass and adjacent merge', () => {
  const pass = ['INT. MORGUE - DAY', 'The autopsy takes a week.', EISO1].join('\n');
  const r1 = resultsOnCue(pass);
  assert.strictEqual(r1.hitCount, 0);
  assert.strictEqual(r1.score, 100);
  const merged = ['INT. LAB - DAY', 'The blood work was already out.', 'The toxicology report was done the same day.', EISO2].join('\n');
  const r2 = resultsOnCue(merged);
  assert.strictEqual(r2.hitCount, 1);
  assert.strictEqual(r2.score, 100);
});

console.log(`\ndone: ${process.exitCode ? 'FAILED' : 'all 17 passed'}`);
