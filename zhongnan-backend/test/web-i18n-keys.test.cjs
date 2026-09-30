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
 *
 * v2.237 反向守卫（第 7 断言「字典键 ⊆ 消费证据集」）：
 *  v2.235 审计遗留线索——字典 668 顶层键中约 107 个未被静态引用。逐一甄别动态消费形态
 * （D.mode[id] 嵌套、'sec'+Cap(s) 拼接、'fbStatus_'+rawStatus 变量间接、fieldName() 拼接、
 * PF_AGES/PROP_LIB_LEVEL 映射表字面量）后定案 24 个真死键双语删除（668→644）：
 *  fbStatus_PENDING/PROCESSING/SOLVED（nextStatus 仅三态 executing/todo/rejected，永不产生）、
 *  fbLoading/fbSubmitDone/slogan/zoneUser/xiaonanTip/dpLoading/backHome/monthlyGift/freeDaily/
 *  loginToAct/needMember/xscriptBadge/filmBadge/tbSection/tbSectionSub/tbEyebrow/dashLoading/
 *  dashStatsConflicts/dashThinBatchConfirm/dashConflictScrollTitle/libAdviceTitle（全文 0 出现）。
 * 该断言使未来新增死键立即红：新增键必须要么被消费（子串出现），要么登记进 DYN_FAMILIES。
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

  // v2.237 反向守卫：「字典键 ⊆ 消费证据集」，防死键无声积累（v2.235 审计遗留线索闭环）。
  // 消费证据 = ① key 作为子串出现在任何 web 文件（除 i18n.js）——覆盖 t()/data-i/映射表
  //   字面量（PF_AGES/PROP_LIB_LEVEL 等）乃至注释提及（宁松勿紧，防误删）；
  //   ∪ ② 白名单动态拼接家族——键整体作为子串不出现、只能靠拼接消费，逐一溯源登记：
  const DYN_FAMILIES = [
    /^admTab_/,                    // 超管后台 Tab（既有前缀形态，t('admTab_' + tab)）
    /^sec(Experience|Team|Review|News)$/, // app.js SQ_SECTIONS：t('sec' + Cap(s))，s ∈ experience/team/review/news
    /^fbStatus_(EXECUTING|TODO|REJECTED)$/, // app.js t('fbStatus_' + rawStatus)；engine/feedback.ts nextStatus 仅产出 executing/todo/rejected 三态（大写后）
    /^dashThinBatchFields(Voice|SignatureLines|VisualAnchor|Taboo|Tags|Mood)$/, // app.js fieldName()：'dashThinBatchFields' + Cap(f)；f ∈ PATCH_FIELDS_CAST/PROP/SCENE 白名单并集
  ];
  it('字典顶层键 ⊆ 消费证据集（防死键积累）', () => {
    const corpus = fs.readdirSync(WEB)
      .filter((f) => f !== 'i18n.js' && (f.endsWith('.js') || f.endsWith('.html')))
      .map((f) => fs.readFileSync(path.join(WEB, f), 'utf8')).join('\n');
    const dead = [...zhSet].filter((k) => !corpus.includes(k) && !DYN_FAMILIES.some((re) => re.test(k))).sort();
    assert.deepStrictEqual(dead, [], '字典存在无任何消费证据的死键（删除或补消费入口）：' + dead.join(', '));
  });
});
