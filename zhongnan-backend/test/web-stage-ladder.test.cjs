// v2.672 打磨阶梯：静态契约守卫
// 只查"接线是否齐、文案是否双份、动效是否有降级出口"，不重复跑引擎逻辑（引擎由 stage-scorecard 覆盖）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('web/index.html');
const app = read('web/app.js');
const view = read('web/stage-ladder-view.js');
const css = read('web/styles.css');
const i18n = read('web/i18n.js');
const route = read('src/routes/craft.ts');

test('工具箱卡片与面板骨架齐备', () => {
  assert.match(html, /id="toolStage"/);
  assert.match(html, /id="stageLadder"/);
  assert.match(html, /id="stageRail"/);
  assert.match(html, /id="stageDetail"/);
  assert.match(html, /id="stageLadderClose"/);
  assert.match(html, /data-i="tbCardStage"/);
});

test('工作台与工具栏注册：面板可被打开、可被关闭、可被卡片唤起', () => {
  assert.match(app, /'stageLadder'/);
  assert.match(app, /stageLadder:\s*\{/);
  assert.match(app, /toolStage:\s*'stageLadder'/);
  assert.match(app, /'stageLadderClose'/);
});

test('视图模块接线：调两个免费端点、渲染阶梯与判定', () => {
  assert.ok(view.includes("'use strict'"));
  assert.match(view, /\/api\/craft\/stages/);
  assert.match(view, /\/api\/craft\/stage-check/);
  assert.match(view, /data-stage-check/);
  assert.match(view, /data-stage-node/);
  assert.match(view, /id="stageText"/);
  assert.match(view, /id="stageVerdict"/);
});

test('后端两条免费路由存在', () => {
  assert.match(route, /r\.get\('\/stages'/);
  assert.match(route, /r\.post\('\/stage-check'/);
  assert.match(route, /stageGaps/);
});

test('文案中英双份：卡片 + 面板标题 + 副标题', () => {
  for (const key of ['tbCardStage', 'tbCardStageP', 'tbCostStage', 'stageLadderTitle', 'stageLadderFree', 'stageLadderSub']) {
    const hits = i18n.match(new RegExp(`\\b${key}\\s*:`, 'g')) || [];
    assert.ok(hits.length >= 2, `i18n 键 ${key} 应中英各一份，实际 ${hits.length}`);
  }
});

test('样式齐备且动效带降级出口', () => {
  for (const cls of ['.stage-rail', '.stage-node', '.stage-idx', '.stage-detail', '.stage-verdict', '.stage-gap']) {
    assert.ok(css.includes(cls), `styles.css 缺 ${cls}`);
  }
  const tail = css.slice(css.indexOf('.stage-rail'));
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(tail), '打磨阶梯动效必须带降级出口');
});

// ── v2.673 创作端一致性：结论与输入同步 + 草稿不丢 + 进度可读 ──
test('v2.673 草稿与通过态落本地：刷新不丢，且可单阶清空', () => {
  assert.match(view, /zn_stage_drafts/, '草稿应持久化到 localStorage');
  assert.match(view, /zn_stage_passed/, '通过态应持久化，刷新后阶梯勾选不丢');
  assert.match(view, /data-stage-clear/, '应提供「清空本阶」入口');
  assert.match(view, /localStorage\.setItem/, '写入必须走 localStorage');
  // 读写必须真用同一组键（放在常量里最容易「声明了却没接上」）
  assert.match(view, /readLS\(LS_DRAFT\)/, '草稿应经 readLS(LS_DRAFT) 读取');
  assert.match(view, /writeLS\(LS_DRAFT, drafts\)/, '草稿应在输入/判定时写回');
  assert.match(view, /writeLS\(LS_PASSED, passed\)/, '通过态应在判定时写回');
  // 清空要同时撤销该阶的判定结论，避免「文本清空了、勾还在」
  assert.match(view, /delete drafts\[/, '清空应删除该阶草稿');
  assert.match(view, /delete passed\[/, '清空应撤销该阶通过态');
});

test('v2.673 结论随输入失效 + 通过卡给下一步 + 截断如实提示', () => {
  // 输入变化即撤销上一轮结论（与 v2.664 剧本体检同一条原则：界面结论只对提交那一刻成立）
  assert.match(view, /stage-verdict stale/, '输入改动后结论应转为过期提示');
  assert.match(view, /verdict\.className = 'stage-verdict stale'/, '过期提示必须真的落到 #stageVerdict');
  assert.match(view, /staleHint/, '过期提示需有双语文案');
  assert.match(view, /delete lastResult\[/, '输入改动应丢弃该阶旧结论');
  assert.match(view, /delete passed\[/, '输入改动应撤销该阶通过态');
  // 通过卡不再让用户自己找下一阶（模板 + 点击代理都要在）
  assert.match(view, /data-stage-next/, '通过卡应有「进入下一阶」按钮');
  assert.match(view, /closest\('\[data-stage-next\]'\)/, '点击代理需处理 data-stage-next');
  assert.match(view, /nextRung/, '下一步按钮文案需双语');
  // 后端截断必须让用户知道（此前 truncated 字段被白白丢掉）
  assert.match(view, /r\.truncated/, '应消费后端 truncated 字段');
  assert.match(view, /truncatedNote/, '截断提示需有双语文案');
});

test('v2.673 进度总览 + 竖排方向键，与既有 tablist 交互一致', () => {
  assert.match(html, /id="stageProgress"/, '面板需有进度总览节点');
  assert.match(html, /aria-orientation="vertical"/, '竖排 tablist 应声明 aria-orientation');
  assert.match(view, /stageProgress/, '模块应刷新进度文案');
  assert.match(view, /passedCount/, '进度文案需双语');
  assert.match(view, /ArrowDown/, '竖排 tablist 应支持 ↓ 切阶');
  assert.match(view, /ArrowUp/, '竖排 tablist 应支持 ↑ 切阶');
});

test('v2.673 新增样式齐备且动效有降级出口', () => {
  for (const cls of ['.stage-progress', '.stage-next', '.stage-verdict.stale']) {
    assert.ok(css.includes(cls), `styles.css 缺 ${cls}`);
  }
  const tail = css.slice(css.indexOf('.stage-progress'));
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(tail), '新增动效必须带降级出口');
});

// ── v2.674 入口一致性：首页卡片与工作台标题表都要认打磨阶梯 ──
// 教训：v2.672 只把 stageLadder 加进 app.js 的兜底对象，而线上实际读的是
// window.ZN_DATA.WORKBENCH_TITLES（constants.js）；两条数据源不同步时，
// 工作台标题会静默退化成面板里的静态文字，首页也永远不出现这张卡。
test('v2.674 首页工具卡与工作台标题表包含打磨阶梯', () => {
  const app = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
  const constants = fs.readFileSync(path.join(__dirname, '../web/data/constants.js'), 'utf8');
  assert.match(constants, /id: 'toolStage', key: 'tbCardStage'/, 'constants.js 的 HOME_TOOLS 应含打磨阶梯（首页实际读这里）');
  assert.match(constants, /stageLadder:\s*\{\s*zh: '打磨阶梯/, 'constants.js 的 WORKBENCH_TITLES 应含打磨阶梯标题');
  assert.match(app, /id: 'toolStage', key: 'tbCardStage'/, 'app.js 兜底 HOME_TOOLS 应与 constants.js 对齐');
});
