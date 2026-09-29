const { trafficOnCue } = require('../dist/engine/traffic-on-cue.js');
const assert = require('assert');

/* c132 traffic-on-cue 路况掐点检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue / 英文放行与合并 */

/* 中文隔离行（确保无任何锚词与 rescue 词） */
const ISO1 = '△桌上的账本摊开着。';
const ISO2 = '△窗台上的花蔫了。';

/* 事件基础件：利害锚行 + 路况锚行（±2 行内共现，窗口内无 rescue 词） */
const EV_A = ['内景 车内 日', '△他跳上车去追。', '△前面高架堵车，纹丝不动。'].join('\n');
const EV_B = ['内景 街头 夜', '△她拦车。', '△三辆空车刚刚开走了。'].join('\n');
const EV_C = ['内景 高速匝口 日', '△他开车追了上去。', '△路口一路红灯。'].join('\n');

/* 英文隔离行 */
const EISO1 = 'Paint peeled from the window frame.';
const EISO2 = 'A neon sign buzzed outside.';

const run = (i, name, fn) => {
  try { fn(); console.log(`ok ${i} - ${name}`); } catch (e) { console.error(`not ok ${i} - ${name}\n  ${e.message}`); process.exitCode = 1; }
};

/* 1 空文本 */
run(1, 'empty draft → score 100', () => {
  const r = trafficOnCue('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

/* 2 中文首次豁免 */
run(2, 'zh first cue exempted → 100', () => {
  const r = trafficOnCue(EV_A);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 0);
});

/* 3 两事件（首次豁免后第 2 次计 1 hit）→ 70 */
run(3, 'zh two cues → hitCount 2, score 70', () => {
  const r = trafficOnCue(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 4 三事件 → 50 */
run(4, 'zh three cues → hitCount 3, score 50', () => {
  const r = trafficOnCue(`${EV_A}\n${EV_B}\n${EV_C}`);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

/* 5 rescue A：来路（早高峰堵得水泄不通——路况有因果；首次豁免事件不入 hits） */
run(5, 'zh rescue via cause', () => {
  const text = ['内景 车内 日', '△他跳上车去追。', '△前面高架堵车，纹丝不动。',
    '内景 街头 夜', '△早高峰，高架堵得水泄不通。', '△她拦车。', '△三辆空车刚刚开走了。'].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 6 rescue B：替代方案（绕路追过去） */
run(6, 'zh rescue via detour', () => {
  const text = ['内景 车内 日', '△他跳上车去追。', '△前面高架堵车，纹丝不动。',
    '内景 街头 夜', '△她拦车。', '△三辆空车刚刚开走了。', '△他决定绕路追过去。'].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 7 rescue C：后果代价（还是晚了一步） */
run(7, 'zh rescue via cost', () => {
  const text = ['内景 车内 日', '△他跳上车去追。', '△前面高架堵车，纹丝不动。',
    '内景 街头 夜', '△她拦车。', '△三辆空车刚刚开走了。', '△还是晚了一步，人已不见。'].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 8 双锚缺一：纯利害无路况（赶去机场放行） */
run(8, 'zh stake without traffic → pass', () => {
  const r = trafficOnCue(['内景 机场 日', '△他赶飞机。', ISO1].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9 双锚缺一：纯路况无利害（城市背景板放行） */
run(9, 'zh traffic without stake → pass', () => {
  const r = trafficOnCue(['内景 高架 日', '△高架桥上大堵车。', ISO1].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 10 相邻 ≤2 行路况行合并为同一事件 */
run(10, 'zh adjacent traffic merged → 1 event', () => {
  const text = ['内景 车内 日', '△他跳上车去追。', '△前面高架堵车。', '△堵得水泄不通。', ISO1].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 11 跨场景头不合并 */
run(11, 'zh cues across scene header not merged → 70', () => {
  const r = trafficOnCue(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

/* 12 ±3 边界外不命中 */
run(12, 'zh stake and traffic 3 lines apart → pass', () => {
  const text = ['内景 车内 日', '△他跳上车去追。', ISO1, ISO2, '△前面高架堵车。'].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 13 场景头行不参与匹配（场景头含路况词也不计入） */
run(13, 'zh scene header with traffic word ignored', () => {
  const text = ['内景 堵车的街头', '△他跳上车去追。', '△三辆空车刚刚开走了。', ISO1].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 14 反例：日常开车（无追赶无堵车）不误伤 */
run(14, 'zh daily drive → pass', () => {
  const text = ['内景 车内 日', '△他开车回了老家。', '△一路听着广播。', ISO1, ISO2].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 15 英文计分：两事件 → 70 */
run(15, 'en two cues → hitCount 2, score 70', () => {
  const text = ['INT. TAXI - DAY', 'He told the driver to chase after them.', 'They are stuck in traffic.',
    'INT. STREET - NIGHT', 'She tried to hail a cab.', 'Every light was red.'].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 16 英文 rescue：来路 + 后果双路豁免 */
run(16, 'en rescues via cause/cost → 100', () => {
  const text = ['INT. TAXI - DAY', 'He told the driver to chase after them.', 'They are stuck in traffic.',
    'INT. STREET - NIGHT', 'Rush hour.', 'She tried to hail a cab.', 'Every light was red.', 'Too late - he was gone.'].join('\n');
  const r = trafficOnCue(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 17 英文放行与合并：纯驾驶放行 + 相邻路况行合并 */
run(17, 'en quiet drive pass and adjacent merge', () => {
  const pass = ['INT. HOTEL - DAY', 'He drove home quietly.', EISO2].join('\n');
  const r1 = trafficOnCue(pass);
  assert.strictEqual(r1.hitCount, 0);
  assert.strictEqual(r1.score, 100);
  const merged = ['INT. TAXI - DAY', 'He told the driver to chase after them.', 'They are stuck in traffic.', 'Bumper to bumper.', EISO1].join('\n');
  const r2 = trafficOnCue(merged);
  assert.strictEqual(r2.hitCount, 1);
  assert.strictEqual(r2.score, 100);
});

console.log(`\ndone: ${process.exitCode ? 'FAILED' : 'all 17 passed'}`);
