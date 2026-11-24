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
