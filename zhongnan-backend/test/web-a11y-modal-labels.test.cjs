const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.245 a11y 第五梯队：modal 对话框命名（aria-labelledby / aria-label）
// 现状：18 个 .modal-mask 弹窗在 v2.220 已运行时补 role="dialog"+aria-modal="true"，
// 但读屏器打开时只朗读"对话框"、不说"什么对话框"——标题在子级 h3 里却没和 dialog 关联。
// 本梯队补全：16 个静态 h3 弹窗补 id + aria-labelledby 指向标题；2 个无静态 h3 的弹窗
// （detailModal 动态注入标题、authModal 登录/注册 tab 无标题元素）补 aria-label。
// 解析采用线性扫描（与 web-a11y-headings 同款），禁「可选组套星号」避免灾难性回溯。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

// 期望表：每个 modal-mask 的命名策略
// - labelledby: mask 上应有 aria-labelledby="<此 id>"，且该 id 应落在 mask 内的 h3 上
// - label: mask 上应有 aria-label="<此值>"（用于无静态 h3 的弹窗）
const EXPECTED = [
  { mask: 'castLibModal', labelledby: 'castLibModalTitle' },
  { mask: 'propLibModal', labelledby: 'propLibModalTitle' },
  { mask: 'sceneLibModal', labelledby: 'sceneLibModalTitle' },
  { mask: 'assetDashboardModal', labelledby: 'assetDashboardModalTitle' },
  { mask: 'feedbackModal', labelledby: 'feedbackModalTitle' },
  { mask: 'sampleModal', labelledby: 'sampleModalTitle' },
  { mask: 'listModal', labelledby: 'listModalTitle' },
  { mask: 'fullModal', labelledby: 'fullTitle' },       // 既有 id 复用
  { mask: 'listenModal', labelledby: 'listenTitle' },   // 既有 id 复用
  { mask: 'dpModal', labelledby: 'dpTitle' },           // 既有 id 复用
  { mask: 'matModal', labelledby: 'matTitle' },         // 既有 id 复用
  { mask: 'pkModal', labelledby: 'pkModalTitle' },
  { mask: 'valueModal', labelledby: 'valueModalTitle' },
  { mask: 'smartModal', labelledby: 'smartModalTitle' },
  { mask: 'mineModal', labelledby: 'mineModalTitle' },
  { mask: 'xMatureModal', labelledby: 'xMatureTitle' }, // 既有 id 复用
  { mask: 'detailModal', label: '作品详情' },            // h3 由 openListingDetail 动态注入
  { mask: 'authModal', label: '登录或注册' },            // 无标题元素，tab 是切换器
];

// 提取指定 mask 的开标签（含全部属性），从 mask 起点到 mask 关闭处取 slice 以便后续在块内查 h3
function maskSlice(maskId) {
  const openTag = `<div class="modal-mask hidden" id="${maskId}"`;
  const i = html.indexOf(openTag);
  assert.ok(i >= 0, `找不到 #${maskId} 开标签`);
  // 找到开标签 '>' 位置
  const openEnd = html.indexOf('>', i);
  assert.ok(openEnd > i, `#${maskId} 开标签未闭合`);
  const openTagFull = html.slice(i, openEnd + 1);
  // 找下一个同级 mask 起点或 main 结束，作为块终点（简单可靠：index.html 结构稳定）
  const nextMaskIdx = html.indexOf('<div class="modal-mask hidden"', openEnd);
  const endIdx = nextMaskIdx > 0 ? nextMaskIdx : html.length;
  const body = html.slice(openEnd + 1, endIdx);
  return { openTag: openTagFull, body };
}

describe('v2.245 a11y：modal 对话框命名覆盖（18/18）', () => {
  it('全部 18 个 modal-mask 都有命名（aria-labelledby 或 aria-label）', () => {
    const missing = [];
    for (const { mask, labelledby, label } of EXPECTED) {
      const { openTag } = maskSlice(mask);
      const hasLabelledby = /aria-labelledby="[^"]+"/.test(openTag);
      const hasLabel = /aria-label="[^"]+"/.test(openTag);
      if (!hasLabelledby && !hasLabel) missing.push(mask);
      // 若定案要求 labelledby，则不能退化成 label；反之亦然（防漂移）
      if (labelledby && !hasLabelledby) missing.push(`${mask} 应使用 aria-labelledby`);
      if (label && !hasLabel) missing.push(`${mask} 应使用 aria-label`);
    }
    assert.deepEqual(missing, [], `缺命名的 modal：\n${missing.join('\n')}`);
  });

  it('aria-labelledby 值与期望一致（指向 mask 内的 h3 id）', () => {
    const mismatches = [];
    for (const { mask, labelledby } of EXPECTED.filter((x) => x.labelledby)) {
      const { openTag } = maskSlice(mask);
      const m = openTag.match(/aria-labelledby="([^"]+)"/);
      if (!m) { mismatches.push(`${mask} 缺 aria-labelledby`); continue; }
      if (m[1] !== labelledby) mismatches.push(`${mask}: aria-labelledby="${m[1]}" ≠ "${labelledby}"`);
    }
    assert.deepEqual(mismatches, [], `labelledby 不一致：\n${mismatches.join('\n')}`);
  });

  it('labelledby 引用的 id 在 mask 内的 h3 上真实存在（无悬挂引用）', () => {
    const dangling = [];
    for (const { mask, labelledby } of EXPECTED.filter((x) => x.labelledby)) {
      const { body } = maskSlice(mask);
      const h3 = body.match(/<h3[^>]*>/);
      if (!h3) { dangling.push(`${mask} 内找不到 h3`); continue; }
      const idm = h3[0].match(/id="([^"]+)"/);
      if (!idm) { dangling.push(`${mask} 的 h3 缺 id`); continue; }
      if (idm[1] !== labelledby) dangling.push(`${mask}: h3 id="${idm[1]}" ≠ labelledby "${labelledby}"`);
    }
    assert.deepEqual(dangling, [], `悬挂/不一致引用：\n${dangling.join('\n')}`);
  });

  it('无 h3 弹窗（detailModal/authModal）使用 aria-label 而非空 labelledby', () => {
    for (const { mask, label } of EXPECTED.filter((x) => x.label)) {
      const { openTag } = maskSlice(mask);
      assert.ok(!/aria-labelledby/.test(openTag), `${mask} 不应有 aria-labelledby（无静态 h3）`);
      const m = openTag.match(/aria-label="([^"]+)"/);
      assert.ok(m, `${mask} 缺 aria-label`);
      assert.equal(m[1], label, `${mask} aria-label 应为「${label}」`);
    }
  });

  it('命名后 id 全局唯一（复用 web-a11y-labels 的 id 唯一性原则）', () => {
    // 收集 EXPECTED 中所有 labelledby 目标 id
    const targetIds = EXPECTED.filter((x) => x.labelledby).map((x) => x.labelledby);
    for (const id of targetIds) {
      // 该 id 在全文应恰好出现 2 次：h3 id="..." 和 mask aria-labelledby="..."
      const re = new RegExp(`"${id}"`, 'g');
      const cnt = (html.match(re) || []).length;
      assert.equal(cnt, 2, `id "${id}" 应恰好出现 2 次（h3 id + mask labelledby），实际 ${cnt}`);
    }
  });
});
