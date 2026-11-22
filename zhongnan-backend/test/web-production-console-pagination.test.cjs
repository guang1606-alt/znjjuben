/**
 * v2.652 制作中管理台任务分页消费侧回归
 * 缺口：固定 limit=200 的窗口被当成全量任务，历史任务无入口；自动刷新若重置游标还会把管理员踢回首屏。
 * 本测试原样执行 production-console.js，仅替换 DOM、计时器和网络，验证真实按钮接线与分页状态。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'web', 'production-console.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'production-console.html'), 'utf8');

function task(id, status = 'RUNNING') {
  return {
    id, status, stage: 'draft', engineTier: 'STANDARD', pointsCost: 10,
    createdAt: '2026-11-22T08:00:00.000Z', finishedAt: null, durationMs: 1000,
    live: status === 'RUNNING', project: { id: 'p1', title: `项目-${id}`, mode: 'interview', userId: 'u1' },
  };
}

function setup() {
  const nodes = new Map();
  const requests = [];
  const tabs = [];
  let refreshTimer = null;

  function element(id) {
    const classes = new Set(id === 'main' || id === 'empty' ? ['hidden'] : []);
    const attrs = {};
    return {
      id, innerHTML: '', textContent: '', disabled: false,
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle(name, on) { if (on ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
      },
      setAttribute(key, value) { attrs[key] = String(value); },
      getAttribute(key) { return attrs[key]; },
      querySelectorAll(selector) {
        if (id === 'scopeTabs' && selector === 'button') return tabs;
        return [];
      },
    };
  }
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  for (const scope of ['active', 'failed', 'all']) {
    const tab = element(`tab-${scope}`);
    tab.setAttribute('data-scope', scope);
    if (scope === 'active') tab.classList.add('on');
    tabs.push(tab);
  }

  const pages = {
    '': { ok: true, tasks: [task('t1')], total: 3, hasMore: true, nextCursor: 'cursor-2' },
    'cursor-2': { ok: true, tasks: [task('t2', 'QUEUED')], total: 3, hasMore: true, nextCursor: 'cursor-3' },
    'cursor-3': { ok: true, tasks: [task('t3')], total: 3, hasMore: false, nextCursor: '' },
  };
  const context = {
    document: { hidden: false, getElementById: $, addEventListener() {} },
    Api: {
      isAuthed: () => true,
      request: async (url) => {
        requests.push(url);
        const parsed = new URL(url, 'http://localhost');
        return { ...pages[parsed.searchParams.get('cursor') || ''], scope: parsed.searchParams.get('scope') };
      },
      jsonOrThrow: async (response) => response,
    },
    setInterval(fn) { refreshTimer = fn; return 1; },
    clearInterval() { refreshTimer = null; },
    setTimeout() { return 1; },
    clearTimeout() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const click = async (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    assert.equal(typeof el.onclick, 'function', `${el.id} 必须有真实点击接线`);
    await el.onclick();
    await flush();
  };
  return { $, tabs, requests, flush, click, refresh: async () => { assert.ok(refreshTimer); await refreshTimer(); await flush(); } };
}

describe('v2.652 制作中管理台任务分页消费', () => {
  it('页面提供上一页/下一页/页信息，摘要区分本页指标与真总数', async () => {
    for (const id of ['prevPage', 'nextPage', 'pageMeta']) assert.match(html, new RegExp(`id="${id}"`), `HTML 缺少 ${id}`);
    const h = setup();
    await h.flush();
    assert.match(h.$('summary').innerHTML, /<b>3<\/b>任务总数/, '总数必须消费后端 total，而非 list.length');
    assert.match(h.$('summary').innerHTML, /本页实时执行/);
    assert.match(h.$('summary').innerHTML, /本页排队中/);
    assert.match(h.$('summary').innerHTML, /本页疑似孤儿/);
    assert.match(h.$('pageMeta').textContent, /第 1 页/);
    assert.match(h.$('pageMeta').textContent, /本页 1 条/);
    assert.equal(h.$('prevPage').disabled, true);
    assert.equal(h.$('nextPage').disabled, false);
  });

  it('下一页替换当前页，自动刷新保持游标，上一页返回原首屏', async () => {
    const h = setup();
    await h.flush();
    await h.click('nextPage');
    assert.match(h.requests[1], /cursor=cursor-2/);
    assert.match(h.$('taskBody').innerHTML, /t2/);
    assert.doesNotMatch(h.$('taskBody').innerHTML, /t1/);
    assert.match(h.$('pageMeta').textContent, /第 2 页/);

    await h.refresh();
    assert.match(h.requests[2], /cursor=cursor-2/, '自动刷新不得重置回首屏');
    assert.match(h.$('taskBody').innerHTML, /t2/);

    await h.click('prevPage');
    assert.doesNotMatch(h.requests[3], /cursor=/);
    assert.match(h.$('taskBody').innerHTML, /t1/);
    assert.match(h.$('pageMeta').textContent, /第 1 页/);
  });

  it('末页禁用下一页，切换任务范围清空游标栈', async () => {
    const h = setup();
    await h.flush();
    await h.click('nextPage');
    await h.click('nextPage');
    assert.match(h.requests[2], /cursor=cursor-3/);
    assert.equal(h.$('nextPage').disabled, true);
    assert.equal(h.$('prevPage').disabled, false);

    await h.click(h.tabs.find((tab) => tab.getAttribute('data-scope') === 'failed'));
    assert.match(h.requests[3], /scope=failed/);
    assert.doesNotMatch(h.requests[3], /cursor=/, '切换范围必须回到该范围首屏');
    assert.equal(h.$('prevPage').disabled, true);
    assert.match(h.$('pageMeta').textContent, /第 1 页/);
  });
});
