/**
 * v2.700 结果页改稿建议「卡内可见」守卫（移动端可达性）
 *
 * 真实缺口：结果页 20 张诊断卡把「哪几处硬伤、怎么改」全部塞进元素 title 悬停属性——
 * 触屏设备没有 hover，390px 手机上用户只能看到「编剧改稿尺子 76/100 · 3 处硬伤」，
 * 具体是哪三维、怎么改一个字都看不到；而改稿建议正是这个工具最核心的价值。
 *
 * 修复口径：`craftIssueRowsHtml(issues)` 把硬伤按 P0 → P1 → P2、同级低分优先排序，
 * 卡内直接列出前 3 条「维度 + 改法」，其余折叠进 .craft-more，配可点展开/收起按钮；
 * title 保留作为桌面端补充，但不再是唯一入口。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const ast = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

/** 抽取顶层/命名函数源码 */
function extract(name) {
  let found = null;
  (function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === name) found = node.getText(ast);
    ts.forEachChild(node, visit);
  })(ast);
  return found;
}

function setup(names, extra = {}) {
  const context = {
    lang: 'zh',
    escapeHtml: (s) => String(s ?? ''),
    console,
    ...extra,
  };
  vm.createContext(context);
  for (const name of names) {
    const code = extract(name);
    assert.ok(code, `app.js 缺少函数 ${name}（本轮契约函数被删/改名，需同步本守卫）`);
    vm.runInContext(code, context);
  }
  return context;
}

describe('v2.700 结果页硬伤改法卡内可见', { concurrency: 1 }, () => {
  it('① 硬伤按 P0 → P1 → P2、同级低分优先排序；仅前 3 条直接可见', () => {
    const c = setup(['craftIssueRowsHtml']);
    const issues = [
      { level: 'P1', dim: '对话密度', score: 70, advice: '对话再短一半' },
      // P0 故意给高分：级别规则必须压过分数规则（否则「先改哪」会被分数带偏）
      { level: 'P0', dim: '开场钩子', score: 95, advice: '前三秒就要出事' },
      { level: 'P1', dim: '集尾悬念', score: 55, advice: '结尾留一个未答问题' },
      { level: 'P2', dim: '场景冗余', score: 80, advice: '合并两场' },
      { level: 'P2', dim: '配角功能', score: 76, advice: '删掉只报信的配角' },
    ];
    const html = c.craftIssueRowsHtml(issues);
    const visible = html.split('craft-more')[0];
    assert.ok(visible.indexOf('开场钩子') >= 0, 'P0 必须排第一且可见');
    assert.ok(visible.indexOf('集尾悬念') >= 0, '前 3 条应包含第二条 P1');
    assert.ok(visible.indexOf('场景冗余') < 0, '第 4 条起必须折叠，不得挤占首屏');
    assert.ok(visible.indexOf('开场钩子') < visible.indexOf('对话密度'), 'P0 必须排在 P1 之前（即便 P0 分数更高）');
    assert.ok(visible.indexOf('集尾悬念') < visible.indexOf('对话密度'), '同级 P1 内低分（55）优先于高分（70）');
    assert.ok(html.indexOf('场景冗余') > 0, '折叠区必须保留剩余硬伤（不能丢）');
  });

  it('② 折叠区带可点展开/收起按钮，文案含剩余条数（不依赖悬停）', () => {
    const c = setup(['craftIssueRowsHtml']);
    const html = c.craftIssueRowsHtml([
      { level: 'P0', dim: 'A', score: 40, advice: 'a' },
      { level: 'P1', dim: 'B', score: 60, advice: 'b' },
      { level: 'P1', dim: 'C', score: 60, advice: 'c' },
      { level: 'P2', dim: 'D', score: 70, advice: 'd' },
    ]);
    assert.match(html, /data-craft-more/, '折叠必须由用户可点的控件控制，而不是 title');
    assert.match(html, /展开全部\s*1\s*条/, '按钮须写明还有几条，避免用户不知道折叠了什么');
  });

  it('③ 无硬伤 / 空数组 → 返回空串（不渲染空壳卡）', () => {
    const c = setup(['craftIssueRowsHtml']);
    assert.strictEqual(c.craftIssueRowsHtml([]), '');
    assert.strictEqual(c.craftIssueRowsHtml(undefined), '');
  });

  it('④ 英文界面输出英文按钮文案（不把中文塞进 en）', () => {
    const c = setup(['craftIssueRowsHtml'], { lang: 'en' });
    const html = c.craftIssueRowsHtml([
      { level: 'P0', dim: 'A', score: 40, advice: 'a' },
      { level: 'P1', dim: 'B', score: 60, advice: 'b' },
      { level: 'P1', dim: 'C', score: 60, advice: 'c' },
      { level: 'P2', dim: 'D', score: 70, advice: 'd' },
    ]);
    assert.match(html, /Show all 1 more/, 'en 界面必须给英文展开文案');
    assert.doesNotMatch(html, /展开全部/, 'en 界面不得混入中文按钮');
  });

  it('⑤ 真实 renderResult 的 craftLint 分支必须调用该函数（不是再造一套 title-only）', () => {
    const seg = source.slice(source.indexOf("const clTip = $('craftLintTip')"), source.indexOf("const cdTip = $('craftDepthTip')"));
    assert.ok(seg.includes('craftIssueRowsHtml('), 'renderResult 必须把硬伤渲染进卡内，而不是只写 title');
    assert.ok(seg.includes('data-lint-send') || seg.includes('lintOpenFull'), '原有「送进体检」入口不得被移除');
  });

  it('⑥ 同族的「创作深度」卡也必须卡内可读（不能只修一张、留其余 title-only）', () => {
    const seg = source.slice(source.indexOf("const cdTip = $('craftDepthTip')"), source.indexOf("const tkTip = $('trackTip')"));
    assert.ok(seg.includes('craftIssueRowsHtml('), '创作深度卡同样把四套尺子的硬伤塞在 title 里，须一并改成卡内可见');
  });

  it('⑦ 样式契约：级别色走主题令牌、折叠入场尊重 reduced-motion、窄屏改法独占一行', () => {
    const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
    const seg = css.slice(css.indexOf('/* v2.700 结果页硬伤改法卡内可见'), css.indexOf('/* ================= 登录 / 模态'));
    assert.ok(seg.length > 200, 'styles.css 缺少 v2.700 硬伤改法样式块');
    assert.doesNotMatch(seg, /#[0-9a-fA-F]{3,8}\b/, '级别色不得写死色值，必须引用主题令牌');
    assert.ok(seg.includes('var(--danger-text)') && seg.includes('var(--grade-warn)'), 'P0/P1 级别色须引用主题令牌');
    assert.match(seg, /@media\s*\(prefers-reduced-motion:\s*no-preference\)/, '入场动画必须挂在 no-preference 下（reduce 用户不应看到位移）');
    assert.match(seg, /@media\s*\(max-width:\s*560px\)/, '窄屏须把改法独占一行，避免三段断句挤在一行');
  });
});
