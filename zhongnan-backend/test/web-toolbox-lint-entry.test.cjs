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
    assert.match(view, /epsNote: \(n\)/, '须告知用户已按几集体检（否则用户不知道多集规则生效）');
    assert.match(view, /renderLint\(d, eps\.length\)/, '体检结果须带上实际集数才显示提示');
  });

  it('体检结果可一键复制成纯文本问题单（拿给改稿环节直接用）', () => {
    const view = fs.readFileSync(path.join(root, 'lint-view.js'), 'utf8');
    assert.match(view, /function reportText\(d, epsN\)/, '须把结构化结果拼成可读问题单');
    assert.match(view, /data-lint-copy/, '结果区须有复制按钮');
    assert.match(view, /copyReport:/, '须有复制按钮文案');
    assert.match(view, /closest\('\[data-lint-copy\]'\)/, '复制按钮须用事件委托（结果重渲染不丢绑定）');
  });
});
