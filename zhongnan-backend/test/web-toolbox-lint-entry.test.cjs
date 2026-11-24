const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.511 剧本体检入口：/api/craft/lint 与 /api/craft/archetype-match 是免费只读端点，
// 但此前前端零入口——能力已实现、用户却用不到。这里守住「工具卡 → 面板 → 视图脚本 → 端点」整条链路，
// 任何一环被删（卡片、映射、收起重绑、脚本注册）都要立刻变红。
const root = path.join(__dirname, '../web');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const constants = fs.readFileSync(path.join(root, 'data/constants.js'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');

describe('v2.511 剧本体检：工具箱入口与免费端点接线', () => {
  it('工具箱与首页都有「剧本体检」卡片，且卡片标题为 h2/h3 不跳级', () => {
    assert.match(html, /id="toolCraftLint"/, '工具箱须有 toolCraftLint 卡片');
    assert.match(html, /<h2 data-i="tbCardLint">/, '工具箱卡片标题应为 h2');
    assert.match(html, /<h3 data-i="tbCardLint">/, '首页工具卡标题应为 h3');
    assert.match(constants, /id:\s*'toolCraftLint'/, 'HOME_TOOLS 须登记 toolCraftLint');
    assert.match(app, /id:\s*'toolCraftLint'/, 'app.js 的 HOME_TOOLS 兜底清单须同步');
  });

  it('面板默认隐藏且输入/动作/结果/收起节点齐全', () => {
    const panel = html.match(/<section class="panel hidden" id="lintPanel">[\s\S]*?<\/section>/);
    assert.ok(panel, '须存在默认 hidden 的 lintPanel');
    for (const id of ['lintText', 'lintRunBtn', 'lintArchBtn', 'lintResult', 'lintClose']) {
      assert.ok(panel[0].includes(`id="${id}"`), `lintPanel 内须有 #${id}`);
    }
  });

  it('工具卡 → 面板映射、工作台层、收起重绑三处都已接线', () => {
    assert.match(app, /toolCraftLint:\s*'lintPanel'/, '_TOOL_TO_PANEL 须含 toolCraftLint');
    assert.match(app, /'lintPanel'/, '_WORKBENCH_PANEL_IDS 须含 lintPanel');
    assert.match(app, /lintClose/, '收起按钮须重绑到 closeWorkbench');
    assert.match(app, /lintPanel:\s*\{\s*zh:/, 'WORKBENCH_TITLES 须给 lintPanel 标题');
  });

  it('独立视图脚本已注册，并真实调用两个免费端点', () => {
    assert.match(html, /<script defer src="\.\/lint-view\.js"><\/script>/, 'index.html 须注册 lint-view.js');
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /\/api\/craft\/lint\b/, '须调用 POST /api/craft/lint');
    assert.match(view, /\/api\/craft\/archetype-match\b/, '须调用 POST /api/craft/archetype-match');
    assert.match(view, /P0/, '结果须按 P0/P1/P2 分级呈现');
  });

  it('中英文案齐全且明示免费不耗积分', () => {
    for (const key of ['tbCardLint', 'tbCardLintP', 'tbCostLint', 'tbLintHint', 'tbLintRun', 'tbLintArch']) {
      const hits = i18n.match(new RegExp(key + ':', 'g')) || [];
      assert.ok(hits.length >= 2, `${key} 须同时有中英两份文案`);
    }
    assert.match(i18n, /不耗积分/, '中文须明示不耗积分');
    assert.match(i18n, /no credits/i, '英文须明示 no credits');
  });

  it('成稿抽检卡可一键把正文送进完整体检（生成后 → 体检闭环）', () => {
    assert.match(app, /data-lint-send>/, '抽检提示须带「送进完整体检」入口按钮');
    assert.match(app, /ta\.value = text/, '发送时须回填 lintText');
    assert.match(app, /run\.click\(\)/, '回填后须真正触发体检');
    assert.match(i18n, /lintOpenFull:/, '须有入口专属文案');
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /\$\('lintRunBtn'\)\.onclick = runLint/, '体检按钮须绑定执行函数');
  });

  it('多集正文自动拆分后按 episodes 体检（情绪线与开篇留存规则才有效）', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /function splitEpisodes/, '须按「第 X 集 / EPn」切分分集');
    assert.match(view, /episodes: eps/, '须把分集数组发给 /api/craft/lint');
    assert.match(view, /epsNote: \(n, total\)/, '须告知用户已按几集体检（否则用户不知道多集规则生效）');
    assert.match(view, /renderLint\(d, eps\.length, meta\)/, '体检结果须带上实际集数才显示提示');
  });

  it('体检结果可一键复制成纯文本问题单（拿给改稿环节直接用）', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /function reportText\(d, epsN, meta\)/, '须把结构化结果拼成可读问题单');
    assert.match(view, /data-lint-copy/, '结果区须有复制按钮');
    assert.match(view, /copyReport:/, '须有复制按钮文案');
    assert.match(view, /closest\('\[data-lint-copy\]'\)/, '复制按钮须用事件委托（结果重渲染不丢绑定）');
  });

  it('选填大纲与本集结尾可解锁「终局倒推」「集尾断章」两条规则', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /id="lintEnding"/, '面板须有本集结尾输入框');
    assert.match(html, /id="lintOutline"/, '面板须有终局大纲输入框');
    assert.match(view, /\$\('lintEnding'\)/, '须读取本集结尾');
    assert.match(view, /\$\('lintOutline'\)/, '须读取大纲');
    assert.match(view, /\.ending = ending/, '须把本集结尾发给后端（否则断章规则永不触发）');
    assert.match(view, /\.outline = outline/, '须把大纲发给后端（否则终局倒推规则永不触发）');
  });

  it('体检结果按严重度排序，并提示因未填选填项而没跑的检查', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /function sortByLevel\(list\)/, '须提供严重度排序');
    assert.match(view, /LEVEL_RANK\[a\.level\]/, '须按 P0 → P2 排序');
    assert.match(view, /unlockHint:/, '须有「未运行检查」提示文案');
    assert.match(view, /meta\.ending/, '须记录本集结尾是否填写');
    assert.match(view, /meta\.outline/, '须记录大纲是否填写');
  });

  it('体检口径与分组数一致：只有五组全过才提示通过，未填项不渲染 undefined', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /allClear: '✔ 五组检查均未发现硬伤/, '通过提示须与实际五组一致（仍写三组会误报已全过）');
    assert.match(view, /allClear: '✔ All five groups passed/, '英文通过提示须与实际五组一致');
    // 此前引用了 i18n 的键名却取在视图自有字典上，运行时拼出「未填「undefined / undefined」」
    assert.doesNotMatch(view, /t\.tbLint(Ending|Outline)L/, '体检视图不能引用自身字典里不存在的键，界面上会出现 undefined');
    assert.match(view, /miss\.push\(t\.lhEnding\)/, '未填本集结尾须用视图内文案');
    assert.match(view, /miss\.push\(t\.lhOutline\)/, '未填终局大纲须用视图内文案');
    assert.match(view, /lhEnding: '本集结尾（选填）'/, '视图字典须自带本集结尾标签');
    assert.match(view, /lhOutline: '终局大纲（选填）'/, '视图字典须自带终局大纲标签');
  });

  it('工具卡 / 面板说明与静态兜底文案都按五组口径描述体检范围', () => {
    assert.doesNotMatch(i18n, /网文钩子三组逐条体检/, '中文说明仍写三组，与实际五组不符');
    assert.match(i18n, /改稿尺子、叙事逻辑五组逐条体检/, '中文说明须写明新增的改稿尺子与叙事逻辑');
    assert.doesNotMatch(i18n, /against three groups/, '英文说明仍写 three groups');
    assert.match(i18n, /five groups/i, '英文说明须为 five groups');
    assert.doesNotMatch(html, /网文钩子三组逐条体检/, 'index.html 静态兜底文案仍写三组');
  });

  it('体检面板可填剧名：填了才送后端，剧名尺子才跑', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /const title = String\(\(\$\('lintTitle'\) \|\| \{\}\)\.value \|\| ''\)\.trim\(\);/, '须读取剧名输入框');
    assert.match(view, /if \(title\) body\.title = title;/, '剧名选填，不填不发，避免无据结论');
    assert.match(html, /id="lintTitle"/, '体检面板须提供剧名输入框');
    assert.match(html, /data-i="tbLintTitleL"/, '剧名标签须走 i18n');
    assert.match(i18n, /tbLintTitleL:/, 'i18n 缺剧名标签');
  });

  it('两处静默截断都要明示：正文超 2 万字、集数超 10 集', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /return \{ eps: all\.slice\(0, 10\), total: all\.length \};/, '拆集须同时回报总集数，否则用户不知后 20 集没检');
    assert.match(view, /const \{ eps, total: totalEps \} = splitEpisodes\(text\);/, '须使用拆集回报的总集数');
    assert.match(view, /其余未检/, '超限须明说其余未检');
    assert.match(view, /d\.truncated/, '正文超限须在结果里提示');
    assert.match(view, /const cutNote = d\.truncated \?/, '截断提示须在结果头部渲染，不能只写进复制文本');
    assert.match(view, /\$\{cutNote\}/, '截断提示须真的插进结果 DOM');
  });

  it('递招带上已有正文的开篇与界面语言（开篇审计不再睡死）', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(app, /if \(lang === 'en'\) body\.lang = 'en';/, '递招须带上界面语言');
    assert.match(app, /const openingEl = useTagContext \? \$\('scriptText'\) : \$\('craftOpening'\);/, '须按当前递招上下文选择正文来源');
    assert.match(app, /const openingText = useTagContext \? openingEl\?\.textContent : openingEl\?\.value;/, '创作台正文是 div，须读取 textContent');
    assert.match(app, /const opening = String\(openingText \|\| ''\)\.trim\(\)\.slice\(0, 1200\);/, '须取当前正文前 1200 字作为开篇');
    assert.match(app, /if \(opening\) body\.opening = opening;/, '有正文时才发开篇，避免空文本触发无依据结论');
  });

  it('原型选型跟随界面语言（英文界面不得返回中文原型）', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /archetype-match', \{ text, lang: en\(\) \? 'en' : 'zh' \}/, '须把界面语言发给原型选型端点');
  });

  it('作品库每集成稿可直接一键体检（不必手动复制正文）', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(app, /ep-lint-btn/, '每集成稿须有体检入口');
    assert.match(app, /data-lint-ep=/, '体检入口须携带集号');
    assert.match(app, /epTextMap\.get/, '须把该集正文填进体检面板');
    assert.match(app, /if \(run\) run\.click\(\)/, '填好后须自动开跑');
  });
});
