/**
 * v2.648 「我的交易」加载更多 —— 守卫 web/app.js / web/i18n.js / web/styles.css
 * 背景：GET /api/market/my 首屏旧字段 sales/buys 最多各 50 条，新增 salesNextCursor/buysNextCursor
 * 与 salesHasMore/buysHasMore 元信息后，前端必须真正消费并支持续页追加；否则后端修好了、
 * 用户界面仍只看得到 50 笔，缺口并未关闭。静态断言消费侧不被回退（读源码，不起服务器）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
const i18n = fs.readFileSync(path.join(WEB, 'i18n.js'), 'utf8');
const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8');

function regionOf(startMark, endMark) {
  const start = src.indexOf(startMark);
  if (start < 0) return '';
  const end = src.indexOf(endMark, start);
  return end < 0 ? src.slice(start) : src.slice(start, end);
}

describe('v2.648 我的交易续页消费', () => {
  const stateRegion = regionOf('let mkMineState = null;', "$('mkMineBtn').onclick");
  const openRegion = regionOf("$('mkMineBtn').onclick", '// ═══ MODULE: generate');

  it('首屏把分页元信息落入状态（缺失时回归旧行为）', () => {
    assert.match(openRegion, /buysCursor:\s*d\.buysNextCursor\s*\|\|\s*''/, '应消费 buysNextCursor');
    assert.match(openRegion, /salesCursor:\s*d\.salesNextCursor\s*\|\|\s*''/, '应消费 salesNextCursor');
    assert.match(openRegion, /buysHasMore:\s*!!d\.buysHasMore/, '应消费 buysHasMore');
    assert.match(openRegion, /salesHasMore:\s*!!d\.salesHasMore/, '应消费 salesHasMore');
    assert.match(openRegion, /buys:\s*d\.buys\s*\|\|\s*\[\]/, '旧后端无字段时退化为空数组，不抛错');
  });

  it('首屏与续页共用同一渲染器，避免卡片/按钮复制漂移', () => {
    assert.match(stateRegion, /function renderMkMine\(\)/, '应有统一渲染器');
    assert.match(stateRegion, /st\.buys\.map\(\(x\) => row\(x, true\)\)/, '买入行由状态渲染');
    assert.match(stateRegion, /st\.sales\.map\(\(x\) => row\(x, false\)\)/, '卖出行由状态渲染');
    assert.strictEqual((stateRegion.match(/data-mine-more=/g) || []).length >= 1, true, '应渲染加载更多按钮');
  });

  it('续页请求带 kind + cursor + limit，并按 id 去重后追加', () => {
    assert.match(stateRegion, /\/api\/market\/my\?kind=\$\{kind\}&limit=50&cursor=/, '续页应走单侧游标端点');
    assert.match(stateRegion, /new Set\(st\[kind\]\.map\(\(x\) => x\.id\)\)/, '追加前应按 id 去重');
    assert.match(stateRegion, /st\[`\$\{kind\}HasMore`\] = !!d\.hasMore/, '续页后更新 hasMore');
    assert.match(stateRegion, /st\[`\$\{kind\}Cursor`\] = d\.nextCursor \|\| ''/, '续页后推进游标');
  });

  it('续页遵循账号切换守卫，旧账号响应不得落到新会话', () => {
    assert.match(stateRegion, /isPrivateSessionCurrent\(st\.account\)/, '续页异步返回必须校验会话归属');
    assert.match(stateRegion, /st\.loading\) return/, '重复点击不得并发翻页');
  });

  it('i18n 双语均有「加载更多/加载更多」文案，样式抽屉目录存在', () => {
    assert.match(i18n, /loadMore: '加载更多'/, '中文文案缺失');
    assert.match(i18n, /loadMore: 'Load more'/, '英文文案缺失');
    assert.match(css, /\.deal-more\{/, '加载更多容器样式缺失');
  });
});
