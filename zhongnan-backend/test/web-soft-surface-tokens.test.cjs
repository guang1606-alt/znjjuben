'use strict';
/* v2.468 浅底软色收归主题令牌的守口。
 * 背景：提示条 / 联系方式徽章 / 角色徽章 / 按钮底过去写死 #fff8e1、#e8f5e9、#fff3e0 这类浅底，
 * 在 dark / tech 主题里成了「暗界面里一块亮斑」（对 --panel 对比 14.8:1），
 * 虽然内部文字可读，但整块与界面割裂。本测试锁住「软底跟随主题明暗，且只做轻微抬升」。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'web', f), 'utf8');
const CSS = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const APP = read('app.js');
const ROOM = read('room-view.js');

const THEMES = {
  light: "[data-theme='light']",
  dark: "[data-theme='dark']",
  eye: "[data-theme='eye']",
  tech: "[data-theme='tech']",
};
const SOFT = ['--soft-ok', '--soft-warn', '--soft-info', '--surface-raised'];

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

test('v2.468 四类软底令牌在四主题都定义，且只比 panel 轻微抬升（1.02~2.0:1）', () => {
  for (const [theme, sel] of Object.entries(THEMES)) {
    const vars = { ...ROOT_VARS, ...varsOf(sel) };
    const bg = solidOf(vars['--bg'], null);
    const panel = solidOf(vars['--panel'], bg);
    assert.ok(panel, theme + ' 缺少 --panel');
    for (const token of SOFT) {
      const raw = vars[token];
      assert.ok(raw, theme + ' 未定义 ' + token);
      const c = solidOf(raw, null);
      assert.ok(c, theme + ' 的 ' + token + ' 无法解析：' + raw);
      const ratio = contrast(c, panel);
      assert.ok(ratio >= 1.02, `${theme} ${token} 与 --panel 几乎同色（${ratio.toFixed(2)}:1），容器会看不见`);
      assert.ok(ratio <= 2.0, `${theme} ${token} 与 --panel 反差 ${ratio.toFixed(2)}:1，暗主题下就是一块亮斑`);
    }
  }
});

test('v2.468 软底上的文字仍须 ≥4.5:1（浅底配深墨、暗底配亮字）', () => {
  const pairs = [
    ['--soft-ok', '--ok-text'],
    ['--soft-warn', '--warn-text'],
    ['--soft-info', '--info-text'],
    ['--soft-warn', '--gold-text'],
  ];
  for (const [theme, sel] of Object.entries(THEMES)) {
    const vars = { ...ROOT_VARS, ...varsOf(sel) };
    const bg = solidOf(vars['--bg'], null);
    for (const [bgToken, inkToken] of pairs) {
      const surface = solidOf(vars[bgToken], bg);
      const ink = solidOf(vars[inkToken], bg);
      assert.ok(surface, theme + ' 缺少 ' + bgToken);
      assert.ok(ink, theme + ' 缺少 ' + inkToken);
      const ratio = contrast(ink, surface);
      assert.ok(ratio >= 4.5, `${theme} ${inkToken} on ${bgToken} 仅 ${ratio.toFixed(2)}:1`);
    }
  }
});

test('v2.468 浅底旧色不得再写死，必须走软底令牌', () => {
  const banned = ['e8f5e9', 'fff3e0', 'fff8e1', 'e3f2fd', 'fdf3e2', 'e3edf0', 'efe7d6'];
  const hits = [];
  const scan = (file, src) => {
    for (const hex of banned) {
      const re = new RegExp('#' + hex + '\\b', 'i');
      const line = src.split('\n').findIndex((l) => re.test(l));
      if (line >= 0) hits.push(`#${hex} @ ${file}:${line + 1}`);
    }
  };
  scan('app.js', APP);
  scan('room-view.js', ROOM);
  // 令牌定义行本身就要写色值，扫描时排除（只查「用法处」是否还在写死）
  const cssUsage = CSS.split('\n').filter((l) => !/^\s*--(soft-|surface-raised)/.test(l)).join('\n');
  scan('styles.css', cssUsage);
  assert.deepEqual(hits, [], '仍写死浅底：' + hits.join('、'));
});

test('v2.468 列表「编辑」按钮底、提示条、徽章都消费软底令牌', () => {
  const ghost = ruleBodies('.list-value .btn-ghost').join(' ');
  assert.match(ghost, /background:\s*var\(--surface-raised\)/, '.list-value .btn-ghost 仍写死白底');
  assert.ok(APP.includes('var(--soft-warn)'), 'app.js 未消费 --soft-warn（提示条/待核验徽章）');
  assert.ok(APP.includes('var(--soft-ok)'), 'app.js 未消费 --soft-ok（已核验徽章）');
  assert.ok(APP.includes('var(--soft-info)'), 'app.js 未消费 --soft-info（提示条）');
  assert.ok(ROOM.includes('var(--soft-') , 'room-view.js 角色徽章未消费软底令牌');
});
