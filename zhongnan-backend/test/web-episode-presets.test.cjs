/**
 * v2.668 创作端「集数控制」单一真源 + 快捷预设
 * 缺口（用户视角）：出本配置里同一个 #episodes 输入被四处读取，却有三套口径——
 *   费用提示完全不设上限、三处节奏/钩子预演硬编码 120、实际生成最多 300。
 *   用户填 500 时，提示按 500 集报价，实际只生成 300 集（报价虚高）；填 0 / 留空 / 非数字
 *   时各口径给出的集数与提示互相对不上，且输入框没有任何即时纠偏反馈。
 * 修法：normalizeEpisodeCount 统一 1–300（空/非法回落 20），费用提示/生成/预演全部走它；
 *   出本配置补 10/20/40/60/100 预设 chips 与纠偏提示（i18n 双语、降动效）。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const sourceRaw = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const source = sourceRaw.replace(/\/\/.*$/gm, '');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
const i18nRaw = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8');

const ast = ts.createSourceFile('app.js', sourceRaw, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
(function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
})(ast);

function setup(names, extra = {}) {
  const nodes = new Map();
  function node(id) {
    const classes = new Set();
    return {
      id, value: '', textContent: '', dataset: {}, disabled: false, offsetWidth: 10,
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        contains: (n) => classes.has(n),
        toggle() {},
        _set: classes,
      },
      setAttribute() {}, getAttribute() {}, remove() {},
    };
  }
  const $ = (id) => { if (!nodes.has(id)) nodes.set(id, node(id)); return nodes.get(id); };
  const context = {
    $, lang: 'zh', console,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    t: (key, vars) => key + ':' + Object.values(vars || {}).join(','),
    escapeHtml: (s) => String(s ?? ''),
    syncEpisodeCostHint() {},
    // renderEpisodeHint 依赖模块级状态（当前纠偏值），逐函数求值需预置
    _epFixedTo: null,
    ...extra,
  };
  vm.createContext(context);
  // normalizeEpisodeCount 是集数口径的唯一真源，任何求值 episodeCostHint 的用例都必须可用
  for (const name of ['normalizeEpisodeCount', ...names]) if (functions.has(name)) vm.runInContext(functions.get(name), context);
  return { c: context, $ };
}

// ─────────── 静态契约 ───────────
test('v2.668 出本配置：集数预设 chips + 纠偏提示存在且可访问', () => {
  assert.match(html, /id="epPresets"[^>]*role="group"[^>]*data-i-aria="epPresetAria"/, '预设组需声明 role=group 与双语 aria');
  for (const n of ['10', '20', '40', '60', '100']) {
    assert.match(html, new RegExp(`<button type="button" class="ep-preset" data-ep="${n}">${n}</button>`), `预设 ${n} 缺失`);
  }
  assert.match(html, /id="episodesHint" role="status" aria-live="polite"/, '纠偏提示须 aria-live 可感知');
  assert.match(html, /class="field ep-field"/, '集数 field 需带 ep-field 容器');
});

test('v2.668 集数口径只有一处真源：费用提示 / 生成 / 三处预演全部走 normalizeEpisodeCount', () => {
  const cost = functions.get('episodeCostHint') || '';
  assert.match(cost, /normalizeEpisodeCount\(p\.episodes\)/, '费用提示必须走统一口径');
  const start = functions.get('startGenerate') || '';
  assert.match(start, /normalizeEpisodeCount\(\$\('episodes'\)\.value\)/, '生成必须走统一口径');
  assert.equal((source.match(/Math\.min\(120, normalizeEpisodeCount\(/g) || []).length, 3, '三处预演应显式以 120 为预览上限并复用统一口径');
  assert.doesNotMatch(source, /Math\.min\(120, parseInt\(/, '旧的硬编码 parseInt 预演口径应清零');
  assert.doesNotMatch(source, /Math\.max\(1, Math\.min\(300, parseInt\(\$\('episodes'\)/, '旧生成口径应清零');
});

test('v2.668 交互接线：输入/失焦/预设点击与二级界面/切语言同步', () => {
  assert.match(source, /id === 'episodes'\) \{ syncEpisodeCostHint\(\); syncEpisodePresets\(\); \}/, 'input 时同步成本与预设高亮');
  assert.match(source, /renderEpisodeHint\(fixed\)/, 'change 时对越界值给纠偏提示');
  assert.match(source, /closest\('\.ep-preset'\)/, '预设 chips 需有委托点击');
  assert.match(source, /applyEpisodePreset\(btn\.getAttribute\('data-ep'\)\)/, '点击预设应写入集数');
  const showMode = functions.get('showModeDetail') || '';
  assert.match(showMode, /syncEpisodePresets\(\)/, '进入二级界面需点亮当前预设');
  const applyLang = functions.get('applyLang') || '';
  assert.match(applyLang, /syncEpisodePresets\(\)/, '切语言需重刷预设高亮');
  assert.match(applyLang, /renderEpisodeHint\(\)/, '切语言需重刷纠偏提示文案');
  const resume = functions.get('resumeProjectForContinuation') || '';
  assert.match(resume, /normalizeEpisodeCount\(project\.totalEps\)/, '续写恢复集数须过统一口径');
});

test('v2.668 i18n 双语键齐全', () => {
  assert.match(i18nRaw, /epPresetAria: '常用集数快捷选择'/, 'zh 预设组 aria 缺失');
  assert.match(i18nRaw, /episodesAutoFixed: '已调整为 \{n\} 集（可填 1–300 集）'/, 'zh 纠偏文案缺失');
  assert.match(i18nRaw, /epPresetAria: 'Common episode counts'/, 'en 预设组 aria 缺失');
  assert.match(i18nRaw, /episodesAutoFixed: 'Adjusted to \{n\} episodes \(allowed 1–300\)\.'/, 'en 纠偏文案缺失');
});

test('v2.668 样式：选中态 + 纠偏动画 + 降动效守卫', () => {
  assert.match(css, /\.ep-preset\[aria-pressed='true'\]/, '选中态样式缺失');
  assert.match(css, /@keyframes ep-shake/, '纠偏抖动关键帧缺失');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.ep-hint\.zn-fade-in, \.ep-shake \{ animation: none; \} \}/, '必须为纠偏动画提供降动效守卫');
});

// ─────────── 行为 ───────────
test('v2.668 normalizeEpisodeCount：合法/越界/空值/非法值统一到 1–300', () => {
  const { c } = setup([]);
  const cases = [
    [20, 20], ['20', 20], ['', 20], ['   ', 20], [null, 20], [undefined, 20], ['abc', 20],
    [0, 1], ['0', 1], [-5, 1], ['1.9', 1], ['12.9', 12], [500, 300], ['100000', 300], [300, 300], [45, 45],
  ];
  for (const [input, want] of cases) assert.equal(c.normalizeEpisodeCount(input), want, `normalizeEpisodeCount(${JSON.stringify(input)}) 应为 ${want}`);
});

test('v2.668 费用提示：输入 500 集按 300 集报价，不再虚高', () => {
  const plan = { level: 'ADVANCED', freeEpsPerDay: 0, epPrice: { STANDARD: 12 } };
  const { c } = setup(['episodeCostHint', 'tierZh', 'tierEn'], {
    tierZh: () => '标准', tierEn: () => 'Standard',
  });
  const s = c.episodeCostHint({ episodes: 500, tier: 'STANDARD', plan, authed: true, quotaRemain: 0, en: false });
  assert.match(s, /300 集/, '应提示实际会生成的 300 集');
  assert.match(s, /3600 积分/, '总额应按 300 × 12 计算');
  assert.doesNotMatch(s, /500 集/, '不得按 500 集报价');
});

test('v2.668 syncEpisodePresets：按当前值点亮、草稿只读时整组禁用', () => {
  const buttons = ['10', '20', '40', '60', '100'].map((n) => {
    const attrs = { 'data-ep': n, 'aria-pressed': 'false' };
    return { disabled: false, getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; }, _attrs: attrs };
  });
  const { c, $ } = setup(['syncEpisodePresets'], {
    document: { querySelectorAll: (sel) => (sel === '.ep-preset' ? buttons : []), getElementById: () => null },
  });
  $('episodes').value = '60';
  c.syncEpisodePresets();
  assert.deepEqual(buttons.map((b) => b._attrs['aria-pressed']), ['false', 'false', 'false', 'true', 'false']);
  assert.deepEqual(buttons.map((b) => b.disabled), [false, false, false, false, false]);

  $('episodes').disabled = true;
  c.syncEpisodePresets();
  assert.deepEqual(buttons.map((b) => b.disabled), [true, true, true, true, true], '草稿只读时预设不可再改集数');
});

test('v2.668 applyEpisodePreset：写入规范化后的值并收起纠偏提示', () => {
  let costCalls = 0;
  const { c, $ } = setup(['applyEpisodePreset', 'syncEpisodePresets', 'renderEpisodeHint'], {
    syncEpisodeCostHint: () => { costCalls += 1; },
    document: { querySelectorAll: () => [], getElementById: () => null },
  });
  $('episodesHint').textContent = '旧提示';
  c.renderEpisodeHint(12);
  c.applyEpisodePreset('100');
  assert.equal($('episodes').value, '100');
  assert.equal($('episodesHint').textContent, '', '选中预设后应收起纠偏提示');
  assert.equal($('episodesHint').classList.contains('hidden'), true);
  assert.equal(costCalls, 1, '选预设后应重算费用提示');
});

test('v2.668 renderEpisodeHint：显示双语纠偏文案并重启动画', () => {
  const { c, $ } = setup(['renderEpisodeHint']);
  c.renderEpisodeHint(300);
  const el = $('episodesHint');
  assert.equal(el.textContent, 'episodesAutoFixed:300');
  assert.equal(el.classList.contains('hidden'), false);
  assert.equal(el.classList.contains('zn-fade-in'), true);
  c.renderEpisodeHint(null);
  assert.equal(el.textContent, '');
  assert.equal(el.classList.contains('hidden'), true);
});
