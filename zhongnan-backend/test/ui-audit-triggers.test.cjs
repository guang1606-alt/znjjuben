/**
 * v2.475 弹窗巡检覆盖守卫（test/ui-audit-triggers.test.cjs）
 *
 * 为什么需要：ui-audit.cjs --deep 过去对按需渲染的弹窗只能强开，读到空壳就跳过，
 * 「16 个弹窗没被真正检查过」这件事只写在注释里，下一轮很容易忘。本测试把覆盖要求
 * 变成机械断言：
 *   T1 页面里每个 .modal-mask[id] 都必须在 REAL_TRIGGERS 里出现（新增弹窗不能静默漏检）
 *   T2 REAL_TRIGGERS 不得残留页面里不存在的弹窗 id（避免目录腐化）
 *   T3 有真实入口的条目，其 #id 选择器必须真实存在于 index.html（防止入口改名后静默失效）
 *   T4 没有真实入口的条目必须写 needsData 说明盲区原因（"没覆盖"要显式，不许沉默）
 *   T5 巡检报告必须真的区分 triggeredBy / needsData / emptyModal（防止接线被删）
 */
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ui-audit.cjs');
const HTML = path.join(ROOT, 'web', 'index.html');

const html = fs.readFileSync(HTML, 'utf8');
const src = fs.readFileSync(SCRIPT, 'utf8');

// 页面内全部 modal-mask 的 id（同一标签里 class/id 顺序无关）
const modalIds = [...html.matchAll(/<div[^>]*\bmodal-mask\b[^>]*>/g)]
  .map((m) => (m[0].match(/\bid="([^"]+)"/) || [])[1])
  .filter(Boolean);

// 解析 REAL_TRIGGERS 对象字面量（每行一个条目）
function parseTriggers() {
  const start = src.indexOf('const REAL_TRIGGERS = {');
  assert.ok(start >= 0, 'ui-audit.cjs 必须有 REAL_TRIGGERS 目录');
  const body = src.slice(start, src.indexOf('\n};', start));
  const out = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^\s{2}([A-Za-z0-9_]+):\s*\{(.*)\},?\s*$/);
    if (!m) continue;
    const [, id, rest] = m;
    // sel 数组里可能含 [attr] 形式的选择器，方括号需按「到数组右界」非贪婪匹配
    const selBlock = (rest.match(/sel:\s*\[(.*?)\]\s*(?:,|$)/) || [])[1] || '';
    out[id] = {
      sels: [...selBlock.matchAll(/'([^']+)'/g)].map((x) => x[1]),
      needsData: (rest.match(/needsData:\s*'([^']*)'/) || [])[1] || '',
      pres: [...((rest.match(/pre:\s*(\[[^\]]*\]|'[^']*')/) || [])[1] || '').matchAll(/'([^']+)'/g)].map((x) => x[1]),
    };
  }
  return out;
}

const triggers = parseTriggers();
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

test('T1 每个弹窗都必须有巡检策略（真实入口或 needsData 盲区登记）', () => {
  assert.ok(modalIds.length >= 18, '应能解析出全部弹窗，实际 ' + modalIds.length);
  const missing = modalIds.filter((id) => !triggers[id]);
  assert.deepStrictEqual(missing, [], '这些弹窗既无真实入口也无 needsData，属静默漏检：' + missing.join(','));
});

test('T2 REAL_TRIGGERS 不得残留页面里不存在的弹窗', () => {
  const stale = Object.keys(triggers).filter((id) => !modalIds.includes(id));
  assert.deepStrictEqual(stale, [], '目录里有过期弹窗 id：' + stale.join(','));
});

test('T3 真实入口选择器必须能在 index.html 命中', () => {
  const bad = [];
  for (const [id, t] of Object.entries(triggers)) {
    for (const sel of t.sels) {
      if (sel.startsWith('#')) {
        if (!htmlIds.has(sel.slice(1))) bad.push(`${id} → ${sel}`);
      } else if (sel.startsWith('[')) {
        const attr = sel.replace(/^\[|\]$/g, '').split('=')[0];
        if (!new RegExp('\\b' + attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(html)) bad.push(`${id} → ${sel}`);
      }
    }
    // 前置入口（pre，可为数组）里的 #id 同样必须存在
    for (const pre of t.pres) {
      const head = pre.trim().split(/\s+/)[0];
      if (head.startsWith('#') && !htmlIds.has(head.slice(1))) bad.push(`${id} → pre ${head}`);
    }
  }
  assert.deepStrictEqual(bad, [], '入口改名/删除后巡检会静默失效：' + bad.join(', '));
});

test('T4 无真实入口的弹窗必须显式登记 needsData', () => {
  const bad = Object.entries(triggers)
    .filter(([, t]) => t.sels.length === 0 && !t.needsData.trim())
    .map(([id]) => id);
  assert.deepStrictEqual(bad, [], '这些弹窗没有真实入口却没写盲区原因：' + bad.join(','));
});

test('T5 巡检报告必须接线 triggeredBy / needsData / emptyModal', () => {
  assert.match(src, /data\.triggeredBy\s*=\s*by/, '真实入口来源要写进报告');
  assert.match(src, /data\.needsData\s*=\s*spec\.needsData/, '盲区原因要写进报告');
  assert.match(src, /kind:\s*'emptyModal'/, '真实入口打开后空白必须判缺陷');
  // 脚本语法自检，避免守卫自身坏掉
  execFileSync(process.execPath, ['--check', SCRIPT], { stdio: 'ignore' });
});

// T6 防止「空数据被误判空壳」与「加载中未等待」两类假缺陷回归：
// 空壳判据必须单一入口 + 真实入口要等骨架消失，否者每轮都要人工复核噪声。
test('T6 空壳判据单一入口且真实入口等待内容渲染', () => {
  assert.match(src, /function isShell\(data, realTriggered\)/, '空壳判据必须集中为一个函数');
  assert.match(src, /data\.shell = isShell\(data, true\)/, '真实入口分支必须复用 isShell');
  assert.match(src, /data\.shell = isShell\(data, false\)/, '强开兜底分支必须复用 isShell');
  assert.match(src, /sk-list\[aria-busy="true"\]/, '必须能识别加载骨架');
  assert.match(src, /overlayEmptyState|overlayReady/, '必须采样空态/已渲染标记，避免空数据误报');
});
