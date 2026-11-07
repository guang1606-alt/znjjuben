/**
 * v2.444 产品化：表单控件可访问名（静态契约）。
 *
 * 证伪背景：Chrome DevTools Issues 实测报「No label associated with a form field (9)」
 * 与「A form field element should have an id or name attribute (12)」。
 * 逐控件审计：index.html 有 17 个控件只有 placeholder 或纯下拉、无任何标签关联；
 * app.js / 视图文件动态模板另有 20+ 个同类控件（部分连 id/name 都没有）。
 *
 * 本文件锁死三件事：
 * 1) 每个非 hidden 控件必须有 id 或 name（浏览器自动填充与读屏定位都依赖它）；
 * 2) 每个控件必须有可访问名来源：aria-label / aria-labelledby / label[for] / <label> 包裹 / data-ph；
 * 3) 只有 data-ph 的控件，由 renderStaticText → syncPhA11y 在运行时把同一句人写文案补成 aria-label；
 *    不允许把 placeholder 当唯一名字（placeholder 聚焦即消失，读屏读不到）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '../web');
const appJs = fs.readFileSync(path.join(webDir, 'app.js'), 'utf8');
const i18nJs = fs.readFileSync(path.join(webDir, 'i18n.js'), 'utf8');

const CONTROL_RE = /<(input|select|textarea)\b[^>]*>/g;

function scanControls(src) {
  // 先标出 <label>…</label> 覆盖区间，包裹式标签也算有可访问名
  const wrapped = [];
  const labelRe = /<label\b[^>]*>([\s\S]*?)<\/label>/g;
  let lm;
  while ((lm = labelRe.exec(src))) wrapped.push([lm.index, lm.index + lm[0].length]);
  const out = [];
  let m;
  CONTROL_RE.lastIndex = 0;
  while ((m = CONTROL_RE.exec(src))) {
    const tag = m[0];
    if (/type="hidden"/.test(tag)) continue;
    const idx = m.index;
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1] || null;
    const hasIdOrName = !!id || /\bname=/.test(tag);
    const labeledByFor = id ? new RegExp(`for="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(src) : false;
    const inLabel = wrapped.some(([a, b]) => idx > a && idx < b);
    const hasAria = /aria-label=/.test(tag) || /aria-labelledby=/.test(tag);
    const hasPh = /data-ph=/.test(tag);
    out.push({ tag, id, hasIdOrName, nameSource: hasAria || labeledByFor || inLabel || hasPh });
  }
  return out;
}

test('index.html：每个表单控件都有 id/name 与可访问名来源', () => {
  const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
  const controls = scanControls(html);
  assert.ok(controls.length > 100, `控件数异常偏少：${controls.length}`);
  const noName = controls.filter((c) => !c.nameSource).map((c) => c.tag.slice(0, 80));
  const noId = controls.filter((c) => !c.hasIdOrName).map((c) => c.tag.slice(0, 80));
  assert.deepStrictEqual(noName, [], '存在无任何可访问名来源的静态控件');
  assert.deepStrictEqual(noId, [], '存在缺 id/name 的静态控件');
});

test('动态视图与 app.js 模板：控件同样有 id/name 与可访问名来源', () => {
  const files = fs.readdirSync(webDir).filter((f) => f.endsWith('.js') && f !== 'i18n.js');
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(webDir, f), 'utf8');
    for (const c of scanControls(src)) {
      if (!c.nameSource || !c.hasIdOrName) bad.push(`${f}: ${c.tag.slice(0, 90)}`);
    }
  }
  assert.deepStrictEqual(bad, [], '动态模板存在无可访问名或 id/name 的控件');
});

test('运行时补齐：data-ph 控件在缺名时被写成 aria-label', () => {
  const hasName = appJs.match(/function hasAccessibleName\(el\)[\s\S]*?\n  \}/);
  assert.ok(hasName, '缺 hasAccessibleName');
  assert.match(hasName[0], /aria-label/, '需识别 aria-label');
  assert.match(hasName[0], /aria-labelledby/, '需识别 aria-labelledby');
  assert.match(hasName[0], /closest\('label'\)/, '需识别包裹式 label');
  assert.match(hasName[0], /label\[for=/, '需识别 label[for]');
  const sync = appJs.match(/function syncPhA11y\(\)[\s\S]*?\n  \}/);
  assert.ok(sync, '缺 syncPhA11y');
  assert.match(sync[0], /\[data-ph\]/, '需扫描 data-ph 控件');
  assert.match(sync[0], /if \(!hasAccessibleName\(el\)\) el\.setAttribute\('aria-label'/, '仅缺名时补 aria-label，不覆盖人工标注');
  const render = appJs.match(/function renderStaticText\(\)[\s\S]*?\n  \}/);
  assert.ok(render, '缺 renderStaticText');
  assert.match(render[0], /syncPhA11y\(\)/, 'renderStaticText 必须调用 syncPhA11y');
});

test('新增可访问名文案中英齐备', () => {
  const keys = [
    'tagDimAria', 'briefFileAria', 'ivAnswerAria', 'mkSortAria', 'admCreateLevelAria',
    'admPostFilterAria', 'knFilterAria', 'fbStatusAria', 'fbTypeAria', 'fbTodoSortAria',
    'sfSeverityAria', 'sfLabelAria', 'sfPatternsAria', 'sfAdviceAria',
    'hdLogVerAria', 'hdLogSumAria', 'xnAskInputAria',
  ];
  for (const k of keys) {
    const hits = i18nJs.match(new RegExp(`\\b${k}:`, 'g')) || [];
    assert.strictEqual(hits.length, 2, `${k} 必须中英各一条，当前 ${hits.length} 条`);
  }
});
