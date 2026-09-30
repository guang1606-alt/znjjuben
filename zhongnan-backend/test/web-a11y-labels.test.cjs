const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.240 a11y 表单标签程序化关联守卫：
// index.html 中「label + 紧邻控件（input/textarea/select）」必须以 for/id 显式关联，
// 否则屏幕阅读器无法朗读控件用途。包裹式 label（控件在 label 内部）天然关联，豁免；
// label 后紧跟非控件（组标题等）豁免。
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

function scanLabels(src) {
  const out = [];
  const re = /<label([^>]*)>([\s\S]*?)<\/label>/g;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    const inner = m[2];
    const wrapsCtl = /<(input|textarea|select)[\s>]/.test(inner);
    const rest = src.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const nm = rest.match(/^\s*<([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/);
    out.push({
      attrs,
      wrapsCtl,
      nextTag: nm ? nm[1] : null,
      nextAttrs: nm ? nm[2] : '',
      index: m.index,
    });
  }
  return out;
}

const attrVal = (attrs, name) => (attrs.match(new RegExp('\\b' + name + '="([^"]+)"')) || [])[1];

describe('v2.240 a11y：label+紧邻控件必须 for/id 程序化关联', () => {
  it('每个 label 紧邻控件对都有 for，且 for 值等于控件 id', () => {
    const labels = scanLabels(html);
    const violations = [];
    let pairCount = 0;
    for (const l of labels) {
      if (l.wrapsCtl) continue; // 包裹式天然关联
      if (!['input', 'textarea', 'select'].includes(l.nextTag)) continue; // 组标题等豁免
      pairCount += 1;
      const forV = attrVal(l.attrs, 'for');
      const idV = attrVal(l.nextAttrs, 'id');
      if (!idV) {
        violations.push(`index ${l.index}: 控件缺 id（无法关联）`);
      } else if (forV !== idV) {
        violations.push(`index ${l.index}: label for=${JSON.stringify(forV)} ≠ 控件 id=${JSON.stringify(idV)}`);
      }
    }
    assert.ok(pairCount >= 100, `label+紧邻控件对应不少于 100（当前 ${pairCount}），若大幅减少需复核扫描逻辑`);
    assert.deepEqual(violations, [], `未关联的 label+控件对：\n${violations.join('\n')}`);
  });

  it('所有 label for 属性必须引用存在的元素 id（无悬挂引用）', () => {
    const allIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const dangling = [];
    for (const m of html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)) {
      if (!allIds.has(m[1])) dangling.push(m[1]);
    }
    assert.deepEqual(dangling, [], `悬挂的 for 引用：${dangling.join(', ')}`);
  });

  it('index.html 元素 id 全局唯一（for/id 关联的前置完整性）', () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const seen = new Set();
    const dups = new Set();
    for (const id of ids) {
      if (seen.has(id)) dups.add(id);
      seen.add(id);
    }
    assert.deepEqual([...dups], [], `重复 id：${[...dups].join(', ')}`);
  });

  it('包裹式 label（控件在内部）不需要 for——确认豁免家族仍存在且未被误改', () => {
    const labels = scanLabels(html);
    const wrapping = labels.filter((l) => l.wrapsCtl);
    assert.ok(wrapping.length >= 20, `包裹式 label 应不少于 20（当前 ${wrapping.length}）`);
    // 包裹式若同时带 for，for 也必须指向真实 id
    const allIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const l of wrapping) {
      const forV = attrVal(l.attrs, 'for');
      if (forV) assert.ok(allIds.has(forV), `包裹式 label for=${forV} 悬挂`);
    }
  });
});
