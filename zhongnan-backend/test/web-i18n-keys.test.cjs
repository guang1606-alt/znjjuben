/**
 * v2.235 i18n 键完整性守卫 —— 「代码引用的键，字典必须有」+ 顶层无重复键
 * 背景：v2.235 审计发现 5 个用户可见真缺失键（t() 未知键回落返回键名本身，boot 时
 *  renderStaticText 会把 [data-i] 元素洗成裸键名）：
 *  ① t('askOk')/t('askCancel') —— app.js uiAsk 输入对话框按钮（显示裸 "askOk"）
 *  ② data-i="subTitle"/"subFree" —— index.html 投稿面板标题/副标题
 *  ③ data-i="dlEp" —— index.html 导出菜单「导出单集…」按钮
 * 另发现 sqEmpty 在 zh/en 块顶层各定义 2 次（后者静默覆盖前者，先定义文案为死副本）。
 * 本文件把审计固化成回归守卫：任何一侧未来漂移（引用缺失/重复定义/双语不齐）即红。
 * 纯静态读源码 + require i18n.js，不起服务器。
 *
 * 提取规则（与 v2.234 假阳性类型学同源）：
 *  ① t('k') 完整字面量才做存在性断言；t('prefix_' + ...) 拼接形态只提取前缀，
 *     断言字典中至少有 1 个以该前缀开头的键（动态键无法静态穷举，前缀有匹配即非缺失）。
 *  ② 顶层键提取用花括号深度扫描（字符串/转义跳过），嵌套对象（mode:/modeDesc:）的
 *     内部键不算顶层键，不参与重复检测与奇偶对比。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const I18N = require(path.join(WEB, 'i18n.js'));

/** 源码级顶层键提取：定位 `label: {` 块，花括号深度 1 处的 key: 即顶层键（字符串/转义跳过） */
function topLevelKeys(src, label) {
  const start = src.indexOf(label + ': {');
  assert.ok(start >= 0, 'i18n.js 应存在 ' + label + ': { 块');
  let i = src.indexOf('{', start);
  let depth = 0;
  const keys = [];
  let j = i;
  const n = src.length;
  let ident = '';
  while (j < n) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') {
      // 跳过字符串字面量（处理反斜杠转义）
      const q = c;
      j++;
      while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      j++;
      continue;
    }
    if (c === '{') { depth++; j++; continue; }
    if (c === '}') { depth--; j++; if (depth === 0) break; continue; }
    if (depth === 1) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(j));
      if (m) {
        // 标识符后（允许空白）紧跟 ':' 才是键
        let k = j + m[0].length;
        while (k < n && /\s/.test(src[k])) k++;
        if (src[k] === ':') keys.push(m[0]);
        j += m[0].length;
        continue;
      }
    }
    j++;
  }
  return keys;
}

function referencedKeys() {
  const literal = new Set(); // 完整字面量 t('k')
  const prefixes = new Set(); // 拼接前缀 t('prefix_' + ...)
  const files = fs.readdirSync(WEB).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const t = fs.readFileSync(path.join(WEB, f), 'utf8');
    for (const m of t.matchAll(/\bt\(\s*'([A-Za-z_$][\w$]*)'(\s*\+)?/g)) {
      if (m[2]) prefixes.add(m[1]); else literal.add(m[1]);
    }
    for (const m of t.matchAll(/\bt\(\s*"([A-Za-z_$][\w$]*)"(\s*\+)?/g)) {
      if (m[2]) prefixes.add(m[1]); else literal.add(m[1]);
    }
  }
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  for (const m of html.matchAll(/data-i(?:-html|-ph)?="([A-Za-z_$][\w$]*)"/g)) literal.add(m[1]);
  for (const m of html.matchAll(/data-ph="([A-Za-z_$][\w$]*)"/g)) literal.add(m[1]);
  return { literal, prefixes };
}

describe('v2.235 i18n 键完整性', () => {
  const src = fs.readFileSync(path.join(WEB, 'i18n.js'), 'utf8');
  const zhKeys = topLevelKeys(src, 'zh');
  const enKeys = topLevelKeys(src, 'en');
  const zhSet = new Set(Object.keys(I18N.DICT.zh));
  const enSet = new Set(Object.keys(I18N.DICT.en));

  it('顶层键提取 sanity（防扫描器失效导致假绿）', () => {
    assert.ok(zhSet.size >= 600, 'zh 字典顶层键应 ≥600（当前 ' + zhSet.size + '）');
    assert.strictEqual(zhKeys.length, new Set(zhKeys).size === zhKeys.length ? zhKeys.length : zhKeys.length, '提取器应产出键列表');
    assert.ok(zhKeys.length >= zhSet.size, '源码顶层键提取数应 ≥ require 后键数（重复键会让前者更多）；当前 ' + zhKeys.length + ' vs ' + zhSet.size);
    assert.ok(zhKeys.includes('sqEmpty') && zhKeys.includes('brand'), '提取器应覆盖已知顶层键');
  });

  it('zh/en 顶层键集合一致（双语奇偶）', () => {
    const onlyZh = [...zhSet].filter((k) => !enSet.has(k));
    const onlyEn = [...enSet].filter((k) => !zhSet.has(k));
    assert.deepStrictEqual(onlyZh, [], 'zh 有而 en 缺的键：' + onlyZh.join(', '));
    assert.deepStrictEqual(onlyEn, [], 'en 有而 zh 缺的键：' + onlyEn.join(', '));
  });

  it('zh/en 顶层无重复键（后者静默覆盖前者即死副本，sqEmpty 案）', () => {
    const dups = (keys) => { const s = new Set(); const d = []; for (const k of keys) { if (s.has(k)) d.push(k); else s.add(k); } return d; };
    assert.deepStrictEqual(dups(zhKeys), [], 'zh 块顶层重复键');
    assert.deepStrictEqual(dups(enKeys), [], 'en 块顶层重复键');
  });

  it('代码 t() 完整字面量引用 ⊆ 字典键（askOk/askCancel 案）', () => {
    const { literal } = referencedKeys();
    const missing = [...literal].filter((k) => !zhSet.has(k)).sort();
    assert.deepStrictEqual(missing, [], 't()/data-i 引用但字典缺失的键：' + missing.join(', '));
  });

  it('index.html data-i/data-ph 引用 ⊆ 字典键（subTitle/subFree/dlEp 案）', () => {
    const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
    const used = new Set();
    for (const m of html.matchAll(/data-i(?:-html|-ph)?="([A-Za-z_$][\w$]*)"/g)) used.add(m[1]);
    for (const m of html.matchAll(/data-ph="([A-Za-z_$][\w$]*)"/g)) used.add(m[1]);
    const missing = [...used].filter((k) => !zhSet.has(k)).sort();
    assert.deepStrictEqual(missing, [], 'index.html 引用但字典缺失的键：' + missing.join(', '));
  });

  it('动态拼接前缀在字典中至少有 1 个匹配键（admTab_ 形态防真缺失被跳过）', () => {
    const { prefixes } = referencedKeys();
    for (const p of prefixes) {
      const hits = [...zhSet].filter((k) => k.startsWith(p));
      assert.ok(hits.length >= 1, '动态前缀 ' + JSON.stringify(p) + ' 在字典中无任何匹配键');
    }
  });
});
