/**
 * v2.463 强调色填充块上的文字对比度守卫 —— TDD 先红后绿
 *
 * 实测缺陷（真实 dist，Lighthouse mobile + 逐元素计算）：
 *   默认 tech 主题 --accent = #8bafef（浅蓝）、dark 主题 = #4ab5a8（浅青），
 *   而 .btn-primary / .chip.on / .tabs button.on / .role-chip.active 等 20 余处
 *   统一用固定纸白 #fbf7ec 作填充块文字：
 *     #fbf7ec on #8bafef = 2.07:1（Lighthouse 判 .on 筛选片失败）
 *     #fbf7ec on #a5c4ff = 1.64:1（accent-strong 渐变端更浅）
 *     #fbf7ec on #4ab5a8 = 2.32:1
 *   WCAG AA 正文要求 4.5:1 —— 也就是主按钮/选中页签/选中筛选片的字几乎是糊的。
 *   浅色与护眼主题的 accent 是深墨青，纸白字达标，所以问题只出现在两套暗主题，
 *   必须按主题给「填充块上的前景色」一个令牌，而不是全站统一写死一种纸白。
 *
 * 另：.board-tab.active 用 --cinnabar 填充 + 纸白字，tech/dark 的 #b8554a 只有 4.42:1，
 *   同样差一点点，用 color-mix 把填充压深后达标，且仍随各主题的朱砂色变化。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function rulesOf(css) {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map((m) => ({ selector: m[1].trim(), body: m[2] }));
}
const RULES = rulesOf(CSS);

function varsOf(selector) {
  const rule = RULES.filter((r) => r.selector === selector).pop();
  const out = {};
  if (!rule) return out;
  Array.from(rule.body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)).forEach((m) => { out[m[1]] = m[2].trim(); });
  return out;
}
const ROOT = varsOf(':root');
const THEMES = { tech: '[data-theme=\'tech\']', dark: '[data-theme=\'dark\']', light: '[data-theme=\'light\']', eye: '[data-theme=\'eye\']' };

const hexToRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a, b) => {
  const x = lum(hexToRgb(a)), y = lum(hexToRgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mixBlack = (hex, pct) => {
  const c = hexToRgb(hex);
  const v = (x) => Math.round(x * pct).toString(16).padStart(2, '0');
  return '#' + v(c.r) + v(c.g) + v(c.b);
};
const decl = (body, prop) => {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
};

describe('v2.463 强调色填充块上的文字在四套主题都达到 4.5:1', () => {
  it('每套主题都解析出 --accent / --accent-strong / --on-accent，且两档底色上的文字都 ≥4.5:1', () => {
    const pairs = Object.entries(THEMES).map(([name, sel]) => {
      const v = varsOf(sel);
      const accent = v['--accent'] || ROOT['--accent'];
      const strong = v['--accent-strong'] || ROOT['--accent-strong'];
      const on = v['--on-accent'] || ROOT['--on-accent'];
      return { name, accent, strong, on };
    });
    for (const p of pairs) {
      assert.match(p.accent || '', /^#[0-9a-f]{6}$/i, `主题 ${p.name} 的 --accent 应为十六进制色值`);
      assert.ok(p.on, `主题 ${p.name} 缺少 --on-accent：填充块文字必须按主题取色`);
      const c1 = contrast(p.on, p.accent), c2 = contrast(p.on, p.strong);
      assert.ok(c1 >= 4.5, `主题 ${p.name}: ${p.on} on --accent ${p.accent} = ${c1.toFixed(2)}，低于 4.5`);
      assert.ok(c2 >= 4.5, `主题 ${p.name}: ${p.on} on --accent-strong ${p.strong} = ${c2.toFixed(2)}，低于 4.5`);
    }
  });

  it('所有以 --accent 系作背景的规则，文字不得再写死 #fbf7ec（必须用 --on-accent）', () => {
    const offenders = RULES.filter((r) => {
      const bg = decl(r.body, 'background') || decl(r.body, 'background-color') || '';
      if (!/var\(--accent(?:-strong)?\)/.test(bg)) return false;
      const color = decl(r.body, 'color') || '';
      return /#fbf7ec/i.test(color);
    }).map((r) => r.selector);
    assert.deepStrictEqual(offenders, [], `这些规则在强调色填充上用固定纸白字，暗主题会低到 1.6~2.3:1：\n${offenders.join('\n')}`);
  });

  it('.board-tab.active 的填充必须压深到与纸白字 ≥4.5:1（四套主题都算一遍）', () => {
    const tabs = RULES.filter((r) => /^(\[data-theme="dark"\]\s+)?\.board-tab\.active$/.test(r.selector));
    assert.ok(tabs.length >= 1, '未找到 .board-tab.active');
    for (const name of Object.keys(THEMES)) {
      const hex = varsOf(THEMES[name])['--cinnabar'] || ROOT['--cinnabar'];
      const bg = decl(tabs[tabs.length - 1].body, 'background') || '';
      const m = bg.match(/color-mix\(in srgb,\s*var\(--cinnabar\)\s*(\d+)%\s*,\s*#000\)/);
      assert.ok(m, `.board-tab.active 应使用 color-mix 把朱砂压深（当前 background=${bg}），否则 ${name} 主题只有 4.42:1`);
      const filled = mixBlack(hex, Number(m[1]) / 100);
      const c = contrast('#fbf7ec', filled);
      assert.ok(c >= 4.5, `主题 ${name}: 纸白字 on 压深朱砂 ${filled} = ${c.toFixed(2)}，低于 4.5`);
    }
  });
});
