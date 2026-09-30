const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declarations = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(ast));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    declarations.set(node.name.text, `const ${node.getText(ast)};`);
  }
  ts.forEachChild(node, visit);
}
visit(ast);

// Exercise the production generic QC-card renderer, including the attributes
// consumed by its rewrite click handler. No copy/escaping implementation is mocked.
function setup(lang = 'zh') {
  const c = vm.createContext({ lang });
  for (const name of ['escapeHtml', 'QC_ENGINE_LABELS', 'humanizeEngineKey', 'qcFixAttrs', 'qcIssueText', 'buildQcReportHtml']) {
    assert.ok(declarations.has(name), `missing production declaration ${name}`);
    vm.runInContext(declarations.get(name), c);
  }
  return c;
}

function report(key, issues, advice = []) {
  return [{ epNo: 1, title: '第一集', qcReport: { [key]: { score: 55, hits: [{ rescued: false }], issues, advice } } }];
}

function chipAttributes(html, rule) {
  const chip = (html.match(/<span\b[^>]*class="qc-chip [^>]*>/g) || [])
    .find(tag => tag.includes(`data-rule="${rule}"`));
  assert.ok(chip, `expected actionable chip for ${rule}`);
  return Object.fromEntries(Array.from(chip.matchAll(/([\w-]+)="([^"]*)"/g), match => [match[1], match[2]]));
}

for (const key of ['coolMoment', 'punchlineDensity']) {
  test(`${key} object findings show readable advice in the tooltip and rewrite payload`, () => {
    const c = setup();
    const html = c.buildQcReportHtml(report(key, [
      { type: 'weak_payoff', advice: '先压制再反击，让主角赢得有代价。', evidence: '不应替代建议的证据' },
    ]));
    const attrs = chipAttributes(html, key);
    assert.equal(attrs['data-advice'], '先压制再反击，让主角赢得有代价。');
    assert.ok(attrs.title.includes('先压制再反击，让主角赢得有代价。'));
    assert.ok(!html.includes('[object Object]'));
    assert.ok(!html.includes('不应替代建议的证据'));
    assert.equal(attrs['data-ep'], '1');
  });
}

test('legacy string findings and advice remain readable in their original order', () => {
  const c = setup();
  const html = c.buildQcReportHtml(report('coolMoment', ['  保留原有问题。  ', '第二条问题。'], ['  补充改法。  ']));
  const attrs = chipAttributes(html, 'coolMoment');
  assert.equal(attrs['data-advice'], '保留原有问题。 / 第二条问题。 / 补充改法。');
  assert.ok(attrs.title.includes(attrs['data-advice']));
});

test('blank and malformed object fields fall through to the first readable message or evidence', () => {
  const c = setup();
  assert.equal(c.qcIssueText({ advice: '  优先建议  ', message: '次选消息', evidence: '原文' }), '优先建议');
  assert.equal(c.qcIssueText({ advice: ' \n ', message: '  消息可读  ', evidence: '原文' }), '消息可读');
  assert.equal(c.qcIssueText({ advice: {}, message: 12, evidence: '  有效证据  ' }), '有效证据');
  assert.equal(c.qcIssueText({ advice: false, message: '应先使用消息', evidence: '较低优先级证据' }), '应先使用消息');
  const html = c.buildQcReportHtml(report('punchlineDensity', [
    { advice: ' ', message: '  用角色自己的口吻表达。  ', evidence: '更低优先级证据' },
    { advice: {}, evidence: '  这句只是重复上一句。  ' },
  ]));
  assert.equal(chipAttributes(html, 'punchlineDensity')['data-advice'], '用角色自己的口吻表达。 / 这句只是重复上一句。');
});

for (const [lang, fallback] of [['zh', '创作质检命中'], ['en', 'Writing-quality finding']]) {
  test(`unreadable findings use the ${lang} fallback without exposing objects or internal types`, () => {
    const c = setup(lang);
    const unreadable = [{}, { advice: {}, message: [], evidence: 1 }, { type: 'internal_rule_key' }, null, false, 42, '   '];
    for (const issue of unreadable) assert.equal(c.qcIssueText(issue), '');
    const html = c.buildQcReportHtml(report('coolMoment', unreadable));
    const attrs = chipAttributes(html, 'coolMoment');
    assert.equal(attrs['data-advice'], fallback);
    assert.ok(attrs.title.includes(fallback));
    assert.ok(!html.includes('[object Object]'));
    assert.ok(!html.includes('internal_rule_key'));
  });
}

test('empty findings do not hide later valid advice or consume the three-message display limit', () => {
  const c = setup();
  const html = c.buildQcReportHtml(report('coolMoment', [{}, ' ', { advice: '第一条' }, null, '第二条'], [
    { message: '第三条' }, { evidence: '第四条' },
  ]));
  assert.equal(chipAttributes(html, 'coolMoment')['data-advice'], '第一条 / 第二条 / 第三条');
  assert.ok(!html.includes('第四条'));
});

test('object advice is HTML-escaped in both hover text and rewrite data attributes', () => {
  const c = setup();
  const advice = '保留 <转折> & "角色"，勿用 \'套话\' <img src=x onerror=alert(1)>';
  const expected = '保留 &lt;转折&gt; &amp; &quot;角色&quot;，勿用 &#39;套话&#39; &lt;img src=x onerror=alert(1)&gt;';
  const html = c.buildQcReportHtml(report('punchlineDensity', [{ advice }]));
  const attrs = chipAttributes(html, 'punchlineDensity');
  assert.equal(attrs['data-advice'], expected);
  assert.ok(attrs.title.includes(expected));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('[object Object]'));
});
