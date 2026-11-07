'use strict';
/* v2.466 内联硬编码前景色收归语义令牌的守口。
 * 背景：错误/警告/成功/信息/金棕五类提示色过去写死在 app.js 内联样式里，
 * 深紫 #4527a0 在 tech 主题只有 1.73:1、棕 #5d4037 只有 1.90:1（正文小字需 4.5），
 * 视觉上等于「这行字消失了」。本测试锁住「颜色只有一个来源（主题令牌）」。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');

const THEMES = {
  light: "[data-theme='light']",
  dark: "[data-theme='dark']",
  eye: "[data-theme='eye']",
  tech: "[data-theme='tech']",
};
const TOKENS = ['--danger-text', '--warn-text', '--ok-text', '--info-text', '--gold-text'];

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

function declOf(selector, prop, vars) {
  let value = null;
  for (const body of ruleBodies(selector)) {
    for (const part of body.split(';')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      if (part.slice(0, i).trim() !== prop) continue;
      value = part.slice(i + 1).trim();
    }
  }
  if (value && vars) value = value.replace(/var\((--[\w-]+)\)/g, (_, n) => vars[n] || '');
  return value;
}

const ROOT_VARS = varsOf(':root');

function hexToRgb(hex) {
  if (!hex) return null;
  let h = String(hex).trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** 把主题色值（hex 或 rgba，rgba 按 alpha 叠到主题 bg 上）解析为实色。 */
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

test('v2.466 五个语义前景令牌在四主题都定义，且对 bg / panel 均 ≥4.5:1', () => {
  for (const [theme, sel] of Object.entries(THEMES)) {
    const vars = { ...ROOT_VARS, ...varsOf(sel) };
    const bg = solidOf(vars['--bg'], null);
    assert.ok(bg, theme + ' 缺少 --bg');
    const panel = solidOf(vars['--panel'], bg);
    assert.ok(panel, theme + ' 缺少 --panel');
    for (const token of TOKENS) {
      const raw = vars[token];
      assert.ok(raw, theme + ' 未定义 ' + token + '（会落到别的主题的色值上）');
      const fg = solidOf(raw, null);
      assert.ok(fg, theme + ' 的 ' + token + ' 无法解析：' + raw);
      const cBg = contrast(fg, bg);
      const cPanel = contrast(fg, panel);
      assert.ok(cBg >= 4.5, `${theme} ${token} 对 --bg 仅 ${cBg.toFixed(2)}:1（需 4.5）`);
      assert.ok(cPanel >= 4.5, `${theme} ${token} 对 --panel 仅 ${cPanel.toFixed(2)}:1（需 4.5）`);
    }
  }
});

test('v2.466 五类提示色不得再以内联硬编码出现在 app.js，必须走主题令牌', () => {
  const banned = ['c0392b', 'c62828', 'b05a00', 'ef6c00', '2e6512', '4527a0', '5d4037', '00695c', '6a1b9a', 'b07a2e', 'd9a23b', '8a6d3b', 'e65100', 'f57f17'];
  const hits = [];
  for (const hex of banned) {
    const re = new RegExp('(?:^|[;"\'\\s])color:\\s*#' + hex + '\\b', 'i');
    const line = APP.split('\n').findIndex((l) => re.test(l));
    if (line >= 0) hits.push(`#${hex} @ app.js:${line + 1}`);
  }
  assert.deepEqual(hits, [], '仍在内联写死前景色：' + hits.join('、'));
  for (const token of TOKENS) {
    assert.ok(APP.includes('var(' + token + ')'), 'app.js 未使用 ' + token + '（改完应至少有一处消费）');
  }
});

test('v2.466 供应商余额徽章按档位取类，前景/背景自身配对 ≥4.5:1', () => {
  const levels = ['normal', 'low', 'critical', 'unknown'];
  for (const lv of levels) {
    const sel = '.bal-badge.bal-' + lv;
    const bgRaw = declOf(sel, 'background', ROOT_VARS) || declOf(sel, 'background-color', ROOT_VARS);
    const fgRaw = declOf(sel, 'color', ROOT_VARS);
    assert.ok(bgRaw, sel + ' 缺 background');
    assert.ok(fgRaw, sel + ' 缺 color');
    const bg = solidOf(bgRaw, null);
    const fg = solidOf(fgRaw, null);
    const c = contrast(fg, bg);
    assert.ok(c >= 4.5, `${sel} 前景/背景仅 ${c.toFixed(2)}:1（11px 小徽章需 4.5）`);
  }
  assert.ok(!/BAL_COLOR/.test(APP), 'app.js 不应再有 BAL_COLOR 内联底色映射（底色归 CSS 类）');
  assert.ok(/bal-\$\{[^}]*toLowerCase\(\)[^}]*\}/.test(APP), 'balBadge 必须输出档位类名');
});
