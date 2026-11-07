'use strict';
/* v2.464 等级徽章 / 价值奖章 / 套餐角标的前景色对比度守口。
 * 解析真实 web/styles.css 与 web/app.js 的结构不变量（不写魔法像素、不依赖浏览器）：
 *  - 徽章底色必须来自 CSS 类（app.js 不再有内联背景映射，避免「无底色 + 纸白字」不可见）
 *  - 11px 小徽章按正文标准 4.5:1，58px 奖章按大字号标准 3:1
 *  - accent 底的奖章必须跟随 --on-accent（tech/dark 是浅底，纸白只有 2.07/2.32）
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = fs.readFileSync(path.join(ROOT, 'web/app.js'), 'utf8');

const PAPER = '#fbf7ec';
const THEMES = {
  light: "[data-theme='light']",
  dark: "[data-theme='dark']",
  eye: "[data-theme='eye']",
  tech: "[data-theme='tech']",
};

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 取某选择器的全部规则体（同名选择器可能有多条，按出现顺序返回）。 */
function ruleBodies(selector) {
  const re = new RegExp('(?:^|\\})\\s*' + escapeRe(selector) + '\\s*\\{([^}]*)\\}', 'g');
  const out = [];
  let m;
  while ((m = re.exec(CSS))) out.push(m[1]);
  return out;
}

/** 取某选择器某属性的最后一次声明（CSS 后者覆盖前者）。 */
function declOf(selector, prop) {
  const bodies = ruleBodies(selector);
  let value = null;
  for (const body of bodies) {
    for (const part of body.split(';')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      if (part.slice(0, i).trim() !== prop) continue;
      value = part.slice(i + 1).trim();
    }
  }
  return value;
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

const ROOT_VARS = varsOf(':root');

function hexToRgb(hex) {
  if (!hex) return null;
  let h = String(hex).trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
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

/** color-mix(in srgb, C N%, #000) 在 sRGB 伽马空间按通道线性插值，等价于通道 × N/100。 */
function mixBlack(rgb, ratio) {
  return rgb.map((v) => Math.round(v * ratio));
}

/** 把一个 background 值拆成所有可能的底色（渐变端点 / 纯色），支持 hex、var(--x)、color-mix 压黑。 */
function endpointsOf(value, vars) {
  if (!value) return [];
  const out = [];
  const mixRe = /color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*([\d.]+)%\s*,\s*#000\)/g;
  let m;
  while ((m = mixRe.exec(value))) {
    const base = hexToRgb(vars[m[1]]);
    if (base) out.push(mixBlack(base, Number(m[2]) / 100));
  }
  let rest = value.replace(mixRe, ' ');
  rest = rest.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    const rgb = hexToRgb(vars[name]);
    if (rgb) out.push(rgb);
    return ' ';
  });
  const hexRe = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  while ((m = hexRe.exec(rest))) {
    const rgb = hexToRgb(m[0]);
    if (rgb) out.push(rgb);
  }
  return out;
}

/** 最浅的底色决定与浅色文字的最低对比度。 */
function worstContrast(bgValue, vars, fgRgb) {
  const list = endpointsOf(bgValue, vars);
  assert.ok(list.length > 0, '未能从背景值解析出任何颜色：' + bgValue);
  return list.reduce((min, rgb) => Math.min(min, contrast(fgRgb, rgb)), Infinity);
}

const GRADES = ['S', 'A', 'B', 'C', 'NA'];

test('v2.464 等级徽章底色来自 CSS 类，且纸白字 ≥4.5:1（11px 小字号不享受大字号豁免）', () => {
  const paper = hexToRgb(PAPER);
  const base = declOf('.lv-grade', 'color');
  assert.ok(base && /#fbf7ec/i.test(base), '.lv-grade 的文字应为纸白（.lv-grade 实际 color=' + base + '）');
  const offenders = [];
  for (const g of GRADES) {
    const bg = declOf('.lv-grade-' + g, 'background') || declOf('.lv-grade-' + g, 'background-color');
    if (!bg) {
      offenders.push('缺少 .lv-grade-' + g + ' 底色规则');
      continue;
    }
    const ratio = worstContrast(bg, ROOT_VARS, paper);
    if (ratio < 4.5) offenders.push('.lv-grade-' + g + ' 纸白对比度 ' + ratio.toFixed(2) + '（' + bg + '）');
  }
  assert.deepStrictEqual(offenders, [], '等级徽章底色不达标：' + offenders.join('；'));
});

test('v2.464 等级徽章不再靠 JS 内联底色（否则小徽章会变成无底色的纸白字）', () => {
  assert.ok(!/gradeColor/.test(APP), 'app.js 不应再有 gradeColor 内联配色映射');
  const lines = APP.split('\n');
  const bad = [];
  lines.forEach((line, i) => {
    if (!line.includes('lv-grade-sm')) return;
    // 允许「不带 sm 的 .lv-grade」用等级类，但 -sm 徽章必须显式带 gradeCls(...)，否则没有底色
    if (!line.includes('gradeCls(')) bad.push('第 ' + (i + 1) + ' 行：' + line.trim().slice(0, 90));
  });
  assert.deepStrictEqual(bad, [], '以下 lv-grade-sm 徽章没有等级底色类：\n' + bad.join('\n'));
});

test('v2.464 价值奖章：accent 底跟随 --on-accent（≥4.5），金/灰奖章按大字号 ≥3:1', () => {
  const paper = hexToRgb(PAPER);
  const base = declOf('.vc-grade', 'color');
  assert.ok(base && /#fbf7ec/i.test(base), '.vc-grade 的文字应为纸白（实际 color=' + base + '）');

  assert.ok(
    /var\(--on-accent\)/.test(declOf('.vc-g-A', 'color') || ''),
    '.vc-g-A 背景是 --accent 渐变，文字必须用 var(--on-accent)（tech/dark 的 accent 是浅色底）'
  );

  const problems = [];
  for (const [name, selector] of Object.entries(THEMES)) {
    const vars = Object.assign({}, ROOT_VARS, varsOf(selector));
    // A 级：accent 系渐变 + --on-accent
    const onAccent = hexToRgb(vars['--on-accent']);
    if (!onAccent) {
      problems.push(name + '：缺少 --on-accent');
    } else {
      for (const key of ['--accent', '--accent-strong']) {
        const ratio = contrast(onAccent, hexToRgb(vars[key]));
        if (ratio < 4.5) problems.push(name + '：' + key + ' 上的 --on-accent 只有 ' + ratio.toFixed(2));
      }
    }
    // S / B / C / NA：固定深底 + 纸白，按 58px 粗体（大字号）3:1
    for (const cls of ['vc-g-S', 'vc-g-B', 'vc-g-C', 'vc-g-NA']) {
      const bg = declOf('.' + cls, 'background') || declOf('.' + cls, 'background-color');
      if (!bg) {
        problems.push(name + '：缺少 .' + cls + ' 底色');
        continue;
      }
      const ratio = worstContrast(bg, vars, paper);
      if (ratio < 3) problems.push(name + '：.' + cls + ' 纸白对比度 ' + ratio.toFixed(2) + '（' + bg + '）');
    }
  }
  assert.deepStrictEqual(problems, [], '价值奖章前景色不达标：\n' + problems.join('\n'));
});

test('v2.464 套餐赠送角标（金→朱砂渐变）在四套主题下纸白字 ≥4.5:1', () => {
  const paper = hexToRgb(PAPER);
  const bg = declOf('.pack-bonus', 'background') || declOf('.pack-bonus', 'background-color');
  assert.ok(bg, '.pack-bonus 缺少背景声明');
  assert.ok(/#fbf7ec/i.test(declOf('.pack-bonus', 'color') || ''), '.pack-bonus 的文字应为纸白');

  const problems = [];
  for (const [name, selector] of Object.entries(THEMES)) {
    const vars = Object.assign({}, ROOT_VARS, varsOf(selector));
    const ratio = worstContrast(bg, vars, paper);
    if (ratio < 4.5) problems.push(name + '：' + ratio.toFixed(2));
  }
  assert.deepStrictEqual(problems, [], '套餐角标对比度不足：' + problems.join('；'));
});
