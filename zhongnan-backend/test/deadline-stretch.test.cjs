'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { deadlineStretch } = require('../dist/engine/deadline-stretch.js');

/* ============ 中文 ============ */

test('zh: 空稿/空白稿满分', () => {
  assert.strictEqual(deadlineStretch('').score, 100);
  assert.strictEqual(deadlineStretch('  \n ').score, 100);
  assert.strictEqual(deadlineStretch('').hitCount, 0);
});

test('zh: 单次倒计时豁免不扣分', () => {
  const draft = [
    '内景 茶馆包间 日',
    '王老板：限你三天之内还清，还不上就收房子！',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.issues.length, 0);
});

test('zh: 第2次假倒计时命中 → 70，line 落期限锚点行', () => {
  const draft = [
    '内景 茶馆包间 日',
    '王老板：限你三天之内还清，还不上就收房子！',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着一张旧海报。',
    '内景 废弃仓库 夜',
    '刀哥：天亮之前找不到女儿，就撕票！',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 6);
  assert.ok(r.hits[0].snippet.includes('刀哥'));
  assert.strictEqual(r.score, 70);
});

test('zh: 三次假倒计时 n=2 → 50（收房/撕票/停药）', () => {
  const draft = [
    '内景 茶馆包间 日',
    '王老板：限你三天之内还清，还不上就收房子！',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着一张旧海报。',
    '内景 废弃仓库 夜',
    '刀哥：天亮之前找不到女儿，就撕票！',
    '△走廊尽头的灯牌忽明忽暗。',
    '△墙角堆着生锈的铁桶。',
    '内景 医院走廊 日',
    '院长：手术费二十四小时之内交齐，交不出就停药。',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
  assert.ok(r.issues[0].includes('假倒计时'));
  assert.ok(r.advice[0].includes('宽限'));
});

test('zh: 相邻 ≤2 行期限表述合并为同一事件', () => {
  const draft = [
    '内景 林家客厅 夜',
    '大嫂：只剩三天了！',
    '△她把日历狠狠拍在桌上。',
    '大嫂：三天之内还不上钱，就离婚！',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 跨场景头的期限行不合并（场景2判为第2次命中）', () => {
  const draft = [
    '内景 林家客厅 夜',
    '大嫂：只剩三天，还不上就离婚！',
    '内景 行驶的轿车 夜',
    '大哥：天亮之前赶不到码头，就没命！',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits.length, 1);
  assert.strictEqual(r.hits[0].line, 4);
  assert.strictEqual(r.score, 70);
});

test('zh: rescue A 赶时间——时钟压出行为变形，两次均放行', () => {
  const draft = [
    '内景 医院走廊 日',
    '医生：手术费二十四小时之内必须交齐，交不出就停药。',
    '△他转身就往银行跑，连夜找遍所有亲戚凑钱。',
    '△走廊尽头的灯牌忽明忽暗。',
    '△墙上的挂钟停在三点。',
    '内景 码头 夜',
    '绑匪：午夜之前凑不齐赎金，她就没命！',
    '△阿正猛踩油门，一路狂奔冲上码头，踩着点把钱箱扔了过去。',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits.length, 1); /* 首次豁免不入 hits，第 2 次在 hits 且 rescued */
  assert.ok(r.hits.every((h) => h.rescued === true));
  assert.strictEqual(r.score, 100);
});

test('zh: rescue B 兑付——惩罚真收账/宽限是跪求谈妥来的，两次均放行', () => {
  const draft = [
    '内景 出租屋 日',
    '房东：限你三天之内搬出去，不然就查封房子！',
    '△三天后期限到了，法警真的封了门，他被扫地出门。',
    '△楼下的早餐铺冒着热气。',
    '△电线杆上贴着招租启事。',
    '内景 工地 日',
    '工头：日落之前赶不到工地，工钱一分不给！',
    '△小陈跪求宽限，谈妥延期三天——那是他替老母亲苦求来的改期。',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯日程陈述（有期限无后果）放行', () => {
  const draft = [
    '内景 书房 日',
    '△三天之内，他把三年的账目一笔一笔核对完毕。',
    '△婚礼以前，她一个人试穿了七次礼服。',
    '△窗外的梧桐叶落了一地。',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 纯狠话（有后果无期限）放行——归 emptyThreat 域', () => {
  const draft = [
    '内景 警局 日',
    '老张：找不到那笔钱，他就报警！',
    '陈队：凑不齐人手也得把人盯住！',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 期限与后果相距 >2 行不配对', () => {
  const draft = [
    '内景 办公室 夜',
    '经理：我给你最后期限。',
    '△窗外飘起小雨。',
    '△桌上的咖啡凉透了。',
    '△他在走廊里站了很久。',
    '职员：交不出方案就开除我是吧？',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 场景头中的"倒计时"不参与匹配', () => {
  const draft = [
    '内景 倒计时演播大厅 日',
    '主持人：欢迎来到今晚的直播节目。',
    '△观众席爆发出潮水般的掌声。',
    '△舞台中央的升降台缓缓合拢。',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('zh: 元数据（sceneIndex/sceneHeader/marker/snippet/reason）', () => {
  const draft = [
    '内景 茶馆包间 日',
    '王老板：限你三天之内还清，还不上就收房子！',
    '△走廊里灯管嗡嗡响。',
    '△墙上贴着一张旧海报。',
    '内景 废弃仓库 夜',
    '刀哥：天亮之前找不到女儿，就撕票！',
  ].join('\n');
  const h = deadlineStretch(draft).hits[0];
  assert.strictEqual(h.sceneIndex, 1);
  assert.ok(h.sceneHeader.includes('仓库'));
  assert.ok(h.marker.includes('天亮'));
  assert.ok(h.snippet.includes('刀哥'));
  assert.strictEqual(h.rescued, false);
  assert.ok(typeof h.reason === 'string' && h.reason.length > 10);
});

/* ============ English ============ */

test('en: two fake deadlines, 2nd unrescued → 70, line on limit line', () => {
  const draft = [
    'INT. TEAHOUSE - DAY',
    'BOSS: You have 72 hours to pay, or we foreclose.',
    'The fluorescent light hums overhead.',
    'A faded poster peels on the wall.',
    'INT. WAREHOUSE - NIGHT',
    "KIDDER: Before sunrise, if you can't find her, she dies.",
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.hits[0].line, 6);
  assert.ok(/before sunrise/i.test(r.hits[0].marker));
  assert.strictEqual(r.hits[0].rescued, false);
  assert.strictEqual(r.score, 70);
});

test('en: rescue A racing — both deadlines honored with on-screen rush → 100', () => {
  const draft = [
    'INT. HOSPITAL WARD - DAY',
    'DOCTOR: You have 24 hours to pay, or he dies.',
    'He sprinted through the night and paid it with seconds to spare.',
    'The ward light flickers once.',
    'A wheelchair stands empty by the wall.',
    'INT. DOCKS - NIGHT',
    "KIDDER: You have until midnight, or she dies.",
    'Ah Zheng floored it, ran every red light, and skidded in with seconds to spare.',
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.ok(r.hits.every((h) => h.rescued === true));
  assert.strictEqual(r.score, 100);
});

test('en: reason/issues/advice carry zero CJK characters', () => {
  const draft = [
    'INT. OFFICE - DAY',
    'MANAGER: You have 48 hours, or the client tears up the contract.',
    'Rain streaks the glass behind him.',
    'A coffee cup goes cold on the desk.',
    'INT. RECORDING STUDIO - NIGHT',
    "PRODUCER: Before the wedding, if you can't deliver the script, she calls off the wedding.",
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.score, 70);
  const cjk = /[一-鿿]/;
  assert.ok(!cjk.test(r.hits[0].reason));
  assert.ok(!cjk.test(r.issues[0]));
  assert.ok(!cjk.test(r.advice[0]));
});

test('en: rescue B honored — forfeit collected / extension negotiated → 100', () => {
  const draft = [
    'INT. TENEMENT APARTMENT - DAY',
    'LANDLORD: You have 3 days to pay, or we foreclose.',
    'The deadline passed; the bank foreclosed and threw him out.',
    'A siren wails somewhere down the block.',
    'Newspapers pile against the doorframe.',
    'INT. CONSTRUCTION SITE - DAWN',
    'FOREMAN: You have until sunrise to finish, or else.',
    "He negotiated an extension - a hard-won grace period for his mother's surgery.",
  ].join('\n');
  const r = deadlineStretch(draft);
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.score, 100);
});
