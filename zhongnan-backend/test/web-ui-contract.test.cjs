/**
 * v2.472 前端 UI 契约守卫（纯静态）
 *
 * 背景：UI 巡检（scripts/ui-audit.cjs）只能证明"此刻真机没问题"，不能防止后续改动把
 * 支撑这些行为的代码删掉。本守卫把三件事固化：
 *   G1 web/index.html 用到的静态类 `.input` 必须在 styles.css 有定义（否则回落成裸控件）
 *   G2 窄屏导航横滑条必须自动把激活项滚进可视区（switchView 内 scrollIntoView inline:center）
 *   G3 横滑条必须有右侧渐隐提示，且按 scrollLeft 实时挂/摘（避免末项被永久遮淡）
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8');

describe('v2.472 前端 UI 契约', () => {
  it('G1 index.html 使用的 .input 类在样式表中有定义', () => {
    if (!/class="[^"]*\binput\b/.test(html)) return; // 未使用则无需定义
    assert.match(css, /\.input\s*\{/, 'styles.css 缺少 .input 规则：输入框会回落成浏览器默认裸控件');
  });

  // v2.476：管理后台深链首屏表格异步回填会把页脚从视口内顶出（实测 CLS 0.577）。
  // 修法是给视图一个「视口高地板」；这里守住规则不被后续改样式时顺手删掉。
  it('G4 管理后台视图有视口高地板（防异步回填 CLS）', () => {
    assert.match(css, /#view-admin\s*\{[^}]*min-height:\s*calc\(100vh\s*-\s*\d+px\)/, 'styles.css 缺少 #view-admin 的 min-height 视口地板');
    assert.match(css, /@supports\s*\(min-height:\s*100dvh\)/, '需要 dvh 兜底移动端地址栏收缩');
  });

  it('G2 切视图后把激活导航项滚进可视区（横滑条上仍能看见自己所在栏目）', () => {
    const fn = app.slice(app.indexOf('function switchView('), app.indexOf('function switchView(') + 4000);
    assert.ok(fn.includes('scrollIntoView'), 'switchView 内缺少 scrollIntoView');
    assert.ok(/inline:\s*'center'/.test(fn), '需用 inline:center 让激活项居中，避免只露出一条边');
  });

  it('G3 横滑条有渐隐提示且按滚动位置实时挂/摘', () => {
    assert.match(css, /\.nav\[data-scroll="more"\]\s*\{[\s\S]{0,220}mask-image/, 'styles.css 缺少 .nav[data-scroll="more"] 的渐隐规则');
    assert.ok(app.includes('_syncNavScrollHint'), 'app.js 缺少 _syncNavScrollHint()');
    assert.ok(/_syncNavScrollHint\(\);/.test(app), '缺少滚动/缩放后的重算调用');
    assert.ok(/data-scroll/.test(app), '缺少 data-scroll 挂载逻辑');
  });
});

describe('v2.676 标签台联动回显', () => {
  it('回显块、手动重算按钮、样式与接线齐备', () => {
    assert.match(html, /id="tagCraftEcho"/, 'index.html 缺少标签台递招回显块');
    assert.match(html, /id="tagCraftGo"/, 'index.html 缺少手动重新递招入口');
    assert.match(css, /\.tag-craft-echo\s*\{/, 'styles.css 缺少 .tag-craft-echo 样式');
    assert.ok(app.includes('function renderTagCraftEcho('), 'app.js 缺少回显渲染函数');
    assert.ok(/tagCraftGo[\s\S]{0,80}onclick/.test(app), '手动重算按钮未接线');
  });
});

// v2.677 出本后衔接：结果页必须给「下一步」交接条（分集/版本 + 续写下一集），
// 且顶部分数标题不能再把三格速览称作「六维质量评分」。
describe('v2.677 出本后衔接与评分名实', () => {
  it('结果页有下一步交接条与两个出口', () => {
    assert.match(html, /id="resultNextBar"/, 'index.html 缺少结果页下一步交接条');
    assert.match(html, /id="resultNextWorks"/, 'index.html 缺少查看分集入口');
    assert.match(html, /id="resultNextContinue"/, 'index.html 缺少续写下一集入口');
    assert.ok(app.includes('function renderResultNext('), 'app.js 缺少 renderResultNext 渲染函数');
    assert.match(css, /\.result-next\s*\{/, 'styles.css 缺少 .result-next 样式');
    assert.match(i18n, /nextStepWorks:/, 'i18n 缺少查看分集文案');
    assert.match(i18n, /nextStepContinue:/, 'i18n 缺少续写下一集文案');
  });

  it('三格速览标题改为名实相符的「质量速览」', () => {
    assert.match(i18n, /scoreTitle: '质量速览'/, 'scoreTitle 仍称六维，与三格速览不符');
    assert.match(i18n, /scoreTitle: 'Quality snapshot'/, '英文 scoreTitle 需同步改名');
  });
});

// v2.524 分类浏览按界面语言取数据：不传 lang 时英文界面会一直显示中文钩子与方法卡，
// 且缓存不带语言标记时切语言后不会重拉——这里守住三处接线。
describe('v2.524 递招面板跟随界面语言', () => {
  it('taxonomy 请求带 lang，缓存带语言标记', () => {
    const fn = app.slice(app.indexOf('async function loadCraftTaxonomy('), app.indexOf('async function loadCraftTaxonomy(') + 900);
    assert.ok(/const l = lang === 'en' \? '\?lang=en' : '';/.test(fn), 'taxonomy 请求须按界面语言带 ?lang=en');
    assert.ok(/craftTaxonomyLang === lang/.test(fn), '缓存须带语言标记，否则切语言后不重拉');
    assert.ok(/craftTaxonomyLang = lang;/.test(fn), '拉取成功后须记录当前语言');
  });

  it('切语言时旧语言分类缓存与推荐卡都作废重取', () => {
    const seg = app.slice(app.indexOf('语言切换时同步小南递招面板'), app.indexOf('语言切换时同步小南递招面板') + 700);
    assert.ok(/craftTaxonomyLang !== lang/.test(seg), '切语言须检测语言变化');
    assert.ok(/craftRecCards = \[\]/.test(seg), '旧语言推荐卡须清空，避免中英混排');
    assert.ok(/loadCraftTaxonomy\(\)\.then\(_after\)/.test(seg), '语言变化后须重拉分类再渲染');
  });

  it('已选钩子/卡片按 id 取当前语言名称，出本创意不残留旧语言', () => {
    const hookSeg = app.slice(app.indexOf('function renderCraftHooks('), app.indexOf('function renderCraftHooks(') + 900);
    assert.ok(/const hk = findHook\(h\.id\);/.test(hookSeg), '钩子标签须按 id 解析当前语言名称');
    const brief = app.slice(app.indexOf('function craftBriefLine('), app.indexOf('function craftBriefLine(') + 900);
    assert.ok(/findHook\(h\.id\)/.test(brief), '出本创意里的钩子名须按 id 解析');
    assert.ok(/craftRecCards\.find\(\(x\) => x\.id === c\.id\)/.test(brief), '出本创意里的卡片名须按 id 解析');
  });
});

// v2.525 英文钩子名以分类库为唯一权威：此前 renderCraftHooks / craftBriefLine 在英文界面一律用
// CRAFT_HOOK_EN 短名覆盖分类库全名，同一钩子在标签里是 Episode-end hook、在下拉里却是
// Episode hook (Zeigarnik cliff)，两套英文名；分类卡总数也写死 43，库增删后文案会失真。
describe('v2.525 英文钩子名单一权威与卡片数动态化', () => {
  it('有分类库时直接用库内当前语言名，旧短名映射只作未加载兜底', () => {
    const hookSeg = app.slice(app.indexOf('function renderCraftHooks('), app.indexOf('function renderCraftHooks(') + 1000);
    assert.ok(/const nm = hk \? hk\.name : \(outLocale\(\) === 'en' \? craftHookEn\(h\.id, h\.name\) : h\.name\);/.test(hookSeg), '有分类库时须直接用库内名称，旧短名只作兜底');
    assert.ok(!/craftHookEn\(h\.id, nm\)/.test(hookSeg), '不得用旧短名覆盖分类库全名');
  });

  it('出本创意的钩子名同样以分类库为准', () => {
    const brief = app.slice(app.indexOf('function craftBriefLine('), app.indexOf('function craftBriefLine(') + 1000);
    assert.ok(/return f \? f\.name : \(outLocale\(\) === 'en' \? craftHookEn\(h\.id, h\.name\) : h\.name\);/.test(brief), '出本创意须用库内名称，旧短名只作兜底');
    assert.ok(!/craftHookEn\(h\.id, nm\)/.test(brief), '出本创意不得用旧短名覆盖库内全名');
  });

  it('浏览全部方法卡的张数取分类库总量，不写死 43', () => {
    const seg = app.slice(app.indexOf('function renderCraftCards('), app.indexOf('function renderCraftCards(') + 2400);
    assert.ok(/craftTaxonomy\.totals\.cards/.test(seg), '卡片总数须取分类库 totals.cards');
    assert.ok(!/Browse all 43|浏览全部 43/.test(seg), '不得写死 43，避免分类库增删后文案失真');
  });
});

// v2.526 英文界面全角标点：剧本体检与多版本面板此前在英文下仍输出「：」「」「【】」和顿号，
// 与编剧室 c199 已修的同类问题不一致——中文排版混进英文界面，复制出去的问题单同样带【】。
describe('v2.526 英文界面全角标点不外溢', () => {
  const lint = fs.readFileSync(path.join(ROOT, 'web', 'lint-view.js'), 'utf8');
  const dv = fs.readFileSync(path.join(ROOT, 'web', 'diversity-view.js'), 'utf8');

  it('体检视图：分隔冒号随语言', () => {
    assert.ok(lint.includes("const colon = () => (en() ? ': ' : '：');"), '缺少 colon() 语言化分隔符');
    assert.ok(lint.includes("${esc(i.dim || '')}${colon()}"), '问题行分隔符未走 colon()');
    assert.ok(lint.includes('${esc(t.formula)}${colon()}'), '原型公式分隔符未走 colon()');
    assert.ok(lint.includes('${esc(t.core)}${colon()}'), '原型用法分隔符未走 colon()');
    assert.ok(lint.includes('${esc(t.tip)}${colon()}'), '机制分隔符未走 colon()');
    assert.ok(lint.includes('${esc(T().fail)}${colon()}'), '失败提示分隔符未走 colon()');
    assert.ok(!lint.includes('${esc(t.formula)}：'), '仍残留全角冒号');
  });

  it('体检问题单：英文分组用方括号、问题行不用全角冒号', () => {
    assert.ok(lint.includes("const wrapGroup = (s) => (en() ? `[${s}] ` : `【${s}】`);"), '缺少 wrapGroup()');
    assert.ok(lint.includes("${wrapGroup(g.name || '')}"), '问题单分组标题未走 wrapGroup()');
    assert.ok(lint.includes("${i.dim || ''}${colon()}"), '问题单问题行分隔符未走 colon()');
    assert.ok(!lint.includes('`【${g.name'), '英文下仍会输出【】');
  });

  it('多版本面板：种子标签与错误提示随语言', () => {
    assert.ok(dv.includes("const colon = () => (en() ? ': ' : '：');"), '缺少 colon()');
    assert.ok(dv.includes('const labelOf = (k, v) => (en() ? `${k}: ${v}` : `${k}「${v}」`);'), '缺少 labelOf()');
    assert.ok(dv.includes('${labelOf(t.arch, esc(s.archetype))}'), '种子原型标签未走 labelOf()');
    assert.ok(!dv.includes('${t.arch}「${esc(s.archetype)}」'), '仍残留中文引号');
    assert.ok(dv.includes('${T().seedFail}${colon()}'), '种子失败提示未走 colon()');
    assert.ok(dv.includes('${T().auditFail}${colon()}'), '审计失败提示未走 colon()');
  });

  it('多版本面板：切语言重建行时标签分隔符随语言', () => {
    assert.ok(dv.includes("join(en() ? ', ' : '、')"), '标签拼接仍固定顿号');
  });
});

// v2.527 结果页还有四张卡只在中文写死：AIGC 微节拍 / 伏笔账本 / 角色弧光 / 爆款逆向提示，
// 英文界面整块中文，与同屏其它已双语卡不一致；导出 TXT 的分集头也固定「第N集」。
// 这组守卫把「按界面语言出标签」钉住，防止后续重构把双语分支丢掉。
describe('v2.527 结果页卡片与导出按界面语言出标签', () => {
  const teardown = fs.readFileSync(path.join(ROOT, 'web', 'teardown-view.js'), 'utf8');
  const slice = (start, len) => {
    const i = app.indexOf(start);
    assert.ok(i >= 0, `未找到锚点：${start}`);
    return app.slice(i, i + len);
  };

  it('AIGC 微节拍卡中英双语', () => {
    const seg = slice("const abTip = $('aigcBeatTip');", 1400);
    assert.ok(seg.includes("AIGC micro-beats"), '缺少英文标题');
    assert.ok(seg.includes('Beat ${b.no}'), '拍号未按语言拼');
    assert.ok(seg.includes('Production tips:'), '制作提示未按语言拼');
    assert.ok(!/abTip\.innerHTML = `[^`]*AIGC微节拍/.test(seg), '仍无条件输出中文标题');
  });

  it('伏笔账本卡中英双语', () => {
    const seg = slice("const fsTip = $('foreshadowTip');", 1400);
    assert.ok(seg.includes('Foreshadow ledger'), '缺少英文标题');
    assert.ok(seg.includes('planted in Ep'), '悬空清单集号未按语言拼');
    assert.ok(seg.includes('Foreshadow state is healthy'), '健康兜底未按语言拼');
    assert.ok(!/fsTip\.innerHTML = `[^`]*伏笔账本/.test(seg), '仍无条件输出中文标题');
  });

  it('角色弧光卡中英双语且枚举不再裸出英文键', () => {
    const seg = slice("const atTip = $('arcTrackTip');", 2600);
    assert.ok(seg.includes('Character arcs'), '缺少英文标题');
    assert.ok(seg.includes('emoLabel(') && seg.includes('stageLabel('), '情绪/阶段枚举未本地化');
    assert.ok(seg.includes("'[stalled]'") && seg.includes("'[jump]'"), '停滞/跳变标签未按语言拼');
    assert.ok(seg.includes('Character arcs are healthy'), '正常兜底未按语言拼');
    assert.ok(!/atTip\.innerHTML = `[^`]*角色弧光/.test(seg), '仍无条件输出中文标题');
  });

  it('爆款逆向提示的分隔符随语言，英文不再出现全角冒号顿号', () => {
    const seg = slice("const htTip = $('hitTeardownTip');", 1400);
    assert.ok(seg.includes("const sep = en ? ': ' : '：';"), '缺少语言化冒号');
    assert.ok(seg.includes("const join = en ? '; ' : '；';"), '缺少语言化分号');
    assert.ok(!/\}：\$\{reasons\}/.test(seg), '英文提示仍固定全角冒号');
    assert.ok(!/x\.point\}（\$\{t\.reuse\}/.test(seg), '技法括号未按语言拼');
  });

  it('AIGC 仪表盘元信息分隔符随语言', () => {
    assert.ok(app.includes("${en ? 'Total chars' : '全集字数'}${en ? ': ' : '：'}"), '全集字数分隔符未按语言');
    assert.ok(app.includes("${en ? 'Format score' : '制式得分'}${en ? ': ' : '：'}"), '制式得分分隔符未按语言');
  });

  it('导出 TXT 的分集头随界面语言（英文不再「第N集」）', () => {
    const seg = app.slice(app.indexOf('async function refreshResultScripts('), app.indexOf('async function refreshResultScripts(') + 1200);
    assert.ok(seg.includes("lang === 'en' ? 'Episode ' : '第'"), '分集头未按语言拼');
    assert.ok(!/`第\$\{s\.epNo\}集 \$\{s\.title \|\| ''\}/.test(seg), '仍无条件输出「第N集」');
  });

  it('拆爆款技法行的竖线与冒号随界面语言', () => {
    assert.ok(teardown.includes("const sepDot = en() ? ' | ' : '｜';"), '缺少语言化竖线');
    assert.ok(teardown.includes("const sepColon = en() ? ': ' : '：';"), '缺少语言化冒号');
    assert.ok(!/\}｜\$\{t\.reuse\}：/.test(teardown), '技法行仍固定全角标点');
  });
});

// v2.528 资方视角：后端引擎早已支持双语，但前端不传 lang、路由不读 lang，
// 英文界面只能拿到中文结论；情绪波形则只在 en 下切英文名，ja/ko/es/ar 仍吐中文节拍名。
describe('v2.528 资方视角与情绪波形的语言接线', () => {
  it('资方视角请求带上界面语言', () => {
    const seg = app.slice(app.indexOf("'/api/market/investor-lens'") - 300, app.indexOf("'/api/market/investor-lens'") + 400);
    assert.ok(/lang: lang === 'en' \? 'en' : 'zh'/.test(seg), '请求体缺少 lang，后端只能出中文');
  });

  it('情绪波形非中文界面统一取英文名，分隔符随语言', () => {
    const seg = app.slice(app.indexOf('const beatName = (q) =>'), app.indexOf('const beatName = (q) =>') + 500);
    assert.ok(/wloc === 'zh' \? q\.name : \(q\.nameEn \|\| q\.name\)/.test(seg), '非中文界面仍可能吐中文节拍名');
    assert.ok(/wloc === 'zh' \? '｜' : ' \| '/.test(seg), '波形标签竖线未随语言');
  });
});

// v2.529 英文界面仍有多处「括号与集号」硬编码中文全角：投稿渠道展开按钮、成人准入状态、
// 方法卡分组计数、上架下拉、资产截断提示、体检优先修改清单标题与复制报告、跨项目对标集号。
describe('v2.529 英文界面括号与集号不外溢', () => {
  it('投稿渠道展开按钮的计数括号随语言', () => {
    const seg = app.slice(app.indexOf('function syncSubAllLabel('), app.indexOf('function syncSubAllLabel(') + 700);
    assert.ok(/lang === 'en'/.test(seg), '展开态文案未按语言分支');
    assert.ok(/\(`?\$\{t\('subHideAll'\)\} \(\$\{subAllCache\.channels\}/.test(seg) || /\$\{t\('subHideAll'\)\} \(\$\{subAllCache\.channels\}/.test(seg), '英文分支仍用全角括号');
    assert.ok(/（\$\{subAllCache\.channels\}/.test(seg), '中文分支应保持全角括号');
  });

  it('成人准入状态与跨项目对标集号随语言', () => {
    assert.ok(/lang === 'en' \? ` \(\$\{T\.signed\}\$\{until\}\)` : `（\$\{T\.signed\}\$\{until\}）`/.test(app), '准入状态括号未按语言');
    assert.ok(/lang === 'en' \? ` \(\$\{p\.totalEps\} eps\)` : `（\$\{p\.totalEps\}集）`/.test(app), '对标项目集号未按语言');
  });

  it('方法卡分组计数、上架下拉、截断提示的括号随语言', () => {
    assert.ok(app.includes("` (${g.count})` : `（${g.count}）`"), '方法卡分组计数未按语言');
    assert.ok(app.includes("` (${p.totalEps || 0} eps)` : `（${p.totalEps || 0} eps）`"), '上架下拉未按语言');
    assert.ok(app.includes("` (${t('dashTrunc'"), '资产截断提示英文仍用全角括号');
  });

  it('体检优先修改清单标题与复制报告随语言', () => {
    assert.ok(app.includes("` (${fixes.length})` : `（${fixes.length}）`"), '优先修改清单标题未按语言');
    assert.ok(app.includes('[Full-script quality report] Overall '), '复制报告头未按语言');
    assert.ok(app.includes("en ? '[Priority fix list]' : '【优先修改清单】'"), '复制报告分组未按语言');
  });
});

// v2.530 围读语言与 c199 制式同源：重跑围读必须能按当前界面语言出报告，
// 否则老房/切语言后 AI 围读永远停在开房时的语言。前端要带上 lang，后端才可覆盖并回写 payload。
describe('v2.530 围读请求按界面语言接线', () => {
  const roomView = fs.readFileSync(path.join(ROOT, 'web', 'room-view.js'), 'utf8');

  it('ai-read 请求体带 lang（界面语言）', () => {
    const i = roomView.indexOf('/ai-read');
    assert.ok(i > 0, '找不到 ai-read 调用');
    const seg = roomView.slice(i, i + 220);
    assert.ok(/lang: en\(\) \? 'en' : 'zh'/.test(seg), 'ai-read 未带 lang，后端只能沿用开房语言');
    assert.ok(/mode: \$\('readFormat'\)\.value/.test(seg), 'ai-read 应同时保留制式（c199）');
  });
});

// v2.531 拆爆款改编大纲：v2.527 收了拆解结果里的技法行标点，但「改编大纲」整块仍是固定
// 全角「：」「；」「（）」，英文界面生成的大纲复制出去夹带中文排版（一键复制取的是 innerText）。
describe('v2.531 拆爆款改编大纲标点随界面语言', () => {
  const td = fs.readFileSync(path.join(ROOT, 'web', 'teardown-view.js'), 'utf8');
  const seg = td.slice(td.indexOf('function renderOutline('), td.indexOf('function renderOutline(') + 2400);

  it('大纲渲染使用语言化冒号、分号与括号', () => {
    assert.ok(seg.includes("const colon = en() ? ': ' : '：';"), '缺少语言化冒号');
    assert.ok(seg.includes("const semi = en() ? '; ' : '；';"), '缺少语言化分号');
    assert.ok(/const paren = \(s\) => \(en\(\) \? ` \(\$\{s\}\)` : `（\$\{s\}）`\);/.test(seg), '缺少语言化括号');
    assert.ok(!seg.includes('${t.logline}：'), '一句话仍固定全角冒号');
    assert.ok(!seg.includes('${t.want}：'), '人物欲望/底牌仍固定全角冒号');
    assert.ok(!seg.includes('${esc(c.name)}（${esc(c.role)}）'), '人物角色仍固定全角括号');
    assert.ok(seg.includes('${paren(esc(c.role))}'), '人物角色未走语言化括号');
  });
});

// v2.675 独立递招必须自带创作上下文：此前从首页进入仍读取隐藏标签台的空创意/随机标签，
// 「按当前创意递招」名实不符；生成按钮又聚焦当前面板不存在的 modeBrief。开篇审计只弹一次
// toast，也无法对照原文修改。本组把输入、请求、出本、审计失效和响应式动效一次钉住。
describe('v2.675 独立递招的创作上下文与开篇审计闭环', () => {
  const i18n = fs.readFileSync(path.join(ROOT, 'web', 'i18n.js'), 'utf8');

  it('创作底稿与持久审计骨架完整，所有新增文案中英双份', () => {
    for (const id of ['craftContext', 'craftIdea', 'craftOpening', 'craftOpeningAudit']) {
      assert.ok(html.includes(`id="${id}"`), `index.html 缺少 #${id}`);
    }
    assert.ok(html.includes('for="craftIdea"') && html.includes('for="craftOpening"'), '两个输入都应有显式 label');
    for (const key of ['craftContextTitle', 'craftContextSub', 'craftIdeaLabel', 'craftIdeaPh', 'craftOpeningLabel', 'craftOpeningPh', 'craftOpeningHint', 'craftNeedIdea', 'craftAuditTitle', 'craftAuditUsed', 'craftAuditEmpty', 'craftAuditNext']) {
      const hits = i18n.match(new RegExp(`\\b${key}:`, 'g')) || [];
      assert.equal(hits.length, 2, `${key} 必须同时存在于 zh/en 字典`);
    }
  });

  it('独立推荐读取可见创意与开篇，标签台路径才携带 tags', () => {
    const i = app.indexOf('async function craftGo(');
    const seg = app.slice(i, app.indexOf('const craftGoBtn', i));
    assert.ok(seg.includes("const useTagContext = $('tagBench')"), '必须显式区分标签台联动与独立递招');
    assert.ok(seg.includes("$('craftIdea')"), '独立推荐未读取可见创意');
    assert.ok(seg.includes("$('craftOpening')"), '独立推荐未读取可见开篇');
    assert.ok(seg.includes('tags: useTagContext ? tagChosen : []'), '独立推荐不得发送隐藏随机标签');
    assert.ok(seg.includes("t('craftNeedIdea')"), '空创意应给当前面板内的明确提示');
    assert.ok(seg.includes('renderCraftOpeningAudit(j.openingAudit)'), '审计结果必须进入持久结果区');
  });

  it('独立递招出本读取自己的创意，并按自动匹配模式立项', () => {
    const i = app.indexOf('async function startGenerate(');
    const seg = app.slice(i, i + 10500);
    assert.ok(seg.includes('const useCraftBench ='), '缺少独立递招出本分支');
    assert.ok(seg.includes('const generationMode = useCraftBench ?'), '独立递招必须切到自动匹配出本');
    assert.ok(seg.includes("brief = ($('craftIdea')?.value || '').trim()"), '出本仍读取隐藏 modeBrief');
    assert.ok(seg.includes('mode: generationMode'), '立项 mode 未使用本次出本模式');
    assert.ok(seg.includes("...(generationMode === 'auto' ? { brief: brief.trim() } : {})"), '自动匹配立项缺少 brief');
  });

  it('创意变化作废旧推荐，开篇变化作废旧审计，但保留已选手法', () => {
    const i = app.indexOf('function wireCraftContext(');
    const seg = app.slice(i, i + 1800);
    assert.ok(i >= 0, '缺少创作底稿输入接线');
    assert.ok(seg.includes('craftRecCards = []'), '创意变化后旧推荐仍冒充当前匹配');
    assert.ok(seg.includes('renderCraftOpeningAudit(null)'), '开篇变化后旧审计仍残留');
    assert.ok(!seg.includes('craftSelCards = []') && !seg.includes('craftSelHooks = []'), '输入变化不得清空用户已选手法');
  });

  it('底稿桌面双栏、移动单栏，审计浮现支持减少动态效果', () => {
    assert.match(css, /\.craft-context-grid\s*\{[^}]*grid-template-columns:/, '缺少底稿双栏布局');
    assert.match(css, /@media \(max-width:640px\)\{[^}]*\.craft-context-grid[^}]*grid-template-columns:1fr/, '缺少移动端单栏降级');
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{[^}]*\.craft-opening-audit/, '审计动画缺少 reduced-motion 降级');
  });
});

// v2.679 分集卡片可读性：标题与四个操作按钮原先全塞在同一个 h4 里，
// 390px 下挤成一团；英文长标题被从中截断且无法查看全名。
describe('v2.679 分集卡片标题与操作分行', () => {
  it('头部把标题/元信息与操作组分开，窄屏自动换行', () => {
    assert.match(app, /class="ep-head"/, '缺少分集头部容器');
    assert.match(app, /class="ep-head-main"/, '缺少标题主区');
    assert.match(app, /class="ep-actions"/, '缺少操作组容器');
    assert.match(css, /\.ep-head\{[^}]*display:flex[^}]*flex-wrap:wrap/, '头部需可换行');
    assert.match(css, /\.ep-actions\{[^}]*display:flex[^}]*flex-wrap:wrap/, '操作组需可换行');
    assert.match(app, /class="ep-name" title="/, '长标题需带 title 供悬停查看全名');
    assert.match(css, /\.ep-name\{[^}]*text-overflow:ellipsis/, '长标题需省略号而非硬溢出');
    const epMobile = css.match(/@media screen and \(max-width:640px\)\{\s*\.ep-head\{[\s\S]*?\n\}/);
    assert.ok(epMobile && /\.ep-name\{[^}]*white-space:normal/.test(epMobile[0]), '窄屏英文长标题需换行展示');
  });
  it('操作按钮不再用 margin-left 拼接，由 flex gap 统一控距', () => {
    assert.ok(!/\.ep-copy-btn\{margin-left:8px/.test(css), '复制按钮仍靠 margin-left 挤在标题后');
    assert.ok(!/\.ep-listen-btn\{margin-left:8px/.test(css), '听剧本按钮仍靠 margin-left 挤在标题后');
  });
  // 390px 英文下顶栏控件区内容 354px、可视 267px，账号按钮整体落在屏外且无任何滑动提示。
  // 吸右会压住反馈按钮抢点击（审计 7 处 clickStolen），故改为账号前置 + 控件横滑。
  it('移动端顶栏账号按钮优先可见，其余控件可横滑', () => {
    const m = css.match(/@media screen and \(max-width:640px\)\{\s*\.ctl\{[\s\S]*?\n\}/);
    assert.ok(m, '缺少移动端 .ctl 规则');
    assert.match(m[0], /overflow-x:auto/, '控件区应允许横滑而不是裁掉账号入口');
    assert.match(css, /#loginBtn\{order:-1/, '账号按钮未前置到控件区首位');
  });
});
