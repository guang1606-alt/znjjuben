/**
 * v2.651 知识审核续页消费侧守卫：后端开放游标后，超管后台必须有真实「加载更多」入口，
 * 续页按 id 去重追加，并继续提供通过/驳回/归档/恢复动作，不能只改接口不改界面。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const start = src.indexOf('let admKnowledgeItems');
const end = src.indexOf('async function downloadSkillPackage()', start);
const block = start < 0 ? '' : src.slice(start, end < 0 ? undefined : end);

describe('v2.651 超管知识审核续页消费', () => {
  it('续页请求保留 status、limit=50 与 cursor，并推进分页状态', () => {
    assert.match(block, /async function loadMoreAdmKnowledge\(\)/, '必须有独立续页函数，避免按钮 MouseEvent 被当作 append 参数');
    assert.match(block, /q\.set\('limit', '50'\)/);
    assert.match(block, /q\.set\('status', status\)/);
    assert.match(block, /q\.set\('cursor', cursor\)/);
    assert.match(block, /admKnowledgeHasMore = !!d\.hasMore/);
    assert.match(block, /admKnowledgeCursor = d\.nextCursor \|\| ''/);
  });

  it('按 id 去重追加，首屏与续页复用同一渲染器', () => {
    assert.match(block, /new Set\(admKnowledgeItems\.map\(\(k\) => k\.id\)\)/);
    assert.match(block, /function renderAdmKnowledge\(\)/);
    assert.match(block, /admKnowledgeItems\.map\(\(k\)/);
    assert.match(block, /loadAdmKnowledgePage\(true\)/);
    assert.match(block, /loadAdmKnowledgePage\(false\)/);
  });

  it('加载更多按钮真实存在并接线，只有还有下一页时显示', () => {
    assert.match(html, /id="knMore"[^>]*data-i="loadMore"[^>]*hidden/);
    assert.match(block, /\$\('knMore'\)/);
    assert.match(block, /more\.hidden = !admKnowledgeHasMore \|\| !admKnowledgeCursor/);
    assert.match(src, /\$\('knMore'\)\.onclick = \(\) => loadMoreAdmKnowledge\(\)/);
  });

  it('防重复点击，续页卡片保留全部审核动作', () => {
    assert.match(block, /if \(admKnowledgeLoading\) return/);
    assert.match(block, /admKnowledgeLoading = true/);
    assert.match(block, /admKnowledgeLoading = false/);
    for (const action of ['approve', 'reject', 'archive', 'restore']) {
      assert.match(block, new RegExp(`data-kn="${action}"`), `续页后仍须支持 ${action}`);
    }
  });
});
