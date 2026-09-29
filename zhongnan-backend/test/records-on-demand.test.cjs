/**
 * records-on-demand 万能档案 单测（块88）
 * 覆盖：空稿 / 前2次豁免 / 第3次命中 / 相邻合并 / 查空放行 / HIT无VERIFY放行 /
 *      rescue查空 / rescue等待 / 跨场景重置 / VERIFY宾语绑定防误报 /
 *      密度病全链路 / 封底 / en 全链路 + rescue + CJK 零
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { recordsOnDemand } = require('../dist/engine/records-on-demand.js');

/* ---------- zh ---------- */

test('ex01 空稿满分', () => {
  const r = recordsOnDemand('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.hits.length, 0);
});

test('ex02 首次一查必中豁免', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示三年前他来过这家医院。',
    '△她把那页纸拍在桌上。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 前两次命中豁免，第3次命中70', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，画面里果然有那辆车。',
    '',
    '内景 书房 夜',
    '△她查了户籍，名单上有这个名字。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].line, 8);
});

test('ex04 相邻2行命中合并为同一次查询', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '△她又调了监控，果然拍到了背影。',
    '',
    '内景 监控室 夜',
    '△他查了底档，上面写着车牌号。',
    '',
    '内景 书房 夜',
    '△她查了户籍，名单上有这个名字。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.score, 70);
});

test('ex05 纯查询无命中词（查空）放行', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，翻了两页就停住。',
    '△管理员在旁边搓着手。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，倒了两遍带。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex06 HIT词单独出现无查询锚放行', () => {
  const d = [
    '内景 客厅 夜',
    '△电视里记录显示着一条旧新闻。',
    '母亲：果然，他早就知道了。',
    '',
    '内景 书房 夜',
    '△她查了户籍，名单上有这个名字。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex07 rescue：第3次命中等了三个工作日', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，画面里果然有那辆车。',
    '',
    '内景 书房 夜',
    '△她查了户籍。',
    '管理员：找到了，名单上有这个名字。',
    '苏黎：为了这份户籍，我等了三个工作日。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex08 rescue：第3次命中但记录早被销毁', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，画面里果然有那辆车。',
    '',
    '内景 书房 夜',
    '△她查了户籍。',
    '管理员：找到了。这些记录能留下来就不错了，其他的记录早被销毁了。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex09 跨场景头重置（场景尾+场景头相邻命中不合并）', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，画面里果然有那辆车。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 100);
});

test('ex10 查询锚宾语绑定：查水表/查作业不触发', () => {
  const d = [
    '内景 楼道 日',
    '△物业上门查水表，查了个遍。',
    '△她坐在桌前查作业，一页页翻着。',
    '△他查了三遍，果然找到了那道错题。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 密度病全链路：4次命中3场景 hits=2 score=50', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，画面里果然有那辆车。',
    '',
    '内景 书房 夜',
    '△她查了户籍，名单上有这个名字。',
    '',
    '内景 医院值班室 晨',
    '△他调出了病历，上面写着那味药。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 4);
  assert.strictEqual(r.hits.length, 2);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex12 封底：6次未救命中 score=20', () => {
  const d = [
    '内景 档案室 日',
    '△她调了档案，记录显示那笔转账。',
    '',
    '内景 监控室 夜',
    '△他调取了监控，画面里果然有那辆车。',
    '',
    '内景 书房 夜',
    '△她查了户籍，名单上有这个名字。',
    '',
    '内景 医院值班室 晨',
    '△他调出了病历，上面写着那味药。',
    '',
    '内景 律所 日',
    '△她翻了卷宗，果然找到了那页遗嘱。',
    '',
    '内景 车库 夜',
    '△他查了通话记录，就是那条号码。',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 6);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

/* ---------- en ---------- */

test('ex13 en 前两次豁免第3次命中', () => {
  const d = [
    'INT. ARCHIVE - DAY',
    'She pulled the records. "Found it. Right here."',
    '',
    'INT. SECURITY ROOM - NIGHT',
    'He checked the footage. "Sure enough, there it is."',
    '',
    'INT. STUDY - NIGHT',
    'She ran her name through the registry. "There\'s a match."',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.score, 70);
});

test('ex14 en 纯查询无命中放行', () => {
  const d = [
    'INT. ARCHIVE - DAY',
    'She pulled the records and flipped through them twice.',
    'He checked the database, then leaned back.',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex15 en rescue：第3次命中等了三天才拿到', () => {
  const d = [
    'INT. ARCHIVE - DAY',
    'She pulled the records. "Found it. Right here."',
    '',
    'INT. SECURITY ROOM - NIGHT',
    'He checked the footage. "Sure enough, there it is."',
    '',
    'INT. STUDY - NIGHT',
    'She ran her name through the registry. "There\'s a match."',
    '"Took three business days to get this page."',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 密度病计分', () => {
  const d = [
    'INT. ARCHIVE - DAY',
    'She pulled the records. "Found it. Right here."',
    '',
    'INT. SECURITY ROOM - NIGHT',
    'He checked the footage. "Sure enough, there it is."',
    '',
    'INT. STUDY - NIGHT',
    'She ran her name through the registry. "There\'s a match."',
    '',
    'INT. HOSPITAL - DAWN',
    'He went through the medical files. "It\'s all there."',
  ].join('\n');
  const r = recordsOnDemand(d);
  assert.strictEqual(r.hitCount, 4);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex17 en 结果零 CJK', () => {
  const d = [
    'INT. ARCHIVE - DAY',
    'She pulled the records. "Found it."',
    '',
    'INT. SECURITY ROOM - NIGHT',
    'He checked the footage. "Sure enough."',
    '',
    'INT. STUDY - NIGHT',
    'She ran her name through the registry. "There\'s a match."',
  ].join('\n');
  const r = recordsOnDemand(d);
  const s = JSON.stringify(r);
  assert.ok(!/[一-鿿]/.test(s), 'en result must contain zero CJK');
});
