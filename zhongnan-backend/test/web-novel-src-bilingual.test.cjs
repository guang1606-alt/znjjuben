/**
 * v2.688 素材库多用户视角：英文界面不再整卡中文、筛选后有结果计数
 * 走查发现：
 *  1. 素材库卡片 desc / adaptNote 只有中文——切到 English 后整张卡片只剩站名和按钮是英文，
 *     中间两段仍是中文，英文用户读不出「这个站能不能改编」。
 *  2. 语言筛选 + 搜索 + 只看公版三者叠加后没有结果计数，用户不知道是「没有匹配」还是「库是空的」。
 * 本文件断言修复形态不被回退（读源码 / HTML 断言，不起服务器）。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
// 剥行注释，避免注释文字误命中
const code = source.replace(/\/\/.*$/gm, '');

function region(startMarker, endMarker) {
  const s = code.indexOf(startMarker);
  assert.ok(s >= 0, `未找到 ${startMarker}`);
  const e = code.indexOf(endMarker, s);
  return e > s ? code.slice(s, e) : code.slice(s, s + 3000);
}

const grid = () => region('function renderNovelGrid', 'function initNovelBench');

test('v2.688 素材卡按界面语言取 desc/adaptNote，英文有对照就不出现中文', () => {
  const w = grid();
  assert.match(w, /descEn/, '卡片应读取英文对照 descEn');
  assert.match(w, /adaptNoteEn/, '卡片应读取英文对照 adaptNoteEn');
  assert.match(w, /lang === 'en' \? \(s\.descEn \|\| s\.desc\) : s\.desc/, '英文优先英文对照，缺失才回退中文原文');
  assert.match(w, /lang === 'en' \? \(s\.adaptNoteEn \|\| s\.adaptNote\) : s\.adaptNote/, '版权说明同样要双语');
});

test('v2.688 英文搜索也能命中英文描述', () => {
  const w = grid();
  assert.match(w, /s\.descEn/, '搜索串应包含 descEn');
  assert.match(w, /s\.adaptNoteEn/, '搜索串应包含 adaptNoteEn');
});

test('v2.688 筛选/搜索后显示结果计数，空态前也给出总数', () => {  assert.match(html, /id="novelCount"/, '素材库应有一个结果计数位');
  assert.match(html, /id="novelCount"[^>]*aria-live="polite"/, '计数位应 aria-live，读屏可感知筛选结果变化');
  const w = grid();
  const countPos = w.indexOf("$('novelCount')");
  const emptyPos = w.indexOf('if (!list.length)');
  assert.ok(countPos > 0, '渲染时应写入计数');
  assert.ok(countPos < emptyPos, '计数必须在空态判断之前写入（空态时也要说明库里有几条）');
  assert.match(w, /已收录 \$\{novelAll\.length\} 个来源 · 当前显示 \$\{list\.length\} 个/, '中文计数文案');
  assert.match(w, /sources collected · \$\{list\.length\} shown/, '英文计数文案');
});

test('v2.688 英文界面的语种名与筛选条也走英文，不再混入中文', () => {  const w = grid();
  assert.match(code, /const NOVEL_LANG_LABEL_EN = \{ zh: 'Chinese'/, '必须有英文语种名表');
  assert.match(code, /const novelLangLabel = \(l\) => \(lang === 'en' \? NOVEL_LANG_LABEL_EN\[l\] : NOVEL_LANG_LABEL\[l\]\)/, '语种名按界面语言取值');
  assert.match(w, /s\.langs\.filter\(\(x\) => x !== 'multi'\)\.map\(\(x\) => novelLangLabel\(x\)\)/, '卡片语种行必须用双语取值');
  const row = region('function renderNovelLangRow', 'function renderNovelGrid');
  assert.match(row, /novelLangLabel\(l\)/, '语言筛选条也必须用双语取值');
  assert.doesNotMatch(row, /NOVEL_LANG_LABEL\[l\] \|\| l/, '不能再直接用中文表');
});

test('v2.688 站名也双语：英文卡头不再出现「Project Gutenberg 古登堡计划」', () => {
  const w = grid();
  assert.match(w, /const name = lang === 'en' \? \(s\.nameEn \|\| s\.name\) : s\.name;/, '站名按界面语言取值，缺失才回退');
  assert.match(w, /<b>\$\{escapeHtml\(name\)\}<\/b>/, '卡头必须用双语站名');
  assert.match(w, /\[s\.name, s\.nameEn,/, '英文搜索也要能命中英文站名');
});


