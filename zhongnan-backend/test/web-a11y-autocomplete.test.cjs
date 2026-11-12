const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// v2.500 a11y：非凭证输入框 autocomplete 守卫
// Chrome/Lighthouse 对缺 autocomplete 的文本/搜索/数字输入会报 a11y 警告，
// 且浏览器自动填充会污染创意输入。规则：
//   - text/search/number/tel/url/email（含无 type 默认 text）必须有 autocomplete 属性
//   - checkbox/radio/file/hidden/range/color 豁免（autocomplete 无意义）
//   - password 豁免（凭证字段已单独处理）
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');

// 提取所有 input 标签（自闭合）
function extractInputs(src) {
  const re = /<input\b([^>]*?)\/?>/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    const type = (attrs.match(/\btype="([^"]+)"/i) || [])[1] || 'text';
    const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    const hasAC = /\bautocomplete=/.test(attrs);
    out.push({ type: type.toLowerCase(), id, hasAC, raw: m[0] });
  }
  return out;
}

const AUTOCOMPLETE_REQUIRED_TYPES = new Set(['text', 'search', 'number', 'tel', 'url', 'email']);

describe('v2.500 a11y：非凭证输入框必须声明 autocomplete', () => {
  it('所有 text/search/number/tel/url/email 输入框都有 autocomplete 属性', () => {
    const inputs = extractInputs(html);
    const violations = [];
    let checked = 0;
    for (const inp of inputs) {
      if (!AUTOCOMPLETE_REQUIRED_TYPES.has(inp.type)) continue;
      checked += 1;
      if (!inp.hasAC) {
        violations.push(`${inp.id || '(无id)'} [type=${inp.type}] 缺 autocomplete`);
      }
    }
    assert.ok(checked > 0, '应检查到至少一个非凭证输入框');
    assert.deepEqual(violations, [], `以下 ${violations.length} 个输入框缺 autocomplete：\n${violations.join('\n')}`);
  });
});
