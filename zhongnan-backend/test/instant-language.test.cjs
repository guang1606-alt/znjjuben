/**
 * instant-language 单测（块100）：语言秒精通/零成本语言习得检测
 * 覆盖：空稿、首次豁免、密度计分、相邻合并、跨场景头、
 *       来路/学习过程双 rescue、双锚缺一放行、距离超窗、
 *       en 全链路、en rescue、en 零 CJK、zh 元数据。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { instantLanguage } = require('../dist/engine/instant-language.js');

test('ex01 空稿满分', () => {
  const r = instantLanguage('');
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.unrescuedCount, 0);
});

test('ex02 首次豁免：一次时间跨度内的自学不进 hits', () => {
  const r = instantLanguage([
    '△陈锐站在里昂街头，一句法语都听不懂。',
    '△他比手画脚，店主一脸茫然。',
    '△当晚，他用流利的法语和房东砍价。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.hits.length, 0);
  assert.strictEqual(r.score, 100);
});

test('ex03 两次未救：n=1 → 70', () => {
  const r = instantLanguage([
    '△陈锐站在里昂街头，一句法语都听不懂。',
    '△他比手画脚，店主一脸茫然。',
    '△当晚，他用流利的法语和房东砍价。',
    '△第二天清晨，面包店的招牌换了新字。',
    '△他又听不懂招牌上的单词。',
    '△店员笑而不语。',
    '△他又用地道的法语点菜。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex04 相邻≤2行流利行合并为同一事件', () => {
  const r = instantLanguage([
    '△他一句法语都听不懂。',
    '△他用流利的法语点菜。',
    '△旁边的游客投来目光。',
    '△他又用地道的法语砍价。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 1);
  assert.strictEqual(r.score, 100);
});

test('ex05 跨场景头不合并：两段各算一事件', () => {
  const r = instantLanguage([
    '△她一句粤语都听不懂。',
    '△三天后，她用粤语和房东砍价。',
    '内景 弄堂 日',
    '△他还是一句沪语都听不懂。',
    '△转眼他张口就是地道沪语。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].sceneIndex, 0);
  assert.ok(r.hits[0].sceneHeader.includes('弄堂'));
});

test('ex06 来路锚 rescue：留法学生住了四年', () => {
  const r = instantLanguage([
    '△陈锐站在里昂街头，一句法语都听不懂。',
    '△他比手画脚，店主一脸茫然。',
    '△当晚，他用流利的法语和房东砍价。',
    '△第二天清晨，面包店的招牌换了新字。',
    '△他又听不懂招牌上的单词。',
    '△她是留法学生，在里昂住了四年。',
    '△他又用地道的法语点菜。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex07 学习过程锚 rescue：跟着电视学', () => {
  const r = instantLanguage([
    '△陈锐站在里昂街头，一句法语都听不懂。',
    '△他比手画脚，店主一脸茫然。',
    '△当晚，他用流利的法语和房东砍价。',
    '△第二天清晨，面包店的招牌换了新字。',
    '△他又听不懂招牌上的单词。',
    '△这半年她一直跟着电视学，笔记记满了两本。',
    '△他又用地道的法语点菜。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex08 纯障碍无流利放行（困境本身是戏）', () => {
  const r = instantLanguage([
    '△他一句法语都听不懂。',
    '△他比手画脚，店主一脸茫然。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex09 纯流利人设传说无障碍突变放行', () => {
  const r = instantLanguage([
    '老张：她是外语系毕业，一口流利的法语。',
    '△老张啧啧称赞。',
    '△众人点头。',
    '△老张又说：可惜这些年用不上。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex10 距离超窗：障碍与流利隔4行不配对', () => {
  const r = instantLanguage([
    '△他一句法语都听不懂。',
    '△他比手画脚。',
    '△店主摇头。',
    '△他垂头丧气。',
    '△人群散去。',
    '△三天后，他用流利的法语砍价。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex11 三次未救：n=2 → 50', () => {
  const r = instantLanguage([
    '△他一句法语都听不懂。',
    '△他比手画脚。',
    '△当晚，他用流利的法语和房东砍价。',
    '△次日他又听不懂菜单。',
    '△店员皱眉。',
    '△他用流利的法语点菜。',
    '△一周后他又听不懂广播。',
    '△他站在站台发懵。',
    '△他用流利的法语问路。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 3);
  assert.strictEqual(r.unrescuedCount, 2);
  assert.strictEqual(r.score, 50);
});

test('ex12 五次未救：n=4 → 封底 20', () => {
  const r = instantLanguage([
    '△他一句法语都听不懂。',
    '△他比手画脚。',
    '△当晚，他用流利的法语和房东砍价。',
    '△次日他又听不懂菜单。',
    '△店员皱眉。',
    '△他用流利的法语点菜。',
    '△第三天他又听不懂广播。',
    '△他站在站台发懵。',
    '△他用流利的法语问路。',
    '△第四天他又听不懂电话。',
    '△他愣在原地。',
    '△他用流利的法语解释。',
    '△第五天他又听不懂口音。',
    '△他挠了挠头。',
    '△他用流利的法语谈判。',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 5);
  assert.strictEqual(r.unrescuedCount, 4);
  assert.strictEqual(r.score, 20);
});

test('ex13 en 全链路：两事件 n=1 → 70', () => {
  const r = instantLanguage([
    'Maya stands in Lyon; she can\'t understand a word of French.',
    'She gestures wildly; the shopkeeper frowns.',
    'That night she speaks fluent French with the landlord.',
    'The next morning the menu looks strange again.',
    'She can\'t understand a word of it.',
    'She walks in anyway.',
    'She speaks flawless French to order.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 1);
  assert.strictEqual(r.score, 70);
  assert.strictEqual(r.hits[0].rescued, false);
});

test('ex14 en 来路锚 rescue：exchange student', () => {
  const r = instantLanguage([
    'Maya stands in Lyon; she can\'t understand a word of French.',
    'She gestures wildly; the shopkeeper frowns.',
    'That night she speaks fluent French with the landlord.',
    'The next morning the menu looks strange again.',
    'She can\'t understand a word of it.',
    'A former exchange student, she has lived there for four years.',
    'She speaks flawless French to order.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 2);
  assert.strictEqual(r.unrescuedCount, 0);
  assert.strictEqual(r.hits[0].rescued, true);
  assert.strictEqual(r.score, 100);
});

test('ex15 en 纯障碍无流利放行', () => {
  const r = instantLanguage([
    'Maya can\'t understand a word of French.',
    'She gestures wildly at the menu.',
  ].join('\n'));
  assert.strictEqual(r.hitCount, 0);
  assert.strictEqual(r.score, 100);
});

test('ex16 en 层零中文：issues/advice/reason 无 CJK', () => {
  const r = instantLanguage([
    'Maya stands in Lyon; she can\'t understand a word of French.',
    'She gestures wildly; the shopkeeper frowns.',
    'That night she speaks fluent French with the landlord.',
    'The next morning the menu looks strange again.',
    'She can\'t understand a word of it.',
    'She walks in anyway.',
    'She speaks flawless French to order.',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.issues[0] || ''));
  assert.ok(r.advice.length >= 1);
  assert.ok(!/[\u4e00-\u9fff]/.test(r.advice[0] || ''));
  assert.ok(!/[\u4e00-\u9fff]/.test(r.hits[0].reason || ''));
});

test('ex17 zh 元数据：issues/advice/reason 中文', () => {
  const r = instantLanguage([
    '△陈锐站在里昂街头，一句法语都听不懂。',
    '△他比手画脚，店主一脸茫然。',
    '△当晚，他用流利的法语和房东砍价。',
    '△第二天清晨，面包店的招牌换了新字。',
    '△他又听不懂招牌上的单词。',
    '△店员笑而不语。',
    '△他又用地道的法语点菜。',
  ].join('\n'));
  assert.ok(r.issues.length >= 1);
  assert.ok(r.issues[0].includes('语言秒精通'));
  assert.ok(r.advice[0].includes('语言'));
  assert.ok(r.hits[0].reason.includes('零学费'));
});
