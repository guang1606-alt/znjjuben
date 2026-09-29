const { crowdFlip } = require('../dist/engine/crowd-flip.js');
const assert = require('assert');

/* c129 crowd-flip 当众倒戈白给检测单测
 * 17 例：空文本 / 中文首次豁免 / 计分×2 / rescue×3 / 双锚缺一 /
 *        相邻合并 / 跨场景头 / ±3边界 / 场景头排除 / 反例 /
 *        英文计分 / 英文rescue / 英文放行与合并 */

/* 中文隔离行（确保无任何锚词与 rescue 词） */
const ISO1 = '△墙上挂着一幅褪色的山水画。';
const ISO2 = '△桌上的茶凉了一半。';

/* 事件基础件：REVEAL 行 + FLIP 行（±2 行内共现，窗口内无 rescue 词） */
const EV_A = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', '△全场哗然。'].join('\n');
const EV_B = ['内景 会议室 日', '△陈默把真相说了出来。', '△众人纷纷倒向了他。'].join('\n');
const EV_C = ['内景 祠堂 日', '△陈默宣读了遗嘱。', '△族老们齐刷刷跪下。'].join('\n');

/* 英文隔离行 */
const EISO1 = 'Paint peeled from the window frame.';
const EISO2 = 'A neon sign buzzed outside.';

const run = (i, name, fn) => {
  try { fn(); console.log(`ok ${i} - ${name}`); } catch (e) { console.error(`not ok ${i} - ${name}\n  ${e.message}`); process.exitCode = 1; }
};

/* 1 空文本 */
run(1, 'empty draft → score 100', () => {
  const r = crowdFlip('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

/* 2 中文首次豁免 */
run(2, 'zh first flip exempted → 100', () => {
  const r = crowdFlip(EV_A);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 3 两事件（首次豁免后第 2 次计 1 hit）→ 70 */
run(3, 'zh two flips → hitCount 2, score 70', () => {
  const r = crowdFlip(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 4 三事件 → 50 */
run(4, 'zh three flips → hitCount 3, score 50', () => {
  const r = crowdFlip(`${EV_A}\n${EV_B}\n${EV_C}`);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

/* 5 rescue A：硬证据在场（录音行落在事件2窗口内；首次豁免事件不入 hits） */
run(5, 'zh rescue via evidence', () => {
  const text = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', '△全场哗然。',
    '内景 会议室 日', '△陈默把真相说了出来。', '△录音在大厅里响起来。', '△众人纷纷倒向了他。'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
});

/* 6 rescue B：质疑摩擦（人群分裂） */
run(6, 'zh rescue via doubt', () => {
  const text = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', '△全场哗然。', '△角落里有人不服，冷笑着离场。',
    '内景 会议室 日', '△陈默把真相说了出来。', '△众人纷纷倒向了他。'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 7 rescue C：揭露者付出代价 */
run(7, 'zh rescue via cost', () => {
  const text = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', '△全场哗然。', '△他得罪了赵家，这条路再也回不了头。',
    '内景 会议室 日', '△陈默把真相说了出来。', '△众人纷纷倒向了他。'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 8 双锚缺一：纯群体反应无揭露（庆祝场面放行） */
run(8, 'zh flip without reveal → pass', () => {
  const text = ['内景 婚礼大厅 夜', '△全场哗然。', '△宾客欢呼，掌声雷动。'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 9 双锚缺一：纯揭露无群体反应（揭露本身是戏） */
run(9, 'zh reveal without flip → pass', () => {
  const text = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', '△陈默看着他。', ISO1].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 10 相邻 ≤2 行服从行合并为同一事件 */
run(10, 'zh adjacent flips merged → 1 event', () => {
  const text = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', '△全场哗然。', '△众人纷纷起立。', ISO1].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 11 跨场景头不合并 */
run(11, 'zh flips across scene header not merged → 70', () => {
  const r = crowdFlip(`${EV_A}\n${EV_B}`);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
});

/* 12 ±3 边界外不命中 */
run(12, 'zh reveal and flip 3 lines apart → pass', () => {
  const text = ['内景 赵家大厅 夜', '△陈默当众揭穿了他。', ISO1, ISO2, '△全场哗然。'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 13 场景头行不参与匹配（场景头含锚词也不计入） */
run(13, 'zh scene header with anchor word ignored', () => {
  const text = ['内景 哗然的大厅', '△陈默当众揭穿了他。', '△全场哗然。', ISO1].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

/* 14 反例：纯庆祝场面（无揭露）不误伤 */
run(14, 'zh celebration without reveal → pass', () => {
  const text = ['内景 大厅 夜', '△音乐响起。', '△众人纷纷起立鼓掌。', ISO1, ISO2].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 15 英文计分：两事件 → 70 */
run(15, 'en two flips → hitCount 2, score 70', () => {
  const text = ['INT. HALL - NIGHT', 'He exposed him in front of everyone.', 'The crowd turned.', EISO1,
    'INT. OFFICE - DAY', 'He told everyone the truth.', 'The whole room erupted.'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
});

/* 16 英文 rescue：证据 + 质疑 + 代价三路全豁免 */
run(16, 'en rescues via evidence/doubt/cost → 100', () => {
  const text = ['INT. HALL - NIGHT', 'He exposed the chairman.', 'The recording played through the hall.', 'The crowd turned.',
    'Some still refused to believe.', 'He made enemies of the board.',
    'INT. OFFICE - DAY', 'He told everyone the truth.', 'The whole room erupted.'].join('\n');
  const r = crowdFlip(text);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

/* 17 英文放行与合并：纯欢呼放行 + 相邻服从行合并 */
run(17, 'en celebration pass and adjacent merge', () => {
  const pass = ['INT. WEDDING - NIGHT', 'The crowd cheered.', 'Everyone applauded.', EISO2].join('\n');
  const r1 = crowdFlip(pass);
  assert.strictEqual(r1.hitCount, 0);
  assert.strictEqual(r1.score, 100);
  const merged = ['INT. HALL - NIGHT', 'He came clean in front of everyone.', 'The crowd turned.', 'One by one they stood.', EISO1].join('\n');
  const r2 = crowdFlip(merged);
  assert.strictEqual(r2.hitCount, 1);
  assert.strictEqual(r2.score, 100);
});

console.log(`\ndone: ${process.exitCode ? 'FAILED' : 'all 17 passed'}`);
