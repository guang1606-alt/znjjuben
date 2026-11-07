'use strict';
/* v2.467 质检四档色（优/中/警/差）收归主题令牌的守口。
 * 背景：diagColor() 的四个硬编码色既当进度条填充（图形，需 3:1），
 * 又当 .diag-v / 总分数字的文字色（小字，需 4.5:1）。实测 light/eye 主题下
 * good 2.46/2.27、mid 2.50/2.31、warn 2.14/1.98、bad 3.15/2.92——文字与图形同时不达标；
 * branch-view.js 的严重度文字 #d98a16 在 light 只有 2.65:1。
 * 本测试锁住「四档色只从主题令牌取，且四主题两套底（panel / panel-2）都 ≥4.5:1」。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');
const BRANCH = fs.readFileSync(path.join(ROOT, 'web/branch-view.js'), 'utf8');

const THEMES = {
  light: "[data-theme='light']",
  dark: "[data-theme='dark']",
  eye: "[data-theme='eye']",
  tech: "[data-theme='tech']",
};
const TOKENS = ['--grade-good', '--grade-mid', '--grade-warn', '--grade-bad'];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruleBodies(selector) {
  const re = new RegExp('(?:^|\\})\\s*' + escapeRe(selector) + '\\s*\\{([^}]*)\\}', 'g');
  const out = [];
  let m;
  while ((m = re.exec(CSS))) out.push(m[1]);
  return out;
}

function varsOf(selector) {
  const out = {};
  for (const body of ruleBodies(selector)) {
    for (const part of body.split(';')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      const k = part.slice(0, i).trim();
      if (k.startsWith('--')) out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

function hexToRgb(hex) {
  if (!hex) return null;
  let h = String(hex).trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** 把主题色值（hex 或 rgba，rgba 按 alpha 叠到底色上）解析为实色。 */
function solidOf(value, baseRgb) {
  if (!value) return null;
  const hex = hexToRgb(value);
  if (hex) return hex;
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(value);
  if (!m) return null;
  const fg = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (!baseRgb || a >= 1) return fg;
  return fg.map((v, i) => Math.round(v * a + baseRgb[i] * (1 - a)));
}

function lum(rgb) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

function contrast(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const ROOT_VARS = varsOf(':root');

test('v2.467 四档质检色在四主题都定义，且对 panel / panel-2 均 ≥4.5:1', () => {
  for (const [theme, sel] of Object.entries(THEMES)) {
    const vars = { ...ROOT_VARS, ...varsOf(sel) };
    const bg = solidOf(vars['--bg'], null);
    assert.ok(bg, theme + ' 缺少 --bg');
    const panel = solidOf(vars['--panel'], bg);
    assert.ok(panel, theme + ' 缺少 --panel');
    const panel2 = solidOf(vars['--panel-2'], bg);
    assert.ok(panel2, theme + ' 缺少 --panel-2');
    for (const token of TOKENS) {
      const raw = vars[token];
      assert.ok(raw, theme + ' 未定义 ' + token + '（会串到别的主题色值上）');
      const fg = solidOf(raw, null);
      assert.ok(fg, theme + ' 的 ' + token + ' 无法解析：' + raw);
      const cPanel = contrast(fg, panel);
      const cPanel2 = contrast(fg, panel2);
      assert.ok(cPanel >= 4.5, `${theme} ${token} 对 --panel 仅 ${cPanel.toFixed(2)}:1（文字需 4.5，图形需 3）`);
      assert.ok(cPanel2 >= 4.5, `${theme} ${token} 对 --panel-2 仅 ${cPanel2.toFixed(2)}:1（文字需 4.5，图形需 3）`);
    }
  }
});

test('v2.467 四档色旧实现不得再硬编码，必须走主题令牌', () => {
  const banned = ['3fb67a', '7c9cff', 'e0a23a', 'e06a5b'];
  // branch-view.js 的旧严重度三色同样收归（app.js 里 var(--danger,#d4473b) 是令牌兜底，不算写死）
  const bannedBranch = ['d4473b', 'd98a16', '7a8790'];
  const hits = [];
  const scan = (file, src, list) => {
    for (const hex of list) {
      const re = new RegExp('#' + hex + '\\b', 'i');
      const line = src.split('\n').findIndex((l) => re.test(l));
      if (line >= 0) hits.push(`#${hex} @ ${file}:${line + 1}`);
    }
  };
  scan('app.js', APP, banned);
  scan('branch-view.js', BRANCH, banned.concat(bannedBranch));
  assert.deepEqual(hits, [], '仍写死四档色：' + hits.join('、'));
});

test('v2.467 诊断条填充、波形点、图例、分支严重度都消费 --grade-* 令牌', () => {
  for (const token of TOKENS) {
    assert.ok(APP.includes('var(' + token + ')'), 'app.js 未消费 ' + token);
  }
  // diagColor 必须是「返回令牌」而不是「返回色值」
  const m = /function diagColor\([^)]*\)\s*\{([^}]*)\}/.exec(APP);
  assert.ok(m, 'app.js 未找到 diagColor()');
  assert.match(m[1], /var\(--grade-good\)/, 'diagColor 高档未返回 --grade-good');
  assert.match(m[1], /var\(--grade-bad\)/, 'diagColor 低档未返回 --grade-bad');
  // 波形圆点 fill 与图例色块 background 都不能是裸色值
  assert.match(APP, /fill="\$\{[^}]*var\(--grade-/, '波形圆点 fill 未走令牌');
  assert.match(APP, /<i style="background:(?:\$\{)?[^>]*var\(--grade-/, '波形图例色块未走令牌');
  // 分支校验的严重度文字（高/中）同样不能写死
  assert.match(BRANCH, /var\(--grade-bad\)/, 'branch-view.js 高危未走 --grade-bad');
  assert.match(BRANCH, /var\(--grade-warn\)/, 'branch-view.js 中危未走 --grade-warn');
});

test('v2.467 波形圆点悬停描边不得写死白色（浅色主题下会看不见）', () => {
  assert.doesNotMatch(CSS, /\.wave-dot:hover\s*\{[^}]*stroke:\s*#fff/i, '悬停描边仍写死 #fff');
});
