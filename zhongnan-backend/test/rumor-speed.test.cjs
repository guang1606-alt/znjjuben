const { rumorSpeed } = require('../dist/engine/rumor-speed.js');
const assert = require('assert');

/* c130 rumor-speed 丑闻秒传遍检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue / 英文放行与合并 */

/* 中文隔离行（确保无任何锚词与 rescue 词） */
const ISO1 = '△墙上挂着一幅褪色的山水画。';
const ISO2 = '△桌上的茶凉了一半。';

/* 事件基础件：传播锚行 + 速度锚行（±2 行内共现，窗口内无 rescue 词） */
const EV_A = ['内景 赵家大厅 夜', '△流言一夜之间传遍了全城。'].join('\n');
const EV_B = ['内景 集市 日', '△消息不胫而走。', '△短短半天，全城都在议论。'].join('\n');
const EV_C = ['内景 茶楼 夜', '△丑闻刷屏了。', '△几个小时后，人尽皆知。'].join('\n');

/* 英文隔离行 */
const EISO1 = 'Paint peeled from the window frame.';
const EISO2 = 'A neon sign buzzed outside.';

const run = (i, name, fn) => {
  try { fn(); console.log(`ok ${i} - ${name}`); } catch (e) { console.error(`not ok ${i} - ${name}\n  ${e.message}`); process.exitCode = 1; }
};

/* 1 空文本 */
run(1, 'empty draft → score 100', () => {
  const r = rumorSpeed('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

/* 2 中文首次豁免 */
run(2, 'zh first rocket exempted → 100', () => {
  const r = rumorSpeed(EV_A);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 0);
});

/* 3 两事件（首次豁免后第 2 次计 1 hit）→ 70 */
run(3, 'zh two rockets → hitCount 2, score 70', () => {
  const r = rumorSpeed(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 4 三事件 → 50 */
run(4, 'zh three rockets → hitCount 3, score 50', () => {
  const r = rumorSpeed(`${EV_A}\n${EV_B}\n${EV_C}`);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

/* 5 rescue A：慢发酵（捂了三年+发酵行落在事件2窗口内；首次豁免事件不入 hits） */
run(5, 'zh rescue via slow burn', () => {
  const text = ['内景 赵家大厅 夜', '△流言一夜之间传遍了全城。',
    '内景 集市 日', '△消息不胫而走。', '△这秘密捂了三年，如今终于发酵。', '△短短半天，全城都在议论。'].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 6 rescue B：传播主体（有人偷拍发网上） */
run(6, 'zh rescue via agent', () => {
  const text = ['内景 赵家大厅 夜', '△流言一夜之间传遍了全城。',
    '内景 集市 日', '△有人偷拍了视频发到网上。', '△一夜之间传遍了全网。', '△全城炸了锅。'].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 7 rescue C：封口对抗（连夜删帖） */
run(7, 'zh rescue via pushback', () => {
  const text = ['内景 赵家大厅 夜', '△流言一夜之间传遍了全城。',
    '内景 集市 日', '△一夜之间传遍了全城。', '△周家连夜删帖，可已经晚了。', '△短短半天，满城风雨。'].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 8 双锚缺一：纯传播无速度（慢传播放行） */
run(8, 'zh spread without speed → pass', () => {
  const r = rumorSpeed(['内景 大厅 夜', '△这桩丑闻过了半年才逐渐传开。', ISO1].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9 双锚缺一：纯速度无传播（一夜白了头不是传播） */
run(9, 'zh speed without spread → pass', () => {
  const r = rumorSpeed(['内景 大厅 夜', '△一夜之间，他白了头。', ISO1].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 10 相邻 ≤2 行传播行合并为同一事件 */
run(10, 'zh adjacent spreads merged → 1 event', () => {
  const text = ['内景 赵家大厅 夜', '△流言一夜之间传遍了全城。', '△满城风雨。', '△短短半天，无人不知。', ISO1].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 11 跨场景头不合并 */
run(11, 'zh rockets across scene header not merged → 70', () => {
  const r = rumorSpeed(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

/* 12 ±3 边界外不命中 */
run(12, 'zh spread and speed 3 lines apart → pass', () => {
  const text = ['内景 集市 日', '△消息不胫而走。', ISO1, ISO2, '△短短半天，消息就走了样。'].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 13 场景头行不参与匹配（场景头含锚词也不计入） */
run(13, 'zh scene header with anchor word ignored', () => {
  const text = ['内景 传遍全城的丑闻', '△陈默把秘密说了出来。', '△一夜之间满城风雨。', ISO1].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 14 反例：慢发酵的传播（酝酿半年才传开）不误伤 */
run(14, 'zh slow burn spread → pass', () => {
  const text = ['内景 大厅 夜', '△这件事酝酿了半年，才慢慢传开。', ISO1, ISO2].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 15 英文计分：两事件 → 70 */
run(15, 'en two rockets → hitCount 2, score 70', () => {
  const text = ['INT. HALL - NIGHT', 'The rumor spread like wildfire.', 'The scandal blew up online.', 'Within hours, everyone knew.',
    'INT. OFFICE - DAY', 'The news broke at dawn.', 'By noon the whole town was talking.'].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 16 英文 rescue：传播主体 + 封口对抗双路豁免 */
run(16, 'en rescues via agent/pushback → 100', () => {
  const text = ['INT. HALL - NIGHT', 'He leaked the photos himself.', 'Overnight the scandal was everywhere.',
    'INT. OFFICE - DAY', 'The rumor spread like wildfire.', 'The PR team killed the story by noon.', 'Within hours everyone knew.'].join('\n');
  const r = rumorSpeed(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 17 英文放行与合并：纯议论放行 + 相邻传播行合并 */
run(17, 'en chatter pass and adjacent merge', () => {
  const pass = ['INT. WEDDING - NIGHT', 'Everyone was talking about the dress.', EISO2].join('\n');
  const r1 = rumorSpeed(pass);
  assert.strictEqual(r1.hitCount, 0);
  assert.strictEqual(r1.score, 100);
  const merged = ['INT. HALL - NIGHT', 'The news broke at dawn.', 'It went viral by noon.', 'Within hours everyone knew.', EISO1].join('\n');
  const r2 = rumorSpeed(merged);
  assert.strictEqual(r2.hitCount, 1);
  assert.strictEqual(r2.score, 100);
});

console.log(`\ndone: ${process.exitCode ? 'FAILED' : 'all 17 passed'}`);
