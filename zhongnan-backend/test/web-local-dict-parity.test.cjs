/**
 * v2.471 本地双语表奇偶守卫（纯静态，不起服务器）
 *
 * 背景：`test/web-i18n-keys.test.cjs` 只守 web/i18n.js 的全局字典。room-view / branch-view /
 * teardown-view / diversity-view 各自在文件内维护 `const L = { zh: {...}, en: {...} }`，
 * app.js / data/constants.js 里还有若干 zh/en 成对字面量，全部不受全局守卫覆盖。
 * 任一侧加键漏另一侧时，英文用户会看到 undefined（`T().foo` 为 undefined → 渲染成 "undefined"）。
 *
 * 做法：定位每个 `zh: {` / `en: {` 对象字面量，按顺序配对，用 vm 求值后递归比对键集合
 * （数组比对长度 + 首元素对象键）。不执行任何文件里的业务代码，只有字面量。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');

function skipQuoted(src, i, q) {
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i += 1;
  }
  return i;
}

function skipBraced(src, i) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') { i = skipQuoted(src, i, c); continue; }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (c === '{') { depth += 1; i += 1; continue; }
    if (c === '}') { depth -= 1; i += 1; if (depth === 0) return i; continue; }
    i += 1;
  }
  return i;
}

function skipTemplate(src, i) {
  i += 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') return i + 1;
    if (src[i] === '$' && src[i + 1] === '{') { i = skipBraced(src, i + 1); continue; }
    i += 1;
  }
  return i;
}

/** 从 openIdx（指向 '{'）截取完整对象字面量文本 */
function objectText(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') { i = skipQuoted(src, i, c); continue; }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (c === '{') { depth += 1; i += 1; continue; }
    if (c === '}') { depth -= 1; i += 1; if (depth === 0) return src.slice(openIdx, i); continue; }
    i += 1;
  }
  return null;
}

function pairsOf(src) {
  const pairs = [];
  let pendingZh = null;
  const re = /(^|[\s,{(])(zh|en)\s*:\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const openIdx = m.index + m[0].length - 1;
    const text = objectText(src, openIdx);
    assert.ok(text, '未能截取对象字面量（' + m[2] + ' @' + openIdx + '）');
    const value = vm.runInNewContext('(' + text + ')');
    if (m[2] === 'zh') pendingZh = { value, index: m.index };
    else {
      pairs.push({ zh: pendingZh, en: { value, index: m.index }, label: 'zh@' + (pendingZh ? pendingZh.index : '?') + ' / en@' + m.index });
      pendingZh = null;
    }
  }
  return pairs;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function diffKeys(a, b, prefix, out) {
  for (const k of Object.keys(a)) if (!(k in b)) out.push(prefix + k + '（仅 zh）');
  for (const k of Object.keys(b)) if (!(k in a)) out.push(prefix + k + '（仅 en）');
  for (const k of Object.keys(a)) {
    if (!(k in b)) continue;
    const va = a[k];
    const vb = b[k];
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) { out.push(`${prefix}${k}[] 长度 ${va.length} vs ${vb.length}`); continue; }
      if (va.length && isObj(va[0]) && isObj(vb[0])) diffKeys(va[0], vb[0], prefix + k + '[].', out);
      continue;
    }
    if (isObj(va) && isObj(vb)) { diffKeys(va, vb, prefix + k + '.', out); continue; }
    if (typeof va !== typeof vb) out.push(`${prefix}${k} 类型 ${typeof va} vs ${typeof vb}`);
  }
  return out;
}

const FILES = ['room-view.js', 'branch-view.js', 'teardown-view.js', 'diversity-view.js', 'app.js', path.join('data', 'constants.js')];

describe('v2.471 本地双语表奇偶', () => {
  it('每个 zh/en 对象字面量对的键集合一致（含嵌套与数组首元素）', () => {
    const problems = [];
    let total = 0;
    for (const f of FILES) {
      const src = fs.readFileSync(path.join(WEB, f), 'utf8');
      const pairs = pairsOf(src);
      assert.ok(pairs.length >= 1, f + ' 应至少有一组 zh/en 字面量（扫描器失效会假绿）');
      total += pairs.length;
      for (const p of pairs) {
        assert.ok(p.zh, f + ' 存在没有配对 zh 的 en 块');
        const d = diffKeys(p.zh.value, p.en.value, '', []);
        if (d.length) problems.push(f + ' ' + p.label + '：\n  ' + d.join('\n  '));
      }
    }
    assert.ok(total >= 8, '配对总数应 ≥8（当前 ' + total + '），扫描器可能失效');
    assert.deepStrictEqual(problems, [], '双语键不一致：\n' + problems.join('\n'));
  });
});
