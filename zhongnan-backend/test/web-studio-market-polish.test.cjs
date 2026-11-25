'use strict';
/* v2.694 走查修复的守口：
 * ① 免费档创作页只写「越高阶越强」，用户看不出自己到底能用几个模式——改按账号档位回填「可用 x/y」；
 * ② 剧本交易卡在卖家未设昵称时渲染「卖家：—」，像取数失败——改为只渲染已知事实，并去掉价值指数的破折号；
 * ③ 390px 下空态在骨架占位高度里垂直居中，文字被推到首屏之外（整页看着像坏了）——窄屏改顶部对齐；
 * ④ 390px 下「上架我的剧本 / 我的交易」两个整行按钮把列表压到第二屏——窄屏并排成一对。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');
const I18N = require(path.join(ROOT, 'web/i18n.js'));

/** 截取一个函数的函数体（从 `function 名字` 到下一个顶层 `  }` 行）。 */
function fnBody(name) {
  const start = APP.indexOf('function ' + name + '(');
  assert.ok(start >= 0, '未找到 function ' + name);
  const end = APP.indexOf('\n  }', start);
  assert.ok(end > start, '未找到 function ' + name + ' 的结尾');
  return APP.slice(start, end + 4);
}

test('v2.694 模式可用度按档位计算：免费 2/9、专业 9/9', () => {
  const src = fnBody('modeAvailability');
  const ctx = { I18N, _RANK: { free: 0, basic: 1, advanced: 2, pro: 3, paid: 3 } };
  const fn = vm.runInNewContext(src + '\n; modeAvailability;', ctx);
  const free = fn(0);
  assert.equal(free.total, 9, '模式总数应与 I18N.MODES 一致');
  assert.equal(free.available, 2, '免费档可用：自动匹配 + 标签创建');
  assert.equal(free.locked, 7);
  const advanced = fn(2);
  assert.equal(advanced.available, 8);
  const pro = fn(3);
  assert.equal(pro.locked, 0);
  assert.equal(pro.available, pro.total);
});

test('v2.694 创作页提示按可用度回填，专业档仍用原文案', () => {
  const body = fnBody('renderModes');
  assert.match(body, /modeAvailability\(/, '提示必须由 modeAvailability 计算');
  assert.match(body, /modeTipAvail/, '有锁定项时须换成带可用数量的文案');
  assert.match(body, /#view-studio > \.section-title small/, '须回填创作页标题下的小字');
  assert.match(body, /:\s*t\('modeTip'\)/, '无锁定项时仍回落原文案');
});

test('v2.694 双语的可用度文案齐全且带占位符', () => {
  for (const l of ['zh', 'en']) {
    const s = I18N.DICT[l].modeTipAvail;
    assert.equal(typeof s, 'string', l + ' 缺少 modeTipAvail');
    assert.ok(s.includes('{a}') && s.includes('{b}'), l + ' 文案须含 {a}/{b} 占位符');
  }
});

test('v2.694 集市卡片与详情不再渲染空卖家/空指数的破折号', () => {
  const list = fnBody('loadListings');
  assert.ok(!/seller[^;]*\|\|\s*'—'/.test(list), '橱窗卡不得用 — 充数卖家名');
  assert.match(list, /l\.seller && l\.seller\.nickname/, '橱窗卡须先判断卖家昵称是否存在');
  assert.match(list, /:\s*t\('anonSeller'\)/, '无昵称时须回落到匿名称谓，不能留空或破折号');
  const board = fnBody('loadBoard');
  assert.match(board, /sellerNickname \|\|/, '榜单卡须保留 sellerNickname 优先');
  assert.match(board, /sellerLine/, '榜单卡须组装卖家行');
  assert.match(board, /:\s*t\('anonSeller'\)/, '榜单卡同样回落到匿名称谓');
  assert.ok(!/sellerNickname[^;]*\|\|\s*'—'/.test(board), '榜单卡不得用 — 充数卖家名');
  const detail = fnBody('openListingDetail');
  assert.match(detail, /metaParts/, '详情元信息须按已知事实组装');
  assert.ok(!/idx != null \? idx : '—'/.test(detail), '详情不得把缺失的价值指数写成 —');
  for (const l of ['zh', 'en']) {
    assert.ok(typeof I18N.DICT[l].anonSeller === 'string' && I18N.DICT[l].anonSeller.trim(), l + ' 缺少 anonSeller');
  }
});

test('v2.694 窄屏空态顶部对齐，桌面仍垂直居中', () => {
  const base = /\.zn-empty-reserve\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(base && /align-items\s*:\s*center/.test(base[1]), '桌面端空态保持垂直居中');
  const at = CSS.lastIndexOf('@media (max-width: 560px)');
  assert.ok(at >= 0, 'styles.css 缺少 560px 断点');
  const seg = CSS.slice(at, at + 400);
  assert.match(seg, /\.zn-empty-reserve\s*\{[^}]*align-items\s*:\s*flex-start/, '窄屏空态须顶部对齐，避免文字被推到首屏外');
});

test('v2.694 窄屏集市两个入口并排而非各占一整行', () => {
  assert.match(CSS, /#view-market > \.section-title\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/, '窄屏集市标题区须为两列');
  assert.match(CSS, /#mkListBtn[^{]*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*4/, '上架按钮占左列');
  assert.match(CSS, /#mkMineBtn[^{]*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*4/, '我的交易按钮占右列');
  assert.match(CSS, /#mkSort[^{]*\{[^}]*grid-column:\s*1\s*\/\s*-1/, '排序下拉须横跨两列');
});

test('v2.694 窄屏创作页标题可换行，不再被视口硬切', () => {
  assert.ok(!/#view-studio > \.section-title h2\s*\{[^}]*white-space:\s*nowrap/.test(CSS), '窄屏标题不得强制不换行（中文会被切掉且无省略号）');
  assert.match(CSS, /#view-studio > \.section-title h2\s*\{[^}]*white-space:\s*normal[^}]*line-height:\s*1\.32/, '窄屏标题须换行并有紧凑行高');
  assert.match(CSS, /#view-studio > \.section-title \.eyebrow\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/, '窄屏眉标须独占一行，不与标题抢列宽');
});
